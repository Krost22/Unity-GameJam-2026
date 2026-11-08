// Escritorio del PC y Mensajín con clics y teclas REALES: minimizar FUTURO.exe, leer a Kevo,
// contestar pulsando cualquier tecla (el juego pone las letras), enviar y volver a la app.
// Uso: node tools/test/e2e-desktop.test.js [carpeta de capturas]
'use strict';
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp');

const OUT = process.argv[2] || path.join(__dirname, 'shots-desktop');
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else fail++; console.log(`  ${c ? 'ok   ' : 'FALLO'}: ${msg}`); };

(async () => {
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');
  const b = await launch(url, { width: 1280, height: 720, port: 9402 });
  const ev = (js) => b.evaluate(js);
  const wait = async (js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(js)) return true; await b.sleep(100); } return false; };
  const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
  const clickSel = async (sel) => { const p = await center(sel); if (!p) return false; await b.click(p.x, p.y); return true; };
  try {
    await wait('SN.Game && SN.Game.state === "MENU"');
    await ev(`localStorage.setItem('saldonegro.profile.v1', JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 2, runs: 0, bestCapital: 0, settings: { music: false, sfx: false } })); SN.Save.loadProfile(); true`);
    await clickSel('#btn-new');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy');

    ok(await ev('!!document.querySelector("#btn-min") && /D/.test(document.querySelector("#btn-min kbd").textContent)'), 'FUTURO.exe tiene botón de minimizar con su tecla (D)');
    ok(await wait('!!document.querySelector(".msg-toast")', 9000), 'Kevo escribe y aparece un aviso dentro de FUTURO.exe');
    ok(await ev('/^\\$\\d/.test(document.getElementById("capital").textContent) && !/\\./.test(document.getElementById("capital").textContent)'), 'el dinero se muestra en enteros, sin centavos');
    await b.screenshot(path.join(OUT, '1-aviso.png'));

    // Clic en el aviso: minimiza y abre el chat
    await clickSel('.msg-toast');
    ok(await wait('SN.Desktop.open && !document.getElementById("desktop").classList.contains("hidden")', 3000), 'clic en el aviso: se ve el escritorio');
    ok(await wait('!!document.querySelector(".dt-chat")', 2000), 'y se abre Mensajín');
    ok(await wait('SN.State.run.chat.phase === "reply"', 12000), 'llegan todos los mensajes de Kevo');
    await b.screenshot(path.join(OUT, '2-chat.png'));

    // Escribir: cualquier tecla pone letras de la respuesta guionizada
    const reply = await ev('SN.Desktop.convo().reply');
    const before = await ev('SN.State.run.capital');
    for (let i = 0; i < 6; i++) await b.key('KeyJ', 'j');
    const typed = await ev('document.querySelector(".ch-box").textContent');
    ok(typed.length > 0 && reply.startsWith(typed.trim()), `las teclas escriben la respuesta del guion ("${typed.trim()}")`);
    ok(await ev('SN.State.run.capital') === before && !(await ev('!!SN.State.run.position')), 'teclear en el chat no dispara atajos de FUTURO.exe');
    // Con el ratón también se escribe (clic en la caja)
    const t0 = await ev('SN.State.run.chat.typed');
    await clickSel('.ch-box');
    ok(await ev('SN.State.run.chat.typed') > t0, 'un clic en la caja también escribe');
    let guard = 0;
    while (!(await ev('SN.Desktop.replyDone()')) && guard++ < 120) await b.key('KeyK', 'k');
    ok(await ev('SN.Desktop.replyDone() && !document.querySelector(".ch-send").disabled'), 'al terminar la frase se puede enviar');
    await b.screenshot(path.join(OUT, '3-escrito.png'));
    await clickSel('.ch-send');
    ok(await wait('SN.State.run.chat.log.some((m) => m.who === "m")', 2000), 'el mensaje se envía');
    ok(await wait('SN.State.run.chat.phase === "wait" && SN.State.run.chat.i === 1', 12000), 'Kevo contesta y la conversación termina');
    await b.screenshot(path.join(OUT, '4-respuesta.png'));

    // Otras aplicaciones del escritorio
    await clickSel('.dt-icon[data-app="notes"]');
    ok(await wait('!!document.querySelector(".dt-notes .nt")', 2000) && /Pleyzeta/.test(await ev('document.querySelector(".dt-notes .nt").textContent')), 'Notas se abre con la lista de tareas');
    await clickSel('.dt-icon[data-app="trash"]');
    await clickSel('.tr-file');
    ok(/\S/.test(await ev('document.querySelector(".tr-note").textContent')) && await ev('document.querySelector(".tr-note").textContent') !== 'Haz clic en un archivo', 'la Papelera responde al clic');
    await b.screenshot(path.join(OUT, '5-escritorio.png'));
    // Esc cierra ventanas una a una y después vuelve a FUTURO.exe
    for (let i = 0; i < 4; i++) await b.key('Escape');
    ok(await wait('!SN.Desktop.open && !document.getElementById("app").classList.contains("hidden")', 3000), 'Esc cierra las ventanas y vuelve a FUTURO.exe');
    // Tecla D: minimizar y volver con el icono
    await b.sleep(400);
    await b.key('KeyD', 'd');
    ok(await wait('SN.Desktop.open', 2000), 'la tecla D minimiza FUTURO.exe');
    await clickSel('.dt-icon[data-app="futuro"]');
    ok(await wait('!SN.Desktop.open', 2000), 'el icono de FUTURO.exe la restaura');
    // Durante una operación no se puede minimizar
    await b.sleep(400);
    await clickSel('#btn-buy');
    await wait('!!SN.State.run.position', 3000);
    await b.key('KeyD', 'd');
    ok(!(await ev('SN.Desktop.open')), 'con una operación en marcha no se minimiza');
    ok(await ev('!!SN.State.run.chat && SN.State.run.chat.log.length > 3'), 'la conversación queda guardada en la partida');
  } catch (e) {
    fail++;
    console.log('  ERROR:', e.message);
  }
  const errs = b.logs.filter((l) => /EXCEPTION|Uncaught|TypeError|ReferenceError/i.test(l));
  ok(errs.length === 0, 'sin errores en la consola' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(`\n${pass} correctas, ${fail} fallos`);
  b.close();
  process.exit(fail ? 1 : 0);
})();
