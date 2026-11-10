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
  'js/data/markets.js', 'js/data/events.js', 'js/data/simulation.js', 'js/data/progression.js', 'js/data/luck.js',
  'js/data/cipher.js', 'js/data/academy.js', 'js/data/story.js',
  'js/core/state.js',
  'js/systems/economy.js', 'js/systems/academy.js', 'js/systems/time.js', 'js/systems/debt.js', 'js/systems/market-sim.js',
  'js/systems/trading.js', 'js/systems/unlocks.js', 'js/systems/upgrades.js', 'js/systems/save.js',
  'js/systems/cipher.js', 'js/systems/luck.js', 'js/systems/shopwatch.js', 'js/ui/keywords.js',
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
  ctx.SN.__store = store; // para comprobar lo que se guarda
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
  SN.Luck.today = () => null; // sin días de la suerte: aquí se comprueba el dinero exacto
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
  ok(paid && paid.auto && SN2.State.run.capital === 50 + 75, 'si te alcanza al vencer, se cobra sola (y llega el bono de la app)');

  const SN3 = load();
  SN3.State.newRun();
  const r3 = SN3.State.run;
  ok(SN3.Debt.turnsLeft() === 21 && !SN3.Debt.hopeless(), 'al empezar quedan 21 turnos y se puede llegar');
  Object.assign(r3, { day: 7, turn: 1, capital: 20 });
  ok(SN3.Debt.turnsLeft() === 2 && SN3.Debt.hopeless(), 'día 7, tarde, con $20: ya no se llega (fin de partida)');
  Object.assign(r3, { day: 7, turn: 2, capital: 90 });
  ok(!SN3.Debt.hopeless(), 'día 7, noche, con $90: todavía hay una última oportunidad');
  r3.capital = 260;
  ok(SN3.Debt.pay() && r3.debt.paid && r3.capital === 10 + 75 && !SN3.Debt.hopeless(), 'pago anticipado de la deuda (+ bono de $75)');
  // La escalera: Pleyzeta pagada -> paso completado -> primer regalo (LÍMITE + una deuda)
  let ev = SN3.Unlocks.check();
  ok(ev && ev.type === 'done' && ev.step.id === 'pleyzeta', 'pagar la Pleyzeta completa el primer paso');
  ev = SN3.Unlocks.check();
  ok(ev && ev.type === 'gift' && SN3.Upgrades.isUnlocked('limite') && SN3.Upgrades.level('limite') === 0 && SN3.Debt.active() && r3.debt.amount === 150,
    'el regalo desbloquea LÍMITE (sin darte ningún nivel) y trae una deuda');
  ok(SN3.Unlocks.check() === null, 'con una deuda pendiente la escalera no avanza');
}

// 8) Mejoras y eventos
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  ok(!SN.Upgrades.isUnlocked('suerte') && !SN.Upgrades.buy('suerte'), 'al empezar no hay mejoras: llegan como "regalo"');
  run.gifts.suerte = true;
  run.capital = 500;
  const cred = Math.round(400 * (1 + SN.Data.credit.interest));
  ok(SN.Upgrades.buy('suerte') && run.capital === 500 && SN.Upgrades.value('suerte') === 1 && run.debt.id === 'pleyzeta' && run.debt.amount === 250 + cred,
    `tras el regalo, Suerte nivel 1 se compra a crédito: hoy $0 y $${cred} ($400 + intereses) se suman a la deuda abierta`);
  ok(!SN.Upgrades.buy('limite'), 'Límite bloqueado hasta su regalo');
  ok(SN.Trading.limit() === 250, 'límite base de inversión: $250');
  run.capital = 30;
  run.debt.deadlineDay = run.day;
  ok(!SN.Upgrades.canBuy('suerte').ok && SN.Upgrades.canBuy('suerte').reason === 'YA NO PODRÍAS PAGAR A TIEMPO', 'no se compra a crédito lo que ya no se podría pagar a tiempo');
  run.debt.amount = 0; run.debt.paid = true;
  run.capital = 75;
  const m = run.markets.salud;
  const shock = SN.Market.addEvent(m, SN.Data.marketEvents.salud[1]); // shock
  ok(SN.Market.hint('salud').move > SN.Market.forecast('salud').move - 1, 'la pista incluye los eventos conocidos');
  let resolved = 0;
  SN.Events.on('market:event-resolved', (n) => { resolved++; if (!n.art) resolved = -99; });
  SN.Trading.skipTurn();
  // (por su uid: al acabar el turno puede salir otra vez la misma noticia, y es otro evento)
  ok(resolved >= 1 && !m.events.includes(shock), 'los shocks se aplican y se publican (con su foto) en las velas siguientes');
}

// 11) Escalera de progresión: una cadena de deudas (al pagar una llega la siguiente), objetos clave con la
// oferta de FUTURO.exe
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run, U = SN.Unlocks;
  const drain = () => { const out = []; let e; while ((e = U.check())) out.push(e.type); return out.join(); };
  run.capital = 5000; // con dinero de sobra tampoco se salta ningún paso
  ok(drain() === '', 'con la Pleyzeta sin pagar no avanza nada (aunque tengas $5,000)');
  ok(!U.canBuyItem('tele').ok && U.canBuyItem('tele').locked, 'la tele no se puede comprar antes de su paso');
  run.capital = 253;
  SN.Debt.pay();
  ok(run.capital === 3 + 75 && run.debts.length === 0 && run.debt.bonus === 75, `al saldar la Pleyzeta con $253 te quedan $3... y el bono de la app (30%): $78 (${run.capital})`);
  run.capital = 5000;
  ok(drain() === 'done,gift', 'tras la Pleyzeta llega el primer regalo');
  ok(SN.Data.chain.slice(0, -1).every((st) => st.kind !== 'goal'), 'no hay metas de dinero entre deudas: solo la final');
  ok(!U.isUnlocked('tecno'), 'Tecnología no se abre antes de su regalo, aunque tengas el dinero');
  SN.Debt.pay();
  ok(drain() === 'done' && U.step().id === 'tele', 'pagado el regalo, el siguiente paso es comprar la tele');
  ok(!U.canBuyItem('movil').ok && U.canBuyItem('movil').locked, 'los objetos clave van en orden');
  // Comprobar si se puede comprar no cambia nada
  const before = JSON.stringify([run.capital, run.owned, run.debt, run.step]);
  ok(U.canBuyItem('tele').ok && before === JSON.stringify([run.capital, run.owned, run.debt, run.step]), 'mirar la oferta no cambia nada');
  const o = U.offer('tele');
  ok(o.now === 0 && o.debt === 900 && o.need === 0, `la oferta: $0 hoy, $900 después y no pide dinero en la cuenta (${o.now} / ${o.debt} / ${o.need})`);
  run.capital = 12;
  ok(U.canBuyItem('tele').ok, 'la oferta se puede aceptar aunque casi no tengas dinero: la deuda se paga después');
  ok(U.acceptOffer('tele') && run.owned.tele && run.capital === 12 && SN.Debt.active() && run.debt.amount === o.debt && U.isUnlocked('salud_negro'),
    'aceptar la oferta: hoy no pagas nada, lo debes todo y se abre Salud negro');
  run.capital = 5000;
  ok(U.acceptOffer('tele') === null, 'no se puede comprar dos veces');
  SN.Debt.pay();
  ok(drain() === 'done,gift' && U.isUnlocked('tecno') && SN.Upgrades.isUnlocked('analisis') && SN.Debt.active(),
    'pagada la tele llega la siguiente deuda al momento: el regalo de ANÁLISIS, que abre Tecnología');
  // El resto de la escalera con dinero de sobra: termina en la meta final con los 8 mercados abiertos
  run.capital = 1e7;
  for (let i = 0; i < 80 && U.step(); i++) {
    drain();
    const st = U.step();
    if (!st) break;
    if (SN.Debt.active()) SN.Debt.pay();
    else if (st.kind === 'item') U.acceptOffer(st.item);
  }
  drain();
  ok(!U.step() && SN.Data.markets.every((d) => U.isUnlocked(d.id)), 'la escalera se completa y abre los 8 mercados');
  ok(['limite', 'analisis', 'suerte', 'resistencia'].every((id) => SN.Upgrades.isUnlocked(id)), 'las 4 mejoras llegan como regalo');
  ok(run.debts.length === 8 && run.debts.every((d) => d.paid), `9 deudas en total, todas pagadas (${run.debts.length + 1})`);
}

// 12) Topes por mercado: ninguna operación gana ni pierde más que su tope; el negro es 0.8 × el siguiente normal
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  const normal = SN.Data.markets.filter((d) => !d.black);
  let ladder = true;
  normal.forEach((d, i) => {
    const b = SN.Data.marketById(d.id + '_negro'), next = normal[i + 1];
    if (!b || b.cap !== Math.round((next ? next.cap : d.cap * 4) * 0.8) || b.cap <= d.cap || (next && b.cap >= next.cap)) ladder = false;
  });
  ok(ladder, 'cada mercado negro: mejor que el suyo y un 20% peor que el siguiente normal');
  ok(normal.every((d, i) => !i || d.cap > normal[i - 1].cap), 'cada mercado normal da más que el anterior');
  ok(SN.Data.markets.every((d) => (SN.Data.marketEvents[d.id] || []).length >= 5), 'todos los mercados (también los negros) tienen sus noticias');
  run.flags.debtPaid = true; run.debt.paid = true; // sin deuda: que no se cobre sola a mitad de la prueba
  SN.Luck.today = () => null; // ni bonificaciones de la suerte
  run.gifts.limite = true; run.upgrades.limite = 3; // apuestas de hasta $25,000
  let within = true, hit = 0;
  for (let i = 0; i < 300; i++) {
    run.capital = 100000; run.position = null; run.committed = 0;
    run.form = { amount: 5000, leverage: 10 };
    SN.Trading.open(i % 2 ? 1 : -1);
    const r = SN.Trading.close();
    if (Math.abs(r.pnl) > 300 || run.capital < 100000 - 300 || run.capital > 100000 + 300) within = false;
    if (r.capped) hit++;
  }
  ok(within, 'en Salud ninguna operación gana ni pierde más de $300');
  ok(hit > 50, `con apuestas grandes se llega al tope a menudo (${hit}/300)`);
}

// 13) Deudas posteriores: plazo, pago automático y embargo como la primera; "ya no llegas" cuenta los topes
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  run.capital = 300; SN.Debt.pay(); SN.Unlocks.check(); SN.Unlocks.check();
  ok(run.debt.id === 'regalo1' && run.debt.start === 1 && run.debt.deadlineDay === 5, `el regalo vence en 5 días contando hoy (día ${run.debt.deadlineDay})`);
  let defaulted = null;
  SN.Events.on('debt:defaulted', (d) => { defaulted = d; });
  run.capital = 40;
  for (let i = 0; i < 15 && !defaulted; i++) SN.Trading.skipTurn();
  ok(defaulted && run.debt.defaulted && run.day === 6, 'si no pagas el regalo a tiempo: embargo');

  const SN2 = load();
  SN2.State.newRun();
  const r2 = SN2.State.run;
  Object.assign(r2, { capital: 2000, day: 7, turn: 1 });
  r2.debt.amount = 5000;
  ok(SN2.Debt.hopeless(), 'con el tope de Salud, $2,000 no llegan a $5,000 en dos turnos');
  r2.markets.mineria.unlocked = true;
  ok(!SN2.Debt.hopeless(), 'con un mercado de tope mayor, todavía se puede');

  const SN3 = load();
  SN3.State.newRun();
  const r3 = SN3.State.run;
  r3.capital = 300; SN3.Debt.pay(); SN3.Unlocks.check(); SN3.Unlocks.check();
  r3.capital = 500;
  let paid = null;
  SN3.Events.on('debt:paid', (d) => { paid = d; });
  for (let i = 0; i < 15 && !paid; i++) SN3.Trading.skipTurn();
  ok(paid && paid.auto && paid.debt.id === 'regalo1' && r3.capital === 350 + 60, 'si al vencer te alcanza, el regalo se cobra solo (bono mínimo: $60)');
}

// 14) RESISTENCIA: menos giros en las últimas velas
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run, def = SN.Data.markets[0];
  def.twist.chance = 0.5;
  const count = () => { let n = 0; for (let i = 0; i < 600; i++) if (SN.Trading.planTwist(def, 12, false) >= 0) n++; return n; };
  const base = count();
  run.upgrades.resistencia = 3;
  const res = count();
  ok(res < base * 0.6, `RESISTENCIA 3 quita giros (${base} -> ${res} de 600)`);
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
ok(follow > 0.55 && follow < 0.75, `seguir la pista con la apuesta por defecto suele bastar, pero el inicio es difícil (${(follow * 100).toFixed(0)}%, entre 55 y 75)`);
ok(sized > follow, 'leer la fuerza de la pista y ajustar la apuesta da aún más ventaja');

// 15) La partida entera: un bot sensato (sigue la pista, opera en el mercado abierto de mayor tope, paga en
// cuanto puede, acepta las ofertas en cuanto FUTURO.exe le deja, compra alguna mejora y nodos de la Academia).
// Al perder hace lo mismo que el juego: rompe los ahorros de Timmy (una vez por paso) o vuelve al punto de
// control. Sirve para ajustar la cadena de deudas.
function fullRun(maxDays) {
  const SN = load();
  SN.State.newRun();
  const S = SN.State, U = SN.Unlocks, T = SN.Trading;
  let run = S.run, last = -1, rewinds = 0, piggies = 0;
  const stepDay = {};
  const mark = () => { if (run.step !== last) { last = run.step; stepDay[run.step] = run.day; S.checkpoint('x'); } };
  mark();
  for (let guard = 0; guard < 20000 && U.step() && run.day <= maxDays; guard++) {
    if (SN.Debt.canPay()) SN.Debt.pay();
    while (U.check()) mark();
    mark();
    const st = U.step();
    if (!st) break;
    if (st.kind === 'item' && U.canBuyItem(st.item).ok) { U.acceptOffer(st.item); continue; }
    if (run.flags.debtPaid) run.flags.academy = true; // Bravo Fines se presenta tras la Pleyzeta
    for (const n of SN.Academy.buyable()) {
      const keep = SN.Debt.active() ? run.debt.amount : 0;
      if (run.capital - n.cost >= Math.max(keep, run.capital * 0.6)) SN.Academy.buy(n.id);
    }
    // Mejoras a crédito: cuando lo que tiene ya cubre lo que la mejora suma a la deuda (y se puede pagar a tiempo)
    for (const id of ['limite', 'analisis', 'suerte', 'resistencia']) {
      const c = SN.Upgrades.canBuy(id);
      if (c.ok && run.capital >= c.debt) SN.Upgrades.buy(id);
    }
    // ¿Se ha perdido? Cerdito (con 2 días más si era por el plazo) o vuelta al punto de control
    const late = (run.debt && run.debt.defaulted) || SN.Debt.hopeless();
    if (late || run.capital + run.committed < SN.Data.sim.bankruptcyThreshold) {
      if (run.piggy === 'ready') {
        piggies++;
        SN.Economy.add(S.piggyAmount(), 'piggy');
        run.piggy = 'broken';
        if (late) { run.debt.deadlineDay = Math.max(run.debt.deadlineDay, run.day) + 2; run.debt.defaulted = false; }
      } else {
        // Al volver, un jugador no repite exactamente lo mismo: el bot tampoco (si no, las mismas velas)
        rewinds++; S.restoreCheckpoint(); run = S.run; S.rng.s = (S.rng.s + rewinds * 7919) | 0;
      }
      continue;
    }
    // Mercado: el de mayor tope entre los abiertos con pista clara
    let best = null;
    for (const d of SN.Data.markets) {
      if (!U.isUnlocked(d.id)) continue;
      const h = SN.Market.hint(d.id);
      if (h.power && (!best || d.cap > best.d.cap || (d.cap === best.d.cap && h.power > best.h.power))) best = { d, h };
    }
    if (!best) { T.skipTurn(); continue; }
    run.selected = best.d.id;
    const p = best.h.power;
    const want = Math.min(T.maxAmount() * [0, 0.3, 0.6, 1][p], best.d.cap / ([1, 2, 2, 5][p] * 0.06));
    run.form = { amount: Math.max(SN.Data.sim.minInvestment, Math.floor(want)), leverage: [1, 2, 2, 5][p] };
    T.clampForm();
    if (!T.open(best.h.dir)) { T.skipTurn(); continue; }
    T.close();
  }
  return { done: !U.step(), day: run.day, rewinds, piggies, reached: run.step, stepDay };
}
{
  const N = 30, MAX = 140, runs = [];
  for (let i = 0; i < N; i++) runs.push(fullRun(MAX));
  const done = runs.filter((r) => r.done);
  const avg = (a, f) => a.reduce((s, r) => s + f(r), 0) / Math.max(1, a.length);
  console.log(`Partida entera (${N} bots, máximo ${MAX} días):`);
  console.log(`  la terminan: ${(done.length / N * 100).toFixed(0)}% · días de media: ${avg(done, (r) => r.day).toFixed(0)} · cerditos: ${avg(runs, (r) => r.piggies).toFixed(1)} · vueltas al punto de control: ${avg(runs, (r) => r.rewinds).toFixed(1)}`);
  const by = SN0().Data.chain.map((st, i) => `${st.id}:${avg(runs.filter((r) => r.stepDay[i] != null), (r) => r.stepDay[i]).toFixed(0)}`);
  console.log('  día medio en que empieza cada paso: ' + by.join(' '));
  ok(done.length / N >= 0.5, 'un jugador sensato puede terminar la escalera');
  ok(avg(runs, (r) => r.rewinds + r.piggies) >= 0.5, 'pero no es un paseo: alguna vez se pierde');
  ok(runs.every((r) => r.rewinds < 25), `nunca se queda atascado volviendo al mismo punto de control (máx. ${Math.max(...runs.map((r) => r.rewinds))})`);
}

// 19) La Academia de Bravo Fines: en orden, negocios que pagan cada mañana, tiburón, Plan B y letra pequeña
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run, A = SN.Academy;
  SN.Luck.today = () => null; // sin bonificaciones de la suerte
  run.capital = 100000;
  ok(!A.canBuy('limonada').ok, 'la Academia está cerrada hasta que Bravo se presenta');
  run.flags.academy = true;
  ok(!A.canBuy('chicles').ok && A.canBuy('chicles').locked, 'cada nodo necesita el anterior de su rama');
  ok(!A.canBuy('foodtruck').ok && A.canBuy('foodtruck').soon, 'los avances futuros salen como "Próximamente"');
  ok(A.buy('limonada') && A.buy('chicles') && run.capital === 100000 - 200 - 1200, 'se compran con dinero, en orden');
  ok(A.buy('limonada') === false, 'no se compra dos veces');
  let inc = null;
  SN.Events.on('academy:income', (d) => { inc = d; });
  run.debt.paid = true; run.flags.debtPaid = true;
  const c0 = run.capital;
  for (let i = 0; i < 3; i++) SN.Trading.skipTurn();
  ok(inc && inc.amount === 140 && run.capital === c0 + 140, `los negocios pagan cada mañana (+$${inc && inc.amount})`);
  // Tiburón: +5% en cada ganancia; Plan B: la primera pérdida del día, a la mitad
  A.buy('tiburon'); A.buy('planb');
  ok(A.bonus(1000) === 50 && A.bonus(-1000) === 0, 'Mentalidad de tiburón: +5% solo si ganas');
  run.planBDay = 0;
  ok(A.halve(-400) === -200 && A.halve(-400) === -400 && A.halve(300) === 300, 'Plan B: solo la primera pérdida del día, a la mitad');
  const before = SN.Unlocks.offer('tele').debt;
  A.buy('letrapeq');
  ok(SN.Unlocks.offer('tele').debt === Math.round(before * 0.9), 'leer la letra pequeña: las ofertas traen un 10% menos de deuda');
  ok(SN.Data.academy.branches.every((b) => b.nodes.some((n) => n.soon)), 'cada rama deja hueco para futuras versiones');
}

// 20) Palabras clave: dinero en dorado (con sus 7 en arcoíris), "siete", suerte en verde y FUTURO.exe cifrado
{
  const SN = load();
  SN.State.newRun();
  const K = SN.KW, h = (t) => K.html(t);
  ok(/<span class="kw kw-gold">\$250<\/span>/.test(h('Debes $250 hoy.')), 'una cantidad sale en dorado');
  ok(/kw-gold">\$1,<span class="kw-7 in"><i style="--i:0">7<\/i><\/span>50<\/span>/.test(h('Te faltan $1,750.')), 'el 7 de una cantidad sale en arcoíris dentro del dorado');
  ok(h('$60.').endsWith('</span>.'), 'el punto final no forma parte de la cantidad');
  ok(/kw-7/.test(h('Día 17')) && /kw-7/.test(h('Siete pavos')) && /kw-gold">pavos/.test(h('Siete pavos')), 'cada 7 y la palabra "siete" en arcoíris; "pavos" es dinero');
  ok(/kw-luck/.test(h('¡Qué suerte!')) && /kw-luck/.test(h('Estás afortunada')) && !/kw-luck/.test(h('suertes')), 'la suerte sale en verde');
  const gift1 = h('Toma un regalo de bienvenida: ya puedes comprar LÍMITE. Y un multiplicador ×10.');
  ok(/kw-gift/.test(gift1) && /kw-up">(<i[^>]*>.<\/i>){6}/.test(gift1) && /kw-up">.*×/.test(gift1), 'regalo en magenta; LÍMITE, multiplicador y ×10 como mejora');
  ok(/kw-risk/.test(h('Tienes una deuda con plazo')) && /kw-risk/.test(h('¡Liquidado!')) && /kw-gift/.test(h('Se abre el Mercado Dorado')), 'deuda, plazo y liquidado en peligro; el Mercado Dorado como regalo');
  ok(/kw-act/.test(h('Pulsa COBRAR ya')) && !/kw-act/.test(h('vas a cobrar mañana')), 'las acciones solo cuentan en mayúsculas, como el botón');
  ok(/kw-up/.test(h('apuesta x2')) && !/kw-up/.test(h('max2 y xbox')), 'x2 es un multiplicador; dentro de una palabra, no');
  ok(!/kw-gift|kw-up/.test(K.html('Regalo: Límite', { terms: false })), 'en la tienda y las mejoras solo se marca dinero, 7 y suerte');
  ok(!/kw/.test(h('EL DIARIO DEL FUTURO')) && !/kw/.test(h('Nada que pintar')), 'sin palabras clave, el texto no cambia');
  ok(h('<b>$5</b>').startsWith('&lt;b&gt;'), 'el texto se escapa (no se cuela HTML)');
  const brand = h('FUTURO.exe ha encontrado algo');
  ok(brand.includes('cx-brand') && !brand.includes('FUTURO') && brand.includes(SN.Data.cipher.alphabet.F), 'FUTURO.exe sale en el idioma secreto');
  ['F', 'U', 'T', 'R', 'O'].forEach((l) => { SN.Cipher.state().known[l] = true; });
  ok(SN.Cipher.brandText() === 'FUTURO.exe' && SN.Cipher.brandify('Abre FUTURO.EXE') === 'Abre FUTURO.EXE', 'con sus 5 letras descubiertas, FUTURO se lee');
  ok(SN.Cipher.clue('acerca') && SN.Cipher.clue('acerca').letter === 'F' && SN.Cipher.total() === 16, 'la F tiene su pista ("Acerca de"): 16 letras');
}

// 21) Números rojos: lo que se puede comprar y todavía no has visto; la oferta salta sola al quedar pendiente
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run, W = SN.ShopWatch;
  run.capital = 45;
  ok(W.badge('shop') === 1 && W.badge('upgrades') === 0, 'con $45 se puede comprar la taza: un número rojo en la Tienda');
  W.markSeen('shop');
  ok(W.badge('shop') === 0, 'al abrir la Tienda, lo visto deja de contar');
  run.capital = 130;
  ok(W.badge('shop') === 1, 'algo nuevo que ya te alcanza vuelve a contar');
  let news = null, prompt = null;
  SN.Events.on('shop:new', (d) => { news = d; });
  SN.Events.on('offer:prompt', (d) => { prompt = d; });
  W.afterTurn();
  ok(news && news.items.some((x) => x.key === 'shop:planta'), 'y se avisa (una vez)');
  news = null; W.afterTurn();
  ok(!news, 'el mismo aviso no se repite');
  run.capital = 500; SN.Debt.pay(); while (SN.Unlocks.check());
  SN.Debt.pay(); while (SN.Unlocks.check());
  W.afterTurn();
  ok(prompt && prompt.item.id === 'tele' && prompt.why === 'new', 'pagada la deuda anterior, la oferta de la tele salta sola');
  prompt = null; W.afterTurn();
  ok(prompt && prompt.why === 'insist', 'es el siguiente paso de la historia: vuelve a salir cada turno hasta que la aceptas');
  SN.Unlocks.acceptOffer('tele'); prompt = null; W.afterTurn();
  ok(!prompt, 'aceptada, ya no sale');
}

// 22) Noticias que se entienden: cada noticia de mercado tiene su foto propia (que existe), su texto de
// primera plana y palabras sencillas; y salen los presidentes de parodia
{
  const SN = load();
  const all = Object.entries(SN.Data.marketEvents).flatMap(([m, list]) => list.map((e) => Object.assign({ market: m }, e)));
  const art = fs.readFileSync(path.join(ROOT, 'js/render/news-art.js'), 'utf8');
  const scenes = new Set([...art.matchAll(/\n    (\w+)\(g\) \{/g)].map((m) => m[1]));
  ok(all.every((e) => e.more && e.more.length > 10), 'todas las noticias de mercado tienen su "más información"');
  ok(all.every((e) => scenes.has(e.art)), `todas las fotos existen (${all.filter((e) => !scenes.has(e.art)).map((e) => e.art).join(', ') || 'sí'})`);
  ok(new Set(all.map((e) => e.art)).size === all.length, `cada noticia tiene su propia foto (${new Set(all.map((e) => e.art)).size} de ${all.length})`);
  const hard = ['auditoría', 'financiación', 'censo', 'yacimiento', 'colectiva', 'suministro', 'reforma', 'patente', 'ensayos', 'filtración', 'escasez', 'redada', 'acontecimientos', 'alcaldía', 'fármaco', 'prometedor', 'investigador', 'encuestados', 'tesis', 'doctorado', 'autoridades'];
  const texts = all.flatMap((e) => [e.title, e.text, e.more, e.yesText, e.noText]).concat(SN.Data.story.fillerNews.flatMap((n) => [n.title, n.text, n.more]))
    .concat(Object.values(SN.Data.story.darkNews).flat()).filter(Boolean).map((t) => t.toLowerCase());
  const found = hard.filter((w) => texts.some((t) => t.includes(w)));
  ok(!found.length, `las noticias no usan palabras difíciles (${found.join(', ') || 'ninguna'})`);
  const pres = all.filter((e) => /Trompa|Patín/.test(e.title));
  ok(pres.length >= 5 && !all.some((e) => /Trump|Putin/i.test(e.title + e.text + e.more)), `noticias de Trompa y Patín, con nombres de parodia (${pres.length})`);
  ok(SN.Data.story.fillerNews.every((n) => scenes.has(n.art)) && SN.Data.luck.events.every((e) => scenes.has(e.art) && e.more), 'las de la ciudad y las de la suerte también tienen foto');
}

// 16) Puntos de control: nunca en un momento sin dinero para apostar
{
  const SN = load();
  SN.State.newRun();
  const run = SN.State.run;
  SN.State.checkpoint('inicio');
  run.capital = 250;
  SN.Debt.pay(); // te quedarías con $0... pero llega el bono de la app
  ok(run.capital >= SN.Data.sim.bankruptcyThreshold, `pagar justo lo que debes ya no te deja a cero: el bono de la app (${run.capital})`);
  run.capital = 3;
  ok(SN.State.checkpoint('sin dinero') === false && run.checkpoint.label === 'inicio' && run.checkpoint.capital === 100,
    'sin dinero para apostar no se guarda un punto de control (sigue el anterior)');
}
function SN0() { return load(); }

// 17) Idioma secreto: traducción progresiva, tildes, se guarda en el perfil y todo texto cifrado tiene pistas
{
  const SN = load();
  SN.State.newRun();
  const C = SN.Cipher, X = SN.Data.cipher;
  ok(C.text('No le creas') === 'ИФ БД ЮЛДЖЯ', `sin pistas todo sale en cirílico (${C.text('No le creas')})`);
  let found = null;
  SN.Events.on('cipher:found', (d) => { found = d; });
  const clueA = X.clues.find((c) => c.letter === 'A');
  ok(C.discover(clueA.id) && found && found.letter === 'A' && found.glyph === 'Ж' && found.isNew, 'encontrar una pista avisa con su letra y su símbolo');
  ok(C.text('No le creas') === 'ИФ БД ЮЛДAЯ', 'la letra encontrada se traduce en todos los textos');
  ok(C.html('NO LE CREAS', 'A').includes('<span class="cx-k cx-new">A</span>') && C.html('NO').includes('<span class="cx">И</span>'), 'en HTML se marcan las letras (y la recién encontrada)');
  ok(C.discover(clueA.id) === null, 'una pista solo cuenta una vez');
  ok(C.text('Señor, está aquí') === C.text('SENOR, ESTA AQUI'), 'las tildes y la Ñ no cambian el cifrado');
  ok(JSON.parse(SN.__store['saldonegro.profile.v1']).cipher.known.A, 'lo descubierto se guarda en el perfil');
  SN.State.newRun();
  ok(C.knows('A'), 'y sigue ahí en una partida nueva');
  const letters = new Set(X.clues.map((c) => c.letter));
  const texts = [X.contact.name, ...X.messages.filter((m) => m.text).map((m) => m.text), ...X.news.map((n) => n.text), ...Object.values(X.hidden)];
  const bad = texts.filter((t) => C.letters(t).some((ch) => !letters.has(ch)));
  ok(!bad.length, 'todo texto cifrado usa solo letras que tienen pista ' + bad.join(' | '));
  ok(letters.size === Object.keys(X.alphabet).length && Object.keys(X.alphabet).every((l) => letters.has(l)), 'cada letra del alfabeto tiene su pista');
  ok(new Set(Object.values(X.alphabet)).size === Object.keys(X.alphabet).length, 'cada letra tiene un símbolo distinto');
  const w = C.wildcard(SN.State.rng);
  ok(w && w.letter !== 'A' && C.knows(w.letter), 'el comodín descubre una letra que faltaba');
  for (const c of X.clues) C.discover(c.id);
  ok(C.complete() && C.text('El de la capa miente') === 'EL DE LA CAPA MIENTE' && C.wildcard(SN.State.rng) === null, 'con las 15 pistas se lee todo');
}

// 18) Días de la suerte: los que llevan un 7; crecen los mercados, bonificación, estrella y ruleta
{
  const SN = load();
  const L = SN.Luck;
  ok(L.sevens(7) === 1 && L.sevens(17) === 1 && L.sevens(77) === 2 && L.sevens(777) === 3 && L.sevens(8) === 0, 'cuenta los sietes del día');
  ok([7, 17, 27, 70, 79].every((d) => L.isLucky(d)) && ![1, 6, 8, 16, 80].some((d) => L.isLucky(d)), 'días de la suerte: los que llevan un 7');
  SN.State.newRun();
  const run = SN.State.run;
  run.debt.paid = true; run.flags.debtPaid = true;
  for (let i = 0; i < 18; i++) SN.Trading.skipTurn();
  ok(run.day === 7 && L.today() && L.k() === 1 && run.luck.events.length === 1, 'el día 7 es de la suerte, con un evento especial');
  for (let i = 0; i < 3; i++) SN.Trading.skipTurn();
  ok(run.day === 8 && !L.today(), 'el día 8 ya no');
  const s0 = SN.State.rng.s;
  const a = JSON.stringify(L.roll(77)); SN.State.rng.s = s0;
  const b = JSON.stringify(L.roll(77));
  ok(a === b, 'el sorteo del día sale igual con el mismo generador (recargar no lo cambia)');
  run.day = 77;
  const l2 = L.roll(77);
  ok(l2.k === 2 && l2.events.length >= 2 && l2.events.some((e) => SN.Data.luck.big.includes(e)), 'el 77 vale doble: más eventos y uno grande');
  run.day = 777;
  ok(L.roll(777).events.length === 5, 'el 777: todos los eventos');
  // Crecimiento: 12 velas desde el precio de referencia, con y sin suerte
  const growth = (lucky) => {
    let sum = 0;
    const m = run.markets.salud;
    for (let i = 0; i < 700; i++) {
      run.day = 17; run.luck = null;
      if (lucky) L.roll(17);
      m.price = m.anchor; m.events = [];
      const p0 = m.price;
      for (let k = 0; k < 12; k++) SN.Market.step('salud', {});
      sum += Math.log(m.price / p0);
    }
    return sum / 700;
  };
  const g0 = growth(false), g1 = growth(true);
  console.log(`  rendimiento medio de 12 velas: normal ${(g0 * 100).toFixed(2)}% · día de la suerte ${(g1 * 100).toFixed(2)}%`);
  ok(g1 > g0 + 0.015, 'los días de la suerte los mercados crecen');
  run.day = 17; run.luck = null; L.roll(17);
  run.luck.star = 'salud';
  ok(L.starMul('salud') === 1.77 && L.starMul('tecno') === 1, 'la Estrella de la Suerte multiplica un solo mercado');
  ok(L.bonus(100) === 7 && L.bonus(-50) === 0, 'bonificación del 7% por siete en cada operación ganadora');
  run.luck.events = ['ruleta']; run.luck.spun = false;
  const spin = L.spin();
  ok(spin && spin.text && L.spin() === null, 'la ruleta da un premio y solo gira una vez por día');
}

console.log(`\n${passed} correctas, ${failed} fallos`);
process.exit(failed ? 1 : 0);
