// Gráfica de velas japonesas conectada al simulador: dibuja el historial real del mercado, la PISTA
// (un cono hacia el futuro calculado con el estado real del mercado), la operación abierta y sus efectos.
// Durante una operación revela las velas una a una, sin inventar nada: son las velas simuladas.
// La vela con giro inesperado la conduce SN.Drama (cámara lenta: amago, latigazo y golpe).
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, U = SN.Util;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);

  const PITCH = 5;            // px por vela sin zoom
  const TOP = 5, BOTTOM = 5;  // márgenes del área de trazado
  const AXIS = 31;            // ancho de la escala de precios
  const CONE = 9;             // huecos reservados a la PISTA (el futuro) a la derecha
  const SNAP = 0.72;          // punto de la vela de giro en el que llega el latigazo

  const Chart = SN.Chart = {
    canvas: null, g: null, W: 0, H: 0,
    market: null,
    anim: null,
    view: { min: 0, max: 1, ready: false },
    t: 0,
    zoom: 0,       // 0..1 acercamiento de la cámara lenta
    kick: 0,       // sacudida vertical tras una vela fuerte
    flash: null,   // destello de la vela recién cerrada
    livePrice: 0,
    lastX: 0, lastY: 0, pitch: PITCH,
    onPop: null,   // (candle) efectos al completar una vela

    init(canvas) {
      this.canvas = canvas;
      this.g = Px.ctx(canvas);
      this.W = canvas.width;
      this.H = canvas.height;
    },

    setMarket(id) {
      if (this.market !== id) this.view.ready = false;
      this.market = id;
    },

    // Revela las últimas n velas del historial una a una.
    // opts: { speed, onCandle(i, candle), onDone, climax (índice 0..n-1, -1 = ninguno), holdAt, endHold }
    play(n, opts = {}) {
      this.anim = Object.assign({ speed: 0.38, climax: -1, holdAt: -1, endHold: 0.15, onCandle: null, onDone: null }, opts,
        { total: n, revealed: 0, p: 0, fast: 1, held: false, ending: 0, climaxDone: false });
    },
    fast(k = 4) {
      const a = this.anim;
      if (!a || a.held) return;
      a.fast = Math.max(a.fast, k);
      SN.Drama.hurry();
    },
    release() { if (this.anim) this.anim.held = false; },
    hidden() { return this.anim ? this.anim.total - this.anim.revealed : 0; },
    tradeCandle(k) { const h = SN.Market.state(this.market).history; return h[h.length - this.anim.total + k]; },

    // Posición (en px de la pantalla del monitor) de la última vela visible
    lastCandlePos() {
      const pos = SN.UI.posIn(document.getElementById('chart-wrap'));
      return { x: pos.x + this.lastX + Math.floor(this.pitch / 2), y: pos.y + this.lastY };
    },

    // Duración de cada vela: las de la zona de peligro van más despacio (anticipación)
    candleDur(i) {
      const a = this.anim;
      const danger = i >= a.total - SN.Data.sim.dangerCandles;
      return a.speed * (danger ? 1.35 : 1);
    },

    update(dt, realDt = dt) {
      this.t += dt;
      this.kick *= Math.pow(0.002, realDt);
      if (Math.abs(this.kick) < 0.3) this.kick = 0;
      if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
      // El zoom de la cámara lenta entra y sale en tiempo real (no se ralentiza a sí mismo)
      const zt = SN.Drama.active ? 1 : 0;
      this.zoom += (zt - this.zoom) * Math.min(1, realDt * (zt ? 2.4 : 3.2));
      if (this.zoom < 0.01) this.zoom = 0;

      const a = this.anim;
      if (!a) return;
      if (a.revealed >= a.total) {
        a.ending -= dt;
        if (a.ending <= 0) { const done = a.onDone; this.anim = null; if (done) done(); }
        return;
      }
      if (a.held) return;
      const i = a.revealed;
      if (i === a.climax && !a.climaxDone) {
        if (!SN.Drama.active) SN.Drama.begin(this, a);
        a.p = SN.Drama.p;
        if (a.p < 1) return;
        a.climaxDone = true;
      } else {
        a.p += dt * a.fast / this.candleDur(i);
      }
      while (a.p >= 1 && a.revealed < a.total) {
        a.p -= 1;
        a.revealed++;
        const candle = this.tradeCandle(a.revealed - 1);
        this.flash = { t: 0.14 };
        if (a.onCandle) a.onCandle(a.revealed, candle);
        if (this.onPop) this.onPop(candle);
        if (!this.anim) return;
        if (a.revealed >= a.total) { a.p = 0; a.ending = a.climax === a.total - 1 ? Math.max(a.endHold, 0.9) : a.endHold; break; }
        if (a.revealed === a.holdAt) { a.p = 0; a.held = true; SN.Events.emit('chart:held'); break; }
        if (a.revealed === a.climax) { a.p = 0; break; }
      }
    },

    render() {
      if (!this.g || !this.market || !SN.State.run) return;
      const g = this.g, W = this.W, H = this.H;
      const run = SN.State.run;
      const m = SN.Market.state(this.market);
      const a = this.anim;
      const pos = run.position && run.position.market === this.market ? run.position : null;
      const z = this.zoom;
      const pitch = Math.round(PITCH + z * 6), bw = pitch - 2;
      this.pitch = pitch;
      const plotW = W - AXIS - 2, plotH = H - TOP - BOTTOM;
      const slots = Math.floor((plotW - 2) / pitch);
      const hint = !a && !pos && m.unlocked ? SN.Market.hint(this.market) : null;
      const margin = hint ? CONE : z > 0.05 ? 3 : 2;
      const hidden = this.hidden();
      const hist = m.history;
      const visibleEnd = hist.length - hidden;
      const forming = a && a.revealed < a.total ? hist[visibleEnd] : null;
      const count = Math.max(1, Math.min(visibleEnd + (forming ? 1 : 0), slots - margin));
      const start = visibleEnd + (forming ? 1 : 0) - count;
      const items = [];
      for (let i = 0; i < count; i++) {
        const idx = start + i;
        let c = hist[idx];
        if (forming && idx === visibleEnd) c = a.revealed === a.climax ? climaxPartial(c, a.p) : partial(c, U.ease.outCubic(Math.min(1, a.p)));
        items.push({ c, idx, slot: i });
      }
      const last = items[items.length - 1];
      const lastClose = last.c.c;
      this.livePrice = lastClose;

      // ---------- Escala de precios ----------
      let lo = Infinity, hi = -Infinity;
      const from = z > 0.05 ? Math.max(0, items.length - 9) : 0;
      for (let i = from; i < items.length; i++) { lo = Math.min(lo, items[i].c.l); hi = Math.max(hi, items[i].c.h); }
      if (a && a.climax >= 0 && z > 0.05) {
        // Durante la cámara lenta el encuadre es simétrico respecto al precio: no delata hacia dónde irá
        const cc = this.tradeCandle(a.climax);
        const span = Math.max(cc.h - cc.l, Math.abs(cc.c - cc.o)) * 1.15;
        lo = Math.min(lo, lastClose - span); hi = Math.max(hi, lastClose + span);
      }
      if (pos && !(z > 0.05)) {
        lo = Math.min(lo, pos.entry); hi = Math.max(hi, pos.entry);
        const liq = pos.entry * (1 - pos.direction / pos.leverage);
        if (pos.leverage > 1 && !pos.settled && Math.abs(liq - pos.entry) / pos.entry < 0.25) { lo = Math.min(lo, liq); hi = Math.max(hi, liq); }
      }
      if (hint) {
        const spread = hint.sd * 0.8;
        lo = Math.min(lo, lastClose * Math.exp(Math.min(0, hint.move) - spread));
        hi = Math.max(hi, lastClose * Math.exp(Math.max(0, hint.move) + spread));
      }
      const pad = (hi - lo) * 0.08 || hi * 0.01;
      const tMin = lo - pad, tMax = hi + pad;
      const v = this.view;
      if (!v.ready) { v.min = tMin; v.max = tMax; v.ready = true; }
      const ease = z > 0.05 ? 0.12 : 0.2;
      v.min += (tMin - v.min) * ease;
      v.max += (tMax - v.max) * ease;
      const ky = Math.round(this.kick);
      const yOf = (p) => Math.round(TOP + (v.max - p) / (v.max - v.min) * plotH) + ky;
      const xOf = (slot) => 2 + slot * pitch;

      // ---------- Fondo ----------
      const pnlNow = pos && !pos.settled ? (lastClose - pos.entry) * pos.direction : 0;
      R(g, 0, 0, W, H, P.navy);
      if (pos && !pos.settled && a) R(g, 0, 0, plotW + 1, H, pnlNow >= 0 ? 'rgba(61,220,132,0.08)' : 'rgba(255,79,109,0.09)');
      if (a && a.revealed >= a.total - SN.Data.sim.dangerCandles && pos && !pos.settled && Math.floor(this.t * 4) % 2 === 0) {
        for (let y = 0; y < H; y += 4) R(g, plotW - 2, y, 2, 2, P.orange);
      }

      // Cuadrícula y escala
      const step = niceStep((v.max - v.min) / 3.2);
      for (let p = Math.ceil(v.min / step) * step; p <= v.max; p += step) {
        const y = yOf(p);
        if (y < TOP - 2 || y > H - BOTTOM) continue;
        for (let x = 1; x < plotW; x += 3) R(g, x, y, 1, 1, P.navyL);
        Px.text(g, fmtPrice(p), W - AXIS + 2, y + 4, P.creamDD);
      }
      R(g, plotW + 1, 0, 1, H, P.navyLL);

      // ---------- Operación: sombreado entre la entrada y el precio ----------
      const firstIdx = pos ? hist.length - pos.candles : -1;
      const entrySlot = pos ? items.findIndex((it) => it.idx === firstIdx) : -1;
      if (pos && !pos.settled) {
        const ys = yOf(pos.entry), yc = yOf(lastClose);
        const x0 = entrySlot >= 0 ? xOf(entrySlot) - 1 : 1;
        R(g, x0, Math.min(ys, yc), plotW - x0, Math.abs(yc - ys) + 1, pnlNow >= 0 ? 'rgba(61,220,132,0.2)' : 'rgba(255,79,109,0.2)');
      }

      // Media móvil (tendencia)
      const sma = SN.Market.sma(hist, 8);
      let prev = null;
      for (const it of items) {
        const s = forming && it.idx === visibleEnd ? null : sma[it.idx];
        if (s == null) { prev = null; continue; }
        const pt = { x: xOf(it.slot) + Math.floor(bw / 2), y: yOf(s) };
        if (prev) Px.line(g, prev.x, prev.y, pt.x, pt.y, 'rgba(168,128,255,0.6)');
        prev = pt;
      }

      // ---------- Velas ----------
      const exitIdx = pos && pos.cashed ? firstIdx + pos.cashedAt : Infinity;
      for (const it of items) {
        const c = it.c, x = xOf(it.slot);
        const ghost = it.idx > exitIdx; // lo que pasó cuando ya no estabas dentro
        if (ghost) g.globalAlpha = 0.38;
        drawCandle(g, c, x, bw, yOf, this.flash && it === last);
        if (c.m) {
          const yh = yOf(c.h), yl = yOf(c.l), cx = x + Math.floor(bw / 2);
          if (c.m === 'pos') { R(g, cx, yh - 5, 1, 1, P.greenD); R(g, cx - 1, yh - 4, 3, 1, P.greenD); R(g, cx - 2, yh - 3, 5, 1, P.greenD); }
          else { R(g, cx - 2, yl + 3, 5, 1, P.coralD); R(g, cx - 1, yl + 4, 3, 1, P.coralD); R(g, cx, yl + 5, 1, 1, P.coralD); }
        }
        g.globalAlpha = 1;
      }
      this.lastX = xOf(last.slot);
      this.lastY = yOf(lastClose);

      // ---------- Entrada, liquidación y cobro ----------
      if (pos) {
        const ys = yOf(pos.entry);
        for (let x = 1; x < plotW; x += 4) R(g, x, ys, 2, 1, P.yellowDD);
        if (entrySlot >= 0) {
          const ex = xOf(entrySlot) + Math.floor(bw / 2), col = pos.direction > 0 ? P.greenD : P.coralD;
          if (pos.direction > 0) { R(g, ex - 2, ys + 3, 5, 1, col); R(g, ex - 1, ys + 2, 3, 1, col); R(g, ex, ys + 1, 1, 1, col); }
          else { R(g, ex - 2, ys - 3, 5, 1, col); R(g, ex - 1, ys - 2, 3, 1, col); R(g, ex, ys - 1, 1, 1, col); }
        }
        if (pos.leverage > 1 && !pos.settled) {
          const yl = yOf(pos.entry * (1 - pos.direction / pos.leverage));
          if (yl > TOP && yl < H - BOTTOM) {
            for (let x = 1; x < plotW; x += 4) R(g, x, yl, 2, 1, P.coral);
            g.drawImage(SN.Sprites.get('skull'), 2, yl - 3);
          }
        }
        if (pos.cashed) {
          const slot = items.findIndex((it) => it.idx === exitIdx);
          if (slot >= 0) {
            const x = xOf(slot) + Math.floor(bw / 2), y = yOf(pos.exit);
            for (let yy = TOP; yy < H - BOTTOM; yy += 3) R(g, x, yy, 1, 2, P.navyLL);
            g.drawImage(SN.Sprites.get('coin0'), x - 4, y - 4);
          }
        }
      }

      // ---------- PISTA ----------
      if (hint) drawCone(g, this.lastX + bw, this.lastY, lastClose, hint, yOf, pitch, this.t, H);

      // Etiqueta del precio actual en la escala
      const ly = U.clamp(this.lastY, TOP, H - BOTTOM - 1);
      for (let x = this.lastX + bw + 1; x < plotW; x += 2) if (!hint) R(g, x, ly, 1, 1, P.yellowD);
      R(g, W - AXIS, ly - 5, AXIS, 10, P.yellow);
      R(g, W - AXIS, ly - 5, 1, 10, P.navyDD);
      Px.text(g, fmtPrice(lastClose), W - AXIS + 2, ly + 4, P.navyD);
    },
  };

  function drawCandle(g, c, x, bw, yOf, flash) {
    const up = c.c >= c.o;
    const fill = up ? P.green : P.coral, dark = up ? P.greenD : P.coralD, light = up ? P.greenL : P.coralL;
    const yh = yOf(c.h), yl = yOf(c.l), mid = x + Math.floor(bw / 2);
    R(g, mid, yh, 1, Math.max(1, yl - yh + 1), dark);
    const yt = yOf(Math.max(c.o, c.c)), yb = yOf(Math.min(c.o, c.c));
    const bh = Math.max(1, yb - yt + 1);
    R(g, x, yt, bw, bh, flash ? P.creamL : fill);
    R(g, x + bw - 1, yt, 1, bh, dark);
    if (bh > 2 && !flash) R(g, x, yt, bw - 1, 1, light);
    if (c.tw && bh > 3) { R(g, x - 1, yt, 1, bh, P.yellow); R(g, x + bw, yt, 1, bh, P.yellow); }
  }

  // Cono de la PISTA: desde la última vela hacia la derecha. Ancho = incertidumbre, inclinación = dirección.
  function drawCone(g, x0, y0, last, hint, yOf, pitch, t, H) {
    const len = (CONE - 1) * pitch - 2;
    const col = hint.dir > 0 ? P.green : hint.dir < 0 ? P.coral : P.orange;
    const dark = hint.dir > 0 ? P.greenD : hint.dir < 0 ? P.coralD : P.orangeD;
    // Separador AHORA | FUTURO
    for (let y = 2; y < H - 2; y += 3) R(g, x0 + 1, y, 1, 1, P.navyLL);
    let tipY = y0;
    for (let dx = 2; dx <= len; dx++) {
      const f = dx / len;
      const mid = last * Math.exp(hint.move * f);
      const spread = hint.sd * Math.sqrt(f) * 0.8;
      const yU = yOf(mid * Math.exp(spread)), yL = yOf(mid * Math.exp(-spread)), yM = yOf(mid);
      g.globalAlpha = 0.42;
      for (let y = yU + 1; y < yL; y++) if ((dx + y) % 2 === 0) R(g, x0 + dx, y, 1, 1, col);
      g.globalAlpha = 1;
      R(g, x0 + dx, yU, 1, 1, col); R(g, x0 + dx, yL, 1, 1, col);
      // La línea central avanza hacia el futuro
      if ((((dx - Math.floor(t * 14)) % 6) + 6) % 6 < 3) R(g, x0 + dx, yM, 1, 1, dark);
      tipY = yM;
    }
    const tx = x0 + len + 1;
    const bob = Math.round(Math.sin(t * 5) * 1.5);
    if (hint.dir === 0) {
      R(g, tx - 3, tipY - 13 + bob, 9, 11, P.orange);
      Px.text(g, '?', tx - 1, tipY - 4 + bob, P.creamL);
      return;
    }
    // Flechas: una por cada nivel de fuerza
    for (let i = 0; i < hint.power; i++) {
      const cy = hint.dir > 0 ? tipY - 6 - i * 5 + bob : tipY + 6 + i * 5 - bob;
      chevron(g, tx, cy, hint.dir, i === hint.power - 1 ? (hint.dir > 0 ? P.greenL : P.coralL) : col);
    }
  }

  function chevron(g, x, y, dir, c) {
    for (let r = 0; r < 4; r++) {
      const w = 1 + r * 2, yy = dir > 0 ? y + r : y - r;
      R(g, x - r, yy, w, 1, c);
    }
  }

  // Vela a medio formar: el cierre avanza desde la apertura, las mechas crecen con él
  function partial(c, p) {
    const close = c.o + (c.c - c.o) * p;
    return {
      o: c.o, c: close,
      h: Math.max(c.o, close) + (c.h - Math.max(c.o, c.c)) * p,
      l: Math.min(c.o, close) - (Math.min(c.o, c.c) - c.l) * p,
      m: p > 0.6 ? c.m : undefined,
    };
  }

  // Vela de giro: primero se arrastra (a veces amagando hacia el lado contrario) y en SNAP pega el latigazo
  function climaxPartial(c, p) {
    const up = c.c >= c.o;
    const fake = up ? c.l : c.h, far = up ? c.h : c.l;
    const feint = Math.abs(fake - c.o) > Math.abs(c.c - c.o) * 0.2;
    const target = feint ? c.o + (fake - c.o) * 0.85 : c.o + (c.c - c.o) * 0.22;
    let price, a, b;
    if (p < SNAP) {
      price = c.o + (target - c.o) * U.ease.inOutSine(p / SNAP);
      a = price; b = price;
    } else {
      const q = U.ease.outCubic(Math.min(1, (p - SNAP) / (1 - SNAP)));
      price = target + (c.c - target) * q;
      a = feint ? target + (fake - target) * q : price;
      b = c.c + (far - c.c) * q;
    }
    return { o: c.o, c: price, h: Math.max(c.o, price, a, b), l: Math.min(c.o, price, a, b), m: p >= 1 ? c.m : undefined, tw: p >= SNAP ? 1 : 0 };
  }

  function niceStep(raw) {
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / exp;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * exp;
  }

  function fmtPrice(p) {
    if (p >= 1000) return String(Math.round(p));
    if (p >= 100) return p.toFixed(1);
    return p.toFixed(2);
  }
})(window.SN);
