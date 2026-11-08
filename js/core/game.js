// GameManager: estados del juego (BOOT, MENU, INTRO, TUTORIAL, GAMEPLAY, BANKRUPTCY), bucle principal,
// cámara/escalado del escenario, velocidad del tiempo (cámara lenta) y el orden de lo que pasa en cada turno.
// La lógica de cada sistema vive en su propio archivo; aquí solo se orquesta.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util;
  const $ = (id) => document.getElementById(id);

  const G = SN.Game = {
    state: 'BOOT',
    base: 1, mode: 'full', vw: 0, vh: 0, tx: 0, ty: 0, z: 1,
    cam: { x: 320, y: 180, zoom: 1 },
    tween: null,
    // Enfoque de la cámara lenta: se acerca a la gráfica sin perder de vista el botón COBRAR
    focus: { x: 400, y: 140, zoom: 1.75, k: 0, from: 0, to: 0, t: 1, dur: 1 },
    timeScale: 1, slow: null,
    pulse: 0,
    last: 0,
    dayChanged: false,
    camKey: '',

    setState(s) { this.state = s; document.body.dataset.state = s; },

    init() {
      SN.Save.loadProfile();
      const st = S.profile.settings;
      SN.Audio.sfxOn = st.sfx;
      SN.Audio.musicOn = st.music;
      this.deskCtx = SN.Px.ctx($('desk'));
      SN.ScreenCanvas.init();
      SN.UI.init();
      SN.Desktop.init();
      SN.Cine.init();
      SN.UI.renderSound();
      window.addEventListener('resize', () => this.layout());
      this.layout();
      this.bindMenu();
      SN.Events.on('day:changed', () => { this.dayChanged = true; });
      document.addEventListener('pointerdown', () => {
        SN.Audio.unlock();
        if (this.state === 'MENU' || this.state === 'BOOT') SN.Audio.startMusic();
      });
      if (SN.DEBUG) this.debugKeys();
      $('stage').classList.add('ready');
      $('loading').remove();
      requestAnimationFrame((t) => { this.last = t; this.frame(t); });
      this.boot();
    },

    // ---------- Escalado y cámara ----------
    layout() {
      const vw = window.innerWidth, vh = window.innerHeight;
      let base = Math.min(vw / SN.W, vh / SN.H);
      this.mode = 'full';
      // En pantallas pequeñas la cámara se acerca al monitor para que se pueda leer
      if (base < 1.55) {
        const mz = Math.min(vw / 452, vh / 270);
        if (mz > base * 1.12) { base = mz; this.mode = 'monitor'; }
      }
      this.base = base; this.vw = vw; this.vh = vh;
      document.documentElement.style.setProperty('--k', Math.max(1, base).toFixed(3));
      SN.Hands.applyCursor(base);
      this.camKey = '';
      this.applyCam();
    },

    applyCam() {
      const shot = SN.Cine.shot;
      let base = this.base, fx = this.cam.x, fy = this.cam.y, zoom = this.cam.zoom;
      if (shot) {
        // Planos de cinemática a pantalla completa: encuadre fijo, sin el zoom del escritorio
        base = Math.min(this.vw / SN.W, this.vh / SN.H); fx = 320; fy = 180; zoom = 1;
      } else {
        // En pantallas pequeñas la cámara se queda centrada en el monitor
        if (this.mode === 'monitor') { fx = SN.SCREEN.x + SN.SCREEN.w / 2; fy = SN.SCREEN.y + SN.SCREEN.h / 2 - 4; }
        const f = this.focus;
        if (f.k > 0) {
          const k = U.ease.inOutSine(U.clamp(f.k, 0, 1));
          const fz = this.mode === 'monitor' ? 1 + (f.zoom - 1) * 0.45 : f.zoom;
          fx = U.lerp(fx, f.x, k); fy = U.lerp(fy, f.y, k);
          zoom *= 1 + (fz - 1) * k;
        }
        zoom *= 1 + this.pulse;
      }
      const z = base * zoom;
      let tx = Math.round(this.vw / 2 - fx * z), ty = Math.round(this.vh / 2 - fy * z);
      // Con zoom, la cámara nunca enseña lo que hay fuera del escenario
      if (!shot) {
        const sw = SN.W * z, sh = SN.H * z;
        if (sw >= this.vw) tx = Math.round(U.clamp(tx, this.vw - sw, 0));
        if (sh >= this.vh) ty = Math.round(U.clamp(ty, this.vh - sh, 0));
      }
      const key = `${tx},${ty},${z.toFixed(4)}`;
      if (key === this.camKey) return;
      this.camKey = key;
      this.tx = tx; this.ty = ty; this.z = z;
      $('stage').style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
      SN.Desk.camShift = (this.cam.x - 320) + (this.cam.zoom - 1) * 60;
    },

    camTo(target, dur = 1) {
      this.tween = { from: Object.assign({}, this.cam), to: Object.assign({}, this.cam, target), t: 0, dur: Math.max(0.01, dur) };
    },

    // Acercar la cámara a la última vela (zoom > 0) o volver a la vista normal (zoom = 0)
    focusOn(zoom, dur = 1) {
      const f = this.focus;
      if (zoom > 0) {
        const p = SN.Chart.lastCandlePos();
        // Entre la vela y el panel de operar, para no perder de vista COBRAR
        f.x = SN.SCREEN.x + U.clamp(p.x * 0.45 + 365 * 0.55, 190, 312);
        f.y = SN.SCREEN.y + U.clamp(p.y, 96, 151);
        f.zoom = zoom;
      }
      f.from = f.k; f.to = zoom > 0 ? 1 : 0; f.t = 0; f.dur = Math.max(0.01, dur);
    },

    // Velocidad del tiempo del juego (1 normal, 0 congelado). La interfaz y los diálogos no se ralentizan.
    slowTo(scale, dur = 0) {
      if (dur <= 0) { this.timeScale = scale; this.slow = null; return; }
      this.slow = { from: this.timeScale, to: scale, t: 0, dur };
    },

    // Toda la cámara lenta a cero (al salir al menú, en una bancarrota...)
    resetTime() {
      SN.Drama.reset();
      this.timeScale = 1; this.slow = null; this.pulse = 0;
      this.focus.k = this.focus.from = this.focus.to = 0; this.focus.t = 1;
    },

    // Cliente (px de ventana) -> coordenadas del escenario de pixel art
    toStage(cx, cy) { return { x: (cx - this.tx) / this.z, y: (cy - this.ty) / this.z }; },

    // ---------- Bucle ----------
    frame(now) {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.step(dt);
      requestAnimationFrame((t) => this.frame(t));
    },

    step(dt) {
      SN.tickTimers(dt);
      SN.Drama.update(dt);
      if (this.slow) {
        const s = this.slow;
        s.t = Math.min(1, s.t + dt / s.dur);
        this.timeScale = U.lerp(s.from, s.to, U.ease.inOutSine(s.t));
        if (s.t >= 1) this.slow = null;
      }
      const f = this.focus;
      if (f.t < 1) { f.t = Math.min(1, f.t + dt / f.dur); f.k = U.lerp(f.from, f.to, f.t); }
      this.pulse *= Math.pow(0.0005, dt);
      if (this.pulse < 0.001) this.pulse = 0;
      const w = dt * this.timeScale; // tiempo del mundo (se frena con la cámara lenta)
      if (this.tween) {
        const tw = this.tween;
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        const k = U.ease.inOutSine(tw.t);
        for (const key of ['x', 'y', 'zoom']) this.cam[key] = U.lerp(tw.from[key], tw.to[key], k);
        if (tw.t >= 1) this.tween = null;
      }
      SN.Chart.update(w, dt);
      SN.Dialog.update(dt);
      SN.UI.update(dt);
      SN.Cine.update(dt);
      SN.FX.update(w, dt);
      SN.Desk.render(this.deskCtx, w);
      if (S.run && !$('app').classList.contains('hidden')) SN.Chart.render();
      SN.ScreenCanvas.render(dt);
      SN.FX.render();
      SN.Cine.render();
      this.applyCam();
    },

    // ---------- Arranque y menú ----------
    async boot() {
      this.setState('BOOT');
      const screen = $('screen'), boot = $('boot');
      SN.Desk.phaseOverride = 'evening';
      screen.classList.add('off');
      await SN.wait(0.6);
      screen.classList.remove('off');
      screen.classList.add('poweron');
      $('os').classList.remove('hidden');
      boot.classList.remove('hidden');
      let skipped = false;
      const skip = () => { skipped = true; };
      boot.addEventListener('pointerdown', skip);
      const lines = [
        'KROST OS V2.1',
        'MEMORIA: 640 KB (DEBERÍA BASTAR)',
        'COMPROBANDO SALDO......... <span class="ok">$100</span>',
        'COMPROBANDO DEUDAS........ <span style="color:#F05B54">CALCULANDO...</span>',
        'BUSCANDO FUTURO........... <span style="color:#F28B43">NO ENCONTRADO</span>',
        'INICIANDO SALDO NEGRO..... <span class="ok">OK</span>',
      ];
      boot.innerHTML = '';
      for (const l of lines) {
        boot.insertAdjacentHTML('beforeend', `<div>${l}</div>`);
        if (!skipped) await SN.wait(0.22);
      }
      boot.insertAdjacentHTML('beforeend', '<div class="bar"><i></i></div>');
      const bar = boot.querySelector('.bar i');
      for (let i = 0; i <= 10 && !skipped; i++) { bar.style.width = i * 10 + '%'; await SN.wait(0.06); }
      boot.removeEventListener('pointerdown', skip);
      this.showMenu();
    },

    bindMenu() {
      const btnNew = $('btn-new');
      btnNew.addEventListener('click', () => {
        if (SN.Save.hasRun() && !btnNew.dataset.confirm) {
          btnNew.dataset.confirm = '1';
          btnNew.textContent = '¿Seguro? Se borra';
          SN.Audio.sfx('error');
          SN.after(2.5, () => { delete btnNew.dataset.confirm; btnNew.textContent = 'Nueva partida'; });
          return;
        }
        delete btnNew.dataset.confirm;
        btnNew.textContent = 'Nueva partida';
        this.newGame();
      });
      $('btn-continue').addEventListener('click', () => this.continueGame());
      $('btn-intro').addEventListener('click', async () => {
        $('menu').classList.add('hidden');
        await SN.Cine.playIntro();
        this.showMenu();
      });
      $('btn-menu-settings').addEventListener('click', () => SN.Windows.open('settings'));
    },

    showMenu() {
      this.setState('MENU');
      SN.Windows.close(true);
      SN.Dialog.hide();
      SN.UI.clearSpot();
      S.run = null;
      $('app').classList.add('hidden');
      $('webshop').classList.add('hidden');
      $('os').classList.remove('hidden');
      $('boot').classList.add('hidden');
      $('menu').classList.remove('hidden');
      $('btn-continue').classList.toggle('hidden', !SN.Save.hasRun());
      $('btn-intro').classList.toggle('hidden', !S.profile.introSeen);
      SN.Desk.phaseOverride = 'evening';
      SN.Desk.led = 'idle';
      SN.Desk.dirty();
      SN.Audio.setMood('normal');
      SN.Audio.setDarkness(0);
      this.camTo({ x: 320, y: 180, zoom: 1 }, 0.5);
    },

    async newGame() {
      SN.Audio.unlock();
      SN.Audio.startMusic();
      SN.Save.clearRun();
      $('menu').classList.add('hidden');
      const tutorial = S.profile.tutorialV !== SN.Tutorial.VERSION;
      if (!S.profile.introSeen) {
        await SN.Cine.playIntro();
        await this.startRun({ tutorial: true });
      } else {
        await this.startRun({ tutorial, greeting: !tutorial && S.profile.runs > 0 });
      }
    },

    continueGame() {
      const run = SN.Save.loadRun();
      if (!run) { this.showMenu(); return; }
      SN.Audio.startMusic();
      S.adopt(run);
      this.startRun({ loaded: true });
    },

    retry() {
      this.startRun({ tutorial: false, greeting: true });
    },

    toMenu() {
      SN.Sneak.abort();
      if (SN.Bankruptcy.active) SN.Bankruptcy.reset();
      if (S.run && !S.run.over && !S.run.position) SN.Save.saveRun();
      this.resetTime();
      SN.FX.clear();
      SN.Chart.anim = null;
      SN.UI.busy = false;
      SN.UI.allow = null;
      this.showMenu();
    },

    async startRun({ tutorial = false, greeting = false, loaded = false } = {}) {
      if (!loaded) { S.newRun(); S.checkpoint('la deuda de $250'); }
      const run = S.run;
      // Partidas de versiones anteriores: sin punto de control ni cerdito
      if (!run.checkpoint) S.checkpoint(run.debt.paid ? 'esta meta' : 'la deuda de $250');
      if (run.piggy == null) run.piggy = 'ready';
      SN.Desktop.reset();
      SN.Sneak.abort();
      if (SN.Bankruptcy.active) SN.Bankruptcy.reset();
      this.resetTime();
      SN.Narrative.pending = [];
      SN.Narrative.profitableSinceDebt = 0;
      SN.FX.clear();
      SN.Chart.anim = null;
      SN.Chart.setMarket(run.selected);
      SN.Desk.phaseOverride = null;
      SN.Desk.led = 'idle';
      SN.Desk.dirty();
      SN.Audio.setDarkness(run.darkness / 12);
      SN.Audio.setMood('normal');
      $('os').classList.add('hidden');
      $('webshop').classList.add('hidden');
      const app = $('app');
      app.classList.remove('hidden');
      const screen = $('screen');
      screen.classList.remove('poweron', 'off'); void screen.offsetWidth; screen.classList.add('poweron');
      this.setState('GAMEPLAY');
      SN.UI.busy = false;
      SN.UI.endTrade();
      SN.UI.renderSound();
      this.camTo({ x: 320, y: 180, zoom: 1 }, 0.6);
      if (!loaded && !tutorial) SN.Market.spawnEvents();
      if (!loaded) SN.Save.saveRun();
      SN.UI.renderAll();
      if (loaded && run.position) {
        // Operación que quedó abierta al cerrar el juego: se liquida con sus velas ya simuladas
        SN.UI.setBusy(true);
        await SN.wait(0.6);
        this.closeTrade();
        return;
      }
      // Partida guardada justo al perder (se cerró el juego en medio): se retoma la derrota
      if (loaded && !tutorial && this.lost()) {
        SN.UI.setBusy(true);
        await SN.wait(0.6);
        await this.checkLoss();
        return;
      }
      if (tutorial) await SN.Tutorial.run();
      else if (greeting) {
        SN.UI.setBusy(true);
        await SN.wait(0.6);
        await SN.Narrative.hoodedScene(greeting === 'rewind' ? D.story.rewindGreeting : D.story.retryGreeting);
        if (greeting === 'rewind') SN.Desktop.flag('rewind');
        SN.UI.setBusy(false);
      }
      // Kevo escribe en cuanto el jugador tiene las manos libres
      setTimeout(() => SN.Desktop.check(), 2500);
    },

    // ¿Se ha perdido? (plazo vencido, sin dinero para la apuesta mínima o ya imposible pagar a tiempo)
    lost() { return !!S.run && (S.run.debt.defaulted || SN.Bankruptcy.shouldTrigger() || SN.Debt.hopeless()); },
    async checkLoss() {
      if (S.run.debt.defaulted) return SN.Bankruptcy.embargo();
      // Sin dinero para la apuesta mínima: se acaba en el momento, sin esperar al último día
      if (SN.Bankruptcy.shouldTrigger()) return SN.Bankruptcy.broke();
      // Ya es imposible llegar a la deuda a tiempo: el cobrador se adelanta
      if (SN.Debt.hopeless()) return SN.Bankruptcy.embargo({ early: true });
    },

    // ---------- Turnos ----------
    trade(dir) {
      const UI = SN.UI;
      UI.setBusy(true);
      this.dayChanged = false;
      const pos = SN.Trading.open(dir, { tutorial: SN.Tutorial.controlledTrade });
      if (!pos) { UI.setBusy(false); return; }
      SN.Chart.setMarket(pos.market);
      SN.Chart.play(pos.candles, {
        speed: D.sim.candleTime,
        climax: pos.climax,
        holdAt: pos.tutorial ? D.sim.tutorial.holdAt : -1,
        onCandle: (i, c) => UI.onCandle(i, c),
        onDone: () => this.closeTrade(),
      });
    },

    // COBRAR: al precio que se ve ahora mismo. Las velas que faltan se siguen viendo (más rápido)
    cashOut() {
      const pos = S.run && S.run.position, a = SN.Chart.anim;
      if (!pos || pos.settled || !a) return;
      const r = SN.Trading.cashOut(SN.Chart.livePrice, a.revealed);
      if (!r) return;
      SN.UI.onCashOut(r);
      SN.Drama.cashed();
      SN.Chart.release();
      SN.Chart.fast(2.5);
      SN.Events.emit('trade:cashed', r);
    },

    closeTrade() {
      const r = SN.Trading.close();
      SN.UI.onTradeDone(r);
      SN.Events.emit('trade:done', r);
      this.afterTurn(r);
    },

    // ESPERAR: no apuestas; los mercados avanzan solos y lo ves en la gráfica
    skipTurn() {
      if (SN.UI.busy || !S.run || S.run.position) return;
      SN.UI.setBusy(true);
      this.dayChanged = false;
      SN.Audio.sfx('whoosh');
      SN.Trading.skipTurn();
      SN.Chart.setMarket(S.run.selected);
      SN.Chart.play(D.sim.idleCandles, {
        speed: 0.14,
        onCandle: (i, c) => SN.Audio.sfx('candle', { up: c.c >= c.o, quiet: true }),
        onDone: () => this.afterTurn(null),
      });
    },

    async afterTurn(result) {
      const UI = SN.UI, run = S.run;
      if (result) { await SN.wait(0.6); await UI.resultCard(result); } else await SN.wait(0.15);
      UI.endTrade();
      if (this.lost()) { await this.checkLoss(); return; }
      if (this.dayChanged) {
        this.dayChanged = false;
        SN.Audio.sfx('day');
        const left = SN.Debt.daysLeft();
        const sub = run.debt.paid ? (run.darkness >= 4 ? 'La ciudad está más silenciosa' : 'Otro día, otra oportunidad')
          : left <= 1 ? '¡Último día para pagar!' : `Faltan ${left} días para pagar`;
        await UI.dayCard(run.day, sub, !run.debt.paid && left <= 2);
      }
      await SN.Narrative.afterTurn();
      let g;
      while ((g = SN.Unlocks.check())) await SN.Narrative.onGoal(g, D.goals[run.goalIndex]);
      if (!run.debt.paid && SN.Debt.canPay() && !run.flags.payHintShown && !SN.Tutorial.active) {
        run.flags.payHintShown = true;
        // El botón se ve (busy = false) pero no se puede pulsar hasta cerrar el aviso (allow vacío)
        UI.busy = false;
        UI.allow = [];
        UI.renderAll();
        UI.spot('#btn-pay');
        await SN.Dialog.show(D.story.tutorialPayHint, { pos: { v: 'bottom', h: 'center' } });
        UI.clearSpot();
        UI.allow = null;
      }
      SN.Save.saveRun();
      UI.setBusy(false);
      SN.Events.emit('turn:ready');
    },

    async payDebt() {
      if (!SN.Debt.canPay()) return;
      SN.UI.setBusy(true);
      SN.UI.allow = null;
      SN.Dialog.hide();
      SN.UI.clearSpot();
      SN.Debt.pay(false);
      await SN.Narrative.afterTurn();
      let g;
      while ((g = SN.Unlocks.check())) await SN.Narrative.onGoal(g, D.goals[S.run.goalIndex]);
      SN.Save.saveRun();
      SN.UI.setBusy(false);
    },

    // ?debug: atajos para probar (F8 bancarrota, F9 +$1,000, F10 día siguiente)
    debugKeys() {
      document.addEventListener('keydown', (e) => {
        if (!S.run || this.state !== 'GAMEPLAY' || SN.UI.busy) return;
        if (e.code === 'F8') { e.preventDefault(); SN.Economy.spend(S.run.capital, 'debug'); SN.UI.setBusy(true); this.afterTurn(null); }
        if (e.code === 'F9') { e.preventDefault(); SN.Economy.add(1000, 'debug'); }
        if (e.code === 'F10') { e.preventDefault(); for (let i = 0; i < 3; i++) SN.Trading.skipTurn(); SN.UI.setBusy(true); this.afterTurn(null); }
      });
    },
  };

  // Espera a que cargue la fuente pixel (es un data URI: tarda milisegundos)
  function start() {
    const go = () => G.init();
    if (document.fonts && document.fonts.load) document.fonts.load('8px SaldoPixel').then(go, go);
    else go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.SN);
