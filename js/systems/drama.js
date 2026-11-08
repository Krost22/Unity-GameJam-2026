// Drama: la cámara lenta de los giros inesperados en las últimas velas.
// Tensión -> decisión -> golpe:
//   1. ARRASTRE: el tiempo se frena, la cámara se acerca, la música se apaga y late un corazón.
//      La vela se arrastra despacio (a veces amagando hacia el lado contrario). Aún puedes CERRAR.
//   2. LATIGAZO: la vela salta de golpe a su cierre (demasiado rápido para reaccionar).
//   3. GOLPE: todo se congela un instante, destello, temblor, partículas y una palabra enorme.
//   4. VUELTA: el tiempo vuelve poco a poco y la cámara se aleja.
// Si ya habías cobrado, se juega una versión corta: lo que te ahorraste (o te perdiste).
(function (SN) {
  'use strict';
  const P = SN.PAL, U = SN.Util;
  const SNAP_P = 0.72;          // debe coincidir con el SNAP de chart.js
  const SNAP = 0.16, FREEZE = 0.13, AFTER = 0.6;

  const Drama = SN.Drama = {
    active: false, p: 0, t: 0, stage: null, light: false,

    begin(chart, anim) {
      const run = SN.State.run;
      const pos = run && run.position;
      this.active = true;
      this.t = 0; this.p = 0; this.t0 = 0;
      this.stage = 'crawl';
      this.light = !pos || !!pos.settled;
      this.crawl = this.light ? 0.85 : 2.1;
      this.chart = chart;
      this.candle = chart.tradeCandle(anim.climax);
      this.up = this.candle.c >= this.candle.o;
      this.dir = pos ? pos.direction : 1;
      this.good = (this.up ? 1 : -1) === this.dir;
      this.nextBeat = 0;
      SN.Game.slowTo(this.light ? 0.5 : 0.22, 0.25);
      SN.Game.focusOn(this.light ? 1.25 : 1.75, this.light ? 0.5 : 1.3);
      SN.FX.cinema(this.light ? 0.5 : 1);
      if (!this.light) {
        SN.Audio.duck(true);
        SN.Audio.sfx('riser', { dur: this.crawl + SNAP });
        SN.Hands.drumming = false;
      }
      SN.Events.emit('drama:start', { light: this.light });
    },

    // Has cobrado en plena cámara lenta: ya estás fuera, se ve la versión corta
    cashed() {
      if (!this.active || this.light) return;
      this.light = true;
      SN.Audio.duck(false);
      SN.FX.cinema(0.5);
      SN.Game.slowTo(0.5, 0.15);
      this.hurry();
    },

    // Acelerar durante el arrastre lo acorta (para quien no quiere esperar)
    hurry() { if (this.active && this.stage === 'crawl') this.crawl = Math.min(this.crawl, this.t + 0.3); },

    update(dt) {
      if (!this.active) return;
      this.t += dt;
      if (this.stage === 'crawl') {
        this.p = U.clamp(this.t / this.crawl, 0, 1) * SNAP_P;
        // Latidos cada vez más rápidos
        if (!this.light && this.t >= this.nextBeat) {
          const k = this.t / this.crawl;
          this.nextBeat = this.t + U.lerp(0.62, 0.3, k);
          SN.Audio.sfx('heart');
          SN.Game.pulse = 0.035;
          SN.FX.vignettePulse = 1;
        }
        if (this.t >= this.crawl) { this.stage = 'snap'; this.t0 = this.t; SN.Game.slowTo(1, 0); }
      } else if (this.stage === 'snap') {
        const k = (this.t - this.t0) / SNAP;
        this.p = SNAP_P + (1 - SNAP_P) * Math.min(1, k);
        if (k >= 1) { this.p = 1; this.stage = 'freeze'; this.t0 = this.t; this.impact(); }
      } else if (this.stage === 'freeze') {
        if (this.t - this.t0 >= FREEZE) { this.stage = 'after'; this.t0 = this.t; SN.Game.slowTo(0.35, 0); SN.Game.slowTo(1, AFTER); }
      } else if (this.stage === 'after') {
        if (this.t - this.t0 >= AFTER) this.end();
      }
    },

    // El golpe: congelado, destello, temblor y palabra. Verde si te favorece, coral si no.
    impact() {
      const p = this.chart.lastCandlePos();
      const big = !this.light;
      const col = this.good ? P.green : P.coral;
      SN.Game.slowTo(0, 0); // congelado (hit-stop)
      SN.Audio.duck(false);
      SN.Audio.sfx(this.up ? 'boom' : 'crash', { big });
      SN.FX.flash(this.good ? P.yellowL : P.coral, big ? 0.28 : 0.16, big ? 0.6 : 0.35);
      SN.Desk.flashGlow(this.good ? P.yellow : P.coral, big ? 1.6 : 0.8);
      SN.FX.shake(big ? 6 : 3, big ? 0.5 : 0.25);
      SN.FX.speedLines(p.x, p.y, this.good ? P.yellow : P.coralL, big ? 0.7 : 0.4);
      SN.FX.ring(p.x, p.y, col, big ? 130 : 70, 0.8);
      SN.FX.burst(p.x, p.y, { n: big ? 40 : 16, colors: [col, this.good ? P.yellow : P.coalL, P.creamL], speed: big ? 150 : 90, up: this.up ? 60 : -20 });
      if (this.up) SN.FX.coins(p.x, p.y, big ? 8 : 3, 1.4);
      else SN.FX.cracks(p.x, p.y, big ? 7 : 4);
      SN.Chart.kick = this.up ? -5 : 5;
      let word = this.up ? '¡BOOM!' : '¡CRASH!';
      if (this.light) word = this.good ? '¡SE TE ESCAPÓ!' : '¡TE LIBRASTE!';
      SN.FX.word(word, p.x - (p.x > 300 ? 30 : 0), p.y - 18, this.good ? 'gain' : 'loss');
      if (big) { if (this.good) SN.Hands.celebrate(true); else SN.Hands.flinch(true); }
      SN.Events.emit('drama:impact', { good: this.good, up: this.up, light: this.light });
    },

    end() {
      this.active = false;
      this.stage = null;
      SN.Game.slowTo(1, 0.2);
      SN.Game.focusOn(0, 0.7);
      SN.FX.cinema(0);
      SN.Audio.duck(false);
      const pos = SN.State.run && SN.State.run.position;
      if (pos && !pos.settled) SN.Hands.drumming = true;
    },

    // Cancela todo de golpe (salir al menú, bancarrota...)
    reset() {
      if (!this.active) return;
      this.active = false;
      this.stage = null;
      SN.Game.slowTo(1, 0);
      SN.Game.focusOn(0, 0.01);
      SN.FX.cinema(0);
      SN.Audio.duck(false);
    },
  };
})(window.SN);
