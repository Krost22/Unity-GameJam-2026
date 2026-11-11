// Cinemáticas de la introducción (escenas 1-4 del documento): la compra innecesaria, la deuda,
// el encapuchado y la apertura de FUTURO.exe. Se escriben como guiones asíncronos con esperas en
// tiempo de juego; SALTAR (o ESC) aborta el guion y deja el juego en su estado final.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, U = SN.Util, S = SN.State;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const SKIP = { skip: true };
  // Expresiones de las cinemáticas -> expresiones del protagonista
  const HERO_EXPR = { star: 'star', happy: 'happy', confused: 'worried', worried: 'nervous', relieved: 'relieved', shocked: 'shock', neutral: 'calm', sad: 'sad', cry: 'sad' };
  const $ = (id) => document.getElementById(id);

  const C = SN.Cine = {
    running: false, skipping: false,
    shot: null, t: 0,
    buf: null,
    say_: null,
    screenMode: null, screenT: 0, hoodA: 0,
    shopCanvas: null,
    notifs: [],

    init() {
      this.buf = Px.canvas(160, 90);
      this.cine = $('cine');
      this.g = Px.ctx(this.cine);
      $('btn-skip').addEventListener('click', () => this.skip());
      // Durante una cinemática, un clic en cualquier parte avanza el subtítulo
      document.addEventListener('pointerdown', (e) => {
        if ((this.running && this.say_) || this.beatResolve) {
          if (e.target.closest && e.target.closest('#btn-skip')) return;
          this.advance();
        }
      });
    },

    skip() {
      if (!this.running || !this.canSkip) return;
      this.skipping = true;
      if (this.skipNow) this.skipNow();
      this.advance();
    },
    onKey(e) {
      if (!this.running && !this.beat) return false;
      if (e.code === 'Escape' && this.running) { this.skip(); return true; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); return true; }
      return true;
    },

    // ---------- Primitivas del guion ----------
    check() { if (this.skipping) throw SKIP; },
    async wait(s) { this.check(); await Promise.race([SN.wait(s), this.skipSignal]); this.check(); },

    // Subtítulo con efecto máquina de escribir. auto = segundos hasta continuar solo
    say(name, text, { auto = 0 } = {}) {
      this.check();
      const el = $('subs');
      el.classList.remove('hidden');
      el.classList.toggle('click', !auto);
      return new Promise((resolve) => {
        this.say_ = { name, full: text, shown: 0, auto, t: 0, resolve };
        this.renderSubs();
      }).then(() => this.check());
    },
    renderSubs() {
      const s = this.say_;
      if (!s) return;
      $('subs').innerHTML = (s.name ? `<b>${s.name}:</b> ` : '') + s.full.slice(0, Math.floor(s.shown));
    },
    advance() {
      const s = this.say_;
      if (this.beatResolve) { const r = this.beatResolve; this.beatResolve = null; r(); }
      if (!s) return;
      if (s.shown < s.full.length && !this.skipping) { s.shown = s.full.length; this.renderSubs(); return; }
      this.say_ = null;
      $('subs').classList.add('hidden');
      s.resolve();
    },

    setShot(shot) {
      this.shot = shot ? Object.assign({ t: 0, zoom: 1, zoomTo: 1, zoomTime: 0 }, shot) : null;
      $('cine').classList.toggle('hidden', !shot);
    },

    // ---------- Introducción ----------
    // canSkip: con partida guardada (o la intro ya vista) se puede SALTAR; la primera vez se ve entera
    async playIntro({ canSkip = true } = {}) {
      const G = SN.Game;
      this.running = true;
      this.skipping = false;
      this.canSkip = canSkip;
      this.skipSignal = new Promise((r) => { this.skipNow = r; });
      G.setState('INTRO');
      $('btn-skip').classList.toggle('hidden', !canSkip);
      // La Pleyzeta todavía no es tuya: no está en la habitación hasta que termina la intro
      SN.Desk.hideConsole = true;
      SN.Desk.dirty();
      SN.Audio.setMood('normal');
      SN.Audio.startMusic();
      try {
        await this.sceneShop();
        await this.sceneDebt();
        await this.sceneHooded();
      } catch (e) {
        if (e !== SKIP) console.error(e);
      }
      this.cleanup();
      S.profile.introSeen = true;
      SN.Save.saveProfile();
    },

    cleanup() {
      this.running = false;
      this.skipping = false;
      this.say_ = null;
      this.setShot(null);
      this.screenMode = null;
      SN.ScreenCanvas.release('cine');
      $('subs').classList.add('hidden');
      $('btn-skip').classList.add('hidden');
      $('webshop').classList.add('hidden');
      $('fake-cursor').classList.add('hidden');
      $('screen').classList.remove('glitch', 'off');
      this.notifs.forEach((n) => n.remove());
      this.notifs = [];
      SN.FX.clear();
      SN.Desk.phaseOverride = null;
      SN.Desk.hideConsole = false; // comprada (a plazos): ya está en el mueble
      SN.Desk.dirty();
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.01);
      SN.Audio.setMood('normal');
    },

    // ESCENA 1 — Una compra innecesaria
    async sceneShop() {
      const st = SN.Data.story.shop, sub = SN.Data.story.introSubs;
      SN.Desk.phaseOverride = 'evening';
      SN.Desk.dirty();
      this.buildShop();
      const screen = $('screen');
      screen.classList.remove('off');
      $('os').classList.add('hidden');
      $('app').classList.add('hidden');
      $('webshop').classList.remove('hidden');
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.01);
      SN.Game.camTo({ x: SN.SCREEN.x + SN.SCREEN.w / 2, y: 150, zoom: 1.14 }, 10);
      this.moveCursor(330, 200, 0.01);
      await this.wait(0.6);
      await this.say('', sub.browsing, { auto: 2.4 });
      const lis = $('webshop').querySelectorAll('li');
      for (const li of lis) { li.classList.add('show'); SN.Audio.sfx('pop'); SN.Hands.tapKey('KeyJ'); await this.wait(0.65); }
      $('webshop').querySelector('.p-bal').classList.remove('hidden');
      SN.Audio.sfx('error');
      await this.say('', sub.noMoney, { auto: 2.4 });
      const btn = $('webshop').querySelector('.buy-now');
      btn.classList.remove('hidden');
      btn.classList.add('wiggle');
      SN.Audio.sfx('notify');
      await this.wait(0.5);
      const bp = SN.UI.posIn(btn);
      await this.moveCursor(bp.x + bp.w / 2, bp.y + bp.h / 2, 1.1);
      await this.wait(0.3);
      SN.Hands.press();
      SN.Audio.sfx('click');
      btn.classList.remove('wiggle');
      btn.classList.add('pressed');
      await this.wait(0.15);
      const thanks = U.el('div', 'thanks', `${st.thanks}<span style="font-size:8px;line-height:12px;color:${P.coalL}">Pago aplazado: 7 días</span>`);
      $('webshop').appendChild(thanks);
      SN.FX.confetti(50);
      SN.Audio.sfx('cheer');
      $('fake-cursor').classList.add('hidden');
      await this.say('', sub.click, { auto: 1 });
      // Cara de felicidad
      this.setShot({ type: 'face', expr: 'star', opts: { fist: true }, confetti: true });
      SN.Audio.sfx('win', { big: true });
      await this.say('Tú', sub.happy, { auto: 2.2 });
    },

    // ESCENA 2 — La deuda
    async sceneDebt() {
      const story = SN.Data.story, sub = story.introSubs;
      this.setShot({ type: 'black', lines: [], lineT: 0 });
      SN.Audio.setMood('silent');
      $('webshop').classList.add('hidden');
      await this.wait(0.9);
      SN.Audio.sfx('notify');
      for (const l of story.debtLines) {
        this.shot.lines.push({ text: l.text, color: P[l.color], t: 0 });
        SN.Audio.sfx(l.color === 'green' ? 'notify' : 'notifyBad');
        await this.wait(1.1);
      }
      await this.wait(0.8);
      this.setShot({ type: 'face', expr: 'confused', opts: { question: true }, night: true });
      this.shot.zoomTo = 1.45; this.shot.zoomTime = 7;
      SN.Audio.setMood('tense');
      const spots = [[40, 60], [430, 80], [60, 200], [440, 220]];
      story.notifications.forEach((text, i) => {
        SN.after(0.5 + i * 0.9, () => {
          if (!this.running || !this.shot || this.shot.type !== 'face') return;
          const n = U.el('div', 'notif', text);
          n.style.left = spots[i][0] + 'px'; n.style.top = spots[i][1] + 'px';
          $('stage').appendChild(n);
          this.notifs.push(n);
          SN.Audio.sfx('notifyBad');
        });
      });
      await this.say('Tú', sub.confused, { auto: 2.2 });
      this.shot.expr = 'worried';
      this.shot.opts = {};
      await this.say('Tú', sub.worried, { auto: 3 });
      this.notifs.forEach((n) => n.remove());
      this.notifs = [];
    },

    // ESCENA 3 — El encapuchado
    async sceneHooded() {
      const story = SN.Data.story;
      this.setShot(null);
      SN.Desk.phaseOverride = 'night';
      SN.Desk.dirty();
      const screen = $('screen');
      screen.classList.add('off');
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.01);
      SN.Game.camTo({ x: SN.SCREEN.x + SN.SCREEN.w / 2, y: 140, zoom: 1.12 }, 8);
      SN.Audio.setMood('silent');
      await this.wait(1.4);
      // El monitor se enciende solo
      SN.Audio.sfx('static', { dur: 0.9 });
      screen.classList.remove('off');
      screen.classList.remove('poweron'); void screen.offsetWidth; screen.classList.add('poweron');
      this.screenMode = 'static';
      this.screenT = 0;
      this.hoodA = 0;
      SN.ScreenCanvas.take('cine');
      SN.FX.glitch(0.8, 1.5);
      SN.Desk.led = 'alert';
      await this.wait(1.2);
      this.screenMode = 'hood';
      if (SN.Music) SN.Music.sting('hood');
      SN.Audio.sfx('whisper');
      await this.wait(1.4);
      for (const line of story.hoodedIntro) await this.say(story.hoodedName, line);
      this.screenMode = 'desktop';
      this.screenT = 0;
      SN.Audio.sfx('unlock');
      await this.wait(1.2);
      await this.say(story.hoodedName, story.hoodedApp);
      // La imagen se distorsiona y la aplicación se abre
      SN.Audio.sfx('static', { dur: 1.2 });
      SN.FX.glitch(1.3, 2.2);
      screen.classList.add('glitch');
      this.screenMode = 'open';
      this.screenT = 0;
      await this.wait(1.2);
      screen.classList.remove('glitch');
      SN.Desk.led = 'idle';
    },

    // Plano corto de la cara (también lo usa la narrativa: alivio al pagar la deuda)
    async faceBeat(expr, text, dur) {
      this.beat = true;
      this.setShot({ type: 'face', expr, opts: {} });
      $('subs').classList.remove('hidden');
      $('subs').innerHTML = `<b>Tú:</b> ${text}`;
      await new Promise((r) => { this.beatResolve = r; SN.after(dur, () => { if (this.beatResolve === r) { this.beatResolve = null; r(); } }); });
      $('subs').classList.add('hidden');
      this.setShot(null);
      this.beat = false;
    },

    buildShop() {
      const st = SN.Data.story.shop;
      const el = $('webshop');
      el.innerHTML = `<div class="shop-bar"><span class="shop-logo">★</span><span class="url">HTTPS://${st.store.toLowerCase()}/OFERTAS/PLEYZETA-6-ULTRA</span><span>${st.store}</span></div>
        <div class="shop-main">
          <div class="prod-img"><span class="tag">¡OFERTA!</span></div>
          <div class="prod-info">
            <div class="p-title">${st.product}</div>
            <div class="p-ed">${st.edition}</div>
            <div class="p-inc">${st.includes}</div>
            <ul>${st.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
            <div class="p-price"><b>${st.price}</b><s>${st.oldPrice}</s></div>
            <div class="p-bal hidden">${st.balance} · <i>${st.insufficient}</i></div>
            <button class="btn btn-yellow buy-now hidden">${st.buy}</button>
          </div>
        </div>`;
      this.shopCanvas = Px.canvas(130, 120);
      el.querySelector('.prod-img').insertBefore(this.shopCanvas, el.querySelector('.tag'));
    },

    // Mueve el cursor falso (y el ratón físico con él)
    moveCursor(x, y, dur) {
      const c = $('fake-cursor');
      c.classList.remove('hidden');
      c.style.backgroundImage = `url(${SN.Sprites.url('cursor', 1)})`;
      const from = this.cursor || { x, y };
      this.cursor = { x: from.x, y: from.y };
      return new Promise((resolve) => {
        let t = 0;
        const step = () => {
          t = Math.min(1, t + 1 / 60 / dur);
          const k = U.ease.inOutSine(t);
          this.cursor.x = U.lerp(from.x, x, k);
          this.cursor.y = U.lerp(from.y, y, k);
          c.style.left = Math.round(this.cursor.x) + 'px';
          c.style.top = Math.round(this.cursor.y) + 'px';
          SN.Hands.pointAt(SN.SCREEN.x + this.cursor.x, SN.SCREEN.y + this.cursor.y);
          if (t < 1 && !this.skipping) SN.after(1 / 60, step); else resolve();
        };
        step();
      });
    },

    // ---------- Render ----------
    update(dt) {
      this.t += dt;
      const s = this.say_;
      if (s) {
        if (s.shown < s.full.length) {
          const before = Math.floor(s.shown);
          s.shown = Math.min(s.full.length, s.shown + dt * 42);
          if (Math.floor(s.shown) !== before) {
            this.renderSubs();
            if (before % 2 === 0) SN.Audio.sfx('type', { voice: s.name === SN.Data.story.hoodedName ? 'hood' : 'me' });
          }
        } else if (s.auto) {
          s.t += dt;
          if (s.t >= s.auto) this.advance();
        }
      }
      if (this.shot) {
        const sh = this.shot;
        sh.t += dt;
        if (sh.zoomTime > 0) sh.zoom = U.lerp(1, sh.zoomTo, U.ease.inOutSine(Math.min(1, sh.t / sh.zoomTime)));
        if (sh.lines) sh.lines.forEach((l) => { l.t += dt; });
      }
      if (this.shopCanvas && !$('webshop').classList.contains('hidden')) {
        const g = Px.ctx(this.shopCanvas);
        g.clearRect(0, 0, 130, 120);
        SN.Chars.console(g, 0, 0, this.t);
      }
    },

    render() {
      const sh = this.shot;
      if (!sh) return;
      const g = this.g;
      if (sh.type === 'black') {
        R(g, 0, 0, 640, 360, '#171814');
        sh.lines.forEach((l, i) => {
          const n = Math.min(l.text.length, Math.floor(l.t * 30));
          Px.text(g, l.text.slice(0, n), 320, 130 + i * 30, l.color, { align: 'center', size: 16 });
        });
        return;
      }
      if (sh.type === 'face') this.renderFace(g, sh);
    },

    renderFace(g, sh) {
      const b = Px.ctx(this.buf);
      // Fondo: la habitación vista desde el monitor (pared violeta y persianas con luz)
      R(b, 0, 0, 160, 90, P.wall);
      for (let x = 2; x < 160; x += 7) R(b, x, 0, 1, 90, P.wallM);
      R(b, 6, 4, 46, 50, P.coalD);
      for (let y = 6; y < 52; y += 4) { R(b, 8, y, 42, 2, sh.night ? '#45367A' : '#FFA65A'); R(b, 8, y + 2, 42, 2, sh.night ? '#140E30' : '#9A3488'); }
      R(b, 118, 30, 42, 3, P.woodM); R(b, 122, 18, 5, 12, P.coral); R(b, 128, 20, 5, 10, P.orange); R(b, 134, 16, 5, 14, P.green);
      // De noche la habitación se oscurece, pero la cara queda iluminada por la pantalla
      if (sh.night) { b.globalAlpha = 0.55; R(b, 0, 0, 160, 90, P.coalDD); b.globalAlpha = 1; }
      // hoodIn: segundos que tarda la capucha en cubrir la cara (el final A)
      const o = sh.opts || {};
      SN.Hero.closeUp(b, HERO_EXPR[sh.expr] || 'worried', sh.t, o.hoodIn ? Object.assign({}, o, { hood: Math.min(1, sh.t / o.hoodIn) }) : o);
      if (sh.night) { b.globalAlpha = 0.14; R(b, 0, 0, 160, 90, P.coalDD); b.globalAlpha = 1; }
      if (sh.confetti) {
        for (let i = 0; i < 40; i++) {
          const x = (i * 37 + sh.t * (20 + (i % 5) * 6)) % 160, y = (i * 23 + sh.t * (30 + (i % 7) * 5)) % 90;
          R(b, Math.round(x), Math.round(y), 1, 2, [P.green, P.yellow, P.coral, P.cyan, P.orange][i % 5]);
        }
      }
      const z = sh.zoom || 1;
      const sw = 160 / z, shh = 90 / z;
      const sx = 80 - sw / 2, sy = U.clamp(44 - shh / 2, 0, 90 - shh);
      g.imageSmoothingEnabled = false;
      g.drawImage(this.buf, sx, sy, sw, shh, 0, 0, 640, 360);
    },

    // Lo que se ve en el monitor durante la escena del encapuchado
    renderScreen(g, dt) {
      this.screenT += dt;
      const t = this.screenT;
      R(g, 0, 0, 420, 236, P.coalDD);
      g.globalAlpha = this.screenMode === 'static' ? 0.8 : 0.3;
      for (let i = 0; i < 700; i++) R(g, U.randi(0, 419), U.randi(0, 235), U.randi(1, 3), 1, U.pick([P.coalL, P.creamDD, P.creamL, P.coal]));
      g.globalAlpha = 1;
      if (this.screenMode !== 'static') {
        this.hoodA = Math.min(1, this.hoodA + dt * 0.7);
        SN.Chars.hoodBacklight(g, 210, 96, this.t, this.hoodA);
        g.globalAlpha = this.hoodA;
        const img = SN.Chars.hoodedCanvas(this.t, {});
        const bob = Math.round(Math.sin(this.t * 1.5) * 2);
        g.drawImage(img, 0, 0, 40, 46, 170, 30 + bob, 80, 92);
        g.globalAlpha = 1;
      }
      if (this.screenMode === 'desktop' || this.screenMode === 'open') {
        const k = Math.min(1, t / 0.5);
        const bounce = Math.round(Math.abs(Math.sin(t * 5)) * 4 * (1 - Math.min(1, t / 2)));
        const ix = 336, iy = 150 - bounce;
        g.globalAlpha = k;
        g.drawImage(SN.Sprites.get('appBig'), ix, iy, 32, 32);
        R(g, ix - 10, iy + 35, 52, 10, P.coal);
        Px.text(g, SN.Cipher.brandText(true), ix + 16, iy + 43, P.yellow, { align: 'center' });
        g.globalAlpha = 1;
      }
      if (this.screenMode === 'open') {
        // La ventana de la app se expande desde el icono
        const k = U.ease.outBack(Math.min(1, t / 0.9));
        const w = U.lerp(32, 420, k), h = U.lerp(32, 236, k);
        const x = U.lerp(336, 0, k), y = U.lerp(150, 0, k);
        R(g, x, y, w, h, P.cream);
        R(g, x, y, w, Math.min(h, 11), P.coal);
        if (k > 0.6) Px.text(g, SN.Cipher.brandText(true), x + 14, y + 9, P.yellow);
      }
      // Barrido
      g.globalAlpha = 0.1;
      for (let y = Math.floor(t * 30) % 3; y < 236; y += 3) R(g, 0, y, 420, 1, P.creamL);
      g.globalAlpha = 1;
    },
  };
})(window.SN);
