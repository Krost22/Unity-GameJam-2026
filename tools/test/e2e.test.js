// Prueba de extremo a extremo en Chrome sin ventana: intro, tutorial (con clics REALES de ratón),
// operaciones con COBRAR, cámara lenta, mejoras, periódico, pago de la deuda, progresión y bancarrota.
// Guarda capturas en la carpeta indicada.
// Uso: node tools/test/e2e.test.js [carpeta de capturas]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launch } = require('./cdp');

const OUT = process.argv[2] || path.join(os.tmpdir(), 'saldo-e2e');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.log('  FALLO:', m); } };

(async () => {
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/') + '?debug';
  const b = await launch(url, { width: 1280, height: 720, port: 9343 });
  const ev = (js) => b.evaluate(js);
  const shot = async (name) => { await b.screenshot(path.join(OUT, name + '.png')); console.log('  captura', name); };
  const waitFor = async (js, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(js)) return true; await b.sleep(120); }
    console.log('  (tiempo agotado esperando)', js);
    return false;
  };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  // Clic REAL del ratón sobre un elemento (comprueba que nada lo tapa)
  const mouse = async (sel) => {
    const p = await center(sel);
    if (!p) { ok(false, `no existe ${sel}`); return false; }
    const top = await ev(`(() => { const e = document.elementFromPoint(${p.x}, ${p.y}); const t = document.querySelector(${JSON.stringify(sel)}); return !!e && (e === t || t.contains(e)); })()`);
    ok(top, `nada tapa ${sel} al hacer clic`);
    await b.click(p.x, p.y);
    return true;
  };
  // Avanza diálogos y subtítulos abiertos (clic en el escritorio, lejos del texto)
  const advance = async () => { if (await ev('SN.Dialog.active || !!SN.Cine.say_')) await b.click(90, 640); };

  // Cuarto de Tommy: mantener ESPACIO mientras duerme, soltar cuando se mueve; al final, clic en el cerdito
  const playSneak = async () => {
    const t0 = Date.now();
    let holding = false;
    while (Date.now() - t0 < 45000) {
      const o = JSON.parse(await ev('JSON.stringify({ st: SN.Sneak.tommy.st, s: SN.Sneak.state })'));
      if (o.s !== 'walk') break;
      const want = o.st === 'sleep';
      if (want && !holding) { await b.cdp('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' }); holding = true; }
      if (!want && holding) { await b.cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' }); holding = false; }
      await b.sleep(50);
    }
    if (holding) await b.cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
    const reached = await ev('SN.Sneak.state') === 'reach';
    await b.click(640, 300);
    return reached;
  };
  const breakPig = async () => {
    await waitFor('SN.Bankruptcy.pig && SN.Bankruptcy.pig.state === "idle"', 12000);
    const r = await ev('(() => { const r = document.getElementById("screen-canvas").getBoundingClientRect(); return { x: r.left + r.width * 210 / 420, y: r.top + r.height * 112 / 236 }; })()');
    for (let i = 0; i < 5; i++) { await b.click(r.x + (i - 2) * 6, r.y + (i % 2) * 5); await b.sleep(250); }
    return waitFor('!!document.getElementById("bk-continue")', 6000);
  };

  try {
    await waitFor('SN.Game && SN.Game.state === "MENU"', 8000);
    ok(await ev('SN.Game.state') === 'MENU', 'arranca en el menú');
    ok(await ev('!document.getElementById("btn-continue").offsetParent'), 'sin partida guardada no aparece CONTINUAR');

    // --- Intro ---
    await mouse('#btn-new');
    await b.sleep(2600);
    ok(await ev('SN.Game.state') === 'INTRO', 'empieza la intro');
    await shot('01-intro-tienda');
    await waitFor('SN.Cine.shot && SN.Cine.shot.type === "face"', 15000);
    await b.sleep(500);
    await shot('02-intro-cara-feliz');
    await waitFor('SN.Cine.screenMode === "hood"', 25000);
    await b.sleep(2000);
    await shot('03-intro-encapuchado');
    for (let i = 0; i < 40 && await ev('SN.Game.state') === 'INTRO'; i++) { await advance(); await b.sleep(400); }
    ok(await ev('SN.Game.state') === 'TUTORIAL', 'tras la intro empieza el tutorial');

    // --- Tutorial, solo con el ratón ---
    let sawCone = false, sawBuy = false, sawCash = false, sawDrama = false;
    for (let i = 0; i < 300 && await ev('SN.Tutorial.active'); i++) {
      const st = await ev('({ allow: SN.UI.allow, spot: SN.UI.spotSel, dlg: SN.Dialog.active, drama: SN.Drama.active })');
      if (st.spot === '#chart-wrap' && !sawCone) { sawCone = true; await b.sleep(700); await shot('04-tutorial-pista'); }
      if (st.drama && !sawDrama) { sawDrama = true; await b.sleep(300); await shot('07-tutorial-susto'); }
      if (st.dlg) { await b.sleep(200); await advance(); await b.sleep(120); continue; }
      if (st.allow && st.allow.includes('buy')) {
        if (!sawBuy) { sawBuy = true; await shot('05-tutorial-sube'); }
        await mouse('#btn-buy');
        await b.sleep(300);
        continue;
      }
      if (st.allow && st.allow.includes('cashout')) {
        if (!sawCash) { sawCash = true; await b.sleep(300); await shot('06-tutorial-cobrar'); }
        await mouse('#btn-close');
        await b.sleep(300);
        continue;
      }
      await b.sleep(150);
    }
    ok(sawCone && sawBuy && sawCash, 'el tutorial enseña la pista, SUBE y COBRAR');
    ok(sawDrama, 'el tutorial enseña el susto de las últimas velas (cámara lenta)');
    ok(!await ev('SN.Tutorial.active') && await ev('SN.Game.state') === 'GAMEPLAY', 'el tutorial termina');
    ok(await ev('SN.State.run.capital') > 100, 'cobrar en el tutorial deja ganancias');
    ok(await ev('SN.State.run.turn') === 1, 'la operación del tutorial consume un turno');
    ok(await ev('SN.State.profile.tutorialDone && SN.State.profile.tutorialV === SN.Tutorial.VERSION'), 'tutorial marcado como hecho');
    await waitFor('!SN.UI.busy', 8000);
    await shot('08-juego');

    // --- Operaciones: una hasta el final y otra cobrando a mitad ---
    for (let n = 0; n < 2; n++) {
      await waitFor('!SN.UI.busy && !SN.State.run.position', 20000);
      await ev('SN.Data.markets[0].twist.chance = 0; true');
      const before = await ev('SN.State.run.capital');
      const tradesBefore = await ev('SN.State.run.stats.trades');
      await mouse('.quick button[data-frac="0.5"]');
      await mouse(n ? '#btn-sell' : '#btn-buy');
      await b.sleep(250);
      ok(await ev('!!SN.State.run.position') && await ev('SN.State.run.committed') > 0, 'al operar el dinero queda comprometido');
      ok(await ev('Math.abs(SN.State.run.committed - SN.State.run.position.amount) < 0.001'), 'lo comprometido es exactamente la apuesta');
      if (n === 1) {
        await b.sleep(1300);
        await mouse('#btn-close');
        await b.sleep(250);
        ok(await ev('SN.State.run.position.cashed && SN.State.run.committed === 0'), 'COBRAR paga al instante');
        await shot('10-cobrado');
      } else { await b.sleep(1600); await shot('09-operando'); }
      await waitFor('!SN.State.run.position', 30000);
      const after = await ev('SN.State.run.capital');
      // En dólares enteros una operación casi plana puede quedar en $0: lo que importa es que se liquide
      ok(await ev('SN.State.run.stats.trades') === tradesBefore + 1 && Number.isInteger(after), `la operación ${n + 1} se liquida en dólares enteros (${before} -> ${after})`);
      for (let i = 0; i < 30 && await ev('SN.UI.busy'); i++) { await advance(); await b.sleep(250); }
    }

    // --- Regresión: un doble clic en SUBE no cobra sin querer ---
    await waitFor('!SN.UI.busy && !SN.State.run.position', 20000);
    {
      const p = await center('#btn-buy');
      await b.click(p.x, p.y);
      await b.sleep(80);
      await b.click(p.x, p.y);
      await b.sleep(150);
      ok(await ev('!!SN.State.run.position && !SN.State.run.position.cashed'), 'un doble clic en SUBE no cobra la operación al instante');
      await waitFor('!SN.State.run.position && !SN.UI.busy', 30000);
    }

    // --- Cámara lenta: giro forzado en las últimas velas ---
    await waitFor('!SN.UI.busy && !SN.State.run.position', 20000);
    await ev('SN.Economy.add(60, "test"); SN.Data.markets[0].twist.chance = 1; SN.UI.renderAll(); true');
    await mouse('#btn-buy');
    ok(await waitFor('SN.Drama.active', 20000), 'un giro en las últimas velas activa la cámara lenta');
    await b.sleep(400);
    ok(await ev('SN.Drama.stage !== "crawl" || SN.Game.timeScale < 0.6'), 'el tiempo se frena');
    await b.sleep(900);
    ok(await ev('SN.Game.focus.k > 0.3 && SN.Chart.zoom > 0.3'), 'la cámara y la gráfica hacen zoom');
    await shot('11-camara-lenta');
    await waitFor('SN.Drama.stage === "after"', 6000);
    await shot('12-golpe');
    await waitFor('!SN.State.run.position && !SN.UI.busy', 20000);
    ok(await ev('SN.Game.timeScale === 1 && SN.Game.focus.k === 0 && !SN.Drama.active'), 'todo vuelve a la normalidad tras el golpe');
    await ev('SN.Data.markets[0].twist.chance = 0.26; true');

    // --- Mejoras ---
    await mouse('#nav-upgrades');
    await b.sleep(500);
    await shot('13-mejoras');
    const lvBefore = await ev('SN.Upgrades.level("suerte")');
    await mouse('.up-row .btn');
    await b.sleep(400);
    ok(await ev('SN.Upgrades.level("suerte")') === lvBefore + 1, 'se compra la mejora de Suerte');
    await mouse('.win-x');
    await b.sleep(300);

    // --- Periódico ---
    await ev('SN.Market.addEvent(SN.State.run.markets.salud, SN.Data.marketEvents.salud[0]); SN.UI.renderAll(); true');
    await b.sleep(300);
    await mouse('#events');
    await b.sleep(500);
    ok(await ev('SN.Windows.current') === 'news', 'clic en la noticia de la gráfica abre el periódico');
    ok(await ev('!!document.querySelector(".np-mast") && document.querySelectorAll(".win canvas.photo").length > 0'), 'el periódico tiene portada y fotos');
    await shot('14-periodico');
    await b.key('Escape');
    await b.sleep(300);
    ok(await ev('SN.Windows.current === null'), 'ESC cierra la ventana');

    // --- Pagar la deuda ---
    await ev('SN.Economy.add(400, "test"); SN.UI.renderAll(); true');
    await b.sleep(400);
    ok(await ev('!document.getElementById("btn-pay").classList.contains("hidden")'), 'aparece el botón PAGAR DEUDA');
    await shot('15-pagar-deuda');
    await mouse('#btn-pay');
    let sawStamp = false, sawHood = false;
    for (let i = 0; i < 120 && await ev('SN.UI.busy'); i++) {
      if (!sawStamp && await ev('!!document.querySelector(".stamp")')) { sawStamp = true; await b.sleep(400); await shot('16-deuda-saldada'); }
      if (!sawHood && await ev('!!SN.Narrative.hood && SN.Dialog.active')) { sawHood = true; await b.sleep(800); await shot('17-encapuchado-vuelve'); }
      await ev('SN.Cine.beatResolve && SN.Cine.advance(); true');
      await advance();
      await b.sleep(300);
    }
    ok(await ev('SN.State.run.debt.paid'), 'deuda pagada');
    ok(await ev('SN.Trading.leverageAvailable(10)'), 'tras pagar se desbloquea x10');
    ok(await ev('SN.Unlocks.currentGoal().amount') === 1000, 'nuevo objetivo: $1,000');
    await b.sleep(500);
    await shot('18-tras-pagar');

    // --- Meta $1,000: desbloquea Tecnología ---
    await ev('SN.Economy.add(1200, "test"); true');
    await waitFor('!SN.UI.busy', 10000);
    await mouse('#btn-skip-turn');
    for (let i = 0; i < 80 && await ev('SN.UI.busy'); i++) { await advance(); await b.sleep(300); }
    ok(await ev('SN.Unlocks.isUnlocked("tecno")'), 'la meta de $1,000 desbloquea Tecnología');
    await mouse('.mcard[data-id="tecno"]');
    await b.sleep(700);
    ok(await ev('SN.State.run.selected') === 'tecno', 'se cambia de mercado con un clic');
    await shot('19-tecnologia');

    // --- Sin dinero: el cerdito de Tommy es una vida extra ---
    const cp = await ev('SN.State.run.checkpoint.capital');
    await ev('SN.Economy.spend(SN.State.run.capital - 4, "test"); SN.UI.setBusy(true); SN.Game.afterTurn(null); true');
    await waitFor('!!document.querySelector(".stamp")', 6000);
    ok(await ev('document.querySelector(".stamp").textContent.includes("SIN FONDOS")'), 'con menos de la apuesta mínima: SIN FONDOS');
    ok(await waitFor('SN.Sneak.active', 10000), 'vida extra: te cuelas en el cuarto de Tommy');
    await b.sleep(400);
    await shot('20-cuarto-tommy');
    ok(await playSneak(), 'avanzando a escondidas se llega a la estantería');
    ok(await breakPig(), 'en tu mesa rompes el cerdito a golpes');
    await b.sleep(800);
    await shot('21-tommy');
    ok(await ev('document.querySelector(".piggy-ui").textContent.toUpperCase().includes("TOMMY")'), 'aparece el mensaje de Tommy');
    const coins = await ev('SN.Bankruptcy.pig.coins');
    await mouse('#bk-continue');
    await b.sleep(900);
    ok(await ev('SN.Game.state') === 'GAMEPLAY' && await ev('SN.State.run.capital') === 4 + coins && await ev('SN.State.run.piggy') === 'broken', `la partida sigue con el dinero del cerdito (+${coins})`);
    ok(await ev('SN.Save.hasRun()'), 'la partida no se borra');
    // --- Sin cerdito: se vuelve al inicio de la meta con lo que tenías ---
    await ev('SN.Economy.spend(SN.State.run.capital - 3, "test"); SN.UI.setBusy(true); SN.Game.afterTurn(null); true');
    ok(await waitFor('!!document.querySelector(".final-loss")', 9000), 'sin cerdito: se acaba de verdad');
    await b.sleep(400);
    await shot('22-final');
    ok(await ev('document.querySelector(".final-loss").textContent.includes("inicio de")'), 'dice a qué meta vuelves y con cuánto');
    await mouse('#bk-retry');
    await b.sleep(1500);
    for (let i = 0; i < 20 && await ev('SN.Dialog.active || SN.UI.busy'); i++) { await advance(); await b.sleep(300); }
    ok(await ev('SN.Game.state') === 'GAMEPLAY' && await ev('SN.State.run.capital') === cp && await ev('SN.Unlocks.isUnlocked("tecno")'), `vuelves al inicio de la meta con ${cp} y lo desbloqueado`);
    ok(await ev('SN.State.run.piggy') === 'ready', 'Tommy ha vuelto a llenar el cerdito');
    await shot('23-vuelta-a-la-meta');
  } catch (e) {
    failed++;
    console.log('  ERROR:', e.message);
  }
  const errors = b.logs.filter((l) => l.includes('EXCEPTION') || l.startsWith('[error]'));
  ok(errors.length === 0, 'sin errores en consola:\n    ' + errors.join('\n    '));
  console.log(`\n${passed} correctas, ${failed} fallos · capturas en ${OUT}`);
  b.close();
  process.exit(failed ? 1 : 0);
})();
