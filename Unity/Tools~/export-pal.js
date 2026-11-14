// Exporta la paleta SN.PAL de js/core/sn.js a C# (Assets/SaldoNegro/Draw/PAL.cs). La web no se toca.
// Uso: node Unity/Tools~/export-pal.js
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ctx = { location: { search: '' }, console }; ctx.window = ctx; vm.createContext(ctx);
new vm.Script(fs.readFileSync(path.join(ROOT, 'js/core/sn.js'), 'utf8')).runInContext(ctx);
const P = ctx.SN.PAL;
let s = '// SN.PAL (js/core/sn.js): la paleta lo-fi neón. Generado por Unity/Tools~/export-pal.js: no editar a mano.\nnamespace SaldoNegro\n{\n    public static class PAL\n    {\n';
for (const [k, v] of Object.entries(P)) s += `        public const string ${k} = "${v}";\n`;
s += '\n        // Para leer un color por su nombre (P[name] en JS)\n        public static readonly System.Collections.Generic.Dictionary<string, string> byName = new System.Collections.Generic.Dictionary<string, string>\n        {\n';
for (const k of Object.keys(P)) s += `            { "${k}", ${k} },\n`;
s += '        };\n        public static string get(string name) { return byName[name]; }\n    }\n}\n';
fs.writeFileSync(path.join(ROOT, 'Unity/Assets/SaldoNegro/Draw/PAL.cs'), s);
console.log(`${Object.keys(P).length} colores -> Unity/Assets/SaldoNegro/Draw/PAL.cs`);
