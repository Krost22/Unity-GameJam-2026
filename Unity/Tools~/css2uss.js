// css/style.css de la web -> USS de UI Toolkit (Assets/SaldoNegro/UI/Game.uss) y animaciones a JSON
// (Assets/SaldoNegro/Resources/SaldoNegro/Keyframes.json). No se reescribe a mano: se convierte regla a regla.
// Lo que USS hace igual pasa tal cual (colores, medidas, flex, posiciones, bordes, opacidad, transformaciones,
// variables). Lo que USS no tiene pasa como PROPIEDAD PROPIA (--sn-...) que lee el código C# de la interfaz:
//   box-shadow, text-shadow, line-height, gap, z-index, animation, background con degradados, filter, clip-path,
//   grid-*, text-transform, pointer-events, white-space, letter-spacing (texto pixel: lo pinta PxText)...
// Selectores: las etiquetas HTML pasan a clases (.t-button); :not(:disabled) -> :enabled; ::before/::after ->
// hijos generados (.sn-before / .sn-after); :first-child -> clase .sn-first que pone el C#. Lo que no tiene
// equivalente se lista en el informe y la regla se marca para el C# (Rules.json).
// Uso: node Unity/Tools~/css2uss.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'css', 'style.css');
const OUT_USS = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Game.uss');
const OUT_KF = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'Keyframes.json');
const OUT_RULES = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Resources', 'SaldoNegro', 'CssRules.json');

let css = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- Bloques (con llaves anidadas) ----------
function blocks(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    out.push({ head, body: text.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
function decls(body) {
  const out = [];
  // separa por ; fuera de paréntesis
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && !depth) { push(cur); cur = ''; } else cur += ch;
  }
  push(cur);
  function push(d) { const k = d.indexOf(':'); if (k < 0) return; const p = d.slice(0, k).trim(), v = d.slice(k + 1).trim(); if (p) out.push([p, v.replace(/\s*!important$/, ''), /!important$/.test(v)]); }
  return out;
}
function splitTop(s, sep) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === sep && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------- Selectores ----------
const TAGS = new Set(['html', 'body', 'div', 'span', 'button', 'canvas', 'section', 'header', 'aside', 'main', 'p', 'b', 'i', 'kbd', 'small', 'img', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'em', 'strong', 'input', 'label', 'br', 'hr', 'svg', 'table', 'tr', 'td', 'th']);
const report = { selectors: {}, props: {} };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
function convSelector(sel) {
  let s = sel;
  const notes = [];
  s = s.replace(/::?(before|after)\b/g, (_, w) => ' > .sn-' + w);
  s = s.replace(/:not\(:disabled\)/g, ':enabled');
  s = s.replace(/:focus-visible/g, ':focus');
  s = s.replace(/:first-child/g, '.sn-first');
  s = s.replace(/::-webkit-scrollbar(-thumb|-track)?/g, (m) => { notes.push('scrollbar'); return '.sn-scrollbar' + (m.endsWith('thumb') ? '-thumb' : m.endsWith('track') ? '-track' : ''); });
  s = s.replace(/:root/g, ':root');
  // etiquetas -> .t-tag (al principio de un compuesto: tras espacio, >, o al inicio)
  s = s.replace(/(^|[\s>+~(])([a-z][a-z0-9]*)(?=[.#:\[\s>+~)]|$)/g, (m, pre, tag) => (TAGS.has(tag) ? pre + (tag === 'html' || tag === 'body' ? ':root' : '.t-' + tag) : m));
  const bad = [];
  if (/:not\(/.test(s)) bad.push(':not()');
  if (/\[[^\]]*\]/.test(s)) bad.push('[atributo]');
  if (/[+~]/.test(s.replace(/\([^)]*\)/g, ''))) bad.push('hermano (+/~)');
  if (/:nth-|:last-child|:only-child|:empty|:checked/.test(s)) bad.push(s.match(/:(nth-[a-z-]+|last-child|only-child|empty|checked)/)[0]);
  for (const b of bad) bump(report.selectors, b);
  return { uss: s, bad };
}

// ---------- Propiedades ----------
const SAME = new Set(['color', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'position', 'top', 'left', 'right', 'bottom', 'flex-direction', 'flex-wrap', 'flex-grow',
  'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'align-content', 'justify-content', 'opacity', 'visibility', 'overflow', 'border-radius', 'border-width',
  'border-color', 'border-top-width', 'border-left-width', 'border-right-width', 'border-bottom-width', 'border-top-color', 'border-left-color', 'border-right-color',
  'border-bottom-color', 'transform-origin', 'rotate', 'scale', 'translate', 'letter-spacing', 'background-color', 'cursor', 'text-overflow', 'transition',
  'transition-property', 'transition-duration', 'transition-delay', 'transition-timing-function']);
const CUSTOM = new Set(['box-shadow', 'text-shadow', 'line-height', 'gap', 'z-index', 'animation', 'animation-delay', 'animation-name', 'animation-duration', 'filter',
  'clip-path', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'text-transform', 'pointer-events', 'white-space', 'font-size', 'font-weight',
  'font-style', 'font-family', 'font', 'text-align', 'vertical-align', 'image-rendering', 'content', 'outline', 'outline-offset', 'text-decoration', 'overflow-y', 'overflow-x',
  'background-size', 'background-position', 'background-image', 'background-clip', '-webkit-background-clip', '-webkit-text-fill-color', 'order', 'word-break',
  'overflow-wrap', 'list-style', 'user-select', '-webkit-user-select', 'touch-action', 'overscroll-behavior', 'box-sizing', 'font-synthesis', '-webkit-font-smoothing',
  'scrollbar-width', 'scrollbar-color', 'display', 'inset', 'flex', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'background', 'transform']);
const NAMED = { transparent: 'rgba(0, 0, 0, 0)', white: 'rgb(255, 255, 255)', black: 'rgb(0, 0, 0)' };
function value(v) { return v.replace(/\b(transparent|white|black)\b/g, (m) => NAMED[m]); }
function convDecl(p, v) {
  const out = [];
  const cust = (name, val) => out.push([`--sn-${name}`, `"${val.replace(/\s+/g, ' ').replace(/"/g, "'")}"`]);
  if (p.startsWith('--')) { out.push([p, value(v)]); return out; }
  // Lo que USS escribe igual
  // Valores que USS no admite: los resuelve el C#
  if (p === 'cursor' || /\binherit\b|\binitial\b|\bunset\b/.test(v) || (p.startsWith('transition') && /steps\(/.test(v))) { cust(p, v); return out; }
  if ((p === 'align-items' || p === 'align-self') && /baseline/.test(v)) { cust(p, v); return out; }
  if ((p === 'align-items' || p === 'align-self' || p === 'justify-content') && (v === 'start' || v === 'end')) { out.push([p, v === 'start' ? 'flex-start' : 'flex-end']); return out; }
  if (p.startsWith('transition') && /cubic-bezier\(/.test(v)) { cust(p, v); return out; }
  // transition de transform: USS no anima "transform" (solo translate/rotate/scale); lo hace el C# (CssAnimator).
  // La de filter, también: el filter lo pone el C# (CssFilter) a partir de --sn-filter
  if (p === 'transition' && /\b(transform|filter)\b/.test(v)) { cust(p, v); return out; }
  if (p === 'background' && v === 'none') { out.push(['background-color', 'rgba(0, 0, 0, 0)']); out.push(['background-image', 'none']); return out; }
  if (p === 'position' && v === 'static') { out.push(['position', 'relative']); cust(p, v); return out; }
  if (SAME.has(p)) {
    if (p === 'overflow' && v === 'auto') { out.push(['overflow', 'hidden']); cust('overflow', v); return out; }
    if (p === 'position' && (v === 'fixed' || v === 'sticky')) { out.push(['position', 'absolute']); cust('position', v); return out; }
    if (p === 'transform-origin') { out.push([p, v.replace(/\bcenter\b/g, '50%')]); return out; }
    if (/calc\(|vw|vh|em\b|min\(|max\(|clamp\(/.test(v)) { cust(p, v); return out; }
    out.push([p, value(v)]); return out;
  }
  // display: none / flex directo; block, inline... los resuelve el C# (--sn-display)
  if (p === 'display') {
    out.push(['display', v === 'none' ? 'none' : 'flex']);
    if (v !== 'none') cust('display', v);
    // En CSS, flex va en fila y bloque en columna (en UI Toolkit todo empieza en columna)
    if (v === 'block' || v === 'grid' || v === 'list-item') out.push(['flex-direction', 'column']);
    return out;
  }
  if (p === 'inset') { const parts = v.split(/\s+/); const [t, r = t, b = t, l = r] = parts; out.push(['top', t], ['right', r], ['bottom', b], ['left', l]); return out; }
  if (p === 'flex') {
    const parts = v.split(/\s+/);
    if (parts.length === 1 && /^\d+(\.\d+)?$/.test(parts[0])) { out.push(['flex-grow', parts[0]], ['flex-shrink', '1'], ['flex-basis', '0%']); return out; }
    if (v === 'none') { out.push(['flex-grow', '0'], ['flex-shrink', '0'], ['flex-basis', 'auto']); return out; }
    if (v === 'auto') { out.push(['flex-grow', '1'], ['flex-shrink', '1'], ['flex-basis', 'auto']); return out; }
    if (parts.length >= 2) { out.push(['flex-grow', parts[0]], ['flex-shrink', parts[1]]); if (parts[2]) out.push(['flex-basis', parts[2]]); return out; }
  }
  if (p === 'border' || /^border-(top|bottom|left|right)$/.test(p)) {
    const side = p === 'border' ? '' : p.slice(7);
    const m = v.match(/^(\d+(?:\.\d+)?px)\s+(solid|dashed|dotted)\s+(.+)$/);
    if (m) { out.push([`border${side ? '-' + side : ''}-width`, m[1]], [`border${side ? '-' + side : ''}-color`, value(m[3])]); if (m[2] !== 'solid') cust(p, v); return out; }
    if (v === 'none' || v === '0') { out.push([`border${side ? '-' + side : ''}-width`, '0']); return out; }
  }
  if (p === 'background') {
    if (/gradient|url\(/.test(v)) { cust('background', v); return out; }
    out.push(['background-color', value(v)]); return out;
  }
  if (p === 'transform') { cust('transform', v); return out; }
  if (p === 'box-shadow' && !/\b(inherit|initial|unset)\b/.test(v)) { cust(p, v); return out.concat(shadowDecls(v)); }
  if (p === 'font-size') { out.push(['font-size', v]); return out; }
  if (CUSTOM.has(p)) { cust(p, v); return out; }
  bump(report.props, p);
  cust(p, v);
  return out;
}

// box-shadow: cada sombra va en propiedades propias que USS resuelve (el color puede ser var(--ol), que USS
// sí sabe leer por clase): --sn-bs-N = "[inset] x y blur spread" (px sin unidad) y --sn-bsc-N = color.
const isLen = (t) => /^-?[\d.]+(px)?$/.test(t);
function shadowDecls(v) {
  if (v === 'none') return [['--sn-bs-n', '"0"']];
  const list = splitTop(v, ',');
  const out = [['--sn-bs-n', `"${list.length}"`]];
  list.forEach((s, i) => {
    const toks = splitTop(s, ' ').filter(Boolean);
    const inset = toks.includes('inset');
    const nums = toks.filter((t) => isLen(t)).map((t) => t.replace('px', ''));
    const color = toks.find((t) => !isLen(t) && t !== 'inset') || 'currentColor';
    const [x = '0', y = '0', blur = '0', spread = '0'] = nums;
    out.push([`--sn-bs-${i}`, `"${inset ? 'inset ' : ''}${x} ${y} ${blur} ${spread}"`]);
    out.push([`--sn-bsc-${i}`, value(color)]);
  });
  return out;
}

// ---------- Recorrido ----------
const ussRules = [], keyframes = {}, cssRules = [];
let order = 0;
function walk(text, media) {
  for (const b of blocks(text)) {
    if (b.head.startsWith('@keyframes')) {
      const name = b.head.split(/\s+/)[1];
      keyframes[name] = blocks(b.body).map((f) => ({ at: f.head.split(',').map((x) => x.trim()), decls: decls(f.body).map(([p, v]) => [p, v]) }));
      continue;
    }
    if (b.head.startsWith('@media')) { walk(b.body, b.head.slice(6).trim()); continue; }
    if (b.head.startsWith('@')) continue; // @font-face...
    const ds = decls(b.body);
    for (const sel of splitTop(b.head, ',')) {
      const { uss, bad } = convSelector(sel);
      const conv = [];
      for (const [p, v, imp] of ds) for (const d of convDecl(p, v)) conv.push(d);
      // display: flex sin dirección en la misma regla -> fila (lo inicial en CSS)
      if (ds.some(([p, v]) => p === 'display' && /^(inline-)?flex$/.test(v)) && !ds.some(([p]) => p === 'flex-direction' || p === 'flex-flow')) conv.push(['flex-direction', 'row']);
      cssRules.push({ sel, uss, order: order++, media: media || null, bad, decls: ds.map(([p, v, imp]) => [p, v, imp]) });
      if (bad.length || media) continue; // los resuelve el C# con Rules.json
      ussRules.push(`${uss} {\n${conv.map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n}`);
    }
  }
}
walk(css, null);

fs.mkdirSync(path.dirname(OUT_USS), { recursive: true });
// En USS las propiedades propias se heredan; las que en CSS NO se heredan se reinician en cada elemento (*)
const NOT_INHERITED = { display: 'auto', 'z-index': 'auto', 'box-shadow': 'none', 'bs-n': '0', background: 'none', transform: 'none', animation: 'none',
  'animation-delay': '0s', 'animation-name': 'none', 'animation-duration': '0s', filter: 'none', 'clip-path': 'none', gap: 'normal',
  'grid-template-columns': 'none', 'grid-template-rows': 'none', 'grid-column': 'auto', 'grid-row': 'auto', position: 'static', outline: 'none',
  'outline-offset': '0', content: 'normal', overflow: 'visible', 'overflow-x': 'visible', 'overflow-y': 'visible', 'vertical-align': 'baseline',
  order: '0', transition: 'none', 'background-size': 'auto', 'background-position': '0 0', 'background-image': 'none', 'text-decoration': 'none',
  'align-items': 'normal', 'align-self': 'auto', 'flex': 'none', 'inset': 'auto' };
const BASE = [
  '* { ' + Object.entries(NOT_INHERITED).map(([k, v]) => `--sn-${k}: "${v}";`).join(' ') + ' }',
  '/* Lo que el navegador pone por defecto a cada etiqueta (va antes: cualquier regla de la web gana) */',
  '.t-div, .t-p, .t-section, .t-header, .t-aside, .t-main, .t-ul, .t-li, .t-h1, .t-h2, .t-h3 { flex-direction: column; flex-shrink: 0; }',
  '.t-span, .t-b, .t-i, .t-kbd, .t-small, .t-em, .t-strong, .t-a, .t-button, .t-canvas, .t-img, .t-label { flex-direction: row; flex-shrink: 0; }',
  '/* Línea de texto dentro de un bloque (el contexto en línea del navegador): las piezas van en fila y saltan de línea */',
  '.sn-line { flex-direction: row; flex-wrap: wrap; flex-shrink: 0; align-items: flex-start; }',
].join('\n');
fs.writeFileSync(OUT_USS, '/* Generado por Unity/Tools~/css2uss.js desde css/style.css. No editar a mano. */\n\n' + BASE + '\n\n' + ussRules.join('\n\n') + '\n');
fs.writeFileSync(OUT_KF, JSON.stringify(keyframes) + '\n');
fs.writeFileSync(OUT_RULES, JSON.stringify(cssRules) + '\n');
const badRules = cssRules.filter((r) => r.bad.length || r.media);
console.log(`${cssRules.length} reglas: ${ussRules.length} a USS, ${badRules.length} para el C# (selectores sin equivalente o @media)`);
console.log(`${Object.keys(keyframes).length} animaciones -> ${path.relative(ROOT, OUT_KF)}`);
console.log('Selectores sin equivalente:', JSON.stringify(report.selectors));
console.log('Propiedades desconocidas:', JSON.stringify(report.props));
