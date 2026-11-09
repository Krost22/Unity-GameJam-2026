// El protagonista (y su gato), en pixel art procedural con el kit SN.PK.
// En la partida se ve en primera persona: solo sus manos (camisa blanca remangada), una en el teclado y otra
// en el ratón, que sigue al cursor. Reaccionan al juego: tamborilean durante una operación, tiemblan en las
// últimas velas, se aprietan en la cámara lenta, celebran y dan un respingo.
// Su cara (pelo castaño despeinado, pecas, corbata floja) aparece en los primeros planos de las cinemáticas.
// Las piezas se cachean por pose/expresión/hora del día: cada fotograma solo compone imágenes.
(function (SN) {
  'use strict';
  const P = SN.PAL, PK = SN.PK, U = SN.Util;

  // Marco del personaje: coordenadas locales = habitación (320x180) desplazada 20 px hacia arriba
  const FW = 150, FH = 160, OY = 20;
  const RAMP = {
    skin: [P.skinDD, P.skinD, P.skinM, P.skin, P.skinL],
    hair: [P.hairDD, P.hairD, P.hair, P.hairM, P.hairL],
    shirt: [P.shirtDD, P.shirtD, P.shirt, P.shirtM, P.shirtL],
    tie: [P.tieD, P.tieD, P.tie, P.tieL],
    mouse: [P.navyDD, P.navyD, P.navyM, P.navyL, P.navyLL],
    cat: [P.catD, P.catD, P.cat, P.catL, '#56457E'],
  };
  // Contraluz de la ventana según la hora
  const RIM = { morning: '#FFEFB8', evening: '#FF9A4A', night: '#FF6FC4' };
  const LIGHT = [1, -1]; // la luz principal (monitor) llega desde la derecha y algo de arriba

  // ---------- Geometría (coordenadas locales) ----------
  const FACE = [[51, 52], [54, 47], [60, 45], [67, 46], [72, 50], [75, 56], [75, 62], [74, 67], [71, 72], [66, 76], [61, 77], [57, 75], [53, 71], [51, 65], [50, 58]];
  // Volumen del pelo (detrás de la cara) y mechones que asoman hacia fuera y hacia abajo
  const HAIR_VOL = [[60, 46, 22, 17], [46, 56, 11, 14], [72, 43, 12, 10], [50, 40, 12, 9]];
  const TUFTS = [
    [[44, 36], [38, 31], [50, 33]], [[52, 31], [54, 25], [59, 31]], [[61, 30], [68, 26], [68, 33]],
    [[71, 34], [79, 34], [76, 40]], [[78, 42], [86, 46], [79, 48]],
    [[37, 46], [29, 48], [37, 54]], [[36, 58], [30, 64], [41, 62]], [[41, 66], [37, 74], [47, 70]], [[47, 70], [47, 78], [52, 72]],
  ];
  const BANGS = [
    [[46, 43], [59, 39], [56, 50], [53, 59], [50, 50]],
    [[55, 41], [70, 41], [66, 49], [62, 56], [59, 48]],
    [[65, 43], [80, 47], [76, 52], [72, 57], [69, 50]],
  ];
  // Mechones sueltos (líneas finas)
  const STRANDS = [[[52, 44], [55, 55]], [[62, 43], [63, 52]], [[71, 46], [73, 54]], [[44, 50], [41, 60]], [[58, 32], [66, 34]]];
  const TORSO = [[33, 92], [45, 86], [55, 83], [68, 83], [79, 86], [87, 93], [90, 106], [91, 128], [93, 160], [17, 160], [19, 128], [21, 108], [26, 97]];

  // Detalles a mano: ojos, cejas y bocas (una letra = un color)
  const FPAL = {
    K: P.hairDD, k: P.skinDD, W: P.creamL, S: '#D6C8E6', I: '#3B1E45', i: '#7B4D8C', H: P.white,
    B: P.hairD, m: '#6E2A3C', p: P.coralL, r: '#F08A80', y: P.yellow, c: P.cyanL, C: P.cyan, t: P.white,
  };
  const EYES = {
    open: { near: ['..KKKKK', '.KKKKKK', 'KWWIIIK', '.WWIIHK', '.WWIiIk', '..SIik.', '...kk..'], far: ['KKKK.', 'KKKKK', 'WIIIK', 'WIIHK', 'WiIIk', '.Iik.', '.kk..'] },
    wide: { near: ['.KKKKK.', 'KWWWWWK', 'KWWWIWK', 'KWWWWWK', '.kkkkk.'], far: ['KKKK.', 'KWWWK', 'KWIWK', 'KWWWK', '.kkk.'] },
    focus: { near: ['.......', 'KKKKKKK', '.WWIIIK', '.WWIIHk', '..SIik.', '...kk..'], far: ['.....', 'KKKKK', 'WIIIK', 'WIIHk', '.Iik.', '.kk..'] },
    blink: { near: ['.......', '.......', '.......', '.KKKKK.', '..kkk..'], far: ['.....', '.....', '.....', 'KKKK.', '.kk..'] },
    happy: { near: ['.......', '.......', '..KKK..', '.K...K.', 'K.....K'], far: ['.....', '.....', '.KKK.', 'K...K', '.....'] },
    sad: { near: ['.......', '.......', '.......', 'KKKKKK.', '..kkk..'], far: ['.....', '.....', '.....', 'KKKK.', '.kk..'] },
    star: { near: ['..KKKKK', '.KKKKKK', 'KWWyWWK', '.WyyyWK', '.WWyWWk', '..WWWk.', '...kk..'], far: ['KKKK.', 'KKKKK', 'WWyWK', 'WyyyK', 'WWyWk', '.WWk.', '.kk..'] },
  };
  const BROWS = {
    worried: { near: ['....BBB', '..BB...', 'BB.....'], far: ['BB...', '..BB.', '....B'] },
    calm: { near: ['.BBBBB.', 'B.....B'], far: ['BBBB.', '....B'] },
    focus: { near: ['BB.....', '..BB...', '....BBB'], far: ['...BB', '.BB..', 'B....'] },
    up: { near: ['..BBB..', '.B...B.', 'B.....B'], far: ['.BBB.', 'B...B'] },
  };
  const MOUTHS = {
    flat: ['mmmm'], worried: ['.mmm', 'm...'], smile: ['m...m', '.mmm.'], grin: ['mmmmm', 'mtttm', '.mpm.'],
    frown: ['.mmm.', 'm...m'], open: ['.mm.', 'mppm', '.mm.'], small: ['.mm.'],
  };
  // Expresión = ojos + cejas + boca (+ rubor)
  const EXPR = {
    worried: { eyes: 'open', brows: 'worried', mouth: 'worried' },
    calm: { eyes: 'open', brows: 'calm', mouth: 'flat' },
    focus: { eyes: 'focus', brows: 'focus', mouth: 'flat' },
    nervous: { eyes: 'wide', brows: 'worried', mouth: 'worried' },
    happy: { eyes: 'happy', brows: 'up', mouth: 'grin', blush: true },
    star: { eyes: 'star', brows: 'up', mouth: 'grin', blush: true },
    sad: { eyes: 'sad', brows: 'worried', mouth: 'frown' },
    shock: { eyes: 'wide', brows: 'up', mouth: 'open' },
    relieved: { eyes: 'happy', brows: 'calm', mouth: 'smile', blush: true },
  };

  // ---------- Construcción de piezas (con caché) ----------
  const cache = new Map();
  const cached = (key, build) => { if (!cache.has(key)) cache.set(key, build()); return cache.get(key); };

  function buildBody(phase) {
    const sp = new PK.Sprite(FW, FH);
    const rim = RIM[phase] || RIM.evening;
    const hairM = sp.mask();
    for (const [x, y, rx, ry] of HAIR_VOL) hairM.ellipse(x, y, rx, ry);
    for (const t of TUFTS) hairM.poly(t);
    sp.part(hairM, RAMP.hair, { light: LIGHT, lit: 4, sh: 4 });
    sp.rim(hairM, rim, [-1, -1]);
    for (const [[x0, y0], [x1, y1]] of [[[40, 42], [36, 52]], [[46, 36], [42, 44]], [[38, 60], [42, 68]], [[56, 34], [52, 40]], [[66, 33], [70, 38]]]) sp.line(x0, y0, x1, y1, P.hairD);
    const neck = sp.mask().poly([[55, 72], [66, 74], [67, 88], [55, 88]]);
    sp.part(neck, RAMP.skin, { light: LIGHT, base: 1, outline: false });
    const torso = sp.mask().poly(TORSO);
    sp.part(torso, RAMP.shirt, { light: LIGHT, lit: 5, sh: 6 });
    // Sombra del lado contrario al monitor y bajo los brazos
    const shade = sp.mask().poly([[19, 112], [32, 104], [40, 118], [42, 160], [17, 160]]).keep(torso);
    sp.part(shade, [P.shirtDD, P.shirtD, P.shirtD, P.shirt], { light: LIGHT, outline: false, base: 1, dither: false });
    sp.rim(torso, rim, [-1, -1]);
    // Pliegues de la camisa
    sp.line(36, 112, 39, 134, P.shirtD).line(46, 120, 47, 140, P.shirtD).line(82, 106, 80, 128, P.shirtD).line(74, 98, 84, 100, P.shirtD).line(70, 132, 78, 146, P.shirtD);
    const v = sp.mask().poly([[55, 83], [67, 83], [61, 93]]);
    sp.part(v, RAMP.skin, { light: LIGHT, base: 1, outline: false });
    const collar = sp.mask().poly([[49, 81], [58, 85], [55, 94], [46, 88]]).poly([[65, 81], [76, 85], [70, 93], [63, 86]]);
    sp.part(collar, RAMP.shirt, { light: LIGHT, base: 3, cast: 1 });
    // Corbata floja: nudo bajo y hoja algo torcida
    const tie = sp.mask().poly([[58, 89], [65, 89], [64, 95], [59, 95]]).poly([[59, 95], [64, 95], [68, 124], [63, 131], [57, 123]]);
    sp.part(tie, RAMP.tie, { light: LIGHT, cast: 1 });
    sp.line(60, 104, 63, 104, P.tieL).line(61, 112, 65, 112, P.tieL).line(61, 120, 66, 120, P.tieL);
    return sp.c;
  }

  function buildHead(exprName, blink, phase) {
    const sp = new PK.Sprite(FW, FH);
    const rim = RIM[phase] || RIM.evening;
    const ex = EXPR[exprName] || EXPR.worried;
    const face = sp.mask().poly(FACE).ellipse(50.5, 63, 2.6, 4.2);
    sp.part(face, RAMP.skin, { light: LIGHT, lit: 4, sh: 3, cast: 2 });
    sp.rim(sp.mask().ellipse(50.5, 63, 2.6, 4.2), P.skinD, [1, 0]);
    // Ojos, cejas y boca
    const eyes = EYES[blink ? 'blink' : ex.eyes];
    sp.stamp(eyes.near, 54, 56, FPAL).stamp(eyes.far, 67, 56, FPAL);
    const brows = BROWS[ex.brows];
    sp.stamp(brows.near, 53, 52, FPAL).stamp(brows.far, 67, 52, FPAL);
    // Nariz, pecas y rubor
    sp.px(73, 65, P.skinD).px(72, 66, P.skinD);
    for (const [x, y] of [[56, 67], [58, 68], [57, 69], [70, 67], [71, 68]]) sp.px(x, y, P.skinD);
    if (ex.blush) sp.rect(54, 67, 3, 1, FPAL.r).rect(69, 67, 3, 1, FPAL.r);
    const mouth = MOUTHS[ex.mouth];
    sp.stamp(mouth, 64 - Math.floor(mouth[0].length / 2), 71, FPAL);
    return sp.c;
  }

  // Flequillo: va encima de la cara y de la mano (los dedos se meten bajo el pelo)
  function buildBangs(phase) {
    const sp = new PK.Sprite(FW, FH);
    const rim = RIM[phase] || RIM.evening;
    for (const b of BANGS) {
      const m = sp.mask().poly(b);
      sp.part(m, RAMP.hair, { light: LIGHT, lit: 3, sh: 2, cast: 2 });
      sp.rim(m, rim, [-1, -1]);
    }
    for (const [[x0, y0], [x1, y1]] of STRANDS) sp.line(x0, y0, x1, y1, P.hairD);
    sp.line(60, 42, 66, 42, P.hairL).line(70, 45, 74, 46, P.hairL);
    return sp.c;
  }

  // Brazo cercano (el izquierdo de la imagen) en distintas poses
  const NEAR = {
    chin: { elbow: [22, 134], wrist: [50, 92], hand: [54, 84, 6, 4.5] },
    head: { elbow: [18, 134], wrist: [40, 72], hand: [44, 56, 6, 6], fingers: [[41, 58, 45, 46], [45, 59, 49, 46], [49, 60, 53, 48]] },
    fist: { elbow: [16, 112], wrist: [18, 76], hand: [18, 68, 5.5, 5.5] },
    facepalm: { elbow: [26, 132], wrist: [48, 86], hand: [59, 62, 8, 5.5] },
    desk: { elbow: [20, 134], wrist: [50, 140], hand: [56, 140, 6, 4] },
  };
  function buildNearArm(pose, phase) {
    const sp = new PK.Sprite(FW, FH);
    const rim = RIM[phase] || RIM.evening;
    const a = NEAR[pose] || NEAR.chin;
    const sh = [28, 96];
    const sleeve = sp.mask().capsule(sh[0], sh[1], a.elbow[0], a.elbow[1], 7.6);
    sp.part(sleeve, RAMP.shirt, { light: LIGHT, lit: 4, cast: 1 });
    sp.rim(sleeve, rim, [-1, -1]);
    // Puño remangado
    const ex = a.elbow[0] + (a.wrist[0] - a.elbow[0]) * 0.12, ey = a.elbow[1] + (a.wrist[1] - a.elbow[1]) * 0.12;
    const cuff = sp.mask().capsule(a.elbow[0], a.elbow[1], ex, ey, 7.2);
    sp.part(cuff, RAMP.shirt, { light: LIGHT, base: 3, cast: 1 });
    const fore = sp.mask().taper(ex, ey, 5.6, a.wrist[0], a.wrist[1], 4.2);
    sp.part(fore, RAMP.skin, { light: LIGHT, lit: 3, cast: 1 });
    const hd = a.hand;
    const hand = sp.mask().ellipse(hd[0], hd[1], hd[2], hd[3]);
    if (a.fingers) for (const [x0, y0, x1, y1] of a.fingers) hand.capsule(x0, y0, x1, y1, 1.7);
    sp.part(hand, RAMP.skin, { light: LIGHT, lit: 2, cast: 1 });
    // Dedos insinuados
    if (pose === 'fist') sp.line(15, 66, 21, 66, P.skinD).line(15, 69, 21, 69, P.skinD);
    else if (pose === 'facepalm') sp.line(54, 60, 64, 60, P.skinD).line(54, 63, 64, 63, P.skinD);
    else if (pose !== 'head') sp.line(hd[0] - 3, hd[1] + 1, hd[0] + 3, hd[1] + 1, P.skinD);
    return sp.c;
  }

  // ---------- Manos en primera persona ----------
  const HAND_LIGHT = [0, -1]; // la luz del monitor llega desde delante (arriba en pantalla)
  // Un dedo visto desde arriba: sale del nudillo con un ángulo (grados, 0 = hacia el monitor) y se estrecha
  function finger(m, kx, ky, ang, len, r0, r1) {
    const a = ang * Math.PI / 180;
    const tx = kx + Math.sin(a) * len, ty = ky - Math.cos(a) * len;
    m.taper(kx, ky, r0, tx, ty, r1);
    return [Math.round(tx), Math.round(ty - r1 + 0.5)];
  }
  // Pliegue entre dos dedos: una línea de sombra que se pierde antes de llegar al nudillo
  function crease(sp, t0, t1, k0, k1, col) {
    const top = [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2 + 2], bot = [(k0[0] + k1[0]) / 2, (k0[1] + k1[1]) / 2 - 1];
    const n = Math.max(1, Math.round(Math.hypot(bot[0] - top[0], bot[1] - top[1]) * 0.75));
    for (let i = 0; i <= n; i++) sp.px(Math.round(top[0] + (bot[0] - top[0]) * i / n / 1.0), Math.round(top[1] + (bot[1] - top[1]) * i / n), col);
  }
  // Manga remangada: dos franjas de tela cruzadas al antebrazo, con pliegues
  function sleeve(sp, cx, cy, ang, phase, rimDir) {
    const a = ang * Math.PI / 180, ux = Math.sin(a), uy = Math.cos(a); // a lo largo del brazo (hacia abajo)
    const px = uy, py = -ux; // perpendicular
    const P4 = (d0, d1, w) => [[cx + ux * d0 - px * w, cy + uy * d0 - py * w], [cx + ux * d0 + px * w, cy + uy * d0 + py * w],
      [cx + ux * d1 + px * (w + 1), cy + uy * d1 + py * (w + 1)], [cx + ux * d1 - px * (w + 1), cy + uy * d1 - py * (w + 1)]];
    const roll = sp.mask().poly(P4(0, 5, 9.5));
    const rest = sp.mask().poly(P4(5, 26, 10.5));
    sp.part(rest, RAMP.shirt, { light: [0, -1], lit: 1, sh: 3 });
    sp.part(roll, RAMP.shirt, { light: [0, -1], lit: 2, sh: 2, cast: 1 });
    sp.rim(roll, RIM[phase] || RIM.evening, rimDir);
    // pliegues de la tela
    for (const [d, w] of [[2.5, 5], [8, 3], [11, -4]]) {
      const x0 = cx + ux * d - px * w, y0 = cy + uy * d - py * w;
      sp.line(Math.round(x0), Math.round(y0), Math.round(x0 + px * 3), Math.round(y0 + py * 3), P.shirtD);
    }
  }

  // Mano derecha sobre el ratón (sprite 64x64; el centro del ratón en (24, 12)).
  // La palma cubre la parte trasera; índice y corazón estirados sobre los botones, anular y meñique
  // abrazan el costado derecho y el pulgar el izquierdo. El brazo entra en diagonal desde abajo a la derecha.
  function buildMouseHand(pressed, phase) {
    const sp = new PK.Sprite(64, 64);
    const rim = RIM[phase] || RIM.evening;
    const p = pressed ? 1 : 0;
    const mouse = sp.mask().ellipse(24, 13, 8, 12);
    sp.part(mouse, RAMP.mouse, { light: HAND_LIGHT, lit: 2 });
    sp.line(24, 2, 24, 9, P.navyDD).rect(23, 4, 3, 3, P.navyLL).px(24, 5, P.cyan);
    // Antebrazo + dorso + dedos en una sola silueta: se ven como una mano, no como piezas sueltas
    const hand = sp.mask()
      .taper(26, 31, 6, 33, 46, 7)
      .poly([[16, 19], [19, 16], [24, 15], [29, 16], [33, 19], [34, 24], [32, 30], [28, 34], [21, 34], [17, 29]])
      .taper(18.5, 28, 3, 16, 23.5, 2.1); // pulgar: sale de la base de la palma y abraza el costado del ratón
    const K = [[20, 17], [24.5, 16], [28.5, 17.5], [32, 20]];
    const tips = [
      finger(hand, K[0][0], K[0][1], -5, 6.5 - p, 2.2, 1.9),
      finger(hand, K[1][0], K[1][1], 1, 7, 2.3, 1.9),
      finger(hand, K[2][0], K[2][1], 12, 5, 2.1, 1.8),
      finger(hand, K[3][0], K[3][1], 30, 3, 1.9, 1.6),
    ];
    sp.part(hand, RAMP.skin, { light: HAND_LIGHT, hi: 1, lit: 3, sh: 3, cast: 1 });
    for (let i = 0; i < 3; i++) crease(sp, tips[i], tips[i + 1], K[i], K[i + 1], P.skinD);
    // Uñas: un brillo en la punta de los dedos estirados
    sp.px(tips[0][0], tips[0][1] + 1, P.skinL).px(tips[1][0], tips[1][1] + 1, P.skinL);
    // Nudillos: apenas un toque de luz en índice y corazón; tendones hacia la muñeca
    sp.px(20, 18, P.skinL).px(25, 17, P.skinL);
    sp.line(22, 22, 23, 27, P.skinM).line(26, 22, 26, 26, P.skinM);
    sleeve(sp, 33, 38, -28, phase, [1, 0]);
    // Pliegue suave entre el pulgar y la palma, y la uña del pulgar
    sp.px(18, 25, P.skinM).px(19, 26, P.skinM);
    sp.px(15, 22, P.skinL);
    sp.rim(hand, rim, [1, 0]);
    return sp.c;
  }

  // Mano izquierda sobre el teclado (sprite 64x64; nudillos hacia y=14). mask: bit i = dedo i pulsado
  // (0 meñique ... 3 índice). Dedos en abanico y de distinto largo, curvados sobre la fila central:
  // al pulsar, el dedo se encoge un poco (se dobla hacia la tecla); con tensión se cierran en puño.
  function buildKeyHand(mask, clench, phase) {
    const sp = new PK.Sprite(64, 64);
    const rim = RIM[phase] || RIM.evening;
    const hand = sp.mask()
      .taper(21, 27, 6, 13, 42, 7)
      .poly([[8, 20], [12, 15], [19, 12], [26, 13], [30, 17], [30, 23], [27, 29], [16, 30], [10, 26]])
      .taper(26.5, 25, 3, 31.5, 23.5, 2.1); // pulgar: asoma por el lado del índice y descansa en la barra
    const K = [[10.5, 18], [15.5, 14.5], [21, 13], [26, 14]];
    const ANG = [-16, -7, 0, 7], LEN = [4.5, 6, 7, 6], R0 = [1.9, 2.3, 2.4, 2.3], R1 = [1.6, 1.9, 2, 1.9];
    const tips = K.map(([x, y], i) => {
      const down = (mask >> i) & 1;
      const len = clench ? 2 : LEN[i] - down * 1.5;
      return finger(hand, x, y, ANG[i], len, R0[i], R1[i]);
    });
    sp.part(hand, RAMP.skin, { light: HAND_LIGHT, hi: 1, lit: 3, sh: 3, cast: 1 });
    if (!clench) for (let i = 0; i < 3; i++) crease(sp, tips[i], tips[i + 1], K[i], K[i + 1], P.skinD);
    else for (let i = 0; i < 3; i++) sp.px(Math.round((K[i][0] + K[i + 1][0]) / 2), Math.round((K[i][1] + K[i + 1][1]) / 2) - 2, P.skinD);
    // Las puntas que no pulsan reciben la luz del monitor
    tips.forEach(([x, y], i) => { if (!clench && !((mask >> i) & 1)) sp.px(x, y + 1, P.skinL); });
    sp.px(21, 15, P.skinL).px(26, 16, P.skinL);
    sp.line(19, 19, 18, 25, P.skinM).line(23, 19, 22, 24, P.skinM);
    sleeve(sp, 14, 37, 26, phase, [-1, 0]);
    // Pliegue suave entre el pulgar y el índice, y la uña del pulgar
    sp.px(27, 22, P.skinM).px(28, 22, P.skinM);
    sp.px(32, 22, P.skinL);
    sp.rim(hand, rim, [-1, 0]);
    return sp.c;
  }

  // ---------- El gato (64x34, sobre la mesa) ----------
  // Poses: sleep (dormido), ear (mueve una oreja), purr (ronronea, ojos felices), peek (abre un ojo),
  // awake (despierto), yawn (bosteza), groom (se lava la pata), stretch (se estira), sit (sentado, mira
  // el ratón: look -1..1), arch (erizado, lomo arqueado), alert (mira a la ventana, orejas atrás).
  const CW = 64, CH = 34;
  function buildCat(state, breath, tail, phase, look = 0) {
    const sp = new PK.Sprite(CW, CH);
    const rim = RIM[phase] || RIM.evening;
    if (state === 'sit' || state === 'arch' || state === 'alert') return buildCatUp(sp, state, breath, tail, rim, look);
    const lying = state === 'sleep' || state === 'ear' || state === 'purr' || state === 'peek';
    const up = lying ? 0 : -2;
    const st = state === 'stretch';
    // Cola: rodeando el cuerpo (o estirada hacia atrás al desperezarse)
    const tailM = st ? sp.mask().capsule(12, 22, 5, 18, 2.4).capsule(5, 18, 3, 11, 2.2)
      : sp.mask().capsule(10, 22, 7, 27, 2.6).capsule(7, 27, 16, 30, 2.6).capsule(16, 30, 32 + tail, 30 - (tail > 1 ? 1 : 0), 2.4);
    sp.part(tailM, RAMP.cat, { light: LIGHT });
    // Cuerpo: al estirarse, más largo y con el lomo bajo delante
    const body = st ? sp.mask().ellipse(27, 21, 19, 8).ellipse(19, 18, 9, 8) : sp.mask().ellipse(31, 21, 19, 10 + breath * 0.6);
    sp.part(body, RAMP.cat, { light: LIGHT, lit: 3, sh: 3 });
    sp.rim(body, rim, [-1, -1]);
    // Cabeza a la derecha, apoyada en las patas (más baja y adelantada al estirarse)
    const hx = st ? 51 : 49, hy = st ? 24 : 21 + up;
    const earL = state === 'ear' || state === 'groom' ? [[41, hy - 3], [41, hy - 9], [47, hy - 6]] : [[hx - 8, hy - 4], [hx - 6, hy - 13], [hx - 1, hy - 6]];
    const head = sp.mask().ellipse(hx, hy, 9, 7.5).poly(earL).poly([[hx + 1, hy - 6], [hx + 7, hy - 13], [hx + 8, hy - 3]]);
    sp.part(head, RAMP.cat, { light: LIGHT, lit: 2, cast: 1 });
    sp.rim(head, rim, [-1, -1]);
    if (state !== 'ear' && state !== 'groom') sp.px(hx - 3, hy - 9, P.catPink);
    sp.px(hx + 5, hy - 9, P.catPink);
    // Patas: estiradas hacia delante al desperezarse; una levantada hasta la cara al lavarse
    const paws = st ? sp.mask().ellipse(58, 30, 5, 2.2).ellipse(61, 27, 3, 2)
      : state === 'groom' ? sp.mask().ellipse(44, 28, 5, 2.4).ellipse(hx + 2, hy + 4, 3, 3.4)
        : sp.mask().ellipse(44, 28, 5, 2.4).ellipse(53, 28, 4, 2.2);
    sp.part(paws, RAMP.cat, { light: LIGHT, base: 3 });
    // Cara
    const eyeY = hy - 1, ex = hx - 4;
    const closed = (y) => sp.rect(ex, y, 3, 1, P.catL).rect(ex + 7, y, 3, 1, P.catL);
    if (state === 'sleep' || state === 'ear' || state === 'stretch') closed(eyeY);
    else if (state === 'purr' || state === 'yawn' || state === 'groom') {
      // Ojos felices (^ ^)
      sp.px(ex, eyeY, P.catL).px(ex + 1, eyeY - 1, P.catL).px(ex + 2, eyeY, P.catL);
      sp.px(ex + 7, eyeY, P.catL).px(ex + 8, eyeY - 1, P.catL).px(ex + 9, eyeY, P.catL);
    } else if (state === 'peek') { sp.rect(ex, eyeY, 3, 1, P.catL).rect(ex + 7, eyeY - 1, 3, 2, P.catEye).px(ex + 8, eyeY - 1, P.catD); }
    else { const lx = U.clamp(Math.round(look), -1, 1); sp.rect(ex, eyeY - 1, 3, 2, P.catEye).rect(ex + 7, eyeY - 1, 3, 2, P.catEye).px(ex + 1 + lx, eyeY - 1, P.catD).px(ex + 8 + lx, eyeY - 1, P.catD); }
    if (state === 'yawn') { sp.rect(hx - 1, hy + 2, 4, 3, P.catD).rect(hx, hy + 3, 2, 2, P.catPink); }
    else sp.px(hx, eyeY + 3, P.catPink).px(hx + 1, eyeY + 3, P.catPink);
    return sp.c;
  }
  // El gato de pie: sentado mirando el ratón, erizado (lomo arqueado) o alerta mirando a la ventana
  function buildCatUp(sp, state, breath, tail, rim, look) {
    const arch = state === 'arch', alert = state === 'alert';
    if (arch) {
      // Cola en alto y erizada
      const tailM = sp.mask().capsule(14, 20, 8, 8, 2.8).capsule(8, 8, 10, 2, 2.6);
      sp.part(tailM, RAMP.cat, { light: LIGHT });
      for (let i = 0; i < 5; i++) sp.px(6 + (i % 2) * 5, 3 + i * 3, P.catD);
      // Lomo arqueado, patas rectas
      const body = sp.mask().ellipse(30, 17, 17, 9).rect(16, 20, 4, 12).rect(24, 21, 4, 11).rect(36, 21, 4, 11).rect(43, 20, 4, 12);
      sp.part(body, RAMP.cat, { light: LIGHT, lit: 3, sh: 3 });
      sp.rim(body, rim, [-1, -1]);
      for (let x = 18; x < 44; x += 3) sp.px(x, 7 + Math.round(Math.abs(x - 30) / 5), P.catD);
      const hx = 52, hy = 18;
      const head = sp.mask().ellipse(hx, hy, 8, 7).poly([[hx - 7, hy - 3], [hx - 9, hy - 10], [hx - 2, hy - 6]]).poly([[hx + 2, hy - 6], [hx + 8, hy - 11], [hx + 8, hy - 2]]);
      sp.part(head, RAMP.cat, { light: LIGHT, lit: 2, cast: 1 });
      sp.rim(head, rim, [-1, -1]);
      sp.rect(hx - 5, hy - 2, 3, 3, P.catEye).rect(hx + 2, hy - 2, 3, 3, P.catEye).px(hx - 4, hy - 1, P.catD).px(hx + 3, hy - 1, P.catD);
      sp.rect(hx - 1, hy + 2, 4, 3, P.catD).px(hx, hy + 2, P.white).px(hx + 2, hy + 2, P.white);
      return sp.c;
    }
    // Sentado: cola enroscada en las patas
    const tailM = sp.mask().capsule(44, 31, 54, 31, 2.4).capsule(54, 31, 57 + tail, 25, 2.2);
    sp.part(tailM, RAMP.cat, { light: LIGHT });
    const body = sp.mask().ellipse(38, 23 - breath * 0.4, 11, 10).ellipse(38, 28, 12, 6);
    sp.part(body, RAMP.cat, { light: LIGHT, lit: 3, sh: 3 });
    sp.rim(body, rim, [-1, -1]);
    const paws = sp.mask().ellipse(34, 32, 3, 1.6).ellipse(42, 32, 3, 1.6);
    sp.part(paws, RAMP.cat, { light: LIGHT, base: 3 });
    // Cabeza (girada hacia la ventana si está alerta)
    const hx = alert ? 34 : 38 + Math.round(look), hy = 10;
    const earsBack = alert;
    const head = sp.mask().ellipse(hx, hy, 8.5, 7)
      .poly(earsBack ? [[hx - 8, hy - 2], [hx - 12, hy - 7], [hx - 4, hy - 5]] : [[hx - 7, hy - 3], [hx - 6, hy - 11], [hx - 1, hy - 6]])
      .poly(earsBack ? [[hx + 4, hy - 5], [hx + 11, hy - 8], [hx + 8, hy - 1]] : [[hx + 1, hy - 6], [hx + 6, hy - 11], [hx + 7, hy - 3]]);
    sp.part(head, RAMP.cat, { light: LIGHT, lit: 2, cast: 1 });
    sp.rim(head, rim, [-1, -1]);
    if (!earsBack) sp.px(hx - 5, hy - 8, P.catPink).px(hx + 4, hy - 8, P.catPink);
    const lx = alert ? -1 : U.clamp(Math.round(look), -1, 1);
    sp.rect(hx - 5, hy - 1, 3, 2, P.catEye).rect(hx + 2, hy - 1, 3, 2, P.catEye).px(hx - 4 + lx, hy - 1, P.catD).px(hx + 3 + lx, hy - 1, P.catD);
    sp.px(hx - 1, hy + 2, P.catPink).px(hx, hy + 2, P.catPink);
    return sp.c;
  }

  // Corazón de 5x4 (el gato ronronea)
  function heart(g, x, y, c) { SN.Px.rect(g, x, y, 2, 1, c); SN.Px.rect(g, x + 3, y, 2, 1, c); SN.Px.rect(g, x, y + 1, 5, 1, c); SN.Px.rect(g, x + 1, y + 2, 3, 1, c); SN.Px.rect(g, x + 2, y + 3, 1, 1, c); }

  // ---------- Estado y animación ----------
  const H = SN.Hero = {
    t: 0,
    expr: 'worried', pose: 'chin',
    react: null,           // { kind, t } reacción temporal (celebrar, lamentarse...)
    blinkT: 2.5, blinking: 0,
    mouse: { x: 0, y: 0, tx: 0, ty: 0 },
    fingers: [0, 0, 0, 0],
    idleT: 2, drumT: 0, shake: 0,
    click: 0,
    bounce: { y: 0, v: 0 },
    sweat: 0,
    cat: { state: 'sleep', t: 0, tail: 0, tailT: 3, wakeT: 0, act: null, actT: 0, idleT: 9, fx: null, fxT: 0 },

    // El cursor sobre el monitor mueve un poco el ratón de la mesa
    pointAt(sx, sy) {
      const S = SN.SCREEN;
      this.mouse.tx = U.clamp((sx - (S.x + S.w / 2)) / (S.w / 2), -1.2, 1.2) * 11;
      this.mouse.ty = U.clamp((sy - (S.y + S.h / 2)) / (S.h / 2), -1.2, 1.2) * 5;
    },
    press() { this.click = 0.14; },
    // Ganar mucho: el gato ronronea (corazones); perder mucho: se eriza y bufa
    celebrate(big) { this.react = { kind: big ? 'bigwin' : 'win', t: big ? 2.2 : 1.5 }; this.bounce.v = big ? -70 : -50; if (big) this.catDo('purr', 2.6, 'heart'); },
    flinch(big) { this.react = { kind: big ? 'bigloss' : 'loss', t: big ? 2.2 : 1.4 }; this.bounce.v = 34; this.shake = big ? 0.5 : 0.3; if (big) this.catDo('arch', 2, 'hiss'); },
    tapFinger() { this.fingers[Math.floor(Math.random() * 4)] = 0.12; },
    relief() { this.react = { kind: 'relief', t: 2.4 }; },
    wakeCat(sec) { this.catDo('awake', sec); },
    // El gato hace algo durante `sec` segundos (y luego vuelve a dormir). fx: corazones, bufido, destellos, "prr"...
    catDo(state, sec, fx) {
      const c = this.cat;
      c.act = state; c.actT = sec; c.state = state;
      if (fx) { c.fx = fx; c.fxT = Math.min(sec, 2.4); }
      if (state === 'awake' || state === 'sit' || state === 'groom' || state === 'arch' || state === 'alert') c.wakeT = sec;
    },
    // Clic en el gato: dormido, mueve la oreja y ronronea (no se despierta); despierto, ronronea
    petCat() {
      const c = this.cat;
      if (c.state === 'sleep' || c.state === 'ear') this.catDo('ear', 0.6, 'prr');
      else { c.fx = 'heart'; c.fxT = 1.6; }
    },

    // Expresión y pose según lo que pasa en el juego
    mood() {
      const run = SN.State.run;
      const r = this.react;
      if (r) {
        if (r.kind === 'bigwin') return { expr: 'star', pose: 'fist' };
        if (r.kind === 'win') return { expr: 'happy', pose: 'fist' };
        if (r.kind === 'bigloss') return { expr: 'shock', pose: 'head' };
        if (r.kind === 'loss') return { expr: 'sad', pose: 'facepalm' };
        if (r.kind === 'relief') return { expr: 'relieved', pose: 'desk' };
      }
      if (SN.Drama && SN.Drama.active && !SN.Drama.light) return { expr: 'nervous', pose: 'head' };
      if (run && run.position && !run.position.settled) {
        const danger = SN.Chart.anim && SN.Chart.anim.revealed >= run.position.total - SN.Data.sim.dangerCandles;
        return { expr: danger ? 'nervous' : 'focus', pose: danger ? 'head' : 'desk' };
      }
      if (run && !SN.Debt.active()) return { expr: 'calm', pose: 'chin' };
      return { expr: 'worried', pose: 'chin' };
    },

    update(dt) {
      this.t += dt;
      const m = this.mouse;
      m.x += (m.tx - m.x) * Math.min(1, dt * 12);
      m.y += (m.ty - m.y) * Math.min(1, dt * 12);
      this.click = Math.max(0, this.click - dt);
      if (this.react && (this.react.t -= dt) <= 0) this.react = null;
      this.shake = Math.max(0, this.shake - dt);
      for (let i = 0; i < 4; i++) this.fingers[i] = Math.max(0, this.fingers[i] - dt);
      // Dedos: tamborilean durante una operación y, en reposo, se mueven de vez en cuando
      const run = SN.State.run;
      const trading = run && run.position && !run.position.settled;
      if (trading) {
        if ((this.drumT -= dt) <= 0) { this.drumT = 0.11; this.fingers[Math.floor(this.t * 9) % 4] = 0.09; }
      } else if ((this.idleT -= dt) <= 0) { this.idleT = U.rand(2.5, 6); this.tapFinger(); }
      const b = this.bounce;
      b.v += (-b.y * 220 - b.v * 12) * dt;
      b.y += b.v * dt;
      // Parpadeo cada pocos segundos
      if (this.blinking > 0) this.blinking -= dt;
      else if ((this.blinkT -= dt) <= 0) { this.blinking = 0.13; this.blinkT = U.rand(2.2, 5); }
      const md = this.mood();
      this.sweat = md.expr === 'nervous' || md.expr === 'shock' ? Math.min(1, this.sweat + dt * 2) : Math.max(0, this.sweat - dt);
      // Gato: duerme casi siempre, pero de vez en cuando hace algo (y reacciona a lo que pasa)
      const c = this.cat;
      c.t += dt;
      c.fxT = Math.max(0, c.fxT - dt);
      if (c.act && (c.actT -= dt) <= 0) { c.act = null; c.state = 'sleep'; c.wakeT = 0; }
      if (c.wakeT > 0 && (c.wakeT -= dt) <= 0 && !c.act) c.state = 'sleep';
      const drama = SN.Drama && SN.Drama.active;
      // Alguien en la azotea: lo mira con las orejas hacia atrás
      const hooded = SN.Desk && SN.Desk.windowEvents && SN.Desk.windowEvents.includes('encapuchado');
      if (hooded && c.act !== 'alert' && c.act !== 'arch') this.catDo('alert', 2);
      if (!c.act) {
        if (c.state === 'sleep' && drama) c.state = 'peek';
        if (c.state === 'peek' && !drama && c.wakeT <= 0) c.state = 'sleep';
        // Cosas de gato cuando nadie le hace caso
        if (c.state === 'sleep' && !drama && (c.idleT -= dt) <= 0) {
          c.idleT = U.rand(8, 18);
          const run = SN.State.run, lucky = SN.Luck && run && SN.Luck.today();
          const pick = U.pick(['ear', 'ear', 'stretch', 'yawn', 'groom', 'sit', 'purr']);
          const dur = { ear: 0.5, stretch: 2.2, yawn: 1.4, groom: 3, sit: 5, purr: 3 }[pick];
          this.catDo(pick, dur, lucky ? 'gold' : pick === 'purr' ? 'prr' : null);
        }
      }
      if ((c.tailT -= dt) <= 0) {
        // Despierto mueve la cola más a menudo
        const awake = c.state !== 'sleep' && c.state !== 'ear' && c.state !== 'purr';
        c.tail = c.tail ? 0 : 2; c.tailT = c.tail ? 0.35 : awake ? U.rand(0.5, 1.5) : U.rand(2, 6);
      }
    },

    // Manos en primera persona (g = lienzo de 320x180): teclado en (kx, ky), ratón en (mx, my)
    drawHands(g, phase, kx, ky, mx, my) {
      const md = this.mood();
      const by = Math.round(this.bounce.y);
      const nervous = md.expr === 'nervous' || md.expr === 'shock';
      const sx = this.shake > 0 ? Math.round(Math.sin(this.t * 70) * 2) : nervous && Math.sin(this.t * 40) > 0.6 ? 1 : 0;
      const clench = !!(SN.Drama && SN.Drama.active && !SN.Drama.light) || md.expr === 'shock';
      let mask = 0;
      for (let i = 0; i < 4; i++) if (this.fingers[i] > 0) mask |= 1 << i;
      const keyHand = cached(`khand|${clench ? 'c' : mask}|${phase}`, () => buildKeyHand(mask, clench, phase));
      const pr = this.click > 0 ? 1 : 0;
      const mouseHand = cached(`mhand|${pr}|${phase}`, () => buildMouseHand(pr, phase));
      // Celebrar: la mano del teclado salta; perder: respingo
      const lift = md.expr === 'star' || md.expr === 'happy' ? -2 : 0;
      g.drawImage(keyHand, kx - 21 + sx, ky - 14 + by + lift);
      // El reloj RÓLEZ (objeto clave): en la muñeca izquierda, brillando
      const run = SN.State.run;
      if (run && run.owned.reloj) {
        const wx = kx - 21 + sx + 17, wy = ky - 14 + by + lift + 31;
        SN.Px.line(g, wx - 3, wy - 2, wx + 4, wy + 2, P.yellowD, 2);
        SN.Px.rect(g, wx, wy - 1, 2, 2, P.yellowL);
        if (Math.sin(this.t * 3) > 0.7) SN.Px.rect(g, wx + 1, wy - 2, 1, 1, P.white);
      }
      g.drawImage(mouseHand, Math.round(mx + this.mouse.x) - 24 + sx, Math.round(my + this.mouse.y) - 13 + by);
    },

    drawCat(g, x, y, phase) {
      const c = this.cat;
      const breath = Math.sin(c.t * (c.state === 'purr' ? 3.2 : 1.6)) > 0 ? 1 : 0;
      // Sentado o despierto, los ojos siguen al ratón
      const look = c.state === 'sit' || c.state === 'awake' ? U.clamp(this.mouse.x / 8, -1, 1) : 0;
      const lk = Math.round(look);
      const img = cached(`cat|${c.state}|${breath}|${c.tail}|${phase}|${lk}`, () => buildCat(c.state, breath, c.tail, phase, lk));
      g.drawImage(img, x, y);
      const Px = SN.Px;
      // Zzz mientras duerme
      if (c.state === 'sleep' || c.state === 'ear') {
        const k = (c.t * 0.5) % 1;
        g.globalAlpha = Math.sin(k * Math.PI);
        Px.text(g, 'z', x + 56 + Math.round(k * 4), y + 8 - Math.round(k * 10), P.creamD);
        g.globalAlpha = 1;
      }
      // Efectos encima: corazones (ronronea), "prr", bufido, destellos dorados (día de la suerte)
      if (c.fxT > 0 && c.fx) {
        const k = 1 - c.fxT / 2.4, a = Math.min(1, c.fxT * 2);
        g.globalAlpha = a;
        if (c.fx === 'heart') {
          for (let i = 0; i < 2; i++) { const hy = y + 8 - Math.round(((k + i * 0.5) % 1) * 14); heart(g, x + 30 + i * 7, hy, P.coralL); }
        } else if (c.fx === 'prr') Px.text(g, 'prr', x + 26, y + 10 - Math.round(k * 6), P.creamL);
        else if (c.fx === 'hiss') Px.text(g, '¡fff!', x + 22 + (Math.sin(c.t * 40) > 0 ? 1 : 0), y + 4, P.coralL);
        else if (c.fx === 'gold') for (let i = 0; i < 4; i++) { const sx = x + 14 + ((i * 13 + Math.floor(c.t * 6)) % 40), sy = y + 4 + ((i * 7) % 18); Px.rect(g, sx, sy, 1, 3, P.yellowL); Px.rect(g, sx - 1, sy + 1, 3, 1, P.yellowL); }
        g.globalAlpha = 1;
      }
      // Alerta: un "!" sobre la cabeza
      if (c.state === 'alert') Px.text(g, '!', x + 30, y + 2 + (Math.sin(c.t * 8) > 0 ? 0 : 1), P.yellow);
    },

    // Primer plano para las cinemáticas (búfer de 160x90): cabeza y hombros centrados, a escala 1:1
    // (el búfer se amplía 4x en pantalla, así que se ve más cerca que en la partida)
    closeUp(g, expr, t, opts = {}) {
      const e = EXPR[expr] ? expr : 'worried';
      const blink = (t % 4) > 3.86;
      const head = cached('head|' + e + '|' + (blink ? 1 : 0) + '|evening', () => buildHead(e, blink, 'evening'));
      const body = cached('body|evening', () => buildBody('evening'));
      const bangs = cached('bangs|evening', () => buildBangs('evening'));
      const bob = Math.round(Math.sin(t * 2) * 1);
      const ox = 18, oy = -12 + bob;
      g.imageSmoothingEnabled = false;
      g.drawImage(body, ox, oy);
      g.drawImage(head, ox, oy);
      if (opts.fist) {
        const near = cached('near|fist|evening', () => buildNearArm('fist', 'evening'));
        const k = Math.round(Math.abs(Math.sin(t * 10)) * 4);
        g.drawImage(near, ox, oy - k);
      }
      g.drawImage(bangs, ox, oy);
      if (opts.question) {
        const qx = 112, qy = 10 + Math.round(Math.sin(t * 4));
        SN.Px.box(g, qx, qy, 11, 13, P.creamL, P.coal);
        SN.Px.text(g, '?', qx + 3, qy + 11, P.coralD);
      }
      // Gota de sudor si está preocupado
      if (e === 'nervous' || e === 'shock') {
        const sy = 30 + ((t * 10) % 8);
        g.fillStyle = P.cyan; g.fillRect(96, Math.round(sy), 2, 3);
        g.fillStyle = P.cyanL; g.fillRect(96, Math.round(sy), 1, 1);
      }
    },

    clearCache() { cache.clear(); },
  };

  void H;
})(window.SN);
