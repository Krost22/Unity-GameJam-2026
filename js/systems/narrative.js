// NarrativeManager: noticias, apariciones del encapuchado e hitos de la historia.
// Tras pagar la deuda, algunas ganancias generan noticias extrañas sobre la ciudad (cada vez más
// relacionadas con tus operaciones). La ciudad de la ventana se apaga y la música se vuelve rara poco a poco.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util, P = SN.PAL, Px = SN.Px, T = SN.T;
  const story = () => D.story;

  const N = SN.Narrative = {
    pending: [],   // escenas en cola (se reproducen al terminar el turno)
    hood: null,    // superposición del encapuchado en la pantalla
    profitableSinceDebt: 0,

    addNews(n) {
      const run = S.run;
      if (!run) return;
      run.news.push(Object.assign({ day: run.day, turn: run.turn, tone: 'neu' }, n));
      if (run.news.length > 80) { run.news.shift(); run.newsSeen = Math.max(0, (run.newsSeen || 0) - 1); }
      SN.Events.emit('news:added', n);
    },

    // ---------- Escena: el encapuchado aparece entre interferencias ----------
    async hoodedScene(lines, opts = {}) {
      const screen = document.getElementById('screen');
      SN.Audio.setMood('silent');
      SN.Audio.sfx('static', { dur: 0.7 });
      SN.FX.glitch(0.7, 1.6);
      screen.classList.add('glitch');
      SN.Desk.led = 'alert';
      await SN.wait(0.55);
      screen.classList.remove('glitch');
      this.hood = { t: 0, a: 0, out: false };
      SN.ScreenCanvas.take('hood');
      if (SN.Music) SN.Music.sting('hood'); // su música (antes que el susurro: así va en su tonalidad)
      SN.Audio.sfx('whisper');
      await SN.wait(0.6);
      await SN.Dialog.show(lines, { pos: { v: 'bottom', h: 'center' }, glitchy: true, smile: opts.smile });
      this.hood.out = true;
      SN.Audio.sfx('static', { dur: 0.4 });
      SN.FX.glitch(0.4, 1.2);
      await SN.wait(0.45);
      this.hood = null;
      SN.ScreenCanvas.release('hood');
      SN.Desk.led = 'idle';
      SN.Audio.setMood('normal');
    },

    renderHood(g, dt) {
      const h = this.hood;
      if (!h) return;
      h.t += dt;
      h.a = h.out ? Math.max(0, h.a - dt * 3) : Math.min(1, h.a + dt * 1.6);
      g.clearRect(0, 0, 420, 236);
      g.globalAlpha = 0.82 * h.a;
      Px.rect(g, 0, 0, 420, 236, P.coalDD);
      g.globalAlpha = 0.35 * h.a;
      for (let i = 0; i < 260; i++) Px.rect(g, U.randi(0, 419), U.randi(0, 235), U.randi(1, 2), 1, U.pick([P.coalL, P.creamDD]));
      SN.Chars.hoodBacklight(g, 210, 96, h.t, h.a);
      g.globalAlpha = h.a;
      const bob = Math.round(Math.sin(h.t * 1.6) * 2);
      const img = SN.Chars.hoodedCanvas(h.t, { smile: S.run && S.run.darkness >= 3 });
      g.drawImage(img, 0, 0, 40, 46, 170, 34 + bob, 80, 92);
      // Líneas de barrido
      g.globalAlpha = 0.12 * h.a;
      for (let y = (Math.floor(h.t * 40) % 4); y < 236; y += 4) Px.rect(g, 0, y, 420, 1, P.creamL);
      if (Math.random() < 0.06) { g.globalAlpha = 0.5 * h.a; Px.rect(g, 0, U.randi(30, 140), 420, U.randi(2, 5), U.pick([P.coral, P.cyan])); }
      g.globalAlpha = 1;
    },

    // ---------- Hitos ----------
    // Deuda pagada. La primera (la Pleyzeta) es una fiesta; las siguientes, un alivio corto.
    async onDebtPaid(auto, debt) {
      const run = S.run;
      SN.Audio.sfx('debtPaid');
      SN.Audio.sfx('cheer');
      SN.FX.flash(P.yellowL, 0.3, 0.4);
      const cap = SN.UI.posIn(document.getElementById('hud-goal'));
      SN.FX.coins(cap.x + 60, cap.y + 14, 16, 1.5);
      SN.FX.ring(cap.x + 60, cap.y + 14, P.green, 120, 0.9);
      SN.Hands.celebrate();
      SN.Desk.dirty();
      if (!debt || debt.id === 'pleyzeta') {
        SN.FX.confetti(70);
        SN.Desk.windowEvent('fuegos');
        await SN.UI.stamp(T('DEUDA SALDADA'), 'green', auto ? T('Se cobró al vencer el plazo') : T('Eres libre (más o menos)'), 2);
        await SN.Cine.faceBeat('relieved', T('Uf... Libre. Por fin.'), 2.2);
        run.flags.debtPaid = true;
        this.addNews({ title: T('Deuda saldada: la Pleyzeta ya es tuya'), tone: 'pos', art: 'sello' });
        SN.Events.emit('chat:flag', { flag: 'debtPaid' });
      } else {
        SN.FX.confetti(35);
        await SN.UI.stamp(T('DEUDA SALDADA'), 'green', auto ? T('Se cobró al vencer el plazo') : T('Pagaste {x}', { x: debt.label }), 1.6);
        this.addNews({ title: T('Deuda saldada: {x}', { x: debt.label }), tone: 'pos', art: 'sello' });
        SN.Events.emit('chat:flag', { flag: 'paid-' + debt.id });
      }
      if (debt && debt.bonusPending) await this.payBonus(debt);
      SN.UI.renderAll();
    },

    // Bono por usar la app: el encapuchado premia cada deuda saldada (así nunca empiezas la siguiente a cero)
    async payBonus(debt) {
      const bonus = debt.bonus;
      const lines = this.fill(story().payBonus, { bonus: U.money(bonus) });
      await this.hoodedScene([U.pick(lines)], { smile: true });
      // Te lo da él: es ahora cuando el dinero llega a tu cuenta
      SN.Debt.giveBonus(debt);
      const cap = SN.UI.posIn(document.getElementById('hud-capital'));
      SN.FX.coins(cap.x + 60, cap.y + 14, 12, 1.2);
      SN.FX.float(T('+{v} bono', { v: U.money(bonus) }), cap.x + cap.w / 2, cap.y + cap.h + 6, 'gain');
      SN.Audio.sfx('coin');
      SN.UI.renderHUD();
      await SN.UI.stamp(T('BONO DE LA APP'), 'green', T('+{v} por usar FUTURO.exe', { v: U.money(bonus) }), 1.4);
    },

    // Cuenta en pantalla lo que devuelve SN.Unlocks.check() o la compra de un objeto clave
    async onStep(ev) {
      if (ev.type === 'gift') await this.onGift(ev.step);
      else if (ev.type === 'goal') await this.onGoal(ev.step, ev.next);
      else if (ev.type === 'item') await this.onItem(ev);
      else if (ev.type === 'done') this.stepCheckpoint();
      SN.UI.renderAll();
    },

    // Punto de control al empezar cada paso que empieza sin deuda (la oferta de un objeto o la meta final).
    // El regalo guarda el suyo al llegar, ya con su deuda.
    stepCheckpoint() {
      const st = SN.Unlocks.step();
      if (!st || st.kind === 'gift') return;
      S.checkpoint(this.stepLabel(st));
    },
    stepLabel(st) {
      if (!st) return T('esta parte');
      if (st.kind === 'debt') return st.label;
      if (st.kind === 'gift') return T('el regalo de {x}', { x: SN.Upgrades.def(st.upgrade).name.toLocaleUpperCase(SN.I18n.lang) });
      if (st.kind === 'item') return T('la compra de {x}', { x: D.keyItemById(st.item).short });
      return T('la meta de {v}', { v: U.short(st.amount) });
    },
    fill(lines, vars) { return lines.map((l) => l.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''))); },

    // "Regalo" del encapuchado: una mejora que ya se puede comprar, quizá un mercado nuevo... y una deuda
    async onGift(st) {
      const up = SN.Upgrades.def(st.upgrade);
      const debt = U.money(st.debt), days = st.days;
      const lines = this.fill(story().hoodedEvents[st.story] || [], { debt, days });
      if (lines.length) await this.hoodedScene(lines, { smile: st.id !== 'regalo1' });
      if (st.markets && st.markets.length) {
        SN.Desk.windowEvent('fuegos');
        SN.Audio.sfx('unlock');
        SN.FX.confetti(40);
        await SN.UI.stamp(T('MERCADO NUEVO'), '', st.markets.map((id) => D.marketById(id).name).join(' · '), 1.6);
      }
      SN.Audio.sfx('unlock');
      await SN.UI.stamp(T('REGALO: {x}', { x: up.name.toLocaleUpperCase(SN.I18n.lang) }), 'coral', T('Deuda: {v} · {n} días', { v: debt, n: days }), 2.2);
      if (st.id === 'regalo4') await this.teaser();
      this.addNews({ title: T('Un "regalo": {x}. Y una deuda de {v}', { x: up.name, v: debt }), tone: 'neg', art: 'documento' });
      S.checkpoint(this.stepLabel(st));
      SN.Events.emit('chat:flag', { flag: st.id });
    },

    async onGoal(g, next) {
      SN.Desk.windowEvent('fuegos');
      SN.Audio.sfx('cheer');
      SN.FX.confetti(60);
      await SN.UI.stamp(T('¡OBJETIVO CUMPLIDO!'), 'green', g.reward ? T('Bono de la app: +{v}', { v: U.money(g.reward) }) : '', 1.8);
      if (g.markets.length) {
        SN.Audio.sfx('unlock');
        await SN.UI.stamp(T('MERCADO NUEVO'), '', g.markets.map((id) => D.marketById(id).name).join(' · '), 1.4);
      }
      const lines = story().hoodedEvents[g.story];
      if (lines) await this.hoodedScene(lines, { smile: true });
      this.addNews({ title: T('Objetivo {v} cumplido', { v: U.short(g.amount) }), tone: 'pos', art: 'dinero' });
      SN.Events.emit('chat:flag', { flag: g.id });
      // La meta final: el mercado TÚ y la elección (js/systems/finale.js)
      if (!next) { await SN.Finale.start(); return; }
      if (next && next.kind !== 'gift') S.checkpoint(this.stepLabel(next));
    },

    // Objeto clave comprado con la oferta de FUTURO.exe: te endeudas y se abre un mercado negro
    async onItem(ev) {
      const it = ev.item, def = D.marketById(it.market);
      SN.Audio.sfx('pay');
      SN.Hands.celebrate();
      SN.FX.confetti(30);
      SN.Desk.dirty();
      await SN.UI.stamp(T('¡ES TUYO!'), '', T('{x} · hoy $0 · debes {v} en {n} días', { x: it.name, v: U.money(ev.offer.debt), n: ev.offer.days }), 1.8);
      const lines = story().hoodedEvents[ev.step.story];
      if (lines) await this.hoodedScene(lines, { smile: true });
      SN.Audio.sfx('unlock');
      await SN.UI.stamp(T('MERCADO NEGRO'), 'coral', def.name, 1.8);
      this.addNews({ title: T('Abre un mercado que no sale en ningún periódico'), text: def.desc, tone: 'neg', market: it.market, art: 'cartel' });
      SN.Events.emit('chat:flag', { flag: ev.step.id });
    },

    // Bravo Fines se presenta (la mañana siguiente a pagar la Pleyzeta) y abre su Academia
    async bravoIntro() {
      const run = S.run, A = D.academy;
      if (!run || run.flags.academy) return;
      SN.Audio.sfx('notify');
      await SN.UI.stamp(T('¡NUEVO MENTOR!'), 'bravo', T('{name} quiere hablar contigo', { name: A.guru.name }), 1.4);
      await SN.Dialog.show(A.intro, { pos: { v: 'bottom', h: 'center' }, name: A.guru.name, portrait: 'bravo', voice: 'bravo' });
      run.flags.academy = true;
      SN.Audio.sfx('unlock');
      SN.FX.confetti(30);
      await SN.UI.stamp(T('ACADEMIA DE BRAVO FINES'), 'bravo', T('En la TIENDA (tecla T): Academia'), 1.8);
      this.addNews({ title: T('UN GURÚ DEL TRADING ABRE SU ACADEMIA: "EL DINERO SE MANIFIESTA"'), text: T('Bravo Fines promete hacerte rico. Él ya lo es, dice. Sus tres Lambos son alquilados.'), tone: 'neu', art: 'bravo' });
      SN.Events.emit('chat:flag', { flag: 'bravo' });
      SN.Events.emit('academy:open');
    },

    async teaser() {
      SN.FX.glitch(1.2, 2);
      SN.Audio.sfx('static', { dur: 1 });
      document.getElementById('screen').classList.add('glitch');
      await SN.UI.stamp(story().teaser, 'coral', '', 1.2);
      document.getElementById('screen').classList.remove('glitch');
    },

    // Tras cada turno: escenas pendientes y pequeñas inquietudes
    async afterTurn() {
      while (this.pending.length) {
        const scene = this.pending.shift();
        await scene();
      }
      const run = S.run;
      if (run.darkness >= 2 && Math.random() < 0.12) { SN.FX.glitch(0.2, 0.6); SN.Audio.sfx('static', { dur: 0.15 }); }
    },

    // "Errata": una noticia escrita en el idioma secreto (js/data/cipher.js). Sin id, la siguiente sin publicar.
    cipherNews(id) {
      const run = S.run;
      if (!run) return;
      run.cipherNews = run.cipherNews || {};
      const all = D.cipher.news;
      const n = id ? all.find((c) => c.id === id) : all.find((c) => c.id !== 'tuto' && !run.cipherNews[c.id]);
      if (!n || run.cipherNews[n.id]) return;
      run.cipherNews[n.id] = true;
      this.addNews({ title: SN.Cipher.text(n.text), cipher: n.id, tone: 'neu', art: n.art });
    },

    // Cada día nuevo, una noticia de la ciudad (sin repetir; las más oscuras solo cuando toca)
    cityNews() {
      const run = S.run, all = story().fillerNews;
      if (!run) return;
      run.cityUsed = run.cityUsed || {};
      const pool = all.filter((n, i) => !run.cityUsed[i] && (!n.minDark || run.darkness >= n.minDark));
      if (!pool.length) return;
      const n = pool[Math.floor(Math.random() * pool.length)];
      run.cityUsed[all.indexOf(n)] = true;
      this.addNews({ title: n.title, text: n.text, more: n.more, tone: n.tone, art: n.art, city: true });
    },

    // Noticia extraña vinculada al mercado donde acabas de ganar
    darkNews(market) {
      const run = S.run;
      const used = run.darkUsed[market] || 0;
      const pool = story().darkNews[market] || [];
      let text, art;
      const arts = story().darkArt;
      if (used < pool.length) { text = pool[used]; art = arts[market] && arts[market][used]; run.darkUsed[market] = used + 1; }
      else {
        const gi = run.darkUsed.generic || 0;
        const gen = story().darkNews.generic;
        text = gen[gi % gen.length];
        art = arts.generic[gi % arts.generic.length];
        run.darkUsed.generic = gi + 1;
      }
      // En el mercado negro la ciudad lo paga el doble
      run.darkness += D.marketById(market).black ? 2 : 1;
      this.addNews({ title: text, tone: 'neg', market, dark: true, art, text: T('Momentos después de tu operación en {mk}', { mk: D.marketLabel(market) }) });
      SN.Desk.dirty();
      SN.Audio.setDarkness(run.darkness / 12);
      SN.Audio.sfx('notifyBad');
      // A veces, junto a la noticia extraña, sale una "errata" en el idioma secreto
      if (Math.random() < 0.35) this.cipherNews();
      if (run.darkness >= 3 && !run.storySeen.darkNews) {
        run.storySeen.darkNews = true;
        this.pending.push(() => this.hoodedScene(story().hoodedEvents.darkNews, { smile: true }));
      }
    },

    update(dt) { void dt; },
  };

  // ---------- Suscripciones ----------
  // Lo que se ve por la ventana: las noticias que pasan en tu calle, y la ciudad que va cambiando
  SN.Events.on('market:event', ({ event }) => { if (event.window) SN.after(1.2, () => SN.Desk.windowEvent(event.window)); });
  SN.Events.on('rescue:done', () => SN.after(1.5, () => SN.Desk.windowEvent('fuegos')));
  SN.Events.on('turn:ready', () => {
    const run = S.run;
    if (!run || SN.Game.state !== 'GAMEPLAY') return;
    // Cuanto más oscura la historia, más a menudo se le ve en una azotea
    if (run.darkness >= 3 && run.turn === 2 && Math.random() < 0.18) { SN.Desk.windowEvent('encapuchado'); return; }
    if (Math.random() < 0.22) SN.Desk.windowEvent(U.pick(run.darkness >= 2 ? ['cuervo', 'lluvia', 'ambulancia', 'cuervo'] : ['cuervo', 'dron', 'ambulancia', 'fuegos']));
  });
  SN.Events.on('market:event', ({ market, event }) => {
    N.addNews({ title: event.title, text: event.text, tone: event.tone, market, art: event.art, ev: event.id, kind: event.kind });
  });
  SN.Events.on('market:event-resolved', (n) => {
    N.addNews({ title: n.text, tone: n.tone, market: n.market, art: n.art, ev: n.e && n.e.id, kind: 'result' });
  });
  SN.Events.on('debt:paid', ({ auto, debt }) => {
    N.pending.unshift(() => N.onDebtPaid(auto, debt));
  });
  SN.Events.on('debt:defaulted', () => N.addNews({ title: T('Plazo vencido. Embargo.'), tone: 'neg', art: 'documento' }));
  // La revelación: después de que "Kevo [PAGADO]" te escriba, el encapuchado te cuenta qué cobró
  SN.Events.on('kevo:done', ({ id }) => {
    if (id === 'pagado' && S.run && !S.run.storySeen.kevoPaid) {
      S.run.storySeen.kevoPaid = true;
      N.pending.push(() => N.hoodedScene(story().hoodedEvents.kevoPaid, { smile: true }));
    }
  });
  SN.Events.on('day:changed', () => {
    N.cityNews();
    // Bravo Fines se presenta la mañana siguiente a pagar la Pleyzeta
    const run = S.run;
    if (run && run.flags.debtPaid && !run.flags.academy && !run.flags.bravoQueued && !(SN.Tutorial && SN.Tutorial.active)) {
      run.flags.bravoQueued = true;
      N.pending.push(() => N.bravoIntro());
    }
  });
  // Día de la suerte: portada, y si llueve oro, se ve por la ventana
  SN.Events.on('luck:day', (l) => {
    const sp = D.luck.specials;
    N.addNews({ title: D.luck.news.title + ' ' + '★'.repeat(l.k), text: T('{text} Hoy: {list}.', { text: D.luck.news.text, list: l.events.map((e) => sp[e].name).join(', ') }), tone: 'pos', art: 'trebol' });
    if (l.events.includes('lluvia')) {
      N.addNews({ title: T('LLUEVE ORO SOBRE LA CIUDAD'), text: sp.lluvia.text, tone: 'pos', art: 'oro' });
      SN.after(2, () => SN.Desk.windowEvent('oro'));
    }
  });
  // El encapuchado sabe de este idioma: con el primer símbolo te pide que no digas nada; con todos, otra cosa
  SN.Events.on('cipher:found', ({ count, total, isNew }) => {
    if (!S.run || !isNew) return;
    if (count === 1) {
      SN.Events.emit('chat:flag', { flag: 'cipher' });
      N.pending.push(() => N.hoodedScene(D.cipher.hoodFirst));
    }
    if (count === total) N.pending.push(() => N.hoodedScene(D.cipher.hoodAll, { smile: true }));
  });
  SN.Events.on('trade:closed', (r) => {
    const run = S.run;
    if (!run.flags.debtPaid || r.pnl <= 0) return;
    N.profitableSinceDebt++;
    // Cuanto más ganas (en proporción), más probable es que alguien lo pague. En el mercado negro, casi siempre.
    const black = D.marketById(r.market).black;
    const chance = black ? 0.85 : N.profitableSinceDebt === 2 ? 1 : U.clamp(0.2 + r.pnl / Math.max(50, run.capital) * 0.8, 0.2, 0.75);
    if (Math.random() < chance) N.darkNews(r.market);
  });

  // Dueño de la capa #screen-canvas (cinemáticas y el encapuchado)
  SN.ScreenCanvas = {
    owner: null, canvas: null, g: null,
    init() { this.canvas = document.getElementById('screen-canvas'); this.g = Px.ctx(this.canvas); },
    take(owner) { this.owner = owner; this.canvas.classList.remove('hidden'); },
    release(owner) {
      if (this.owner !== owner) return;
      this.owner = null;
      this.g.clearRect(0, 0, 420, 236);
      this.canvas.classList.add('hidden');
      this.canvas.classList.remove('clickable');
    },
    render(dt) {
      if (!this.owner) return;
      if (this.owner === 'hood') N.renderHood(this.g, dt);
      else if (this.owner === 'cine') SN.Cine.renderScreen(this.g, dt);
    },
  };
})(window.SN);
