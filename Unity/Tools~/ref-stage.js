// Referencias del ESCALADO: abre la web en Chrome sin ventana a varios tamaños de ventana, pone una carta de
// ajuste en el lienzo de la habitación (#desk), esconde todo lo demás y captura la pantalla. También apunta el
// encuadre que calcula el juego (SN.Game: base, modo, tx, ty, z).
// Unity pinta la misma carta de ajuste (Stage.testPattern) con su escenario: las capturas tienen que coincidir.
// La web no se toca: en la página abierta se sustituye el pintado de la habitación por la carta, nada más.
// Uso: node Unity/Tools~/ref-stage.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out', 'stage');
const REFS = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'StageRefs.json');
// 16:9 con escala entera (2x, 3x) y con decimales; ventanas que no son 16:9 (se ve el fondo); y ventanas
// pequeñas, donde la cámara se acerca al monitor (modo 'monitor')
const SIZES = [[1280, 720], [1920, 1080], [1366, 768], [1600, 900], [1280, 800], [1024, 768], [960, 540], [800, 450], [640, 360], [2560, 1080]];

const prepare = `(() => {
  // La misma carta de ajuste que Stage.testPattern (C#)
  SN.Desk.render = function () {};
  const c = document.getElementById('desk'), g = c.getContext('2d'), w = c.width, h = c.height;
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = (x * 7 + y * 13) & 255, gg = ((x ^ y) * 3) & 255, b = (x * y) & 255;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) r = gg = b = 255;
    else if (x >= 8 && x < 72 && y >= 8 && y < 40) r = gg = b = ((x + y) & 1) * 255;
    else if (x === y || x === w - 1 - y) { r = 255; gg = 211; b = 78; }
    const o = (y * w + x) * 4;
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (const id of ['monitor', 'cine', 'fade', 'stage-top', 'subs', 'btn-skip', 'rotate', 'debug-panel', 'hero-say']) {
    const e = document.getElementById(id);
    if (e) e.style.setProperty('display', 'none', 'important');
  }
  return true;
})()`;
const readCam = `(() => { const G = SN.Game; return { base: G.base, mode: G.mode, vw: G.vw, vh: G.vh, tx: G.tx, ty: G.ty, z: G.z, transform: document.getElementById('stage').style.transform }; })()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const b = await launch(url, { width: 1280, height: 720, port: 9348 });
  const refs = [];
  try {
    await b.sleep(2000);
    await b.evaluate(prepare);
    for (const [w, h] of SIZES) {
      await b.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await b.sleep(500);
      await b.evaluate(prepare); // (por si el cambio de tamaño ha vuelto a enseñar algo)
      await b.sleep(250);
      const cam = await b.evaluate(readCam);
      await b.screenshot(path.join(OUT, `web-${w}x${h}.png`));
      refs.push({ w, h, base: cam.base, mode: cam.mode, tx: cam.tx, ty: cam.ty, z: cam.z });
      console.log(`${w}x${h}: base ${cam.base.toFixed(4)} modo ${cam.mode} -> ${cam.transform}`);
    }
    fs.mkdirSync(path.dirname(REFS), { recursive: true });
    fs.writeFileSync(REFS, JSON.stringify({ about: 'Generado por Unity/Tools~/ref-stage.js: el encuadre que calcula la web (SN.Game) para cada tamaño de ventana. No editar a mano.', sizes: refs }) + '\n');
    console.log(`\n${refs.length} tamaños -> ${path.relative(ROOT, REFS)}  (capturas en ${path.relative(ROOT, OUT)})`);
    if (b.logs.length) console.log('Consola de la página:\n' + b.logs.join('\n'));
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
