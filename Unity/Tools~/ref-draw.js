// Referencias de DIBUJO: lo que pintan los módulos de js/render en Chrome (sprites, personajes, la habitación...).
// Carga la web de verdad (index.html) con el bucle del juego parado y Math.random con semilla, ejecuta cada
// "sonda" (una llamada de dibujo con sus parámetros) y guarda los píxeles del lienzo resultante. El port ejecuta
// las mismas sondas (Assets/SaldoNegro/Tests/EditMode/DrawSuite.cs) y tiene que dar los mismos bytes.
// Cada sonda se pinta en una página recién cargada si cambia el estado de los módulos (la habitación), o en
// la misma si es un dibujo puro (sprites, caras).
// TEXTO: Chrome en Windows pinta las letras con el halo de ClearType y el port las pinta nítidas (decisión de
// Eduardo), así que donde hay letras los bytes no pueden coincidir. Cada grupo se ejecuta dos veces: tal cual y
// con fillText sin efecto. De la segunda pasada solo se guardan los píxeles que cambian ("notext": índices y
// colores). El port tiene que dar (1) la imagen sin texto idéntica y (2) la imagen con texto idéntica fuera de
// esos píxeles.
// Uso: node Unity/Tools~/ref-draw.js [grupo]     (grupos: sprites, chars, room, news; sin grupo, todos)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');

const ROOT = path.join(__dirname, '..', '..');
const OUTDIR = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs');

// Antes de cargar la página: bucle parado y Math.random controlable (window.__seed(n) lo reinicia)
const PRE = `
  window.requestAnimationFrame = () => 0;
  (function () {
    const orig = Math.random;
    let s = 0, on = false;
    // mulberry32, el mismo que SN.RNG (en C#: JsMath.rndOverride = new RNG(seed).next)
    const next = () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.__seed = (n) => { s = (n >>> 0) || 1; on = true; };
    Math.random = () => (on ? next() : orig());
    // Pasada sin texto: fillText no pinta (measureText sigue igual)
    const ft = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function () { if (!window.__noText) return ft.apply(this, arguments); };
  })();`;

// ---------- Sondas ----------
const groups = {};
groups.sprites = { fresh: false, probes: [{ kind: 'sprites' }] };
{
  const p = [];
  for (const t of [0, 0.5, 1.3, 2.7, 4.1]) for (const smile of [false, true]) for (const look of [0, 1]) p.push({ kind: 'hooded', t, smile, look });
  for (const t of [0, 0.4, 1.1, 2.2, 3.9]) p.push({ kind: 'bravo', t });
  p.push({ kind: 'bravoFace' });
  for (const expr of ['neutral', 'happy', 'star', 'confused', 'worried', 'shocked', 'relieved']) for (const t of [0, 1.7]) p.push({ kind: 'face', expr, t });
  for (const t of [0, 0.8, 2.5]) p.push({ kind: 'console', t });
  for (const t of [0, 1.2]) p.push({ kind: 'backlight', t });
  groups.chars = { fresh: false, probes: p };
}

// La habitación (SN.Desk.render) en distintas situaciones, varios fotogramas a 60 por segundo
{
  const p = [];
  const allShop = { taza: true, planta: true, lampara: true, poster: true, alfombrilla: true, teclado: true, cascos: true, trofeo: true };
  const keys = { tele: true, movil: true, moto: true, reloj: true };
  const sc = [
    { name: 'manana', run: { turn: 0 } },
    { name: 'tarde', run: { turn: 1 } },
    { name: 'noche', run: { turn: 2 } },
    { name: 'todo-comprado', run: { turn: 1, day: 17, owned: Object.assign({}, allShop, keys) } },
    { name: 'oscuro-noche', run: { turn: 2, day: 23, darkness: 4, owned: { poster: true, lampara: true } } },
    { name: 'pagado', run: { turn: 0, day: 3 }, paid: true },
    { name: 'sin-pc', run: { turn: 1 }, desk: { noPC: true } },
    { name: 'pala-rincon', run: { turn: 1 }, desk: { palaHere: true } },
    { name: 'pala-mesa', run: { turn: 2 }, desk: { palaHere: true, palaPos: 'desk' } },
    { name: 'brillo', run: { turn: 1 }, glow: ['#3DDC84', 0.9], flash: ['#FF4F6D', 1.4] },
  ];
  for (const ev of ['ambulancia', 'apagon', 'fuegos', 'encapuchado', 'dron', 'camion', 'lluvia', 'cuervo', 'temblor', 'oro', 'farolas']) sc.push({ name: 'ventana-' + ev, run: { turn: 1 }, event: ev });
  for (const s of sc) for (const frames of [1, 30, 150]) p.push(Object.assign({ kind: 'room', frames }, s));
  groups.room = { fresh: true, probes: p };
}

// Las fotos de las noticias (SN.NewsArt): todas las escenas a color y en semitono, y algunas variantes
{
  const p = [];
  p.push({ kind: 'newsAll' });
  for (const [id, tone, dark] of [['ciudad', 'neg', 0], ['ciudad', 'neu', 1], ['ciudad', 'pos', 3], ['ciudad', 'neg', 6], ['ciudad', 'neu', 9]]) p.push({ kind: 'newsPhoto', id, tone, dark });
  for (const [crop, sticker] of [[[52, 32], null], [[48, 30], { color: '#3DDC84', sym: 'up' }], [null, { color: '#FF4F6D', sym: 'down' }], [null, { color: '#FF8F3F', sym: 'rumor' }], [[48, 30], { color: '#45E3DA', sym: 'vol' }]]) p.push({ kind: 'newsNode', id: 'ciudad', tone: 'pos', dark: 0, crop, sticker });
  p.push({ kind: 'newsNode', id: 'ciudad', tone: 'neg', dark: 0, crop: null, sticker: { color: '#3DDC84', sym: 'up' }, color: true });
  groups.news = { fresh: false, probes: p };
}

// Lo que hace cada sonda en la página (devuelve un lienzo)
const PROBE_JS = `
  window.__probe = (k) => {
    const Px = SN.Px;
    window.__seed(12345);
    if (k.kind === 'hooded') return SN.Chars.hoodedCanvas(k.t, { smile: k.smile, look: k.look });
    if (k.kind === 'bravo') return SN.Chars.bravoCanvas(k.t);
    if (k.kind === 'bravoFace') return SN.Chars.bravoFace();
    if (k.kind === 'face') { const c = Px.canvas(48, 44), g = Px.ctx(c); SN.Chars.face(g, 24, 4, k.expr, k.t); return c; }
    if (k.kind === 'console') { const c = Px.canvas(80, 60), g = Px.ctx(c); SN.Chars.console(g, 8, 8, k.t); return c; }
    if (k.kind === 'backlight') { const c = Px.canvas(80, 80), g = Px.ctx(c); SN.Chars.hoodBacklight(g, 40, 40, k.t); return c; }
    if (k.kind === 'newsPhoto') return SN.NewsArt.photo(k.id, k.tone, k.dark);
    if (k.kind === 'newsNode') return SN.NewsArt.node(k.id, k.tone, k.dark, k.crop || undefined, { color: k.color, sticker: k.sticker || undefined });
    if (k.kind === 'room') {
      window.__seed(777);
      SN.State.newRun();
      const run = SN.State.run;
      Object.assign(run, k.run || {});
      if (k.paid) { run.debt.paid = true; run.flags.debtPaid = true; }
      const D = SN.Desk;
      D.phaseOverride = null; D.hideConsole = false;
      Object.assign(D, k.desk || {});
      if (k.glow) D.glowTo(k.glow[0], k.glow[1]);
      if (k.flash) D.flashGlow(k.flash[0], k.flash[1]);
      window.__seed(12345);
      if (k.event) D.windowEvent(k.event);
      const c = Px.canvas(320, 180), g = Px.ctx(c);
      for (let i = 0; i < k.frames; i++) D.render(g, 1 / 60);
      return c;
    }
    throw new Error('sonda ' + k.kind);
  };`;

async function pass(name, noText) {
  const grp = groups[name];
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const b = await launch('about:blank', { width: 1280, height: 720, port: 9357 });
  const out = [];
  try {
    await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source: PRE + (noText ? ';window.__noText = true;' : '') });
    const load = async () => { await b.cdp('Page.navigate', { url }); await b.sleep(1500); await b.evaluate(PROBE_JS + ';1'); };
    await load();
    const b64 = `(d) => { let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000)); return btoa(s); }`;
    for (const k of grp.probes) {
      if (grp.fresh) await load();
      if (k.kind === 'newsAll') {
        const r = await b.evaluate(`(() => { const b64 = ${b64}; const o = []; const px = (c) => ({ w: c.width, h: c.height, rgba: b64(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }); for (const id of SN.NewsArt.ids()) { o.push(Object.assign({ probe: { kind: 'newsColor', id } }, px(SN.NewsArt.color(id)))); o.push(Object.assign({ probe: { kind: 'newsPhoto', id, tone: 'pos', dark: 0 } }, px(SN.NewsArt.photo(id, 'pos', 0)))); } return o; })()`);
        out.push(...r);
        continue;
      }
      if (k.kind === 'sprites') {
        const r = await b.evaluate(`(() => { const b64 = ${b64}; const o = {}; for (const n of Object.keys(SN.Sprites.DEFS)) { const c = SN.Sprites.get(n); o[n] = { w: c.width, h: c.height, rgba: b64(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; } return o; })()`);
        for (const [n, v] of Object.entries(r)) out.push(Object.assign({ probe: { kind: 'sprite', name: n } }, v));
        continue;
      }
      const r = await b.evaluate(`(() => { const b64 = ${b64}; const c = window.__probe(${JSON.stringify(k)}); return { w: c.width, h: c.height, rgba: b64(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; })()`);
      out.push(Object.assign({ probe: k }, r));
    }
    if (b.logs.length) console.log(b.logs.filter((l) => /EXCEPTION|error/i.test(l)).slice(0, 10).join('\n'));
  } finally { b.close(); }
  await new Promise((r) => setTimeout(r, 900)); // que Chrome suelte el puerto antes de la otra pasada
  return out;
}

async function runGroup(name) {
  const out = await pass(name, false);
  const bare = await pass(name, true);
  if (bare.length !== out.length) throw new Error(name + ': las dos pasadas no dan las mismas sondas');
  let withText = 0, textPx = 0;
  for (let i = 0; i < out.length; i++) {
    const a = Buffer.from(out[i].rgba, 'base64'), c = Buffer.from(bare[i].rgba, 'base64');
    if (JSON.stringify(out[i].probe) !== JSON.stringify(bare[i].probe) || a.length !== c.length) throw new Error(name + ': sonda ' + i + ' distinta entre pasadas');
    const idx = [];
    for (let p = 0; p < a.length; p += 4) if (a[p] !== c[p] || a[p + 1] !== c[p + 1] || a[p + 2] !== c[p + 2] || a[p + 3] !== c[p + 3]) idx.push(p / 4);
    if (!idx.length) continue;
    const ib = Buffer.alloc(idx.length * 4), pb = Buffer.alloc(idx.length * 4);
    idx.forEach((p, k) => { ib.writeUInt32LE(p, k * 4); c.copy(pb, k * 4, p * 4, p * 4 + 4); });
    out[i].notext = { n: idx.length, idx: ib.toString('base64'), rgba: pb.toString('base64') };
    withText++; textPx += idx.length;
  }
  console.log(`${name}: ${withText} sondas con texto (${textPx} píxeles tocados por letras)`);
  const file = path.join(OUTDIR, `Draw-${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ about: 'Generado por Unity/Tools~/ref-draw.js en Chrome sin GPU. No editar a mano.', probes: out }) + '\n');
  console.log(`${name}: ${out.length} sondas -> ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

(async () => {
  const want = process.argv[2];
  for (const g of Object.keys(groups)) if (!want || want === g) await runGroup(g);
})().catch((e) => { console.error(e); process.exit(1); });
