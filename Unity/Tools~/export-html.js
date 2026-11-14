// Exporta el <body> de index.html (sin los <script>) a Assets/SaldoNegro/Resources/SaldoNegro/Body.html.
// Es el árbol inicial del DOM del port (Dom.load): no se copia a mano, sale de la web.
// Uso: node Unity/Tools~/export-html.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Body.html');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
if (!m) throw new Error('index.html sin <body>');
const body = m[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n').trim() + '\n';
fs.writeFileSync(OUT, body);
const ids = (body.match(/\bid="[^"]+"/g) || []).length;
console.log(`Body.html: ${body.length} caracteres, ${ids} elementos con id`);
