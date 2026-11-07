// Efectos arcade dentro del monitor: partículas, monedas que rebotan, confeti, ondas expansivas,
// números que saltan, vibración, destellos, interferencias y, para la cámara lenta, barras de cine,
// viñeta, líneas de velocidad, grietas en el cristal y palabras enormes. Solo responden a sucesos reales.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px;
  const U = SN.Util;
  const FLOOR = 232;
  const SW = 420, SH = 236;
  const CONFETTI = [P.green, P.yellow, P.coral, P.cyan, P.orange, P.creamL];

  // Viñeta tramada (se dibuja una vez y se reutiliza con transparencia)
  let vignette = null;
  function buildVignette() {
    const c = Px.canvas(SW, SH), g = Px.ctx(c);
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const d = Math.min(x, y, SW - 1 - x, SH - 1 - y);
        if (d > 34) continue;
        const k = 1 - d / 34;
        if ((x + y) % 2 === 0 && k > 0.15) Px.rect(g, x, y, 1, 1, P.coalDD);
        else if (k > 0.65) Px.rect(g, x, y, 1, 1, P.coalDD);
      }
    }
    return c;
  }

  const FX = SN.FX = {
    canvas: null, g: null, floatLayer: null, screen: null,
    parts: [], rings: [], flashes: [], lines: [], cracksList: [],
    shakeT: 0, shakePow: 0,
    glitchT: 0, glitchPow: 0,
    cine: 0, cineTarget: 0, vignettePulse: 0,

    init(canvas, floatLayer, screen) {
      this.canvas = canvas;
      this.g = Px.ctx(canvas);
      this.floatLayer = floatLayer;
      this.screen = screen;
    },

    clear() {
      this.parts.length = 0; this.rings.length = 0; this.flashes.length = 0; this.lines.length = 0; this.cracksList.length = 0;
      this.glitchT = 0; this.cine = this.cineTarget = 0;
    },

    burst(x, y, { n = 12, colors = [P.green], speed = 70, up = 30, gravity = 160, life = 0.7, size = 2 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2), s = U.rand(speed * 0.3, speed);
        this.parts.push({ type: 'px', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, g: gravity, life: U.rand(life * 0.6, life), max: life, color: U.pick(colors), size: U.pick([1, size]) });
      }
    },
    coins(x, y, n = 8, spread = 1) {
      for (let i = 0; i < n; i++) {
        this.parts.push({ type: 'coin', x: x + U.rand(-4, 4), y, vx: U.rand(-60, 60) * spread, vy: U.rand(-150, -80), g: 380, life: U.rand(1.3, 1.9), max: 1.9, spin: U.rand(0, 4), spinV: U.rand(10, 18), bounces: 0 });
      }
    },
    confetti(n = 40) {
      for (let i = 0; i < n; i++) {
        this.parts.push({ type: 'conf', x: U.rand(10, 410), y: U.rand(-30, -4), vx: U.rand(-20, 20), vy: U.rand(30, 80), g: 30, life: U.rand(1.8, 2.8), max: 2.8, color: U.pick(CONFETTI), ph: U.rand(0, 6), w: U.pick([2, 3]), h: U.pick([2, 3, 4]) });
      }
    },
    sparkle(x, y, color = P.yellowL) {
      this.parts.push({ type: 'star', x, y, vx: U.rand(-6, 6), vy: -14, g: 0, life: 0.5, max: 0.5, color });
    },
    shard(img, sx, sy, sw, sh, x, y, vx, vy, scale = 1) {
      this.parts.push({ type: 'img', img, sx, sy, sw, sh, x, y, vx, vy, g: 420, life: 2.4, max: 2.4, bounces: 0, scale });
    },
    ring(x, y, color = P.yellow, maxR = 60, life = 0.6) {
      this.rings.push({ x, y, color, maxR, life, max: life });
    },
    flash(color = '#FFFFFF', life = 0.18, alpha = 0.6) {
      this.flashes.push({ color, life, max: life, alpha });
    },
    shake(power = 3, time = 0.3) { this.shakePow = Math.max(this.shakePow, power); this.shakeT = Math.max(this.shakeT, time); },
    glitch(time = 0.5, power = 1) { this.glitchT = Math.max(this.glitchT, time); this.glitchPow = power; },

    // Cámara lenta: barras de cine y viñeta (0 = nada, 1 = a tope)
    cinema(k) { this.cineTarget = k; },

    // Líneas de velocidad que salen del punto del golpe
    speedLines(x, y, color = P.yellow, life = 0.6) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + U.rand(-0.08, 0.08);
        this.lines.push({ x, y, a, r: U.rand(10, 30), v: U.rand(260, 420), len: U.rand(14, 34), color, life, max: life });
      }
    },

    // Grietas en el cristal del monitor (pérdidas brutales)
    cracks(x, y, n = 6) {
      const paths = [];
      for (let i = 0; i < n; i++) {
        let ang = (i / n) * Math.PI * 2 + U.rand(-0.3, 0.3);
        const pts = [[x, y]];
        for (let s = 0; s < 5; s++) {
          ang += U.rand(-0.5, 0.5);
          const [px, py] = pts[pts.length - 1];
          pts.push([px + Math.cos(ang) * U.rand(10, 22), py + Math.sin(ang) * U.rand(8, 18)]);
        }
        paths.push(pts);
      }
      this.cracksList.push({ paths, life: 1.6, max: 1.6 });
    },

    // Número que salta (DOM, fuente pixel). cls: gain | loss | gold, small
    float(text, x, y, cls = 'gain') {
      const el = U.el('div', 'float ' + cls, text);
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
      this.floatLayer.appendChild(el);
      SN.after(1.5, () => el.remove());
    },
    // Palabra enorme de impacto (¡BOOM!, ¡CRASH!...)
    word(text, x, y, cls = 'gain') {
      const el = U.el('div', 'boom ' + cls, text);
      el.style.left = Math.round(U.clamp(x, 70, 350)) + 'px';
      el.style.top = Math.round(U.clamp(y, 26, 200)) + 'px';
      this.floatLayer.appendChild(el);
      SN.after(1.4, () => el.remove());
    },

    // Reacciones compuestas a resultados de operaciones
    win(pnl, x, y, big) {
      this.burst(x, y, { n: big ? 30 : 16, colors: [P.green, P.greenL, P.yellow], speed: big ? 110 : 75 });
      this.coins(x, y, big ? 14 : 6);
      this.ring(x, y, P.green, big ? 90 : 45);
      if (big) { this.confetti(50); this.ring(x, y, P.yellow, 140, 0.9); this.flash(P.yellowL, 0.2, 0.35); }
    },
    loss(pnl, x, y, big) {
      this.burst(x, y, { n: big ? 26 : 12, colors: [P.coral, P.coralD, P.coalL], speed: big ? 90 : 55, up: 0, gravity: 220 });
      this.shake(big ? 5 : 2.5, big ? 0.5 : 0.3);
      if (big) { this.flash(P.coral, 0.25, 0.4); this.ring(x, y, P.coral, 70); }
    },

    update(dt, realDt = dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        if (p.type === 'conf') { p.vx += Math.sin(p.ph + p.life * 6) * 60 * dt; p.vx *= 0.96; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const ph = p.type === 'img' ? p.sh * p.scale : 4;
        if ((p.type === 'coin' || p.type === 'img') && p.y > FLOOR - ph && p.vy > 0) {
          p.y = FLOOR - ph;
          p.vy *= -0.45; p.vx *= 0.7; p.bounces++;
          if (p.type === 'coin' && p.bounces <= 2 && SN.Audio) SN.Audio.sfx('coinBounce', { quiet: true });
        }
        if (p.type === 'coin') p.spin += p.spinV * dt;
      }
      for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; if (r.life <= 0) this.rings.splice(i, 1); }
      for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.life -= dt; if (f.life <= 0) this.flashes.splice(i, 1); }
      for (let i = this.lines.length - 1; i >= 0; i--) { const l = this.lines[i]; l.life -= dt; l.r += l.v * dt; if (l.life <= 0) this.lines.splice(i, 1); }
      for (let i = this.cracksList.length - 1; i >= 0; i--) { const c = this.cracksList[i]; c.life -= dt; if (c.life <= 0) this.cracksList.splice(i, 1); }
      // Barras de cine y viñeta: en tiempo real (no se ralentizan con la cámara lenta)
      this.cine += (this.cineTarget - this.cine) * Math.min(1, realDt * 5);
      if (Math.abs(this.cine - this.cineTarget) < 0.01) this.cine = this.cineTarget;
      this.vignettePulse = Math.max(0, this.vignettePulse - realDt * 3);
      // Vibración de la pantalla (en píxeles enteros)
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const k = Math.max(0, this.shakeT) * 3;
        const s = this.shakePow * Math.min(1, k);
        this.screen.style.transform = `translate(${Math.round(U.rand(-s, s))}px, ${Math.round(U.rand(-s, s))}px)`;
        if (this.shakeT <= 0) { this.screen.style.transform = ''; this.shakePow = 0; }
      }
      if (this.glitchT > 0) this.glitchT -= dt;
    },

    render() {
      const g = this.g;
      if (!g) return;
      g.clearRect(0, 0, SW, SH);
      // Viñeta y barras de cine (debajo de todo lo demás)
      if (this.cine > 0.01) {
        if (!vignette) vignette = buildVignette();
        g.globalAlpha = Math.min(1, this.cine * (0.75 + this.vignettePulse * 0.25));
        g.drawImage(vignette, 0, 0);
        g.globalAlpha = 1;
        const bar = Math.round(13 * this.cine);
        Px.rect(g, 0, 0, SW, bar, P.coalDD);
        Px.rect(g, 0, SH - bar, SW, bar, P.coalDD);
      }
      for (const f of this.flashes) {
        g.globalAlpha = f.alpha * (f.life / f.max);
        Px.rect(g, 0, 0, SW, SH, f.color);
      }
      g.globalAlpha = 1;
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        const rad = Math.round(4 + r.maxR * U.ease.outCubic(k));
        g.globalAlpha = 1 - k;
        Px.circleOutline(g, r.x, r.y, rad, r.color);
        if (rad > 6) Px.circleOutline(g, r.x, r.y, rad - 2, r.color, 2);
      }
      for (const l of this.lines) {
        g.globalAlpha = Math.min(1, l.life / l.max * 1.6);
        const x0 = l.x + Math.cos(l.a) * l.r, y0 = l.y + Math.sin(l.a) * l.r;
        Px.line(g, x0, y0, x0 + Math.cos(l.a) * l.len, y0 + Math.sin(l.a) * l.len, l.color);
      }
      for (const c of this.cracksList) {
        g.globalAlpha = Math.min(1, c.life / c.max * 2);
        for (const pts of c.paths) {
          for (let i = 1; i < pts.length; i++) {
            Px.line(g, pts[i - 1][0], pts[i - 1][1] + 1, pts[i][0], pts[i][1] + 1, P.coalDD);
            Px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], P.creamL);
          }
        }
      }
      g.globalAlpha = 1;
      for (const p of this.parts) {
        const fade = Math.min(1, p.life / (p.max * 0.3));
        g.globalAlpha = fade;
        const x = Math.round(p.x), y = Math.round(p.y);
        if (p.type === 'px') Px.rect(g, x, y, p.size, p.size, p.color);
        else if (p.type === 'coin') g.drawImage(SN.Sprites.coinFrame(p.spin), x - 4, y - 4);
        else if (p.type === 'conf') {
          const flip = Math.sin(p.ph + p.life * 9) > 0;
          Px.rect(g, x, y, flip ? p.w : 1, p.h, p.color);
        } else if (p.type === 'star') {
          Px.rect(g, x - 2, y, 5, 1, p.color); Px.rect(g, x, y - 2, 1, 5, p.color);
        } else if (p.type === 'img') g.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, x, y, p.sw * p.scale, p.sh * p.scale);
      }
      g.globalAlpha = 1;
      // Interferencia: franjas desplazadas, ruido y barras de color de la paleta
      if (this.glitchT > 0) {
        const pow = this.glitchPow;
        for (let i = 0; i < 6 * pow; i++) {
          const y = U.randi(0, 230), h = U.randi(1, 6);
          g.globalAlpha = U.rand(0.25, 0.7);
          Px.rect(g, 0, y, SW, h, U.pick([P.coal, P.coalDD, P.creamL, P.coral, P.cyan]));
        }
        g.globalAlpha = 0.5;
        for (let i = 0; i < 160 * pow; i++) Px.rect(g, U.randi(0, 419), U.randi(0, 235), 1, 1, U.pick([P.creamL, P.coal]));
        g.globalAlpha = 1;
      }
    },
  };
})(window.SN);
