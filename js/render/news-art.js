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

    // Elemento <canvas> listo para el DOM. crop: recorte centrado [w, h]
    node(id, tone, dark, crop) {
      const ph = this.photo(id, tone, dark);
      const [w, h] = crop || [W, H];
      const c = Px.canvas(w, h);
      Px.ctx(c).drawImage(ph, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h, 0, 0, w, h);
      if (crop) { const g = Px.ctx(c); R(g, 0, 0, w, 1, P.coal); R(g, 0, h - 1, w, 1, P.coal); R(g, 0, 0, 1, h, P.coal); R(g, w - 1, 0, 1, h, P.coal); }
      c.className = 'photo';
      return c;
    },

    ids() { return Object.keys(SCENES); },
  };
  void NewsArt;
})(window.SN);
