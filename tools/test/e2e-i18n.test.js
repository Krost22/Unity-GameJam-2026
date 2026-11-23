// Idiomas y volumen en Chrome sin ventana: el juego en cada idioma (menú, ajustes, partida, tienda,
// periódico, escritorio), sin textos en español a la vista; el selector de idioma de Ajustes con sus banderas (recarga en el
// idioma nuevo y la partida guardada se pasa al idioma), y el control de volumen (barra, - y +, se guarda).
// Uso: node tools/test/e2e-i18n.test.js [carpeta de capturas]
'use strict';
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp');

const OUT = process.argv[2] || path.join(__dirname, 'shots-i18n');
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else fail++; console.log(`  ${c ? 'ok   ' : 'FALLO'}: ${msg}`); };

// Palabras que delatan un texto en español (en un texto que debería estar en otro idioma; en portugués, solo las
// que no existen en portugués)
const SPANISH = {
  en: /\b(el|los|las|del|que|una|tus|para|con|sin|hoy|día|días|más|mercado|deuda|dinero|apuesta|tienda|noticias|cobrar|esperar|ajustes|pulsa|turno)\b|[ñ¿¡]/i,
  pt: /\b(el|los|las|del|una|tus|con|sin|hoy|día|días|deuda|dinero|apuesta|tienda|noticias|ajustes|pulsa|mejoras|ganancias?|desconocido)\b|[ñ¿¡]/i,
  // Los demás: solo palabras que no existen en ninguno de ellos (los, las, del, con... sí existen en alguno)
  other: /\b(hoy|días|deuda|dinero|apuesta|tienda|noticias|ajustes|pulsa|mejoras|cobrar|ganancias?|desconocido|también|todavía)\b|[ñ¿¡]/i,
  // En catalán "cobrar" se escribe igual
  ca: /\b(hoy|días|deuda|dinero|apuesta|tienda|noticias|ajustes|pulsa|mejoras|ganancias?|desconocido|también|todavía)\b|[ñ¿¡]/i,
};
let LANG = 'en';
// Lo que puede quedarse igual en cualquier idioma (nombres propios, marcas, el título)
const ALLOW = /Español|SALDO NEGRO|Pleyzeta|PLEYZETA|Trompa|Bravo Fines|Kevo|RÓLEZ|YAMAJA|SAMSONG|iFON|Doña Rosa|déjà vu|Mercado negro|mercado negro|MERCADO NEGRO|Academia|Mineração|Música|Tela cheia|Notícias|Dívida|dívida|Você|você|Lixeira|Símbolos|Saúde|Sorte|Melhorias|Análise|Resistência|Negócios/g;

(async () => {
  const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');
  const b = await launch(url, { width: 1280, height: 720, port: 9405 });
  const ev = (js) => b.evaluate(js);
  const wait = async (js, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(js)) return true; } catch (_) { /* recargando */ } await b.sleep(100); } return false; };
  const shot = (n) => b.screenshot(path.join(OUT, n + '.png'));
  // Texto visible en la pantalla del monitor que parece español (quitando lo que puede quedarse igual)
  const leftovers = async () => {
    const txt = await ev('document.getElementById("screen").innerText + "\\n" + [...document.querySelectorAll("#screen [title]")].map((e) => e.title).join("\\n")');
    return txt.split('\n').map((l) => l.trim()).filter((l) => l && SPANISH[LANG].test(l.replace(ALLOW, '')));
  };
  const boot = async (lang) => {
    LANG = SPANISH[lang] ? lang : 'other';
    await ev(`localStorage.removeItem('saldonegro.run.v1'); localStorage.setItem('saldonegro.profile.v1', JSON.stringify({ introSeen: true, tutorialDone: true, tutorialV: 4, runs: 0, bestCapital: 0, settings: { music: false, sfx: false, lang: '${lang}', volume: 1 } })); location.reload(); true`).catch(() => {});
    await b.sleep(800);
    await wait('!!document.querySelector("#boot .thanks button")');
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")');
  };
  const play = async () => {
    await ev('document.getElementById("btn-new").click(); true');
    await wait('SN.Game.state === "INTRO"'); await ev('SN.Cine.skip(); true');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy');
    await b.sleep(400);
  };
  try {
    await wait('!!document.querySelector("#boot .thanks button")');
    const LANGS = await ev('SN.I18n.LANGS.map((l) => l.id)');
    for (const lang of LANGS.filter((l) => l !== 'es')) {
      console.log(`-- ${lang} --`);
      await boot(lang);
      ok(await ev('SN.I18n.lang') === lang && await ev('document.documentElement.lang') === lang, `el juego arranca en ${lang}`);
      const words = { en: ['New game', 'Settings'], pt: ['Novo jogo', 'Configurações'] }[lang] || await ev(`[SN.T('Nueva partida'), SN.T('Ajustes')]`);
      ok(await ev(`document.getElementById("btn-new").textContent.trim() === ${JSON.stringify(words[0])} && document.getElementById("btn-menu-settings").textContent.trim() === ${JSON.stringify(words[1])}`), `menú traducido (${words.join(', ')})`);
      await shot(`${lang}-1-menu`);
      // Ajustes: idioma y volumen
      await ev('document.getElementById("btn-menu-settings").click(); true');
      await wait('SN.Windows.current === "settings"', 3000);
      await b.sleep(600); // (la ventana entra con una animación)
      const names = await ev('SN.I18n.LANGS.map((l) => l.name).join("|")');
      ok(await ev(`[...document.querySelectorAll(".set-langs .btn")].map((b) => b.textContent).join("|")`) === names, `Ajustes ofrece todos los idiomas (${names})`);
      ok(await ev('document.querySelectorAll(".set-langs .btn canvas.flag").length === SN.I18n.LANGS.length && [...document.querySelectorAll(".set-langs canvas.flag")].every((c) => c.width === 17 && c.height === 11)'), 'cada idioma tiene su bandera');
      ok(await ev(`document.querySelector('.set-lang-cur').textContent.includes(SN.I18n.name('${lang}')) && !!document.querySelector('.set-lang-cur canvas.flag')`), 'el botón enseña la bandera y el nombre del idioma actual');
      ok(await ev(`document.querySelector('.set-langs .btn[data-lang="${lang}"]').classList.contains('btn-green')`), 'el idioma actual está marcado');
      await ev('document.querySelector(".vol-b:first-child").click(); document.querySelector(".vol-b:first-child").click(); true');
      ok(await ev('SN.Audio.volume === 0.8 && JSON.parse(localStorage.getItem("saldonegro.profile.v1")).settings.volume === 0.8 && document.querySelector(".vol-pct").textContent === "80%"'), 'el botón - baja el volumen de 10 en 10 y se guarda');
      const bar = await ev('(() => { const r = document.querySelector(".vol-bar").getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; })()');
      await b.click(bar.x + bar.w * 0.31, bar.y);
      ok(await ev('SN.Audio.volume === 0.3'), `un clic en la barra pone el volumen (${await ev('SN.Audio.volume')})`);
      await ev('document.querySelectorAll(".vol-b")[1].click(); true');
      ok(await ev('SN.Audio.volume === 0.4'), 'el botón + lo sube');
      // (la lista se abre al final: tapa la barra del volumen)
      await ev('document.querySelector(".set-lang-cur").click(); true');
      ok(await ev('!document.querySelector(".set-langs").classList.contains("hidden")'), 'el botón abre la lista de idiomas');
      await shot(`${lang}-2-ajustes`);
      await ev('document.querySelector(".set-win .win-body").click(); true');
      ok(await ev('document.querySelector(".set-langs").classList.contains("hidden")'), 'un clic fuera cierra la lista');
      const sl = await leftovers();
      ok(!sl.length, 'Ajustes sin español' + (sl.length ? ': ' + sl.join(' | ') : ''));
      await ev('SN.Windows.close(); true');
      // La partida
      await play();
      await shot(`${lang}-3-partida`);
      let lo = await leftovers();
      ok(!lo.length, 'la partida sin español' + (lo.length ? ': ' + lo.join(' | ') : ''));
      await ev('document.getElementById("nav-shop").click(); true');
      await wait('SN.Windows.current === "shop"', 3000);
      for (const cat of ['destacados', 'clave', 'mejoras', 'estilo', 'mercados']) {
        await ev(`document.querySelector('.sh-nb[data-cat="${cat}"]').click(); true`);
        await b.sleep(150);
        lo = await leftovers();
        ok(!lo.length, `tienda (${cat}) sin español` + (lo.length ? ': ' + lo.join(' | ') : ''));
      }
      await shot(`${lang}-4-tienda`);
      await ev('SN.Windows.close(); document.getElementById("nav-news").click(); true');
      await wait('SN.Windows.current === "news"', 3000);
      await b.sleep(200);
      lo = await leftovers();
      ok(!lo.length, 'periódico sin español' + (lo.length ? ': ' + lo.join(' | ') : ''));
      await shot(`${lang}-5-noticias`);
      await ev('document.querySelector(".np-hero").click(); true');
      await b.sleep(200);
      lo = await leftovers();
      ok(!lo.length, 'primera plana sin español' + (lo.length ? ': ' + lo.join(' | ') : ''));
      await ev('SN.Windows.close(); true');
      await b.sleep(300);
      // El escritorio
      await ev('SN.Desktop.minimize(); true');
      await wait('SN.Desktop.open', 3000);
      for (const app of ['notes', 'trash', 'chat']) await ev(`SN.Desktop.launch('${app}'); true`);
      await b.sleep(400);
      lo = await leftovers();
      ok(!lo.length, 'escritorio sin español' + (lo.length ? ': ' + lo.join(' | ') : ''));
      await shot(`${lang}-6-escritorio`);
      for (let i = 0; i < 5 && await ev('SN.Desktop.open'); i++) await b.key('Escape');
      await b.sleep(300);
    }
    // Cambiar de idioma desde Ajustes en mitad de una partida: recarga en el idioma nuevo y sus textos se pasan
    console.log('-- cambio de idioma con una partida guardada --');
    await boot('es');
    await play();
    await ev('SN.Narrative.addNews({ title: SN.T("Deuda saldada: {x}", { x: SN.T("la Pleyzeta") }), tone: "pos", art: "sello" }); SN.Save.saveRun(); true');
    const before = await ev('SN.State.run.news.map((n) => n.title).join(" / ")');
    await ev('SN.UI.openWindow("settings"); true');
    await wait('SN.Windows.current === "settings"', 3000);
    await ev('document.querySelector(\'.set-langs .btn[data-lang="en"]\').click(); true').catch(() => {});
    await b.sleep(1000);
    await wait('!!document.querySelector("#boot .thanks button")');
    ok(await ev('SN.I18n.lang') === 'en' && await ev('JSON.parse(localStorage.getItem("saldonegro.profile.v1")).settings.lang') === 'en', 'el selector cambia el idioma, lo guarda y recarga');
    await wait('(document.querySelector("#boot .thanks button")?.click(), SN.Game && SN.Game.state === "MENU")');
    await ev('document.getElementById("btn-continue").click(); true');
    await wait('SN.Game.state === "GAMEPLAY" && !SN.UI.busy', 20000);
    const after = await ev('SN.State.run.news.map((n) => n.title).join(" / ")');
    ok(/Debt paid: the Pleyzeta/.test(after) && !/Deuda saldada/.test(after) && await ev('SN.State.run.lang') === 'en', `la partida guardada pasa al idioma nuevo (${before.slice(0, 60)}… → ${after.slice(0, 60)}…)`);
    ok(await ev('SN.State.run.debt.label') === 'the Pleyzeta', `también la deuda en curso ("${await ev('SN.State.run.debt.label')}")`);
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
