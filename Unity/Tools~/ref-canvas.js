// Referencias del LIENZO: cómo pinta Chrome sin GPU (Skia en la CPU) cada operación de canvas que usa el juego.
// Cada caso es una lista de operaciones en JSON; Chrome las ejecuta sobre un <canvas> de verdad y se guarda lo que
// devuelve getImageData. El port (Assets/SaldoNegro/Draw/Canvas.cs) ejecuta la misma lista con su Ctx2D y tiene
// que dar los mismos bytes (Assets/SaldoNegro/Tests/EditMode/CanvasSuite.cs).
// Barridos exhaustivos donde importa el redondeo: transparencias (globalAlpha y rgba()), premultiplicar al
// poner píxeles, mezclas 'lighter' y 'multiply', imágenes semitransparentes, bordes a medio píxel, drawImage
// con escalas, espejos y giros, recortes y arcos.
// Operaciones: ["set", prop, valor] | ["call", método, ...args] | ["img", nombre, w, h, tipo] (lienzo con un
// dibujo de fórmula) | ["draw", nombre, ...args] (drawImage) | ["put", tipo, w, h, x, y] (putImageData de una
// fórmula) | ["rows", y0, n, prop, [valores], método, ...args] (en cada fila y0+i: prop = valores[i] y
// método(...args con "Y" -> y0+i)).
// Uso: node Unity/Tools~/ref-canvas.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'CanvasRefs.json');

// ---------- Casos ----------
const cases = [];
const add = (name, w, h, ops) => cases.push({ name, w, h, ops });
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const hx2 = (v) => v.toString(16).padStart(2, '0');
const rgb = (r, g, b) => '#' + hx2(r) + hx2(g) + hx2(b);

// 1) Premultiplicar y quitar la premultiplicación: putImageData con todos los (color, alfa) y getImageData
add('put-get', 256, 256, [['put', 'grid', 256, 256, 0, 0]]);

// 2) Relleno con globalAlpha sobre fondo opaco: columnas = color de fondo (0..255), filas = alfa (0..1 en 300 pasos)
const alphas = range(300, (i) => i / 299);
for (const s of [[0, 0, 0], [255, 255, 255], [137, 64, 201], [250, 3, 128]]) {
  add(`alpha-${s.join('-')}`, 256, 300, [['put', 'cols', 256, 300, 0, 0], ['set', 'fillStyle', rgb(...s)],
    ['rows', 0, 300, 'globalAlpha', alphas, 'fillRect', 0, 'Y', 256, 1]]);
}
// Alfas "redondos" que usa el juego (0.05, 0.07, 0.18, 0.35...) y su producto por el alfa del color
const gameAlphas = [0.04, 0.045, 0.05, 0.056, 0.07, 0.084, 0.098, 0.1, 0.12, 0.15, 0.18, 0.2, 0.25, 0.3, 0.33, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99, 0.001, 0.002, 0.003];
add('alpha-juego', 256, gameAlphas.length, [['put', 'cols', 256, gameAlphas.length, 0, 0], ['set', 'fillStyle', '#FF8F3F'],
  ['rows', 0, gameAlphas.length, 'globalAlpha', gameAlphas, 'fillRect', 0, 'Y', 256, 1]]);
// 3) Color con alfa propio (rgba()) y además globalAlpha
add('rgba-fill', 256, 200, [['put', 'cols', 256, 200, 0, 0], ['set', 'globalAlpha', 0.6],
  ['rows', 0, 200, 'fillStyle', range(200, (i) => `rgba(200, 100, 50, ${(i / 199).toFixed(3)})`), 'fillRect', 0, 'Y', 256, 1]]);
add('rgba-hex8', 256, 64, [['put', 'cols', 256, 64, 0, 0],
  ['rows', 0, 64, 'fillStyle', range(64, (i) => '#3DDC84' + hx2(i * 4)), 'fillRect', 0, 'Y', 256, 1]]);
// 4) Sobre un fondo semitransparente (columnas = alfa del fondo)
add('alpha-sobre-transparente', 256, 120, [['put', 'acols', 256, 120, 0, 0], ['set', 'fillStyle', '#45E3DA'],
  ['rows', 0, 120, 'globalAlpha', range(120, (i) => i / 119), 'fillRect', 0, 'Y', 256, 1]]);
// 5) 'lighter' y 'multiply'
for (const op of ['lighter', 'multiply']) {
  add(`${op}`, 256, 150, [['put', 'cols', 256, 150, 0, 0], ['set', 'globalCompositeOperation', op], ['set', 'fillStyle', '#D33F9C'],
    ['rows', 0, 150, 'globalAlpha', range(150, (i) => i / 149), 'fillRect', 0, 'Y', 256, 1]]);
  add(`${op}-transparente`, 256, 100, [['put', 'acols', 256, 100, 0, 0], ['set', 'globalCompositeOperation', op], ['set', 'fillStyle', '#F2DCEE'],
    ['rows', 0, 100, 'globalAlpha', range(100, (i) => i / 99), 'fillRect', 0, 'Y', 256, 1]]);
}
// 6) Imágenes: opacas, semitransparentes y con agujeros, sobre fondo opaco, con globalAlpha
for (const ga of [1, 0.5, 0.33, 0.8, 0.07]) {
  add(`imagen-alfa-${ga}`, 96, 64, [['put', 'cols', 96, 64, 0, 0], ['img', 'a', 64, 64, 'alpha'], ['img', 's', 30, 20, 'sprite'],
    ['set', 'globalAlpha', ga], ['draw', 'a', 0, 0], ['draw', 's', 64, 3], ['draw', 's', 66, 40]]);
}
add('imagen-sobre-vacio', 64, 64, [['img', 'a', 64, 64, 'alpha'], ['draw', 'a', 0, 0], ['set', 'globalAlpha', 0.5], ['draw', 'a', 7, 9]]);
// 7) drawImage: posiciones con decimales, escalas, recorte de origen, espejo y giros (sin suavizado)
{
  const ops = [['set', 'imageSmoothingEnabled', false], ['img', 's', 13, 9, 'sprite'], ['img', 'o', 24, 18, 'opaque']];
  const pos = [[2, 2], [20.5, 2], [38.25, 2.75], [56.5, 2.5], [74.75, 2.4], [92.49, 2.51], [110.51, 2.49]];
  for (const [x, y] of pos) ops.push(['draw', 's', x, y]);
  ops.push(['draw', 'o', 2, 16, 48, 36], ['draw', 'o', 54, 16, 12, 9], ['draw', 'o', 70, 16, 17, 13], ['draw', 'o', 90, 16, 30.5, 22.5]);
  ops.push(['draw', 'o', 4, 3, 10, 8, 2, 56, 40, 32], ['draw', 'o', 0, 0, 24, 18, 50, 56, 37, 27], ['draw', 'o', 5, 5, 7, 7, 92, 56, 21, 14]);
  ops.push(['call', 'save'], ['call', 'translate', 140, 2], ['call', 'scale', -1, 1], ['draw', 's', 0, 0], ['call', 'restore']);
  ops.push(['call', 'save'], ['call', 'translate', 160, 20], ['call', 'scale', -1, 1], ['draw', 'o', 0, 0], ['call', 'restore']);
  ops.push(['call', 'setTransform', 2, 0, 0, 2, 0, 0], ['draw', 's', 64, 2], ['draw', 's', 64.5, 8.25], ['call', 'setTransform', 1, 0, 0, 1, 0, 0]);
  add('drawimage-geometria', 200, 100, ops);
}
for (const rot of [0, 0.1, 0.25, 0.37, 0.5, 0.75, 0.9, 1]) {
  add(`drawimage-giro-${rot}`, 64, 64, [['set', 'imageSmoothingEnabled', false], ['img', 'o', 24, 18, 'opaque'], ['img', 's', 13, 9, 'sprite'],
    ['call', 'save'], ['call', 'translate', 32, 30], ['call', 'rotate', -Math.PI / 2 * rot], ['draw', 'o', -12, -8], ['call', 'restore'],
    ['call', 'save'], ['call', 'translate', 50, 52], ['call', 'rotate', -Math.PI / 2 * rot], ['draw', 's', -7, -4], ['call', 'restore']]);
}
// 7b) Más escalas (para el redondeo del muestreo): las del juego y otras cualquiera
{
  const ops = [['set', 'imageSmoothingEnabled', false], ['img', 'o', 24, 18, 'opaque']];
  let x = 0, y = 0;
  for (const [w, h] of [[12, 9], [8, 6], [36, 27], [60, 45], [25, 19], [13, 10], [48.5, 36.25], [20, 23], [7, 5], [31, 17], [24.5, 18.5], [6, 4.5]]) {
    if (x + w > 190) { x = 0; y += 50; }
    ops.push(['draw', 'o', 0, 0, 24, 18, x + 0.25 * (y % 3), y, w, h]);
    x += Math.ceil(w) + 2;
  }
  add('drawimage-escalas', 200, 150, ops);
}
// 8) Rectángulos con decimales (bordes suavizados)
{
  const ops = [['set', 'fillStyle', '#FFD34E']];
  const rs = [[1, 1, 3.5, 3.5], [6.5, 1, 3, 3], [11.25, 1.75, 4.5, 2.5], [18.1, 1.9, 0.6, 5.2], [21, 1, 0.3, 0.3], [24.7, 0.4, 7.9, 6.3], [34.33, 2.66, 1.01, 1.01]];
  for (const r of rs) ops.push(['call', 'fillRect', ...r]);
  ops.push(['set', 'globalAlpha', 0.5]);
  for (const r of rs) ops.push(['call', 'fillRect', r[0], r[1] + 9, r[2], r[3]]);
  add('rect-decimales', 48, 20, ops);
}
// 9) Recortes: rectángulos y par-impar
add('clip-rect', 64, 40, [['set', 'imageSmoothingEnabled', false], ['put', 'cols', 64, 40, 0, 0], ['img', 'o', 24, 18, 'opaque'], ['call', 'save'], ['call', 'beginPath'],
  ['call', 'rect', 0, 0, 20, 30], ['call', 'rect', 30, 0, 34, 30], ['call', 'clip'], ['call', 'setTransform', 2, 0, 0, 2, 0, 0], ['draw', 'o', 0, 0],
  ['call', 'setTransform', 1, 0, 0, 1, 0, 0], ['set', 'fillStyle', '#FF4F6D'], ['call', 'fillRect', 0, 32, 64, 8], ['call', 'restore'],
  ['set', 'fillStyle', '#3DDC84'], ['call', 'fillRect', 0, 36, 64, 4]]);
add('clip-parimpar', 64, 40, [['set', 'imageSmoothingEnabled', false], ['img', 'o', 24, 18, 'opaque'], ['call', 'save'], ['call', 'beginPath'], ['call', 'rect', 0, 0, 64, 40],
  ['call', 'rect', 16, 0, 30, 25], ['call', 'clip', 'evenodd'], ['set', 'fillStyle', '#A880FF'], ['call', 'fillRect', 0, 0, 64, 40],
  ['draw', 'o', 10, 10, 40, 30], ['call', 'restore']]);
// 10) La ruleta (arcos rellenos y con contorno de 2 px), como js/ui/windows.js
{
  const C = ['#FFD34E', '#3F2F60', '#45E3DA', '#3DDC84', '#FF4F6D', '#FF8F3F', '#A880FF', '#FFF0A3'];
  for (const angle of [0, 0.4, 2.1]) {
    const ops = [], n = 8, r = 44, cx = 48, cy = 48;
    for (let i = 0; i < n; i++) {
      ops.push(['call', 'beginPath'], ['call', 'moveTo', cx, cy], ['call', 'arc', cx, cy, r, angle + i * Math.PI * 2 / n, angle + (i + 1) * Math.PI * 2 / n],
        ['call', 'closePath'], ['set', 'fillStyle', C[i]], ['call', 'fill'], ['set', 'strokeStyle', '#0E0A1C'], ['set', 'lineWidth', 2], ['call', 'stroke']);
    }
    ops.push(['call', 'beginPath'], ['call', 'arc', cx, cy, 8, 0, Math.PI * 2], ['set', 'fillStyle', '#0E0A1C'], ['call', 'fill']);
    ops.push(['call', 'beginPath'], ['call', 'arc', cx, cy, 5, 0, Math.PI * 2], ['set', 'fillStyle', '#FFD34E'], ['call', 'fill']);
    add(`ruleta-${angle}`, 96, 96, ops);
  }
}
// 11) Texto con transparencia y con 'lighter'
add('texto-alfa', 120, 30, [['put', 'cols', 120, 30, 0, 0], ['set', 'font', '8px SaldoPixel'], ['set', 'fillStyle', '#F8F4FF'],
  ['set', 'globalAlpha', 0.45], ['call', 'fillText', 'Hola $250', 3, 11], ['set', 'globalAlpha', 0.8], ['set', 'font', '16px SaldoPixel'],
  ['call', 'fillText', 'ABC', 50, 26]]);
// 12) clearRect y relleno a medias sobre lo transparente
add('clear', 32, 16, [['put', 'grid', 32, 16, 0, 0], ['call', 'clearRect', 4, 4, 10, 6], ['call', 'clearRect', 20.5, 2.5, 5, 5]]);

// ---------- En Chrome ----------
// Las fórmulas de las imágenes (el C# usa las mismas)
const FORMULAS = `
  const formula = (kind, x, y, w, h) => {
    if (kind === 'grid') return [x, 255 - x, (x * 3) & 255, y];
    if (kind === 'cols') return [x, (x * 7 + y) & 255, (255 - x) ^ 0x5a, 255];
    if (kind === 'acols') return [120, 60, 200, x];
    const r = (x * 37 + y * 11) & 255, g = ((x * 7) ^ (y * 29)) & 255, b = (x * y * 3 + 50) & 255;
    if (kind === 'opaque') return [r, g, b, 255];
    if (kind === 'alpha') return [r, g, b, (x * 13 + y * 7) & 255];
    if (kind === 'sprite') return [r, g, b, (x + y) % 3 === 0 ? 0 : 255];
    throw new Error(kind);
  };`;
const inPage = `(async () => {
  await document.fonts.ready;
  ${FORMULAS}
  const cases = ${JSON.stringify(cases)};
  const b64 = (d) => { let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000)); return btoa(s); };
  const imgData = (g, kind, w, h) => { const im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) im.data.set(formula(kind, x, y, w, h), (y * w + x) * 4); return im; };
  const out = [];
  for (const k of cases) {
    const c = document.createElement('canvas'); c.width = k.w; c.height = k.h;
    const g = c.getContext('2d');
    const imgs = {};
    for (const op of k.ops) {
      const [t, a, ...r] = op;
      if (t === 'set') g[a] = r[0];
      else if (t === 'call') g[a](...r);
      else if (t === 'img') { const ic = document.createElement('canvas'); ic.width = r[0]; ic.height = r[1]; ic.getContext('2d').putImageData(imgData(ic.getContext('2d'), r[2], r[0], r[1]), 0, 0); imgs[a] = ic; }
      else if (t === 'draw') g.drawImage(imgs[a], ...r);
      else if (t === 'put') g.putImageData(imgData(g, a, r[0], r[1]), r[2], r[3]);
      else if (t === 'rows') { const [n, prop, vals, m, ...args] = r; for (let i = 0; i < n; i++) { g[prop] = vals[i]; g[m](...args.map((v) => (v === 'Y' ? a + i : v))); } }
      else throw new Error('op ' + t);
    }
    out.push(b64(g.getImageData(0, 0, k.w, k.h).data));
  }
  return { out, ua: navigator.userAgent };
})()`;

(async () => {
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const b = await launch(url, { width: 800, height: 600, port: 9355 });
  try {
    await b.sleep(1500);
    const r = await b.evaluate(inPage);
    if (b.logs.length) console.log(b.logs.slice(0, 10).join('\n'));
    const saved = cases.map((k, i) => Object.assign({}, k, { rgba: r.out[i] }));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ about: 'Generado por Unity/Tools~/ref-canvas.js en Chrome sin GPU. No editar a mano.', browser: r.ua, cases: saved }) + '\n');
    console.log(`${cases.length} casos -> ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
