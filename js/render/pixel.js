// Utilidades de dibujo pixel art: rectángulos, líneas sin suavizado, elipses por filas,
// texto con la fuente pixel y sprites definidos como texto.
(function (SN) {
  'use strict';
  const P = SN.PAL;

  // Letras de los sprites en texto -> color
  const KEY = {
    k: P.coal, K: P.coalD, l: P.coalL, m: P.cream, w: P.creamL, n: P.creamM, d: P.creamD, D: P.creamDD,
    g: P.green, G: P.greenD, h: P.greenL, y: P.yellow, Y: P.yellowD, u: P.yellowL, U: P.yellowDD,
    r: P.coral, R: P.coralD, p: P.coralL, c: P.cyan, C: P.cyanD, b: P.cyanL,
    o: P.orange, O: P.orangeD, q: P.orangeL, s: P.skin, S: P.skinM, z: P.skinD, Z: P.skinDD,
    x: '#FFFFFF',
  };

  const Px = SN.Px = {
    KEY,
    canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    },
    ctx(canvas) {
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      return g;
    },
    rect(g, x, y, w, h, color) {
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    // Caja con contorno de 1px y esquinas recortadas
    box(g, x, y, w, h, fill, outline) {
      x = Math.round(x); y = Math.round(y);
      if (outline) {
        g.fillStyle = outline;
        g.fillRect(x + 1, y, w - 2, h);
        g.fillRect(x, y + 1, w, h - 2);
      }
      g.fillStyle = fill;
      g.fillRect(x + 1, y + 1, w - 2, h - 2);
    },
    // Línea de píxeles (Bresenham), sin antialiasing
    line(g, x0, y0, x1, y1, color, w = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      g.fillStyle = color;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let i = 0; i < 2000; i++) {
        g.fillRect(x0, y0, w, w);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    // Elipse rellena trazada por filas (bordes nítidos)
    ellipse(g, cx, cy, rx, ry, color) {
      g.fillStyle = color;
      for (let y = -ry; y <= ry; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
      }
    },
    circleOutline(g, cx, cy, r, color, step = 1) {
      g.fillStyle = color;
      const seen = new Set();
      for (let a = 0; a < 360; a += Math.max(1, 90 / Math.max(r, 1))) {
        const x = Math.round(cx + Math.cos(a * Math.PI / 180) * r), y = Math.round(cy + Math.sin(a * Math.PI / 180) * r);
        const k = x + ',' + y;
        if (seen.has(k)) continue;
        seen.add(k);
        if (step > 1 && seen.size % step) continue;
        g.fillRect(x, y, 1, 1);
      }
    },
    // Trama de puntos (sombreado de 2 tonos sin transparencias)
    dither(g, x, y, w, h, color, phase = 0) {
      g.fillStyle = color;
      for (let j = 0; j < h; j++) for (let i = (j + phase) % 2; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
    },
    text(g, str, x, y, color, opts = {}) {
      const size = opts.size || 8;
      g.font = `${size}px SaldoPixel`;
      g.textBaseline = 'alphabetic';
      g.textAlign = opts.align || 'left';
      str = String(str).toUpperCase();
      if (opts.outline) {
        g.fillStyle = opts.outline;
        const o = size / 8;
        for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [0, o * 2]]) g.fillText(str, Math.round(x + dx), Math.round(y + dy));
      }
      g.fillStyle = color;
      g.fillText(str, Math.round(x), Math.round(y));
      g.textAlign = 'left';
    },
    textWidth(g, str, size = 8) {
      g.font = `${size}px SaldoPixel`;
      return g.measureText(String(str).toUpperCase()).width;
    },
    // Sprite desde filas de texto. pal opcional para remapear letras.
    fromRows(rows, pal) {
      const h = rows.length, w = Math.max(...rows.map((r) => r.length));
      const c = Px.canvas(w, h), g = Px.ctx(c);
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          g.fillStyle = (pal && pal[ch]) || KEY[ch] || ch;
          g.fillRect(x, y, 1, 1);
        }
      });
      return c;
    },
    // Copia escalada (para usar sprites como fondo CSS o cursor)
    scaled(src, s) {
      const c = Px.canvas(src.width * s, src.height * s), g = Px.ctx(c);
      g.drawImage(src, 0, 0, c.width, c.height);
      return c;
    },
  };
})(window.SN);
