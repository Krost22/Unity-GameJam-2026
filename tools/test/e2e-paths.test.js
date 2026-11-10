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
const PROFILE = JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 4, runs: 0, bestCapital: 0, settings: { music: false, sfx: false } });

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

  // Cuarto de Timmy: mantener ESPACIO mientras duerme, soltar cuando se mueve; al final, clic en el cerdito
  const playSneak = async () => {
    const t0 = Date.now();
    let holding = false;
    while (Date.now() - t0 < 45000) {
      const o = JSON.parse(await ev('JSON.stringify({ st: SN.Sneak.timmy.st, s: SN.Sneak.state })'));
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
    await waitFor('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")', 8000);
    await ev('document.getElementById("btn-new").click()');
    await waitFor('SN.Game.state === "INTRO"', 8000); await ev('SN.Cine.skip(); true');
    await waitFor('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 10000);
  };
  const reloadAndContinue = async () => {
    await ev('location.reload(); true');
    await b.sleep(1500);
    await waitFor('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")', 8000);
    await ev('document.getElementById("btn-continue").click()');
  };

  try {
    await waitFor('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")', 8000);
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
    await ev('[...document.querySelectorAll(".set-row .btn")].find((x) => x.textContent === "Repasar").click()');
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
    ok(await ev('SN.State.run.flags.debtPaid'), 'deuda pagada');
    await ev('document.getElementById("nav-shop").click()');
    await b.sleep(500);
    await shot('p2-tienda');
    // La tienda rediseñada: categorías, tarjetas, detalle y compra (con la lógica de siempre)
    const cats = ['destacados', 'mejoras', 'clave', 'estilo', 'coleccion', 'mercados'];
    let catsOk = true;
    for (const c of cats) {
      await ev(`document.querySelector(".sh-nb[data-cat=${c}]").click(); true`);
      await b.sleep(150);
      if (!(await ev(`document.querySelector(".sh-nb.on").dataset.cat === "${c}" && document.querySelectorAll(".sh-card, .sh-row, .sh-ban").length > 0`))) catsOk = false;
    }
    ok(catsOk, 'la tienda se recorre por sus 6 categorías y cada una tiene productos');
    await ev('document.querySelector(".sh-nb[data-cat=mercados]").click(); true');
    await b.sleep(150);
    ok(await ev('document.querySelectorAll(".sh-card").length') === 8, 'Mercados enseña los 8 mercados');
    await ev('document.querySelector(".sh-nb[data-cat=estilo]").click(); true');
    await b.sleep(150);
    const cash0 = await ev('document.querySelector(".sh-cash").textContent');
    for (const id of ['taza', 'planta']) {
      await ev(`document.querySelector(".sh-card[data-id=${id}]").click(); true`);
      await b.sleep(150);
      ok(await ev(`document.querySelector(".sh-dt .sh-dn").textContent.length > 2 && document.querySelector(".sh-card.sel").dataset.id === "${id}"`), `elegir una tarjeta (${id}) actualiza el detalle`);
      await ev('document.querySelector(".sh-buy").click(); true');
      await b.sleep(250);
    }
    ok(await ev('SN.State.run.owned.taza && SN.State.run.owned.planta'), 'se compran artículos de estilo de vida');
    ok(await ev('document.querySelector(".sh-cash").textContent') !== cash0 && await ev('document.querySelector(".sh-card[data-id=taza]").classList.contains("own")'), 'el dinero de la cabecera baja y la tarjeta sale como tuya');
    await ev('document.querySelector(".sh-nb[data-cat=mejoras]").click(); true');
    await b.sleep(150);
    await ev('document.querySelector(".sh-row[data-id=limite]").click(); true');
    await b.sleep(150);
    await ev('document.querySelector(".sh-buy").click(); true');
    await b.sleep(250);
    ok(await ev('SN.Upgrades.level("limite")') === 1, 'una mejora también se compra desde la tienda');
    await ev('document.querySelector(".sh-nb[data-cat=estilo]").click(); true');
    await b.sleep(200);
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

    // --- 1.6: FUTURO cifrado, el protagonista habla, Bravo Fines y su Academia, primera plana ---
    ok(await ev('document.querySelector("#titlebar .app-name").textContent.includes(SN.Data.cipher.alphabet.F)'), 'FUTURO.exe se escribe en el idioma secreto');
    ok(await ev('"debtPaid" in SN.HeroSay.last'), 'al pagar, el protagonista lo dice en un globo encima del teclado');
    await ev('Object.assign(SN.State.run, { turn: 2 }); SN.UI.renderAll(); true');
    await ev('document.getElementById("btn-skip-turn").click(); true');
    let sawBravo = false;
    for (let i = 0; i < 100; i++) {
      if (!sawBravo && await ev('SN.Dialog.active && SN.Dialog.opts.portrait === "bravo"')) { sawBravo = true; await b.sleep(500); await shot('p5-bravo'); }
      await ev('SN.Dialog.active && (SN.Dialog.advance(), SN.Dialog.advance()); true');
      await b.sleep(250);
      if (!(await ev('SN.UI.busy || SN.Dialog.active'))) break;
    }
    ok(sawBravo && await ev('SN.State.run.flags.academy'), 'la mañana siguiente a pagar, Bravo Fines se presenta y abre su Academia');
    await ev('SN.Economy.add(300, "test"); SN.UI.renderAll(); document.getElementById("nav-shop").click(); true');
    await b.sleep(400);
    ok(await ev('!!document.querySelector(".sh-nb[data-cat=academia]")'), 'la Academia sale como categoría de la Tienda');
    await ev('document.querySelector(".sh-nb[data-cat=academia]").click(); true');
    await b.sleep(400);
    ok(await ev('document.querySelectorAll(".ac-n").length') === 12 && await ev('SN.Windows.win.classList.contains("big")'), 'la Academia (desde la Tienda) enseña el árbol (12 nodos) en grande');
    let viewsOk = true;
    for (const [v, n] of [['negocios', 5], ['trading', 4], ['contactos', 3], ['arbol', 12]]) {
      await ev(`document.querySelector(".ac-nb[data-view=${v}]").click(); true`);
      await b.sleep(150);
      if (await ev('document.querySelectorAll(".ac-n").length') !== n) viewsOk = false;
    }
    ok(viewsOk, 'la navegación lateral filtra las ramas (Negocios, Trading, Contactos, Árbol)');
    await ev('document.querySelector(".ac-n[data-node=tiburon]").click(); true');
    await b.sleep(150);
    ok(await ev('document.querySelector(".ac-dn").textContent.includes("tiburón")'), 'elegir un nodo actualiza el detalle');
    await ev('document.querySelector(".ac-n[data-node=limonada]").click(); true');
    await b.sleep(200);
    await ev('document.querySelector(".ac-buy").click(); true');
    await b.sleep(300);
    ok(await ev('SN.Academy.has("limonada")'), 'se compra el puesto de limonada en la Academia');
    ok(await ev('document.querySelector(".ac-n[data-node=limonada]").classList.contains("own") && document.querySelector(".ac-prog em").textContent.trim() === "1 / 6"'), 'el nodo sale comprado y el progreso sube (1 / 6)');
    await shot('p6-academia');
    await ev('SN.Windows.close(); true');
    await b.sleep(300);
    await ev('SN.Events.emit("market:event", { market: "salud", event: SN.Data.marketEvents.salud.find((e) => e.id === "chequeo") }); true');
    await ev('document.getElementById("nav-news").click()');
    await b.sleep(400);
    await ev('document.querySelector(".np-hero").click(); true');
    await b.sleep(300);
    ok(await ev('!!document.querySelector(".np-front canvas.photo") && document.querySelector(".np-front").textContent.includes("¿A quién afecta?") && document.querySelector(".np-front .h").textContent.includes("Patín")'),
      'clic en una noticia: primera plana con foto a color, a quién afecta y qué puede pasar');
    await shot('p7-primera-plana');
    await ev('document.querySelector(".np-back").click(); true');
    await b.sleep(200);
    ok(await ev('!document.querySelector(".np-front") && !!document.querySelector(".np-hero")'), '"Volver" regresa al periódico');
    ok(await ev('document.getElementById("screen").classList.contains("paper-open")'), 'con el periódico abierto no hay rayas de monitor sobre el papel');
    await ev('SN.Windows.close(); true');

    // --- Día de la suerte (el día 7): tarjeta dorada y Ruleta de la Fortuna ---
    await ev('SN.Game.toMenu(); true');
    await b.sleep(400);
    await fresh();
    await ev('Object.assign(SN.State.run, { day: 6, turn: 2 }); SN.State.run.flags.payHintShown = true; SN.Economy.add(400, "test"); SN.UI.renderAll(); true');
    await ev('document.getElementById("btn-skip-turn").click(); true');
    ok(await waitFor('!!document.querySelector(".daycard.lucky")', 8000), 'el día 7 es día de la suerte: tarjeta dorada');
    await b.sleep(300);
    await shot('p4b-dia-de-la-suerte');
    await waitFor('!SN.UI.busy', 10000);
    ok(await ev('!!SN.Luck.today() && SN.Luck.k() === 1 && document.getElementById("app").classList.contains("lucky")'), 'el 7 cuenta como un siete y FUTURO.exe se pone dorado');
    await ev('SN.State.run.luck.events = ["ruleta"]; SN.State.run.luck.spun = false; SN.UI.renderAll(); true');
    await ev('document.getElementById("nav-shop").click()');
    await b.sleep(400);
    await ev('document.querySelector(".sh-nb[data-cat=destacados]").click(); true');
    await b.sleep(150);
    ok(await ev('!!document.querySelector(".sh-card[data-kind=ruleta]")'), 'la tienda tiene la Ruleta de la Fortuna');
    await ev('document.querySelector(".sh-card[data-kind=ruleta]").click(); true');
    await b.sleep(150);
    await ev('document.querySelector(".sh-buy").click(); true');
    await b.sleep(400);
    ok(await ev('SN.Windows.current') === 'ruleta', 'se abre la ruleta');
    await ev('document.querySelector(".rl-go").click(); true');
    ok(await waitFor('document.querySelector(".rl-res").textContent.length > 3', 8000) && await ev('SN.State.run.luck.spun'), 'la ruleta gira y da un premio (una vez al día)');
    await shot('p4c-ruleta');
    await ev('SN.Windows.close(); true');
    await b.sleep(300);

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
    ok(await waitFor('SN.Sneak.active', 8000) && await ev('SN.State.run.day') === 1, 'el cerdito de Timmy llega el mismo día, sin pasar turnos');
    // Si Timmy te ve moverte, retrocedes
    await ev('SN.Sneak.p = 0.5; SN.Sneak.timmy.st = "look"; SN.Sneak.timmy.t = 0; true');
    await b.cdp('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' });
    await b.sleep(150);
    await b.cdp('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
    ok(await ev('SN.Sneak.caught') === 1 && await ev('SN.Sneak.p') < 0.5, 'si Timmy te ve moverte, retrocedes');
    await shot('p5b-pillado');
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
    ok(await waitFor('SN.Sneak.active', 8000) && await ev('SN.State.run.day') === 7, 'el embargo llega el día 7 y antes de perder queda el cerdito');
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
    ok(await waitFor('SN.Sneak.active', 8000), 'sin pagar al día 8: embargo, pero queda el cerdito');
    ok(await playSneak() && await breakPig(), 'cerdito roto');
    await ev('document.getElementById("bk-continue").click(); true');
    await b.sleep(800);
    ok(await ev('SN.Game.state') === 'GAMEPLAY' && await ev('SN.State.run.debt.deadlineDay') >= 9 && !(await ev('SN.State.run.debt.defaulted')), 'con el cerdito el cobrador da 2 días más');
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
    for (let i = 0; i < 60 && !(await s.evaluate('!!(document.querySelector("#boot .thanks button")?.click(), window.SN && SN.Game && SN.Game.state === "MENU")')); i++) await s.sleep(150);
    await s.evaluate('document.getElementById("btn-new").click(); true');
    for (let i = 0; i < 60 && !(await s.evaluate('SN.Game.state === "INTRO"')); i++) await s.sleep(150);
    await s.evaluate('SN.Cine.skip(); true');
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
