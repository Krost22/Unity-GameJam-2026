// Compara PANTALLAS del juego en Unity con las de Chrome (tools/test/shot.js), píxel a píxel, a 1280x720.
// Para cada pantalla: arranca el modo Play, espera, ejecuta los pasos (C# sobre el DOM del port, el mismo
// equivalente a lo que shot.js hace en la web), captura la vista de juego y la compara con la captura de Chrome
// (out/screens/web-<nombre>.png, que se saca antes con shot.js). Guarda la captura de Unity y las diferencias.
// Uso: node Unity/Tools~/cmp-screen.js [nombre...]
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const png = require('./lib/png');

const PROJECT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'screens');
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pantallas: espera (ms) antes de los pasos, pasos en C# y espera después (como shot.js: 3500 y 1200)
const SCREENS = {
  boot: { wait: 3500, cs: null },
  menu: { wait: 3500, cs: 'SaldoNegro.Dom.querySelector("#boot button").click();' },
  // Ajustes desde el menú (la web abre la ventana con setTimeout: aquí, en el mismo fotograma)
  settings: { wait: 3500, cs: ['SaldoNegro.Dom.querySelector("#boot button").click();', 'SaldoNegro.Dom.querySelector("#btn-menu-settings").click();'] },
};

function unity(args, { allowFail = false } = {}) {
  let out;
  try { out = execFileSync('unity', args, { cwd: PROJECT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); }
  catch (e) { out = e.stdout || ''; if (!allowFail && !out) throw e; }
  if (!out.trim()) return null; // (algunos comandos, como entrar en Play, no contestan nada)
  let j;
  try { j = JSON.parse(out); } catch (_) { if (allowFail) return null; throw new Error('Respuesta de la CLI que no es JSON: ' + out.slice(0, 300)); }
  if (j.success === false && !allowFail) throw new Error((j.errors || []).map((e) => e.message).join('; ').slice(0, 1500));
  return j.data ? (j.data.result !== undefined ? j.data.result : j.data) : j;
}
const cmd = (group, name, ...params) => unity(['command', group, name, '--format', 'json', '--caller', 'plugin', '--skill', 'unity-cli', ...params]);
const evalCs = (code) => cmd('script', 'eval', '--code', code);
const ready = () => unity(['status', '--format', 'json', '--until-ready', '--timeout', '120'], { allowFail: true });

(async () => {
  const want = process.argv.slice(2);
  const names = want.length ? want : Object.keys(SCREENS);
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  cmd('editor', 'set_auto_tick');
  if (String(evalCs('return UnityEditor.EditorApplication.isPlaying;')).toLowerCase() === 'true') { cmd('editor.playmode', 'stop'); await sleep(2500); }
  try {
    for (const name of names) {
      const sc = SCREENS[name];
      if (!sc) { rows.push(`${name}: no existe`); continue; }
      evalCs(`UnityEditor.PlayModeWindow.SetCustomRenderingResolution(${W}u, ${H}u, "SN ${W}x${H}"); return "ok";`);
      cmd('console', 'clear'); // (los errores de cada pantalla, no los de las anteriores)
      cmd('editor.playmode', 'start');
      await sleep(2500);
      ready();
      await sleep(sc.wait);
      // (cs: un paso o una lista; entre pasos se espera como en shot.js)
      for (const step of [].concat(sc.cs || [])) { evalCs(step + ' return "ok";'); await sleep(1200); }
      const file = path.join(OUT, `unity-${name}.png`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      cmd('capture', 'game_view', '--', '--width', String(W), '--height', String(H), '--source', 'screen', '--output-path', file);
      const errs = unity(['command', 'console', 'get', '--format', 'json', '--caller', 'plugin', '--skill', 'unity-cli', '--level', 'error', '--tail', '5'], { allowFail: true });
      cmd('editor.playmode', 'stop');
      await sleep(2000);
      ready();
      const ref = path.join(OUT, `web-${name}.png`);
      if (!fs.existsSync(ref)) { rows.push(`${name}: falta la referencia ${path.relative(PROJECT, ref)}`); continue; }
      const a = png.read(ref), b = png.read(file);
      const d = png.diff(a, b, { image: true });
      if (!d.sameSize) { rows.push(`${name}: TAMAÑO DISTINTO web ${d.a} / unity ${d.b}`); continue; }
      png.write(path.join(OUT, `diff-${name}.png`), d.image);
      const nErr = errs && errs.entries ? errs.entries.length : 0;
      rows.push(`${name}: ${d.different === 0 ? 'IDÉNTICA' : `${d.different} píxeles distintos (${(100 * d.different / d.pixels).toFixed(2)} %), máxima ${d.maxDelta}`}${nErr ? `  [${nErr} errores en consola: ${String(errs.entries[0].message).split('\n')[0].slice(0, 200)}]` : ''}`);
    }
  } finally {
    try { cmd('editor', 'set_auto_tick', '--', '--enabled', 'false'); } catch (_) { /* */ }
  }
  console.log(rows.join('\n'));
  console.log(`\nCapturas y diferencias en ${path.relative(path.join(PROJECT, '..'), OUT)}`);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
