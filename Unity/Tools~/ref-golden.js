// Referencia de SEMILLA FIJA: la lógica de la web, con semillas fijas, en Chrome (el mismo motor que el juego).
// Juega partidas enteras con un bot determinista (sin Math.random) y guarda, turno a turno, un resumen (hash) de
// la partida y de cada evento emitido. El port de Unity juega lo mismo con la misma semilla y tiene que dar
// exactamente los mismos resúmenes: mismas velas, mismo dinero, mismos eventos y el mismo JSON de guardado.
// Guarda además las primeras salidas del generador, y textos de dinero, porcentajes, palabras clave y cifrado.
// La web no se toca: se cargan sus archivos de lógica en una página en blanco.
// Uso: node Unity/Tools~/ref-golden.js            (escribe Assets/SaldoNegro/Tests/EditMode/Refs/GoldenRefs.json)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { launch } = require('../../tools/test/cdp');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'Assets', 'SaldoNegro', 'Tests', 'EditMode', 'Refs', 'GoldenRefs.json');
const FILES = [
  'js/core/sn.js', 'js/core/events.js',
  'js/data/markets.js', 'js/data/events.js', 'js/data/simulation.js', 'js/data/progression.js', 'js/data/luck.js',
  'js/data/cipher.js', 'js/data/academy.js', 'js/data/story.js', 'js/data/chat.js', 'js/data/finale.js',
  'js/core/state.js',
  'js/systems/economy.js', 'js/systems/academy.js', 'js/systems/time.js', 'js/systems/debt.js', 'js/systems/market-sim.js',
  'js/systems/trading.js', 'js/systems/unlocks.js', 'js/systems/upgrades.js', 'js/systems/save.js',
  'js/systems/cipher.js', 'js/systems/luck.js', 'js/systems/shopwatch.js', 'js/ui/keywords.js',
];
const SRC = FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');

// ---------- Lo que se ejecuta en el motor (Chrome y, para comparar, Node) ----------
// load() devuelve un SN nuevo (como recargar la página).
function golden(load) {
  const hex = (x) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, '0'); };
  const fnv = (s, h = 0x811c9dc5) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const out = {};

  // 1) El generador
  {
    const SN = load();
    const r = new SN.RNG(42), r2 = new SN.RNG(3000000000), r3 = new SN.RNG(0);
    out.rng = { next: [], normal: [], int: [], big: [], zero: [] };
    for (let i = 0; i < 2000; i++) out.rng.next.push(hex(r.next()));
    for (let i = 0; i < 1000; i++) out.rng.normal.push(hex(r.normal()));
    for (let i = 0; i < 500; i++) out.rng.int.push(r.int(-7, 13));
    for (let i = 0; i < 50; i++) out.rng.big.push(hex(r2.next()));
    for (let i = 0; i < 50; i++) out.rng.zero.push(hex(r3.next()));
    out.rng.state = r.s;
  }

  // 2) Textos: dinero, cantidades cortas, porcentajes, palabras clave y cifrado
  {
    const SN = load(), U = SN.Util;
    const nums = [0, -0, 1, -1, 0.5, -0.5, 1.5, 2.5, -2.5, 7, 77, 999, 1000, 1234.5, -1234.5, 9999.5, 10000, 12345, 99999, 999999, 1e6, 1234567, -7654321, 3e9, 1e15, 0.07, 0.123, -0.00049, 0.005, 1.005, 0.145, 0.285, 2 / 3, 1 / 3, 0.1 + 0.2];
    for (let i = 0; i < 300; i++) nums.push(Math.round(Math.sin(i * 12.9898) * 43758.5453 * 100) / 100 * (i % 7 + 1));
    out.text = {
      nums: nums.map(hex),
      money: nums.map((v) => U.money(v)), moneySign: nums.map((v) => U.money(v, { sign: true })),
      short: nums.map((v) => U.short(v)), pct: nums.map((v) => U.pct(v)), pct1: nums.map((v) => U.pct(v, 1)), pct2: nums.map((v) => U.pct(v, 2)),
      str: nums.map((v) => String(v)), fixed2: nums.map((v) => v.toFixed(2)),
    };
    SN.State.newRun();
    const phrases = ['Debes $250 hoy.', 'Te faltan $1,750.', '$60.', 'Día 17', 'Siete pavos', '¡Qué suerte!', 'Estás afortunada', 'suertes',
      'Toma un regalo de bienvenida: ya puedes comprar LÍMITE. Y un multiplicador ×10.', 'Tienes una deuda con plazo', '¡Liquidado!',
      'Se abre el Mercado Dorado', 'Pulsa COBRAR ya', 'vas a cobrar mañana', 'apuesta x2', 'max2 y xbox', 'EL DIARIO DEL FUTURO', '<b>$5</b>',
      'FUTURO.exe ha encontrado algo', 'Abre FUTURO.EXE', '−$7,777 de deuda', '+$ 77K y $3M', '10x más y x 5', 'Plan B y apalancamiento',
      'Desbloqueas la Tienda, las Mejoras y la Academia', 'ЖДФ Я son letras', 'Embargado por el cobrador: intereses de la bancarrota',
      'SUBIRÁ o BAJARÁ? ESPERAR', 'Mercados nuevos: Salud, Tecnología, Negocios, Minería y mineria'];
    for (const t of SN.Data.story.fillerNews || []) phrases.push(t.title, t.text);
    out.kw = phrases.map((t) => [SN.KW.html(t), SN.KW.html(t, { terms: false }), SN.KW.has(t)]);
    const C = SN.Cipher;
    out.cipher = phrases.slice(0, 12).map((t) => C.text(t));
    out.cipherHtml = phrases.slice(0, 12).map((t) => C.html(t, 'A'));
    C.discover(SN.Data.cipher.clues[0].id); C.discover(SN.Data.cipher.clues[3].id);
    out.cipher2 = phrases.slice(0, 12).map((t) => C.text(t) + '|' + C.html(t, SN.Data.cipher.clues[0].letter) + '|' + C.brandify(t));
  }

  // 3) Partidas enteras con un bot determinista
  out.runs = [];
  for (const seed of [1, 123456789, 2024, 777, 3000000000 % 2147483648]) {
    const SN = load();
    const S = SN.State, U = SN.Unlocks, T = SN.Trading, D = SN.Data;
    let evHash = 0x811c9dc5, evCount = 0;
    const emit0 = SN.Events.emit;
    SN.Events.emit = function (type, data) {
      let s;
      try { s = JSON.stringify(data); } catch (_) { s = '!'; }
      evHash = fnv(type + ':' + s, evHash); evCount++;
      return emit0.call(this, type, data);
    };
    const rnd = Math.random;
    Math.random = () => seed / 2147483648;
    S.newRun();
    Math.random = rnd;
    let run = S.run, last = -1, rewinds = 0, rescues = 0;
    const turns = [], full = {};
    const mark = () => { if (run.step !== last) { last = run.step; S.checkpoint('paso ' + run.step); } };
    const bestLev = (want) => D.sim.leverages.map((l) => l.value).filter((v) => v <= want && T.leverageAvailable(v)).pop() || 1;
    full.start = JSON.stringify(run);
    mark();
    for (let t = 0; t < 400 && U.step(); t++) {
      if (SN.Debt.canPay()) SN.Debt.pay();
      SN.Debt.flushBonuses();
      while (U.check()) mark();
      mark();
      const st = U.step();
      if (!st) break;
      if (st.kind === 'item' && U.canBuyItem(st.item).ok) U.acceptOffer(st.item);
      else {
        if (run.flags.debtPaid) run.flags.academy = true;
        for (const n of SN.Academy.buyable()) if (run.capital - n.cost >= run.capital * 0.6) SN.Academy.buy(n.id);
        for (const id of ['multiplicador', 'limite', 'analisis', 'suerte', 'resistencia']) {
          const c = SN.Upgrades.canBuy(id);
          if (c.ok && run.capital >= c.debt * 2) SN.Upgrades.buy(id);
        }
        if (SN.Luck.canSpin()) SN.Luck.spin();
        SN.ShopWatch.afterTurn();
        if (t % 4 === 0) SN.ShopWatch.markSeen('shop');
        const late = (run.debt && run.debt.defaulted) || SN.Debt.hopeless();
        if (late || run.capital + run.committed < D.sim.bankruptcyThreshold) {
          if (run.rescue === 'ready') {
            rescues++;
            SN.Economy.add(S.rescueAmount(), 'rescue');
            run.rescue = 'used';
            if (late) { run.debt.deadlineDay = Math.max(run.debt.deadlineDay, run.day) + 2; run.debt.defaulted = false; }
          } else {
            rewinds++; S.restoreCheckpoint(); run = S.run; S.rng.s = (S.rng.s + rewinds * 7919) | 0;
          }
        } else {
          let best = null;
          for (const d of D.markets) {
            if (!U.isUnlocked(d.id)) continue;
            const h = SN.Market.hint(d.id);
            if (h.power && (!best || d.cap > best.d.cap || (d.cap === best.d.cap && h.power > best.h.power))) best = { d, h };
          }
          if (!best) T.skipTurn();
          else {
            run.selected = best.d.id;
            const p = best.h.power, lev = bestLev([1, 2, 2, 5][p]);
            run.form = { amount: Math.max(D.sim.minInvestment, Math.floor(T.maxAmount() * [0, 0.3, 0.6, 1][p])), leverage: lev };
            T.clampForm();
            const pos = T.open(best.h.dir, t === 0 ? { tutorial: true } : undefined);
            if (!pos) T.skipTurn();
            else {
              if (t % 3 === 0 && pos.candles > 2) {
                const h = run.markets[pos.market].history, seen = Math.min(4, pos.candles - 1);
                T.cashOut(h[h.length - pos.candles + seen - 1].c, seen);
              }
              T.close();
            }
          }
        }
      }
      turns.push(fnv(JSON.stringify(run) + '|' + JSON.stringify(S.profile)).toString(16) + ' ' + evHash.toString(16) + ' ' + evCount);
      if (t === 60) full.t60 = JSON.stringify(run);
    }
    full.end = JSON.stringify(run);
    out.runs.push({ seed, rewinds, rescues, day: run.day, step: run.step, turns, full });
  }
  return out;
}

// ---------- En Node (para comparar) y en Chrome (la referencia) ----------
function nodeLoad() {
  const ctx = { console, Math, JSON, Date, location: { search: '' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return ctx.SN;
}

(async () => {
  const t0 = Date.now();
  const nodeOut = golden(nodeLoad);
  console.log(`Node: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const b = await launch('about:blank', { width: 800, height: 600, port: 9353 });
  let chromeOut;
  try {
    await b.sleep(500);
    const expr = `(() => {
      const SRC = ${JSON.stringify(SRC)};
      const load = () => { delete window.SN; (0, eval)(SRC); return window.SN; };
      return JSON.stringify((${golden.toString()})(load));
    })()`;
    chromeOut = JSON.parse(await b.evaluate(expr));
    if (b.logs.length) console.log('Consola de Chrome:\n' + b.logs.slice(0, 20).join('\n'));
  } finally { b.close(); }
  const same = JSON.stringify(nodeOut) === JSON.stringify(chromeOut);
  console.log(same ? 'Node y Chrome dan exactamente lo mismo.' : 'OJO: Node y Chrome NO dan lo mismo (vale lo de Chrome).');
  if (!same) {
    for (const k of Object.keys(chromeOut)) if (JSON.stringify(nodeOut[k]) !== JSON.stringify(chromeOut[k])) console.log('  distinto en: ' + k);
  }
  for (const r of chromeOut.runs) console.log(`  semilla ${r.seed}: ${r.turns.length} turnos, día ${r.day}, paso ${r.step}, ${r.rescues} rescates, ${r.rewinds} vueltas`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(Object.assign({ about: 'Generado por Unity/Tools~/ref-golden.js en Chrome. No editar a mano.' }, chromeOut)) + '\n');
  console.log(`-> ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
})().catch((e) => { console.error(e); process.exit(1); });
