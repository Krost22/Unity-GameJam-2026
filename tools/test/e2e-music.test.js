// La música en Chrome sin ventana: qué pista suena en cada momento, que los cambios esperan al compás y entran por
// el mismo punto, el bucle sin cortes, la cinta (perdiendo, sin dinero, el final) y que todos los efectos suenan.
// Uso: node tools/test/e2e-music.test.js
'use strict';
const path = require('path');
const { launch } = require('./cdp');

let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) pass++; else fail++; console.log(`  ${c ? 'ok   ' : 'FALLO'}: ${msg}${!c && extra ? ' · ' + extra : ''}`); };
const PROFILE = JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 4, runs: 0, bestCapital: 0, settings: { music: true, sfx: true } });

(async () => {
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/') + '?debug';
  const b = await launch(url, { width: 1280, height: 720, port: 9410 });
  const ev = (js) => b.evaluate(js);
  const wait = async (js, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(js)) return true; } catch (_) { /* */ } await b.sleep(100); } return false; };
  const dbg = async () => JSON.stringify(await ev('SN.Music.debug()'));
  try {
    await ev(`localStorage.clear(); localStorage.setItem('saldonegro.profile.v1', '${PROFILE}'); location.reload(); true`);
    await b.sleep(1500);
    await wait('SN.Game && (SN.Game.state === "MENU" || SN.Game.state === "BOOT")');
    // Clics de verdad (un gesto) para que el navegador deje sonar el audio
    await b.click(5, 5);
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game.state === "MENU")');
    await b.click(5, 5);

    // --- Menú, intro y partida ---
    ok(await wait('SN.Music.current === "menu1"', 4000), 'menú: suena la primera parte del tema', await dbg());
    await b.sleep(1500);
    const m1 = await ev('SN.Music.debug().menu1');
    ok(m1 && !m1.paused && m1.t > 0.5 && m1.vol > 0.1, 'menú: la pista avanza y se oye', JSON.stringify(m1));
    await ev('document.getElementById("btn-new").click()');
    await wait('SN.Game.state === "INTRO"');
    ok(await ev('SN.Music.current === "menu1"'), 'la intro sigue con el tema del menú');
    await ev('SN.Cine.skip(); true');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 10000);
    ok(await wait('SN.Music.current === "base"', 4000), 'partida: suena Background', await dbg());
    ok(await wait('(SN.Music.debug().base || {}).vol > 0.1 && !SN.Music.debug().menu1', 5000), 'el menú se va con un fundido y la partida se oye', await dbg());

    // --- Ganando: espera al compás y entra por el mismo punto ---
    await ev('SN.Music.trade({ pnl: 40, amount: 100 }); true');
    const t0 = Date.now();
    ok(await wait('SN.Music.current === "win"', 3500), 'ganando: entra Ganancia en el siguiente compás (como mucho 2.7 s)', `${Date.now() - t0} ms`);
    await b.sleep(300);
    const dw = await ev('SN.Music.debug()');
    const bar = 60 / 90 * 4, phase = (x) => ((x % bar) + bar) % bar;
    ok(dw.win && dw.base && Math.abs(phase(dw.win.t) - phase(dw.base.t)) < 0.15, 'Ganancia entra por el mismo punto del compás que Background', JSON.stringify(dw));

    // --- Perdiendo: la cinta se frena ---
    await ev('SN.Music.trade({ pnl: -60, amount: 100 }); true');
    ok(await wait('SN.Music.current === "base"', 3500), 'perdiendo: vuelve Background');
    await b.sleep(1200);
    const slow = await ev('SN.Music.state.rate');
    ok(slow < 0.98, 'perdiendo: la cinta va más lenta (y más grave)', `velocidad ${slow}`);
    await ev('SN.Music.trade({ pnl: 5, amount: 100, danger: true }); true');
    await b.sleep(1500);
    ok(await ev('SN.Music.state.rate') > slow, 'al recuperarse, la cinta vuelve a su velocidad');
    await ev('SN.Music.trade(null); SN.Music.tradeEnd(0); true');

    // --- Mercado negro, día de la suerte y Bravo Fines ---
    await ev('SN.State.run.markets.salud_negro.unlocked = true; SN.State.run.selected = "salud_negro"; true');
    ok(await wait('SN.Music.current === "black"', 3500), 'pestaña Negro: suena MercadoNegro');
    await ev('SN.State.run.selected = "salud"; SN.State.run.luck = { day: SN.State.run.day, events: [], k: 1 }; true');
    ok(await wait('SN.Music.current === "lucky"', 3500), 'día de la suerte: suena LuckyDay');
    await ev('SN.State.run.luck = null; SN.State.run.flags.academy = true; SN.Windows.open("upgrades"); true');
    ok(await wait('SN.Music.current === "bravo"', 3500), 'Academia de Bravo Fines: suena su tema');
    await ev('SN.Windows.close(); SN.Dialog.show(["Hola, soy Bravo."], { name: "Bravo Fines", portrait: "bravo", voice: "bravo" }); true');
    await b.sleep(300);
    ok(await wait('SN.Music.current === "bravo"', 3500), 'cuando habla Bravo Fines, también');
    await ev('SN.Dialog.hide(); true');
    ok(await wait('SN.Music.current === "base"', 3500), 'y después vuelve Background');

    // --- El encapuchado ---
    await ev('SN.Audio.setMood("silent"); SN.Music.sting("hood"); SN.Audio.sfx("whisper"); true');
    await b.sleep(2500);
    const dh = await ev('SN.Music.debug()');
    ok(dh.hood && !dh.hood.paused && dh.hood.vol > 0.2 && (!dh.base || dh.base.vol < 0.05), 'el encapuchado: suena su aparición y la música calla', JSON.stringify(dh));
    ok(await ev('SN.Music.tonality().root') === 66, 'mientras suena, los efectos van en su tonalidad (Fa#)');
    await ev('SN.Audio.setMood("normal"); true');

    // --- El bucle se cierra sin parar ---
    await wait('(SN.Music.debug().base || {}).vol > 0.1', 4000);
    await ev('SN.Music.seekEnd("base", 1.0); true');
    await b.sleep(1800);
    const dl = await ev('SN.Music.debug().base');
    ok(dl && !dl.paused && dl.t < 1.5, 'el bucle se cierra sin parar la música', JSON.stringify(dl));

    // --- Sin dinero y el final ---
    await ev('SN.Music.tapeStop(); true');
    await b.sleep(400);
    const tape = await ev('SN.Music.state.rate');
    ok(tape < 0.8, 'sin dinero: la cinta se frena', `velocidad ${tape}`);
    ok(await wait('SN.Music.state.stopped && SN.Music.current === null', 2500), '...hasta pararse');
    await ev('SN.Audio.setMood("normal"); true');
    ok(await wait('SN.Music.current === "base"', 2500), 'al volver el ambiente normal, vuelve la música');
    await ev('SN.Music.ending(); true');
    ok(await wait('SN.Music.current === "final"', 3500), 'el final: el tema principal...');
    await b.sleep(1500);
    ok(Math.abs(await ev('SN.Music.state.rate') - 0.891) < 0.02, '...lento y dos semitonos más grave');
    await ev('SN.Music.trade({ pnl: 1, amount: 100 }); SN.Music.trade(null); true');
    ok(await wait('SN.Music.current === "base"', 3500), 'la siguiente operación devuelve la música de la partida');

    // --- Efectos: todos suenan (también las capas a tempo) ---
    const names = ['click', 'key', 'select', 'error', 'buy', 'sell', 'candle', 'heart', 'riser', 'boom', 'crash', 'cash', 'tick', 'coin', 'coinBounce', 'win', 'loss', 'liquidation', 'unlock', 'cipher', 'lucky', 'wheel', 'pay', 'debtPaid', 'broke', 'notify', 'notifyBad', 'static', 'whisper', 'type', 'crack', 'shatter', 'pop', 'siren', 'day', 'open', 'close', 'boot', 'whoosh', 'thud', 'cheer'];
    const bad = await ev(`(() => { const bad = []; for (const n of ${JSON.stringify(names)}) { try { SN.Audio.sfx(n, {}); } catch (e) { bad.push(n + ': ' + e.message); } } for (const n of ['pulseDanger', 'pulseClock']) { try { SN.Audio.layer(n, { at: 0.05, i: 0 }); } catch (e) { bad.push(n + ': ' + e.message); } } return bad; })()`);
    ok(!bad.length, 'todos los efectos suenan sin errores', bad.join(', '));

    // --- Ajustes ---
    await ev('SN.Audio.setMusic(false); true');
    ok(await wait('Object.values(SN.Music.debug()).every((v) => v.paused || v.vol < 0.01)', 3500), 'apagar la música en AJUSTES la calla');
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
