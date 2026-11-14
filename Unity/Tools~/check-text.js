// Comprueba el modelo de texto del port contra las referencias de Chrome (ref-text.js), sin Unity.
// Pinta cada caso con los glifos exportados (Fonts.json) y lo compara con lo que pintó Chrome.
//
// Lo que hace Chrome con el texto de un lienzo (y lo que copia el port):
//   · cada glifo es su rejilla de píxeles, a tamaño / 8 píxeles de lienzo por píxel de glifo;
//   · el texto empieza en x (izquierda), x - ancho / 2 (centro) o x - ancho (derecha), SIN redondear: un texto
//     centrado de ancho impar cae a medio píxel y cada columna se reparte entre dos píxeles (cobertura 0.5);
//   · cada glifo se compone por separado sobre lo que hay debajo.
// Lo que NO se copia: en Windows, además, ClearType corre cada glifo un poco hacia los lados (un halo de un
// píxel) y cambia el alfa según el color. Eso depende del sistema operativo, no del juego. Por eso aquí:
//   · texto en píxel entero  -> se compara el NÚCLEO: un píxel de Chrome es texto si su alfa >= 170
//                               (el halo se queda en 152 como mucho; el núcleo no baja de 192);
//   · texto a medio píxel    -> se compara el centro de masas horizontal (el halo es simétrico y no lo mueve).
// Uso: node Unity/Tools~/check-text.js
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('./lib/png');

const A = path.join(__dirname, '..', 'Assets', 'SaldoNegro');
const FONTS = JSON.parse(fs.readFileSync(path.join(A, 'Resources', 'SaldoNegro', 'Fonts.json'), 'utf8'));
const REFS = JSON.parse(fs.readFileSync(path.join(A, 'Tests', 'EditMode', 'Refs', 'TextRefs.json'), 'utf8'));
const F = FONTS.fonts.SaldoPixel;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const CORE = 170;

function width(str, s) { let w = 0; for (const ch of String(str)) { const g = F.cmap[ch.codePointAt(0)]; w += (g ? F.glyphs[g].adv : 0) * s; } return w; }

// Pinta un caso. Devuelve la imagen RGBA y, por cada texto, su caja y si cae en píxel entero.
function render(k) {
  const out = new Float64Array(k.w * k.h * 4); // RGBA sin premultiplicar, alfa 0..1
  const boxes = [];
  const fillText = (str, x, y, col, size, align) => {
    const s = size / 8, c = hex(col), w = width(str, s);
    let pen = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const box = { x0: Math.floor(pen) - 2, x1: Math.ceil(pen + w) + 2, y0: y - 10 * s, y1: y + 2 * s, whole: Number.isInteger(pen) };
    for (const ch of String(str)) {
      const gi = F.cmap[ch.codePointAt(0)];
      if (!gi) continue;
      const g = F.glyphs[gi], base = Math.floor(pen), f = pen - base;
      for (let r = 0; r < 12; r++) {
        if (!g.rows[r]) continue;
        // Cobertura horizontal de esta fila del glifo (se suma dentro del glifo)
        const cov = new Float64Array(g.adv * s + s + 2);
        for (let cx = 0; cx < 16; cx++) {
          if (!(g.rows[r] >> cx & 1)) continue;
          const a = cx * s + f, b = a + s;
          for (let p = Math.floor(a); p < Math.ceil(b); p++) cov[p] += Math.min(b, p + 1) - Math.max(a, p);
        }
        for (let j = 0; j < s; j++) {
          const py = y - (10 - r) * s + j;
          if (py < 0 || py >= k.h) continue;
          for (let p = 0; p < cov.length; p++) {
            const a = Math.min(1, cov[p]), px = base + p;
            if (!a || px < 0 || px >= k.w) continue;
            const o = (py * k.w + px) * 4, da = out[o + 3], oa = a + da * (1 - a);
            for (let q = 0; q < 3; q++) out[o + q] = (c[q] * a + out[o + q] * da * (1 - a)) / oa;
            out[o + 3] = oa;
          }
        }
      }
      pen += g.adv * s;
    }
    return box;
  };
  for (const d of k.draws) {
    const size = d.size || 8, str = String(d.t);
    if (d.outline) { const o = size / 8; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [0, o * 2]]) fillText(str, Math.round(d.x + dx), Math.round(d.y + dy), d.outline, size, d.align); }
    boxes.push(Object.assign(fillText(str, Math.round(d.x), Math.round(d.y), d.c, size, d.align), { t: str, outline: !!d.outline }));
  }
  return { out, boxes };
}

let bad = 0, checked = 0;
for (const k of REFS.cases) {
  const al = Buffer.from(k.alpha, 'base64'), ref = new Uint8Array(al.length * 4);
  for (let i = 0; i < al.length; i++) ref[i * 4 + 3] = al[i];
  const { out, boxes } = render(k);
  const img = new Uint8Array(k.w * k.h * 4);
  for (let i = 0; i < img.length; i += 4) { img[i] = Math.round(out[i]); img[i + 1] = Math.round(out[i + 1]); img[i + 2] = Math.round(out[i + 2]); img[i + 3] = Math.round(out[i + 3] * 255); }
  fs.mkdirSync(path.join(__dirname, 'out', 'text'), { recursive: true });
  png.write(path.join(__dirname, 'out', 'text', `port-${k.name}.png`), { width: k.w, height: k.h, data: img });
  let caseBad = 0, half = 0;
  const allWhole = boxes.every((b) => b.whole);
  const regions = allWhole ? [{ x0: 0, x1: k.w, y0: 0, y1: k.h, whole: true, t: '(todo el lienzo)' }] : boxes;
  for (const b of regions) {
    checked++;
    if (b.whole) {
      let n = 0, first = null;
      for (let y = Math.max(0, b.y0); y < Math.min(k.h, b.y1); y++) for (let x = Math.max(0, b.x0); x < Math.min(k.w, b.x1); x++) {
        const o = (y * k.w + x) * 4, mine = out[o + 3] > 0.999, core = ref[o + 3] >= CORE;
        if (mine !== core) { n++; if (!first) first = `${x},${y} ${mine ? 'sobra' : 'falta'} (alfa de Chrome ${ref[o + 3]})`; }
      }
      if (n) { caseBad++; console.log(`  ${k.name} "${b.t}": ${n} píxeles distintos, p. ej. ${first}`); }
    } else {
      half++;
      // Centro de masas horizontal y filas ocupadas
      let sm = 0, mm = 0, sr = 0, mr = 0, rowsBad = 0;
      for (let y = Math.max(0, b.y0); y < Math.min(k.h, b.y1); y++) {
        let rm = 0, rr = 0;
        for (let x = Math.max(0, b.x0); x < Math.min(k.w, b.x1); x++) {
          const o = (y * k.w + x) * 4;
          sm += out[o + 3]; mm += out[o + 3] * (x + 0.5); rm += out[o + 3];
          sr += ref[o + 3]; mr += ref[o + 3] * (x + 0.5); rr += ref[o + 3];
        }
        if ((rm > 0) !== (rr > 0)) rowsBad++;
      }
      const dx = mm / sm - mr / sr;
      if (Math.abs(dx) > 0.06 || rowsBad) { caseBad++; console.log(`  ${k.name} "${b.t}": centro desplazado ${dx.toFixed(3)} px, filas distintas ${rowsBad}`); }
    }
  }
  bad += caseBad;
  console.log(`${caseBad ? 'FALLO' : 'ok   '} ${k.name}: ${regions.length} comprobaciones${half ? ` (${half} a medio píxel)` : ''}`);
}
let wbad = 0;
for (const w of REFS.widths) if (width(w.t, 1) !== w.w8 || width(w.t, 2) !== w.w16) { wbad++; console.log('  ancho distinto:', JSON.stringify(w.t), width(w.t, 1), w.w8, width(w.t, 2), w.w16); }
console.log(`${wbad ? 'FALLO' : 'ok   '} anchos (measureText): ${REFS.widths.length - wbad} de ${REFS.widths.length} iguales`);
console.log(bad + wbad ? `\n${bad + wbad} comprobaciones fallan de ${checked + 1}` : `\nTodo igual: ${checked + 1} comprobaciones`);
process.exit(bad + wbad ? 1 : 0);
