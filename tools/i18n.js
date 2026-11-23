// Textos por traducir. Reúne los textos del juego (los datos de js/data, las llamadas SN.T('...') / T('...') del
// código y los textos fijos de index.html) y, para cada idioma de js/core/i18n.js, dice cuáles faltan.
// También comprueba que las traducciones conserven sus {variables} y que los textos del idioma secreto
// solo usen sus 16 letras (si no, no se podrían leer al encontrar todas las pistas) y que no usen letras que la fuente
// pixel no tenga dibujadas (tools/build-font.js).
// Uso: node tools/i18n.js                 resumen por idioma
//      node tools/i18n.js missing en      los textos que faltan en inglés (como diccionario para rellenar)
//      node tools/i18n.js keys            todas las claves
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

// --- Los datos, cargados como en el juego pero sin traducir (idioma base) ---
function loadData() {
  const store = {};
  const ctx = { console, Math, JSON, Date, location: { search: '' }, localStorage: { getItem: () => null, setItem: (k, v) => { store[k] = v; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of scripts.filter((s) => /^js\/(core\/(sn|events|i18n)\.js|data\/|i18n\/)/.test(s) && !/apply\.js$/.test(s))) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.SN;
}
const SN = loadData();
const I = SN.I18n;
const SKIP = new Set(['id', 'kind', 'art', 'icon', 'sprite', 'tone', 'market', 'ev', 'color', 'colors', 'cls', 'mood',
  'who', 'type', 'key', 'sel', 'letter', 'file', 'src', 'track', 'branch', 'flag', 'when', 'orWhen', 'unlockBy', 'item', 'target', 'wait', 'spot', 'spots', 'open', 'skipIf']);

// Un texto de los datos es para leer si tiene espacios, mayúsculas o signos (los nombres internos van en minúsculas)
const readable = (s) => !/^[#>!][a-z]/.test(s) && /[\sA-ZÁÉÍÓÚÑ¿¡!?.,:;$%«»"…]/.test(s) || /[áéíóúñ]/.test(s);
const keys = new Map(); // clave -> dónde sale
const add = (k, where) => { if (k && !keys.has(k)) keys.set(k, where); };
(function walk(o, p) {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') { if (!SKIP.has(k) && readable(v) && !/^#[0-9a-f]{3,8}$/i.test(v) && !/\.(mp3|ogg|wav|png)$/.test(v)) add(v, `${p}.${k}`); } else if (v && typeof v === 'object' && !SKIP.has(k)) walk(v, `${p}.${k}`);
  }
})(SN.Data, 'Data');

// --- El código: SN.T('...') y T('...') con un texto literal ---
const code = scripts.filter((s) => !/^js\/i18n\//.test(s) && !/core\/i18n\.js$/.test(s));
const lit = /(?:\bSN\.T|\bT)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.)*`)/g;
for (const f of code) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(lit)) {
    // eslint-disable-next-line no-eval
    const k = vm.runInNewContext(m[1]);
    add(k, f + ':' + src.slice(0, m.index).split('\n').length);
  }
}
// --- index.html: el texto de cada etiqueta y los title / aria-label ---
const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<head>[\s\S]*?<\/head>/, '');
for (const m of body.matchAll(/>([^<>]+)</g)) { const t = m[1].trim(); if (t && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) add(t.replace(/\s+/g, ' '), 'index.html'); }
for (const m of body.matchAll(/(?:title|aria-label)="([^"]+)"/g)) add(m[1], 'index.html');

// --- Comprobaciones ---
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const C = SN.Data.cipher;
const glyphs = require('./build-font').charset();
const allowed = new Set(Object.keys(C.alphabet));
const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const cipherTexts = [...C.messages.map((m) => m.text).filter(Boolean), ...C.news.map((n) => n.text), ...Object.values(C.hidden), C.contact.name];

const mode = process.argv[2] || 'summary', only = process.argv[3];
if (mode === 'keys') { for (const [k, w] of keys) console.log(JSON.stringify(k), '//', w); process.exit(0); }
let bad = 0;
for (const L of I.LANGS) {
  if (L.id === I.BASE || (only && L.id !== only)) continue;
  const d = I.dict(L.id);
  const missing = [...keys.keys()].filter((k) => d[k] == null);
  const wrongVars = [...keys.keys()].filter((k) => d[k] != null && (vars(d[k]) !== vars(k) || (k[0] === '*') !== (String(d[k])[0] === '*')));
  // (cualquier letra: también Ł, Ø, Œ... que no se descomponen en letra + tilde)
  const badCipher = cipherTexts.filter((t) => d[t] != null && [...norm(d[t])].some((ch) => /\p{L}/u.test(ch) && !allowed.has(ch)));
  // Caracteres que la fuente pixel (tools/build-font.js) no tiene y el original tampoco usa: saldrían en otra fuente
  const noGlyph = [];
  for (const k of keys.keys()) {
    if (d[k] == null) continue;
    // (el guion blando U+00AD no se dibuja: solo deja partir una palabra larga, con guion, si no cabe)
    const miss = [...new Set([...String(d[k])].filter((ch) => !/\s/.test(ch) && ch !== '­' && !glyphs.has(ch) && !k.includes(ch)))];
    if (miss.length) noGlyph.push([k, miss]);
  }
  const unused = Object.keys(d).filter((k) => !keys.has(k));
  if (mode === 'missing') {
    console.log(`// ${missing.length} textos sin traducir (${L.name})`);
    for (const k of missing) console.log(`  ${JSON.stringify(k)}: '', // ${keys.get(k)}`);
    continue;
  }
  console.log(`${L.name} (${L.id}): ${keys.size - missing.length}/${keys.size} traducidos · faltan ${missing.length} · sin usar ${unused.length}`);
  for (const k of wrongVars) { bad++; console.log(`  VARIABLES distintas: ${JSON.stringify(k)} -> ${JSON.stringify(d[k])}`); }
  for (const t of badCipher) { bad++; console.log(`  IDIOMA SECRETO con letras sin pista: ${JSON.stringify(d[t])} (letras: ${[...allowed].join('')})`); }
  for (const [k, miss] of noGlyph) { bad++; console.log(`  SIN GLIFO en la fuente (${miss.join(' ')}): ${JSON.stringify(d[k])}`); }
  if (mode === 'unused') for (const k of unused) console.log(`  sin usar: ${JSON.stringify(k)}`);
}
process.exit(bad ? 1 : 0);
