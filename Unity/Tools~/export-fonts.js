// Exporta los glifos de las fuentes pixel de la web (assets/fonts/SaldoPixel.ttf y SaldoNum.ttf) a JSON
// para el port de Unity. No se copian a mano: se leen los TTF que usa el juego (tablas cmap, hmtx y glyf)
// y cada glifo se convierte en su rejilla de píxeles (1 píxel = 100 unidades; 1 em = 800 unidades).
// De paso avisa de los caracteres que salen en los textos del juego y que la fuente NO tiene
// (el navegador los pinta con otra fuente del sistema: eso no se puede igualar píxel a píxel).
// Uso: node Unity/Tools~/export-fonts.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Fonts.json');
const PIXEL = 100;   // unidades de fuente por píxel (tools/build-font.js: P)
const ROWS = 12;     // filas de la rejilla: 10 sobre la línea base y 2 por debajo

function readFont(file) {
  const b = fs.readFileSync(file);
  const u16 = (o) => b.readUInt16BE(o), i16 = (o) => b.readInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0, n = u16(4); i < n; i++) {
    const o = 12 + i * 16;
    tables[b.toString('latin1', o, o + 4)] = { off: u32(o + 8), len: u32(o + 12) };
  }
  const need = (t) => { if (!tables[t]) throw new Error(`${file}: falta la tabla ${t}`); return tables[t].off; };
  const head = need('head'), hhea = need('hhea'), maxp = need('maxp'), hmtx = need('hmtx'), loca = need('loca'), glyf = need('glyf'), cmapT = need('cmap');
  const unitsPerEm = u16(head + 18), longLoca = i16(head + 50) === 1;
  const ascender = i16(hhea + 4), descender = i16(hhea + 6), lineGap = i16(hhea + 8), nHM = u16(hhea + 34);
  const numGlyphs = u16(maxp + 4);
  if (unitsPerEm % PIXEL || ascender % PIXEL || descender % PIXEL) throw new Error(`${file}: las métricas no caen en la rejilla de píxeles`);

  const glyphs = [];
  for (let g = 0; g < numGlyphs; g++) {
    const adv = u16(hmtx + Math.min(g, nHM - 1) * 4);
    const o0 = longLoca ? u32(loca + g * 4) : u16(loca + g * 2) * 2;
    const o1 = longLoca ? u32(loca + g * 4 + 4) : u16(loca + g * 2 + 2) * 2;
    const contours = [];
    if (o1 > o0) {
      let p = glyf + o0;
      const nc = i16(p);
      if (nc < 0) throw new Error(`${file}: glifo compuesto ${g} (no se esperaba)`);
      p += 10;
      const ends = [];
      for (let i = 0; i < nc; i++, p += 2) ends.push(u16(p));
      p += 2 + u16(p); // instrucciones
      const np = nc ? ends[nc - 1] + 1 : 0;
      const flags = [];
      while (flags.length < np) {
        const f = b[p++];
        flags.push(f);
        if (f & 8) { let r = b[p++]; while (r-- > 0) flags.push(f); }
      }
      const xs = [], ys = [];
      let v = 0;
      for (const f of flags) {
        if (f & 2) { const d = b[p++]; v += (f & 16) ? d : -d; } else if (!(f & 16)) { v += i16(p); p += 2; }
        xs.push(v);
      }
      v = 0;
      for (const f of flags) {
        if (f & 4) { const d = b[p++]; v += (f & 32) ? d : -d; } else if (!(f & 32)) { v += i16(p); p += 2; }
        ys.push(v);
      }
      if (flags.some((f) => !(f & 1))) throw new Error(`${file}: glifo ${g} con curvas (no se esperaba)`);
      let s = 0;
      for (const e of ends) { const c = []; for (let i = s; i <= e; i++) c.push([xs[i], ys[i]]); contours.push(c); s = e + 1; }
    }
    if (adv % PIXEL) throw new Error(`${file}: avance fuera de rejilla en el glifo ${g}`);
    glyphs.push({ adv: adv / PIXEL, rows: raster(contours, file, g) });
  }

  // cmap (formato 4, Unicode BMP)
  const cmap = {};
  let sub = -1;
  for (let i = 0, n = u16(cmapT + 2); i < n; i++) {
    const o = cmapT + 4 + i * 8;
    if ((u16(o) === 3 && u16(o + 2) === 1) || u16(o) === 0) sub = cmapT + u32(o + 4);
  }
  if (sub < 0 || u16(sub) !== 4) throw new Error(`${file}: cmap sin subtabla de formato 4`);
  const segX2 = u16(sub + 6), endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  for (let s = 0; s < segX2; s += 2) {
    const end = u16(endO + s), start = u16(startO + s), delta = u16(deltaO + s), range = u16(rangeO + s);
    for (let c = start; c <= end && c !== 0xFFFF; c++) {
      let g;
      if (range === 0) g = (c + delta) & 0xFFFF;
      else { g = u16(rangeO + s + range + (c - start) * 2); if (g) g = (g + delta) & 0xFFFF; }
      if (g) cmap[c] = g;
    }
  }
  return { unitsPerEm, ascent: ascender / PIXEL, descent: -descender / PIXEL, lineGap: lineGap / PIXEL, glyphs, cmap };
}

// Rejilla de píxeles de un glifo: una máscara de bits por fila (bit c = columna c), regla de relleno "distinto de cero"
// muestreando el centro de cada píxel. Fila 0 = la más alta (10 px sobre la línea base).
function raster(contours, file, g) {
  const rows = new Array(ROWS).fill(0);
  if (!contours.length) return rows;
  let xMax = 0;
  for (const c of contours) for (const [x, y] of c) {
    if (x % PIXEL || y % PIXEL) throw new Error(`${file}: glifo ${g} fuera de la rejilla de píxeles`);
    if (x < 0 || y > 10 * PIXEL || y < -2 * PIXEL) throw new Error(`${file}: glifo ${g} se sale de la rejilla de 12 filas`);
    xMax = Math.max(xMax, x);
  }
  const cols = xMax / PIXEL;
  if (cols > 30) throw new Error(`${file}: glifo ${g} demasiado ancho`);
  for (let r = 0; r < ROWS; r++) {
    const py = (9.5 - r) * PIXEL;
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) * PIXEL;
      let wind = 0;
      for (const ct of contours) for (let i = 0; i < ct.length; i++) {
        const [ax, ay] = ct[i], [bx, by] = ct[(i + 1) % ct.length];
        if ((ay <= py) === (by <= py)) continue;
        const x = ax + (py - ay) / (by - ay) * (bx - ax);
        if (x > px) wind += by > ay ? 1 : -1;
      }
      if (wind) rows[r] |= 1 << c;
    }
  }
  return rows;
}

const fonts = {
  SaldoPixel: readFont(path.join(ROOT, 'assets', 'fonts', 'SaldoPixel.ttf')),
  SaldoNum: readFont(path.join(ROOT, 'assets', 'fonts', 'SaldoNum.ttf')),
};

// ---------- Caracteres de los textos que la fuente no tiene ----------
// 1) Los datos del juego tal cual los carga la web (todas las cadenas de SN.Data)
const DATA = ['js/core/sn.js', 'js/core/events.js', 'js/data/markets.js', 'js/data/events.js', 'js/data/simulation.js',
  'js/data/progression.js', 'js/data/luck.js', 'js/data/cipher.js', 'js/data/academy.js', 'js/data/story.js',
  'js/data/chat.js', 'js/data/music.js', 'js/data/finale.js'];
const ctx = { console, Math, JSON, Date, Promise, setTimeout, location: { search: '' } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of DATA) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }).runInContext(ctx);
const used = new Map(); // carácter -> dónde sale
const note = (ch, where) => { if (!used.has(ch)) used.set(ch, new Set()); used.get(ch).add(where); };
const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|nbsp);/g, ' ');
const seen = new Set();
(function walk(v, where) {
  if (typeof v === 'string') { for (const ch of stripTags(v)) note(ch, where); return; }
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  for (const k of Object.keys(v)) walk(v[k], where);
})(ctx.SN.Data, 'js/data');
// 2) El resto del código y el HTML: solo lo que no es ASCII (lo ASCII ahí es sobre todo código)
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'data') scan(p); continue; }
    if (!/\.(js|html)$/.test(e.name)) continue;
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    const src = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    for (const ch of src) if (ch.codePointAt(0) > 126) note(ch, rel);
  }
}
scan(path.join(ROOT, 'js'));
for (const ch of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '')) if (ch.codePointAt(0) > 126) note(ch, 'index.html');

const missing = [];
for (const [ch, where] of used) {
  const cp = ch.codePointAt(0);
  if (cp < 32 || cp === 0xA0) continue; // saltos de línea, tabuladores y espacio duro
  if (!fonts.SaldoPixel.cmap[cp]) missing.push({ ch, cp, where: [...where].sort() });
}
missing.sort((a, b) => a.cp - b.cp);

const out = {
  about: 'Generado por Unity/Tools~/export-fonts.js a partir de assets/fonts/*.ttf. No editar a mano.',
  pixel: PIXEL, rows: ROWS,
  fonts: Object.fromEntries(Object.entries(fonts).map(([name, f]) => [name, {
    unitsPerEm: f.unitsPerEm, ascent: f.ascent, descent: f.descent, lineGap: f.lineGap,
    glyphs: f.glyphs.map((g) => ({ adv: g.adv, rows: g.rows })),
    cmap: f.cmap,
  }])),
  missing: missing.map((m) => ({ ch: m.ch, cp: m.cp, where: m.where })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');

for (const [name, f] of Object.entries(fonts)) {
  console.log(`${name}: ${f.glyphs.length} glifos, ${Object.keys(f.cmap).length} caracteres, em ${f.unitsPerEm}, ascenso ${f.ascent} px, descenso ${f.descent} px`);
}
console.log(`-> ${path.relative(ROOT, OUT)}`);
if (missing.length) {
  console.log(`\nCaracteres usados en el juego que SaldoPixel NO tiene (${missing.length}):`);
  for (const m of missing) console.log(`  U+${m.cp.toString(16).toUpperCase().padStart(4, '0')} ${JSON.stringify(m.ch)}  ${m.where.join(', ')}`);
} else console.log('\nTodos los caracteres usados en los textos están en SaldoPixel.');
