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
      // Primer gesto (clic o tecla): el navegador ya deja sonar el audio
      const gesture = () => {
        SN.Audio.unlock();
        if (this.state === 'MENU' || this.state === 'BOOT') SN.Audio.startMusic();
      };
      document.addEventListener('pointerdown', gesture);
      document.addEventListener('keydown', gesture);
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
      // El rescate bancario también es a pantalla completa: sin el zoom sobre el monitor de las ventanas pequeñas
      // (con la escala de Windows al 125-150 % se recortaba y el móvil se veía demasiado cerca)
      const shot = SN.Cine.shot || (SN.Bailout && SN.Bailout.active);
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
      SN.Finale.update(dt);
      SN.FX.update(w, dt);
      SN.Hero.follow(dt); // la mano va con el ratón real: tiempo real, no el del mundo
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
      SN.Desk.hideConsole = !S.profile.introSeen;
      screen.classList.add('off');
      await SN.wait(0.6);
      screen.classList.remove('off');
      screen.classList.add('poweron');
      $('os').classList.remove('hidden');
      boot.classList.remove('hidden');
      // Ventana de bienvenida: agradecimiento por jugar (juego de game jam). Se cierra con el botón o Enter.
      boot.innerHTML = `<div class="thanks">
        <div class="win-head"><span>¡GRACIAS POR JUGAR!</span></div>
        <div class="jam-logo" title="Official 2026 Unity Game Jam">${this.unityLogo()}</div>
        <div class="thanks-body">
          <p class="hi">¡Hola! Qué bueno tenerte aquí.</p>
          <p>Saldo Negro nació en la <b class="y">Official 2026 Unity Game Jam</b>, con el tema <b class="y">Lucky Number</b>: aquí la suerte también cotiza en bolsa.</p>
          <p>Puede que encuentres algún bug suelto. Si pasa, cuéntanoslo: tus comentarios nos ayudan muchísimo.</p>
          <p class="warn">Recuerda: aquí nada es consejo financiero. El dinero fácil casi nunca lo es.</p>
          <div class="thanks-foot">
            <span class="sign">— Por KrostGames y Adrede</span>
            <button class="btn btn-yellow">¡A jugar!<kbd>Enter</kbd></button>
          </div>
        </div>
      </div>`;
      const box = boot.querySelector('.thanks');
      await new Promise((resolve) => {
        const done = () => {
          document.removeEventListener('keydown', onKey);
          SN.Audio.sfx('click');
          resolve();
        };
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } };
        box.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); done(); }, { once: true });
        document.addEventListener('keydown', onKey);
      });
      box.classList.add('closing');
      await SN.wait(0.15);
      boot.innerHTML = '';
      this.showMenu();
    },

    // Logo de Unity en pixel art (31x34, a partir del oficial): cubo con el hueco de arriba y el tallo central
    unityLogo() {
      const map = [
        '............##...##............',
        '...........###...###...........',
        '.........#####...#####.........',
        '.......#######...#######.......',
        '.....#########...#########.....',
        '....##########...##########....',
        '..##########.......##########..',
        '##########...........##########',
        '#########.............#########',
        '########..............#########',
        '##########...........##########',
        '############.......############',
        '##############....#############',
        '###############################',
        '#####..#################..#####',
        '#####....#############....#####',
        '#####.....###########.....#####',
        '#####.......#######.......#####',
        '#####........#####........#####',
        '#####........#####........#####',
        '#####........#####........#####',
        '####.........#####.........####',
        '##...........#####...........##',
        '.............#####.............',
        '.....###.....#####.....###.....',
        '...#######...#####...#######...',
        '..##########.#####.##########..',
        '...########################....',
        '.....#####################.....',
        '.......#################.......',
        '.........#############.........',
        '..........###########..........',
        '............#######............',
        '..............###..............',
      ];
      let rects = '';
      map.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }));
      return `<svg width="31" height="34" viewBox="0 0 31 34" fill="#F8F4FF" shape-rendering="crispEdges">${rects}</svg>`;
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
      // Quien no ha visto la intro todavía no ha comprado la Pleyzeta
      SN.Desk.hideConsole = !S.profile.introSeen;
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
      // La intro sale en cada partida nueva; SALTAR solo si ya hay algo guardado (partida o intro vista)
      const firstTime = !S.profile.introSeen;
      const canSkip = !firstTime || SN.Save.hasRun();
      SN.Save.clearRun();
      $('menu').classList.add('hidden');
      const tutorial = S.profile.tutorialV !== SN.Tutorial.VERSION;
      await SN.Cine.playIntro({ canSkip });
      if (firstTime) await this.startRun({ tutorial: true });
      else await this.startRun({ tutorial, greeting: !tutorial && S.profile.runs > 0 });
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
      SN.Bailout.abort();
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
      if (!loaded) { S.newRun(); S.checkpoint('la deuda de la Pleyzeta'); }
      const run = S.run;
      // Partida sin punto de control (por si acaso): se guarda uno ahora
      if (!run.checkpoint) S.checkpoint(SN.Narrative.stepLabel(SN.Unlocks.step()));
      // La vida extra (el rescate). Las partidas de antes la llamaban "piggy" (el cerdito): 'broken' = gastada
      if (run.rescue == null) run.rescue = run.piggy === 'broken' ? 'used' : 'ready';
      delete run.piggy;
      SN.Finale.reset();
      SN.Desktop.reset();
      SN.HeroSay.clear();
      SN.Bailout.abort();
      if (SN.Bankruptcy.active) SN.Bankruptcy.reset();
      this.resetTime();
      SN.Narrative.pending = [];
      SN.Debt.flushBonuses(); // (un bono que quedó a medio entregar al cerrar el juego)
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
      SN.UI.tabSel = null;
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
      // Partida guardada en el final: de vuelta a la elección (el mercado TÚ y la última oferta)
      if (loaded && run.finale && run.finale.phase) { SN.Finale.resume(); return; }
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
    lost() { return !!S.run && ((S.run.debt && S.run.debt.defaulted) || SN.Bankruptcy.shouldTrigger() || SN.Debt.hopeless()); },
    async checkLoss() {
      if (S.run.debt && S.run.debt.defaulted) return SN.Bankruptcy.embargo();
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
      if (result) {
        // SEGUIR (botón o ESPACIO) corta la espera y el resultado
        let skipped = false, skip;
        const skipP = new Promise((res) => { skip = res; });
        UI.onContinue = () => { if (skipped) return; skipped = true; SN.Audio.sfx('click'); skip(); };
        await Promise.race([SN.wait(0.6), skipP]);
        if (!skipped) await UI.resultCard(result, skipP);
        UI.onContinue = null;
      } else await SN.wait(0.15);
      UI.endTrade();
      if (this.lost()) { await this.checkLoss(); return; }
      if (this.dayChanged) {
        this.dayChanged = false;
        SN.Audio.sfx('day');
        const left = SN.Debt.daysLeft(), owing = SN.Debt.active();
        const sub = !owing ? (run.darkness >= 4 ? 'La ciudad está más silenciosa' : 'Otro día, otra oportunidad')
          : left <= 1 ? '¡Último día para pagar!' : `Faltan ${left} días para pagar`;
        await UI.dayCard(run.day, sub, owing && left <= 2);
        // ¿El día lleva un 7? Día de la suerte
        const luck = SN.Luck.today();
        if (luck) await UI.luckyCard(luck);
      }
      await SN.Narrative.afterTurn();
      await this.advanceSteps();
      if (!SN.Tutorial.active) SN.ShopWatch.afterTurn();
      if (!run.flags.debtPaid && SN.Debt.canPay() && !run.flags.payHintShown && !SN.Tutorial.active) {
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
      await this.advanceSteps();
      SN.Save.saveRun();
      SN.UI.setBusy(false);
      // Pagada una deuda, salta la siguiente: si es un objeto clave, su oferta aparece sola
      SN.ShopWatch.afterTurn();
    },

    // La escalera avanza todo lo que pueda (paso completado, regalo, meta) y la narrativa lo cuenta
    async advanceSteps() {
      let ev;
      while ((ev = SN.Unlocks.check())) await SN.Narrative.onStep(ev);
    },

    // Comprar un objeto clave con la oferta de FUTURO.exe
    async buyKeyItem(id) {
      if (SN.UI.busy) return false;
      const ev = SN.Unlocks.acceptOffer(id);
      if (!ev) return false;
      SN.UI.setBusy(true);
      SN.Windows.close(true);
      SN.Save.saveRun();
      await SN.Narrative.onStep(ev);
      SN.Save.saveRun();
      SN.UI.setBusy(false);
      return true;
    },

    // ?debug: atajos para probar (F6 descubre un símbolo, F7 salta al siguiente día de la suerte,
    // F8 bancarrota, F9 +$1,000, F10 día siguiente, F11 salta al final)
    debugFinale() {
      const run = S.run, goal = D.chain.findIndex((st) => st.kind === 'goal');
      if (goal < 0 || run.finale || run.step >= goal) return;
      if (run.debt && !run.debt.paid) { run.debt.paid = true; run.debts.push(run.debt); run.debt = null; }
      run.step = goal; run.stepOpen = false;
      run.flags.debtPaid = true;
      run.flags.academy = true; run.flags.bravoQueued = true; // Bravo Fines ya se presentó hace mucho
      for (const it of D.keyItems) run.owned[it.id] = true;
      for (const st of D.chain) if (st.kind === 'gift') run.gifts[st.upgrade] = true;
      for (const d of D.markets) run.markets[d.id].unlocked = true;
      // Kevo, a punto de su último mensaje; LOS DESFASADOS, con dos partes de NULL.EXE entregadas
      const ch = SN.Desktop.chat(), at = D.chat.convos.findIndex((c) => c.id === 'mira');
      if (ch.i < at) { ch.i = at; ch.goneDay = run.day; ch.offline = true; ch.nick = 'Kevo'; }
      const cs = SN.Desktop.ser(), s8 = D.cipher.messages.findIndex((m) => m.id === 's8');
      if (cs.i < s8) cs.i = s8;
      run.nullParts = 2;
      run.capital = D.chain[goal].amount;
      SN.UI.setBusy(true);
      this.afterTurn(null);
    },
    debugKeys() {
      document.addEventListener('keydown', (e) => {
        if (!S.run || this.state !== 'GAMEPLAY' || SN.UI.busy) return;
        if (e.code === 'F6') { e.preventDefault(); SN.Cipher.wildcard(); }
        if (e.code === 'F11') { e.preventDefault(); this.debugFinale(); }
        if (e.code === 'F7') {
          e.preventDefault();
          for (let i = 0; i < 300 && !SN.Luck.isLucky(S.run.day + 1); i++) S.run.day++;
          S.run.turn = 2;
          SN.Trading.skipTurn();
          SN.UI.setBusy(true);
          this.afterTurn(null);
        }
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
