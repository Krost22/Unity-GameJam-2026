// Compara el ESCALADO de Unity con el de la web, píxel a píxel.
// Para cada tamaño de ventana de ref-stage.js: pone la vista de juego a ese tamaño, pinta la carta de ajuste en
// el lienzo de la habitación, captura la pantalla y la compara con la captura de Chrome (out/stage/web-*.png).
// Necesita el editor de Unity abierto con el proyecto (lo maneja con la CLI) y haber pasado antes ref-stage.js.
// Uso: node Unity/Tools~/cmp-stage.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const png = require('./lib/png');

const PROJECT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'stage');
const REFS = JSON.parse(fs.readFileSync(path.join(PROJECT, 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'StageRefs.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// La CLI localiza el editor por la carpeta actual (la del proyecto). Sus propias opciones van ANTES de los
// parámetros del comando del editor: lo que vaya detrás de "--" se le pasa al editor tal cual.
function unity(args, { allowFail = false } = {}) {
  let out;
  try { out = execFileSync('unity', args, { cwd: PROJECT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); }
  catch (e) { out = e.stdout || ''; if (!allowFail && !out) throw e; }
  let j;
  try { j = JSON.parse(out); } catch (_) { if (allowFail) return null; throw new Error('Respuesta de la CLI que no es JSON: ' + out.slice(0, 300)); }
  if (!j.success && !allowFail) throw new Error((j.errors || []).map((e) => e.message).join('; ').slice(0, 1500));
  return j.data && (j.data.result !== undefined ? j.data.result : j.data);
}
const cmd = (group, name, ...params) => unity(['command', group, name, '--format', 'json', '--caller', 'plugin', '--skill', 'unity-cli', ...params]);
const evalCs = (code) => cmd('script', 'eval', '--code', code);
const ready = () => unity(['status', '--format', 'json', '--until-ready', '--timeout', '120'], { allowFail: true });

(async () => {
  const playing = evalCs('return UnityEditor.EditorApplication.isPlayingOrWillChangePlaymode;');
  if (String(playing).toLowerCase() === 'true') {
    console.log('El editor ya está en modo Play: no lo toco. Sal del modo Play y vuelve a lanzar esto.');
    process.exit(2);
  }
  cmd('editor', 'set_auto_tick');
  cmd('editor.playmode', 'start');
  await sleep(4000);
  ready();
  // ¿Corren los fotogramas?
  const f0 = +evalCs('return UnityEngine.Time.frameCount;');
  await sleep(1500);
  const f1 = +evalCs('return UnityEngine.Time.frameCount;');
  if (!(f1 > f0)) throw new Error(`El modo Play no avanza (fotograma ${f0} -> ${f1})`);

  const rows = [];
  let worst = 0;
  try {
    for (const s of REFS.sizes) {
      const name = `${s.w}x${s.h}`;
      evalCs(`UnityEditor.PlayModeWindow.SetCustomRenderingResolution(${s.w}u, ${s.h}u, "SN ${name}"); return "ok";`);
      await sleep(900);
      let info = evalCs(`var st = SaldoNegro.SaldoNegroApp.instance.stage; st.showTestPattern(); return UnityEngine.Screen.width + "x" + UnityEngine.Screen.height + " base=" + st.@base + " modo=" + st.mode + " tx=" + st.tx + " ty=" + st.ty + " z=" + st.z;`);
      await sleep(700);
      const file = path.join(OUT, `unity-${name}.png`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      cmd('capture', 'game_view', '--', '--width', String(s.w), '--height', String(s.h), '--source', 'screen', '--output-path', file);
      const a = png.read(path.join(OUT, `web-${name}.png`)), b = png.read(file);
      const d = png.diff(a, b, { image: true });
      if (!d.sameSize) { rows.push(`${name}: TAMAÑO DISTINTO web ${d.a} / unity ${d.b}  [${info}]`); worst = 255; continue; }
      png.write(path.join(OUT, `diff-${name}.png`), d.image);
      worst = Math.max(worst, d.maxDelta);
      const pct = (100 * d.different / d.pixels).toFixed(3);
      // ¿Cuántas diferencias caen DENTRO del escenario? (fuera solo está el degradado de fondo)
      let inside = 0;
      const sx0 = Math.max(0, s.tx), sy0 = Math.max(0, s.ty), sx1 = Math.min(s.w, Math.floor(s.tx + 640 * s.z)), sy1 = Math.min(s.h, Math.floor(s.ty + 360 * s.z));
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
        const o = (y * s.w + x) * 4;
        if (a.data[o] !== b.data[o] || a.data[o + 1] !== b.data[o + 1] || a.data[o + 2] !== b.data[o + 2]) inside++;
      }
      info = `dentro del escenario: ${inside}`;
      // Resumen por tamaño de la diferencia (en niveles de 0 a 255 del canal que más cambia)
      const buckets = { '1': 0, '2': 0, '3-8': 0, '9-32': 0, 'más de 32': 0 };
      for (const [k, v] of Object.entries(d.histogram)) { const n = +k; buckets[n === 1 ? '1' : n === 2 ? '2' : n <= 8 ? '3-8' : n <= 32 ? '9-32' : 'más de 32'] += v; }
      const parts = Object.entries(buckets).filter(([, v]) => v).map(([k, v]) => `${v} de ${k}`).join(', ');
      rows.push(`${name} (${s.mode}, x${s.z.toFixed(4)}): ${d.different === 0 ? 'IDÉNTICA' : `${d.different} píxeles distintos (${pct} %), máxima ${d.maxDelta} [${parts}]${d.first ? `, p. ej. (${d.first.x},${d.first.y}) web ${d.first.a.slice(0, 3)} unity ${d.first.b.slice(0, 3)}` : ''}`}  [${info}]`);
    }
  } finally {
    cmd('editor.playmode', 'stop');
    await sleep(2500);
    ready();
    try { cmd('editor', 'set_auto_tick', '--', '--enabled', 'false'); } catch (_) { /* */ }
  }
  console.log(rows.join('\n'));
  console.log(`\nCapturas y diferencias en ${path.relative(path.join(PROJECT, '..'), OUT)}`);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
