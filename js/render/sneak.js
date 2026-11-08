// Cinemática jugable: entrar a escondidas en el cuarto de Tommy (tu hermano pequeño) y coger su cerdito.
// Primera persona, como el resto del juego: solo se ve tu mano. Se avanza manteniendo pulsado
// (clic, ESPACIO o ↑) y hay que soltar cuando Tommy se mueve: si te ve moverte, retrocedes.
// Al llegar a la estantería, un clic en el cerdito y se acabó: vuelves a tu cuarto con él.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, U = SN.Util, PK = SN.PK;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const W = 160, H = 90;
  const PIG = { x: 131, y: 33 }; // el cerdito en la estantería
  const KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);

  // Mano derecha que avanza hacia la estantería (vista desde atrás, dedos hacia arriba)
  function buildHand(open) {
    const sp = new PK.Sprite(40, 46);
    const skin = [P.skinDD, P.skinD, P.skinM, P.skin, P.skinL];
    const hand = sp.mask().taper(20, 30, 6.5, 22, 46, 7.5).poly([[11, 20], [14, 15], [21, 13], [28, 14], [31, 19], [30, 27], [26, 32], [15, 32], [11, 27]]);
    const spread = open ? 1.6 : 0.6;
    [[13.5, 17, -14 * spread, 6], [18.5, 14.5, -5 * spread, 8], [23.5, 14, 3 * spread, 8.5], [28, 15.5, 11 * spread, 7]].forEach(([x, y, a, len]) => {
      const r = a * Math.PI / 180;
      hand.taper(x, y, 2.3, x + Math.sin(r) * len, y - Math.cos(r) * len, 1.9);
    });
    hand.taper(12, 27, 2.8, 6 - (open ? 2 : 0), 22, 2.1); // pulgar
    sp.part(hand, skin, { light: [0, -1], hi: 1, lit: 3, sh: 3 });
    const sleeve = sp.mask().poly([[9, 38], [33, 36], [36, 46], [6, 46]]);
    sp.part(sleeve, [P.shirtDD, P.shirtD, P.shirt, P.shirtM, P.shirtL], { light: [0, -1], lit: 1, sh: 2 });
    sp.line(11, 41, 32, 39, P.shirtD);
    return sp.c;
  }

  const Sn = SN.Sneak = {
    active: false,

    play() {
      this.active = true;
      this.p = 0;          // avance hacia la estantería (0..1)
      this.t = 0;
      this.hold = false;
      this.caught = 0;     // cuántas veces te ha visto moverte
      this.flash = 0;
      this.state = 'walk'; // walk -> reach -> grab -> out
      this.tommy = { st: 'sleep', t: 0, next: U.rand(2.2, 3.4) };
      this.say = 'Mantén pulsado para avanzar. Si Tommy se mueve, ¡quieto!';
      this.buf = Px.canvas(W, H);
      this.room = Px.canvas(W, H);
      this.hands = { idle: buildHand(false), open: buildHand(true) };
      this.cv = document.getElementById('cine');
      this.g = Px.ctx(this.cv);
      this.cv.classList.remove('hidden');
      SN.Audio.setMood('silent');
      const down = (e) => { if (e.button === 0 || e.pointerType === 'touch') this.press(true); };
      const up = () => this.press(false);
      const kd = (e) => { if (KEYS.has(e.code)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) this.press(true); } else if (e.code !== 'Escape') e.stopPropagation(); };
      const ku = (e) => { if (KEYS.has(e.code)) { e.preventDefault(); this.press(false); } };
      document.addEventListener('pointerdown', down, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('keydown', kd, true);
      document.addEventListener('keyup', ku, true);
      this.off = () => {
        document.removeEventListener('pointerdown', down, true);
        document.removeEventListener('pointerup', up, true);
        document.removeEventListener('keydown', kd, true);
        document.removeEventListener('keyup', ku, true);
      };
      let last = performance.now();
      const loop = (now) => {
        if (!this.active) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return new Promise((resolve) => { this.resolve = resolve; });
    },

    press(on) {
      if (!this.active) return;
      if (this.state === 'reach' && on) { this.grab(); return; }
      this.hold = on && this.state === 'walk';
    },

    grab() {
      this.state = 'grab';
      this.gt = 0;
      SN.Audio.sfx('pop');
      this.say = '';
    },

    // Salir al menú o empezar otra partida en mitad de la escena
    abort() {
      if (!this.active) return;
      this.active = false;
      this.off();
      this.cv.classList.add('hidden');
      this.resolve = null;
    },

    finish() {
      this.active = false;
      this.off();
      this.cv.classList.add('hidden');
      const r = this.resolve;
      this.resolve = null;
      if (r) r({ caught: this.caught });
    },

    update(dt) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt * 2);
      const tm = this.tommy;
      tm.t += dt;
      // Tommy duerme, se remueve (aviso) y a veces mira hacia la puerta
      if (this.state === 'walk') {
        if (tm.st === 'sleep' && tm.t > tm.next) { tm.st = 'stir'; tm.t = 0; SN.Audio.sfx('heart'); }
        else if (tm.st === 'stir' && tm.t > 0.75) { tm.st = 'look'; tm.t = 0; }
        else if (tm.st === 'look' && tm.t > U.rand(1.3, 1.9)) { tm.st = 'sleep'; tm.t = 0; tm.next = U.rand(1.6, 3.4); }
        if (this.hold) {
          if (tm.st === 'look') {
            // Te ha visto moverte: te quedas helado y retrocedes
            this.caught++;
            this.hold = false;
            this.p = Math.max(0, this.p - 0.22);
            this.flash = 1;
            tm.st = 'sleep'; tm.t = 0; tm.next = U.rand(1.6, 2.6);
            SN.Audio.sfx('notifyBad');
            SN.FX.shake(3, 0.3);
            this.say = this.caught === 1 ? 'Tommy: "...¿hermano?" — Vuelves a la puerta. Suelta cuando se mueva.' : 'Tommy: "mmh..." — Casi. Otra vez.';
          } else {
            this.p = Math.min(1, this.p + dt * 0.16);
            if (Math.floor(this.t * 3) !== Math.floor((this.t - dt) * 3)) SN.Audio.sfx('tick');
            if (this.p >= 1) { this.state = 'reach'; this.hold = false; this.say = '¡Ahí está! Clic para cogerlo'; SN.Audio.sfx('select'); }
          }
        }
      } else if (this.state === 'grab') {
        this.gt += dt;
        if (this.gt > 1.6) { this.state = 'out'; this.ot = 0; }
      } else if (this.state === 'out') {
        this.ot += dt;
        if (this.ot > 1.4) this.finish();
      }
    },

    drawRoom(g) {
      const tm = this.tommy;
      // Pared y suelo
      R(g, 0, 0, W, 62, '#1C1A3C');
      for (let x = 4; x < W; x += 9) R(g, x, 0, 1, 62, '#221F46');
      R(g, 0, 62, W, 28, '#2A1E35');
      for (let i = -6; i < 12; i++) { g.fillStyle = '#231929'; g.beginPath(); g.moveTo(80 + i * 4, 62); g.lineTo(80 + i * 22, 90); g.lineTo(81 + i * 22, 90); g.lineTo(81 + i * 4, 62); g.fill(); }
      // Ventana con la luna
      R(g, 66, 8, 30, 28, '#0B0A1E'); R(g, 67, 9, 28, 26, '#3B4C8C');
      Px.ellipse(g, 88, 15, 4, 4, '#E8ECFF'); Px.ellipse(g, 86, 14, 3, 3, '#3B4C8C');
      for (let y = 11; y < 35; y += 3) R(g, 67, y, 28, 1, '#2A3670');
      R(g, 80, 9, 1, 26, '#0B0A1E'); R(g, 66, 35, 30, 2, '#2E2A55');
      // Luz de luna en el suelo
      g.globalAlpha = 0.12; g.fillStyle = '#9FB6FF'; g.beginPath(); g.moveTo(68, 62); g.lineTo(95, 62); g.lineTo(118, 90); g.lineTo(62, 90); g.fill(); g.globalAlpha = 1;
      // Póster de dinosaurio
      R(g, 22, 12, 18, 14, '#3A6E5A'); R(g, 23, 13, 16, 12, '#4E8C6E');
      R(g, 27, 17, 8, 4, '#2C5444'); R(g, 33, 15, 3, 3, '#2C5444'); R(g, 28, 21, 1, 2, '#2C5444'); R(g, 32, 21, 1, 2, '#2C5444');
      // Lamparita de noche
      g.globalAlpha = 0.1; Px.ellipse(g, 60, 56, 9, 6, '#FFB84A'); g.globalAlpha = 0.12; Px.ellipse(g, 60, 56, 5, 4, '#FFD66B'); g.globalAlpha = 1;
      R(g, 58, 56, 4, 6, '#3A2A3A'); Px.ellipse(g, 60, 55, 2, 2, '#FFE08A');
      // Cama y Tommy
      R(g, 4, 50, 54, 14, '#3A2848'); R(g, 4, 46, 6, 18, '#4A3258');
      R(g, 9, 47, 12, 6, '#C9C2E8');
      const lift = tm.st === 'look' ? -3 : tm.st === 'stir' ? (Math.sin(tm.t * 30) > 0 ? -1 : 0) : 0;
      Px.ellipse(g, 15, 48 + lift, 5, 4, '#F2B48C');
      R(g, 10, 44 + lift, 10, 3, '#6B3E2A'); R(g, 9, 45 + lift, 2, 3, '#6B3E2A');
      if (tm.st === 'look') { R(g, 13, 48 + lift, 1, 1, '#FFFFFF'); R(g, 17, 48 + lift, 1, 1, '#FFFFFF'); }
      else { R(g, 12, 49 + lift, 2, 1, '#8A4A3A'); R(g, 16, 49 + lift, 2, 1, '#8A4A3A'); }
      const breath = tm.st === 'sleep' && Math.sin(this.t * 2) > 0 ? 1 : 0;
      Px.ellipse(g, 36, 52 - breath, 20, 6, '#5D5AB8'); R(g, 18, 52, 38, 8, '#5D5AB8');
      R(g, 20, 55, 34, 1, '#4A479A'); R(g, 26, 52, 1, 8, '#4A479A'); R(g, 40, 52, 1, 8, '#4A479A');
      if (tm.st === 'sleep') { const k = (this.t * 0.6) % 1; g.globalAlpha = Math.sin(k * Math.PI); Px.text(g, 'z', 22 + k * 4, 42 - k * 8, '#C9C2E8'); g.globalAlpha = 1; }
      if (tm.st === 'stir') Px.text(g, '?', 21, 41, P.yellow);
      if (tm.st === 'look') Px.text(g, '!', 21, 40, P.coral);
      // Estantería con juguetes y el cerdito
      R(g, 112, 40, 40, 3, '#5A3A2A'); R(g, 112, 43, 40, 1, '#3A2418');
      R(g, 115, 30, 4, 10, '#D8483F'); R(g, 116, 27, 2, 3, '#E8ECFF'); R(g, 114, 37, 6, 3, '#F0C030');
      R(g, 143, 33, 3, 7, '#3B8CD8'); R(g, 146, 31, 3, 9, '#E0A030');
      if (this.state !== 'grab' && this.state !== 'out') this.drawPig(g, PIG.x, PIG.y);
      // Notita pegada: para qué es el dinero
      R(g, 124, 44, 14, 6, '#F4E8A8');
      R(g, 126, 46, 10, 1, '#8A7A50'); R(g, 126, 48, 7, 1, '#8A7A50');
    },

    drawPig(g, x, y) {
      Px.ellipse(g, x, y, 8, 6, '#E8899E');
      Px.ellipse(g, x - 2, y - 2, 4, 2, '#F5B3C2');
      R(g, x + 7, y - 1, 3, 3, '#D4708A'); R(g, x + 8, y, 1, 1, '#8A3A50');
      R(g, x + 3, y - 6, 2, 2, '#D4708A'); R(g, x - 3, y - 6, 2, 2, '#D4708A');
      R(g, x + 4, y - 2, 1, 1, '#2A1830');
      R(g, x - 5, y + 5, 2, 2, '#C9607A'); R(g, x + 3, y + 5, 2, 2, '#C9607A');
      R(g, x - 2, y - 6, 4, 1, '#2A1830'); // la ranura de las monedas
    },

    render() {
      const g = this.g, b = Px.ctx(this.buf), room = Px.ctx(this.room);
      this.drawRoom(room);
      // Cámara: avanza hacia la estantería con el balanceo de los pasos
      const p = U.ease.inOutSine(this.p);
      const zoom = 1 + p * 1.5;
      const cx = U.lerp(80, PIG.x - 6, p), cy = U.lerp(45, PIG.y + 6, p);
      const bob = this.hold ? Math.round(Math.sin(this.t * 9) * 1) : 0;
      const sw = W / zoom, sh = H / zoom;
      const sx = U.clamp(cx - sw / 2, 0, W - sw), sy = U.clamp(cy - sh / 2 + bob / zoom, 0, H - sh);
      b.clearRect(0, 0, W, H);
      b.imageSmoothingEnabled = false;
      b.drawImage(this.room, sx, sy, sw, sh, 0, 0, W, H);
      g.imageSmoothingEnabled = false;
      g.drawImage(this.buf, 0, 0, W, H, 0, 0, 640, 360);
      // Oscuridad de noche y viñeta
      g.globalAlpha = 0.28; R(g, 0, 0, 640, 360, '#05040F'); g.globalAlpha = 1;
      const vg = g.createRadialGradient(320, 180, 120, 320, 180, 380);
      vg.addColorStop(0, 'rgba(5,4,15,0)'); vg.addColorStop(1, 'rgba(5,4,15,0.85)');
      g.fillStyle = vg; g.fillRect(0, 0, 640, 360);
      if (this.flash > 0) { g.globalAlpha = this.flash * 0.35; R(g, 0, 0, 640, 360, P.coral); g.globalAlpha = 1; }
      // La mano: sube al alcanzar y se cierra al coger el cerdito
      const tm = this.tommy;
      let hx = 420, hy = 250 + (this.hold ? Math.round(Math.sin(this.t * 9) * 4) : 0), hand = this.hands.idle;
      if (this.state === 'reach') { hy = 210 + Math.round(Math.sin(this.t * 4) * 3); hand = this.hands.open; }
      if (this.state === 'grab') {
        const k = Math.min(1, this.gt / 0.5);
        hy = U.lerp(210, 120, k); hx = U.lerp(420, 330, k);
        hand = k < 1 ? this.hands.open : this.hands.idle;
        if (k >= 1) {
          // El cerdito en la mano, bajando
          const d = Math.min(1, (this.gt - 0.5) / 0.9);
          hy = U.lerp(120, 300, d);
          const pg = Px.canvas(24, 18); this.drawPig(Px.ctx(pg), 12, 9);
          g.drawImage(pg, 0, 0, 24, 18, hx + 20, hy - 30, 96, 72);
        }
      }
      if (this.state !== 'out') g.drawImage(hand, 0, 0, 40, 46, hx, hy, 160, 184);
      if (this.state === 'out') { g.globalAlpha = Math.min(1, this.ot / 0.8); R(g, 0, 0, 640, 360, '#05040F'); g.globalAlpha = 1; if (this.ot > 0.6) Px.text(g, 'Vuelves a tu cuarto con el cerdito...', 320, 184, P.creamD, { align: 'center', size: 16 }); }
      // Indicaciones: barra de avance y qué hacer
      if (this.state === 'walk' || this.state === 'reach') {
        R(g, 160, 330, 320, 8, '#151229'); R(g, 162, 332, Math.round(316 * this.p), 4, tm.st === 'look' ? P.coral : P.yellow);
        Px.text(g, this.say, 320, 322, tm.st === 'look' ? P.coralL : P.creamL, { align: 'center', size: 8 });
        if (this.state === 'walk') Px.text(g, 'CLIC / ESPACIO', 320, 352, P.ink3 || '#8E7FA8', { align: 'center', size: 8 });
      }
      if (tm.st === 'look' && this.state === 'walk') Px.text(g, '¡QUIETO!', 320, 60, P.coral, { align: 'center', size: 24 });
    },
  };
  void Sn;
})(window.SN);
