// Referencias de las funciones matemáticas: lo que dan Math.sin, cos, exp, log, log10, pow y hypot EN CHROME
// (el motor del juego), bit a bit. JsMath (C#) tiene que dar exactamente lo mismo.
// Para que el archivo no pese, los casos aleatorios no se guardan: se generan con un splitmix64 con semilla que
// el C# repite igual (y se guarda un resumen de las entradas para comprobar que salen las mismas). Las salidas
// sí se guardan, como 16 cifras hex (los bits del double) seguidas. Los casos límite van enteros.
// También se calcula en Node para ver si su V8 coincide (solo informa: la referencia es Chrome).
// Uso: node Unity/Tools~/ref-math.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('../../tools/test/cdp');

const REFS = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'MathRefs.json');

// ---------- Esto se ejecuta tal cual en Chrome y en Node ----------
function core(spec) {
  const dv = new DataView(new ArrayBuffer(8));
  const M64 = (1n << 64n) - 1n;
  const toBits = (x) => { dv.setFloat64(0, x); return dv.getBigUint64(0); };
  const fromBits = (b) => { dv.setBigUint64(0, b); return dv.getFloat64(0); };
  const hex = (x) => (x !== x ? '7ff8000000000000' : toBits(x).toString(16).padStart(16, '0')); // NaN: siempre el mismo
  const unhex = (h) => fromBits(BigInt('0x' + h));
  const F = {
    sin: (a) => Math.sin(a[0]), cos: (a) => Math.cos(a[0]), exp: (a) => Math.exp(a[0]), log: (a) => Math.log(a[0]),
    log10: (a) => Math.log10(a[0]), pow: (a) => Math.pow(a[0], a[1]), hypot: (a) => Math.hypot(...a),
  };
  const f = F[spec.fn];
  const out = { edges: [], groups: [] };
  for (const e of spec.edges) out.edges.push(hex(f(e.map(unhex))));
  for (const g of spec.groups) {
    let s = BigInt('0x' + g.seed);
    const next = () => { // splitmix64
      s = (s + 0x9E3779B97F4A7C15n) & M64;
      let z = s;
      z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & M64;
      z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & M64;
      return z ^ (z >> 31n);
    };
    const arg = (k) => {
      if (k.k === 'const') return unhex(k.lo);
      const r = next();
      if (k.k === 'bits') return fromBits(r);
      if (k.k === 'logb') { // uniforme en los bits entre lo y hi (positivos): casi uniforme en escala logarítmica
        const blo = toBits(unhex(k.lo)), bhi = toBits(unhex(k.hi));
        let b = blo + r % (bhi - blo + 1n);
        if (k.sign && (r >> 63n)) b |= 1n << 63n;
        return fromBits(b);
      }
      const u = Number(r >> 11n) * 2 ** -53; // [0, 1)
      const lo = unhex(k.lo), hi = unhex(k.hi);
      if (k.k === 'lin') return lo + u * (hi - lo);
      if (k.k === 'int') return lo + Math.floor(u * (hi - lo + 1));
      throw new Error('tipo ' + k.k);
    };
    let h = 0xCBF29CE484222325n, o = '';
    for (let i = 0; i < g.n; i++) {
      const a = g.args.map(arg);
      for (const x of a) h = ((h ^ toBits(x)) * 0x100000001B3n) & M64;
      o += hex(f(a));
    }
    out.groups.push({ hash: h.toString(16).padStart(16, '0'), out: o });
  }
  return out;
}
// ------------------------------------------------------------------

const dv = new DataView(new ArrayBuffer(8));
const hx = (x) => { if (x !== x) return '7ff8000000000000'; dv.setFloat64(0, x); return dv.getBigUint64(0).toString(16).padStart(16, '0'); };

// Generadores de entradas (lo/hi van en hex para que el C# lea exactamente el mismo double)
const lin = (lo, hi) => ({ k: 'lin', lo: hx(lo), hi: hx(hi) });
const int = (lo, hi) => ({ k: 'int', lo: hx(lo), hi: hx(hi) });
const logb = (lo, hi, sign) => ({ k: 'logb', lo: hx(lo), hi: hx(hi), sign: !!sign });
const bits = () => ({ k: 'bits' });
const cst = (x) => ({ k: 'const', lo: hx(x) });
let seedN = 1;
const G = (n, ...args) => ({ seed: (0x5A1D0000n + BigInt(seedN++) * 0x1F123BB5n).toString(16), n, args });

const SPECIAL = [0, -0, NaN, Infinity, -Infinity, 5e-324, -5e-324, 2.2250738585072014e-308, -2.2250738585072014e-308,
  2.225073858507201e-308, 1.7976931348623157e308, -1.7976931348623157e308, 1, -1, 0.5, -0.5, 2, -2, 3, -3, 1.5, -1.5,
  1e300, -1e300, 1e-300, -1e-300, 1e22, 1e16, 2 ** 53, 2 ** 53 + 2, 0.1, -0.1, 10, 100, 1e-10];
const pows2 = []; for (let k = -1074; k <= 1023; k += 23) pows2.push(2 ** k);
const one = (xs) => xs.flatMap((x) => [[x], [-x]]).map((a) => a.map(hx));

function edgesSinCos() {
  const xs = [...SPECIAL, ...pows2, 2 ** -27, 2 ** -26, 2 ** -28, 0.7853981633974483, 2.356194490192345, 3.9269908169872414,
    5.497787143782138, 1e5, 1e10, 1e15, 1e20, 1e100, 1e200, 1e308, 6381956970095103 * 2 ** 797, 5.319372648326541e255];
  for (let k = -50; k <= 50; k++) xs.push(k * Math.PI / 2, k * Math.PI / 4, k * Math.PI, k * 2 * Math.PI, k);
  for (let k = 0; k < 100; k++) xs.push(k * 0.05, k * 0.016666666666666666, k * 6.283185307179586 / 60);
  return one(xs);
}
function edgesExp() {
  const xs = [...SPECIAL, ...pows2, 709.782712893384, 709.7827128933841, 709.78, 710, -745.1332191019411, -745.1332191019412,
    -745.13321910194, -746, -708.3964185322641, -708.4, -744, 0.34657359027997264, 1.0397207708399179, 3.725290298461914e-9,
    2 ** -28, 2 ** -54, 2 ** -1000, 0.6931471805599453, 1.3862943611198906, 2.302585092994046];
  for (let k = -750; k <= 710; k += 10) xs.push(k);
  for (let k = -80; k <= 80; k++) xs.push(k / 8);
  for (let k = -20; k <= 20; k++) xs.push(k * 0.6931471805599453);
  return one(xs);
}
function edgesLog() {
  const xs = [...pows2, Math.E, 1 + 2 ** -52, 1 - 2 ** -53, 1 + 2 ** -30, 1 - 2 ** -30, 0.9999999999999999,
    1.0000000000000002, 4.9406564584124654e-324, 1e-320, 1e-310];
  for (let k = -323; k <= 308; k++) xs.push(Number('1e' + k));
  for (let k = 1; k <= 200; k++) xs.push(k, k / 100);
  return one(SPECIAL).concat(xs.map((x) => [hx(x)]));
}
function edgesPow() {
  const S = [0, -0, NaN, Infinity, -Infinity, 1, -1, 0.5, -0.5, 2, -2, 3, -3, 1.5, -1.5, 0.25, 1e300, -1e300, 5e-324,
    -5e-324, 1.7976931348623157e308, 2 ** 53, 2 ** 53 + 1, -(2 ** 53), 1e-300, 0.9999999999999999, 1.0000000000000002, 10, 1023, 1024, -1074, -1075];
  const r = [];
  for (const x of S) for (const y of S) r.push([x, y]);
  for (let k = -1080; k <= 1030; k += 3) r.push([2, k]);
  for (let k = -330; k <= 312; k++) r.push([10, k]);
  for (let b = 2; b <= 12; b++) for (let k = -20; k <= 20; k++) r.push([b, k], [-b, k]);
  // resultados exactos y justo a mitad entre dos doubles
  r.push([134217727, 2], [134217727, 3], [134217729, 2], [3, 34], [3, 35], [5, 23], [7, 19], [2.25, 1.5], [4, 0.5], [4, 1.5],
    [16, 0.25], [16, 0.75], [0.0625, 0.25], [1e-10, 0.5], [8, 1 / 3], [27, 1 / 3], [1e16, 0.5], [2, 0.5], [9007199254740993, 1],
    [0.0005, 0.016666666666666666], [0.0005, 0.016], [0.0005, 0], [0.0005, 0.1]);
  for (let t = 0; t <= 100; t++) r.push([2, -10 * (t / 100)], [1 - t / 100, 3], [1 - t / 100, 2], [0.0005, t / 6000]);
  return r.map((a) => a.map(hx));
}
function edgesHypot() {
  const S = [0, -0, NaN, Infinity, -Infinity, 1, -1, 3, 4, 5e-324, 1.7976931348623157e308, 1e300, 1e-300, 2.2250738585072014e-308, 0.1, 500];
  const r = [[], [-3], [-0], [NaN], [-Infinity], [5e-324]];
  for (const x of S) for (const y of S) r.push([x, y]);
  for (const x of [0, NaN, Infinity, -Infinity, 1, 1e300]) for (const y of [0, NaN, Infinity, 2]) for (const z of [0, NaN, -Infinity, 3]) r.push([x, y, z], [x, y, z, 4], [4, x, y, z, NaN]);
  r.push([3, 4, 12], [1, 1, 1, 1], [1e308, 1e308, 1e308], [1e-310, 1e-310, 1e-310, 1e-310]);
  return r.map((a) => a.map(hx));
}

const SPECS = [
  { fn: 'sin', edges: edgesSinCos(), groups: [G(8000, lin(0, 2000)), G(5000, lin(-10, 10)), G(1000, lin(-1, 1)), G(1000, lin(-1e6, 1e6)),
    G(1000, lin(-100, 100)), G(2500, logb(1e-300, 1e300, true)), G(1500, bits())] },
  { fn: 'cos', edges: edgesSinCos(), groups: [G(8000, lin(0, 2000)), G(5000, lin(-10, 10)), G(1000, lin(-1, 1)), G(1000, lin(-1e6, 1e6)),
    G(1000, lin(-100, 100)), G(2500, logb(1e-300, 1e300, true)), G(1500, bits())] },
  { fn: 'exp', edges: edgesExp(), groups: [G(10000, lin(-50, 10)), G(3000, lin(-746, 710)), G(2000, lin(-1, 1)), G(1000, lin(-1e-5, 1e-5)),
    G(2000, logb(1e-20, 800, true)), G(2000, bits())] },
  { fn: 'log', edges: edgesLog(), groups: [G(8000, logb(1e-6, 1e6)), G(6000, lin(0.5, 2)), G(2000, lin(0.999, 1.001)),
    G(2000, logb(5e-324, 1.7976931348623157e308)), G(2000, bits())] },
  { fn: 'log10', edges: edgesLog(), groups: [G(10000, logb(1e-3, 1e9)), G(3000, lin(0.5, 2)), G(3000, lin(1, 1e6)),
    G(2000, logb(5e-324, 1.7976931348623157e308)), G(2000, bits())] },
  { fn: 'pow', edges: edgesPow(), groups: [G(6000, lin(0, 10), lin(-20, 20)), G(2000, cst(0.0005), lin(0, 0.1)), G(2000, cst(2), lin(-10, 0)),
    G(2000, lin(0, 1), cst(3)), G(2000, lin(-10, 10), int(-20, 20)), G(500, lin(0, 10), cst(2)), G(500, lin(0, 100), cst(0.5)),
    G(2000, logb(1e-10, 1e10), lin(-50, 50)), G(1000, bits(), bits()), G(1000, lin(0.9, 1.1), lin(-1000, 1000)),
    G(1000, int(0, 20), int(-10, 30)), G(1000, lin(0, 1), lin(0, 5)), G(1000, logb(1e-300, 1e300, true), int(-5, 5))] },
  { fn: 'hypot', edges: edgesHypot(), groups: [G(14000, lin(-500, 500), lin(-500, 500)), G(1500, bits(), bits()),
    G(1500, logb(1e-300, 1e300, true), logb(1e-300, 1e300, true)), G(2000, lin(-500, 500), lin(-500, 500), lin(-500, 500)),
    G(1000, lin(-1, 1), lin(-1, 1), lin(-1, 1), lin(-1, 1)), G(500, lin(-500, 500), lin(-500, 500), lin(-500, 500), lin(-500, 500), lin(-500, 500))] },
];

(async () => {
  const b = await launch('about:blank', { width: 320, height: 200, port: 9351 });
  try {
    const chromeVer = await b.evaluate('navigator.userAgent');
    await b.evaluate('globalThis.__core = ' + core.toString() + '; true');
    const funcs = {};
    const nodeReport = {};
    for (const spec of SPECS) {
      const c = await b.evaluate('__core(' + JSON.stringify(spec) + ')');
      const n = core(spec);
      // ¿Coincide el V8 de Node?
      let total = spec.edges.length, diff = 0;
      const ex = [];
      c.edges.forEach((v, i) => { if (v !== n.edges[i]) { diff++; if (ex.length < 3) ex.push(spec.edges[i].join(',') + ' chrome ' + v + ' node ' + n.edges[i]); } });
      c.groups.forEach((g, gi) => {
        if (g.hash !== n.groups[gi].hash) throw new Error('las entradas no salen iguales en Node y Chrome');
        for (let i = 0; i < g.out.length; i += 16) {
          total++;
          if (g.out.substr(i, 16) !== n.groups[gi].out.substr(i, 16)) { diff++; if (ex.length < 3) ex.push('grupo ' + gi + ' caso ' + i / 16 + ' chrome ' + g.out.substr(i, 16) + ' node ' + n.groups[gi].out.substr(i, 16)); }
        }
      });
      nodeReport[spec.fn] = { total, diff, ex };
      console.log(`${spec.fn}: ${total} casos, Node difiere en ${diff}` + (ex.length ? '  p. ej. ' + ex[0] : ''));
      funcs[spec.fn] = {
        edges: spec.edges.map((e, i) => e.concat(c.edges[i]).join(' ')),
        groups: spec.groups.map((g, gi) => ({ seed: g.seed, n: g.n, args: g.args, hash: c.groups[gi].hash, out: c.groups[gi].out })),
      };
    }
    const json = {
      about: 'Generado por Unity/Tools~/ref-math.js en Chrome. No editar a mano. edges: "entradas... salida" en hex (bits del double; ' +
        'NaN siempre 7ff8000000000000). groups: entradas aleatorias de un splitmix64 (ver ref-math.js); hash = FNV-1a de sus bits; out = salidas seguidas, 16 hex cada una.',
      chrome: chromeVer, node: process.version + ' (V8 ' + process.versions.v8 + ')', nodeDiffers: nodeReport, funcs,
    };
    fs.writeFileSync(REFS, JSON.stringify(json) + '\n');
    console.log('Escrito', REFS, (fs.statSync(REFS).size / 1e6).toFixed(2), 'MB');
  } finally { b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
