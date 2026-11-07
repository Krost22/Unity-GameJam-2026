// NarrativeManager: noticias, apariciones del encapuchado e hitos de la historia.
// Tras pagar la deuda, algunas ganancias generan noticias extrañas sobre la ciudad (cada vez más
// relacionadas con tus operaciones). La ciudad de la ventana se apaga y la música se vuelve rara poco a poco.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util, P = SN.PAL, Px = SN.Px;
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
    async onDebtPaid(auto) {
      const run = S.run;
      SN.Audio.sfx('pay');
      SN.Audio.sfx('cheer');
      SN.FX.confetti(70);
      SN.FX.flash(P.yellowL, 0.3, 0.4);
      const cap = SN.UI.posIn(document.getElementById('hud-goal'));
      SN.FX.coins(cap.x + 60, cap.y + 14, 16, 1.5);
      SN.FX.ring(cap.x + 60, cap.y + 14, P.green, 120, 0.9);
      SN.Hands.celebrate();
      SN.Desk.dirty();
      await SN.UI.stamp('DEUDA SALDADA', 'green', auto ? 'SE COBRÓ AL VENCER EL PLAZO' : 'ERES LIBRE (MÁS O MENOS)', 2);
      await SN.Cine.faceBeat('relieved', 'Uf... Libre. Por fin.', 2.2);
      await this.hoodedScene(story().hoodedEvents.debtPaid);
      SN.Economy.add(25, 'reward');
      SN.FX.float('+$25.00 REGALO', 210, 90, 'gold');
      SN.Audio.sfx('unlock');
      run.flags.debtPaid = true;
      await SN.UI.stamp('OBJETIVO: $1,000', '', 'OBJETIVO DESBLOQUEADO · ×10 · TIENDA · LÍMITE', 2.2);
      this.addNews({ title: 'DEUDA SALDADA. NUEVO OBJETIVO: $1,000', tone: 'pos', art: 'sello' });
      SN.UI.renderAll();
    },

    async onGoal(g, next) {
      SN.Audio.sfx('cheer');
      SN.FX.confetti(60);
      await SN.UI.stamp('¡OBJETIVO CUMPLIDO!', 'green', g.reward ? `BONO DE LA APP: +${U.money(g.reward, { cents: false })}` : '', 1.8);
      if (g.markets.length) SN.Audio.sfx('unlock');
      const lines = story().hoodedEvents[g.story];
      if (lines) await this.hoodedScene(lines, { smile: g.id !== 'g1000' });
      if (g.id === 'g25000') await this.teaser();
      if (next) await SN.UI.stamp(`OBJETIVO: ${U.short(next.amount)}`, '', 'NUEVA META DESBLOQUEADA', 1.6);
      else await this.endDemo();
      this.addNews({ title: `OBJETIVO ${U.short(g.amount)} CUMPLIDO`, tone: 'pos', art: 'dinero' });
    },

    async teaser() {
      SN.FX.glitch(1.2, 2);
      SN.Audio.sfx('static', { dur: 1 });
      document.getElementById('screen').classList.add('glitch');
      await SN.UI.stamp(story().teaser, 'coral', '', 1.2);
      document.getElementById('screen').classList.remove('glitch');
    },

    async endDemo() {
      const run = S.run;
      if (run.flags.endDemo) return;
      run.flags.endDemo = true;
      await this.teaser();
      const [a, b, c] = story().endDemo;
      await SN.UI.card(`<div class="overlay-panel"><div class="t1">${a}</div><div class="t2">${b}</div><div class="t3">${c}</div></div>`, 'daycard', 4);
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
      run.darkness++;
      this.addNews({ title: text, tone: 'neg', market, dark: true, art, text: `MOMENTOS DESPUÉS DE TU OPERACIÓN EN ${D.marketById(market).short}` });
      SN.Desk.dirty();
      SN.Audio.setDarkness(run.darkness / 12);
      SN.Audio.sfx('notifyBad');
      if (run.darkness === 3 && !run.storySeen.darkNews) {
        run.storySeen.darkNews = true;
        this.pending.push(() => this.hoodedScene(story().hoodedEvents.darkNews, { smile: true }));
      }
    },

    update(dt) { void dt; },
  };

  // ---------- Suscripciones ----------
  SN.Events.on('market:event', ({ market, event }) => {
    N.addNews({ title: event.title, text: event.text, tone: event.tone, market, art: event.art });
  });
  SN.Events.on('market:event-resolved', (n) => {
    N.addNews({ title: n.text, tone: n.tone, market: n.market, art: n.art });
  });
  SN.Events.on('debt:paid', ({ auto }) => {
    N.pending.unshift(() => N.onDebtPaid(auto));
  });
  SN.Events.on('debt:defaulted', () => N.addNews({ title: 'PLAZO VENCIDO. EMBARGO.', tone: 'neg', art: 'documento' }));
  SN.Events.on('trade:closed', (r) => {
    const run = S.run;
    if (!run.debt.paid || r.pnl <= 0) return;
    N.profitableSinceDebt++;
    // Cuanto más ganas (en proporción), más probable es que alguien lo pague
    const chance = N.profitableSinceDebt === 2 ? 1 : U.clamp(0.2 + r.pnl / Math.max(50, run.capital) * 0.8, 0.2, 0.75);
    if (Math.random() < chance) N.darkNews(r.market);
  });

  // Dueño de la capa #screen-canvas (cinemáticas, encapuchado, cerdito)
  SN.ScreenCanvas = {
    owner: null, canvas: null, g: null,
    init() { this.canvas = document.getElementById('screen-canvas'); this.g = Px.ctx(this.canvas); },
    take(owner) { this.owner = owner; this.canvas.classList.remove('hidden'); this.canvas.classList.toggle('clickable', owner === 'piggy'); },
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
      else if (this.owner === 'piggy') SN.Bankruptcy.render(this.g, dt);
      else if (this.owner === 'cine') SN.Cine.renderScreen(this.g, dt);
    },
  };
})(window.SN);
