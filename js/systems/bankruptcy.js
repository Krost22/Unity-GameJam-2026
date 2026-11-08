// BankruptcyManager: el cerdito de arcilla. NO es una mascota ni una barra de vida: solo aparece cuando
// la partida se acaba: sin dinero ni para la apuesta mínima (nunca por tener dinero comprometido en una
// operación), cuando vence el plazo sin pagar, o cuando ya es imposible llegar a pagar a tiempo.
// Secuencia: la interfaz se detiene, se oscurece, desaparecen los paneles, entra el cerdito,
// cada clic lo agrieta, al final se rompe en pedazos y monedas, y aparece el mensaje.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util, P = SN.PAL, Px = SN.Px;
  const HITS = 5;
  const CX = 210, CY = 110;
  const SC = 2; // el cerdito se dibuja al doble de tamaño: es el protagonista del momento

  const B = SN.Bankruptcy = {
    active: false,
    pig: null,
    dim: 0,
    ui: null,
    buf: null,

    shouldTrigger() {
      const run = S.run;
      return !!run && !run.position && run.capital + run.committed < D.sim.bankruptcyThreshold;
    },

    // Sin fondos para seguir apostando: aviso corto y directo al cerdito
    async broke() {
      SN.Game.setState('BANKRUPTCY');
      SN.Game.resetTime();
      const [a, b] = D.story.broke;
      SN.Audio.sfx('notifyBad');
      SN.FX.shake(3, 0.4);
      await SN.UI.stamp(a, 'coral', b, 1.8);
      return this.start();
    },

    // Plazo vencido (o imposible de cumplir) sin dinero suficiente: el cobrador se lo lleva todo
    async embargo({ early = false } = {}) {
      SN.Game.setState('BANKRUPTCY');
      SN.Game.resetTime();
      SN.Audio.setMood('tense');
      SN.Desk.led = 'alert';
      const seized = S.run.capital;
      const [a, b, c] = early ? D.story.embargoEarly : D.story.embargo;
      SN.Audio.sfx('notifyBad');
      SN.FX.shake(4, 0.6);
      await SN.UI.card(`<div class="overlay-panel"><div class="t1">${a}</div><div class="t2">${b}</div><div class="t2">${c}: ${U.money(seized)}</div></div>`, 'daycard embargo', 2.6);
      if (seized > 0) { SN.Economy.spend(seized, 'embargo'); SN.Audio.sfx('loss', { big: true }); }
      await SN.wait(0.6);
      return this.start();
    },

    start() {
      if (this.active) return;
      this.active = true;
      SN.Game.setState('BANKRUPTCY');
      SN.Windows.close(true);
      SN.Dialog.hide();
      SN.UI.clearSpot();
      SN.Audio.setMood('silent');
      SN.Audio.sfx('thud');
      SN.Desk.led = 'alert';
      SN.Hands.drumming = false;
      const run = S.run;
      run.over = true;
      S.profile.runs++;
      SN.Save.clearRun();
      SN.Save.saveProfile();
      this.dim = 0;
      this.pig = { state: 'wait', t: 0, y: -130, vy: 0, sx: 1, sy: 1, hits: 0, cracks: [], shake: 0, coins: U.rand(1.5, 9.5) };
      this.buf = Px.canvas(100, 80);
      SN.ScreenCanvas.take('piggy');
      const app = document.getElementById('app');
      app.style.transition = 'opacity .7s steps(7), transform .7s steps(7)';
      // Los paneles desaparecen después de oscurecerse
      SN.after(0.7, () => { app.style.opacity = '0'; app.style.transform = 'scale(.96)'; });
      SN.after(1.5, () => { this.pig.state = 'enter'; this.pig.vy = 60; SN.Audio.sfx('whoosh'); });
      const canvas = SN.ScreenCanvas.canvas;
      this.onClick = (e) => this.click(e);
      canvas.addEventListener('pointerdown', this.onClick);
      return new Promise((resolve) => { this.resolve = resolve; });
    },

    click(e) {
      const pig = this.pig;
      if (!pig || pig.state !== 'idle') return;
      const r = SN.ScreenCanvas.canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 420, y = (e.clientY - r.top) / r.height * 236;
      if (Math.abs(x - CX) > 36 * SC || Math.abs(y - (pig.y + 4)) > 28 * SC) return;
      pig.hits++;
      pig.shake = 0.25;
      pig.sx = 1.12; pig.sy = 0.88;
      SN.Hands.press();
      SN.Audio.sfx('crack', { n: pig.hits });
      SN.FX.burst(x, y, { n: 10, colors: [P.orangeD, P.orange, P.creamD], speed: 60, life: 0.5 });
      SN.FX.shake(1.5 + pig.hits * 0.6, 0.2);
      // Grieta que parte del punto del golpe
      const lx = U.clamp(Math.round((x - CX) / SC), -26, 26), ly = U.clamp(Math.round((y - pig.y) / SC), -18, 18);
      const crack = [[lx, ly]];
      let ang = U.rand(0, Math.PI * 2);
      for (let i = 0; i < 4 + pig.hits; i++) {
        ang += U.rand(-0.9, 0.9);
        const [px, py] = crack[crack.length - 1];
        crack.push([U.clamp(Math.round(px + Math.cos(ang) * U.rand(4, 8)), -26, 26), U.clamp(Math.round(py + Math.sin(ang) * U.rand(3, 6)), -18, 18)]);
      }
      pig.cracks.push(crack);
      if (pig.hits % 2 === 0) SN.FX.coins(x, y, 1, 0.5);
      if (pig.hits >= HITS) this.shatter();
    },

    shatter() {
      const pig = this.pig;
      pig.state = 'broken';
      SN.Audio.sfx('shatter');
      SN.FX.flash(P.creamL, 0.2, 0.6);
      SN.FX.shake(6, 0.5);
      SN.FX.ring(CX, pig.y, P.yellow, 120, 0.8);
      // Fragmentos de arcilla: el dibujo del cerdito troceado en bloques
      const g = Px.ctx(this.buf);
      g.clearRect(0, 0, 100, 80);
      SN.Chars.piggy(g, 50, 40, { cracks: pig.cracks, dizzy: true });
      const data = g.getImageData(0, 0, 100, 80).data;
      for (let by = 0; by < 80; by += 6) {
        for (let bx = 0; bx < 100; bx += 6) {
          if (data[((by + 3) * 100 + bx + 3) * 4 + 3] < 10) continue;
          const dx = bx - 50, dy = by - 40;
          const d = Math.hypot(dx, dy) || 1;
          SN.FX.shard(this.buf, bx, by, 6, 6, CX + (bx - 50) * SC, pig.y + (by - 40) * SC, dx / d * U.rand(70, 190), dy / d * U.rand(60, 150) - 130, SC);
        }
      }
      SN.FX.coins(CX, pig.y, 22, 2);
      SN.after(1.1, () => this.showMessage());
    },

    showMessage() {
      const st = D.story.bankrupt;
      const extra = st.extra[1].replace('{coins}', U.money(this.pig.coins));
      const el = U.el('div', 'overlay-panel piggy-ui');
      el.innerHTML = `<div class="msg"><div class="t1">${st.title}</div><div class="t2">${st.message}</div><div class="t3">${st.extra[0]}<br>${extra}</div></div>
        <div class="row"><button class="btn btn-yellow" id="bk-retry">Reintentar partida</button><button class="btn btn-cream" id="bk-menu">Volver al menú</button></div>`;
      document.getElementById('layer-top').appendChild(el);
      this.ui = el;
      SN.Audio.sfx('notify');
      el.querySelector('#bk-retry').addEventListener('click', () => this.finish('retry'));
      el.querySelector('#bk-menu').addEventListener('click', () => this.finish('menu'));
    },

    // Limpia la secuencia (también se usa al salir al menú)
    reset() {
      if (this.onClick) SN.ScreenCanvas.canvas.removeEventListener('pointerdown', this.onClick);
      if (this.ui) this.ui.remove();
      this.ui = null;
      this.pig = null;
      this.active = false;
      SN.ScreenCanvas.release('piggy');
      const app = document.getElementById('app');
      app.style.transition = '';
      app.style.opacity = '';
      app.style.transform = '';
      SN.FX.clear();
      SN.Desk.led = 'idle';
    },

    finish(choice) {
      SN.Audio.sfx('click');
      this.reset();
      const r = this.resolve;
      this.resolve = null;
      if (choice === 'retry') SN.Game.retry(); else SN.Game.toMenu();
      if (r) r(choice);
    },

    render(g, dt) {
      const pig = this.pig;
      g.clearRect(0, 0, 420, 236);
      if (!pig) return;
      this.dim = Math.min(1, this.dim + dt * 1.4);
      g.globalAlpha = 0.72 * this.dim;
      Px.rect(g, 0, 0, 420, 236, P.coalDD);
      g.globalAlpha = 1;
      pig.t += dt;
      if (pig.state === 'enter') {
        // Caída con rebote y aplastamiento
        pig.vy += 900 * dt;
        pig.y += pig.vy * dt;
        if (pig.y >= CY) {
          pig.y = CY;
          if (pig.vy > 120) { pig.vy = -pig.vy * 0.35; pig.sx = 1.25; pig.sy = 0.75; SN.Audio.sfx('thud'); SN.FX.burst(CX, CY + 26 * SC, { n: 10, colors: [P.creamDD], speed: 50, up: 10 }); SN.FX.shake(2, 0.2); }
          else { pig.vy = 0; pig.state = 'idle'; }
        }
      }
      pig.sx += (1 - pig.sx) * Math.min(1, dt * 10);
      pig.sy += (1 - pig.sy) * Math.min(1, dt * 10);
      pig.shake = Math.max(0, pig.shake - dt);
      if (pig.state === 'broken') {
        if (this.ui) return;
        return;
      }
      // Foco de luz cálido bajo el cerdito
      g.globalAlpha = 0.22 * this.dim;
      Px.ellipse(g, CX, CY + 27 * SC, 120, 14, P.yellow);
      g.globalAlpha = 0.3 * this.dim;
      Px.ellipse(g, CX, CY + 27 * SC, 80, 9, P.yellow);
      g.globalAlpha = 1;
      // Sombra (encoge cuando el cerdito está en el aire)
      const air = U.clamp((CY - pig.y) / 150, 0, 1);
      Px.ellipse(g, CX, CY + 27 * SC, Math.round(64 * (1 - air * 0.6)), 6, 'rgba(0,0,0,0.35)');
      const bg = Px.ctx(this.buf);
      bg.clearRect(0, 0, 100, 80);
      const breath = pig.state === 'idle' ? Math.sin(pig.t * 3) * 0.015 : 0;
      SN.Chars.piggy(bg, 50, 40, { cracks: pig.cracks, dizzy: pig.hits >= 3 });
      // Aplastamiento con el borde inferior fijo (squash & stretch)
      const w = Math.round(100 * SC * pig.sx), h = Math.round(80 * SC * (pig.sy + breath));
      const sx = pig.shake > 0 ? Math.round(Math.sin(pig.t * 80) * 3) : 0;
      g.drawImage(this.buf, Math.round(CX - w / 2) + sx, Math.round(pig.y + 40 * SC - h), w, h);
      if (pig.state === 'idle') {
        g.globalAlpha = 0.6 + Math.sin(pig.t * 6) * 0.4;
        Px.text(g, pig.hits ? `${HITS - pig.hits}...` : D.story.bankrupt.hint, CX, CY + 34 * SC + 8, P.yellow, { align: 'center', size: 16 });
        g.globalAlpha = 1;
      }
    },
  };
})(window.SN);
