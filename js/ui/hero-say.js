// El protagonista habla: globos de texto encima del teclado (en la habitación, fuera del monitor) cuando pasa
// algo en la historia. Las frases están en D.story.heroSays (varias por suceso, sin repetir seguidas).
// No bloquean nada: hacen cola y, durante una cinemática o un diálogo, esperan a que termine.
//   SN.HeroSay.say('debtPaid')  -> una frase de ese suceso      SN.HeroSay.say('¡Hola!', { raw: true })
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;
  const GAP = 5;          // segundos mínimos entre globos
  const REPEAT = 35;      // segundos antes de repetir el mismo suceso (salvo los importantes)
  const IMPORTANT = ['debtPaid', 'gift', 'offer', 'black', 'timmy', 'bravo', 'newMarket', 'kevoGone'];

  const H = SN.HeroSay = {
    el: null, queue: [], cur: null, wait: 0, last: {}, used: {},

    init() {
      this.el = SN.Util.el('div', 'px-font hidden');
      this.el.id = 'hero-say';
      document.getElementById('stage').appendChild(this.el);
    },

    // Pide un globo. key: suceso de D.story.heroSays (o el texto con { raw: true }). chance: probabilidad.
    say(key, opts = {}) {
      if (!this.el || (opts.chance != null && Math.random() > opts.chance)) return;
      const now = performance.now() / 1000;
      if (!opts.raw && !IMPORTANT.includes(key) && this.last[key] && now - this.last[key] < REPEAT) return;
      const text = opts.raw ? key : this.pick(key);
      if (!text) return;
      this.last[key] = now;
      if (IMPORTANT.includes(key)) this.queue.unshift(text); else this.queue.push(text);
      if (this.queue.length > 2) this.queue.length = 2;
    },
    // Una frase del suceso, sin repetir la última
    pick(key) {
      const all = (D.story.heroSays || {})[key];
      if (!all || !all.length) return null;
      const used = this.used[key] || [];
      let pool = all.filter((_, i) => !used.includes(i));
      if (!pool.length) { this.used[key] = []; pool = all; }
      const t = pool[Math.floor(Math.random() * pool.length)];
      (this.used[key] = this.used[key] || []).push(all.indexOf(t));
      return t;
    },
    // ¿Se puede hablar ahora? (nada de globos en cinemáticas, diálogos ni fuera de la partida)
    free() {
      return SN.Game.state === 'GAMEPLAY' && !SN.Dialog.active && !(SN.Cine && SN.Cine.running) && !(SN.Sneak && SN.Sneak.active) &&
        !(SN.Narrative && SN.Narrative.hood) && !(SN.Bankruptcy && SN.Bankruptcy.active);
    },
    clear() { this.queue = []; this.hide(); },
    hide() {
      if (!this.cur) return;
      this.cur = null;
      this.el.classList.add('out');
      SN.after(0.25, () => { if (!this.cur) this.el.classList.add('hidden'); });
    },

    update(dt) {
      if (!this.el) return;
      this.wait = Math.max(0, this.wait - dt);
      const c = this.cur;
      if (c) {
        if (!this.free()) { this.hide(); return; }
        // Letra a letra (las palabras clave, con su color) y luego se queda un rato
        if (c.shown < c.text.length) {
          c.shown = Math.min(c.text.length, c.shown + dt * 40);
          this.el.querySelector('.hs-t').innerHTML = SN.KW.html(c.text.slice(0, Math.floor(c.shown)));
          if (Math.floor(c.shown) % 3 === 0 && c.text[Math.floor(c.shown) - 1] !== ' ') SN.Audio.sfx('type', { voice: 'hero' });
        } else if ((c.t -= dt) <= 0) { this.hide(); this.wait = GAP; }
        return;
      }
      if (!this.queue.length || this.wait > 0 || !this.free()) return;
      const text = this.queue.shift();
      this.cur = { text, shown: 0, t: U.clamp(1.8 + text.length * 0.045, 2.5, 4) };
      this.el.innerHTML = '<span class="hs-t"></span>';
      this.el.classList.remove('hidden', 'out');
      void this.el.offsetWidth;
      this.el.classList.add('in');
    },
  };
  const U = SN.Util;

  // ---------- Qué le hace hablar ----------
  const E = SN.Events;
  E.on('debt:paid', () => H.say('debtPaid'));
  E.on('gift:given', () => H.say('gift'));
  E.on('offer:prompt', ({ why }) => { if (why === 'new') H.say('offer'); });
  E.on('market:unlocked', ({ market }) => {
    const d = D.marketById(market);
    if (S.run && !(SN.Tutorial && SN.Tutorial.active)) H.say(d && d.black ? 'black' : 'newMarket');
  });
  E.on('trade:closed', (r) => {
    if (!r || r.tutorial) return;
    const big = Math.max(40, r.amount * 0.6);
    if (r.capped && r.pnl > 0) H.say('cap', { chance: 0.6 });
    else if (r.liquidated || r.pnl <= -big) H.say('bigLoss', { chance: 0.75 });
    else if (r.pnl >= big) H.say('bigWin', { chance: 0.6 });
    else if (r.pnl < 0) H.say('loss', { chance: 0.15 });
  });
  E.on('luck:day', () => H.say('lucky'));
  E.on('cipher:found', ({ isNew }) => { if (isNew) H.say('cipher'); });
  E.on('kevo:writes', () => H.say('kevo', { chance: 0.5 }));
  E.on('kevo:done', ({ id }) => { if (id === 'ventana') SN.after(2, () => H.say('kevoGone')); });
  E.on('bravo:message', () => H.say('bravo', { chance: 0.35 }));
  E.on('academy:open', () => H.say('bravo'));
  E.on('academy:bought', () => H.say('academy'));
  E.on('academy:income', () => H.say('income', { chance: 0.4 }));
  E.on('shop:new', () => H.say('shopNew', { chance: 0.5 }));
  E.on('piggy:broken', () => SN.after(1.5, () => H.say('timmy')));
  E.on('turn:ready', () => {
    const run = S.run;
    if (!run) return;
    if (SN.Desktop && SN.Desktop.kevoGone() && !run.finale && Math.random() < 0.06) H.say('kevoGone');
    else if (run.turn === 2 && Math.random() < 0.15) H.say('night');
    else if (SN.Debt.active() && SN.Debt.daysLeft() <= 1 && !SN.Debt.canPay() && Math.random() < 0.4) H.say('lastDay');
  });
})(window.SN);
