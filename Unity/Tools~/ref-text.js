// Referencias de TEXTO: abre la web en Chrome sin ventana (el mismo de tools/test/shot.js), pinta una batería de
// casos con el SN.Px.text del juego (js/render/pixel.js) y guarda los píxeles que salen. La prueba de Unity
// (Assets/SaldoNegro/Tests/EditMode/TextTests.cs) pinta los mismos casos con el port y tienen que salir idénticos.
// La web no se toca: solo se le pide que pinte.
// Uso: node Unity/Tools~/ref-text.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');
const png = require('./lib/png');

const ROOT = path.join(__dirname, '..', '..');
const FONTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Fonts.json'), 'utf8'));
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'TextRefs.json');
const SHOTS = path.join(__dirname, 'out', 'text');

// ---------- Casos ----------
const chars = Object.keys(FONTS.fonts.SaldoPixel.cmap).map((c) => String.fromCodePoint(+c)).filter((c) => c !== ' ');
const lines = [];
for (let i = 0; i < chars.length; i += 26) lines.push(chars.slice(i, i + 26).join(''));
const cases = [];
const add = (name, w, h, bg, draws) => cases.push({ name, w, h, bg, draws });
// 1) Todos los glifos, a los tres tamaños que usa el juego en lienzos (8, 16 y 32)
add('glifos-8', 320, lines.length * 14 + 6, null, lines.map((t, i) => ({ t, x: 3, y: 13 + i * 14, c: '#FFFFFF' })));
add('glifos-16', 640, lines.length * 28 + 12, null, lines.map((t, i) => ({ t, x: 6, y: 26 + i * 28, c: '#FFD34E', size: 16 })));
add('glifos-32', 1280, 3 * 56 + 24, null, lines.slice(0, 3).map((t, i) => ({ t, x: 12, y: 52 + i * 56, c: '#3DDC84', size: 32 })));
// 2) Frases reales con espacios, tildes, cifras y signos (todo sobre fondo transparente: así el alfa de cada
//    píxel es su cobertura y se puede separar el glifo del suavizado de Windows)
const frases = ['¡Hola! Qué bueno tenerte aquí.', 'Junta $250 antes del día 7', 'SUBIRÁ ▲ ganas si sube · BAJARÁ ▼', 'Faltan 3 días para pagar: $1,234', '¿Seguro? Se borra', 'ñandú pingüino JÑÜ ÁÉÍÓÚ áéíóú', 'ЖДФЯИЛБЭЦГЮЩШПЧЫ', '(x2) [×10] 50% +$7 -$77 = ≈ ± …'];
add('frases-8', 240, frases.length * 12 + 6, null, frases.map((t, i) => ({ t, x: 4, y: 12 + i * 12, c: ['#F8F4FF', '#FFD34E', '#45E3DA', '#FF4F6D'][i % 4] })));
// 3) Alineación: izquierda, centro y derecha, con anchos pares e impares y coordenadas con decimales
const al = [];
['A', 'AB', 'ABC', 'i', 'il', 'ill', 'Mi', 'Deuda', '$1,234', '7'].forEach((t, i) => {
  al.push({ t, x: 40, y: 10 + i * 11, c: '#FFFFFF', align: 'left' });
  al.push({ t, x: 120, y: 10 + i * 11, c: '#FFD34E', align: 'center' });
  al.push({ t, x: 200, y: 10 + i * 11, c: '#45E3DA', align: 'right' });
  al.push({ t, x: 240.5, y: 10.5 + i * 11, c: '#FF4F6D', align: 'center' });
  al.push({ t, x: 285.4, y: 9.6 + i * 11, c: '#3DDC84', align: 'center' });
});
add('alineacion-8', 320, 10 * 11 + 6, null, al);
const al16 = [];
['A', 'AB', 'ABC', 'i', 'Mi', '$1,234'].forEach((t, i) => {
  al16.push({ t, x: 60, y: 20 + i * 22, c: '#FFFFFF', align: 'left', size: 16 });
  al16.push({ t, x: 200, y: 20 + i * 22, c: '#FFD34E', align: 'center', size: 16 });
  al16.push({ t, x: 340, y: 20 + i * 22, c: '#45E3DA', align: 'right', size: 16 });
  al16.push({ t, x: 421, y: 21 + i * 22, c: '#FF4F6D', align: 'center', size: 16 });
});
add('alineacion-16', 480, 6 * 22 + 8, null, al16);
// 4) Contorno de Px.text (el texto pintado cinco veces alrededor)
add('contorno', 200, 64, null, [
  { t: '¡BOOM!', x: 100, y: 14, c: '#FFD34E', align: 'center', outline: '#0E0A1C' },
  { t: 'Cobrar +$77', x: 6, y: 30, c: '#F8F4FF', outline: '#231838' },
  { t: '¡CRASH!', x: 100, y: 54, c: '#FF4F6D', align: 'center', outline: '#0E0A1C', size: 16 },
]);
// 5) Números que no son texto (Px.text hace String(x))
add('numeros', 120, 30, null, [{ t: 1234, x: 4, y: 12, c: '#FFFFFF' }, { t: 0.5, x: 60, y: 12, c: '#FFFFFF' }, { t: -7, x: 4, y: 24, c: '#FFD34E' }]);

// Anchos (measureText) de una lista de cadenas
const widths = ['A', 'AB', ' ', 'a b', 'Mi', 'ill', '$1,234', 'Deuda', 'ЖДФ', '▲▼', ...frases];

// ---------- En el navegador ----------
const inPage = `(async () => {
  await document.fonts.ready;
  const cases = ${JSON.stringify(cases)};
  const b64 = (d) => { let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000)); return btoa(s); };
  const out = [];
  for (const k of cases) {
    const c = SN.Px.canvas(k.w, k.h), g = SN.Px.ctx(c);
    if (k.bg) SN.Px.rect(g, 0, 0, k.w, k.h, k.bg);
    for (const d of k.draws) SN.Px.text(g, d.t, d.x, d.y, d.c, { size: d.size, align: d.align, outline: d.outline });
    out.push(b64(g.getImageData(0, 0, k.w, k.h).data));
  }
  const mc = SN.Px.canvas(4, 4), mg = SN.Px.ctx(mc);
  const widths = ${JSON.stringify(widths)}.map((t) => [SN.Px.textWidth(mg, t), SN.Px.textWidth(mg, t, 16)]);
  return { out, widths, ua: navigator.userAgent, dpr: devicePixelRatio };
})()`;

(async () => {
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const b = await launch(url, { width: 1280, height: 720, port: 9347 });
  try {
    await b.sleep(1500);
    const r = await b.evaluate(inPage);
    fs.mkdirSync(SHOTS, { recursive: true });
    let aa = 0;
    const saved = cases.map((k, i) => {
      const data = new Uint8Array(Buffer.from(r.out[i], 'base64'));
      // ¿Hay suavizado? (píxeles a medias entre el fondo y el color del texto)
      const colors = new Set();
      for (let p = 0; p < data.length; p += 4) colors.add((data[p] << 24 | data[p + 1] << 16 | data[p + 2] << 8 | data[p + 3]) >>> 0);
      const allowed = new Set();
      const hex = (c) => ((parseInt(c.slice(1), 16) << 8) | 255) >>> 0;
      allowed.add(k.bg ? hex(k.bg) : 0);
      for (const d of k.draws) { allowed.add(hex(d.c)); if (d.outline) allowed.add(hex(d.outline)); }
      const extra = [...colors].filter((c) => !allowed.has(c));
      if (extra.length) aa++;
      png.write(path.join(SHOTS, `web-${k.name}.png`), { width: k.w, height: k.h, data });
      console.log(`${k.name}: ${k.w}x${k.h}, ${colors.size} colores${extra.length ? `  <-- ${extra.length} colores intermedios (suavizado)` : ''}`);
      // Se guarda solo el alfa (la cobertura): es lo único que comparan las pruebas y ocupa la cuarta parte
      return { name: k.name, w: k.w, h: k.h, draws: k.draws, alpha: Buffer.from(data.filter((_, p) => p % 4 === 3)).toString('base64') };
    });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
      about: 'Generado por Unity/Tools~/ref-text.js: lo que pinta SN.Px.text en Chrome sin GPU. No editar a mano.',
      browser: r.ua, cases: saved, widths: widths.map((t, i) => ({ t, w8: r.widths[i][0], w16: r.widths[i][1] })),
    }) + '\n');
    console.log(`\n${cases.length} casos -> ${path.relative(ROOT, OUT)}  (PNG en ${path.relative(ROOT, SHOTS)})`);
    console.log(`Navegador: ${r.ua}`);
    console.log(aa ? `OJO: ${aa} casos tienen suavizado.` : 'Ningún caso tiene suavizado: todos los píxeles son del color del texto o del fondo.');
    if (b.logs.length) console.log('Consola de la página:\n' + b.logs.join('\n'));
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
