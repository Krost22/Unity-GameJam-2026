// Exporta los sprites en texto de js/render/sprites.js (SN.Sprites.DEFS) a JSON para Unity
// (Assets/SaldoNegro/Resources/SaldoNegro/Sprites.json). No se copian a mano: se carga el archivo de la web.
// Uso: node Unity/Tools~/export-sprites.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Sprites.json');
const ctx = { console, Math, JSON, location: { search: '' } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/core/sn.js', 'js/render/pixel.js', 'js/render/sprites.js']) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }).runInContext(ctx);
const D = ctx.SN.Sprites.DEFS;
fs.writeFileSync(OUT, JSON.stringify(D) + '\n');
console.log(`${Object.keys(D).length} sprites -> ${path.relative(ROOT, OUT)}`);
