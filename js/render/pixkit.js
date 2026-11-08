// Kit de pixel art procedural: formas como máscaras (polígonos, elipses, cápsulas), sombreado
// automático según la dirección de la luz (rampas con cambio de tono) y contorno selectivo
// (sel-out: el contorno es una versión oscura del color que bordea, más clara del lado de la luz).
// Así protagonista, gato y objetos comparten el mismo acabado sin dibujar cada píxel a mano.
(function (SN) {
  'use strict';
  const Px = SN.Px;

  const hexRGB = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  // ---------- Máscaras ----------
  class Mask {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
    set(x, y, v = 1) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v; }
    // Polígono relleno (regla par-impar, muestreo en el centro del píxel: bordes nítidos)
    poly(pts, v = 1) {
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
        const sy = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
          if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) this.d[y * this.w + x] = v;
        }
      }
      return this;
    }
    ellipse(cx, cy, rx, ry, v = 1) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(x, y, v);
        }
      }
      return this;
    }
    rect(x, y, w, h, v = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v); return this; }
    // Trazo grueso entre dos puntos (brazos, mangas, tallos)
    capsule(x0, y0, x1, y1, r, v = 1) {
      const minx = Math.floor(Math.min(x0, x1) - r), maxx = Math.ceil(Math.max(x0, x1) + r);
      const miny = Math.floor(Math.min(y0, y1) - r), maxy = Math.ceil(Math.max(y0, y1) + r);
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) {
        for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5, py = y + 0.5;
          const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
          const qx = x0 + dx * t - px, qy = y0 + dy * t - py;
          if (qx * qx + qy * qy <= r * r) this.set(x, y, v);
        }
      }
      return this;
    }
    // Cápsula que cambia de grosor (antebrazo que se estrecha hacia la muñeca)
    taper(x0, y0, r0, x1, y1, r1, v = 1) {
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        this.ellipse(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r0 + (r1 - r0) * k, r0 + (r1 - r0) * k, v);
      }
      return this;
    }
    // Rectángulo que ocupa (con margen) o null si está vacía
    bbox(pad = 0) {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (!this.d[y * this.w + x]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) return null;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
      x1 = Math.min(this.w - 1, x1 + pad); y1 = Math.min(this.h - 1, y1 + pad);
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    clear(other) { for (let i = 0; i < this.d.length; i++) if (other.d[i]) this.d[i] = 0; return this; }
    keep(other) { for (let i = 0; i < this.d.length; i++) if (!other.d[i]) this.d[i] = 0; return this; }
  }

  // ---------- Sprite: lienzo donde se van apilando partes ----------
  class Sprite {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.c = Px.canvas(w, h);
      this.g = Px.ctx(this.c);
    }
    mask() { return new Mask(this.w, this.h); }

    // Pinta una máscara con su rampa [más oscuro ... más claro] y luz direccional.
    // opts.light = [lx, ly] (de dónde viene la luz), hi/lit/sh = grosor de brillo, luz y sombra,
    // outline (true | false), cast (sombra arrojada sobre lo que hay debajo), flat (sin sombreado)
    part(m, ramp, opts = {}) {
      const { light = [1, -1], hi = 1, lit = 3, sh = 2, outline = true, cast = 0, flat = false, dither = true, deep = true } = opts;
      const bb = m.bbox(Math.max(cast, 1) + 1);
      if (!bb) return this;
      const W0 = this.w;
      const tmp = this.g.getImageData(bb.x, bb.y, bb.w, bb.h);
      const out = tmp.data;
      const w = bb.w, h = bb.h, ox = bb.x, oy = bb.y;
      const M = (x, y) => m.get(x + ox, y + oy);
      const cols = ramp.map(hexRGB);
      const n = cols.length;
      const base = Math.min(n - 1, Math.max(0, opts.base != null ? opts.base : Math.floor((n - 1) / 2)));
      const lx = Math.sign(light[0]), ly = Math.sign(light[1]);
      const maxD = Math.max(hi, lit, sh) + 2; // si el tope coincide con el grosor, todo el interior se tramaría
      const dist = (x, y, sx, sy, max) => { let d = 0; while (d < max && M(x + sx * (d + 1), y + sy * (d + 1))) d++; return d; };
      // Sombra arrojada: oscurece lo que hay debajo y a la sombra de la pieza
      if (cast) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (M(x, y)) continue;
          let hit = false;
          for (let k = 1; k <= cast && !hit; k++) if (M(x + lx * k, y + ly * k)) hit = true;
          if (!hit) continue;
          const i = (y * w + x) * 4;
          if (out[i + 3] === 0) continue;
          out[i] = out[i] * 0.62; out[i + 1] = out[i + 1] * 0.55; out[i + 2] = Math.min(255, out[i + 2] * 0.72 + 10);
        }
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!M(x, y)) continue;
          let k = base;
          if (!flat) {
            const dL = dist(x, y, lx, ly, maxD), dS = dist(x, y, -lx, -ly, maxD), dB = dist(x, y, 0, 1, 4);
            if (dL < hi) k = n - 1;
            else if (dL < lit || (dither && dL === lit && (x + y) % 2 === 0)) k = Math.min(n - 1, base + 1);
            if (dS < sh || (dither && dS === sh && (x + y) % 2 === 0)) k = Math.max(0, base - 1);
            if (deep && dS < 1 && dB < 2) k = 0;
          }
          const c = cols[k], i = (y * w + x) * 4;
          out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
        }
      }
      // Contorno selectivo alrededor de esta pieza
      if (outline) {
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (M(x, y)) continue;
          const nb = M(x - 1, y) ? [x - 1, y] : M(x + 1, y) ? [x + 1, y] : M(x, y - 1) ? [x, y - 1] : M(x, y + 1) ? [x, y + 1] : null;
          if (!nb) continue;
          // Del lado de la luz el contorno es más claro
          const litSide = (lx && Math.sign(x - nb[0]) === lx) || (ly && Math.sign(y - nb[1]) === ly);
          const c = cols[litSide ? Math.min(1, n - 1) : 0];
          const f = litSide ? 0.78 : 0.55;
          add.push([x, y, c[0] * f, c[1] * f * 0.92, Math.min(255, c[2] * f + 14)]);
        }
        if (opts.outline !== 'inner') for (const [x, y, r, g, b] of add) {
          const i = (y * w + x) * 4;
          out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
        }
      }
      this.g.putImageData(tmp, ox, oy);
      void W0;
      return this;
    }

    // Luz de borde (contraluz): pinta los píxeles de la máscara cuyo vecino hacia dir está vacío
    rim(m, color, dir = [-1, -1], width = 1) {
      const bb = m.bbox(1);
      if (!bb) return this;
      this.g.fillStyle = color;
      for (let y = bb.y; y < bb.y + bb.h; y++) for (let x = bb.x; x < bb.x + bb.w; x++) {
        if (!m.get(x, y)) continue;
        let edge = false;
        for (let k = 1; k <= width && !edge; k++) if (!m.get(x + dir[0] * k, y + dir[1] * k)) edge = true;
        if (edge) this.g.fillRect(x, y, 1, 1);
      }
      return this;
    }

    // Detalle a mano: filas de texto, una letra = un color de pal ('.' transparente)
    stamp(rows, x, y, pal, flip) {
      const g = this.g;
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[flip ? row.length - 1 - i : i];
          if (ch === '.' || ch === ' ' || !pal[ch]) continue;
          g.fillStyle = pal[ch];
          g.fillRect(x + i, y + j, 1, 1);
        }
      });
      return this;
    }
    px(x, y, c) { this.g.fillStyle = c; this.g.fillRect(x, y, 1, 1); return this; }
    rect(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(x, y, w, h); return this; }
    line(x0, y0, x1, y1, c, w = 1) { Px.line(this.g, x0, y0, x1, y1, c, w); return this; }
  }

  // Mezcla dos colores hex (k = 0 -> a, 1 -> b)
  function mix(a, b, k) {
    const A = hexRGB(a), B = hexRGB(b);
    const h = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(A[0] + (B[0] - A[0]) * k) + h(A[1] + (B[1] - A[1]) * k) + h(A[2] + (B[2] - A[2]) * k);
  }

  // Trama de Bayer 4x4 (para luces y degradados sin desenfoque)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  SN.PK = { Mask, Sprite, hexRGB, mix, bayer };
})(window.SN);
