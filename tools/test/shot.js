// Abre el juego en Chrome sin ventana, ejecuta pasos opcionales y guarda capturas.
// Uso: node tools/test/shot.js <salida.png> [ancho] [alto] [js a ejecutar antes de la captura] [espera ms]
'use strict';
const path = require('path');
const { launch } = require('./cdp');

(async () => {
  const [out, w = 1280, h = 720, js = '', waitMs = 2500] = process.argv.slice(2);
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/') + '?debug';
  const b = await launch(url, { width: +w, height: +h });
  await b.sleep(+waitMs);
  if (js) {
    try { console.log('js ->', JSON.stringify(await b.evaluate(js))); } catch (e) { console.log('js error:', e.message); }
    await b.sleep(1200);
  }
  await b.screenshot(out);
  console.log(b.logs.join('\n') || '(sin errores en consola)');
  b.close();
})();
