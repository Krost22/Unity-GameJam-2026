// Genera la fuente pixel art "SaldoPixel" (TrueType) a partir de glifos dibujados en texto
// y la incrusta en css/font.css como data URI, así funciona abriendo index.html con file://.
// Uso: node tools/build-font.js
'use strict';
const fs = require('fs');
const path = require('path');

// Rejilla de 12 filas: 0-1 tildes de mayúsculas, 2 hueco, 3-9 cuerpo (7 px), 10-11 descendentes.
// Un píxel = 100 unidades; 1 em = 800 unidades => con font-size 8px cada píxel mide 1px.
const P = 100, EM = 800, ASC = 1000, DESC = 200, BASE_ROW = 9;

// Glifos: filas del cuerpo (fila 3 hacia abajo). '#' = píxel encendido.
// Formato 'fila|fila|...'; prefijo 'N:' para empezar en otra fila.
const G = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '....#|....#|....#|....#|#...#|#...#|.###.',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|.#|.#|#.',
  ':': '.|.|#|.|.|.|#',
  ';': '..|..|.#|..|..|.#|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '¡': '#|.|#|#|#|#|#',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '¿': '..#..|.....|..#..|.#...|#....|#...#|.###.',
  '"': '#.#|#.#|...|...|...|...|...',
  "'": '#|#|.|.|.|.|.',
  '(': '.#|#.|#.|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|.#|.#|#.',
  '[': '##|#.|#.|#.|#.|#.|##',
  ']': '##|.#|.#|.#|.#|.#|##',
  '-': '....|....|....|####|....|....|....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '=': '....|....|####|....|####|....|....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '\\': '#....|#....|.#...|..#..|...#.|....#|....#',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '$': '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.',
  '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  '>': '#...|.#..|..#.|...#|..#.|.#..|#...',
  '_': '.....|.....|.....|.....|.....|.....|.....|.....|#####',
  '|': '#|#|#|#|#|#|#',
  '^': '..#..|.#.#.|#...#|.....|.....|.....|.....',
  '~': '.....|.....|.#...|#.#.#|...#.|.....|.....',
  '°': '.#.|#.#|.#.|...|...|...|...',
  '·': '.|.|.|#|.|.|.',
  '×': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
  '±': '..#..|..#..|#####|..#..|..#..|.....|#####',
  '≈': '.....|.##.#|#..#.|.....|.##.#|#..#.|.....',
  '—': '......|......|......|######|......|......|......',
  '…': '.....|.....|.....|.....|.....|.....|#.#.#',
  '→': '......|...#..|....#.|######|....#.|...#..|......',
  '←': '......|..#...|.#....|######|.#....|..#...|......',
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|..#..',
  '↓': '..#..|..#..|..#..|..#..|#.#.#|.###.|..#..',
  '▲': '.....|.....|..#..|.###.|#####|.....|.....',
  '▼': '.....|.....|#####|.###.|..#..|.....|.....',
  '▶': '#...|##..|###.|####|###.|##..|#...',
  '◀': '...#|..##|.###|####|.###|..##|...#',
  '●': '.....|.###.|#####|#####|#####|.###.|.....',
  '○': '.....|.###.|#...#|#...#|#...#|.###.|.....',
  '■': '.....|#####|#####|#####|#####|#####|.....',
  '□': '.....|#####|#...#|#...#|#...#|#####|.....',
  '★': '..#..|..#..|#####|.###.|.###.|##.##|#...#',
  '♥': '.....|##.##|#####|#####|.###.|..#..|.....',
  '♪': '..##.|..#.#|..#..|..#..|###..|###..|.....',
  '✓': '......|.....#|....#.|#..#..|.##...|......|......',
};
// El alfabeto secreto del juego (js/data/cipher.js): letras cirílicas que no se parecen a ninguna latina.
// Una octava fila baja de la línea base (los "pies" de Д, Ц y Щ).
const CYRILLIC = {
  'Ж': '#.#.#|#.#.#|.###.|..#..|.###.|#.#.#|#.#.#',
  'Д': '.###.|.#.#.|.#.#.|.#.#.|.#.#.|.#.#.|#####|#...#',
  'Ф': '..#..|.###.|#.#.#|#.#.#|#.#.#|.###.|..#..',
  'Я': '.####|#...#|#...#|.####|..#.#|.#..#|#...#',
  'И': '#...#|#...#|#..##|#.#.#|##..#|#...#|#...#',
  'Л': '..###|.#..#|.#..#|.#..#|.#..#|.#..#|#...#',
  'Б': '#####|#....|#....|####.|#...#|#...#|####.',
  'Э': '.###.|#...#|....#|.####|....#|#...#|.###.',
  'Ц': '#..#.|#..#.|#..#.|#..#.|#..#.|#..#.|#####|....#',
  'Г': '#####|#....|#....|#....|#....|#....|#....',
  'Ю': '#..##.|#.#..#|#.#..#|###..#|#.#..#|#.#..#|#..##.',
  'Щ': '#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#####|....#',
  'Ш': '#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#####',
  'П': '#####|#...#|#...#|#...#|#...#|#...#|#...#',
  'Ч': '#...#|#...#|#...#|.####|....#|....#|....#',
  // 1.6: la F (la de FUTURO)
  'Ы': '#...#|#...#|#...#|##..#|#.#.#|#.#.#|##..#',
};
Object.assign(G, CYRILLIC);

// Minúsculas: altura x de 5 filas (5-9), ascendentes desde la fila 3 y descendentes hasta la 11
const LOWER = {
  a: '5:.###.|....#|.####|#...#|.####',
  b: '#....|#....|####.|#...#|#...#|#...#|####.',
  c: '5:.###|#...|#...|#...|.###',
  d: '....#|....#|.####|#...#|#...#|#...#|.####',
  e: '5:.###.|#...#|#####|#....|.####',
  f: '..##|.#..|####|.#..|.#..|.#..|.#..',
  g: '5:.####|#...#|#...#|#...#|.####|....#|.###.',
  h: '#....|#....|####.|#...#|#...#|#...#|#...#',
  i: '#|.|#|#|#|#|#',
  j: '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  k: '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  l: '#.|#.|#.|#.|#.|#.|.#',
  m: '5:####.|#.#.#|#.#.#|#.#.#|#.#.#',
  n: '5:####.|#...#|#...#|#...#|#...#',
  o: '5:.###.|#...#|#...#|#...#|.###.',
  p: '5:####.|#...#|#...#|#...#|####.|#....|#....',
  q: '5:.####|#...#|#...#|#...#|.####|....#|....#',
  r: '5:#.##|##..|#...|#...|#...',
  s: '5:.####|#....|.###.|....#|####.',
  t: '.#..|.#..|####|.#..|.#..|.#..|..##',
  u: '5:#...#|#...#|#...#|#...#|.####',
  v: '5:#...#|#...#|#...#|.#.#.|..#..',
  w: '5:#...#|#...#|#.#.#|#.#.#|.#.#.',
  x: '5:#...#|.#.#.|..#..|.#.#.|#...#',
  y: '5:#...#|#...#|#...#|#...#|.####|....#|.###.',
  z: '5:#####|...#.|..#..|.#...|#####',
};
Object.assign(G, LOWER);
// Minúsculas con tilde: la tilde va en las filas 3-4, sobre la altura x
const LOWER_ACCENTED = {
  'á': ['a', ['..#..', '.#...']], 'é': ['e', ['..#..', '.#...']], 'ó': ['o', ['..#..', '.#...']], 'ú': ['u', ['..#..', '.#...']],
  'ñ': ['n', ['.##.#', '#..#.']], 'ü': ['u', ['.....', '.#.#.']],
};
for (const [ch, [base, acc]] of Object.entries(LOWER_ACCENTED)) {
  const b = /^(\d+):(.*)$/.exec(G[base]);
  G[ch] = '3:' + acc.join('|') + '|' + b[2];
}
G['í'] = '3:.#|#.|..|#.|#.|#.|#.';

// Tildes para mayúsculas (filas 0-1), centradas sobre el glifo
const ACCENTS = { acute: ['..#', '.#.'], tilde: ['.##.#', '#..#.'], diaer: ['.....', '.#.#.'] };
const ACCENTED = {
  'Á': ['A', 'acute', 1], 'É': ['E', 'acute', 1], 'Í': ['I', 'acute', 0], 'Ó': ['O', 'acute', 1],
  'Ú': ['U', 'acute', 1], 'Ñ': ['N', 'tilde', 0], 'Ü': ['U', 'diaer', 0],
};
const ADVANCE = { ' ': 4 }; // avance especial (en píxeles)

function parse(spec) {
  let top = 3;
  const m = /^(\d+):(.*)$/.exec(spec);
  if (m) { top = +m[1]; spec = m[2]; }
  return { top, rows: spec.split('|') };
}

// Fuente de números: cifras en negrita (trazos de 2 px), todas del mismo ancho para que las cantidades
// no bailen al cambiar. Lo que no está aquí (letras, %, ×...) lo pone SaldoPixel por detrás.
const NUM = {
  0: '.####.|##..##|##..##|##..##|##..##|##..##|.####.',
  1: '..##..|.###..|..##..|..##..|..##..|..##..|.####.',
  2: '.####.|##..##|....##|..###.|.##...|##....|######',
  3: '#####.|....##|....##|..###.|....##|....##|#####.',
  4: '##..##|##..##|##..##|######|....##|....##|....##',
  5: '######|##....|#####.|....##|....##|##..##|.####.',
  6: '.####.|##....|##....|#####.|##..##|##..##|.####.',
  7: '######|....##|...##.|..##..|..##..|..##..|..##..',
  8: '.####.|##..##|##..##|.####.|##..##|##..##|.####.',
  9: '.####.|##..##|##..##|.#####|....##|....##|.####.',
  '$': '2:..##..|.#####|##....|##....|.####.|....##|....##|#####.|..##..',
  '.': '..|..|..|..|..|##|##',
  ',': '..|..|..|..|..|##|##|#.',
  '+': '......|..##..|..##..|######|..##..|..##..|......',
  '-': '.....|.....|.....|#####|#####|.....|.....',
  '/': '....##|....##|...##.|..##..|.##...|##....|##....',
  K: '##..##|##.##.|####..|###...|####..|##.##.|##..##',
  M: '##...##|###.###|#######|##.#.##|##...##|##...##|##...##',
};
const NUM_ADV = { ' ': 4, 1: 7 };

function buildTTF(familyName, G, ACCENTED, ADVANCE) {
const glyphs = []; // { char, top, rows }
function addGlyph(char, g) { glyphs.push({ char, top: g.top, rows: g.rows }); }
for (const [ch, spec] of Object.entries(G)) addGlyph(ch, parse(spec));
for (const [ch, [base, acc, shift]] of Object.entries(ACCENTED)) {
  const b = parse(G[base]);
  const w = b.rows[0].length;
  const a = ACCENTS[acc].map((r) => {
    const off = Math.max(0, Math.floor((w - r.length) / 2) + shift);
    return ('.'.repeat(off) + r + '.'.repeat(w)).slice(0, w);
  });
  addGlyph(ch, { top: 0, rows: [...a, '.'.repeat(w), ...b.rows] });
}

// Píxeles -> rectángulos (tramos horizontales fusionados en vertical)
function rectsOf(g) {
  const runs = [];
  g.rows.forEach((row, i) => {
    const r = g.top + i;
    for (let x = 0; x < row.length;) {
      if (row[x] !== '#') { x++; continue; }
      let x2 = x;
      while (x2 < row.length && row[x2] === '#') x2++;
      runs.push({ x0: x, x1: x2, r0: r, r1: r });
      x = x2;
    }
  });
  const merged = [];
  for (const run of runs) {
    const prev = merged.find((m) => m.x0 === run.x0 && m.x1 === run.x1 && m.r1 === run.r0 - 1);
    if (prev) prev.r1 = run.r0; else merged.push({ ...run });
  }
  return merged.map((m) => ({ x0: m.x0 * P, x1: m.x1 * P, y0: (BASE_ROW - m.r1) * P, y1: (BASE_ROW + 1 - m.r0) * P }));
}

// --- Escritura binaria ---
class Buf {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 255); return this; }
  u16(v) { this.b.push((v >> 8) & 255, v & 255); return this; }
  i16(v) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { this.u16((v >>> 16) & 65535); this.u16(v & 65535); return this; }
  tag(s) { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  bytes(arr) { for (const x of arr) this.u8(x); return this; }
  pad4() { while (this.b.length % 4) this.u8(0); return this; }
  get length() { return this.b.length; }
}

const notdef = { char: null, rects: [{ x0: 0, x1: 400, y0: 0, y1: 700 }, { x0: 100, x1: 300, y0: 100, y1: 600 }], adv: 5 };
const ordered = [notdef, { char: ' ', rects: [], adv: ADVANCE[' '] }];
for (const g of glyphs) {
  const w = Math.max(...g.rows.map((r) => r.length));
  ordered.push({ char: g.char, rects: rectsOf(g), adv: ADVANCE[g.char] || w + 1 });
}
// .notdef: caja hueca (contorno interior en sentido contrario)
notdef.holes = true;

const glyf = new Buf(), loca = [];
let maxPoints = 0, maxContours = 0;
const bbox = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
const metrics = [];
for (const g of ordered) {
  loca.push(glyf.length);
  if (!g.rects.length) { metrics.push({ adv: g.adv * P, lsb: 0 }); continue; }
  const pts = [], ends = [];
  g.rects.forEach((r, i) => {
    // Horario en coordenadas con Y hacia arriba = contorno exterior. El hueco del .notdef va al revés.
    const quad = (g.holes && i === 1)
      ? [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]
      : [[r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x1, r.y0]];
    pts.push(...quad);
    ends.push(pts.length - 1);
  });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const gb = { xMin: Math.min(...xs), yMin: Math.min(...ys), xMax: Math.max(...xs), yMax: Math.max(...ys) };
  bbox.xMin = Math.min(bbox.xMin, gb.xMin); bbox.yMin = Math.min(bbox.yMin, gb.yMin);
  bbox.xMax = Math.max(bbox.xMax, gb.xMax); bbox.yMax = Math.max(bbox.yMax, gb.yMax);
  glyf.i16(ends.length).i16(gb.xMin).i16(gb.yMin).i16(gb.xMax).i16(gb.yMax);
  ends.forEach((e) => glyf.u16(e));
  glyf.u16(0); // sin instrucciones
  pts.forEach(() => glyf.u8(1)); // todos los puntos sobre la curva, coordenadas int16
  let px = 0, py = 0;
  pts.forEach(([x]) => { glyf.i16(x - px); px = x; });
  pts.forEach(([, y]) => { glyf.i16(y - py); py = y; });
  glyf.pad4();
  maxPoints = Math.max(maxPoints, pts.length);
  maxContours = Math.max(maxContours, ends.length);
  metrics.push({ adv: g.adv * P, lsb: gb.xMin });
}
loca.push(glyf.length);
const numGlyphs = ordered.length;

// cmap: cada carácter con su glifo; si falta una minúscula, usa la mayúscula
const cmapPairs = [];
const own = new Set(ordered.filter((g) => g.char).map((g) => g.char));
ordered.forEach((g, gid) => {
  if (!g.char) return;
  cmapPairs.push([g.char.codePointAt(0), gid]);
  const lower = g.char.toLowerCase();
  if (familyName !== 'SaldoNum' && lower !== g.char && !own.has(lower)) cmapPairs.push([lower.codePointAt(0), gid]);
});
cmapPairs.sort((a, b) => a[0] - b[0]);
const segs = [];
for (const [code, gid] of cmapPairs) {
  const last = segs[segs.length - 1];
  if (last && code === last.end + 1 && gid - code === last.delta) last.end = code;
  else segs.push({ start: code, end: code, delta: gid - code });
}
segs.push({ start: 0xFFFF, end: 0xFFFF, delta: 1 });
const segCount = segs.length;
const sub = new Buf();
const entrySel = Math.floor(Math.log2(segCount));
const searchRange = 2 * (1 << entrySel);
sub.u16(4).u16(16 + segCount * 8).u16(0).u16(segCount * 2).u16(searchRange).u16(entrySel).u16(segCount * 2 - searchRange);
segs.forEach((s) => sub.u16(s.end));
sub.u16(0);
segs.forEach((s) => sub.u16(s.start));
segs.forEach((s) => sub.u16(((s.delta % 65536) + 65536) % 65536)); // idDelta es módulo 65536
segs.forEach(() => sub.u16(0));
const cmap = new Buf().u16(0).u16(2)
  .u16(0).u16(3).u32(20)
  .u16(3).u16(1).u32(20)
  .bytes(sub.b);

const advMax = Math.max(...metrics.map((m) => m.adv));
const head = new Buf().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(EM)
  .u32(0).u32(0xE0000000).u32(0).u32(0xE0000000)
  .i16(bbox.xMin).i16(bbox.yMin).i16(bbox.xMax).i16(bbox.yMax)
  .u16(0).u16(8).i16(2).i16(1).i16(0);
const hhea = new Buf().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(advMax).i16(0).i16(0).i16(bbox.xMax)
  .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs);
const maxp = new Buf().u32(0x00010000).u16(numGlyphs).u16(maxPoints).u16(maxContours).u16(0).u16(0)
  .u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
const hmtx = new Buf();
metrics.forEach((m) => hmtx.u16(m.adv).i16(m.lsb));
const locaBuf = new Buf();
loca.forEach((o) => locaBuf.u32(o));
const codes = cmapPairs.map((p) => p[0]);
const os2 = new Buf().u16(4).i16(600).u16(400).u16(5).u16(0)
  .i16(500).i16(500).i16(0).i16(100).i16(500).i16(500).i16(0).i16(400)
  .i16(P).i16(400).i16(0)
  .bytes([2, 11, 6, 9, 0, 0, 0, 0, 0, 0])
  .u32(3).u32((1 << 5) | (1 << 13) | (1 << 14)).u32(0).u32(0)
  .tag('KROS').u16(0x40).u16(Math.min(...codes)).u16(Math.min(0xFFFF, Math.max(...codes)))
  .i16(ASC).i16(-DESC).i16(0).u16(ASC).u16(DESC)
  .u32(1).u32(0).i16(700).i16(700).u16(0).u16(32).u16(1);
const names = { 1: familyName, 2: 'Regular', 3: familyName + '-1.0', 4: familyName + ' Regular', 5: 'Version 1.0', 6: familyName + '-Regular' };
const nameRecs = Object.entries(names);
const nameStr = new Buf();
const name = new Buf().u16(0).u16(nameRecs.length).u16(6 + nameRecs.length * 12);
nameRecs.forEach(([id, s]) => {
  const off = nameStr.length;
  for (const c of s) nameStr.u16(c.charCodeAt(0));
  name.u16(3).u16(1).u16(0x409).u16(+id).u16(s.length * 2).u16(off);
});
name.bytes(nameStr.b);
const post = new Buf().u32(0x00030000).u32(0).i16(-P).i16(P).u32(0).u32(0).u32(0).u32(0).u32(0);

const tables = { 'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca: locaBuf, maxp, name, post };
const tags = Object.keys(tables).sort();
const checksum = (bytes) => {
  const b = bytes.slice();
  while (b.length % 4) b.push(0);
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) sum = (sum + ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])) >>> 0;
  return sum;
};
const font = new Buf();
const n = tags.length, es = Math.floor(Math.log2(n)), sr = (1 << es) * 16;
font.u32(0x00010000).u16(n).u16(sr).u16(es).u16(n * 16 - sr);
let offset = 12 + n * 16;
const layout = [];
for (const t of tags) {
  const data = tables[t].b;
  layout.push({ t, data, offset });
  font.tag(t).u32(checksum(data)).u32(offset).u32(data.length);
  offset += Math.ceil(data.length / 4) * 4;
}
for (const l of layout) { font.bytes(l.data); font.pad4(); }
// checkSumAdjustment del head
const total = checksum(font.b);
const adj = (0xB1B0AFBA - total) >>> 0;
const headOff = layout.find((l) => l.t === 'head').offset + 8;
font.b[headOff] = (adj >>> 24) & 255; font.b[headOff + 1] = (adj >>> 16) & 255;
font.b[headOff + 2] = (adj >>> 8) & 255; font.b[headOff + 3] = adj & 255;

return Buffer.from(font.b);
}

const root = path.join(__dirname, '..');
const ttf = buildTTF('SaldoPixel', G, ACCENTED, ADVANCE);
const ttfNum = buildTTF('SaldoNum', NUM, {}, NUM_ADV);
fs.mkdirSync(path.join(root, 'assets', 'fonts'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'fonts', 'SaldoPixel.ttf'), ttf);
fs.writeFileSync(path.join(root, 'assets', 'fonts', 'SaldoNum.ttf'), ttfNum);
const css = `/* Generado por tools/build-font.js — fuente pixel art propia de Saldo Negro. No editar a mano. */
@font-face {
  font-family: 'SaldoPixel';
  src: url(data:font/ttf;base64,${ttf.toString('base64')}) format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'SaldoNum';
  src: url(data:font/ttf;base64,${ttfNum.toString('base64')}) format('truetype');
  font-weight: normal;
  font-style: normal;
}
`;
fs.writeFileSync(path.join(root, 'css', 'font.css'), css);
console.log(`SaldoPixel: ${ttf.length} bytes · SaldoNum: ${ttfNum.length} bytes`);
