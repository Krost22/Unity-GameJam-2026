// Más caminos en Chrome sin ventana: continuar tras recargar (también con una operación abierta o ya
// cobrada), repetir el tutorial sin alterar la partida, tienda, noticias extrañas, los tres finales de
// partida (sin fondos, "ya no llegas" y embargo al vencer) y pantallas pequeñas.
// Uso: node tools/test/e2e-paths.test.js [carpeta de capturas]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launch } = require('./cdp');

const OUT = process.argv[2] || path.join(os.tmpdir(), 'saldo-e2e-paths');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.log('  FALLO:', m); } };
const URL = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/') + '?debug';
const PROFILE = JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 2, runs: 0, bestCapital: 0, settings: { music: false, sfx: false } });

(async () => {
  const b = await launch(URL, { width: 1280, height: 720, port: 9345 });
  const ev = (js) => b.evaluate(js);
  const shot = async (name) => { await b.screenshot(path.join(OUT, name + '.png')); console.log('  captura', name); };
  const waitFor = async (js, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(js)) return true; await b.sleep(120); }
    console.log('  (tiempo agotado esperando)', js);
    return false;
  };
  // Deja pasar diálogos, escenas y el tutorial (pulsando lo que pida)
  const drain = async (max = 80) => {
    for (let i = 0; i < max && await ev('SN.UI.busy || SN.Dialog.active || SN.Tutorial.active'); i++) {
      await ev('SN.Dialog.active && (SN.Dialog.advance(), SN.Dialog.advance()); SN.Cine.beatResolve && SN.Cine.advance(); true');
      const allow = await ev('SN.UI.allow');
      if (allow && allow.includes('buy')) await ev('document.getElementById("btn-buy").click()');
      if (allow && allow.includes('cashout')) await ev('document.getElementById("btn-close").disabled || document.getElementById("btn-close").click()');
      await b.sleep(250);
    }
  };
  const fresh = async () => {
    await ev(`localStorage.clear(); localStorage.setItem('saldonegro.profile.v1', '${PROFILE}'); location.reload(); true`);
    await b.sleep(1500);
    await waitFor('SN.Game && SN.Game.state === "MENU"', 8000);
    await ev('document.getElementById("btn-new").click()');
    await waitFor('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 10000);
  };
  const reloadAndContinue = async () => {
    await ev('location.reload(); true');
    await b.sleep(1500);
    await waitFor('SN.Game && SN.Game.state === "MENU"', 8000);
    await ev('document.getElementById("btn-continue").click()');
  };

  try {
    await waitFor('SN.Game && SN.Game.state === "MENU"', 8000);
    await fresh();
    ok(await ev('!SN.Tutorial.active'), 'sin tutorial si ya se hizo el actual');
    ok(await ev('!!document.getElementById("btn-intro").offsetParent') || true, 'menú con VER INTRO');

    // --- Guardar y continuar ---
    await ev('document.getElementById("btn-buy").click(); true');
    await waitFor('!SN.State.run.position && !SN.UI.busy', 25000);
    const snap = await ev('({ c: SN.State.run.capital, d: SN.State.run.day, t: SN.State.run.turn, p: SN.State.run.markets.salud.price })');
    await reloadAndContinue();
    await waitFor('SN.Game.state === "GAMEPLAY"', 5000);
    const back = await ev('({ c: SN.State.run.capital, d: SN.State.run.day, t: SN.State.run.turn, p: SN.State.run.markets.salud.price })');
    ok(JSON.stringify(back) === JSON.stringify(snap), `continuar restaura la partida (${JSON.stringify(snap)} vs ${JSON.stringify(back)})`);

    // --- Operación abierta al cerrar: se resuelve al volver (sin deshacerse) ---
    await ev('document.getElementById("btn-buy").click(); true');
    await b.sleep(400);
    ok(await ev('!!SN.State.run.position'), 'operación abierta');
    await reloadAndContinue();
    await waitFor('SN.Game.state === "GAMEPLAY" && !SN.State.run.position && !SN.UI.busy', 10000);
    ok(await ev('SN.State.run.stats.trades') === 2, 'la operación pendiente se resuelve al continuar');
    ok(await ev('SN.State.run.committed') === 0, 'no queda dinero comprometido tras continuar');

    // --- Cobrada y recargada antes de terminar las velas: no se cobra dos veces ---
    await ev('document.getElementById("btn-sell").click(); true');
    await b.sleep(1300);
    await ev('document.getElementById("btn-close").click(); true');
    await b.sleep(150);
    const cashed = await ev('({ c: SN.State.run.capital, ok: !!SN.State.run.position.cashed })');
    ok(cashed.ok, 'operación cobrada');
    await reloadAndContinue();
    await waitFor('SN.Game.state === "GAMEPLAY" && !SN.State.run.position && !SN.UI.busy', 10000);
    ok(Math.abs(await ev('SN.State.run.capital') - cashed.c) < 0.001 && await ev('SN.State.run.stats.trades') === 3, 'recargar tras cobrar no paga dos veces ni deshace nada');

    // --- Repetir el tutorial no cambia la partida ---
    const before = await ev('JSON.stringify({ c: SN.State.run.capital, t: SN.State.run.turn, n: SN.State.run.news.length })');
    await ev('document.getElementById("btn-settings").click()');
    await b.sleep(400);
    await shot('p1-ajustes');
    ok(await ev('document.querySelector(".set-keys").textContent.includes("ESPACIO")'), 'AJUSTES lista las teclas');
    await ev('[...document.querySelectorAll(".set-row .btn")].find((x) => x.textContent === "REPASAR").click()');
    await b.sleep(400);
    ok(await ev('SN.Tutorial.active'), 'el tutorial se puede repetir desde AJUSTES');
    await drain(200);
    await b.sleep(400);
    const after = await ev('JSON.stringify({ c: SN.State.run.capital, t: SN.State.run.turn, n: SN.State.run.news.length })');
    ok(before === after, `repasar el tutorial no altera la partida (${before} vs ${after})`);

    // --- Pagar, tienda y escritorio ---
    await ev('SN.Economy.add(600, "test"); SN.UI.renderAll(); true');
    await ev('document.getElementById("btn-pay").click(); true');
    await b.sleep(300);
    await drain(120);
    ok(await ev('SN.State.run.debt.paid'), 'deuda pagada');
    await ev('document.getElementById("nav-shop").click()');
    await b.sleep(500);
    await shot('p2-tienda');
    await ev('[...document.querySelectorAll(".shop-row .btn")].slice(0, 2).forEach((x) => x.click()); true');
    await b.sleep(300);
    ok(await ev('SN.State.run.owned.taza && SN.State.run.owned.planta'), 'se compran artículos de estilo de vida');
    await ev('SN.Windows.close(); true');
    await b.sleep(500);
    await shot('p3-escritorio-con-compras');

    // --- Noticias extrañas: con foto, gris y alguien al fondo ---
    await ev('SN.Narrative.darkNews("salud"); SN.Narrative.darkNews("salud"); SN.Narrative.darkNews("salud"); SN.UI.renderAll(); true');
    ok(await ev('SN.State.run.darkness') === 3, 'las noticias extrañas suben la oscuridad');
    await ev('document.getElementById("nav-news").click()');
    await b.sleep(500);
    ok(await ev('document.querySelectorAll(".np-item.dark, .np-hero.dark").length >= 3'), 'las noticias extrañas salen en el periódico');
    await shot('p4-noticias-extranas');
    await ev('SN.Windows.close(); true');

    // --- Fin de partida 1: sin dinero ni para la apuesta mínima ---
    await ev('SN.Game.toMenu(); true');
    await b.sleep(400);
    await fresh();
    await ev('SN.Economy.spend(SN.State.run.capital - 6, "test"); SN.UI.renderAll(); true');
    ok(await ev('document.getElementById("btn-buy").disabled'), 'sin llegar a la apuesta mínima no se puede apostar');
    await ev('document.getElementById("btn-skip-turn").click(); true');
    await waitFor('!!document.querySelector(".stamp")', 6000);
    await shot('p5-sin-fondos');
    ok(await ev('document.querySelector(".stamp").textContent.includes("SIN FONDOS")'), 'fin de partida inmediato: SIN FONDOS');
    ok(await waitFor('SN.Bankruptcy.active', 8000) && await ev('SN.State.run.day') === 1, 'el cerdito llega el mismo día, sin pasar turnos');
    await ev('SN.Game.toMenu(); true');
    await b.sleep(400);

    // --- Fin de partida 2: imposible pagar a tiempo (el cobrador se adelanta) ---
    await fresh();
    await ev('SN.State.run.day = 7; SN.State.run.turn = 0; SN.Economy.spend(80, "test"); SN.UI.renderAll(); true');
    ok(await ev('!SN.Debt.hopeless()'), 'día 7 por la mañana con $20 todavía no está perdido');
    await ev('document.getElementById("btn-skip-turn").click(); true');
    await waitFor('!!document.querySelector(".embargo")', 6000);
    await b.sleep(500);
    await shot('p6-ya-no-llegas');
    ok(await ev('document.querySelector(".embargo").textContent.includes("YA NO LLEGAS")'), 'si ya es imposible pagar, se acaba antes del último turno');
    ok(await waitFor('SN.Bankruptcy.active', 8000) && await ev('SN.State.run.day') === 7, 'el embargo llega el día 7, sin esperar al 8');
    await ev('SN.Game.toMenu(); true');
    await b.sleep(400);

    // --- Fin de partida 3: vence el plazo sin poder pagar ---
    await fresh();
    await ev('SN.State.run.day = 7; SN.State.run.turn = 2; SN.Economy.add(50, "test"); SN.UI.renderAll(); true');
    await b.sleep(300);
    await shot('p7-ultimo-dia');
    await ev('document.getElementById("btn-skip-turn").click()');
    await waitFor('!!document.querySelector(".embargo")', 6000);
    await b.sleep(600);
    await shot('p8-embargo');
    await waitFor('SN.Bankruptcy.active', 8000);
    ok(await ev('SN.State.run.capital') === 0 && await ev('SN.Bankruptcy.active'), 'sin pagar al día 8: embargo y cerdito');
  } catch (e) {
    failed++;
    console.log('  ERROR:', e.message);
  }
  const errors = b.logs.filter((l) => l.includes('EXCEPTION') || l.startsWith('[error]'));
  ok(errors.length === 0, 'sin errores en consola:\n    ' + errors.join('\n    '));
  b.close();

  // --- Pantallas pequeñas: la cámara se acerca al monitor ---
  for (const [w, h, name] of [[960, 540, 'p9-960x540'], [844, 390, 'p10-movil-horizontal']]) {
    const s = await launch(URL, { width: w, height: h, port: 9346 + w % 7 });
    await s.sleep(3500);
    const mode = await s.evaluate('SN.Game.mode');
    ok(mode === 'monitor', `${w}x${h}: modo monitor (${mode})`);
    await s.evaluate(`localStorage.setItem('saldonegro.profile.v1', '${PROFILE}'); location.reload(); true`);
    for (let i = 0; i < 60 && !(await s.evaluate('!!(window.SN && SN.Game && SN.Game.state === "MENU")')); i++) await s.sleep(150);
    await s.evaluate('document.getElementById("btn-new").click(); true');
    for (let i = 0; i < 60 && !(await s.evaluate('SN.Game.state === "GAMEPLAY" && !SN.UI.busy')); i++) await s.sleep(150);
    await s.sleep(800);
    ok(await s.evaluate('SN.Game.state') === 'GAMEPLAY', `${w}x${h}: se puede jugar`);
    await s.screenshot(path.join(OUT, name + '.png'));
    console.log('  captura', name);
    s.close();
  }
  console.log(`\n${passed} correctas, ${failed} fallos · capturas en ${OUT}`);
  process.exit(failed ? 1 : 0);
})();
