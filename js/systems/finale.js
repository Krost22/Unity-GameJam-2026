// FinaleManager: la meta final y los dos finales (los textos, en js/data/finale.js).
//   start()    -> al llegar a la meta: Kevo escribe por última vez, LOS DESFASADOS entregan lo que falta de NULL.EXE
//                 y se abre el mercado TÚ (los demás se bloquean)
//   elección   -> la última oferta del encapuchado (FINAL A) o NULL.EXE en el escritorio (FINAL B). Si no eliges,
//                 la oferta vuelve cada turno y a la tercera la entidad elige por ti: no decidir también es decidir
//   endingA()  -> el avatar perfecto (sin pala: termina con el gato)
//   endingB()  -> NULL.EXE: la terminal, el colapso, la X, las farolas, la despedida... y el epílogo B (la carta
//                 con la pala, Hacienda y el periódico con Bravo Fines detenido)
// Al terminar: FIN, créditos, la partida se cierra y se vuelve al menú. LA PALA solo se gana con el final B.
// Mientras dura un final no se guarda la partida: si se recarga, se vuelve a la elección.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util, P = SN.PAL;
  const $ = (id) => document.getElementById(id);
  const F = () => D.finale;
  const wait = (s) => SN.wait(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // El embargo del final B: el orden en que el agente se lleva las cosas, según están en la habitación (de la
  // ventana a la consola), para que la cruce de un lado al otro en vez de ir dando saltos
  const RAID_ORDER = ['lampara', 'planta', 'tele', 'moto', 'taza', 'maneki', 'trebol4', 'herradura', 'reloj', 'teclado', 'billete7',
    'movil', 'alfombrilla', 'cascos', 'poster', 'trofeo', 'pleyzeta'];

  // Parte un texto en líneas cortas (para los planos en negro)
  function wrap(text, max = 40) {
    const out = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
    }
    if (line) out.push(line);
    return out;
  }

  const Fin = SN.Finale = {
    busy: false,   // un final en marcha
    term: null,    // la terminal de NULL.EXE: { prompt, lines, typing } (la pinta js/ui/desktop.js)
    you: null,     // la gráfica del mercado TÚ
    t: 0,

    st() { const run = S.run; if (!run) return {}; if (!run.finale) run.finale = { phase: null, insist: 0 }; return run.finale; },
    active() { const f = S.run && S.run.finale; return !!(f && f.phase); },
    choosing() { const f = S.run && S.run.finale; return !!(f && f.phase === 'choice') && !this.busy; },

    // ---------- La meta final ----------
    async start() {
      const f = this.st();
      if (f.phase) return;
      f.phase = 'prelude';
      SN.Windows.close(true);
      // Kevo se conecta una última vez: "mira por la ventana"
      await SN.Desktop.playConvo('mira');
      await wait(0.8);
      // LOS DESFASADOS: lo que les queda por decir, con la última parte de NULL.EXE
      await SN.Desktop.serFlush();
      S.run.nullParts = 3;
      SN.Desktop.renderIcons();
      await wait(0.6);
      // Se abre el mercado TÚ: los demás se bloquean y ya no se puede operar
      f.phase = 'choice';
      f.insist = 0;
      this.showYou(true);
      SN.FX.glitch(0.9, 1.6);
      SN.Audio.sfx('notifyBad');
      // El aviso, en dos líneas y por encima del mercado TÚ (en una línea a 24 px no cabía en la pantalla y
      // además quedaba por debajo del panel del mercado)
      const [w1, w2] = F().you.warn.split(': ');
      await SN.UI.stamp(w2 ? `${esc(w1)}:<br>${esc(w2)}` : esc(F().you.warn), 'coral fin-warn', '', 2.4);
      this.enterChoice();
      SN.Save.saveRun();
    },

    // Al cargar una partida que estaba en el final: de vuelta a la elección
    resume() {
      const f = this.st();
      f.phase = 'choice';
      f.lock = false;
      S.run.nullParts = 3;
      this.showYou(true);
      SN.Desktop.renderIcons();
      this.enterChoice();
    },

    enterChoice() {
      SN.UI.allow = ['skip', 'settings', 'window'];
      SN.UI.renderAll();
      this.offerPact();
    },

    // La última oferta (salta sola; vuelve cada turno)
    offerPact() {
      if (!this.choosing() || SN.Desktop.open || SN.Dialog.active) return;
      if (SN.Windows.current && SN.Windows.current !== 'pact') SN.Windows.close(true);
      SN.Windows.open('pact');
    },

    async choose(which) {
      if (!this.choosing()) return;
      this.busy = true;
      const f = this.st();
      f.phase = which;
      f.lock = true; // mientras dura el final, no se guarda
      SN.UI.setBusy(true);
      SN.UI.allow = [];
      SN.Windows.close(true);
      SN.Dialog.hide();
      SN.HeroSay.clear();
      try {
        if (which === 'A') await this.endingA();
        else await this.endingB();
      } catch (e) {
        console.error(e);
        this.finish(which);
      }
    },

    // ---------- El mercado TÚ ----------
    showYou(on) {
      $('app').classList.toggle('finale', on);
      $('finale').classList.toggle('hidden', !on);
      $('finale-trade').classList.toggle('hidden', !on);
      if (!on) return;
      if (!this.you) {
        // Velas que suben sin parar: lo que vales para la entidad
        const c = [];
        let v = 40;
        for (let i = 0; i < 26; i++) { const o = v; v = Math.max(8, v + U.rand(-3, 6)); c.push({ o, c: v, h: Math.max(o, v) + U.rand(0, 3), l: Math.min(o, v) - U.rand(0, 3) }); }
        this.you = { c, t: 0, fall: 0 };
      }
      this.renderYou();
    },
    renderYou() {
      const box = $('finale');
      const Y = F().you, run = S.run;
      const zero = this.you && this.you.fall > 0.5;
      const cards = D.markets.map((d) => `<div class="fz-card off"><i data-ico="${d.icon}"></i><span>${esc(d.short)}</span>${zero ? '<b>$0</b>' : '<i data-ico="lock"></i>'}</div>`).join('');
      box.innerHTML = `<div class="fz-side">${cards}<div class="fz-card you"><i data-ico="avaTu"></i><span>${esc(Y.name)}</span><b>${esc(Y.tag)}</b></div></div>
        <div class="fz-main"><div class="fz-head"><i data-ico="avaTu"></i><b>${esc(Y.label)}</b><span class="fz-price">${U.money(run ? run.capital : 0)}</span></div>
        <canvas id="fz-chart" width="222" height="140"></canvas><div class="fz-warn">${esc(Y.warn)}</div></div>`;
      box.querySelectorAll('[data-ico]').forEach((i) => i.appendChild(SN.Sprites.node(i.dataset.ico, 1)));
      const ft = $('finale-trade'), C = F().choice;
      ft.innerHTML = `<p class="ft-t">${esc(C.title)}</p><button id="btn-pact" class="btn btn-yellow">${esc(C.offer)}</button><p class="ft-or">${esc(C.or)}</p><button id="btn-fmin" class="btn btn-cyan">${esc(C.min)}<kbd>D</kbd></button>`;
      ft.querySelector('#btn-pact').addEventListener('click', () => { SN.Audio.sfx('select'); this.offerPact(); });
      ft.querySelector('#btn-fmin').addEventListener('click', () => {
        if (!this.choosing() || SN.UI.busy) return;
        SN.Windows.close(true);
        SN.Desktop.minimize('null');
      });
      this.drawYou();
    },
    drawYou() {
      const cv = $('fz-chart');
      if (!cv || !this.you) return;
      const g = SN.Px.ctx(cv), W = cv.width, H = cv.height, Y = this.you;
      g.fillStyle = '#16123A'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#221C4E';
      for (let y = 14; y < H; y += 18) g.fillRect(0, y, W, 1);
      for (let x = 20; x < W; x += 28) g.fillRect(x, 0, 1, H);
      const keep = 1 - Y.fall; // al ejecutar NULL.EXE, todo cae a cero
      const vals = Y.c.flatMap((k) => [k.h, k.l]);
      const lo = 0, hi = Math.max(...vals) + 6;
      const yOf = (v) => Math.round(H - 8 - (v * keep - lo) / (hi - lo) * (H - 20));
      const n = Y.c.length, step = Math.floor((W - 30) / n);
      Y.c.forEach((k, i) => {
        const x = 6 + i * step, up = k.c >= k.o;
        const col = Y.fall > 0 ? '#5A5070' : up ? P.green : P.coral;
        g.fillStyle = col;
        g.fillRect(x + 2, yOf(k.h), 1, Math.max(1, yOf(k.l) - yOf(k.h)));
        const top = yOf(Math.max(k.o, k.c)), bot = yOf(Math.min(k.o, k.c));
        g.fillRect(x, top, 5, Math.max(1, bot - top));
      });
      // Precio: lo que tienes (y, al final, cero)
      const last = Y.c[n - 1];
      const py = yOf(last.c);
      g.fillStyle = Y.fall > 0 ? P.coral : P.yellow;
      g.fillRect(0, py, W, 1);
      const price = $('finale').querySelector('.fz-price');
      if (price && S.run) price.textContent = U.money(Y.fall > 0 ? Math.round(S.run.capital * keep) : S.run.capital);
    },

    update(dt) {
      this.t += dt;
      const Y = this.you;
      if (!Y || $('finale').classList.contains('hidden')) return;
      if (Y.fall > 0 && Y.fall < 1) Y.fall = Math.min(1, Y.fall + dt / 2.6);
      if (Y.fall === 0 && (Y.t += dt) > 0.45) {
        // Cada medio segundo, otra vela que sube
        Y.t = 0;
        const o = Y.c[Y.c.length - 1].c, c = o + U.rand(-2, 5);
        Y.c.push({ o, c, h: Math.max(o, c) + U.rand(0, 2), l: Math.min(o, c) - U.rand(0, 2) });
        Y.c.shift();
      }
      this.drawYou();
    },

    // ---------- Herramientas de las escenas ----------
    // Subtítulo (fuera del monitor). auto: segundos hasta seguir solo; si no, clic para seguir
    async say(name, text, auto = 0) {
      const C = SN.Cine;
      const was = C.running;
      C.running = true; C.canSkip = false; C.skipping = false;
      try { await C.say(name, text, { auto }); } finally { C.running = was; }
    },
    // Plano en negro con varias líneas (cada una partida para que quepa)
    async black(lines, dur) {
      const rows = lines.flatMap((l) => wrap(l.text).map((text) => ({ text, color: l.color || P.creamL, t: 0 })));
      SN.Cine.setShot({ type: 'black', lines: rows.slice(0, 6), lineT: 0 });
      await wait(dur);
    },
    // Panel en la pantalla del monitor o en todo el escenario, con un botón para seguir.
    // [data-ico]: un icono de pixel art; after(el): para meter lo que no es HTML (la foto del periódico)
    panel(html, cls, where = 'layer-top', btn = 'Seguir', after = null) {
      return new Promise((resolve) => {
        const el = U.el('div', 'fin-panel ' + cls, html);
        el.querySelectorAll('[data-ico]').forEach((i) => i.appendChild(SN.Sprites.node(i.dataset.ico, 2)));
        if (after) after(el);
        const b = U.el('button', 'btn btn-yellow fin-next', esc(btn) + '<kbd>⏎</kbd>');
        el.appendChild(b);
        $(where).appendChild(el);
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          document.removeEventListener('keydown', onKey, true);
          el.classList.add('out');
          SN.after(0.3, () => { el.remove(); resolve(); });
        };
        const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); finish(); } };
        b.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('select'); finish(); });
        SN.after(0.6, () => { if (!done) document.addEventListener('keydown', onKey, true); });
      });
    },
    // Onomatopeya de cómic sobre el escenario (coordenadas del escenario de 640x360)
    comic(text, x, y) {
      const el = U.el('div', 'fin-comic', esc(text));
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.setProperty('--r', `${U.rand(-14, 14).toFixed(0)}deg`);
      $('stage-top').appendChild(el);
      SN.after(1.1, () => el.remove());
    },
    // El gato mira a la cámara y, durante un instante, tiene la cara del encapuchado
    async catSting() {
      const H = SN.Hero;
      H.catDo('stare', 7);
      SN.Game.camTo({ x: 70, y: 316, zoom: 2.6 }, 1.6);
      await wait(2.6);
      SN.Music.sting('hood');
      H.cat.hoodT = 0.5;
      SN.Audio.sfx('heart');
      await wait(1.8);
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 1.4);
      await wait(1.2);
    },
    // La pantalla se apaga (todo a negro)
    async powerOff() {
      SN.Audio.sfx('powerOff');
      const fade = $('fade');
      fade.style.transition = 'opacity .9s steps(6)';
      fade.style.opacity = '1';
      await wait(1.4);
    },

    // ---------- FINAL A: el avatar perfecto ----------
    async endingA() {
      const A = F().a;
      if (SN.Desktop.open) SN.Desktop.restore();
      SN.Audio.setMood('tense');
      // FUTURO.EXE absorbe la interfaz
      SN.Audio.sfx('static', { dur: 1.4 });
      SN.FX.glitch(1.6, 2.6);
      $('screen').classList.add('glitch');
      $('app').classList.add('absorb');
      await wait(2.4);
      $('screen').classList.remove('glitch');
      // El encapuchado aparece frente al protagonista y se funde con él
      SN.Music.sting('hood');
      SN.Audio.sfx('whisper');
      SN.Cine.setShot({ type: 'face', expr: 'shocked', night: true, opts: { hoodIn: 4.5 } });
      await wait(1.6); SN.Audio.sfx('heart');
      await wait(1.6); SN.Audio.sfx('heart');
      await wait(2.4);
      // La habitación pierde sus colores y las gráficas se salen del monitor
      SN.Cine.setShot(null);
      SN.Audio.setMood('normal');
      SN.Music.force('black');
      $('desk').classList.add('gray');
      SN.Desk.crawl = 0.01;
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.01);
      await wait(4.5);
      await this.black(A.fusion.map((text) => ({ text })), 6);
      // FUTURO.EXE vuelve a arrancar... para el siguiente usuario
      SN.Music.force('menu1');
      SN.Audio.sfx('boot');
      await this.black(A.admin.map((text) => ({ text, color: P.yellow })), 6.5);
      await this.black([{ text: A.kevo, color: P.creamD }], 4.5);
      SN.Cine.setShot(null);
      // Epílogo A: sin pala. Solo el gato
      await wait(1.2);
      await this.catSting();
      await this.powerOff();
      await this.theEnd('A');
    },

    // ---------- FINAL B: NULL.EXE ----------
    async endingB() {
      const T = F().term;
      // 1) La terminal: primero se comprueba qué es el encapuchado; luego, la secuencia de NULL.EXE
      SN.Desktop.closeWin('null');
      this.term = { prompt: T.prompt, lines: [], typing: null };
      // Mientras dure la terminal, ni se cierra ni se vuelve a FUTURO.exe (js/ui/desktop.js): el final espera a que
      // escribas en ella, y si se cerraba se quedaba esperando para siempre
      this.termLock = true;
      SN.Desktop.launch('term');
      SN.Music.pulse('danger');
      const money = U.money(S.run.capital);
      for (const s of T.intro.concat(T.steps)) {
        await this.typeCmd(s.cmd);
        for (const o of s.out) { this.termLine(o.replace('{capital}', money)); SN.Audio.sfx('tick'); await wait(0.35); }
        if (s.hood) {
          SN.FX.glitch(0.6, 1.1);
          SN.Audio.sfx('static', { dur: 0.4 });
          await this.say('???', s.hood, 2.4);
        }
        await wait(0.4);
      }
      SN.Music.pulse(null);
      // 2) EXECUTE: los mercados y el mercado TÚ caen a cero, y el dinero desaparece
      await wait(0.6);
      this.termLock = false;
      SN.Desktop.closeWin('term');
      SN.Desktop.restore();
      await wait(0.5);
      SN.Music.tapeStop(1.6);
      SN.Audio.sfx('collapse');
      SN.FX.shake(3, 1.2);
      this.you.fall = 0.001;
      $('finale').classList.add('falling');
      SN.Economy.spend(S.run.capital, 'null');
      await wait(2.8);
      this.renderYou();
      // 3) El encapuchado, con miedo
      SN.FX.glitch(1, 2);
      for (const l of T.fear) await this.say('???', l, 2.2);
      // 4) Por primera vez, FUTURO.EXE tiene una X
      await this.waitX();
      // 5) SYSTEM RESET COMPLETE... y la aplicación desaparece
      SN.Audio.sfx('powerOff');
      await this.black(T.done.map((text, i) => ({ text, color: i === 2 ? P.coral : P.green })), 5);
      $('app').classList.add('hidden');
      $('screen').classList.add('off');
      S.run.nullParts = 0; // NULL.EXE ya se ha ejecutado: desaparece del escritorio
      SN.Desktop.renderIcons();
      SN.Cine.setShot(null);
      // 6) La pantalla en negro... y, de noche, por la ventana, las farolas se encienden una a una
      SN.Desk.phaseOverride = 'night';
      SN.Desk.dirty();
      SN.Music.force('final');
      SN.Game.camTo({ x: 100, y: 120, zoom: 2 }, 1.6);
      await wait(1.2);
      SN.Desk.windowEvent('farolas');
      await wait(7);
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 1.4);
      await wait(1.2);
      // 7) LOS DESFASADOS se despiden (el escritorio, ya sin FUTURO.EXE)
      $('screen').classList.remove('off');
      SN.Desktop.noApp = true;
      SN.Desktop.open = true;
      $('desktop').classList.remove('hidden');
      SN.Desktop.renderIcons();
      SN.Desktop.contact = 'ser';
      SN.Desktop.launch('chat');
      SN.Desktop.contact = 'ser';
      SN.Desktop.renderChat();
      await wait(1);
      await SN.Desktop.serFarewell(F().farewell);
      await wait(1.2);
      for (const l of F().b.alive) await this.say('', l, 2.6);
      await this.say('', F().b.kevo, 2.8);
      await this.epilogueB();
    },

    // La X de FUTURO.EXE (no la había tenido nunca): clic para cerrarla
    waitX() {
      return new Promise((resolve) => {
        const x = $('btn-x');
        x.classList.remove('hidden');
        x.classList.add('call');
        SN.Audio.sfx('notify');
        const done = (e) => {
          if (e) e.stopPropagation();
          x.removeEventListener('click', done);
          document.removeEventListener('keydown', onKey, true);
          x.classList.add('hidden');
          x.classList.remove('call');
          SN.Audio.sfx('click');
          resolve();
        };
        const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); } };
        x.addEventListener('click', done);
        document.addEventListener('keydown', onKey, true);
      });
    },

    // ---------- La terminal ----------
    termLine(t, k) { if (!this.term) return; this.term.lines.push({ t, k }); SN.Desktop.renderTerm(); },
    // Espera a que el jugador "escriba" el comando (cualquier tecla pone unas letras) y lo ejecuta
    typeCmd(cmd) {
      return new Promise((resolve) => {
        this.term.typing = { text: cmd, shown: 0, resolve };
        SN.Desktop.renderTerm();
      });
    },
    termKey(e) {
      const T = this.term, ty = T && T.typing;
      if (!ty) return false;
      e.preventDefault();
      if (ty.shown >= ty.text.length) {
        if (e.code === 'Enter' || e.code === 'Space') this.runCmd();
        return true;
      }
      if (e.repeat && Math.random() > 0.35) return true;
      ty.shown = Math.min(ty.text.length, ty.shown + 1 + Math.floor(Math.random() * 3));
      SN.Hands.tapKey(e.code);
      SN.Desktop.renderTerm();
      // Escrito entero: se ejecuta solo enseguida
      if (ty.shown >= ty.text.length) SN.after(0.45, () => { if (this.term && this.term.typing === ty) this.runCmd(); });
      return true;
    },
    runCmd() {
      const T = this.term, ty = T && T.typing;
      if (!ty) return;
      T.typing = null;
      T.lines.push({ t: T.prompt + ty.text, k: 'cmd' });
      SN.Audio.sfx('select');
      SN.Desktop.renderTerm();
      ty.resolve();
    },

    // ---------- Epílogo B: la pala... y Hacienda ----------
    async epilogueB() {
      const L = F().letter, run = S.run;
      // La carta del servicio de compensación, en la pantalla, y la pala
      SN.Desktop.closeWin('chat');
      SN.Audio.sfx('notify');
      await this.panel(`<div class="lt-head">${esc(L.head)}</div>${L.body.map((l) => `<p>${esc(l)}</p>`).join('')}
        <div class="lt-gift"><i data-ico="pala"></i><b>${esc(L.gift)}</b></div><p class="lt-foot">«${esc(L.foot)}»</p>`, 'fin-letter', 'layer-top', 'Seguir');
      await this.raid();
      // El protagonista llora en la habitación vacía
      SN.Cine.setShot({ type: 'face', expr: 'cry', night: true, opts: { tears: true } });
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.01);
      await wait(4.2);
      SN.Cine.setShot(null);
      // A la mañana siguiente, el periódico
      SN.Desk.phaseOverride = 'morning';
      SN.Desk.dirty();
      SN.Music.force('bravo');
      SN.Audio.sfx('whoosh');
      const N = F().paper;
      const html = `<div class="np-mast">${esc(N.mast)}</div><div class="np-sub"><span>Día ${run.day + 1}</span><span>Edición de la ciudad</span><span>$1</span></div>
        <div class="np-front"><div class="np-ph"></div><div class="np-fcol"><span class="np-tag neg">${esc(N.kicker)}</span><div class="h">${esc(N.title)}</div>
        ${N.lines.map((l) => `<p class="t">${esc(l)}</p>`).join('')}<p class="cap">${esc(N.caption)}</p></div></div>`;
      await this.panel(html, 'fin-paper', 'stage-top', 'Seguir',
        (el) => el.querySelector('.np-ph').appendChild(SN.NewsArt.node('bravoDetenido', 'neg', 0, null, { color: true })));
      SN.Music.force(null);
      await this.catSting();
      await this.powerOff();
      await this.theEnd('B');
    },

    // El embargo: el agente de la Policía Fiscal entra en la habitación por el lado de la ventana (de cuerpo entero,
    // por detrás de la mesa y del monitor: lo dibuja js/render/officer.js), lee la lista, rodea el monitor para
    // repartir y luego recorre el cuarto metiendo en su caja, uno a uno, todo lo que tienes. Al final empuja el PC
    // hasta la puerta... y te deja la pala.
    async raid() {
      const Pz = F().police, run = S.run, O = SN.Officer, Dk = SN.Desk;
      const cop = async (text, auto) => { O.talk = true; try { await this.say(Pz.name, text, auto); } finally { O.talk = false; } };
      // Llaman a la puerta
      Dk.palaHere = true;
      Dk.dirty();
      for (let i = 0; i < 3; i++) { SN.Audio.sfx('knock'); SN.FX.shake(2, 0.15); await wait(0.32); }
      await this.say(Pz.name, Pz.knock, 2);
      // No espera a que abras: entra (y al gato no le hace ninguna gracia)
      SN.Audio.sfx('thud');
      SN.FX.shake(3, 0.3);
      SN.Hero.catDo('arch', 2.4, 'hiss');
      O.occlude(['cascos', 'trofeo', 'pleyzeta']); // lo que está en la mesa por delante de él, cuando pase por la derecha
      await O.enter(25);
      await wait(0.3);
      // La lista: lo que el jugador tiene de verdad (la consola primero)
      const ids = ['pleyzeta', ...D.keyItems.map((k) => k.id), ...D.shop.map((s) => s.id), ...(D.luck && D.luck.golden ? D.luck.golden.map((g) => g.id) : [])]
        .filter((id) => id === 'pleyzeta' || run.owned[id]);
      const names = ids.map((id) => Pz.goods[id]).filter(Boolean);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
      O.prop = 'list';
      await cop(Pz.read.replace('{list}', list));
      const last = ids[ids.length - 1];
      if (Pz.objection[last]) { await this.say(Pz.me, Pz.objection[last], 1.8); await cop(Pz.taken, 1.8); }
      await this.say(Pz.me, Pz.defense[0], 2.2);
      await cop(Pz.defense[1], 2.2);
      O.prop = null;
      // Los golpes, fuera de plano: rodea el monitor hacia ti (se pierde detrás de la pantalla) y la cámara se va
      // a la ventana
      await O.walkTo(96, 110);
      SN.Game.camTo({ x: 96, y: 112, zoom: 2.4 }, 0.6);
      await wait(0.7);
      Dk.handsOff = true; // te aparta de la mesa: ya no vuelves a tocar el teclado
      const hits = [[30, 60], [92, 92], [40, 130], [110, 52], [70, 150]];
      for (let i = 0; i < 5; i++) {
        this.comic(Pz.hits[i % Pz.hits.length], hits[i][0], hits[i][1]);
        SN.Audio.sfx('punch');
        SN.FX.shake(4, 0.25);
        if (i === 1) this.say(Pz.me, Pz.cries[0], 1.6);
        if (i === 3) this.say(Pz.me, Pz.cries[1], 1.6);
        await wait(0.55);
      }
      const dust = U.el('div', 'fin-dust');
      $('stage-top').appendChild(dust);
      SN.after(3.5, () => dust.remove());
      await wait(1.6);
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 1);
      await wait(0.8);
      // El embargo: el camión espera en la calle y el agente vuelve a salir de detrás del monitor, ya con la caja.
      // Recorre la habitación de la ventana a la consola, cada vez con más prisa: lo de los lados lo coge a la
      // vista; lo de la mesa, pasando por detrás de la pantalla (su mano asoma por debajo)
      Dk.windowEvent('camion');
      Dk.stripped = new Set();
      O.box = true;
      await O.walkTo(30);
      const at = (id) => { const i = RAID_ORDER.indexOf(id); return i < 0 ? RAID_ORDER.length : i; };
      const order = ids.slice().sort((a, b) => at(a) - at(b));
      for (let i = 0; i < order.length; i++) await O.take(order[i], Math.max(0.55, 1 - i * 0.04));
      await wait(0.4);
      await O.leave(110);
      // El PC, lo último: cruza hasta el otro lado del monitor y lo empuja hacia la puerta
      await this.say(Pz.me, Pz.pc[0], 2);
      await O.enter(292, 130);
      O.dir = -1;
      await cop(Pz.pc[1], 1.8);
      await O.takePC();
      SN.Audio.sfx('thud');
      SN.FX.shake(3, 0.3);
      await wait(0.8);
      // Lo único que no se embarga: vuelve a entrar en la habitación vacía, coge la pala de su rincón, te la
      // enseña... y te la deja en el escritorio
      await O.enter(250, 120);
      await O.takePala();
      await O.walkTo(Dk.PALA_DESK.x + 12, 90);
      await cop(Pz.shovel, 2.6);
      await O.givePala();
      await wait(0.4);
      await O.leave(120);
      // Te quedas a solas con ella: la cámara se acerca despacio a la pala, en la mesa vacía
      SN.Game.camTo({ x: 320, y: 250, zoom: 1.5 }, 1.6);
      await wait(2.4);
    },

    // ---------- FIN y créditos ----------
    async theEnd(which) {
      const C = F().credits;
      const extra = which === 'B' ? `<p class="cr-final">${esc(C.b)}</p><p class="cr-pala"><i data-ico="pala"></i>${esc(C.pala)}</p>` : `<p class="cr-final">${esc(C.a)}</p>`;
      SN.Music.force(which === 'B' ? 'final' : 'menu2');
      await this.panel(`<div class="cr-fin">${esc(F().end)}</div><div class="cr-title">${esc(C.title)}</div>${C.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${extra}`,
        'fin-credits', 'stage-top', C.back);
      this.finish(which);
    },

    // La partida se cierra: perfil (finales vistos y la pala) y vuelta al menú
    finish(which) {
      const prof = S.profile;
      prof.endings = Object.assign({}, prof.endings, { [which]: true });
      if (which === 'B') prof.pala = true;
      SN.Save.saveProfile();
      if (S.run) S.run.over = true;
      SN.Save.clearRun();
      this.reset();
      SN.Game.showMenu();
    },

    // Todo como estaba (al salir al menú o empezar otra partida)
    reset() {
      this.busy = false;
      this.term = null;
      this.termLock = false;
      this.you = null;
      SN.Music.force(null);
      SN.Music.pulse(null);
      SN.Cine.setShot(null);
      SN.UI.allow = null;
      SN.UI.busy = false;
      $('app').classList.remove('finale', 'absorb');
      $('finale').classList.add('hidden');
      $('finale').classList.remove('falling');
      $('finale-trade').classList.add('hidden');
      $('btn-x').classList.add('hidden');
      $('desk').classList.remove('gray');
      $('monitor').classList.remove('hidden');
      $('screen').classList.remove('off', 'glitch');
      $('stage-top').innerHTML = '';
      const fade = $('fade');
      fade.style.transition = 'opacity .6s';
      fade.style.opacity = '0';
      SN.Desk.crawl = 0;
      SN.Desk.stripped = null;
      SN.Desk.noPC = false;
      SN.Desk.palaHere = false;
      SN.Desk.palaPos = null;
      SN.Desk.handsOff = false;
      SN.Officer.reset();
      SN.Desk.phaseOverride = null;
      SN.Desk.dirty();
      SN.Desktop.noApp = false;
      SN.Desktop.reset();
      SN.Hero.cat.hoodT = 0;
    },
  };

  // ---------- Turnos durante la elección ----------
  SN.Events.on('turn:settled', () => {
    const f = S.run && S.run.finale;
    if (f && f.phase === 'choice') f.insist = (f.insist || 0) + 1;
  });
  SN.Events.on('turn:ready', () => {
    const f = S.run && S.run.finale;
    if (!f || f.phase !== 'choice' || Fin.busy) return;
    // A la tercera, la entidad elige por ti
    if (f.insist >= F().pact.turns) { Fin.choose('A'); return; }
    if (f.insist > 0) Fin.offerPact();
  });
})(window.SN);
