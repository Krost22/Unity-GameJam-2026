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

  // El rescate bancario (js/render/bailout.js), con teclas y clics de verdad: en el contestador, 2 (banco enorme);
  // escribir el nombre del banco; la videollamada con Trompa (ESPACIO para seguir) y un clic en su firma, que
  // esconde una letra del idioma secreto. Se reproduce al triple de velocidad.
  const playRescue = async () => {
    await ev('SN.Bailout.speed = 3; true');
    if (!(await waitFor('SN.Bailout.V.ui === "menu"', 12000))) return false;
    await b.key('Digit2', '2');
    if (!(await waitFor('SN.Bailout.V.ui === "name"', 6000))) return false;
    await waitFor('!!(SN.Bailout.say_ && SN.Bailout.say_.caret)', 6000);
    for (let i = 0; i < 40 && await ev('SN.Bailout.V.typed < SN.Data.story.rescue.bankName.length'); i++) { await b.key('KeyK', 'k'); await b.sleep(40); }
    await b.key('Enter', 'Enter');
    if (!(await waitFor('SN.Bailout.V.scene === "call"', 15000))) return false;
    const seen = {};
    for (let i = 0; i < 400 && await ev('SN.Bailout.active'); i++) {
      const st = JSON.parse(await ev('JSON.stringify({ g: SN.Bailout.V.gesture, s: SN.Bailout.V.scene, full: !!(SN.Bailout.say_ && SN.Bailout.say_.shown >= SN.Bailout.say_.full.length) })'));
      if (st.s === 'call') seen[st.g] = true;
      if (st.s === 'insert') seen.firmando = true;
      if (st.g === 'show' && st.full && !seen.clic) {
        seen.clic = true;
        const p = await ev('(() => { const r = document.getElementById("cine").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 67 / 90 }; })()');
        await b.click(p.x, p.y);
        await shot('22b-la-firma');
      }
      if (st.full) await b.key('Space', ' ');
      await b.sleep(80);
    }
    rescueSeen = Object.keys(seen);
    return ['accordion', 'point', 'sign', 'firmando', 'show', 'button', 'money', 'thumbs'].every((k) => seen[k]) && waitFor('!!document.getElementById("bk-continue")', 6000);
  };
  let rescueSeen = [];

  try {
    await waitFor('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")', 8000);
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
    let sawCone = false, sawBuy = false, sawCash = false, sawDrama = false, sawErrata = false, sawShop = false, sawBadge = false;
    for (let i = 0; i < 300 && await ev('SN.Tutorial.active'); i++) {
      const st = await ev('({ allow: SN.UI.allow, spot: SN.UI.spotSel, dlg: SN.Dialog.active, drama: SN.Drama.active })');
      if (st.spot === '#chart-wrap' && !sawCone) { sawCone = true; await b.sleep(700); await shot('04-tutorial-pista'); }
      if (st.drama && !sawDrama) { sawDrama = true; await b.sleep(300); await shot('07-tutorial-susto'); }
      if (!sawErrata && await ev('!!document.querySelector(".np-hero.cipher") && SN.UI.spotSel === ".np-hero.cipher"')) {
        sawErrata = await ev('/[ЖДФЯИЛШБЭЦГЮЩПЧ]/.test(document.querySelector(".np-hero.cipher .h").textContent)');
        await b.sleep(300); await shot('07b-tutorial-errata');
      }
      // La Tienda: el número rojo y la ventana por dentro
      if (!sawBadge && st.spot === '#nav-shop') sawBadge = await ev('!document.getElementById("shop-badge").classList.contains("hidden")');
      if (!sawShop && st.spot === '.win' && await ev('SN.Windows.current === "shop"')) { sawShop = true; await b.sleep(300); await shot('07d-tutorial-tienda'); }
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
    ok(sawErrata, 'el tutorial enseña las noticias con una "errata" en el idioma secreto');
    ok(sawShop, 'el tutorial enseña la TIENDA por dentro (mejoras incluidas)');
    ok(sawBadge, 'el tutorial enseña el número rojo de lo que se puede comprar');
    ok(await ev('!SN.Windows.current'), 'al acabar el tutorial no queda ninguna ventana abierta');
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

    // --- Mejoras (en la Tienda): al empezar solo el MULTIPLICADOR (las demás llegan como "regalo" del encapuchado) ---
    ok(await ev('SN.State.run.form.leverage === 1 && !SN.Trading.leverageAvailable(2) && document.querySelectorAll("#leverages button.locked").length === 3'),
      'acabado el tutorial solo queda el ×1: ×2, ×5 y ×10 salen con candado');
    await mouse('#leverages button[data-l="5"]');
    await b.sleep(500);
    ok(await ev('SN.Windows.current === "shop" && document.querySelector(".sh-nb.on").dataset.cat === "mejoras" && document.querySelector(".sh-row.sel").dataset.id === "multiplicador"'),
      'pulsar un multiplicador con candado abre la Tienda en el MULTIPLICADOR');
    await shot('13-mejoras');
    ok(await ev('document.querySelectorAll(".sh-row").length === 5 && document.querySelectorAll(".sh-row.locked").length === 4 && !document.querySelector(".sh-row[data-id=multiplicador]").classList.contains("locked")'),
      'al empezar las 4 mejoras de los regalos están bloqueadas; el MULTIPLICADOR se puede comprar');
    {
      const d0 = await ev('SN.State.run.debt.amount'), cr = await ev('SN.Upgrades.creditCost("multiplicador")');
      await mouse('.sh-buy');
      await b.sleep(400);
      ok(await ev(`SN.Upgrades.level("multiplicador") === 1 && SN.Trading.leverageAvailable(2) && !SN.Trading.leverageAvailable(5) && SN.State.run.debt.amount === ${d0 + cr}`),
        `el ×2 se compra a crédito en la Tienda: hoy $0 y +$${cr} a la deuda`);
    }
    await mouse('.win-x');
    await b.sleep(300);
    ok(await ev('!document.querySelector("#leverages button[data-l=\'2\']").classList.contains("locked")'), 'el botón ×2 pierde el candado');

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
    const capPay = await ev('SN.State.run.capital - SN.State.run.debt.amount');
    await mouse('#btn-pay');
    let sawStamp = false, sawHood = false, bonusLate = null;
    for (let i = 0; i < 120 && await ev('SN.UI.busy'); i++) {
      if (!sawStamp && await ev('!!document.querySelector(".stamp")')) { sawStamp = true; await b.sleep(400); await shot('16-deuda-saldada'); }
      if (bonusLate == null && await ev('SN.State.run.debt.id === "pleyzeta" && SN.State.run.debt.bonusPending && !!SN.Narrative.hood && SN.Dialog.active'))
        bonusLate = await ev(`SN.State.run.capital === ${capPay}`);
      if (!sawHood && await ev('!!SN.Narrative.hood && SN.Dialog.active')) { sawHood = true; await b.sleep(800); await shot('17-encapuchado-vuelve'); }
      await ev('SN.Cine.beatResolve && SN.Cine.advance(); true');
      await advance();
      await b.sleep(300);
    }
    ok(await ev('SN.State.run.flags.debtPaid'), 'deuda de la Pleyzeta pagada');
    const pb = await ev('(SN.State.run.debts.find((d) => d.id === "pleyzeta") || {}).bonus');
    ok(bonusLate === true && await ev(`SN.State.run.capital === ${capPay} + ${pb} && !SN.Debt.pendingBonus()`),
      `el bono ($${pb}) no está en tu dinero mientras el encapuchado habla: se suma cuando te lo da`);
    ok(await ev('!SN.Trading.leverageAvailable(10)'), 'pagar la deuda ya no regala el ×10: se compra');
    ok(sawHood && await ev('SN.Debt.active() && SN.State.run.debt.id === "regalo1" && SN.Upgrades.isUnlocked("limite") && SN.Upgrades.level("limite") === 0'),
      'el "regalo" del encapuchado: LÍMITE para comprar... y una deuda nueva');
    await b.sleep(500);
    await shot('18-regalo');
    // El regalo solo desbloquea: LÍMITE se compra en la TIENDA, a crédito (y la Tienda lo avisa con un número rojo)
    await waitFor('!SN.UI.busy', 10000);
    await ev('SN.Economy.add(200, "test"); SN.UI.renderNav(); true');
    await b.sleep(300);
    ok(await ev('!document.getElementById("nav-upgrades") && !!document.getElementById("nav-shop")'), 'un solo botón: TIENDA (ya no hay MEJORAS aparte)');
    ok(await ev('!document.getElementById("shop-badge").classList.contains("hidden")'), 'la TIENDA avisa con un número rojo de que ya puedes comprar algo');
    const debt0 = await ev('SN.State.run.debt.amount'), cap0 = await ev('SN.State.run.capital'), cred = await ev('SN.Upgrades.creditCost("limite")');
    await mouse('#nav-shop');
    await b.sleep(400);
    ok(await ev('document.getElementById("shop-badge").classList.contains("hidden")'), 'al abrir la TIENDA el número rojo desaparece');
    await mouse('.sh-nb[data-cat="mejoras"]');
    await b.sleep(400);
    await mouse('.sh-row[data-id="limite"]');
    await b.sleep(300);
    await mouse('.sh-buy');
    await b.sleep(400);
    ok(await ev(`SN.Upgrades.level("limite") === 1 && SN.State.run.capital === ${cap0} && SN.State.run.debt.amount === ${debt0 + cred}`),
      `LÍMITE se compra en la TIENDA a crédito: hoy $0 y +$${cred} a la deuda`);
    await mouse('.win-x');
    await b.sleep(300);

    // --- Pagar el regalo: la oferta de la tele salta SOLA (sin ir a la tienda) ---
    await waitFor('!SN.UI.busy', 10000);
    await ev('SN.Economy.add(SN.State.run.debt.amount, "test"); SN.UI.renderAll(); true');
    await b.sleep(300);
    await mouse('#btn-pay');
    for (let i = 0; i < 60 && await ev('SN.UI.busy'); i++) { await advance(); await b.sleep(250); }
    ok(await ev('!SN.Debt.active() && SN.Unlocks.step().id === "tele"'), 'pagado el regalo: toca la tele');
    ok(await waitFor('SN.Windows.current === "offer" && !!document.querySelector(".offer")', 4000), 'la oferta de FUTURO.exe salta sola al pagar la deuda, sin abrir la tienda');
    await shot('19-oferta');
    // Es el siguiente paso de la historia: sin "No, gracias", y no se cierra con ESC ni pulsando fuera
    ok(await ev('!document.querySelector(".offer .of-no") && document.querySelectorAll(".offer .of-row .btn").length === 1'), 'la oferta solo tiene un botón: ¡Lo quiero!');
    ok(await ev('!document.querySelector(".offer .of-short") && !document.querySelector(".offer .of-yes").disabled'), 'no pide tener dinero en la cuenta');
    await ev('document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" })); true');
    await ev('document.querySelector(".win-back").click(); true'); // (el centro del fondo lo tapa la oferta)
    await b.sleep(300);
    ok(await ev('SN.Windows.current') === 'offer', 'ni ESC ni un clic fuera la cierran');
    const capT = await ev('SN.State.run.capital');
    await mouse('.offer .of-yes');
    for (let i = 0; i < 80 && await ev('SN.UI.busy'); i++) { await advance(); await b.sleep(300); }
    ok(await ev(`SN.State.run.owned.tele && SN.Debt.active() && SN.State.run.debt.amount === SN.Unlocks.offer("tele").debt && SN.State.run.capital === ${capT} && SN.Unlocks.isUnlocked("salud_negro")`),
      'aceptar: la tele es tuya, hoy no pagas nada, lo debes todo y se abre Salud negro');
    ok(await ev('!!document.querySelector(".mtab-negro")'), 'aparece la pestaña del mercado negro');
    await mouse('.mcard[data-id="salud_negro"]');
    await b.sleep(600);
    ok(await ev('SN.State.run.selected === "salud_negro" && document.getElementById("app").classList.contains("black")'), 'en el mercado negro FUTURO.exe se oscurece');
    await shot('20-mercado-negro');

    // --- Pagar la tele: llega la siguiente deuda al momento (el regalo que abre Tecnología) ---
    await ev('SN.Economy.add(1500, "test"); SN.UI.renderAll(); true');
    await b.sleep(300);
    await mouse('#btn-pay');
    for (let i = 0; i < 120 && await ev('SN.UI.busy'); i++) { await advance(); await b.sleep(300); }
    ok(await ev('SN.Unlocks.isUnlocked("tecno") && SN.State.run.debt.id === "regalo2"'), 'pagada la tele llega al momento el regalo de ANÁLISIS, que abre Tecnología');
    await mouse('.mtab-legal');
    await b.sleep(300);
    await mouse('.mcard[data-id="tecno"]');
    await b.sleep(700);
    ok(await ev('SN.State.run.selected') === 'tecno', 'se cambia de mercado con un clic');
    await shot('21-tecnologia');

    // --- Sin dinero: el rescate bancario es una vida extra ---
    const cp = await ev('SN.State.run.checkpoint.capital');
    await ev('SN.Economy.spend(SN.State.run.capital - 4, "test"); SN.UI.setBusy(true); SN.Game.afterTurn(null); true');
    await waitFor('!!document.querySelector(".stamp")', 6000);
    ok(await ev('document.querySelector(".stamp").textContent.includes("SIN FONDOS")'), 'con menos de la apuesta mínima: SIN FONDOS');
    ok(await waitFor('SN.Bailout.active', 10000), 'vida extra: llamas a la Línea de Rescate Financiero');
    await b.sleep(400);
    await shot('22-linea-de-rescate');
    const known = await ev('SN.Cipher.knows("I")');
    ok(await playRescue(), 'te haces pasar por un banco enorme y Trompa te rescata en videollamada: ' + rescueSeen.join(', '));
    ok(known || await ev('SN.Cipher.knows("I")'), 'la firma de Trompa esconde la letra I del idioma secreto');
    await b.sleep(1600);
    await shot('23-rescatado');
    ok(await ev('document.querySelector(".rescue-ui").textContent.includes("TRANSFERENCIA RECIBIDA") && /Banco de Mi Cuarto/.test(document.querySelector(".rescue-ui").textContent)'), 'el justificante: transferencia de la Presidencia al Banco de Mi Cuarto S.A.');
    const coins = await ev('SN.Bankruptcy.coins');
    await mouse('#bk-continue');
    await b.sleep(900);
    ok(await ev('SN.Game.state') === 'GAMEPLAY' && await ev('SN.State.run.capital') === 4 + coins && await ev('SN.State.run.rescue') === 'used', `la partida sigue con el dinero del rescate (+${coins})`);
    ok(await ev('SN.Save.hasRun()'), 'la partida no se borra');
    // --- Sin rescate: se vuelve al inicio de la meta con lo que tenías ---
    await ev('SN.Economy.spend(SN.State.run.capital - 3, "test"); SN.UI.setBusy(true); SN.Game.afterTurn(null); true');
    ok(await waitFor('!!document.querySelector(".final-loss")', 9000), 'sin rescate: se acaba de verdad');
    await b.sleep(400);
    await shot('24-final');
    ok(await ev('document.querySelector(".final-loss").textContent.includes("inicio de")'), 'dice a qué paso vuelves y con cuánto');
    await mouse('#bk-retry');
    await b.sleep(1500);
    for (let i = 0; i < 20 && await ev('SN.Dialog.active || SN.UI.busy'); i++) { await advance(); await b.sleep(300); }
    ok(await ev('SN.Game.state') === 'GAMEPLAY' && await ev('SN.State.run.capital') === cp && await ev('SN.Unlocks.isUnlocked("tecno")'), `vuelves al inicio de la meta con ${cp} y lo desbloqueado`);
    ok(await ev('SN.State.run.rescue') === 'ready', 'la Línea de Rescate vuelve a coger el teléfono');
    await shot('25-vuelta-al-punto-de-control');
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
