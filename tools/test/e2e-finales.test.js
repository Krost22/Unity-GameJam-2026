// Los dos finales en Chrome sin ventana (?debug y F11 saltan a la meta final):
//   la elección (mercado TÚ, la última oferta, NULL.EXE completo), los 3 turnos sin elegir (la entidad elige por
//   ti), retomar la partida en la elección, el FINAL A entero (sin pala) y el FINAL B entero (terminal, la X,
//   la carta con la pala, Hacienda, el periódico de Bravo Fines) y la pala en la partida siguiente.
// Uso: node tools/test/e2e-finales.test.js [carpeta de capturas]
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { launch } = require('./cdp');

const OUT = process.argv[2] || path.join(os.tmpdir(), 'saldo-e2e-finales');
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else fail++; console.log(`  ${c ? 'ok   ' : 'FALLO'}: ${msg}`); };
const PROFILE = JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 4, runs: 0, bestCapital: 0, settings: { music: false, sfx: false } });

(async () => {
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/') + '?debug';
  const b = await launch(url, { width: 1280, height: 720, port: 9420 });
  const ev = (js) => b.evaluate(js);
  const wait = async (js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(js)) return true; } catch (_) { /* */ } await b.sleep(120); } return false; };
  const shot = async (name) => { await b.screenshot(path.join(OUT, name + '.png')); };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
  const click = async (sel) => { const p = await center(sel); if (!p) return false; await b.click(p.x, p.y); return true; };
  // Partida nueva y salto a la meta final (los diálogos se pasan solos)
  const toFinale = async () => {
    await ev('document.getElementById("btn-new").click()');
    await wait('SN.Game.state === "INTRO"'); await ev('SN.Cine.skip(); true');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 15000);
    await b.sleep(600);
    await b.key('F11');
    const r = await wait('(SN.Dialog.active && SN.Dialog.advance(), SN.State.run && SN.State.run.finale && SN.State.run.finale.phase === "choice" && SN.Windows.current === "pact" && !SN.UI.busy)', 90000);
    await b.sleep(500); // la oferta entra con una animación: se pulsa cuando ya está quieta, como una persona
    return r;
  };
  // «Ahora no»: espera a que la oferta esté quieta, la cierra y espera a que se vaya
  const pactNo = async () => {
    await b.sleep(450);
    await click('.pa-no');
    const r = await wait('SN.Windows.current === null', 3000);
    await b.sleep(250);
    return r;
  };
  // Pasa los subtítulos y los paneles de un final hasta los créditos
  const playOut = async (ms) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (await ev('!!document.querySelector(".fin-credits")')) return true;
      if (await ev('!!(SN.Finale.term && SN.Finale.term.typing)')) await b.key('KeyA');
      else if (await ev('SN.Cine.say_ != null && SN.Cine.say_.shown >= SN.Cine.say_.full.length && !SN.Cine.say_.auto')) await b.click(640, 650);
      else if (await ev('!document.getElementById("btn-x").classList.contains("hidden")')) { await b.sleep(300); await click('#btn-x'); }
      else if (await center('.fin-next')) { await b.sleep(900); await click('.fin-next'); }
      await b.sleep(150);
    }
    return false;
  };
  try {
    await ev(`localStorage.clear(); localStorage.setItem('saldonegro.profile.v1', '${PROFILE}'); location.reload(); true`);
    await b.sleep(1500);
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")');

    // --- La elección ---
    ok(await toFinale(), 'F11 lleva a la meta final y al acabar el preludio salta la última oferta');
    ok(await ev('SN.State.run.nullParts === 3 && SN.Desktop.ser().log.some((m) => m.t === "EL ES TU")'), 'LOS DESFASADOS entregan la última parte de NULL.EXE ("ÉL ES TÚ")');
    ok(await ev('SN.Desktop.chat().log.some((m) => /mira por la ventana/.test(m.t))'), 'Kevo se conecta una última vez: "mira por la ventana"');
    ok(await ev('!document.getElementById("finale").classList.contains("hidden") && document.getElementById("app").classList.contains("finale")'), 'se abre el mercado TÚ y los demás se bloquean');
    await shot('01-oferta');
    await pactNo();
    await shot('02-mercado-tu');
    ok(await ev('SN.Windows.current === null && document.querySelectorAll(".fz-card.off").length === 8 && !!document.querySelector(".fz-card.you")'), '«Ahora no» cierra la oferta: 8 mercados bloqueados y TÚ');
    await b.key('KeyT');
    await b.sleep(300);
    ok(await ev('SN.Windows.current === null'), 'durante la elección no se abre la tienda');

    // --- Tres turnos sin elegir: la entidad elige por ti (y al recargar se vuelve a la elección) ---
    await click('#btn-skip-turn');
    ok(await wait('SN.Windows.current === "pact" && !SN.UI.busy', 15000), 'al esperar un turno, la oferta vuelve ("FUTURO.EXE insiste")');
    ok(await ev('/insiste/.test(document.querySelector(".pact .of-head > span:last-child").textContent)'), 'la oferta dice que FUTURO.EXE insiste');
    await pactNo();
    await click('#btn-skip-turn');
    await wait('SN.Windows.current === "pact" && !SN.UI.busy', 15000);
    await pactNo();
    await click('#btn-skip-turn');
    ok(await wait('SN.State.run.finale.phase === "A"', 15000), 'a los 3 turnos sin elegir, la entidad elige por ti (final A)');
    await ev('location.reload(); true');
    await b.sleep(1500);
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")');
    ok(await ev('SN.Save.hasRun()'), 'mientras dura un final no se guarda: la partida sigue en la elección');
    await ev('document.getElementById("btn-continue").click(); true');
    ok(await wait('SN.State.run && SN.State.run.finale.phase === "choice" && SN.Windows.current === "pact"', 15000), 'Continuar vuelve al mercado TÚ y a la última oferta');

    // --- FINAL A: el avatar perfecto ---
    await b.sleep(500);
    await click('.of-yes');
    ok(await wait('document.getElementById("app").classList.contains("absorb")', 4000), 'final A: FUTURO.EXE absorbe la interfaz');
    ok(await wait('SN.Cine.shot && SN.Cine.shot.type === "face" && SN.Cine.shot.opts.hoodIn', 6000), 'el encapuchado se funde con el protagonista');
    await b.sleep(3500);
    await shot('A-fusion');
    ok(await wait('document.getElementById("desk").classList.contains("gray") && SN.Desk.crawl > 0', 8000), 'la habitación pierde sus colores y las gráficas se salen del monitor');
    ok(await wait('SN.Cine.shot && SN.Cine.shot.type === "black" && SN.Cine.shot.lines.some((l) => /ADMINISTRADOR/.test(l.text))', 25000), 'NUEVO ADMINISTRADOR REGISTRADO');
    ok(await wait('SN.Hero.cat.state === "stare"', 25000), 'el gato mira a la cámara...');
    ok(await wait('SN.Hero.cat.hoodT > 0', 6000), '...y durante un instante tiene la cara del encapuchado');
    ok(await wait('!!document.querySelector(".fin-credits")', 15000), 'FIN y créditos');
    await shot('A-creditos');
    ok(await ev('/AVATAR PERFECTO/.test(document.querySelector(".fin-credits").textContent) && !/PALA/.test(document.querySelector(".fin-credits").textContent)'), 'créditos del final A, sin la pala');
    await click('.fin-credits .fin-next');
    ok(await wait('SN.Game.state === "MENU"', 6000), 'vuelta al menú');
    ok(await ev('SN.State.profile.endings.A === true && !SN.State.profile.pala && !SN.Save.hasRun()'), 'el final A queda visto, la partida cerrada y sin pala');

    // --- FINAL B: NULL.EXE ---
    ok(await toFinale(), 'otra partida: de nuevo en la elección');
    await pactNo();
    await click('#btn-fmin');
    ok(await wait('SN.Desktop.open && !!SN.Desktop.wins.null && !!document.querySelector(".nu-run:not([disabled])") && document.getElementById("app").classList.contains("hidden")', 5000), '«Ir al escritorio» abre NULL.EXE con su LÉEME y el botón para ejecutarlo');
    await shot('B-01-leeme');
    await b.sleep(300);
    await click('.nu-run');
    ok(await wait('!!SN.Desktop.wins.term && !!(SN.Finale.term && SN.Finale.term.typing)', 4000), 'se abre la terminal');
    for (let i = 0; i < 6; i++) { await b.key('KeyA'); await b.sleep(90); }
    await b.sleep(900);
    await shot('B-02-terminal');
    ok(await ev('SN.Finale.term.lines.some((l) => /tasklist/.test(l.t))'), 'cualquier tecla escribe el comando (tasklist)');
    // Mientras NULL.EXE se ejecuta, la terminal no se cierra ni se vuelve a FUTURO.exe (antes se quedaba todo
    // esperando una terminal cerrada); el icono de NULL.EXE te devuelve a ella
    await click('.dt-term .dt-x');
    await b.key('Escape');
    await click('.dt-icon[data-app="futuro"]');
    await b.sleep(300);
    ok(await ev('!!SN.Desktop.wins.term && SN.Desktop.open && SN.Desktop.topWin() === "term" && !!SN.Finale.term.notice'), 'la terminal no se cierra (ni con la X ni con Escape) ni se vuelve a FUTURO.exe: "NULL.EXE está en ejecución"');
    await click('.dt-icon[data-app="notes"]');
    await click('.dt-icon[data-app="null"]');
    ok(await ev('SN.Desktop.topWin() === "term"'), 'el icono de NULL.EXE te lleva a la terminal');
    ok(await playOut(200000), 'final B entero hasta los créditos: terminal, colapso, la X, farolas, despedida, carta, Hacienda y periódico');
    await shot('B-creditos');
    ok(await ev('/NULL\\.EXE/.test(document.querySelector(".fin-credits").textContent) && /PALA/.test(document.querySelector(".fin-credits").textContent)'), 'créditos del final B, con la pala');
    await click('.fin-credits .fin-next');
    ok(await wait('SN.Game.state === "MENU"', 6000), 'vuelta al menú');
    ok(await ev('SN.State.profile.endings.B === true && SN.State.profile.pala === true'), 'el final B queda visto y LA PALA, desbloqueada');

    // --- La pala, en la partida siguiente ---
    await ev('document.getElementById("btn-new").click()');
    await wait('SN.Game.state === "INTRO"'); await ev('SN.Cine.skip(); true');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 15000);
    ok(await ev('SN.Desk.state().pala === true && !SN.Desk.noPC && !document.getElementById("desk").classList.contains("gray")'), 'en la partida siguiente la pala está en la pared (y la habitación, como siempre)');
    await shot('C-pala-en-la-pared');
  } catch (e) {
    fail++;
    console.log('  ERROR:', e.message);
  }
  const errs = b.logs.filter((l) => /EXCEPTION|Uncaught|TypeError|ReferenceError/i.test(l));
  ok(errs.length === 0, 'sin errores en la consola' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(`\n${pass} correctas, ${fail} fallos · capturas en ${OUT}`);
  b.close();
  process.exit(fail ? 1 : 0);
})();
