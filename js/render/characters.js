// Personajes y objetos grandes en pixel art, dibujados por código (fáciles de sustituir por sprites):
// el encapuchado, la cara del protagonista con expresiones, el cerdito de arcilla y la consola.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const VOID = '#121310';

  const Chars = SN.Chars = {};

  // ---------- El encapuchado (busto de 40x44) ----------
  Chars.hooded = function (g, x, y, t, opts = {}) {
    const cx = x + 20;
    // Capa / hombros
    for (let j = 0; j < 16; j++) {
      const w = 12 + Math.round(j * 0.55) + (j > 4 ? 3 : 0);
      R(g, cx - w, y + 28 + j, w * 2, 1, P.coalD);
      R(g, cx - w, y + 28 + j, 1, 1, P.coalDD);
      R(g, cx + w - 1, y + 28 + j, 1, 1, P.coalDD);
    }
    R(g, cx - 20, y + 43, 40, 1, P.coalDD);
    // Luz del monitor en el borde de la capa
    for (let j = 6; j < 16; j++) R(g, cx - 12 - Math.round(j * 0.55) - 3, y + 28 + j, 1, 1, P.coalL);
    // Pliegues
    R(g, cx - 6, y + 32, 1, 12, P.coalDD); R(g, cx + 6, y + 33, 1, 11, P.coalDD);
    // Medallón: una moneda con un ojo
    Px.ellipse(g, cx, y + 37, 3, 3, P.yellowD);
    Px.ellipse(g, cx, y + 37, 2, 2, P.yellow);
    R(g, cx - 1, y + 37, 3, 1, P.coal);
    R(g, cx, y + 37, 1, 1, opts.angry ? P.coral : P.yellowL);
    // Capucha
    Px.ellipse(g, cx, y + 16, 15, 15, P.coalDD);
    Px.ellipse(g, cx, y + 16, 14, 14, P.coalD);
    R(g, cx - 1, y, 3, 3, P.coalD); R(g, cx, y - 1, 1, 2, P.coalDD);
    for (let j = -10; j < 6; j++) R(g, cx - 14 + Math.round(Math.abs(j) * 0.2), y + 16 + j, 1, 1, P.coalM); // brillo lateral
    R(g, cx - 13, y + 22, 26, 8, P.coalD);
    // Hueco de la cara: solo oscuridad
    Px.ellipse(g, cx, y + 19, 9, 10, P.coalDD);
    Px.ellipse(g, cx, y + 20, 8, 9, VOID);
    // Ojos que brillan (parpadean)
    const blink = opts.noBlink ? false : (t % 4.2) > 4.05;
    if (!blink) {
      const ec = opts.angry ? P.coral : P.yellow, eg = opts.angry ? P.coralD : P.yellowDD;
      const ey = y + 19 + (opts.look || 0);
      R(g, cx - 6, ey - 1, 5, 4, eg); R(g, cx + 2, ey - 1, 5, 4, eg);
      R(g, cx - 5, ey, 3, 2, ec); R(g, cx + 3, ey, 3, 2, ec);
      R(g, cx - 5, ey, 1, 1, P.creamL); R(g, cx + 3, ey, 1, 1, P.creamL);
    } else {
      R(g, cx - 5, y + 20, 3, 1, P.yellowDD); R(g, cx + 3, y + 20, 3, 1, P.yellowDD);
    }
    if (opts.smile) {
      R(g, cx - 3, y + 25, 7, 1, P.creamD);
      R(g, cx - 4, y + 24, 1, 1, P.creamD); R(g, cx + 4, y + 24, 1, 1, P.creamD);
    }
  };

  // Contraluz cálido detrás del encapuchado (por bandas, sin degradados borrosos)
  Chars.hoodBacklight = function (g, cx, cy, t, alpha = 1) {
    const pulse = 1 + Math.sin(t * 2) * 0.04;
    const rings = [[74, 0.07, P.orange], [58, 0.1, P.orange], [44, 0.14, P.yellowD], [32, 0.16, P.yellow]];
    for (const [r, a, c] of rings) {
      g.globalAlpha = a * alpha;
      Px.ellipse(g, cx, cy, Math.round(r * pulse), Math.round(r * 0.8 * pulse), c);
    }
    g.globalAlpha = alpha;
  };

  // Canvas del busto (se repinta cada vez: barato y permite parpadeos)
  let hoodCanvas = null;
  Chars.hoodedCanvas = function (t, opts) {
    if (!hoodCanvas) hoodCanvas = Px.canvas(40, 46);
    const g = Px.ctx(hoodCanvas);
    g.clearRect(0, 0, 40, 46);
    Chars.hooded(g, 0, 1, t, opts);
    return hoodCanvas;
  };

  // ---------- Bravo Fines (retrato de 40x40 para los diálogos) ----------
  // Gurú del trading: tupé, gafas de sol con brillo, sonrisa de anuncio, camisa abierta y cadena de oro.
  // Detrás, el "estudio": un fondo morado con una gráfica que siempre sube (y el morro de un Lambo).
  let bravoCanvas = null;
  Chars.bravoCanvas = function (t, opts = {}) {
    if (!bravoCanvas) bravoCanvas = Px.canvas(40, 40);
    const g = Px.ctx(bravoCanvas);
    g.clearRect(0, 0, 40, 40);
    R(g, 0, 0, 40, 40, P.violetD);
    R(g, 0, 28, 40, 12, P.violet);
    // La gráfica del fondo, siempre para arriba
    for (let i = 0; i < 7; i++) R(g, 2 + i * 5, 22 - i * 2 - (i % 2), 3, 3 + i % 2, P.green);
    Px.line(g, 2, 25, 36, 9, P.greenL);
    // El morro amarillo de un deportivo, abajo a la derecha
    R(g, 31, 33, 9, 4, P.yellow); R(g, 32, 32, 6, 1, P.yellowL); R(g, 34, 37, 3, 2, P.coal);
    const bob = Math.round(Math.sin(t * 2.4));
    const y = 2 + bob;
    // Camisa blanca abierta y cadena de oro
    R(g, 8, y + 27, 24, 12, P.creamL); R(g, 8, y + 27, 2, 12, P.creamD); R(g, 30, y + 27, 2, 12, P.creamD);
    R(g, 16, y + 27, 8, 7, P.skin); R(g, 17, y + 34, 6, 3, P.skinM);
    for (let i = 0; i < 6; i++) R(g, 16 + i + (i > 2 ? 1 : 0), y + 30 + Math.min(i, 5 - i), 1, 1, P.yellow);
    R(g, 19, y + 33, 2, 2, P.yellowL);
    // Cuello y cara bronceada
    R(g, 17, y + 23, 6, 5, P.skinM);
    R(g, 12, y + 9, 16, 15, P.coal);
    R(g, 13, y + 9, 14, 14, P.skin); R(g, 13, y + 19, 14, 4, P.skinM); R(g, 26, y + 11, 1, 10, P.skinM);
    // Tupé (enorme, con brillo)
    R(g, 11, y + 3, 18, 7, P.coal); R(g, 12, y + 2, 15, 3, P.coal); R(g, 14, y + 1, 10, 2, P.coal);
    R(g, 12, y + 3, 16, 6, P.orangeDD); R(g, 13, y + 2, 12, 2, P.orangeDD); R(g, 15, y + 2, 8, 1, P.orangeD);
    R(g, 16, y + 3, 6, 1, P.orangeD); R(g, 12, y + 9, 2, 4, P.orangeDD); R(g, 26, y + 9, 2, 4, P.orangeDD);
    // Gafas de sol con un brillo que cruza de vez en cuando
    R(g, 12, y + 13, 16, 4, P.coal); R(g, 13, y + 13, 6, 4, P.coalDD); R(g, 21, y + 13, 6, 4, P.coalDD);
    const sh = Math.floor((t * 1.3) % 4 * 6);
    if (sh < 12) { R(g, 13 + sh, y + 13, 1, 1, P.white); if (sh + 8 < 14) R(g, 21 + sh, y + 13, 1, 1, P.white); }
    // Sonrisa de anuncio (con un destello en un diente)
    R(g, 15, y + 19, 10, 3, P.coal); R(g, 16, y + 19, 8, 2, P.white); R(g, 16, y + 21, 8, 1, P.coralD);
    if (Math.sin(t * 3.1) > 0.85) { R(g, 22, y + 17, 1, 3, P.yellowL); R(g, 21, y + 18, 3, 1, P.yellowL); }
    if (opts.wink) R(g, 21, y + 15, 6, 1, P.skin);
    return bravoCanvas;
  };

  // ---------- Protagonista: cabeza y hombros (coordenadas de un búfer de 160x90) ----------
  // expr: neutral | happy | star | confused | worried | shocked | relieved
  Chars.face = function (g, cx, top, expr, t, opts = {}) {
    const hx = cx - 16;
    // Hombros y sudadera
    for (let j = 0; j < 26; j++) {
      const w = 20 + Math.round(j * 1.3);
      R(g, cx - w, top + 46 + j, w * 2, 1, j < 2 ? P.orangeDD : P.orange);
      R(g, cx - w, top + 46 + j, 3, 1, P.orangeD);
      R(g, cx + w - 4, top + 46 + j, 4, 1, P.orangeD);
    }
    R(g, cx - 12, top + 44, 24, 6, P.orangeD); // capucha detrás del cuello
    R(g, cx - 6, top + 50, 1, 12, P.creamL); R(g, cx + 5, top + 50, 1, 10, P.creamL); // cordones
    R(g, cx - 7, top + 61, 3, 2, P.creamD); R(g, cx + 4, top + 59, 3, 2, P.creamD);
    // Cuello
    R(g, cx - 6, top + 38, 12, 10, P.skinM);
    R(g, cx - 6, top + 38, 12, 2, P.skinD);
    // Orejas
    R(g, hx - 3, top + 20, 4, 9, P.skinDD); R(g, hx - 2, top + 21, 3, 7, P.skinM);
    R(g, hx + 31, top + 20, 4, 9, P.skinDD); R(g, hx + 31, top + 21, 3, 7, P.skinM);
    // Cabeza (por filas: frente ancha, mandíbula estrecha)
    for (let j = 0; j < 40; j++) {
      let inset = 0;
      if (j < 3) inset = 3 - j;
      if (j > 30) inset = Math.round((j - 30) * 0.9);
      R(g, hx + inset, top + j, 32 - inset * 2, 1, P.skinDD);
      R(g, hx + inset + 1, top + j, 30 - inset * 2, 1, P.skin);
      R(g, hx + 32 - inset - 7, top + j, 6 - Math.max(0, inset - 2), 1, P.skinM);
    }
    R(g, hx + 10, top + 39, 12, 1, P.skinDD);
    // Pelo despeinado
    R(g, hx - 2, top - 4, 36, 12, P.coal);
    R(g, hx - 3, top + 2, 5, 14, P.coal); R(g, hx + 30, top + 2, 5, 13, P.coal);
    const spikes = [[0, -8, 5], [6, -10, 6], [13, -9, 5], [19, -11, 6], [26, -8, 5], [-4, -4, 4], [32, -5, 3]];
    for (const [sx, sy, w] of spikes) R(g, hx + sx, top + sy, w, 6, P.coal);
    R(g, hx + 4, top + 7, 6, 4, P.coal); R(g, hx + 14, top + 7, 7, 3, P.coal); R(g, hx + 23, top + 7, 5, 5, P.coal);
    R(g, hx + 2, top - 6, 8, 1, P.coalL); R(g, hx + 16, top - 8, 6, 1, P.coalL); R(g, hx + 8, top - 2, 12, 1, P.coalL);
    // Cejas
    const ey = top + 18;
    const brow = (x, dy, w = 7) => R(g, hx + x, ey - 4 + dy, w, 2, P.coal);
    // Ojos
    const eyeL = hx + 6, eyeR = hx + 19;
    const look = opts.look || 0;
    const openEye = (x, pupilH = 3) => {
      R(g, x, ey, 7, 6, P.coal); R(g, x + 1, ey + 1, 5, 4, P.creamL);
      R(g, x + 2 + look, ey + 1 + (4 - pupilH), 2, pupilH, P.coal);
      R(g, x + 2 + look, ey + 1 + (4 - pupilH), 1, 1, P.creamL);
    };
    switch (expr) {
      case 'happy':
        brow(6, -2); brow(19, -2);
        for (const x of [eyeL, eyeR]) { R(g, x, ey + 3, 2, 1, P.coal); R(g, x + 2, ey + 1, 3, 2, P.coal); R(g, x + 5, ey + 3, 2, 1, P.coal); }
        break;
      case 'star':
        brow(6, -3); brow(19, -3);
        for (const x of [eyeL, eyeR]) {
          R(g, x, ey - 1, 7, 8, P.coal);
          R(g, x + 3, ey, 1, 6, P.yellow); R(g, x + 1, ey + 2, 5, 2, P.yellow); R(g, x + 2, ey + 1, 3, 4, P.yellow);
          if (Math.sin(t * 12) > 0) R(g, x + 3, ey + 2, 1, 1, P.creamL);
        }
        break;
      case 'confused':
        brow(6, -3); brow(19, 1);
        openEye(eyeL, 2); openEye(eyeR, 3);
        break;
      case 'worried':
        R(g, hx + 6, ey - 3, 3, 2, P.coal); R(g, hx + 9, ey - 5, 4, 2, P.coal);
        R(g, hx + 19, ey - 5, 4, 2, P.coal); R(g, hx + 23, ey - 3, 3, 2, P.coal);
        openEye(eyeL, 2); openEye(eyeR, 2);
        break;
      case 'shocked':
        brow(6, -4); brow(19, -4);
        R(g, eyeL, ey - 1, 7, 8, P.coal); R(g, eyeL + 1, ey, 5, 6, P.creamL); R(g, eyeL + 3, ey + 2, 1, 2, P.coal);
        R(g, eyeR, ey - 1, 7, 8, P.coal); R(g, eyeR + 1, ey, 5, 6, P.creamL); R(g, eyeR + 3, ey + 2, 1, 2, P.coal);
        break;
      case 'relieved':
        brow(6, -1); brow(19, -1);
        for (const x of [eyeL, eyeR]) { R(g, x, ey + 2, 2, 1, P.coal); R(g, x + 2, ey + 3, 3, 1, P.coal); R(g, x + 5, ey + 2, 2, 1, P.coal); }
        break;
      default:
        brow(6, 0); brow(19, 0);
        openEye(eyeL); openEye(eyeR);
    }
    // Nariz
    R(g, hx + 15, top + 27, 3, 2, P.skinD);
    // Boca
    const my = top + 32;
    if (expr === 'happy' || expr === 'star') {
      R(g, hx + 9, my - 1, 14, 1, P.coal);
      R(g, hx + 10, my, 12, 4, P.coal); R(g, hx + 11, my, 10, 1, P.creamL); R(g, hx + 12, my + 2, 8, 2, P.coralD);
      R(g, hx + 4, top + 28, 5, 2, P.coralL); R(g, hx + 23, top + 28, 5, 2, P.coralL);
    } else if (expr === 'confused') {
      R(g, hx + 12, my, 3, 1, P.coal); R(g, hx + 15, my + 1, 3, 1, P.coal); R(g, hx + 18, my, 2, 1, P.coal);
    } else if (expr === 'worried') {
      for (let i = 0; i < 10; i++) R(g, hx + 11 + i, my + (i % 4 < 2 ? 0 : 1), 1, 1, P.coal);
      // Gota de sudor
      const sy = top + 10 + ((t * 10) % 8);
      R(g, hx + 29, sy, 2, 3, P.cyan); R(g, hx + 29, sy, 1, 1, P.cyanL); R(g, hx + 30, sy - 1, 1, 1, P.cyan);
    } else if (expr === 'shocked') {
      R(g, hx + 13, my - 1, 6, 5, P.coal); R(g, hx + 14, my, 4, 3, P.coralD);
    } else if (expr === 'relieved') {
      R(g, hx + 11, my, 2, 1, P.coal); R(g, hx + 13, my + 1, 6, 1, P.coal); R(g, hx + 19, my, 2, 1, P.coal);
    } else {
      R(g, hx + 12, my, 8, 1, P.coal);
    }
    // Brazo levantado (celebración)
    if (opts.fist) {
      const fy = top + 48 - Math.round(Math.abs(Math.sin(t * 10)) * 10);
      R(g, cx + 30, fy + 8, 9, 30, P.orange); R(g, cx + 30, fy + 8, 2, 30, P.orangeD);
      R(g, cx + 29, fy, 11, 10, P.skinDD); R(g, cx + 30, fy + 1, 9, 8, P.skin); R(g, cx + 30, fy + 3, 9, 1, P.skinM); R(g, cx + 30, fy + 6, 9, 1, P.skinM);
      R(g, cx + 26, fy - 2, 2, 2, P.yellow); R(g, cx + 42, fy + 1, 2, 2, P.yellow);
    }
    if (opts.question) {
      const qx = hx + 36, qy = top - 10 + Math.round(Math.sin(t * 4));
      Px.box(g, qx, qy, 11, 13, P.creamL, P.coal);
      Px.text(g, '?', qx + 3, qy + 11, P.coralD);
    }
  };

  // ---------- Cerdito de Timmy (unos 80x64), en coordenadas locales ----------
  // El mismo cerdito rosa que se roba en su cuarto (js/render/sneak.js, drawPig), en grande
  Chars.piggy = function (g, cx, cy, opts = {}) {
    const body = '#E8899E', dark = '#D4708A', deep = '#C9607A', light = '#F5B3C2';
    // Patas
    for (const lx of [-20, -9, 7, 18]) {
      R(g, cx + lx - 1, cy + 14, 9, 13, P.coal);
      R(g, cx + lx, cy + 15, 7, 11, dark);
      R(g, cx + lx, cy + 15, 3, 10, body);
      R(g, cx + lx, cy + 24, 7, 2, deep);
    }
    // Cuerpo
    Px.ellipse(g, cx, cy, 31, 23, P.coal);
    Px.ellipse(g, cx, cy, 30, 22, dark);
    Px.ellipse(g, cx - 2, cy - 2, 27, 19, body);
    Px.ellipse(g, cx - 10, cy - 10, 10, 5, light);
    R(g, cx - 16, cy - 13, 4, 2, P.creamL);
    // Ranura de las monedas
    R(g, cx - 7, cy - 21, 14, 3, P.coal); R(g, cx - 6, cy - 20, 12, 1, P.coalDD);
    // Rabito
    R(g, cx - 34, cy - 6, 4, 2, P.coal); R(g, cx - 36, cy - 9, 2, 4, P.coal); R(g, cx - 34, cy - 11, 3, 2, P.coal);
    // Oreja
    R(g, cx + 10, cy - 27, 9, 8, P.coal); R(g, cx + 11, cy - 26, 7, 7, dark); R(g, cx + 12, cy - 25, 4, 4, light);
    R(g, cx - 4, cy - 27, 9, 8, P.coal); R(g, cx - 3, cy - 26, 7, 7, dark); R(g, cx - 2, cy - 25, 4, 4, light);
    // Hocico
    Px.ellipse(g, cx + 30, cy + 2, 7, 8, P.coal);
    Px.ellipse(g, cx + 30, cy + 2, 6, 7, dark);
    R(g, cx + 28, cy, 2, 4, '#8A3A50'); R(g, cx + 32, cy, 2, 4, '#8A3A50');
    // Ojo y moflete
    if (opts.dizzy) {
      R(g, cx + 15, cy - 9, 1, 1, P.coal); R(g, cx + 17, cy - 9, 1, 1, P.coal); R(g, cx + 16, cy - 8, 1, 1, P.coal); R(g, cx + 15, cy - 7, 1, 1, P.coal); R(g, cx + 17, cy - 7, 1, 1, P.coal);
    } else {
      R(g, cx + 15, cy - 10, 3, 4, P.coal); R(g, cx + 15, cy - 10, 1, 1, P.creamL);
    }
    R(g, cx + 12, cy - 2, 6, 3, '#F7C6D2');
    // Grietas
    if (opts.cracks) {
      for (const c of opts.cracks) {
        for (let i = 1; i < c.length; i++) Px.line(g, cx + c[i - 1][0], cy + c[i - 1][1], cx + c[i][0], cy + c[i][1], i % 2 ? P.coal : deep);
      }
    }
  };

  // ---------- PLEYZETA 6 ULTRA (arte del producto, 130x120) ----------
  Chars.console = function (g, x, y, t) {
    // Suelo y sombra
    R(g, x + 10, y + 104, 110, 4, P.creamD);
    // Torre de la consola
    Px.box(g, x + 18, y + 30, 46, 76, P.coal, P.coalDD);
    R(g, x + 20, y + 32, 42, 2, P.coalL);
    R(g, x + 24, y + 40, 34, 4, P.coalM); R(g, x + 24, y + 48, 34, 4, P.coalM); R(g, x + 24, y + 56, 34, 4, P.coalM);
    R(g, x + 28, y + 70, 26, 10, P.creamL); Px.text(g, 'P6', x + 41, y + 79, P.coal, { align: 'center' });
    R(g, x + 24, y + 92, 6, 3, P.green); R(g, x + 33, y + 92, 18, 2, P.coalL);
    // Llamas encima ("edición horno doméstico")
    for (let i = 0; i < 5; i++) {
      const fh = 10 + Math.round(Math.abs(Math.sin(t * 9 + i * 1.7)) * 9);
      const fx = x + 22 + i * 8;
      R(g, fx, y + 30 - fh, 6, fh, P.orange);
      R(g, fx + 1, y + 30 - fh + 4, 4, fh - 4, P.yellow);
      R(g, fx + 2, y + 30 - fh + 8, 2, Math.max(0, fh - 8), P.creamL);
    }
    // Caja del juego
    Px.box(g, x + 74, y + 52, 40, 54, P.creamL, P.coal);
    R(g, x + 76, y + 54, 36, 30, P.orange);
    R(g, x + 76, y + 68, 36, 16, P.yellow);
    Px.ellipse(g, x + 94, y + 70, 7, 7, P.yellowL);
    R(g, x + 76, y + 78, 36, 6, P.orangeD);
    // Palmera y coche
    R(g, x + 82, y + 62, 2, 16, P.coal); R(g, x + 78, y + 61, 10, 2, P.coal); R(g, x + 79, y + 60, 3, 1, P.coal); R(g, x + 85, y + 60, 3, 1, P.coal);
    R(g, x + 92, y + 78, 16, 4, P.coal); R(g, x + 95, y + 75, 8, 3, P.coal);
    R(g, x + 76, y + 85, 36, 19, P.coal);
    Px.text(g, 'GRAN', x + 94, y + 93, P.yellow, { align: 'center' });
    Px.text(g, 'ROBO VI', x + 94, y + 102, P.creamL, { align: 'center' });
    // Destellos de oferta
    if (Math.sin(t * 6) > 0) { R(g, x + 8, y + 40, 1, 5, P.yellowD); R(g, x + 6, y + 42, 5, 1, P.yellowD); }
    if (Math.sin(t * 6 + 2) > 0) { R(g, x + 118, y + 44, 1, 5, P.yellowD); R(g, x + 116, y + 46, 5, 1, P.yellowD); }
  };
})(window.SN);
