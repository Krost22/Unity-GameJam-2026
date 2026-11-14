// Exporta los datos del juego (SN.Data, js/data/*.js) a JSON para Unity. No se copian a mano: se cargan los
// mismos archivos de la web en una VM de Node (como tools/test/logic.test.js) y se escribe lo que queda en SN.Data.
// Las funciones que hay entre los datos (buscadores como marketById o los textos "effect" de las mejoras) no
// pasan al JSON: están portadas a mano en C# (Assets/SaldoNegro/Logic/Data.cs) y aquí solo se listan para
// comprobar que no aparece ninguna nueva.
// Uso: node Unity/Tools~/export-data.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Data.json');
const FILES = [
  'js/core/sn.js', 'js/core/events.js',
  'js/data/markets.js', 'js/data/events.js', 'js/data/simulation.js', 'js/data/progression.js', 'js/data/luck.js',
  'js/data/cipher.js', 'js/data/academy.js', 'js/data/story.js', 'js/data/chat.js', 'js/data/music.js', 'js/data/finale.js',
];
// Funciones que se esperan (portadas en C#). Si la web añade otra, este script se queja.
const KNOWN = new Set([
  'keyItemById', 'payBonusFor', 'stepById', 'marketById', 'marketLabel',
  'upgrades.0.effect', 'upgrades.1.effect', 'upgrades.2.effect', 'upgrades.3.effect', 'upgrades.4.effect',
]);

const ctx = { console, Math, JSON, Date, location: { search: '' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of FILES) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }).runInContext(ctx);
const D = ctx.SN.Data;

// Recorre los datos: funciones, valores que JSON no guarda igual (NaN, Infinity, undefined) y objetos compartidos
const fns = [], bad = [], seen = new Map(), shared = [];
(function walk(v, p) {
  if (typeof v === 'function') { fns.push(p); return; }
  if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${p} = ${v}`);
  if (v === undefined) bad.push(`${p} = undefined`);
  if (v && typeof v === 'object') {
    if (seen.has(v)) { shared.push(`${p} = ${seen.get(v)}`); return; }
    seen.set(v, p);
    for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
  }
})(D, '');

const unknown = fns.filter((f) => !KNOWN.has(f));
if (bad.length) { console.error('Valores que JSON no conserva:\n  ' + bad.join('\n  ')); process.exit(1); }
if (unknown.length) { console.error('Funciones nuevas en los datos (pórtalas en Data.cs y añádelas a KNOWN):\n  ' + unknown.join('\n  ')); process.exit(1); }

const json = JSON.stringify(D);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json + '\n');
console.log(`SN.Data -> ${path.relative(ROOT, OUT)} (${(json.length / 1024).toFixed(0)} KB, ${Object.keys(D).length} claves de primer nivel)`);
console.log(`Funciones portadas a mano: ${fns.join(', ')}`);
if (shared.length) console.log(`Objetos compartidos (en JSON quedan copiados; solo se leen):\n  ${shared.join('\n  ')}`);
