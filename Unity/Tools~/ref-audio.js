// Referencia de AUDIO: los efectos de js/systems/audio.js renderizados por Chrome (OfflineAudioContext a 48 kHz).
// Para cada caso (efecto, opciones, tonalidad) se guardan dos renders:
//   · dry:  la mezcla de voces ANTES de master (0.7) y del compresor. Para sacarla se parchea SOLO la última
//           conexión de audio.js (master -> compresor -> destino) para que sfxGain vaya directo al destino.
//   · full: el camino real: sfxGain -> master (0.7) -> DynamicsCompressor (valores por defecto) -> destino.
// El Math.random de la página es el mulberry32 del juego con semilla 12345, reiniciado antes de cada render
// (y audio.js se vuelve a evaluar en cada caso: el búfer de ruido de 2 s se crea de nuevo, como en una partida nueva).
// La longitud de cada render es la del último stop() programado (no se guardan colas de silencio).
// Las muestras se guardan en int16 (x32767) en base64 para que el JSON pese poco: el error de cuantización es
// <= 1.6e-5, bajo el umbral de las pruebas (1e-4).
// Uso: node Unity/Tools~/ref-audio.js   (escribe Assets/SaldoNegro/Tests/EditMode/Refs/AudioRefs.json)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'AudioRefs.json');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'systems', 'audio.js'), 'utf8');

// Casos: [efecto, opciones, tonalidad ('def' = DEFAULT_KEY; 'alt' = Do mayor modal, rate 0.9)]
const NAMES = ['click', 'key', 'select', 'error', 'buy', 'sell', 'candle', 'heart', 'riser', 'boom', 'crash', 'cash', 'tick', 'coin',
  'coinBounce', 'win', 'coinAt', 'loss', 'liquidation', 'unlock', 'cipher', 'lucky', 'wheel', 'pay', 'debtPaid', 'broke', 'notify',
  'notifyBad', 'static', 'whisper', 'type', 'crack', 'shatter', 'pop', 'siren', 'day', 'open', 'close', 'boot', 'whoosh', 'knock',
  'punch', 'collapse', 'powerOff', 'thud', 'step', 'drop', 'drag', 'dtmf', 'ringback', 'holdMusic', 'scribble', 'printer',
  'bigButton', 'hangup', 'cheer'].filter((n) => n !== 'coinAt');
const CASES = [];
for (const n of NAMES) CASES.push([n, {}, 'def']);
const VARIANTS = [
  ['candle', { up: false }], ['candle', { quiet: true }], ['candle', { step: -4 }], ['candle', { step: 7, quiet: true }],
  ['riser', { dur: 1 }], ['boom', { big: false }], ['crash', { big: false }], ['win', { big: true }], ['loss', { big: true }],
  ['broke', { at: 0.2 }], ['type', { voice: 'bravo' }], ['type', { voice: 'trompa' }], ['type', { voice: 'robot' }],
  ['type', { voice: 'hood' }], ['type', { voice: 'otro' }], ['crack', { n: 2 }], ['dtmf', { d: 5 }], ['dtmf', { d: 0 }],
  ['dtmf', { d: 12 }], ['printer', { dur: 0.6 }], ['static', { dur: 0.2 }],
];
for (const [n, o] of VARIANTS) CASES.push([n, o, 'def']);
// Tonalidad alternativa (y su velocidad de cinta) en un subconjunto
for (const n of ['select', 'error', 'buy', 'candle', 'boom', 'cash', 'whisper', 'debtPaid', 'broke', 'cipher', 'cheer', 'type'])
  CASES.push([n, {}, 'alt']);

// Lo que corre en la página (se serializa con toString): una función async autocontenida.
async function pageMain(src, cases) {
  const FS = 48000, SEED = 12345, SCALE = 32767;
  const KEYS = {
    def: { root: 62, scale: [0, 3, 5, 7, 10], rate: 1 },
    alt: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], rate: 0.9 },
  };
  // Parche mínimo y documentado: los try/catch de audio.js (sfx) guardan el error para verlo.
  const patched = src
    .split('catch (_) { /* sin audio */ }').join('catch (_e) { window.__err = String(_e); }')
    .replace('master.connect(comp).connect(ac.destination);',
      'if (window.__DRY) sfxGain.connect(ac.destination); else master.connect(comp).connect(ac.destination);');
  if (patched === src) throw new Error('no se encontró la conexión final');
  const stops = [];
  for (const C of [OscillatorNode, AudioBufferSourceNode]) {
    const orig = C.prototype.stop;
    C.prototype.stop = function (w) { stops.push(w); return orig.apply(this, arguments); };
  }
  const seeded = () => {
    let s = SEED;
    return function () {
      s = (s + 0x6D2B79F5) | 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function build(name, opts, key, dry, len) {
    Math.random = seeded();
    window.__DRY = dry; window.__err = null; stops.length = 0;
    window.SN = { Music: key ? { tonality: () => key } : null };
    const ctx = new OfflineAudioContext(1, len, FS);
    Object.defineProperty(ctx, 'state', { get: () => 'running' });
    window.AudioContext = function () { return ctx; };
    (0, eval)(patched);
    window.SN.Audio.sfx(name, opts);
    return ctx;
  }
  const toB64 = (f32) => {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * SCALE)));
    const bytes = new Uint8Array(i16.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const out = [];
  for (const [name, opts, kn] of cases) {
    const key = KEYS[kn];
    // Pasada 1: longitud (el último stop) sin renderizar
    build(name, opts, key, false, FS * 8);
    const len = Math.ceil(Math.max(0, ...stops) * FS) + 64;
    const rec = { name, opts, key, n: len, err: null };
    for (const dry of [true, false]) {
      const ctx = build(name, opts, key, dry, len);
      if (window.__err) rec.err = window.__err;
      const buf = await ctx.startRendering();
      rec[dry ? 'dry' : 'full'] = toB64(buf.getChannelData(0));
    }
    out.push(rec);
  }
  return JSON.stringify({ sampleRate: FS, scale: SCALE, seed: SEED, cases: out });
}

(async () => {
  const b = await launch('about:blank', { width: 400, height: 300, port: 9359 });
  try {
    const json = await b.evaluate(`(${pageMain.toString()})(${JSON.stringify(SRC)}, ${JSON.stringify(CASES)})`);
    const data = JSON.parse(json);
    const errs = data.cases.filter((c) => c.err);
    for (const c of errs) console.log('ERROR en ' + c.name + ': ' + c.err);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(data));
    console.log(`${data.cases.length} casos escritos en ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
  } finally {
    b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
