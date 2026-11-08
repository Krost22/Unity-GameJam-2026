// Pruebas de lógica pura (sin navegador): carga los sistemas en una VM de Node y comprueba
// fórmulas, límites, COBRAR, la PISTA, el plazo de la deuda, el fin de partida y el equilibrio.
// Uso: node tools/test/logic.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const FILES = [
  'js/core/sn.js', 'js/core/events.js',
  'js/data/markets.js', 'js/data/events.js', 'js/data/simulation.js', 'js/data/story.js',
  'js/core/state.js',
  'js/systems/economy.js', 'js/systems/time.js', 'js/systems/debt.js', 'js/systems/market-sim.js',
  'js/systems/trading.js', 'js/systems/unlocks.js', 'js/systems/upgrades.js', 'js/systems/save.js',
];
const SCRIPTS = FILES.map((f) => new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }));

function load() {
  const store = {};
  const ctx = {
    console, Math, JSON, Date, Promise, setTimeout,
    location: { search: '' },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const s of SCRIPTS) s.runInContext(ctx);
  return ctx.SN;
}

let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('  FALLO:', msg); }
}
const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;

// 1) Fórmula de la operación y límites
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  ok(run.capital === 100 && run.debt.amount === 250 && run.debt.deadlineDay === 7, 'estado inicial: $100, deuda $250, 7 días');
  ok(SN.Unlocks.isUnlocked('salud') && !SN.Unlocks.isUnlocked('tecno'), 'solo Salud desbloqueado');
  run.form = { amount: 500, leverage: 1 };
  SN.Trading.clampForm();
  ok(run.form.amount === 100, 'no se puede invertir más que el capital');
  run.form = { amount: 5, leverage: 1 };
  SN.Trading.clampForm();
  ok(run.form.amount === SN.Data.sim.minInvestment, `la apuesta mínima es ${SN.Data.sim.minInvestment}`);
  run.form = { amount: 60, leverage: 2 };
  const p = SN.Trading.open(1);
  ok(p && run.capital === 40 && run.committed === 60 && p.amount === 60, 'el dinero queda comprometido al abrir');
  ok(SN.Trading.open(1) === null, 'no se pueden abrir dos operaciones a la vez');
  ok(p.total === SN.Data.markets[0].candles, 'la operación dura las velas del mercado');
  const expected = p.liquidated ? -60 : Math.round(Math.max(-60, 60 * ((p.exit - p.entry) / p.entry) * 1 * 2));
  const r = SN.Trading.close();
  ok(near(r.pnl, expected), `P/L según la fórmula, en dólares enteros (${r.pnl} vs ${expected.toFixed(2)})`);
  ok(near(run.capital, 100 + r.pnl) && run.committed === 0, 'capital final = inicial + P/L');
  ok(run.turn === 1, 'operar consume un turno');
  ok(SN.Trading.close() === null, 'cerrar dos veces no hace nada');
}

// 2) Regresión: la apuesta comprometida y la de la posición son la misma aunque el formulario se recalcule
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  run.form = { amount: 50, frac: 0.5, leverage: 2 };
  // La interfaz recalcula la apuesta (50% del capital) cada vez que cambia el capital
  SN.Events.on('capital:changed', () => { if (!run.position) run.form.amount = Math.floor(run.capital * run.form.frac * 100) / 100; });
  const p = SN.Trading.open(1);
  ok(p.amount === 50 && run.committed === 50, `apuesta comprometida = apuesta de la operación (${p.amount} / ${run.committed})`);
  SN.Trading.close();
  ok(run.committed === 0, 'no queda dinero comprometido fantasma');
}

// 3) BAJA gana si el precio baja; pérdida limitada a lo invertido; liquidación con x10
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  run.flags.debtPaid = true;
  let shortWins = 0, shortTrades = 0, minPnl = 0, liq = 0, negCapital = false;
  for (let i = 0; i < 400; i++) {
    run.capital = 100; run.position = null; run.committed = 0;
    run.form = { amount: 100, leverage: 10 };
    const p = SN.Trading.open(-1);
    const res = SN.Trading.close();
    shortTrades++;
    if (p.liquidated || res.pnl === 0 || (p.exit < p.entry) === (res.pnl > 0)) shortWins++; // 0 = movimiento de centavos
    minPnl = Math.min(minPnl, res.pnl);
    if (p.liquidated) liq++;
    if (run.capital < 0) negCapital = true;
  }
  ok(shortWins === shortTrades, 'en BAJA se gana cuando el precio baja');
  ok(minPnl >= -100, `la pérdida nunca supera lo invertido (mín ${minPnl})`);
  ok(liq > 0, `con x10 hay liquidaciones (${liq}/400)`);
  ok(!negCapital, 'el capital nunca es negativo');
}

// 4) COBRAR: el dinero entra al momento, al precio que se ve, y el mercado sigue sin ti
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  let allGood = true, compared = 0;
  for (let i = 0; i < 200; i++) {
    run.capital = 100; run.position = null; run.committed = 0;
    run.form = { amount: 50, leverage: 2 };
    const p = SN.Trading.open(1);
    const h = run.markets.salud.history;
    const seen = Math.min(5, p.candles - 1);
    const price = h[h.length - p.candles + seen - 1].c;
    const r = SN.Trading.cashOut(price, seen);
    const want = Math.round(Math.max(-50, 50 * (price - p.entry) / p.entry * 2));
    if (!r || !near(r.pnl, want) || !near(run.capital, 100 + want) || run.committed !== 0) allGood = false;
    const r2 = SN.Trading.close();
    if (r2.pnl !== r.pnl || !near(run.capital, 100 + want)) allGood = false;
    if (typeof r.stayPnl === 'number') compared++;
  }
  ok(allGood, 'COBRAR paga al precio visto, una sola vez, sin dejar dinero comprometido');
  ok(compared === 200, 'COBRAR guarda lo que habría pasado si te quedabas');
}

// 5) Giros: solo en la zona de peligro (últimas velas) y la cámara lenta se marca en ellas
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  SN.Data.markets[0].twist.chance = 1;
  let inDanger = true, marked = 0, n = 0;
  for (let i = 0; i < 150; i++) {
    run.capital = 100; run.position = null; run.committed = 0;
    run.form = { amount: 20, leverage: 1 };
    const p = SN.Trading.open(i % 2 ? 1 : -1);
    const h = run.markets.salud.history.slice(-p.candles);
    const tw = h.findIndex((c) => c.tw);
    if (!p.liquidated) { n++; if (tw >= 0 && tw < p.total - SN.Data.sim.dangerCandles) inDanger = false; if (p.climax >= p.total - SN.Data.sim.dangerCandles) marked++; }
    SN.Trading.close();
  }
  ok(inDanger, 'los giros solo caen en las últimas velas');
  ok(marked / n > 0.9, `las velas de giro activan la cámara lenta (${marked}/${n})`);
}

// 6) La PISTA predice de verdad: más flechas, más aciertos
{
  const SN = load();
  const acc = { 0: [0, 0], 1: [0, 0], 2: [0, 0], 3: [0, 0] };
  for (let r = 0; r < 60; r++) {
    SN.State.newRun();
    const run = SN.State.run;
    for (let t = 0; t < 50; t++) {
      run.capital = 100; run.committed = 0; run.position = null; run.debt.paid = true;
      const h = SN.Market.hint('salud');
      run.form = { amount: 50, leverage: 1 };
      SN.Trading.open(h.dir || 1);
      const res = SN.Trading.close();
      acc[h.power][1]++;
      if (res.pnl > 0) acc[h.power][0]++;
    }
  }
  const rate = (k) => acc[k][0] / Math.max(1, acc[k][1]);
  console.log(`  aciertos de la pista: sin señal ${(rate(0) * 100).toFixed(0)}% · ▲ ${(rate(1) * 100).toFixed(0)}% · ▲▲ ${(rate(2) * 100).toFixed(0)}% · ▲▲▲ ${(rate(3) * 100).toFixed(0)}%`);
  ok(rate(1) > 0.6 && rate(2) > rate(1) && rate(3) > rate(2), 'cuantas más flechas, más fiable es la pista');
  ok(rate(0) < 0.62, 'sin pista clara es casi una moneda al aire');
}

// 7) Plazo de la deuda: pago automático, embargo o "ya no llegas"
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  let defaulted = null;
  SN.Events.on('debt:defaulted', (d) => { defaulted = d; });
  for (let i = 0; i < 21; i++) SN.Trading.skipTurn();
  ok(run.day === 8 && defaulted && run.debt.defaulted, 'tras 7 días sin pagar llega el embargo');

  const SN2 = load();
  SN2.State.newRun();
  SN2.State.run.capital = 300;
  let paid = null;
  SN2.Events.on('debt:paid', (d) => { paid = d; });
  for (let i = 0; i < 21; i++) SN2.Trading.skipTurn();
  ok(paid && paid.auto && SN2.State.run.capital === 50, 'si te alcanza al vencer, se cobra sola');

  const SN3 = load();
  SN3.State.newRun();
  const r3 = SN3.State.run;
  ok(SN3.Debt.turnsLeft() === 21 && !SN3.Debt.hopeless(), 'al empezar quedan 21 turnos y se puede llegar');
  Object.assign(r3, { day: 7, turn: 1, capital: 20 });
  ok(SN3.Debt.turnsLeft() === 2 && SN3.Debt.hopeless(), 'día 7, tarde, con $20: ya no se llega (fin de partida)');
  Object.assign(r3, { day: 7, turn: 2, capital: 90 });
  ok(!SN3.Debt.hopeless(), 'día 7, noche, con $90: todavía hay una última oportunidad');
  r3.capital = 260;
  ok(SN3.Debt.pay() && r3.debt.paid && r3.capital === 10 && !SN3.Debt.hopeless(), 'pago anticipado de la deuda');
  r3.capital = 1200;
  const g = SN3.Unlocks.check();
  ok(g && g.id === 'g1000' && SN3.Unlocks.isUnlocked('tecno') && r3.capital === 1300, 'meta $1,000: desbloquea Tecnología y da bono');
  ok(SN3.Upgrades.isUnlocked('analisis') && SN3.Upgrades.isUnlocked('limite'), 'mejoras desbloqueadas progresivamente');
}

// 8) Mejoras y eventos
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  ok(SN.Upgrades.buy('suerte') && run.capital === 75 && SN.Upgrades.value('suerte') === 1, 'comprar Suerte nivel 1 ($25)');
  ok(!SN.Upgrades.buy('limite'), 'Límite bloqueado hasta pagar la deuda');
  ok(SN.Trading.limit() === 250, 'límite base de inversión: $250');
  run.capital = 30;
  ok(!SN.Upgrades.canBuy('suerte').ok, 'una mejora no te puede dejar por debajo de la apuesta mínima');
  run.capital = 75;
  const m = run.markets.salud;
  SN.Market.addEvent(m, SN.Data.marketEvents.salud[1]); // shock
  ok(SN.Market.hint('salud').move > SN.Market.forecast('salud').move - 1, 'la pista incluye los eventos conocidos');
  let resolved = 0;
  SN.Events.on('market:event-resolved', (n) => { resolved++; if (!n.art) resolved = -99; });
  SN.Trading.skipTurn();
  ok(resolved >= 1 && !m.events.some((e) => e.id === 'medicamento'), 'los shocks se aplican y se publican (con su foto) en las velas siguientes');
}

// 9) Tutorial: la primera operación enseña a cobrar y luego enseña el susto desde fuera
{
  let allPositive = true, scared = 0;
  for (let i = 0; i < 120; i++) {
    const SN = load();
    SN.State.newRun();
    const run = SN.State.run;
    run.form = { amount: 50, leverage: 2 };
    const tp = SN.Data.sim.tutorial;
    const p = SN.Trading.open(1, { tutorial: true });
    const h = run.markets.salud.history.slice(-p.candles);
    const r = SN.Trading.cashOut(h[tp.holdAt - 1].c, tp.holdAt);
    SN.Trading.close();
    if (r.pnl <= 0) allPositive = false;
    if (r.stayPnl <= r.pnl) scared++; // en dólares enteros puede empatar si el giro es de centavos
    if (p.climax !== tp.twistAt) allPositive = false;
  }
  ok(allPositive, 'cobrar en el tutorial siempre deja ganancias (y el giro llega con cámara lenta)');
  ok(scared === 120, 'quedarse en el tutorial habría salido peor: se ve el susto');
}

// 10) Equilibrio: estrategias durante los 7 días
function strategy(name, pick, N = 500) {
  let paidCount = 0, ruined = 0;
  for (let i = 0; i < N; i++) {
    const SN = load();
    SN.State.newRun();
    const run = SN.State.run;
    while (run.day <= 7 && !run.debt.paid) {
      if (run.capital >= 250) { SN.Debt.pay(); break; }
      if (run.capital < SN.Data.sim.bankruptcyThreshold || SN.Debt.hopeless()) { ruined++; break; }
      const choice = pick(SN, run);
      if (!choice) { SN.Trading.skipTurn(); continue; }
      run.form = { amount: SN.Trading.maxAmount() * choice.frac, leverage: choice.lev };
      SN.Trading.clampForm();
      SN.Trading.open(choice.dir);
      SN.Trading.close();
    }
    if (run.debt.paid) paidCount++;
  }
  console.log(`  ${name.padEnd(34)} paga la deuda: ${(paidCount / N * 100).toFixed(0).padStart(3)}%  fin de partida antes: ${(ruined / N * 100).toFixed(0)}%`);
  return paidCount / N;
}
console.log('Equilibrio de los 7 primeros días:');
const coin = strategy('al azar, 50%, x2', () => ({ dir: Math.random() < 0.5 ? 1 : -1, frac: 0.5, lev: 2 }));
const follow = strategy('sigue la pista, 50%, x2', (SN) => {
  const h = SN.Market.hint('salud');
  return h.power ? { dir: h.dir, frac: 0.5, lev: 2 } : null;
});
const sized = strategy('apuesta según la fuerza de la pista', (SN) => {
  const h = SN.Market.hint('salud');
  return h.power ? { dir: h.dir, frac: [0, 0.3, 0.6, 1][h.power], lev: [1, 2, 2, 5][h.power] } : null;
});
ok(coin < 0.2, 'jugar al azar casi nunca basta');
ok(follow > 0.55, 'seguir la pista con la apuesta por defecto suele bastar');
ok(sized > follow, 'leer la fuerza de la pista y ajustar la apuesta da aún más ventaja');

console.log(`\n${passed} correctas, ${failed} fallos`);
process.exit(failed ? 1 : 0);
