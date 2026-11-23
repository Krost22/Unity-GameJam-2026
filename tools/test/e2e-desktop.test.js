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
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")');
    await ev(`localStorage.setItem('saldonegro.profile.v1', JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 4, runs: 0, bestCapital: 0, settings: { music: false, sfx: false } })); SN.Save.loadProfile(); true`);
    await clickSel('#btn-new');
    await wait('SN.Game.state === "INTRO"'); await ev('SN.Cine.skip(); true');
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
    // En la pestaña de otro contacto (Bravo Fines) las teclas no le escriben a Kevo
    await ev('SN.Desktop.bravo().log.push({ who: "b", t: "Hola, campeón." }); SN.Desktop.renderChat(); true');
    await clickSel('.ch-tab.bravo');
    await b.sleep(200);
    const tk = await ev('SN.State.run.chat.typed');
    for (let i = 0; i < 6; i++) await b.key('KeyJ', 'j');
    await b.key('Enter');
    ok(await ev('SN.Desktop.contact') === 'bravo' && await ev('SN.State.run.chat.typed') === tk && await ev('SN.State.run.chat.phase') === 'reply' &&
      await ev('document.querySelector(".ch-box").textContent.includes("no lee")'), 'en otro chat (Bravo Fines) no se le escribe a Kevo');
    await clickSel('.ch-tab[data-c="kevo"]');
    await b.sleep(200);
    // El clic no escribe: solo las teclas
    const t0 = await ev('SN.State.run.chat.typed');
    await clickSel('.ch-box');
    ok(await ev('SN.State.run.chat.typed') === t0, 'un clic en la caja no escribe (solo las teclas)');
    ok(await ev('document.querySelectorAll(".ch-msg.f b").length') === 1, 'el nombre de Kevo sale una vez por bloque de mensajes, no en cada línea');
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
    // Las ventanas se arrastran por su barra de título, como en un PC (y no se salen del escritorio)
    const head = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel + ' .dt-head span')}).getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);
    // (los mensajes del chat hacen temblar la pantalla unos píxeles: si el clic no cae en la barra, se repite)
    const dragTo = async (sel, x, y) => {
      for (let tries = 0; tries < 4; tries++) {
        const h = await head(sel);
        await ev(`window.__hd = false; document.querySelector(${JSON.stringify(sel + ' .dt-head')}).addEventListener('pointerdown', () => { window.__hd = true; }, { once: true }); true`);
        await b.mouse('mouseMoved', h.x, h.y); await b.mouse('mousePressed', h.x, h.y);
        if (!(await ev('window.__hd'))) { await b.mouse('mouseReleased', h.x, h.y); await b.sleep(400); continue; }
        for (let i = 1; i <= 6; i++) await b.mouse('mouseMoved', h.x + (x - h.x) * i / 6, h.y + (y - h.y) * i / 6);
        await b.mouse('mouseReleased', x, y);
        return;
      }
    };
    const box = (sel) => ev(`(() => { const w = document.querySelector(${JSON.stringify(sel)}), d = document.getElementById("desktop"); return { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight, dw: d.offsetWidth, dh: d.offsetHeight - d.querySelector(".dt-bar").offsetHeight, top: w.classList.contains("top"), k: d.getBoundingClientRect().width / d.offsetWidth }; })()`);
    const tr0 = await box('.dt-trash'), h0 = await head('.dt-trash');
    await dragTo('.dt-trash', h0.x - 40 * tr0.k, h0.y + 20 * tr0.k);
    const tr1 = await box('.dt-trash');
    ok(Math.abs(tr1.x - (tr0.x - 40)) <= 1 && Math.abs(tr1.y - (tr0.y + 20)) <= 1, `la Papelera se arrastra por su barra de título (${tr0.x},${tr0.y} → ${tr1.x},${tr1.y})`);
    await dragTo('.dt-trash', 2, 2);
    const tr2 = await box('.dt-trash');
    ok(tr2.x === 0 && tr2.y === 0, `no se sale por arriba ni por la izquierda (${tr2.x},${tr2.y})`);
    await dragTo('.dt-trash', 1278, 718);
    const tr3 = await box('.dt-trash');
    ok(tr3.x + tr3.w === tr3.dw && tr3.y + tr3.h === tr3.dh, `ni por la derecha ni bajo la barra de tareas (${tr3.x},${tr3.y})`);
    const h3 = await head('.dt-trash');
    await b.click(h3.x, h3.y);
    const tr4 = await box('.dt-trash');
    ok(tr4.x === tr3.x && tr4.y === tr3.y && await ev('!!SN.Desktop.wins.trash'), 'un clic en la barra no la mueve ni la cierra');
    const nt0 = await box('.dt-notes'), hn = await head('.dt-notes');
    ok(!nt0.top, 'Notas está detrás de la Papelera');
    await dragTo('.dt-notes', hn.x + 30 * nt0.k, hn.y + 10 * nt0.k);
    const nt1 = await box('.dt-notes');
    ok(nt1.top && Math.abs(nt1.x - (nt0.x + 30)) <= 1 && Math.abs(nt1.y - (nt0.y + 10)) <= 1, `arrastrar Notas la trae delante y la mueve (${nt0.x},${nt0.y} → ${nt1.x},${nt1.y})`);
    const xb = await center('.dt-notes .dt-x');
    await b.mouse('mouseMoved', xb.x, xb.y); await b.mouse('mousePressed', xb.x, xb.y);
    await b.mouse('mouseMoved', xb.x - 30, xb.y + 20); await b.mouse('mouseReleased', xb.x - 30, xb.y + 20);
    const nt2 = await box('.dt-notes');
    ok(nt2.x === nt1.x && nt2.y === nt1.y, 'la X no arrastra la ventana');
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
    // --- El idioma secreto: LOS DESFASADOS escriben y una pista traduce lo que dicen ---
    await ev('SN.Desktop.ser().i = 0; SN.State.run.day = 2; SN.State.run.turn = 1; SN.Desktop.serCheck(); true');
    ok(await wait('SN.Desktop.ser().log.length > 0', 4000), 'LOS DESFASADOS escriben en el idioma secreto');
    await b.key('KeyD', 'd');
    await wait('SN.Desktop.open', 2000);
    await clickSel('.dt-icon[data-app="chat"]');
    await wait('!!document.querySelector(".ch-tabs:not(.hidden) .ch-tab.ser")', 2000);
    await clickSel('.ch-tab.ser');
    await b.sleep(200);
    const ser0 = await ev('document.querySelector(".ch-log").textContent');
    ok(/[ЖДФЯИЛШБЭЦГЮЩПЧ]/.test(ser0) && !/E/.test(ser0), `sus mensajes salen en cirílico (${ser0.trim()})`);
    ok(await ev('document.querySelector(".ch-box").textContent.includes("No puedes responder")'), 'a LOS DESFASADOS no se les puede contestar');
    await b.screenshot(path.join(OUT, '6-los-pagados.png'));
    // La Papelera esconde una pista desde el día 3: la E
    await ev('SN.State.run.day = 3; true');
    await clickSel('.dt-icon[data-app="trash"]');
    await b.sleep(300);
    await ev('[...document.querySelectorAll(".tr-file")].find((x) => x.textContent.includes("no_abrir")).click(); true');
    ok(await wait('SN.Cipher.knows("E")', 2000), 'no_abrir.txt (Papelera) esconde una letra: la E');
    ok(await wait('!!document.querySelector(".cx-stamp")', 2000), 'encontrar un símbolo se nota: sello en pantalla');
    await b.screenshot(path.join(OUT, '7-simbolo.png'));
    await clickSel('.dt-icon[data-app="chat"]');
    await clickSel('.ch-tab.ser');
    await b.sleep(200);
    const ser1 = await ev('document.querySelector(".ch-log").textContent');
    ok(ser1 !== ser0 && /E/.test(ser1), `el mensaje se traduce un poco (${ser1.trim()})`);
    ok(await ev('!document.querySelector(\'.dt-icon[data-app="symbols"]\').classList.contains("hidden")'), 'aparece la app Símbolos');
    await clickSel('.dt-icon[data-app="symbols"]');
    ok(await wait('document.querySelectorAll(".sy-cell.on").length === 1', 2000), 'Símbolos enseña la letra descubierta');
    await b.screenshot(path.join(OUT, '8-simbolos.png'));
    ok(await ev('JSON.parse(localStorage.getItem("saldonegro.run.v1")).cipher.known.E === true'), 'la letra se guarda en la partida (una partida nueva empieza sin letras)');
    for (let i = 0; i < 8 && await ev('SN.Desktop.open'); i++) await b.key('Escape');
    await wait('!SN.Desktop.open', 2000);

    // Durante una operación no se puede minimizar
    await b.sleep(400);
    await clickSel('#btn-buy');
    await wait('!!SN.State.run.position', 3000);
    await b.key('KeyD', 'd');
    ok(!(await ev('SN.Desktop.open')), 'con una operación en marcha no se minimiza');
    ok(await ev('!!SN.State.run.chat && SN.State.run.chat.log.length > 3'), 'la conversación queda guardada en la partida');
    // Notas.txt: nada se sale de la ventana
    await wait('!SN.State.run.position && !SN.UI.busy', 30000);
    await ev('document.getElementById("desktop").classList.remove("hidden"); SN.Desktop.launch("notes"); true');
    await b.sleep(400);
    ok(await ev('(() => { const w = SN.Desktop.wins.notes, b = w.querySelector(".dt-body"), p = w.querySelector(".nt"); return p.scrollWidth <= b.clientWidth + 1 && (p.offsetHeight <= b.clientHeight || getComputedStyle(b).overflowY === "auto"); })()'), 'Notas.txt no se sale de su ventana');
    await ev('SN.Desktop.closeWin("notes"); if (!SN.Desktop.open) document.getElementById("desktop").classList.add("hidden"); true');
    await b.sleep(300);
    // La historia de Kevo sigue los hitos: pagar la deuda, cada regalo, el rescate...
    const arc = await ev(`(() => {
      const D = SN.Desktop, ch = D.chat(), ids = SN.Data.chat.convos.map((c) => c.id);
      clearTimeout(D.timer); D.timer = null;
      const start = (i) => {
        ch.i = i; ch.phase = 'wait'; ch.side = null;
        D.check();
        clearTimeout(D.timer); D.timer = null;
        const id = ch.phase === 'in' && D.convo() ? D.convo().id : null;
        ch.phase = 'wait';
        return id;
      };
      SN.State.run.day = 20;
      const out = {};
      out.esperaDeuda = start(ids.indexOf('libre'));
      D.flag('debtPaid'); ch.clock += 1;
      out.libre = start(ids.indexOf('libre'));
      out.saltaPlazo = start(ids.indexOf('plazo'));
      D.flag('rescue'); ch.clock += 1;
      out.rescate = start(ids.indexOf('hospital'));
      ch.sideDone.rescue = true;
      // Volver a un punto de control: Kevo reacciona... mientras no haya desaparecido
      D.flag('rewind'); ch.clock += 1;
      out.rebobinaAntes = start(ids.indexOf('ventana'));
      out.goneAntes = D.kevoGone();
      D.flag('regalo4'); ch.clock += 5;
      out.madre = start(ids.indexOf('madre'));
      out.goneDespues = D.kevoGone();
      out.ultima = ids[ids.length - 1];
      return out;
    })()`);
    ok(arc.esperaDeuda === null && arc.libre === 'libre', 'las conversaciones de después de la deuda esperan a que la pagues');
    ok(arc.saltaPlazo === 'libre', 'si ya pagaste, Kevo no te pregunta por el plazo');
    ok(arc.rescate === 'rescue', 'si te rescata el presidente, Kevo reacciona antes de seguir la historia');
    ok(arc.rebobinaAntes === 'rewind' && !arc.goneAntes, 'mientras Kevo sigue ahí, reacciona a lo que te pasa (volver a un punto de control)');
    ok(arc.goneDespues && arc.madre === 'madre', 'desaparecido Kevo, ya no reacciona ("no contestas desde ayer"...): la historia sigue con su madre');
    ok(arc.madre === 'madre' && arc.ultima === 'mira', 'Kevo sigue hasta el final (su madre escribe tras el regalo que abre Minería)');
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
