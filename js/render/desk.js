// DeskRenderer: la habitación del protagonista en pixel art (pared, ventana con la ciudad, calendario,
// escritorio de madera, monitor, teclado, objetos). Las partes estáticas se pintan en un lienzo aparte
// y solo se repintan cuando cambia algo (hora del día, compras, deuda); lo animado se pinta cada fotograma.
// Capas: pared/ventana (fondo, parallax) -> escritorio -> monitor -> teclado/ratón/manos -> iluminación.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const WALL2 = '#EAD4A8';
  const WOODL = '#E2AE70';

  // Teclas del teclado físico (para animar pulsaciones)
  const KEYS = [];
  const KB = { x: 164, y: 298, w: 258, h: 50 };
  (function buildKeys() {
    const rows = [
      { y: 302, x: 168, n: 20, codes: ['Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'] },
      { y: 311, x: 171, n: 20, codes: ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'] },
      { y: 320, x: 174, n: 19, codes: ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'] },
      { y: 329, x: 168, n: 20, codes: ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'] },
    ];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const x = row.x + i * 12 + (r === 2 && i > 0 ? 0 : 0);
        if (x + 11 > KB.x + KB.w - 3) break;
        KEYS.push({ x, y: row.y, w: 11, h: 7, code: row.codes[i] || null, r, c: i, press: 0 });
      }
    });
    KEYS.push({ x: 228, y: 338, w: 106, h: 7, code: 'Space', r: 4, c: 0, press: 0 });
    for (let i = 0; i < 4; i++) KEYS.push({ x: 168 + i * 15, y: 338, w: 14, h: 7, code: null, r: 4, c: i + 1, press: 0 });
    for (let i = 0; i < 6; i++) KEYS.push({ x: 338 + i * 13, y: 338, w: 12, h: 7, code: ['AltRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ControlRight'][i], r: 4, c: i + 5, press: 0 });
  })();

  // Ciudad de la ventana (generada una vez, siempre igual)
  const city = (() => {
    const rng = new SN.RNG(7);
    const out = [];
    let x = -10;
    while (x < 96) {
      const w = rng.int(9, 16), h = rng.int(28, 80);
      const wins = [];
      for (let wy = 4; wy < h - 4; wy += 5) for (let wx = 2; wx < w - 2; wx += 4) wins.push({ x: wx, y: wy, seed: rng.next() });
      out.push({ x, w, h, tone: rng.int(0, 2), wins, antenna: rng.next() < 0.3 });
      x += w + rng.int(0, 3);
    }
    return out;
  })();

  let bg = null, fg = null, bgKey = '';
  let t = 0;

  const Desk = SN.Desk = {
    KEYS, KB,
    led: 'idle',
    camShift: 0,       // desplazamiento horizontal de la cámara (parallax de la ventana)
    phaseOverride: null, // las cinemáticas pueden forzar la hora (noche, etc.)
    dirty() { bgKey = ''; },

    keyFor(code) { return KEYS.find((k) => k.code === code); },

    state() {
      const run = SN.State.run;
      return {
        phase: this.phaseOverride || (run ? SN.Time.phase() : 'evening'),
        day: run ? run.day : 1,
        paid: run ? run.debt.paid : false,
        owned: run ? run.owned : {},
        dark: run ? run.darkness : 0,
        deadline: run ? run.debt.deadlineDay : 7,
        defaulted: run ? run.debt.defaulted : false,
      };
    },

    render(g, dt) {
      t += dt;
      const st = this.state();
      const key = JSON.stringify(st);
      if (key !== bgKey) { bg = buildStatic(st); fg = buildFront(); bgKey = key; }
      g.drawImage(bg, 0, 0);
      drawWindowView(g, st);
      g.drawImage(fg, 0, 0); // cortinas y pósit quedan por delante del cristal animado
      drawPressedKeys(g, st);
      drawAnimatedProps(g, st);
      SN.Hands.draw(g, dt);
      drawLighting(g, st);
    },
  };

  // ---------------- Fondo estático ----------------
  function buildStatic(st) {
    const c = Px.canvas(SN.W, SN.H), g = Px.ctx(c);
    drawWall(g);
    drawWindowFrame(g);
    drawCalendar(g, st);
    if (st.owned.poster) drawPoster(g);
    drawShelf(g, st);
    drawDesk(g);
    drawMonitor(g);
    drawConsoleBox(g);
    if (st.owned.planta) drawPlant(g);
    if (st.owned.lampara) drawLamp(g);
    if (!st.paid) drawBills(g, st);
    drawPad(g, st);
    drawKeyboard(g, st);
    if (st.owned.cascos) drawHeadphones(g);
    drawCup(g, st);
    return c;
  }

  // Capa delantera (fondo transparente): lo que tapa la ventana animada
  function buildFront() {
    const c = Px.canvas(SN.W, SN.H), g = Px.ctx(c);
    drawCurtain(g, 0, 29, 16);
    drawCurtain(g, 80, 29, 16);
    drawPostit(g);
    return c;
  }

  function drawWall(g) {
    R(g, 0, 0, 640, 258, P.wall);
    for (let x = 4; x < 640; x += 14) R(g, x, 0, 2, 258, WALL2);
    // Pequeño motivo de rombos en el papel pintado
    for (let y = 10; y < 250; y += 18) for (let x = 11; x < 640; x += 28) {
      R(g, x + ((y / 18) % 2) * 14, y, 1, 1, P.wallD);
    }
    // Sombra del monitor sobre la pared
    R(g, 104, 10, 440, 248, P.wallM);
    R(g, 106, 12, 438, 246, '#DFC596');
  }

  function drawWindowFrame(g) {
    // Barra y cortinas
    R(g, 0, 26, 104, 3, P.coal);
    R(g, 0, 32, 92, 124, P.coalM); // hueco (se tapa con el cielo animado)
    R(g, 8, 32, 80, 4, P.woodD);
    R(g, 8, 32, 4, 122, P.woodD); R(g, 84, 32, 4, 122, P.woodD);
    R(g, 9, 33, 78, 2, P.woodM);
    // Alféizar
    R(g, 4, 152, 88, 5, P.woodM); R(g, 4, 152, 88, 1, WOODL); R(g, 4, 157, 88, 2, P.woodDD);
    drawCurtain(g, 0, 29, 16);
    drawCurtain(g, 80, 29, 16);
  }

  function drawCurtain(g, x, y, w) {
    R(g, x, y, w, 132, P.green);
    for (let i = 2; i < w; i += 5) R(g, x + i, y, 2, 132, P.greenD);
    for (let i = 0; i < w; i += 5) R(g, x + i, y, 1, 132, P.greenL);
    R(g, x, y + 130, w, 3, P.greenDD);
    // Lazo
    R(g, x, y + 66, w, 4, P.yellowD); R(g, x, y + 66, w, 1, P.yellow);
  }

  function drawCalendar(g, st) {
    const x = 556, y = 30, w = 70, h = 66;
    R(g, 590, 25, 2, 3, P.coal);
    Px.box(g, x, y, w, h, P.creamL, P.coal);
    R(g, x + 2, y + h - 1, w - 2, 2, P.wallD);
    const head = st.paid ? P.green : (st.defaulted ? P.coalL : P.coral);
    R(g, x + 1, y + 1, w - 2, 12, head);
    Px.text(g, st.paid ? 'LIBRE' : 'PLAZO', x + w / 2, y + 11, P.creamL, { align: 'center' });
    if (!st.paid) {
      for (let d = 1; d <= 7; d++) {
        const i = d - 1, cx = x + 5 + (i % 4) * 15, cy = y + 17 + Math.floor(i / 4) * 21;
        const isToday = d === st.day, past = d < st.day;
        R(g, cx, cy, 13, 17, isToday ? P.yellow : P.cream);
        R(g, cx, cy + 16, 13, 1, P.creamD);
        Px.text(g, d, cx + 7, cy + 12, isToday ? P.coal : P.coalL, { align: 'center' });
        if (past) { Px.line(g, cx + 1, cy + 2, cx + 11, cy + 14, P.coral); Px.line(g, cx + 11, cy + 2, cx + 1, cy + 14, P.coral); }
        if (d === st.deadline) Px.circleOutline(g, cx + 6, cy + 8, 9, P.coralD);
      }
    } else {
      Px.text(g, 'DÍA', x + w / 2, y + 28, P.coalL, { align: 'center' });
      Px.text(g, st.day, x + w / 2, y + 52, P.greenD, { align: 'center', size: 24 });
      // Sello de pagado
      Px.circleOutline(g, x + 56, y + 52, 8, P.greenD);
      Px.line(g, x + 52, y + 52, x + 55, y + 55, P.greenD); Px.line(g, x + 55, y + 55, x + 61, y + 48, P.greenD);
    }
  }

  function drawPoster(g) {
    const x = 560, y = 104, w = 62, h = 54;
    R(g, x + 2, y + 2, w, h, P.wallD);
    Px.box(g, x, y, w, h, P.coal, P.woodDD);
    R(g, x + 3, y + 3, w - 6, h - 6, P.yellow);
    // Gráfica que sube y un toro
    Px.line(g, x + 8, y + 40, x + 22, y + 30, P.greenD, 2);
    Px.line(g, x + 22, y + 30, x + 30, y + 34, P.greenD, 2);
    Px.line(g, x + 30, y + 34, x + 52, y + 12, P.greenD, 2);
    R(g, x + 48, y + 10, 6, 2, P.greenD); R(g, x + 52, y + 10, 2, 6, P.greenD);
    Px.text(g, 'EL DINERO', x + w / 2, y + 49, P.coal, { align: 'center' });
  }

  function drawShelf(g, st) {
    const y = 196;
    R(g, 546, y, 92, 5, P.woodM); R(g, 546, y, 92, 1, WOODL); R(g, 546, y + 5, 92, 2, P.woodDD);
    R(g, 556, y + 7, 3, 8, P.coalL); R(g, 624, y + 7, 3, 8, P.coalL);
    // Libros
    const books = [[P.coral, 20], [P.cyan, 24], [P.orange, 18], [P.green, 22], [P.cream, 19]];
    let bx = 550;
    books.forEach(([col, h], i) => {
      R(g, bx, y - h, 6, h, P.coal);
      R(g, bx + 1, y - h + 1, 4, h - 1, col);
      R(g, bx + 1, y - h + 4, 4, 1, P.creamL);
      bx += 7 + (i === 2 ? 1 : 0);
    });
    if (st.owned.trofeo) drawBull(g, 592, y);
    else {
      // Cactus
      R(g, 604, y - 9, 12, 9, P.orangeD); R(g, 605, y - 8, 10, 2, P.orange);
      R(g, 607, y - 22, 6, 13, P.greenD); R(g, 608, y - 21, 3, 12, P.green);
      R(g, 603, y - 18, 4, 3, P.greenD); R(g, 603, y - 21, 2, 4, P.greenD);
      R(g, 613, y - 16, 4, 3, P.greenD); R(g, 615, y - 19, 2, 4, P.greenD);
      R(g, 609, y - 24, 2, 2, P.coral);
    }
  }

  function drawBull(g, x, y) {
    // Toro dorado sobre peana
    R(g, x, y - 5, 30, 5, P.coal); R(g, x + 1, y - 4, 28, 3, P.coalL);
    R(g, x + 6, y - 15, 18, 9, P.yellowD); R(g, x + 6, y - 15, 18, 3, P.yellow);
    R(g, x + 22, y - 18, 6, 6, P.yellowD); R(g, x + 22, y - 18, 6, 2, P.yellowL);
    R(g, x + 21, y - 21, 2, 3, P.creamL); R(g, x + 27, y - 21, 2, 3, P.creamL);
    R(g, x + 7, y - 7, 2, 3, P.yellowDD); R(g, x + 12, y - 7, 2, 3, P.yellowDD); R(g, x + 17, y - 7, 2, 3, P.yellowDD); R(g, x + 21, y - 7, 2, 3, P.yellowDD);
    R(g, x + 4, y - 14, 2, 5, P.yellowD);
    R(g, x + 10, y - 13, 3, 1, P.yellowL);
  }

  function drawDesk(g) {
    R(g, 0, 252, 640, 6, P.wallD);
    R(g, 0, 257, 640, 103, P.wood);
    R(g, 0, 257, 640, 2, WOODL);
    // Tablones y vetas
    for (let y = 282; y < 360; y += 26) R(g, 0, y, 640, 1, P.woodM);
    const rng = new SN.RNG(42);
    for (let i = 0; i < 140; i++) {
      const x = rng.int(0, 630), y = rng.int(260, 356), w = rng.int(6, 22);
      R(g, x, y, w, 1, rng.next() < 0.5 ? P.woodM : '#C98E50');
    }
    // Sombra suave hacia el borde delantero
    for (let i = 0; i < 4; i++) R(g, 0, 344 + i * 4, 640, 4, `rgba(110, 63, 30, ${0.05 + i * 0.04})`);
  }

  function drawMonitor(g) {
    // Pie
    R(g, 302, 256, 36, 26, P.coal); R(g, 304, 256, 4, 26, P.coalL); R(g, 332, 256, 4, 24, P.coalD);
    Px.ellipse(g, 320, 288, 50, 6, P.coalD);
    Px.ellipse(g, 320, 286, 48, 6, P.coal);
    Px.ellipse(g, 320, 285, 44, 4, P.coalM);
    R(g, 290, 283, 60, 1, P.coalL);
    // Marco
    Px.box(g, 98, 4, 440, 258, P.coal, P.coalDD);
    R(g, 101, 5, 434, 1, P.coalL);
    R(g, 99, 7, 1, 252, P.coalM);
    R(g, 106, 12, 424, 240, P.coalDD); // borde interior de la pantalla
    R(g, 100, 258, 436, 2, P.coalD);
    Px.text(g, 'KROSTVISION', 318, 260, P.coalL, { align: 'center' });
    // Botones del monitor
    R(g, 490, 255, 5, 3, P.coalM); R(g, 498, 255, 5, 3, P.coalM); R(g, 506, 255, 5, 3, P.coalM);
    // Pósit verde pegado al marco (el amarillo va en la capa delantera, sobre la ventana)
    R(g, 531, 150, 26, 26, P.greenD);
    R(g, 530, 149, 26, 26, P.greenL);
    R(g, 530, 149, 26, 3, '#B5EEB0');
    // Dibujo: una consola tachada
    R(g, 536, 158, 14, 9, P.coal); R(g, 537, 159, 12, 7, P.coalL); R(g, 541, 156, 2, 2, P.coal);
    Px.line(g, 534, 155, 552, 170, P.coralD, 2);
  }

  // Pósit amarillo pegado al marco del monitor: pisa la ventana y la cortina
  function drawPostit(g) {
    R(g, 79, 21, 28, 28, P.yellowD);
    R(g, 78, 20, 28, 28, P.yellow);
    R(g, 78, 20, 28, 4, P.yellowL);
    Px.text(g, '$250', 92, 36, P.coralD, { align: 'center' });
    R(g, 82, 39, 20, 1, P.coralD);
    Px.text(g, '!!', 92, 47, P.coralD, { align: 'center' });
  }

  function drawConsoleBox(g) {
    // La PLEYZETA 6 ULTRA: el motivo de la deuda, sin abrir
    const x = 562, y = 226, w = 66, h = 64;
    R(g, x + 3, y + h - 2, w, 5, P.woodDD);
    Px.box(g, x, y, w, h, P.creamL, P.coal);
    R(g, x + 1, y + 1, 10, h - 2, P.coal);
    R(g, x + 12, y + 1, w - 13, 14, P.coralD);
    Px.text(g, 'P6', x + 38, y + 12, P.creamL, { align: 'center' });
    // Arte de la caja: llama
    Px.ellipse(g, x + 38, y + 38, 13, 13, P.orange);
    Px.ellipse(g, x + 38, y + 41, 9, 9, P.yellow);
    R(g, x + 36, y + 22, 4, 6, P.orange); R(g, x + 30, y + 26, 3, 5, P.orange); R(g, x + 45, y + 27, 3, 4, P.orange);
    Px.ellipse(g, x + 38, y + 44, 4, 5, P.creamL);
    Px.text(g, 'ULTRA', x + 38, y + 61, P.coal, { align: 'center' });
    R(g, x + 2, y + 6, 8, 1, P.yellow); R(g, x + 2, y + 9, 6, 1, P.yellow);
  }

  function drawPlant(g) {
    const x = 6, y = 292;
    R(g, x + 4, y - 18, 26, 18, P.orangeD); R(g, x + 2, y - 22, 30, 5, P.orange); R(g, x + 2, y - 22, 30, 1, P.orangeL);
    R(g, x + 6, y - 16, 2, 12, P.orange);
    const leaves = [[0, -40, 8, 18], [10, -50, 7, 28], [20, -44, 8, 22], [-2, -30, 10, 7], [24, -32, 10, 7], [14, -36, 6, 14]];
    for (const [lx, ly, lw, lh] of leaves) {
      R(g, x + 6 + lx, y + ly, lw, lh, P.greenD);
      R(g, x + 7 + lx, y + ly + 1, lw - 3, lh - 2, P.green);
      R(g, x + 7 + lx, y + ly + 1, 1, lh - 4, P.greenL);
    }
  }

  function drawLamp(g) {
    R(g, 40, 284, 30, 6, P.coal); R(g, 42, 284, 26, 2, P.coalL);
    Px.line(g, 54, 284, 46, 236, P.coalL, 3);
    Px.line(g, 46, 236, 72, 214, P.coalL, 3);
    R(g, 66, 206, 24, 12, P.orange); R(g, 66, 206, 24, 3, P.orangeL); R(g, 68, 218, 20, 2, P.orangeD);
    R(g, 70, 220, 16, 2, P.yellowL);
  }

  function drawBills(g, st) {
    // Cartas de cobro: cuantas más pasan los días, más se acumulan
    const n = Math.min(6, 2 + st.day);
    for (let i = 0; i < n; i++) {
      const x = 70 + (i % 3) * 6 - i, y = 324 - i * 3;
      Px.box(g, x, y, 36, 22, P.creamL, P.coalL);
      R(g, x + 1, y + 1, 34, 1, '#fff');
      Px.line(g, x + 1, y + 1, x + 18, y + 11, P.creamD); Px.line(g, x + 18, y + 11, x + 34, y + 1, P.creamD);
      R(g, x + 26, y + 13, 7, 6, P.coral);
    }
    // Sello rojo encima del montón
    const ty = 324 - (n - 1) * 3 - 3;
    R(g, 74, ty - 9, 32, 10, P.coral);
    R(g, 74, ty, 32, 1, P.coralD);
    Px.text(g, 'PAGAR', 90, ty - 1, P.creamL, { align: 'center' });
  }

  function drawPad(g, st) {
    if (st.owned.alfombrilla) {
      Px.box(g, 432, 294, 200, 60, P.coalM, P.coal);
      R(g, 434, 296, 196, 56, P.coal);
      for (let i = 0; i < 196; i += 8) R(g, 434 + i, 350, 4, 2, i % 16 ? P.yellow : P.coral);
      R(g, 600, 300, 24, 3, P.yellowD);
    } else {
      Px.box(g, 444, 296, 98, 56, P.cyanDD, P.coal);
      R(g, 446, 298, 94, 52, P.cyanD);
      R(g, 446, 298, 94, 1, P.cyan);
      R(g, 528, 340, 8, 6, P.cyanDD);
    }
  }

  function keyColors(st, k) {
    if (st.owned.teclado) {
      const cols = [[P.coral, P.coralD], [P.orange, P.orangeD], [P.yellow, P.yellowD], [P.green, P.greenD], [P.cyan, P.cyanD]];
      return cols[(k.c + k.r) % cols.length];
    }
    // Las teclas que sirven para jugar se ven de color en el teclado de la mesa
    if (k.code === 'Escape') return [P.coral, P.coralD];
    if (k.code === 'Enter') return [P.green, P.greenD];
    if (k.code === 'Space') return [P.yellowL, P.yellowD];
    if (k.code === 'KeyB' || k.code === 'ArrowUp') return [P.greenL, P.green];
    if (k.code === 'KeyV' || k.code === 'ArrowDown') return [P.coralL, P.coral];
    if (k.code === 'ArrowLeft' || k.code === 'ArrowRight') return [P.cyanL, P.cyan];
    return [P.creamL, P.creamD];
  }

  function drawKey(g, st, k, pressed) {
    const [top, side] = keyColors(st, k);
    const dy = pressed ? 1 : 0;
    R(g, k.x, k.y + dy, k.w, k.h - dy, pressed ? side : top);
    R(g, k.x, k.y + k.h - 1, k.w, 1, side);
    if (!pressed) R(g, k.x + 1, k.y + 1, k.w - 2, 1, '#FFFFFF');
  }

  function drawKeyboard(g, st) {
    R(g, KB.x + 2, KB.y + KB.h, KB.w, 3, P.woodDD);
    Px.box(g, KB.x, KB.y, KB.w, KB.h, P.coal, P.coalDD);
    R(g, KB.x + 1, KB.y + 1, KB.w - 2, 1, P.coalL);
    R(g, KB.x + 1, KB.y + KB.h - 3, KB.w - 2, 2, P.coalD);
    for (const k of KEYS) drawKey(g, st, k, false);
    // Cable hacia el ordenador
    Px.line(g, 290, 298, 296, 284, P.coal, 2);
  }

  function drawHeadphones(g) {
    const x = 556, y = 318;
    Px.ellipse(g, x + 22, y, 22, 14, P.coal);
    Px.ellipse(g, x + 22, y + 2, 18, 11, P.wood);
    R(g, x, y - 2, 10, 16, P.coal); R(g, x + 1, y, 8, 12, P.coralD); R(g, x + 2, y + 1, 5, 4, P.coral);
    R(g, x + 34, y - 2, 10, 16, P.coal); R(g, x + 35, y, 8, 12, P.coralD); R(g, x + 36, y + 1, 5, 4, P.coral);
  }

  function drawCup(g, st) {
    if (st.owned.taza) {
      const x = 130, y = 286;
      R(g, x + 2, y + 20, 18, 2, P.woodDD);
      Px.box(g, x, y, 18, 20, P.coral, P.coalD);
      R(g, x + 1, y + 1, 16, 3, P.coralL);
      R(g, x + 2, y + 2, 14, 2, P.woodDD);
      R(g, x + 18, y + 5, 4, 2, P.coalD); R(g, x + 21, y + 6, 2, 8, P.coalD); R(g, x + 18, y + 13, 4, 2, P.coalD);
      R(g, x + 3, y + 8, 6, 6, P.creamL); R(g, x + 4, y + 9, 4, 4, P.coral);
    } else {
      // Vaso de papel triste
      const x = 134, y = 290;
      R(g, x + 1, y + 16, 12, 2, P.woodDD);
      R(g, x, y, 13, 16, P.coalL);
      R(g, x + 1, y, 11, 15, P.creamL);
      R(g, x + 1, y, 11, 2, P.creamD);
      R(g, x + 2, y + 6, 9, 4, P.wood);
      R(g, x + 3, y + 7, 3, 1, P.woodD);
    }
  }

  // ---------------- Partes animadas ----------------
  function skyColors(phase) {
    if (phase === 'morning') return [P.cyanL, '#B9EBF5', '#DDF4F0', P.creamL];
    if (phase === 'evening') return [P.orange, P.orangeL, '#FAC88F', P.yellowL];
    return [P.coalDD, P.coalD, P.coal, P.coalM];
  }

  function drawWindowView(g, st) {
    const x0 = 12, y0 = 36, w = 72, h = 116;
    const sky = skyColors(st.phase);
    const band = Math.ceil(h / sky.length);
    sky.forEach((c, i) => R(g, x0, y0 + i * band, w, band, c));
    if (st.phase === 'night') {
      for (let i = 0; i < 14; i++) {
        const sx = x0 + ((i * 37) % w), sy = y0 + ((i * 23) % 50);
        if (Math.sin(t * 2 + i) > -0.3) R(g, sx, sy, 1, 1, P.cream);
      }
      Px.ellipse(g, x0 + 52, y0 + 16, 5, 5, P.cream);
      Px.ellipse(g, x0 + 54, y0 + 15, 4, 4, P.coalD);
    } else if (st.phase === 'morning') {
      Px.ellipse(g, x0 + 18, y0 + 20, 6, 6, P.yellowL);
      Px.ellipse(g, x0 + 18, y0 + 20, 4, 4, P.yellow);
      const cx = x0 + ((t * 3) % (w + 30)) - 20;
      R(g, cx, y0 + 30, 16, 4, P.creamL); R(g, cx + 4, y0 + 27, 8, 3, P.creamL);
    } else {
      Px.ellipse(g, x0 + 36, y0 + 82, 10, 10, P.yellow);
    }
    // Ciudad con parallax: se mueve menos que la cámara
    const par = Math.round(-Desk.camShift * 0.25);
    const base = y0 + h;
    g.save();
    g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    const dark = st.dark;
    for (const b of city) {
      const bx = x0 + b.x + par;
      const day = st.phase !== 'night';
      const body = st.phase === 'night' ? [P.coalD, P.coalDD, '#2a2c25'][b.tone]
        : st.phase === 'evening' ? [P.orangeD, P.orangeDD, '#a9572a'][b.tone]
          : [P.creamD, P.creamDD, '#BFB08C'][b.tone];
      R(g, bx, base - b.h, b.w, b.h, body);
      R(g, bx, base - b.h, 1, b.h, day ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)');
      if (b.antenna) R(g, bx + 3, base - b.h - 6, 1, 6, body);
      for (const wv of b.wins) {
        // Cuanta más "oscuridad" (noticias extrañas), menos ventanas encendidas
        const litChance = day ? 0 : 0.6 - dark * 0.07;
        const on = wv.seed < litChance && !(wv.seed < 0.08 && Math.sin(t * 0.7 + wv.seed * 40) > 0.95);
        const col = day ? (st.phase === 'evening' ? P.orangeL : 'rgba(255,255,255,0.35)') : (on ? P.yellow : '#3a3d34');
        R(g, bx + wv.x, base - b.h + wv.y, 2, 2, col);
      }
    }
    g.restore();
    // Marco de la ventana por encima
    R(g, 47, 36, 3, 116, P.woodM); R(g, 47, 36, 1, 116, WOODL);
    R(g, 12, 92, 72, 3, P.woodM); R(g, 12, 92, 72, 1, WOODL);
    R(g, 12, 36, 72, 1, 'rgba(0,0,0,0.15)');
    // Reflejo del cristal
    for (let i = 0; i < 3; i++) R(g, 16 + i * 2, 40 + i * 3, 1, 12, 'rgba(255,255,255,0.25)');
  }

  function drawPressedKeys(g, st) {
    for (const k of KEYS) {
      if (k.press > 0) drawKey(g, st, k, true);
    }
  }

  function drawAnimatedProps(g, st) {
    // Ondas de calor sobre la consola ("también calienta la habitación")
    for (let i = 0; i < 4; i++) {
      const x = 572 + i * 14;
      for (let y = 0; y < 16; y += 2) {
        const off = Math.round(Math.sin(t * 3 + y * 0.5 + i) * 1.5);
        const a = 0.35 - y * 0.02;
        R(g, x + off, 222 - y - ((t * 10 + i * 5) % 6), 1, 2, `rgba(242,139,67,${a})`);
      }
    }
    // Vapor de la taza
    if (st.owned.taza) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.6 + i / 3) % 1;
        const y = 282 - p * 22, x = 136 + i * 4 + Math.round(Math.sin(t * 2 + i * 2 + p * 6) * 2);
        R(g, x, Math.round(y), 2, 2, `rgba(255,250,236,${0.6 * (1 - p)})`);
      }
    }
    // LED del monitor
    const on = Desk.led === 'busy' ? Math.floor(t * 8) % 2 === 0 : Desk.led === 'alert' ? Math.floor(t * 4) % 2 === 0 : true;
    R(g, 520, 255, 4, 3, on ? (Desk.led === 'alert' ? P.coral : P.green) : P.greenDD);
    if (on) R(g, 520, 255, 2, 1, Desk.led === 'alert' ? P.coralL : P.greenL);
  }

  function drawLighting(g, st) {
    if (st.phase === 'evening') {
      R(g, 0, 0, 640, 360, 'rgba(242, 139, 67, 0.10)');
    } else if (st.phase === 'night') {
      R(g, 0, 0, 640, 360, 'rgba(23, 24, 20, 0.42)');
      // Luz del monitor sobre el escritorio y las manos (por bandas, sin degradados borrosos)
      g.save();
      g.globalCompositeOperation = 'lighter';
      Px.ellipse(g, 320, 320, 230, 52, 'rgba(255, 230, 180, 0.07)');
      Px.ellipse(g, 320, 312, 170, 40, 'rgba(255, 230, 180, 0.06)');
      if (st.owned.lampara) Px.ellipse(g, 80, 286, 60, 22, 'rgba(255, 212, 71, 0.12)');
      g.restore();
    }
  }
})(window.SN);
