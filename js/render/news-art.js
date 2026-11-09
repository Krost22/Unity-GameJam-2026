// Fotos de periódico en pixel art para las noticias. Cada escena se dibuja por código (64x40) y después
// se "imprime" con trama de semitono a dos tintas: el negro del papel y el color de la noticia
// (verde buena, coral mala, naranja incierta). Las noticias extrañas salen grises, con interferencias...
// y con alguien al fondo que no debería estar ahí.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const W = 64, H = 40;

  // ---------- Piezas reutilizables ----------
  function sky(g, a, b) { R(g, 0, 0, W, H, a); R(g, 0, 0, W, 12, b); }
  function ground(g, y, c, top) { R(g, 0, y, W, H - y, c); if (top) R(g, 0, y, W, 1, top); }
  function bldg(g, x, y, w, h, body, win, step = 4) {
    R(g, x, y, w, h, body);
    R(g, x, y, 1, h, P.creamL);
    for (let wy = y + 3; wy < y + h - 3; wy += step) for (let wx = x + 2; wx < x + w - 2; wx += 4) R(g, wx, wy, 2, 2, win);
  }
  function person(g, x, y, body, head = P.skin) {
    R(g, x + 1, y, 3, 3, head);
    R(g, x, y + 3, 5, 5, body);
    R(g, x + 1, y + 8, 1, 3, P.coal); R(g, x + 3, y + 8, 1, 3, P.coal);
  }
  function crowd(g, y, n, cols) {
    for (let i = 0; i < n; i++) person(g, 2 + i * 7 + (i % 2), y + (i % 3), cols[i % cols.length]);
  }
  function skyline(g, base, body, win) {
    const hs = [16, 24, 12, 28, 18, 22, 14, 26, 20];
    hs.forEach((h, i) => bldg(g, i * 7 - 1, base - h, 7, h, body, win));
  }
  function paper(g, x, y, w, h) {
    R(g, x + 1, y + 1, w, h, P.coalL);
    R(g, x, y, w, h, P.creamL);
    for (let ly = y + 4; ly < y + h - 3; ly += 3) R(g, x + 3, ly, w - 6 - (ly % 7 === 0 ? 6 : 0), 1, P.creamD);
  }

  // Persona más grande (9x20): cabeza, cuerpo con brazos y piernas
  function guy(g, x, y, shirt, hair = P.coal, skin = P.skin) {
    Px.ellipse(g, x + 4, y + 3, 3, 3, skin); R(g, x + 1, y - 1, 7, 2, hair);
    R(g, x, y + 6, 9, 8, shirt); R(g, x - 1, y + 7, 2, 6, skin); R(g, x + 8, y + 7, 2, 6, skin);
    R(g, x + 1, y + 14, 3, 6, P.coal); R(g, x + 5, y + 14, 3, 6, P.coal);
  }
  // Donald Trompa (parodia): tupé amarillo, cara naranja, traje azul y una corbata roja larguísima
  function trompa(g, x, y) {
    R(g, x - 1, y + 9, 14, 13, P.navyD); R(g, x + 4, y + 9, 4, 2, P.creamL); R(g, x + 5, y + 10, 2, 13, P.coral);
    Px.ellipse(g, x + 6, y + 5, 4, 5, P.orange);
    R(g, x + 1, y - 1, 11, 3, P.yellow); R(g, x + 8, y, 5, 2, P.yellowL); R(g, x + 1, y + 1, 2, 4, P.yellow);
    R(g, x + 4, y + 4, 2, 1, P.coal); R(g, x + 8, y + 4, 2, 1, P.coal); R(g, x + 5, y + 7, 3, 2, P.coralD);
  }
  // Vladímir Patín (parodia): calvo, serio, traje gris... y siempre en patines
  function patin(g, x, y) {
    Px.ellipse(g, x + 5, y + 4, 4, 4, P.skin); R(g, x + 3, y + 1, 2, 1, P.creamL);
    R(g, x + 3, y + 4, 2, 1, P.coal); R(g, x + 6, y + 4, 2, 1, P.coal); R(g, x + 4, y + 7, 3, 1, P.skinD);
    R(g, x, y + 9, 11, 11, P.coalL); R(g, x + 5, y + 9, 1, 6, P.coal);
    R(g, x + 2, y + 20, 2, 4, P.coal); R(g, x + 7, y + 20, 2, 4, P.coal);
    R(g, x, y + 24, 6, 2, P.creamL); R(g, x + 6, y + 24, 6, 2, P.creamL); R(g, x, y + 26, 6, 1, P.cyanD); R(g, x + 6, y + 26, 6, 1, P.cyanD);
  }

  // ---------- Escenas ----------
  const SCENES = {
    vacuna(g) {
      R(g, 0, 0, W, H, P.cyanL); R(g, 0, 31, W, 9, P.creamM); R(g, 0, 31, W, 1, P.creamD);
      for (let x = 4; x < W; x += 12) R(g, x, 0, 1, 31, P.creamL);
      // vial
      R(g, 47, 13, 10, 18, P.coal); R(g, 48, 14, 8, 16, P.creamL); R(g, 48, 21, 8, 9, P.green); R(g, 46, 10, 12, 4, P.coralD);
      R(g, 49, 15, 1, 12, '#FFFFFF');
      // jeringuilla
      Px.line(g, 8, 26, 34, 13, P.coal, 7);
      Px.line(g, 9, 27, 34, 14, P.creamL, 5);
      Px.line(g, 22, 21, 34, 14, P.green, 5);
      Px.line(g, 1, 32, 9, 27, P.coal, 3);
      R(g, 0, 33, 4, 5, P.coal);
      Px.line(g, 40, 13, 52, 6, P.coalL);
      for (let i = 0; i < 4; i++) R(g, 13 + i * 5, 29 - i * 3, 1, 2, P.coal);
    },
    pastillas(g) {
      R(g, 0, 0, W, H, P.creamM); R(g, 0, 30, W, 10, P.cream);
      // cápsula grande
      Px.ellipse(g, 20, 19, 9, 9, P.coal); Px.ellipse(g, 42, 19, 9, 9, P.coal); R(g, 20, 10, 22, 19, P.coal);
      Px.ellipse(g, 20, 19, 8, 8, P.coral); R(g, 20, 11, 11, 17, P.coral);
      Px.ellipse(g, 42, 19, 8, 8, P.creamL); R(g, 31, 11, 11, 17, P.creamL);
      R(g, 31, 11, 1, 17, P.coal);
      R(g, 16, 13, 10, 2, P.coralL); R(g, 34, 13, 8, 2, '#FFFFFF');
      // pastillas sueltas
      for (const [x, y] of [[6, 33], [14, 35], [50, 33], [57, 36], [30, 35]]) { Px.ellipse(g, x, y, 3, 2, P.coal); Px.ellipse(g, x, y, 2, 1, P.creamL); }
    },
    hospital(g) {
      sky(g, P.cyanL, P.cyan);
      bldg(g, 14, 8, 36, 26, P.creamL, P.cyanD, 5);
      R(g, 26, 2, 12, 12, P.coal); R(g, 27, 3, 10, 10, P.creamL);
      R(g, 30, 4, 4, 8, P.green); R(g, 28, 6, 8, 4, P.green);
      R(g, 28, 26, 8, 8, P.coal); R(g, 29, 27, 6, 7, P.cyanD);
      ground(g, 34, P.coalL, P.coal);
      // ambulancia
      R(g, 44, 27, 18, 8, P.coal); R(g, 45, 28, 16, 6, P.creamL); R(g, 56, 28, 5, 3, P.cyanD); R(g, 48, 29, 4, 4, P.coral);
      R(g, 47, 35, 3, 3, P.coal); R(g, 56, 35, 3, 3, P.coal); R(g, 49, 26, 3, 1, P.coral);
    },
    microscopio(g) {
      R(g, 0, 0, W, H, P.creamL); R(g, 0, 33, W, 7, P.creamD);
      R(g, 16, 30, 30, 5, P.coal); R(g, 26, 14, 7, 17, P.coal); R(g, 20, 23, 24, 3, P.coal);
      Px.line(g, 27, 18, 39, 5, P.coal, 6); R(g, 37, 1, 10, 5, P.coal);
      R(g, 30, 27, 6, 3, P.yellow); R(g, 28, 16, 2, 9, P.coalL);
      for (const [x, y] of [[8, 10], [52, 18], [10, 24]]) { Px.ellipse(g, x, y, 3, 3, P.green); R(g, x - 1, y - 1, 1, 1, '#FFFFFF'); }
    },
    juzgado(g) {
      R(g, 0, 0, W, H, P.creamL);
      for (const x of [4, 16, 44, 56]) { R(g, x, 4, 5, 30, P.creamD); R(g, x - 1, 3, 7, 2, P.creamDD); }
      R(g, 0, 32, W, 8, P.woodD);
      // mazo: cabeza horizontal y mango en diagonal
      Px.line(g, 30, 16, 50, 31, P.coal, 4);
      R(g, 14, 6, 30, 12, P.coal); R(g, 15, 7, 28, 10, P.woodD); R(g, 15, 7, 28, 3, P.wood);
      R(g, 22, 6, 3, 12, P.coal); R(g, 33, 6, 3, 12, P.coal);
      R(g, 8, 26, 22, 6, P.coal); R(g, 9, 27, 20, 3, P.woodM);
      for (let i = 0; i < 3; i++) R(g, 4 + i * 5, 21 - i * 3, 2, 2, P.coal);
    },
    lupa(g) {
      R(g, 0, 0, W, H, P.creamM);
      paper(g, 6, 6, 26, 30); paper(g, 20, 3, 26, 30);
      Px.ellipse(g, 40, 18, 12, 12, P.coal); Px.ellipse(g, 40, 18, 10, 10, P.cyanL); Px.ellipse(g, 37, 15, 3, 3, '#FFFFFF');
      for (let ly = 12; ly < 26; ly += 3) R(g, 34, ly, 12, 1, P.coalL);
      Px.line(g, 48, 27, 58, 37, P.coal, 4);
    },
    documento(g) {
      R(g, 0, 0, W, H, P.coalL);
      paper(g, 12, 2, 40, 36);
      R(g, 16, 6, 20, 2, P.coal);
      Px.ellipse(g, 42, 28, 9, 7, P.coral); Px.ellipse(g, 42, 28, 7, 5, P.creamL); Px.text(g, '?', 40, 32, P.coral);
    },
    movil(g) {
      R(g, 0, 0, W, H, P.coalD);
      // foco que cae sobre el escenario
      for (let y = 0; y < 34; y++) { const w = 6 + y * 1.1; R(g, 32 - w / 2, y, w, 1, P.creamD); }
      R(g, 0, 33, W, 7, P.coal); Px.ellipse(g, 32, 34, 22, 3, P.creamM);
      R(g, 24, 4, 16, 28, P.coal); R(g, 26, 7, 12, 21, P.cyanL); R(g, 27, 8, 4, 10, '#FFFFFF'); R(g, 30, 29, 4, 1, P.coalL);
      for (const [x, y] of [[8, 8], [54, 10], [12, 22], [52, 24]]) { R(g, x, y - 1, 1, 3, P.yellowL); R(g, x - 1, y, 3, 1, P.yellowL); }
    },
    robot(g) {
      R(g, 0, 0, W, H, P.cyanL); R(g, 0, 30, W, 10, P.coalL);
      R(g, 31, 0, 2, 6, P.coal); R(g, 30, 0, 4, 2, P.coral);
      R(g, 20, 6, 24, 18, P.coal); R(g, 21, 7, 22, 16, P.creamD); R(g, 21, 7, 22, 3, P.creamL);
      R(g, 25, 12, 5, 5, P.coal); R(g, 34, 12, 5, 5, P.coal); R(g, 26, 13, 2, 2, P.yellow); R(g, 35, 13, 2, 2, P.yellow);
      for (let x = 26; x < 38; x += 3) R(g, x, 19, 2, 2, P.coal);
      // volante
      Px.ellipse(g, 32, 33, 14, 5, P.coal); Px.ellipse(g, 32, 33, 11, 3, P.coalL); R(g, 30, 30, 4, 6, P.coal);
    },
    candado(g) {
      R(g, 0, 0, W, H, P.coalD);
      for (let i = 0; i < 40; i++) R(g, (i * 23) % W, (i * 17) % H, 1, 2, i % 3 ? P.green : P.greenD);
      R(g, 20, 6, 4, 12, P.creamD); R(g, 20, 4, 16, 4, P.creamD); R(g, 34, 4, 4, 6, P.creamD);
      R(g, 16, 16, 30, 20, P.coal); R(g, 17, 17, 28, 18, P.yellowD); R(g, 17, 17, 28, 3, P.yellow);
      R(g, 29, 22, 4, 5, P.coal); R(g, 30, 26, 2, 5, P.coal);
    },
    alerta(g) {
      R(g, 0, 0, W, H, P.creamM); R(g, 0, 33, W, 7, P.woodM);
      R(g, 10, 2, 44, 30, P.coal); R(g, 12, 4, 40, 25, P.coalD); R(g, 28, 32, 8, 3, P.coal);
      for (let i = 0; i < 12; i++) R(g, 32 - i, 7 + i * 1.6, 1 + i * 2, 2, P.coral);
      R(g, 31, 12, 2, 7, P.coalD); R(g, 31, 21, 2, 2, P.coalD);
    },
    redes(g) {
      R(g, 0, 0, W, H, P.yellowL);
      R(g, 24, 8, 16, 28, P.coal); R(g, 25, 10, 14, 22, P.creamL);
      const bub = (x, y, w, c) => { R(g, x, y, w, 9, P.coal); R(g, x + 1, y + 1, w - 2, 7, c); R(g, x + 3, y + 9, 2, 2, P.coal); };
      bub(2, 4, 18, P.creamL); bub(44, 2, 16, P.coralL); bub(4, 22, 14, P.cyanL); bub(46, 20, 16, P.creamL);
      Px.text(g, '!!', 7, 11, P.coral); Px.text(g, '♥', 49, 9, P.coral); Px.text(g, '?', 9, 29, P.coalL); Px.text(g, '★', 51, 27, P.yellowD);
      R(g, 28, 14, 8, 1, P.coalL); R(g, 28, 18, 6, 1, P.coalL); R(g, 28, 22, 8, 1, P.coalL);
    },
    chip(g) {
      R(g, 0, 0, W, H, P.greenD);
      for (let i = 0; i < 9; i++) { R(g, 0, 4 + i * 4, W, 1, P.greenDD); }
      for (let i = 0; i < 6; i++) { R(g, 20 + i * 4, 4, 2, 6, P.yellowD); R(g, 20 + i * 4, 30, 2, 6, P.yellowD); }
      R(g, 16, 9, 32, 22, P.coal); R(g, 18, 11, 28, 18, P.coalL); R(g, 20, 13, 10, 3, P.creamD);
      Px.ellipse(g, 42, 25, 2, 2, P.coal);
    },
    compras(g) {
      sky(g, P.cyanL, P.cyan);
      R(g, 4, 6, 56, 24, P.orange); R(g, 4, 6, 56, 3, P.orangeD);
      for (let x = 4; x < 60; x += 8) R(g, x, 9, 4, 4, x % 16 ? P.creamL : P.coral);
      R(g, 10, 15, 20, 15, P.cyanL); R(g, 36, 15, 10, 15, P.coal);
      ground(g, 30, P.creamD, P.coalL);
      crowd(g, 25, 8, [P.coral, P.green, P.cyanD, P.yellowD]);
      R(g, 6, 31, 3, 4, P.yellow); R(g, 27, 32, 3, 4, P.coral); R(g, 48, 31, 3, 4, P.green);
    },
    rebajas(g) {
      R(g, 0, 0, W, H, P.coralD);
      R(g, 6, 4, 52, 28, P.coal); R(g, 8, 6, 48, 24, P.creamL);
      Px.text(g, '-50%', 32, 25, P.coal, { size: 16, align: 'center' });
      R(g, 10, 8, 8, 4, P.yellow); R(g, 46, 8, 8, 4, P.yellow);
      ground(g, 32, P.coal);
      for (let i = 0; i < 6; i++) person(g, 4 + i * 10, 28, [P.cyan, P.green, P.yellow][i % 3]);
    },
    camion(g) {
      sky(g, P.creamL, P.cyanL);
      ground(g, 30, P.coalL, P.coal);
      for (let x = 0; x < W; x += 8) R(g, x, 34, 4, 1, P.yellow);
      R(g, 6, 12, 32, 18, P.coal); R(g, 7, 13, 30, 15, P.creamD);
      R(g, 38, 18, 14, 12, P.coal); R(g, 39, 19, 12, 9, P.coral); R(g, 44, 20, 6, 4, P.cyanL);
      for (const x of [10, 30, 44]) { Px.ellipse(g, x, 30, 3, 3, P.coal); R(g, x, 30, 1, 1, P.creamD); }
      Px.text(g, '?', 54, 14, P.coalL);
    },
    persiana(g) {
      R(g, 0, 0, W, H, P.wallD);
      R(g, 6, 2, 52, 6, P.coral); R(g, 6, 8, 52, 2, P.coralD);
      R(g, 8, 10, 48, 24, P.coalL);
      for (let y = 11; y < 34; y += 2) R(g, 9, y, 46, 1, P.creamDD);
      R(g, 22, 18, 20, 8, P.creamL); R(g, 23, 19, 18, 6, P.coral);
      Px.text(g, 'X', 29, 25, P.creamL);
      ground(g, 34, P.creamD, P.coalL);
    },
    impuestos(g) {
      R(g, 0, 0, W, H, P.woodM);
      paper(g, 4, 3, 30, 34);
      R(g, 8, 7, 14, 2, P.coal);
      for (let i = 0; i < 4; i++) { R(g, 40, 30 - i * 4, 12, 4, P.coal); R(g, 41, 30 - i * 4, 10, 3, P.yellow); }
      R(g, 50, 6, 12, 18, P.coal); R(g, 51, 7, 10, 5, P.greenL);
      for (let y = 14; y < 23; y += 3) for (let x = 51; x < 60; x += 3) R(g, x, y, 2, 2, P.creamD);
    },
    feria(g) {
      sky(g, P.orangeL, P.orange);
      const cx = 22, cy = 17;
      Px.circleOutline(g, cx, cy, 14, P.coal); Px.circleOutline(g, cx, cy, 13, P.coal);
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; Px.line(g, cx, cy, cx + Math.cos(ang) * 13, cy + Math.sin(ang) * 13, P.coalL); R(g, cx + Math.cos(ang) * 14 - 2, cy + Math.sin(ang) * 14 - 1, 4, 3, [P.coral, P.cyan, P.yellow, P.green][a % 4]); }
      Px.line(g, cx, cy, cx - 8, 36, P.coal, 2); Px.line(g, cx, cy, cx + 8, 36, P.coal, 2);
      for (let i = 0; i < 3; i++) { R(g, 40 + i * 8, 24, 7, 12, P.creamL); R(g, 40 + i * 8, 22, 7, 3, [P.coral, P.green, P.cyan][i]); }
      for (let x = 0; x < W; x += 4) R(g, x, 2 + (x % 8 ? 1 : 0), 2, 2, x % 8 ? P.yellow : P.coral);
      ground(g, 36, P.coalL);
    },
    mina(g) {
      R(g, 0, 0, W, H, P.orangeDD);
      for (let i = 0; i < 30; i++) R(g, (i * 29) % W, (i * 13) % 30, 3, 2, P.orangeD);
      Px.ellipse(g, 32, 30, 18, 20, P.coalDD); R(g, 14, 30, 36, 10, P.coalDD);
      R(g, 12, 10, 4, 30, P.woodD); R(g, 48, 10, 4, 30, P.woodD); R(g, 12, 9, 40, 4, P.wood);
      Px.line(g, 24, 39, 30, 28, P.creamDD); Px.line(g, 40, 39, 34, 28, P.creamDD);
      for (const [x, y] of [[4, 34], [56, 31], [8, 26], [58, 22]]) { R(g, x, y, 3, 3, P.yellow); R(g, x, y, 1, 1, P.yellowL); }
    },
    fabrica(g) {
      sky(g, P.creamD, P.creamDD);
      for (const [x, h] of [[12, 30], [22, 26]]) { R(g, x, 40 - h, 5, h, P.coal); R(g, x, 40 - h, 5, 2, P.coral); }
      for (let i = 0; i < 6; i++) Px.ellipse(g, 15 + i * 6, 6 - (i % 2) * 2, 4 + i, 3, P.creamL);
      R(g, 30, 18, 32, 22, P.coal);
      for (let x = 30; x < 62; x += 8) { R(g, x, 14, 8, 4, P.coal); }
      for (let x = 33; x < 60; x += 6) R(g, x, 24, 3, 3, P.yellow);
      ground(g, 37, P.coalL);
    },
    rio(g) {
      sky(g, P.creamL, P.creamM);
      ground(g, 16, P.greenD);
      for (let y = 22; y < 36; y++) R(g, 0, y, W, 1, (y % 3) ? P.cyan : P.green);
      for (let i = 0; i < 9; i++) R(g, (i * 13) % 60, 24 + (i % 4) * 3, 6, 1, P.coral);
      for (const x of [8, 50]) { R(g, x, 4, 2, 14, P.coal); Px.line(g, x, 8, x - 5, 3, P.coal); Px.line(g, x + 1, 10, x + 6, 5, P.coal); }
    },
    vagoneta(g) {
      R(g, 0, 0, W, H, P.coalM);
      Px.line(g, 0, 34, 63, 34, P.creamDD); Px.line(g, 0, 37, 63, 37, P.creamDD);
      for (let x = 2; x < W; x += 6) R(g, x, 33, 2, 6, P.woodD);
      R(g, 14, 16, 36, 14, P.coal); R(g, 15, 17, 34, 12, P.orangeD); R(g, 15, 17, 34, 2, P.orange);
      for (let i = 0; i < 7; i++) Px.ellipse(g, 18 + i * 5, 15, 3, 3, i % 2 ? P.yellow : P.creamDD);
      Px.ellipse(g, 20, 31, 3, 3, P.coal); Px.ellipse(g, 44, 31, 3, 3, P.coal);
    },
    grietas(g) {
      R(g, 0, 0, W, H, P.coalL);
      Px.ellipse(g, 32, 26, 22, 22, P.coalDD); R(g, 10, 26, 44, 14, P.coalDD);
      Px.line(g, 6, 2, 14, 12, P.coalDD); Px.line(g, 14, 12, 10, 20, P.coalDD); Px.line(g, 50, 0, 46, 8, P.coalDD); Px.line(g, 46, 8, 56, 16, P.coalDD);
      for (let i = 0; i < 16; i++) R(g, 20 + (i * 7) % 26, 10 + (i * 5) % 26, 1, 1, P.creamD);
      R(g, 30, 30, 4, 2, P.yellow);
    },
    huelga(g) {
      sky(g, P.creamM, P.creamD);
      ground(g, 30, P.coalL);
      for (let i = 0; i < 5; i++) {
        const x = 3 + i * 12;
        R(g, x + 2, 4 + (i % 2) * 3, 1, 12, P.woodD);
        R(g, x - 3, 2 + (i % 2) * 3, 11, 8, P.creamL); R(g, x - 2, 4 + (i % 2) * 3, 9, 2, P.coral);
        person(g, x, 18, P.coalM); R(g, x, 17, 5, 2, P.yellow);
      }
    },
    ciudad(g) {
      sky(g, P.cyanL, P.creamL);
      skyline(g, 36, P.creamDD, P.creamM);
      ground(g, 36, P.coalL);
    },
    apagon(g) {
      R(g, 0, 0, W, H, P.coalD);
      Px.ellipse(g, 52, 7, 3, 3, P.cream);
      skyline(g, 38, P.coal, P.coalM);
      for (const [x, y] of [[9, 20], [24, 14], [45, 22]]) R(g, x, y, 2, 2, P.yellow);
      ground(g, 38, P.coalDD);
    },
    farolas(g) {
      R(g, 0, 0, W, H, P.coalD);
      ground(g, 33, P.coalM, P.coalL);
      for (let i = 0; i < 4; i++) {
        const x = 6 + i * 16, on = i === 0;
        R(g, x, 8, 2, 25, P.coal); R(g, x - 2, 6, 7, 3, P.coal); R(g, x - 1, 9, 5, 2, on ? P.yellow : P.coalL);
        if (on) Px.ellipse(g, x + 1, 34, 8, 2, 'rgba(255,212,71,0.4)');
      }
    },
    semaforo(g) {
      sky(g, P.creamD, P.creamM);
      R(g, 30, 14, 3, 26, P.coal);
      R(g, 24, 2, 15, 30, P.coal); for (let i = 0; i < 3; i++) Px.ellipse(g, 31, 8 + i * 9, 4, 4, P.coalL);
      ground(g, 36, P.coalL);
      for (let x = 0; x < W; x += 10) R(g, x, 38, 6, 1, P.creamL);
    },
    columpio(g) {
      sky(g, P.orangeL, P.orange);
      ground(g, 33, P.greenD, P.green);
      R(g, 10, 6, 44, 3, P.coal); Px.line(g, 12, 8, 6, 34, P.coal, 2); Px.line(g, 52, 8, 58, 34, P.coal, 2);
      R(g, 21, 9, 1, 18, P.coalL); R(g, 29, 9, 1, 18, P.coalL); R(g, 19, 27, 13, 2, P.woodD);
      R(g, 39, 9, 1, 8, P.coalL); R(g, 45, 9, 1, 8, P.coalL);
    },
    dibujo(g) {
      R(g, 0, 0, W, H, P.creamL);
      R(g, 0, 32, W, 8, P.green); Px.ellipse(g, 54, 7, 5, 5, P.yellow);
      // casa y niño en cera
      R(g, 6, 20, 14, 12, P.coral); Px.line(g, 5, 20, 13, 13, P.coralD); Px.line(g, 13, 13, 21, 20, P.coralD);
      Px.ellipse(g, 26, 22, 2, 2, P.coalL); Px.line(g, 26, 24, 26, 30, P.coalL); Px.line(g, 23, 27, 29, 27, P.coalL);
      // el encapuchado
      Px.ellipse(g, 42, 20, 7, 9, P.coal); R(g, 35, 22, 15, 12, P.coal);
      R(g, 39, 18, 2, 2, P.yellow); R(g, 44, 18, 2, 2, P.yellow);
    },
    cartel(g) {
      R(g, 0, 0, W, H, P.wallD);
      for (let y = 4; y < H; y += 6) R(g, 0, y, W, 1, P.wallM);
      R(g, 18, 2, 28, 36, P.creamL); R(g, 19, 3, 26, 5, P.coal);
      R(g, 24, 10, 16, 16, P.creamD); Px.ellipse(g, 32, 16, 4, 4, P.coalL); R(g, 27, 21, 10, 5, P.coalL);
      R(g, 22, 29, 20, 2, P.coal); R(g, 24, 33, 16, 1, P.creamDD);
    },
    sello(g) {
      R(g, 0, 0, W, H, P.creamM);
      paper(g, 10, 3, 44, 34);
      Px.ellipse(g, 32, 21, 19, 10, P.coal); Px.ellipse(g, 32, 21, 17, 8, '#FFFFFF');
      Px.ellipse(g, 32, 21, 15, 6, P.coal); Px.ellipse(g, 32, 21, 14, 5, '#FFFFFF');
      Px.text(g, 'PAGADO', 32, 25, P.coal, { align: 'center' });
    },
    dinero(g) {
      R(g, 0, 0, W, H, P.greenL);
      for (let i = 0; i < 5; i++) { R(g, 4 + i * 2, 30 - i * 4, 26, 6, P.coal); R(g, 5 + i * 2, 31 - i * 4, 24, 4, P.green); Px.ellipse(g, 17 + i * 2, 33 - i * 4, 2, 1, P.greenD); }
      Px.line(g, 36, 32, 46, 22, P.coal, 2); Px.line(g, 46, 22, 50, 26, P.coal, 2); Px.line(g, 50, 26, 60, 8, P.coal, 2);
      R(g, 55, 6, 7, 2, P.coal); R(g, 60, 6, 2, 7, P.coal);
      for (const [x, y] of [[40, 8], [34, 14]]) { Px.ellipse(g, x, y, 4, 4, P.coal); Px.ellipse(g, x, y, 3, 3, P.yellow); }
    },
    bici(g) {
      R(g, 0, 0, W, H, P.creamD); ground(g, 32, P.coalL);
      for (let x = 4; x < W; x += 10) R(g, x, 4, 6, 3, P.coalL);
      Px.circleOutline(g, 18, 24, 8, P.coal); Px.circleOutline(g, 44, 24, 8, P.coal);
      Px.line(g, 18, 24, 28, 14, P.coralD, 2); Px.line(g, 28, 14, 44, 24, P.coralD, 2); Px.line(g, 28, 14, 31, 24, P.coralD, 2); Px.line(g, 31, 24, 18, 24, P.coralD, 2);
      R(g, 25, 11, 6, 2, P.coal); R(g, 40, 12, 4, 2, P.coal);
    },
    letrero(g) {
      sky(g, P.cyanL, P.creamL);
      skyline(g, 38, P.creamD, P.creamM);
      R(g, 30, 10, 3, 30, P.coal); R(g, 14, 6, 36, 10, P.coal); R(g, 15, 7, 34, 8, P.green);
      Px.text(g, '???', 32, 14, P.creamL, { align: 'center' });
    },
    // ---------- 1.5: memes y suerte ----------
    // Un señor trajeado delante de una flecha que sube ("stonks")
    stonks(g) {
      R(g, 0, 0, W, H, P.cyanDD); for (let y = 2; y < H; y += 5) R(g, 0, y, W, 1, P.cyanD);
      Px.line(g, 4, 34, 22, 22, P.green, 3); Px.line(g, 22, 22, 30, 27, P.green, 3); Px.line(g, 30, 27, 54, 6, P.green, 3);
      R(g, 50, 4, 9, 3, P.green); R(g, 56, 4, 3, 9, P.green);
      Px.ellipse(g, 22, 15, 5, 6, P.skin); R(g, 18, 12, 9, 2, P.coal);
      R(g, 13, 21, 18, 19, P.coal); R(g, 20, 21, 4, 8, P.creamL); R(g, 21, 22, 2, 7, P.coral);
      R(g, 20, 15, 1, 1, P.coal); R(g, 24, 15, 1, 1, P.coal); R(g, 21, 18, 3, 1, P.skinD);
    },
    // Un perro tomando café en una habitación en llamas: "todo está bien"
    perrollamas(g) {
      R(g, 0, 0, W, H, P.orangeD);
      for (let x = 0; x < W; x += 6) { const h = 10 + ((x * 7) % 13); R(g, x, H - h - 8, 4, h, P.orange); R(g, x + 1, H - h - 4, 2, h - 6, P.yellow); }
      R(g, 0, 32, W, 8, P.woodD); R(g, 26, 26, 22, 3, P.wood); R(g, 28, 29, 2, 6, P.woodD); R(g, 44, 29, 2, 6, P.woodD);
      Px.ellipse(g, 20, 20, 7, 7, P.yellowD); Px.ellipse(g, 20, 12, 6, 5, P.yellowD);
      R(g, 13, 8, 3, 6, P.woodD); R(g, 24, 8, 3, 6, P.woodD);
      R(g, 17, 11, 1, 1, P.coal); R(g, 22, 11, 1, 1, P.coal); R(g, 19, 14, 2, 1, P.coal);
      R(g, 34, 22, 5, 4, P.creamL); R(g, 39, 23, 2, 2, P.creamL); Px.line(g, 36, 21, 37, 17, P.creamD);
    },
    // Dos botones y una mano que suda: SUBIRÁ o BAJARÁ
    botones(g) {
      R(g, 0, 0, W, H, P.creamM); R(g, 0, 28, W, 12, P.coalL);
      R(g, 8, 18, 18, 10, P.coal); R(g, 9, 19, 16, 7, P.green); R(g, 38, 18, 18, 10, P.coal); R(g, 39, 19, 16, 7, P.coral);
      Px.text(g, '▲', 13, 26, P.greenDD); Px.text(g, '▼', 43, 26, P.coralDD);
      Px.ellipse(g, 32, 8, 6, 5, P.skin); R(g, 29, 12, 6, 6, P.skin);
      for (const [x, y] of [[24, 4], [40, 6], [27, 13], [37, 14]]) { R(g, x, y, 1, 2, P.cyan); R(g, x, y + 2, 1, 1, P.cyanL); }
    },
    // Un cohete camino de la luna: "¡a la luna!"
    luna(g) {
      R(g, 0, 0, W, H, P.navyD);
      for (let i = 0; i < 26; i++) R(g, (i * 29) % W, (i * 13) % H, 1, 1, P.creamL);
      Px.ellipse(g, 50, 9, 8, 8, P.creamL); Px.ellipse(g, 47, 7, 2, 2, P.creamD); Px.ellipse(g, 53, 12, 2, 1, P.creamD);
      Px.line(g, 10, 36, 30, 16, P.coal, 6); Px.line(g, 11, 35, 30, 16, P.creamL, 4);
      R(g, 28, 15, 4, 4, P.coral); R(g, 7, 32, 5, 6, P.orange); R(g, 5, 36, 3, 3, P.yellow);
      Px.ellipse(g, 20, 26, 2, 2, P.cyanD);
    },
    // Cuatro bailarines con un ataúd a hombros
    ataud(g) {
      R(g, 0, 0, W, H, P.creamD); ground(g, 33, P.coalL);
      R(g, 6, 12, 52, 7, P.coal); R(g, 7, 13, 50, 5, P.woodD); R(g, 7, 13, 50, 1, P.wood);
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 13, up = i % 2;
        R(g, x + 1, 20 - up, 4, 4, P.skinD); R(g, x, 24 - up, 6, 6, P.coal); R(g, x + 1, 18 - up, 4, 2, P.coal);
        R(g, x + 1, 30 - up, 1, 3 + up, P.coal); R(g, x + 4, 30 - up, 1, 3 + up, P.coal);
      }
    },
    // Lluvia de oro: monedas cayendo sobre la ciudad
    oro(g) {
      sky(g, P.yellowL, P.yellow);
      skyline(g, 38, P.yellowDD, P.yellowL);
      for (let i = 0; i < 16; i++) {
        const x = (i * 17) % (W - 4) + 2, y = (i * 11) % 26 + 2;
        Px.ellipse(g, x, y, 2, 2, P.coal); Px.ellipse(g, x, y, 1, 1, P.yellow);
      }
    },
    // Trébol de cuatro hojas
    trebol(g) {
      R(g, 0, 0, W, H, P.greenL); for (let x = 0; x < W; x += 3) R(g, x, 32 + (x % 2), 1, 8, P.greenD);
      for (const [x, y] of [[26, 12], [38, 12], [26, 23], [38, 23]]) { Px.ellipse(g, x, y, 6, 6, P.coal); Px.ellipse(g, x, y, 5, 5, P.green); R(g, x - 2, y - 2, 2, 2, P.greenL); }
      Px.line(g, 32, 18, 42, 38, P.coal, 3); Px.line(g, 32, 18, 42, 38, P.greenD, 1);
      Px.ellipse(g, 32, 18, 2, 2, P.greenDD);
    },
    // ---------- 1.6: una foto propia por noticia (que se entienda qué pasa solo con mirarla) ----------
    // Dos laboratorios tirando de la misma pastilla delante del juez
    patente(g) {
      R(g, 0, 0, W, H, P.creamL); for (const x of [2, 56]) { R(g, x, 2, 6, 30, P.creamD); R(g, x - 1, 1, 8, 2, P.creamDD); }
      R(g, 0, 32, W, 8, P.woodD);
      guy(g, 8, 12, P.cyanD); guy(g, 47, 12, P.coralD);
      Px.line(g, 17, 20, 22, 18, P.skin, 2); Px.line(g, 47, 20, 42, 18, P.skin, 2);
      Px.ellipse(g, 26, 18, 5, 5, P.coal); Px.ellipse(g, 38, 18, 5, 5, P.coal); R(g, 26, 13, 12, 11, P.coal);
      Px.ellipse(g, 26, 18, 4, 4, P.coral); R(g, 26, 14, 6, 9, P.coral); Px.ellipse(g, 38, 18, 4, 4, P.creamL); R(g, 32, 14, 6, 9, P.creamL);
      R(g, 31, 14, 1, 9, P.coal); R(g, 30, 4, 4, 6, P.coal); R(g, 28, 3, 8, 3, P.woodD);
    },
    // Una ambulancia a toda velocidad, con la sirena puesta
    ambulancia(g) {
      R(g, 0, 0, W, H, P.navyD); skyline(g, 30, P.coal, P.coalM); ground(g, 30, P.coalL, P.coal);
      for (const y of [16, 21, 26]) R(g, 0, y, 8, 1, P.creamD);
      R(g, 10, 13, 44, 18, P.coal); R(g, 11, 14, 42, 15, P.creamL); R(g, 42, 16, 10, 6, P.cyanL);
      R(g, 22, 17, 10, 3, P.coral); R(g, 25, 14, 4, 9, P.coral);
      R(g, 22, 10, 8, 3, P.coal); R(g, 23, 10, 3, 2, P.coral); R(g, 26, 10, 3, 2, P.cyan);
      Px.line(g, 18, 9, 14, 4, P.coral); Px.line(g, 34, 9, 38, 4, P.cyan);
      for (const x of [18, 46]) { Px.ellipse(g, x, 31, 4, 4, P.coal); Px.ellipse(g, x, 31, 1, 1, P.creamD); }
    },
    // Un virus verde con ojos... y nadie sabe si es de verdad
    virus(g) {
      R(g, 0, 0, W, H, P.creamM); skyline(g, 40, P.creamD, P.creamM);
      for (let a = 0; a < 10; a++) { const ang = a * Math.PI / 5; Px.line(g, 30, 20, 30 + Math.cos(ang) * 15, 20 + Math.sin(ang) * 15, P.coal, 2); Px.ellipse(g, 30 + Math.cos(ang) * 15, 20 + Math.sin(ang) * 15, 2, 2, P.greenD); }
      Px.ellipse(g, 30, 20, 11, 11, P.coal); Px.ellipse(g, 30, 20, 10, 10, P.green); Px.ellipse(g, 27, 17, 3, 3, P.greenL);
      R(g, 25, 18, 3, 4, P.creamL); R(g, 32, 18, 3, 4, P.creamL); R(g, 26, 20, 2, 2, P.coal); R(g, 33, 20, 2, 2, P.coal);
      Px.text(g, '?', 50, 14, P.coralD, { size: 16 });
    },
    // Una caja de farmacia de la que sale césped
    cesped(g) {
      R(g, 0, 0, W, H, P.cyanL); R(g, 0, 32, W, 8, P.creamD);
      R(g, 18, 14, 28, 20, P.coal); R(g, 19, 15, 26, 18, P.creamL); R(g, 29, 18, 6, 12, P.green); R(g, 26, 21, 12, 6, P.green);
      for (let x = 17; x < 48; x += 2) { const h = 4 + ((x * 7) % 6); R(g, x, 14 - h, 1, h, P.greenD); R(g, x + 1, 15 - h + 1, 1, h - 1, P.green); }
      guy(g, 50, 12, P.creamL); R(g, 52, 18, 5, 4, P.cyanD);
    },
    // La sopa de pollo, con corona de reina
    sopa(g) {
      R(g, 0, 0, W, H, P.orangeL); R(g, 0, 30, W, 10, P.woodM);
      Px.ellipse(g, 32, 26, 20, 9, P.coal); Px.ellipse(g, 32, 25, 19, 7, P.creamL); Px.ellipse(g, 32, 23, 16, 4, P.yellow);
      R(g, 13, 23, 38, 4, P.creamL); Px.ellipse(g, 26, 22, 3, 1, P.orange); Px.ellipse(g, 37, 23, 2, 1, P.green);
      for (const x of [24, 32, 40]) { Px.line(g, x, 16, x - 2, 11, P.creamD); Px.line(g, x - 2, 11, x, 6, P.creamD); }
      R(g, 23, 2, 18, 4, P.yellowD); for (const x of [23, 30, 37]) R(g, x, 0, 4, 3, P.yellowD); R(g, 31, 3, 2, 1, P.coral);
      Px.line(g, 46, 20, 58, 10, P.coalL, 2);
    },
    // Un influencer con su aro de luz y una botella brillante de "agua del futuro"
    influencer(g) {
      R(g, 0, 0, W, H, P.coralL);
      Px.circleOutline(g, 22, 16, 14, P.creamL); Px.circleOutline(g, 22, 16, 13, P.creamL);
      guy(g, 17, 10, P.coral, P.yellowD);
      Px.line(g, 26, 18, 32, 8, P.coal, 1); R(g, 31, 5, 4, 6, P.coal);
      R(g, 44, 10, 8, 22, P.coal); R(g, 45, 12, 6, 19, P.cyanL); R(g, 46, 8, 4, 3, P.coal); R(g, 46, 14, 2, 10, P.creamL);
      for (const [x, y] of [[40, 8], [56, 12], [54, 26], [40, 30]]) { R(g, x, y - 1, 1, 3, P.yellow); R(g, x - 1, y, 3, 1, P.yellow); }
    },
    // Patín, en patines, en la consulta; el médico suda
    chequeo(g) {
      R(g, 0, 0, W, H, P.cyanL); R(g, 0, 32, W, 8, P.creamD);
      R(g, 4, 4, 12, 12, P.creamL); R(g, 8, 6, 4, 8, P.green); R(g, 6, 8, 8, 4, P.green);
      patin(g, 14, 7);
      guy(g, 44, 10, P.creamL); R(g, 46, 16, 5, 1, P.cyanD); Px.line(g, 48, 18, 40, 22, P.coal); Px.ellipse(g, 39, 23, 2, 2, P.coalL);
      for (const [x, y] of [[42, 8], [55, 10], [56, 14]]) { R(g, x, y, 1, 2, P.cyan); R(g, x, y + 2, 1, 1, P.cyanD); }
    },
    // Un dron con un paquete colgando sobre la ciudad
    dron(g) {
      sky(g, P.cyanL, P.creamL); skyline(g, 40, P.creamD, P.creamM);
      R(g, 22, 10, 20, 5, P.coal); R(g, 23, 11, 18, 3, P.coalL);
      for (const x of [16, 44]) { R(g, x, 7, 6, 1, P.coal); R(g, x + 2, 8, 2, 3, P.coal); Px.line(g, x + 3, 11, 31, 13, P.coal); }
      Px.line(g, 28, 15, 28, 22, P.coal); Px.line(g, 36, 15, 36, 22, P.coal);
      R(g, 25, 22, 14, 10, P.coal); R(g, 26, 23, 12, 8, P.orange); R(g, 31, 23, 2, 8, P.orangeD);
      for (const y of [18, 22]) R(g, 4, y, 8, 1, P.creamD);
    },
    // La tecla F, enorme, y un dedo a punto de pulsarla
    teclaf(g) {
      R(g, 0, 0, W, H, P.coalM);
      R(g, 14, 12, 36, 26, P.coal); R(g, 16, 13, 32, 22, P.creamD); R(g, 18, 14, 28, 18, P.creamL);
      Px.text(g, 'F', 32, 30, P.coal, { size: 16, align: 'center' });
      R(g, 28, 0, 8, 9, P.skin); R(g, 29, 0, 6, 8, P.skin); R(g, 29, 7, 6, 2, P.skinD); R(g, 30, 8, 4, 2, P.creamL);
      for (const [x, y] of [[8, 6], [56, 8]]) { R(g, x, y, 2, 1, P.coralL); R(g, x, y + 3, 1, 1, P.coralL); }
    },
    // Un robot con un megáfono: "¡SE VIENE!"
    seviene(g) {
      R(g, 0, 0, W, H, P.yellowL); R(g, 0, 32, W, 8, P.coalL);
      R(g, 8, 10, 20, 16, P.coal); R(g, 9, 11, 18, 14, P.creamD); R(g, 12, 15, 4, 4, P.coal); R(g, 20, 15, 4, 4, P.coal); R(g, 13, 16, 2, 2, P.yellow); R(g, 21, 16, 2, 2, P.yellow);
      R(g, 17, 6, 2, 4, P.coal); R(g, 16, 4, 4, 2, P.coral); R(g, 10, 26, 16, 6, P.coal);
      R(g, 28, 16, 6, 5, P.coal); Px.line(g, 34, 18, 44, 12, P.coal, 2); Px.line(g, 34, 18, 44, 24, P.coal, 2); R(g, 44, 12, 2, 13, P.coal);
      for (const [x1, y1, x2, y2] of [[48, 10, 54, 6], [48, 18, 56, 18], [48, 26, 54, 30]]) Px.line(g, x1, y1, x2, y2, P.coral);
      Px.text(g, '!', 58, 22, P.coralD, { size: 16 });
    },
    // Donald Trompa grita "¡COMPREN!" con el móvil en la mano
    trompa(g) {
      R(g, 0, 0, W, H, P.cyanL); for (let y = 30; y < H; y += 3) R(g, 0, y, W, 1, P.cyan);
      R(g, 0, 33, W, 7, P.navyD);
      trompa(g, 4, 10);
      R(g, 18, 18, 4, 6, P.coal); R(g, 19, 19, 2, 4, P.cyanL);
      R(g, 20, 2, 44, 13, P.coal); R(g, 21, 3, 42, 11, P.creamL); Px.line(g, 24, 15, 21, 19, P.coal);
      Px.text(g, '¡COMPREN!', 42, 12, P.coralD, { align: 'center' });
    },
    // Estanterías vacías: solo queda una lata
    estanteria(g) {
      R(g, 0, 0, W, H, P.creamM);
      R(g, 6, 2, 52, 36, P.coal); R(g, 8, 4, 48, 32, P.creamL);
      for (const y of [13, 24, 35]) { R(g, 7, y, 50, 2, P.woodD); for (let x = 12; x < 56; x += 12) R(g, x, y + 2, 4, 2, P.coralL); }
      R(g, 40, 17, 6, 7, P.coal); R(g, 41, 18, 4, 5, P.coral); R(g, 41, 20, 4, 1, P.creamL);
      Px.line(g, 14, 30, 18, 33, P.creamDD); Px.line(g, 28, 7, 31, 11, P.creamDD);
    },
    // Tres simios con el puño en alto delante de una tienda de videojuegos
    simios(g) {
      sky(g, P.orangeL, P.orange);
      R(g, 6, 4, 52, 16, P.coal); R(g, 7, 5, 50, 14, P.violet); R(g, 10, 7, 44, 4, P.yellow);
      R(g, 25, 12, 14, 6, P.coal); R(g, 27, 13, 3, 3, P.creamL); R(g, 34, 13, 4, 2, P.coral);
      ground(g, 34, P.coalL);
      for (let i = 0; i < 3; i++) {
        const x = 6 + i * 20;
        Px.ellipse(g, x + 6, 28, 7, 7, P.coal); Px.ellipse(g, x + 6, 20, 5, 5, P.coal); Px.ellipse(g, x + 6, 22, 3, 2, P.coalL);
        R(g, x + 4, 19, 1, 1, P.creamL); R(g, x + 8, 19, 1, 1, P.creamL);
        R(g, x + 12, 14 + (i % 2) * 2, 3, 9, P.coal); R(g, x + 11, 12 + (i % 2) * 2, 5, 3, P.coal);
      }
    },
    // Una hamburguesa con una banderita: la flecha de la bolsa
    hamburguesa(g) {
      R(g, 0, 0, W, H, P.coralL); R(g, 0, 32, W, 8, P.woodM);
      Px.ellipse(g, 32, 16, 18, 9, P.coal); Px.ellipse(g, 32, 16, 17, 8, P.orange); R(g, 15, 16, 34, 4, P.orange);
      for (const [x, y] of [[26, 11], [34, 10], [40, 13], [30, 14]]) R(g, x, y, 2, 1, P.creamL);
      R(g, 14, 20, 36, 3, P.green); R(g, 15, 23, 34, 3, P.coralD); R(g, 15, 26, 34, 3, P.yellow);
      Px.ellipse(g, 32, 30, 17, 3, P.coal); R(g, 15, 29, 34, 3, P.orange);
      R(g, 32, 1, 1, 10, P.coal); R(g, 33, 1, 12, 7, P.creamL); Px.line(g, 35, 6, 39, 3, P.green); Px.line(g, 39, 3, 43, 5, P.green);
    },
    // Dos tiendas: la de siempre, triste; la de enfrente, con globos. Y la gente cruza
    distraido(g) {
      sky(g, P.creamL, P.creamM); ground(g, 32, P.creamD, P.coalL);
      R(g, 2, 8, 22, 24, P.coal); R(g, 3, 9, 20, 22, P.creamDD); R(g, 6, 18, 14, 13, P.coalL);
      R(g, 9, 12, 2, 2, P.coal); R(g, 14, 12, 2, 2, P.coal); Px.line(g, 9, 16, 15, 16, P.coal);
      R(g, 40, 8, 22, 24, P.coal); R(g, 41, 9, 20, 22, P.coralL); R(g, 44, 18, 14, 13, P.cyanL);
      for (const [x, c] of [[42, P.coral], [50, P.yellow], [58, P.green]]) { Px.ellipse(g, x, 3, 3, 3, c); Px.line(g, x, 6, x, 9, P.coal); }
      guy(g, 27, 13, P.cyanD); Px.line(g, 38, 24, 46, 24, P.coal); Px.line(g, 44, 22, 46, 24, P.coal); Px.line(g, 44, 26, 46, 24, P.coal);
    },
    // Trompa abraza una tostadora con una etiqueta de precio enorme
    aranceles(g) {
      R(g, 0, 0, W, H, P.yellowL); R(g, 0, 32, W, 8, P.navyD);
      trompa(g, 6, 9);
      R(g, 26, 16, 22, 15, P.coal); R(g, 27, 17, 20, 13, P.creamD); R(g, 29, 14, 6, 3, P.coal); R(g, 38, 14, 6, 3, P.coal);
      R(g, 31, 12, 2, 3, P.orangeD); R(g, 40, 12, 2, 3, P.orangeD); R(g, 48, 22, 2, 4, P.coal);
      R(g, 46, 4, 16, 10, P.coal); R(g, 47, 5, 14, 8, P.creamL); Px.line(g, 46, 9, 42, 14, P.coal);
      Px.text(g, '$$$', 54, 12, P.coralD, { align: 'center' });
    },
    // Dos móviles de madrugada mandándose risas (la luna dice que son las 3)
    memes(g) {
      R(g, 0, 0, W, H, P.navyD); for (let i = 0; i < 14; i++) R(g, (i * 23) % W, (i * 7) % 12, 1, 1, P.creamL);
      Px.ellipse(g, 32, 6, 4, 4, P.creamL); Px.ellipse(g, 34, 5, 3, 3, P.navyD);
      for (const [x, hair] of [[4, P.yellow], [42, P.creamD]]) {
        R(g, x, 12, 18, 26, P.coal); R(g, x + 2, 14, 14, 20, P.cyanL);
        Px.ellipse(g, x + 9, 22, 5, 5, P.yellow); R(g, x + 6, 20, 2, 1, P.coal); R(g, x + 11, 20, 2, 1, P.coal); R(g, x + 6, 24, 7, 2, P.coal);
        R(g, x + 4, 15, 10, 2, hair);
      }
      Px.text(g, 'XD', 32, 30, P.yellow, { align: 'center' });
    },
    // La boca de un túnel: algo cruje dentro
    tunel(g) {
      R(g, 0, 0, W, H, P.orangeDD); Px.ellipse(g, 32, 34, 22, 24, P.coalDD); R(g, 10, 34, 44, 6, P.coalDD);
      R(g, 8, 10, 4, 30, P.woodD); R(g, 52, 10, 4, 30, P.woodD); R(g, 8, 8, 48, 4, P.wood);
      Px.line(g, 24, 14, 28, 20, P.yellow); Px.line(g, 28, 20, 25, 24, P.yellow); Px.line(g, 38, 16, 35, 22, P.yellow); Px.line(g, 35, 22, 39, 27, P.yellow);
      Px.text(g, 'CRAC', 32, 36, P.coralL, { align: 'center' });
    },
    // Paraguas bajo una lluvia de gotas verdes que parecen monedas
    lluviamonedas(g) {
      R(g, 0, 0, W, H, P.coalM); ground(g, 34, P.coalL);
      for (let i = 0; i < 18; i++) { const x = (i * 13) % 62, y = (i * 9) % 30; Px.ellipse(g, x, y, 1, 2, P.green); }
      Px.ellipse(g, 32, 18, 16, 8, P.coal); Px.ellipse(g, 32, 18, 15, 7, P.coral); R(g, 16, 18, 32, 4, P.coalM);
      R(g, 31, 18, 2, 14, P.coal); R(g, 29, 31, 4, 2, P.coal);
      Px.ellipse(g, 20, 36, 8, 2, P.greenD); Px.ellipse(g, 46, 37, 6, 1, P.greenD);
    },
    // Unas manos que no sueltan un diamante
    diamante(g) {
      R(g, 0, 0, W, H, P.orangeDD); for (let i = 0; i < 20; i++) R(g, (i * 29) % W, (i * 11) % H, 2, 2, P.orangeD);
      const d = [[32, 4], [46, 16], [32, 36], [18, 16]];
      for (let y = 4; y <= 36; y++) { const half = y < 16 ? (y - 4) * 14 / 12 : (36 - y) * 14 / 20; R(g, 32 - half, y, half * 2 + 1, 1, y < 16 ? P.cyanL : P.cyan); }
      void d; Px.line(g, 18, 16, 46, 16, P.cyanD); Px.line(g, 32, 4, 32, 36, P.cyanD);
      R(g, 6, 18, 12, 12, P.skin); R(g, 46, 18, 12, 12, P.skin); R(g, 16, 18, 3, 10, P.skinD); R(g, 45, 18, 3, 10, P.skinD);
      for (const [x, y] of [[26, 8], [40, 12], [10, 6]]) { R(g, x, y - 1, 1, 3, P.creamL); R(g, x - 1, y, 3, 1, P.creamL); }
    },
    // Una moneda de oro con cara de perro
    perromoneda(g) {
      R(g, 0, 0, W, H, P.orangeD); for (let i = 0; i < 16; i++) R(g, (i * 31) % W, (i * 7) % H, 1, 1, P.yellowL);
      Px.ellipse(g, 32, 20, 17, 17, P.coal); Px.ellipse(g, 32, 20, 16, 16, P.yellowD); Px.ellipse(g, 32, 20, 13, 13, P.yellow);
      Px.ellipse(g, 32, 22, 8, 7, P.yellowL); R(g, 22, 10, 5, 8, P.orange); R(g, 37, 10, 5, 8, P.orange);
      R(g, 28, 19, 2, 2, P.coal); R(g, 35, 19, 2, 2, P.coal); Px.ellipse(g, 32, 24, 2, 1, P.coal); R(g, 31, 26, 3, 3, P.coral);
    },
    // Una montaña rusa con forma de gráfica
    montana(g) {
      sky(g, P.cyanL, P.creamL); ground(g, 36, P.greenD);
      const pts = [[0, 30], [10, 12], [20, 28], [30, 8], [42, 30], [52, 14], [63, 24]];
      for (let i = 1; i < pts.length; i++) { Px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], P.coal, 2); Px.line(g, pts[i][0], pts[i][1], pts[i][0], 36, P.coalL); }
      R(g, 26, 4, 9, 5, P.coal); R(g, 27, 5, 7, 3, P.coral); R(g, 28, 2, 2, 2, P.skin); R(g, 31, 2, 2, 2, P.skin);
    },
    // Patín entra en la mina con patines y un pico
    patin(g) {
      R(g, 0, 0, W, H, P.orangeDD);
      Px.ellipse(g, 46, 30, 14, 18, P.coalDD); R(g, 32, 30, 28, 10, P.coalDD); R(g, 31, 12, 3, 28, P.woodD); R(g, 58, 12, 3, 28, P.woodD); R(g, 31, 11, 30, 3, P.wood);
      R(g, 0, 36, W, 4, P.cyanL);
      patin(g, 10, 9);
      Px.line(g, 22, 18, 28, 8, P.woodD, 2); Px.line(g, 24, 6, 32, 10, P.creamDD, 2);
      for (const [x, y] of [[4, 6], [26, 30]]) { R(g, x, y, 3, 3, P.yellow); R(g, x, y, 1, 1, P.yellowL); }
    },
    // Un frasco de pastillas sin etiqueta en un portal oscuro
    frasco(g) {
      R(g, 0, 0, W, H, P.coalD); R(g, 0, 32, W, 8, P.coal);
      R(g, 22, 4, 20, 6, P.coal); R(g, 23, 5, 18, 4, P.coral);
      R(g, 20, 10, 24, 26, P.coal); R(g, 21, 11, 22, 24, P.creamD);
      for (let i = 0; i < 9; i++) Px.ellipse(g, 25 + (i % 4) * 5, 30 - Math.floor(i / 4) * 4, 2, 1, [P.coral, P.cyan, P.yellow][i % 3]);
      R(g, 24, 14, 16, 8, P.creamL); Px.text(g, '?', 32, 22, P.coralD, { align: 'center' });
    },
    // Un garaje con una cruz pintada a mano y cola de gente
    garaje(g) {
      sky(g, P.creamD, P.creamM); ground(g, 33, P.coalL);
      R(g, 22, 6, 36, 27, P.coal); R(g, 24, 8, 32, 6, P.creamL); for (let y = 15; y < 33; y += 3) R(g, 24, y, 32, 2, P.coalM);
      R(g, 34, 7, 12, 8, P.creamL); R(g, 38, 8, 4, 6, P.coral); R(g, 36, 10, 8, 2, P.coral);
      for (let i = 0; i < 3; i++) person(g, 2 + i * 6, 22 + (i % 2), [P.cyanD, P.green, P.orange][i]);
    },
    // Luces de policía y cajas confiscadas
    redada(g) {
      R(g, 0, 0, W, H, P.navyD); R(g, 0, 30, W, 10, P.coalL);
      R(g, 6, 14, 24, 16, P.coal); R(g, 7, 15, 22, 14, P.creamL); R(g, 10, 6, 16, 4, P.coal); R(g, 11, 7, 7, 2, P.cyan); R(g, 18, 7, 7, 2, P.coral);
      Px.line(g, 8, 4, 4, 0, P.cyan); Px.line(g, 28, 4, 32, 0, P.coral);
      for (const [x, y] of [[38, 22], [48, 22], [43, 14]]) { R(g, x, y, 10, 8, P.coal); R(g, x + 1, y + 1, 8, 6, P.orangeD); R(g, x + 4, y + 1, 2, 6, P.orange); }
      Px.text(g, 'X', 47, 31, P.coral);
    },
    // Una caja de cartón con vacunas y la etiqueta "USADO"
    cajausado(g) {
      R(g, 0, 0, W, H, P.creamM); R(g, 0, 32, W, 8, P.woodM);
      R(g, 12, 16, 40, 18, P.coal); R(g, 13, 17, 38, 16, P.orangeD); Px.line(g, 12, 16, 6, 10, P.orange, 2); Px.line(g, 52, 16, 58, 10, P.orange, 2);
      for (let i = 0; i < 5; i++) { R(g, 16 + i * 7, 6, 4, 11, P.coal); R(g, 17 + i * 7, 7, 2, 9, P.cyanL); }
      R(g, 20, 22, 24, 8, P.creamL); Px.text(g, 'USADO', 32, 29, P.coal, { align: 'center' });
    },
    // Un corazón con tiritas y una etiqueta de precio
    corazon(g) {
      R(g, 0, 0, W, H, P.creamL);
      Px.ellipse(g, 24, 15, 9, 9, P.coal); Px.ellipse(g, 40, 15, 9, 9, P.coal); for (let y = 15; y < 36; y++) { const half = Math.max(0, 17 - (y - 15) * 0.85); R(g, 32 - half, y, half * 2, 1, P.coal); }
      Px.ellipse(g, 24, 15, 8, 8, P.coral); Px.ellipse(g, 40, 15, 8, 8, P.coral); for (let y = 15; y < 34; y++) { const half = Math.max(0, 15.5 - (y - 15) * 0.85); R(g, 32 - half, y, half * 2, 1, P.coral); }
      Px.line(g, 20, 12, 30, 22, P.creamD, 3); Px.line(g, 30, 12, 20, 22, P.creamD, 3);
      R(g, 48, 26, 12, 8, P.coal); R(g, 49, 27, 10, 6, P.yellowL); Px.line(g, 44, 22, 48, 28, P.coal); Px.text(g, '$', 54, 33, P.coal, { align: 'center' });
    },
    // Una carpeta llena de datos con la huella de alguien y un "2x1"
    datos(g) {
      R(g, 0, 0, W, H, P.coalD); for (let i = 0; i < 30; i++) R(g, (i * 19) % W, (i * 13) % H, 1, 2, P.greenD);
      R(g, 10, 8, 40, 28, P.coal); R(g, 11, 9, 38, 26, P.yellowD); R(g, 11, 6, 14, 4, P.yellowD);
      for (let i = 0; i < 3; i++) R(g, 14 + i * 3, 4 - i, 26, 4, P.creamL);
      Px.circleOutline(g, 26, 22, 6, P.coalL); Px.circleOutline(g, 26, 22, 4, P.coalL); Px.circleOutline(g, 26, 22, 2, P.coalL);
      Px.ellipse(g, 48, 28, 10, 7, P.coal); Px.ellipse(g, 48, 28, 9, 6, P.coral); Px.text(g, '2x1', 48, 32, P.creamL, { align: 'center' });
    },
    // Un camión volcado y los chips por el suelo
    camionchips(g) {
      sky(g, P.creamL, P.cyanL); ground(g, 30, P.coalL, P.coal);
      R(g, 8, 10, 26, 20, P.coal); R(g, 9, 11, 24, 18, P.creamD); R(g, 34, 16, 12, 14, P.coal); R(g, 35, 17, 10, 10, P.cyanD);
      Px.ellipse(g, 14, 8, 3, 3, P.coal); Px.ellipse(g, 28, 8, 3, 3, P.coal);
      for (let i = 0; i < 8; i++) { const x = 44 + (i * 5) % 18, y = 30 + (i % 3) * 3; R(g, x, y, 4, 3, P.coal); R(g, x + 1, y + 1, 2, 1, P.green); }
      Px.text(g, '!', 54, 16, P.coralD, { size: 16 });
    },
    // Una pantalla con una calavera y la nota: "GRACIAS"
    virusordenador(g) {
      R(g, 0, 0, W, H, P.creamM); R(g, 0, 34, W, 6, P.woodM);
      R(g, 8, 2, 48, 30, P.coal); R(g, 10, 4, 44, 24, P.coalD); R(g, 28, 32, 8, 3, P.coal);
      Px.ellipse(g, 32, 12, 6, 5, P.creamL); R(g, 29, 15, 7, 4, P.creamL); R(g, 29, 11, 2, 2, P.coal); R(g, 34, 11, 2, 2, P.coal); R(g, 30, 17, 1, 2, P.coal); R(g, 33, 17, 1, 2, P.coal);
      Px.text(g, 'GRACIAS', 32, 27, P.green, { align: 'center' });
    },
    // Un robot con capucha mirando una bola de cristal (dentro, un símbolo de dólar)
    bolacristal(g) {
      R(g, 0, 0, W, H, P.violetD); for (let i = 0; i < 12; i++) R(g, (i * 23) % W, (i * 9) % 20, 1, 1, P.creamL);
      Px.ellipse(g, 18, 16, 10, 11, P.coal); R(g, 8, 18, 20, 18, P.coal); R(g, 12, 14, 12, 7, P.coalL); R(g, 14, 16, 3, 2, P.cyan); R(g, 19, 16, 3, 2, P.cyan);
      R(g, 34, 32, 22, 4, P.woodD); Px.ellipse(g, 45, 22, 10, 10, P.coal); Px.ellipse(g, 45, 22, 9, 9, P.cyanL); Px.ellipse(g, 42, 19, 3, 3, P.creamL);
      Px.text(g, '$', 45, 27, P.green, { align: 'center' });
    },
    // Un almacén echando humo y chispas en la oscuridad
    almacen(g) {
      R(g, 0, 0, W, H, P.coalD); ground(g, 34, P.coal);
      R(g, 8, 16, 48, 18, P.coal); for (let x = 8; x < 56; x += 6) R(g, x, 12 - (x % 12 ? 0 : 2), 6, 6, P.coal); R(g, 26, 24, 12, 10, P.coalL);
      for (let i = 0; i < 5; i++) Px.ellipse(g, 20 + i * 6, 8 - (i % 2) * 2, 3 + i, 3, P.coalL);
      for (const [x, y] of [[30, 22], [36, 20], [33, 18], [27, 19]]) R(g, x, y, 1, 1, P.yellow);
      Px.text(g, '!', 50, 24, P.orange);
    },
    // Una tienda que solo abre de noche: luna, persiana a medias y un cartel encendido
    tiendanoche(g) {
      R(g, 0, 0, W, H, P.navyD); Px.ellipse(g, 54, 7, 4, 4, P.creamL); Px.ellipse(g, 56, 6, 3, 3, P.navyD);
      ground(g, 34, P.coalL);
      R(g, 8, 10, 40, 24, P.coal); R(g, 10, 12, 36, 4, P.magenta || P.coral); Px.text(g, 'ABIERTO', 28, 16, P.creamL, { align: 'center' });
      R(g, 12, 18, 32, 8, P.coalL); for (let y = 18; y < 26; y += 2) R(g, 12, y, 32, 1, P.coalM); R(g, 12, 26, 32, 8, P.yellow); R(g, 22, 27, 4, 7, P.coal);
    },
    // Un inspector con sombrero, lupa y carpeta; detrás, las persianas bajan
    inspector(g) {
      R(g, 0, 0, W, H, P.wallD); ground(g, 34, P.creamD, P.coalL);
      for (const x of [2, 44]) { R(g, x, 6, 18, 28, P.coalL); for (let y = 7; y < 34; y += 2) R(g, x + 1, y, 16, 1, P.creamDD); }
      guy(g, 26, 12, P.coalM); R(g, 24, 9, 13, 2, P.coal); R(g, 26, 5, 9, 5, P.coal);
      Px.ellipse(g, 40, 18, 3, 3, P.coal); Px.ellipse(g, 40, 18, 2, 2, P.cyanL); Px.line(g, 38, 20, 35, 23, P.coal);
      R(g, 20, 20, 5, 7, P.creamL);
    },
    // El cobrador: capucha, saco al hombro, recorriendo las tiendas
    cobrador(g) {
      sky(g, P.creamD, P.creamM); ground(g, 33, P.coalL);
      for (let x = 0; x < W; x += 16) { R(g, x + 1, 10, 14, 23, P.creamDD); R(g, x + 3, 20, 10, 13, P.coalL); }
      Px.ellipse(g, 30, 12, 6, 7, P.coalDD); R(g, 24, 14, 12, 19, P.coalDD); R(g, 27, 11, 2, 2, P.yellow); R(g, 31, 11, 2, 2, P.yellow);
      Px.ellipse(g, 42, 16, 7, 7, P.coal); Px.ellipse(g, 42, 16, 6, 6, P.woodM); Px.line(g, 34, 12, 40, 12, P.coal, 2); Px.text(g, '$', 42, 20, P.yellow, { align: 'center' });
    },
    // Una mesa de mercadillo con cosas de nadie y precios de 5 dólares
    mercadillo(g) {
      sky(g, P.creamL, P.cyanL); ground(g, 30, P.creamD);
      R(g, 4, 22, 56, 4, P.woodD); R(g, 6, 26, 2, 10, P.woodD); R(g, 56, 26, 2, 10, P.woodD);
      R(g, 8, 12, 6, 10, P.coal); Px.ellipse(g, 11, 11, 5, 3, P.yellow);
      Px.circleOutline(g, 24, 16, 6, P.coal); Px.line(g, 24, 10, 24, 22, P.coalL);
      Px.ellipse(g, 42, 18, 6, 4, P.creamL); Px.ellipse(g, 46, 13, 3, 3, P.creamL); R(g, 44, 12, 1, 1, P.coal); R(g, 38, 21, 2, 2, P.creamL);
      for (const x of [9, 22, 40]) { R(g, x, 26, 10, 6, P.coal); R(g, x + 1, 27, 8, 4, P.yellowL); Px.text(g, '5', x + 5, 32, P.coal, { align: 'center' }); }
    },
    // Trompa y Patín juntos en un selfie (flash)
    cumbre(g) {
      R(g, 0, 0, W, H, P.creamL);
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; Px.line(g, 32, 6, 32 + Math.cos(ang) * 9, 6 + Math.sin(ang) * 9, P.yellow); }
      R(g, 0, 34, W, 6, P.coalL);
      trompa(g, 10, 12); patin(g, 40, 9);
      R(g, 26, 4, 10, 6, P.coal); R(g, 28, 5, 6, 4, P.cyanL);
    },
    // Un lingote de oro sin sello (con un "?" donde debería ir)
    lingote(g) {
      R(g, 0, 0, W, H, P.coalD);
      for (let i = 0; i < 3; i++) {
        const x = 12 + i * 14, y = 24 - (i === 1 ? 10 : 0);
        R(g, x - 1, y - 1, 16, 12, P.coal); R(g, x, y, 14, 10, P.yellowD); R(g, x + 2, y, 10, 4, P.yellow); R(g, x + 3, y + 1, 4, 1, P.yellowL);
      }
      Px.text(g, '?', 33, 22, P.coal, { align: 'center' });
      for (const [x, y] of [[8, 8], [52, 6], [56, 30]]) { R(g, x, y - 1, 1, 3, P.yellowL); R(g, x - 1, y, 3, 1, P.yellowL); }
    },
    // Una alcantarilla abierta, con brillo de oro y una escalera que baja
    alcantarilla(g) {
      R(g, 0, 0, W, H, P.coalL); for (let x = 0; x < W; x += 8) R(g, x, 0, 4, H, P.coalM);
      Px.ellipse(g, 32, 24, 18, 10, P.coal); Px.ellipse(g, 32, 24, 15, 8, P.yellowD); Px.ellipse(g, 32, 25, 11, 5, P.yellow);
      R(g, 26, 18, 2, 16, P.woodD); R(g, 36, 18, 2, 16, P.woodD); for (let y = 20; y < 34; y += 4) R(g, 26, y, 12, 1, P.woodD);
      Px.ellipse(g, 52, 10, 9, 5, P.coal); Px.ellipse(g, 52, 10, 8, 4, P.coalM); R(g, 47, 9, 10, 1, P.coal);
    },
    // Un minero con el casco puesto... y la cara en blanco
    minerogris(g) {
      R(g, 0, 0, W, H, P.orangeDD); Px.ellipse(g, 32, 40, 30, 12, P.coalDD);
      Px.ellipse(g, 32, 16, 9, 10, P.creamDD); R(g, 22, 6, 20, 6, P.yellow); R(g, 30, 4, 4, 3, P.creamL); Px.line(g, 34, 5, 46, 2, P.yellowL);
      R(g, 27, 15, 3, 1, P.coalL); R(g, 34, 15, 3, 1, P.coalL); R(g, 30, 20, 4, 1, P.coalL);
      R(g, 20, 26, 24, 14, P.orange); R(g, 26, 26, 12, 4, P.creamDD);
      Px.text(g, '?', 52, 16, P.creamL, { size: 16 });
    },
    // El túnel 7: el cartel, grietas y piedras que caen
    tunel7(g) {
      R(g, 0, 0, W, H, P.orangeDD); Px.ellipse(g, 32, 34, 20, 22, P.coalDD); R(g, 12, 34, 40, 6, P.coalDD);
      R(g, 24, 3, 16, 12, P.coal); R(g, 25, 4, 14, 10, P.yellow);
      R(g, 28, 6, 8, 2, P.coal); Px.line(g, 35, 8, 31, 13, P.coal, 2);
      Px.line(g, 8, 18, 14, 28, P.coal); Px.line(g, 14, 28, 10, 36, P.coal); Px.line(g, 54, 16, 50, 26, P.coal);
      for (const [x, y] of [[28, 22], [36, 26], [31, 30]]) { R(g, x, y, 3, 3, P.coalL); }
    },
    // El suelo de la calle se hincha y se deshincha: casas torcidas
    suelorespira(g) {
      sky(g, P.creamD, P.creamM);
      Px.ellipse(g, 32, 40, 34, 14, P.coalL); Px.ellipse(g, 32, 40, 32, 12, P.coalM);
      for (const [x, y, t] of [[8, 22, -1], [44, 22, 1]]) { R(g, x + t, y, 12, 10, P.creamDD); R(g, x + 3, y + 4, 3, 3, P.coal); Px.line(g, x, y, x + 6, y - 5, P.coralD); Px.line(g, x + 6, y - 5, x + 12, y, P.coralD); }
      for (const y of [8, 12]) { Px.line(g, 26, y, 30, y - 2, P.coalL); Px.line(g, 30, y - 2, 34, y, P.coalL); Px.line(g, 34, y, 38, y - 2, P.coalL); }
    },
    // Ajedrez por videollamada: Trompa a un lado, Patín al otro y el tablero en medio
    ajedrez(g) {
      R(g, 0, 0, W, H, P.coalM);
      for (const x of [2, 42]) { R(g, x, 4, 20, 20, P.coal); R(g, x + 1, 5, 18, 18, P.cyanL); }
      trompa(g, 6, 7); patin(g, 47, 5);
      R(g, 0, 22, W, 18, P.coalM);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) R(g, 20 + x * 4, 24 + y * 4, 4, 4, (x + y) % 2 ? P.creamL : P.coal);
    },
    // Un gato negro cruzando la calle... marcha atrás
    gatonegro(g) {
      sky(g, P.yellowL, P.creamL); ground(g, 30, P.coalL); for (let x = 2; x < W; x += 10) R(g, x, 34, 6, 2, P.creamL);
      Px.ellipse(g, 30, 24, 11, 6, P.coal); Px.ellipse(g, 43, 20, 5, 5, P.coal); R(g, 39, 13, 3, 4, P.coal); R(g, 45, 13, 3, 4, P.coal);
      R(g, 41, 19, 2, 2, P.yellow); R(g, 45, 19, 2, 2, P.yellow);
      for (const x of [22, 27, 33, 38]) R(g, x, 28, 2, 4, P.coal);
      Px.line(g, 19, 22, 12, 12, P.coal, 2);
      Px.line(g, 22, 8, 40, 8, P.coralD, 2); Px.line(g, 22, 8, 26, 5, P.coralD, 2); Px.line(g, 22, 8, 26, 11, P.coralD, 2);
    },
    // Bravo Fines, el gurú: gafas de sol, gráfica que sube y un deportivo amarillo
    bravo(g) {
      R(g, 0, 0, W, H, P.violetD);
      Px.line(g, 34, 30, 44, 20, P.green, 2); Px.line(g, 44, 20, 50, 24, P.green, 2); Px.line(g, 50, 24, 62, 6, P.green, 2); R(g, 57, 4, 6, 2, P.green); R(g, 61, 4, 2, 6, P.green);
      R(g, 34, 30, 30, 7, P.coal); R(g, 35, 31, 28, 5, P.yellow); R(g, 40, 28, 14, 3, P.yellowD); Px.ellipse(g, 40, 37, 3, 3, P.coal); Px.ellipse(g, 57, 37, 3, 3, P.coal);
      R(g, 8, 18, 18, 18, P.creamL); R(g, 14, 18, 6, 5, P.skin); R(g, 15, 22, 4, 1, P.yellow);
      Px.ellipse(g, 17, 11, 6, 7, P.skin); R(g, 10, 3, 14, 5, P.orangeDD); R(g, 12, 2, 10, 2, P.orangeDD);
      R(g, 11, 9, 13, 3, P.coal); R(g, 12, 9, 2, 1, P.creamL); R(g, 14, 14, 6, 2, P.creamL);
      Px.line(g, 26, 22, 32, 16, P.skin, 2);
    },
  };

  // ---------- Impresión en semitono ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const INKS = {
    pos: [P.coalD, P.greenDD, P.green, P.creamL],
    neg: [P.coalD, P.coralDD, P.coral, P.creamL],
    neu: [P.coalD, P.orangeDD, P.orange, P.creamL],
    dark: [P.coalDD, P.coalD, P.coalL, P.creamD],
  };
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  // Mini encapuchado al fondo de las fotos raras (cada vez más cerca, según la oscuridad)
  function lurker(g, x, y, s) {
    R(g, x, y, 4 * s, 2 * s, P.coalDD); R(g, x - s, y + 2 * s, 6 * s, 6 * s, P.coalDD);
    R(g, x + s, y + 2 * s, s, s, P.yellow); R(g, x + 2 * s, y + 2 * s, s, s, P.yellow);
  }

  // Pegatina del efecto en la esquina de la foto: el color del mercado y una flecha
  // (▲ sube, ▼ baja, ? rumor que puede ir a cualquier lado, ≈ nervios: se mueve mucho)
  const SYMS = {
    up: ['..#..', '.###.', '#####'],
    down: ['#####', '.###.', '..#..'],
    rumor: ['.##.', '...#', '..#.', '....', '..#.'],
    vol: ['.#...#', '#.#.#.', '...#..', '.#...#', '#.#.#.'],
  };
  function sticker(g, w, h, st) {
    const rows = SYMS[st.sym] || SYMS.vol;
    const sw = rows[0].length + 4, sh = rows.length + 4, x = w - sw - 1, y = h - sh - 1;
    R(g, x - 1, y - 1, sw + 2, sh + 2, P.coal); R(g, x, y, sw, sh, st.color || P.creamL);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') R(g, x + 2 + i, y + 2 + j, 1, 1, P.coal); });
  }

  const cache = new Map();
  const NewsArt = SN.NewsArt = {
    W, H,
    has(id) { return !!SCENES[id]; },

    // Foto impresa (64x40, en caché). tone: pos | neg | neu. dark: noticia extraña (0 = no, 1..n = cuánto)
    photo(id, tone = 'neu', dark = 0) {
      const key = `${id}|${tone}|${dark}`;
      if (cache.has(key)) return cache.get(key);
      const src = Px.canvas(W, H), sg = Px.ctx(src);
      (SCENES[id] || SCENES.ciudad)(sg);
      const out = Px.canvas(W, H), og = Px.ctx(out);
      const data = sg.getImageData(0, 0, W, H);
      const img = og.createImageData(W, H);
      const inks = (dark ? INKS.dark : INKS[tone] || INKS.neu).map(hex);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const raw = (0.3 * data.data[i] + 0.59 * data.data[i + 1] + 0.11 * data.data[i + 2]) / 255;
          const lum = Math.max(0, Math.min(1, (raw - 0.5) * 1.3 + 0.5));
          const lv = lum > 0.88 ? 3 : lum < 0.14 ? 0 : Math.max(0, Math.min(3, Math.floor(lum * 3 + BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.2)));
          const c = inks[lv];
          img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
        }
      }
      og.putImageData(img, 0, 0);
      if (dark) {
        // Interferencias y alguien que mira desde el fondo
        const rng = new SN.RNG(id.length * 97 + dark * 13);
        for (let i = 0; i < 3; i++) R(og, 0, rng.int(0, H - 2), W, 1, rng.next() < 0.5 ? P.coralD : P.creamDD);
        const s = dark >= 6 ? 2 : 1;
        lurker(og, rng.int(4, W - 12), rng.int(6, H - 14 * s), s);
      }
      // Borde de la foto
      R(og, 0, 0, W, 1, P.coal); R(og, 0, H - 1, W, 1, P.coal); R(og, 0, 0, 1, H, P.coal); R(og, W - 1, 0, 1, H, P.coal);
      cache.set(key, out);
      return out;
    },

    // Foto A COLOR (sin trama de semitono): la de la PRIMERA PLANA, para que se entienda bien
    color(id) {
      const key = `color|${id}`;
      if (cache.has(key)) return cache.get(key);
      const out = Px.canvas(W, H), og = Px.ctx(out);
      (SCENES[id] || SCENES.ciudad)(og);
      R(og, 0, 0, W, 1, P.coal); R(og, 0, H - 1, W, 1, P.coal); R(og, 0, 0, 1, H, P.coal); R(og, W - 1, 0, 1, H, P.coal);
      cache.set(key, out);
      return out;
    },

    // Elemento <canvas> listo para el DOM. crop: recorte centrado [w, h].
    // opts: { color: foto a color, sticker: { color, sym } } (sym: up | down | rumor | vol)
    node(id, tone, dark, crop, opts = {}) {
      const ph = opts.color ? this.color(id) : this.photo(id, tone, dark);
      const [w, h] = crop || [W, H];
      const c = Px.canvas(w, h);
      const g = Px.ctx(c);
      g.drawImage(ph, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h, 0, 0, w, h);
      if (crop) { R(g, 0, 0, w, 1, P.coal); R(g, 0, h - 1, w, 1, P.coal); R(g, 0, 0, 1, h, P.coal); R(g, w - 1, 0, 1, h, P.coal); }
      if (opts.sticker) sticker(g, w, h, opts.sticker);
      c.className = 'photo';
      return c;
    },

    ids() { return Object.keys(SCENES); },
  };
  void NewsArt;
})(window.SN);
