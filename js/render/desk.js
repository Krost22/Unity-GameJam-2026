// La habitación en pixel art lo-fi (320x180, se ve al doble), en primera persona: delante el monitor
// (donde vive FUTURO.exe) y las manos del protagonista en el teclado y el ratón. A la izquierda, la ventana
// con persianas y la ciudad detrás, la planta, el gato dormido y la taza; a la derecha, el calendario del
// plazo, la estantería, la caja de la consola y el ramen.
// Capas: fondo estático (caché) -> vista de la ventana (animada) -> persianas y planta -> gato, vapor,
// teclas -> manos -> luz (tinte por hora del día, brillo del monitor según la operación, motas de polvo).
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, PK = SN.PK, U = SN.Util;
  const RW = 320, RH = 180;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);

  // Geometría (coordenadas de la habitación). La pantalla coincide con #monitor del HTML (x2).
  const MON = { x: 48, y: 1, w: 222, h: 130 };
  const SCR = { x: 54, y: 7, w: 210, h: 118 };
  const WIN = { x: 4, y: 16, w: 38, h: 72 };
  const DESK_Y = 128;
  const KB = { x: 84, y: 150, w: 128, h: 22 };
  const HANDS = { kx: 104, ky: 156, mx: 247, my: 154 };
  SN.SCREEN = { x: SCR.x * 2, y: SCR.y * 2, w: SCR.w * 2, h: SCR.h * 2 };

  // Dígitos diminutos (3x5) para el pósit y el calendario
  const MINI = {
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'], $: ['.##', '##.', '.#.', '.##', '##.'], '!': ['#', '#', '#', '.', '#'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  };
  function mini(g, text, x, y, c, s = 1) {
    let cx = x;
    for (const ch of String(text)) {
      const gl = MINI[ch];
      if (!gl) { cx += 2 * s; continue; }
      gl.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') R(g, cx + i * s, y + j * s, s, s, c); });
      cx += (gl[0].length + 1) * s;
    }
  }

  // Teclas del teclado (para animar pulsaciones). Las teclas útiles se pintan de color.
  const KEYS = [];
  (function buildKeys() {
    const rows = [
      ['Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace', 'Backspace'],
      ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Enter', 'Enter'],
      ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter', null, 'ArrowUp'],
      ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
    ];
    rows.forEach((row, r) => row.forEach((code, i) => KEYS.push({ x: KB.x + 4 + i * 8 + (r % 2), y: KB.y + 2 + r * 4, w: 7, h: 3, code, r, c: i, press: 0 })));
    KEYS.push({ x: KB.x + 36, y: KB.y + 18, w: 52, h: 3, code: 'Space', r: 4, c: 0, press: 0 });
  })();

  // Ciudad de la ventana (generada una vez, siempre igual)
  const city = (() => {
    const rng = new SN.RNG(7);
    const out = [];
    let x = -12;
    while (x < WIN.w + 12) {
      const w = rng.int(6, 11), h = rng.int(18, 56);
      const wins = [];
      for (let wy = 3; wy < h - 2; wy += 4) for (let wx = 2; wx < w - 2; wx += 3) wins.push({ x: wx, y: wy, seed: rng.next(), hue: rng.int(0, 3) });
      out.push({ x, w, h, tone: rng.int(0, 2), wins, antenna: rng.next() < 0.35 });
      x += w + rng.int(0, 2);
    }
    return out;
  })();

  let bg = null, fg = null, bgKey = '';
  let t = 0;
  let room = null, rg = null;
  const motes = Array.from({ length: 12 }, (_, i) => ({ x: 4 + (i * 37) % 44, y: 30 + (i * 53) % 110, s: 0.3 + (i % 5) * 0.12, ph: i }));

  const Desk = SN.Desk = {
    KEYS, KB, MON, SCR,
    led: 'idle',
    camShift: 0,
    phaseOverride: null,
    glow: { color: P.cyan, k: 0.5, flash: 0, flashColor: P.white },
    dirty() { bgKey = ''; },
    keyFor(code) { return KEYS.find((k) => k.code === code); },

    // Brillo del monitor sobre la habitación: sigue al resultado de la operación (verde / rojo)
    glowTo(color, k = 0.5) { this.glow.color = color; this.glow.k = k; },
    flashGlow(color, power = 1) { this.glow.flash = power; this.glow.flashColor = color; },

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
      if (!room) { room = Px.canvas(RW, RH); rg = Px.ctx(room); }
      const st = this.state();
      const key = JSON.stringify(st);
      if (key !== bgKey) { bg = buildBack(st); fg = buildFront(st); bgKey = key; }
      rg.globalCompositeOperation = 'source-over';
      rg.drawImage(bg, 0, 0);
      drawWindowView(rg, st);
      rg.drawImage(fg, 0, 0);
      drawLampGlowBehind(rg, st);
      SN.Hero.update(dt);
      SN.Hero.drawCat(rg, 2, 142, st.phase);
      drawAnimated(rg, st, dt);
      SN.Hero.drawHands(rg, st.phase, HANDS.kx, HANDS.ky, HANDS.mx, HANDS.my);
      drawLighting(rg, st, dt);
      g.drawImage(room, 0, 0);
    },
  };

  // ---------------- Fondo estático ----------------
  function buildBack(st) {
    const c = Px.canvas(RW, RH), g = Px.ctx(c);
    drawWall(g, st);
    drawWindowFrame(g);
    drawRightWall(g, st);
    drawMonitor(g);
    drawDesk(g);
    drawConsoleBox(g, st);
    drawPad(g, st);
    drawKeyboard(g, st);
    drawMug(g, st);
    drawRamen(g);
    if (!st.paid) drawBills(g, st);
    if (st.owned.cascos) drawHeadphones(g);
    return c;
  }

  // Capa delantera (fondo transparente): persianas, planta y pósit, por delante de la ventana animada
  function buildFront(st) {
    const c = Px.canvas(RW, RH), g = Px.ctx(c);
    drawBlinds(g, st);
    drawPlant(g, st);
    drawPostit(g);
    if (st.owned.lampara) drawLamp(g);
    return c;
  }

  function drawWall(g, st) {
    R(g, 0, 0, RW, RH, P.wall);
    // Paneles verticales y una trama muy suave
    for (let x = 2; x < RW; x += 9) R(g, x, 0, 1, DESK_Y, P.wallM);
    for (let y = 1; y < DESK_Y; y += 4) for (let x = (y * 3) % 7; x < RW; x += 7) R(g, x, y, 1, 1, P.wallD);
    // Rodapié de la pared tras la mesa
    R(g, 0, DESK_Y - 3, RW, 3, P.wallD);
  }

  function drawWindowFrame(g) {
    const { x, y, w, h } = WIN;
    R(g, x - 2, y - 2, w + 4, h + 4, P.coalD);
    R(g, x - 1, y - 1, w + 2, h + 2, P.violetD);
    R(g, x, y, w, h, P.navyD); // hueco (lo tapa la vista animada)
    // Alféizar
    R(g, x - 4, y + h + 1, w + 8, 3, P.coalL); R(g, x - 4, y + h + 1, w + 8, 1, P.violetL); R(g, x - 4, y + h + 4, w + 8, 1, P.coalD);
  }

  function drawBlinds(g, st) {
    const { x, y, w, h } = WIN;
    const lit = st.phase === 'morning' ? [P.creamL, P.creamM, '#CFC4EE'] : st.phase === 'evening' ? ['#FFD49A', '#FFA65A', '#E0663F'] : ['#5C4A96', '#45367A', '#2E2458'];
    // Láminas: entra luz por los huecos (se ve la ciudad)
    for (let sy = y + 2; sy < y + h - 1; sy += 5) {
      R(g, x, sy, w, 1, lit[0]);
      R(g, x, sy + 1, w, 1, lit[1]);
      R(g, x, sy + 2, w, 1, lit[2]);
    }
    // Riel superior y cordón
    R(g, x - 2, y - 3, w + 4, 3, P.coalL); R(g, x - 2, y - 3, w + 4, 1, P.violetL);
    R(g, x + w - 6, y, 1, h - 8, P.creamDD); R(g, x + w - 7, y + h - 8, 3, 3, P.creamD);
    // Montante central
    R(g, x + Math.floor(w / 2) - 1, y, 2, h, P.violetD);
  }

  // Planta colgante: lustrosa si la compraste ("que no se muere"), mustia si no
  function drawPlant(g, st) {
    const healthy = !!st.owned.planta;
    const sp = new PK.Sprite(60, 110);
    // Maceta colgada del techo
    sp.line(16, 0, 12, 10, P.creamDD).line(16, 0, 22, 10, P.creamDD);
    const pot = sp.mask().poly([[8, 10], [26, 10], [24, 20], [10, 20]]);
    sp.part(pot, [P.orangeDD, P.orangeD, P.orange, P.orangeL], { light: [1, -1] });
    const ramp = healthy ? [P.leafDD, P.leafD, P.leaf, P.leafL] : ['#2E2A22', '#5A4A2A', '#8A7A3A', '#B8A050'];
    const vines = healthy ? [[10, 20, 4, 60], [18, 20, 12, 92], [24, 20, 30, 70], [14, 20, 0, 40]] : [[12, 20, 8, 46], [20, 20, 22, 54]];
    for (const [x0, y0, x1, y1] of vines) {
      sp.line(x0, y0, x1, y1, healthy ? P.leafDD : '#4A3A22');
      const n = Math.floor((y1 - y0) / 8);
      for (let i = 1; i <= n; i++) {
        const k = i / n, lx = Math.round(x0 + (x1 - x0) * k) + (i % 2 ? 3 : -3), ly = Math.round(y0 + (y1 - y0) * k);
        const leaf = sp.mask().ellipse(lx, ly, healthy ? 3.4 : 2.4, healthy ? 2.4 : 1.6);
        sp.part(leaf, ramp, { light: [1, -1], hi: 1, lit: 1, sh: 1 });
      }
    }
    g.drawImage(sp.c, -4, 0);
  }

  // Pósit en la esquina del monitor (por delante de la ventana y de la cortina)
  function drawPostit(g) {
    R(g, 41, 4, 13, 13, P.yellowD); R(g, 40, 3, 13, 13, P.yellow); R(g, 40, 3, 13, 3, P.yellowL);
    mini(g, '250', 41, 7, P.coralD);
    mini(g, '!!', 45, 12, P.coralD);
  }

  function drawLamp(g) {
    // Farolillo de papel colgado (compra de la tienda): luz cálida
    R(g, 22, 0, 1, 6, P.creamDD);
    const sp = new PK.Sprite(30, 30);
    const m = sp.mask().ellipse(15, 14, 9, 8);
    sp.part(m, [P.orangeD, P.orange, P.orangeL, P.yellowL], { light: [1, -1] });
    sp.line(7, 12, 23, 12, P.orangeD).line(7, 16, 23, 16, P.orangeD);
    g.drawImage(sp.c, 8, 0);
  }

  // Guirnalda de luces en las dos paredes (los bombillos se animan)
  const GARLAND = [[0, 47], [271, 320]];
  const sagAt = (x) => Math.round(Math.sin(x / 9) * 1.5) + 4;

  // Pared derecha: calendario del plazo, póster, estantería con libros y peluche
  function drawRightWall(g, st) {
    for (const [a, b] of GARLAND) for (let x = a; x < b; x++) R(g, x, sagAt(x), 1, 1, P.coalD);
    drawCalendar(g, st, 277, 12);
    if (st.owned.poster) {
      R(g, 280, 52, 32, 30, P.coalD); R(g, 281, 53, 30, 28, P.yellow);
      Px.line(g, 284, 76, 291, 68, P.greenD, 1); Px.line(g, 291, 68, 295, 71, P.greenD, 1); Px.line(g, 295, 71, 307, 58, P.greenD, 1);
      R(g, 304, 57, 4, 1, P.greenD); R(g, 307, 57, 1, 4, P.greenD);
    }
    // Estantería
    R(g, 271, 88, 49, 3, P.woodM); R(g, 271, 88, 49, 1, P.wood); R(g, 271, 91, 49, 1, P.woodDD);
    const books = [[P.cyan, 14], [P.orange, 16], [P.violetL, 13], [P.coral, 15]];
    let bx = 274;
    for (const [c, h] of books) { R(g, bx, 88 - h, 4, h, P.coalD); R(g, bx + 1, 89 - h, 2, h - 1, c); R(g, bx + 1, 92 - h, 2, 1, P.creamL); bx += 5; }
    drawPlush(g, 293, 74);
  }

  // Calendario de pared: los 7 días del plazo, hoy en amarillo, el último marcado
  function drawCalendar(g, st, x, y) {
    const w = 38, h = 36;
    R(g, x + 1, y + 1, w, h, P.coalD);
    R(g, x, y, w, h, P.creamL);
    R(g, x, y, w, 7, st.paid ? P.green : (st.defaulted ? P.coalL : P.coral));
    R(g, x + 8, y - 2, 2, 3, P.coalL); R(g, x + 28, y - 2, 2, 3, P.coalL);
    if (st.paid) {
      Px.line(g, x + 12, y + 20, x + 17, y + 25, P.greenD, 2); Px.line(g, x + 17, y + 25, x + 27, y + 14, P.greenD, 2);
      return;
    }
    for (let d = 1; d <= 7; d++) {
      const i = d - 1, cx = x + 2 + (i % 4) * 9, cy = y + 9 + Math.floor(i / 4) * 13;
      const today = d === st.day, past = d < st.day;
      R(g, cx, cy, 8, 11, today ? P.yellow : P.cream);
      mini(g, d, cx + 3, cy + 3, today ? P.coal : P.creamDD);
      if (past) { Px.line(g, cx, cy + 1, cx + 7, cy + 10, P.coral); Px.line(g, cx + 7, cy + 1, cx, cy + 10, P.coral); }
      if (d === st.deadline) { R(g, cx, cy, 8, 1, P.coralD); R(g, cx, cy + 10, 8, 1, P.coralD); R(g, cx, cy, 1, 11, P.coralD); R(g, cx + 7, cy, 1, 11, P.coralD); }
    }
  }

  // La PLEYZETA 6 ULTRA sin abrir: el motivo de la deuda (y el toro de oro encima si lo compraste)
  function drawConsoleBox(g, st) {
    const sp = new PK.Sprite(40, 44);
    const box = sp.mask().rect(3, 6, 32, 34);
    sp.part(box, [P.creamDD, P.creamD, P.cream, P.creamL], { light: [1, -1], lit: 2, sh: 2 });
    sp.rect(3, 6, 5, 34, P.coal).rect(9, 6, 26, 7, P.coralD);
    sp.rect(4, 9, 3, 1, P.yellow).rect(4, 11, 2, 1, P.yellow);
    const fire = sp.mask().ellipse(21, 25, 7, 7).poly([[18, 18], [20, 12], [23, 18]]);
    sp.part(fire, [P.orangeD, P.orange, P.orangeL, P.yellowL], { light: [0, -1], outline: false });
    sp.rect(12, 35, 18, 2, P.coal);
    g.drawImage(sp.c, 280, 100);
    if (st.owned.trofeo) {
      const tp = new PK.Sprite(26, 14);
      const m = tp.mask().ellipse(12, 7, 8, 4).ellipse(19, 5, 4, 3).poly([[17, 2], [16, -1], [19, 2]]).poly([[21, 2], [23, -1], [23, 3]]);
      tp.part(m, [P.yellowDD, P.yellowD, P.yellow, P.yellowL], { light: [1, -1] });
      tp.rect(5, 10, 3, 3, P.yellowD).rect(15, 10, 3, 3, P.yellowD);
      g.drawImage(tp.c, 286, 93);
    }
  }

  function drawPlush(g, x, y) {
    // Peluche redondo con cuernitos: el único que no se preocupa por el dinero
    const sp = new PK.Sprite(26, 16);
    const m = sp.mask().ellipse(13, 9, 10, 6.5).poly([[5, 5], [4, 0], [9, 3]]).poly([[17, 3], [22, 0], [21, 5]]);
    sp.part(m, [P.magentaDD, P.magentaD, P.coral, P.coralL, '#FFD0DA'], { light: [1, -1] });
    sp.rect(9, 8, 2, 2, P.coalDD).rect(16, 8, 2, 2, P.coalDD).px(9, 8, P.white).px(16, 8, P.white);
    sp.rect(12, 11, 3, 1, P.coalDD).rect(6, 11, 2, 1, P.coralL).rect(19, 11, 2, 1, P.coralL);
    g.drawImage(sp.c, x, y);
  }

  function drawMonitor(g) {
    const { x, y, w, h } = MON;
    // Pie
    const stand = new PK.Sprite(40, 16);
    stand.part(stand.mask().poly([[16, 0], [24, 0], [25, 8], [15, 8]]), [P.coalDD, P.coalD, P.coal, P.coalL], { light: [1, -1] });
    stand.part(stand.mask().ellipse(20, 10, 17, 3.5), [P.coalDD, P.coalD, P.coal, P.coalL], { light: [1, -1] });
    g.drawImage(stand.c, x + w / 2 - 20, y + h - 1);
    // Marco con contraluz violeta en los bordes
    R(g, x, y, w, h, P.coalD);
    R(g, x + 1, y + 1, w - 2, h - 2, P.coal);
    R(g, x + 1, y + 1, w - 2, 1, P.violetL);
    R(g, x + 1, y + 1, 1, h - 2, P.violet);
    R(g, x + w - 2, y + 2, 1, h - 3, P.coalD);
    R(g, SCR.x - 1, SCR.y - 1, SCR.w + 2, SCR.h + 2, P.navyDD);
    R(g, SCR.x, SCR.y, SCR.w, SCR.h, P.navy);
    // Logo y botones del marco inferior
    R(g, x + w / 2 - 8, y + h - 4, 16, 1, P.coalL);
    R(g, x + w - 26, y + h - 5, 3, 2, P.coalL); R(g, x + w - 21, y + h - 5, 3, 2, P.coalL);
  }

  function drawDesk(g) {
    // Tablero: la luz de la ventana lo calienta por la izquierda
    R(g, 0, DESK_Y, RW, RH - DESK_Y, P.woodM);
    R(g, 0, DESK_Y, RW, 2, P.wood);
    for (let y = DESK_Y + 6; y < RH; y += 9) R(g, 0, y, RW, 1, P.woodD);
    const rng = new SN.RNG(42);
    for (let i = 0; i < 70; i++) R(g, rng.int(0, RW - 10), rng.int(DESK_Y + 3, RH - 2), rng.int(4, 14), 1, rng.next() < 0.5 ? P.woodD : '#8A4038');
    for (let i = 0; i < 4; i++) R(g, 0, RH - 4 + i, RW, 1, i < 2 ? P.woodD : P.woodDD);
    // Sombra del monitor sobre la mesa
    R(g, MON.x + 8, DESK_Y + 3, MON.w - 16, 2, P.woodD);
  }

  function keyColors(st, k) {
    if (st.owned.teclado) return null; // RGB animado (se pinta cada fotograma)
    if (k.code === 'Escape') return [P.coral, P.coralD];
    if (k.code === 'Enter') return [P.green, P.greenD];
    if (k.code === 'Space') return [P.yellow, P.yellowD];
    if (k.code === 'KeyB' || k.code === 'ArrowUp') return [P.green, P.greenD];
    if (k.code === 'KeyV' || k.code === 'ArrowDown') return [P.coral, P.coralD];
    if (k.code === 'ArrowLeft' || k.code === 'ArrowRight') return [P.cyan, P.cyanD];
    return [P.creamM, P.creamDD];
  }

  function drawKeyboard(g, st) {
    R(g, KB.x + 2, KB.y + KB.h + 1, KB.w, 3, P.woodDD);
    R(g, KB.x, KB.y, KB.w, KB.h + 1, P.coalD);
    R(g, KB.x + 1, KB.y + 1, KB.w - 2, KB.h - 1, P.navyM);
    R(g, KB.x + 1, KB.y, KB.w - 2, 1, P.navyLL);
    for (const k of KEYS) {
      const cols = keyColors(st, k) || [P.navyLL, P.navyL];
      R(g, k.x, k.y, k.w, k.h, cols[0]);
      R(g, k.x, k.y + k.h - 1, k.w, 1, cols[1]);
    }
    // Cable hacia el monitor
    Px.line(g, KB.x + 70, KB.y, KB.x + 74, DESK_Y + 4, P.coalD);
  }

  function drawMug(g, st) {
    const x = 62, y = 132;
    const sp = new PK.Sprite(20, 20);
    const nice = !!st.owned.taza;
    const body = sp.mask().poly([[2, 4], [14, 4], [13, 17], [3, 17]]);
    sp.part(body, nice ? [P.violetDD, P.violetD, P.violet, P.violetL] : [P.creamDD, P.creamD, P.cream, P.creamL], { light: [1, -1] });
    sp.part(sp.mask().capsule(15, 8, 15, 13, 2.2).clear(sp.mask().capsule(15, 8, 15, 13, 0.8)), nice ? [P.violetDD, P.violetD, P.violet] : [P.creamDD, P.creamD, P.cream], { light: [1, -1] });
    sp.rect(3, 4, 11, 2, P.woodDD).rect(4, 5, 9, 1, '#5A2A20');
    if (nice) { sp.rect(5, 9, 6, 3, P.creamL).px(6, 10, P.coralD).px(9, 10, P.cyanD); } // mando de consola
    else { sp.px(12, 5, P.wall).px(13, 6, P.wall); } // desportillada
    g.drawImage(sp.c, x, y);
  }

  function drawRamen(g) {
    const x = 276, y = 144;
    const sp = new PK.Sprite(34, 24);
    // Palillos
    sp.line(20, 0, 26, 12, P.woodD, 1).line(24, 0, 28, 12, P.wood, 1);
    const bowl = sp.mask().poly([[2, 9], [30, 9], [27, 18], [21, 21], [11, 21], [5, 18]]);
    sp.part(bowl, [P.creamDD, P.creamD, P.cream, P.creamL], { light: [1, -1], lit: 2 });
    for (let i = 4; i < 28; i += 4) sp.rect(i, 13, 2, 2, P.coral).px(i + 1, 14, P.coralD);
    sp.rect(4, 8, 24, 2, P.yellowD).rect(6, 7, 20, 1, P.yellow);
    for (const xx of [8, 13, 18, 23]) sp.px(xx, 7, P.yellowL);
    sp.rect(10, 7, 4, 2, P.coralL).rect(18, 6, 3, 2, P.greenD);
    g.drawImage(sp.c, x, y);
  }

  function drawBooksAndCalendar(g, st) {
    const sp = new PK.Sprite(34, 44);
    const books = [[2, 30, 30, 6, [P.cyanDD, P.cyanD, P.cyan, P.cyanL]], [4, 24, 26, 6, [P.orangeDD, P.orangeD, P.orange, P.orangeL]], [1, 18, 30, 6, [P.violetDD, P.violetD, P.violet, P.violetL]]];
    for (const [bx, by, bw, bh, ramp] of books) {
      sp.part(sp.mask().rect(bx, by, bw, bh), ramp, { light: [1, -1], lit: 1, sh: 1 });
      sp.rect(bx + 1, by + 2, bw - 3, 1, P.creamL);
    }
    // Calendario de sobremesa: el día de hoy y el plazo
    const cal = sp.mask().rect(6, 2, 22, 16);
    sp.part(cal, [P.creamDD, P.creamD, P.creamL, P.white], { light: [1, -1], lit: 1, sh: 1 });
    const head = st.paid ? P.green : (st.defaulted ? P.coalL : P.coral);
    sp.rect(6, 2, 22, 4, head).rect(9, 1, 1, 2, P.coalL).rect(24, 1, 1, 2, P.coalL);
    if (st.paid) {
      // Libre: un check
      sp.line(11, 11, 14, 14, P.greenD, 2).line(14, 14, 21, 7, P.greenD, 2);
    } else {
      const last = st.day >= st.deadline;
      mini(sp.g, st.day, 10, 8, last ? P.coralD : P.coal, 1);
      mini(sp.g, '/' + st.deadline, 16, 9, P.creamDD, 1);
      if (last) sp.rect(7, 16, 20, 1, P.coral);
    }
    g.drawImage(sp.c, 284, 130);
  }

  function drawBills(g, st) {
    const n = Math.min(5, 1 + st.day);
    for (let i = 0; i < n; i++) {
      const x = 276 + (i % 3) * 3 - i, y = 168 - i * 2;
      R(g, x, y, 16, 9, P.creamDD); R(g, x, y, 15, 8, P.creamL);
      Px.line(g, x, y, x + 7, y + 4, P.creamD); Px.line(g, x + 7, y + 4, x + 14, y, P.creamD);
      R(g, x + 11, y + 5, 3, 2, P.coral);
    }
  }

  function drawPad(g, st) {
    if (st.owned.alfombrilla) {
      R(g, 214, 145, 104, 34, P.coalD); R(g, 215, 146, 102, 32, P.navyD);
      for (let i = 0; i < 102; i += 6) R(g, 215 + i, 176, 3, 1, i % 12 ? P.magenta : P.cyan);
      return;
    }
    R(g, 223, 147, 50, 28, P.coalD); R(g, 224, 148, 48, 26, P.violetD); R(g, 224, 148, 48, 1, P.violet);
  }

  // ---------------- Vista de la ventana (animada) ----------------
  function skyColors(phase) {
    if (phase === 'morning') return ['#9ED9F2', '#BFE7F2', '#E2F2EE', '#FDE8C8'];
    if (phase === 'evening') return ['#4A2370', '#9A3488', '#E0587A', '#FF9A4A', '#FFC773'];
    return ['#0B0820', '#140E30', '#1E1442', '#2A1A54'];
  }

  function drawWindowView(g, st) {
    const { x, y, w, h } = WIN;
    const sky = skyColors(st.phase);
    const band = Math.ceil(h / sky.length);
    sky.forEach((c, i) => R(g, x, y + i * band, w, band, c));
    if (st.phase === 'night') {
      for (let i = 0; i < 18; i++) {
        const sx = x + ((i * 37) % w), sy = y + ((i * 23) % 40);
        if (Math.sin(t * 2 + i) > -0.3) R(g, sx, sy, 1, 1, P.cream);
      }
      Px.ellipse(g, x + 62, y + 14, 5, 5, P.creamL);
      Px.ellipse(g, x + 64, y + 13, 4, 4, '#140E30');
    } else if (st.phase === 'morning') {
      Px.ellipse(g, x + 20, y + 16, 6, 6, P.yellowL);
      const cx = x + ((t * 3) % (w + 30)) - 20;
      R(g, cx, y + 24, 16, 4, P.creamL); R(g, cx + 4, y + 21, 8, 3, P.creamL);
    } else {
      Px.ellipse(g, x + 40, y + 52, 10, 10, P.yellowL);
      Px.ellipse(g, x + 40, y + 52, 7, 7, P.yellow);
    }
    // Ciudad con parallax: se mueve menos que la cámara
    const par = Math.round(-Desk.camShift * 0.12);
    const base = y + h;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    const dark = st.dark;
    const night = st.phase === 'night';
    for (const b of city) {
      const bx = x + b.x + par;
      const body = night ? ['#1A1236', '#140E2C', '#22183F'][b.tone]
        : st.phase === 'evening' ? ['#6A2A5A', '#58204E', '#7A3060'][b.tone]
          : ['#9AA8C8', '#8A98BA', '#B0BCD6'][b.tone];
      R(g, bx, base - b.h, b.w, b.h, body);
      if (b.antenna) { R(g, bx + 3, base - b.h - 5, 1, 5, body); if (night && Math.sin(t * 3 + b.x) > 0.6) R(g, bx + 3, base - b.h - 6, 1, 1, P.coral); }
      for (const wv of b.wins) {
        // Cuantas más noticias extrañas, menos ventanas encendidas
        const litChance = night ? 0.55 - dark * 0.06 : st.phase === 'evening' ? 0.25 - dark * 0.03 : 0;
        const on = wv.seed < litChance && !(wv.seed < 0.06 && Math.sin(t * 0.7 + wv.seed * 40) > 0.95);
        if (!on) continue;
        R(g, bx + wv.x, base - b.h + wv.y, 1, 1, [P.yellow, P.yellowL, P.magentaL, P.cyanL][wv.hue]);
      }
    }
    // Letrero de neón lejano (parpadea de forma irregular)
    if (night || st.phase === 'evening') {
      const flick = Math.sin(t * 13) + Math.sin(t * 3.1) > -0.4;
      if (flick) { R(g, x + 52 + par, y + 34, 12, 3, P.magenta); R(g, x + 53 + par, y + 35, 10, 1, P.magentaL); }
    }
    g.restore();
  }

  // ---------------- Partes animadas ----------------
  function drawAnimated(g, st, dt) {
    // Vapor de la taza y del ramen
    for (const [sx, sy, n] of [[68, 132, 3], [288, 146, 4]]) {
      for (let i = 0; i < n; i++) {
        const p = (t * 0.5 + i / n) % 1;
        const y = sy - p * 16, x = sx + i * 3 + Math.round(Math.sin(t * 2 + i * 2 + p * 6) * 1.5);
        g.globalAlpha = 0.55 * (1 - p);
        R(g, Math.round(x), Math.round(y), 1, 2, P.creamL);
      }
    }
    g.globalAlpha = 1;
    // Teclas pulsadas (y teclado RGB si lo compraste)
    for (const k of KEYS) {
      if (k.press > 0) k.press = Math.max(0, k.press - dt);
      if (st.owned.teclado) {
        const hue = (k.c * 22 + k.r * 30 + t * 120) % 360;
        R(g, k.x, k.y, k.w, k.h, `hsl(${hue}, 85%, ${k.press > 0 ? 80 : 62}%)`);
      } else if (k.press > 0) R(g, k.x, k.y, k.w, k.h, P.white);
    }
    // Guirnalda: bombillos que titilan
    const bulbs = [P.yellow, P.magentaL, P.cyan, P.green];
    let i = 0;
    for (const [a, b] of GARLAND) for (let x = a + 3; x < b - 2; x += 8, i++) {
      const sag = sagAt(x);
      const on = Math.sin(t * 2.2 + i * 1.7) > -0.5;
      R(g, x, sag + 1, 2, 2, on ? bulbs[i % 4] : P.coalL);
      if (on) { g.globalAlpha = 0.25; R(g, x - 1, sag, 4, 4, bulbs[i % 4]); g.globalAlpha = 1; }
    }
    // LED del monitor
    const on = Desk.led === 'busy' ? Math.floor(t * 8) % 2 === 0 : Desk.led === 'alert' ? Math.floor(t * 4) % 2 === 0 : true;
    R(g, MON.x + MON.w - 14, MON.y + MON.h - 4, 2, 2, on ? (Desk.led === 'alert' ? P.coral : P.green) : P.greenDD);
  }

  function drawHeadphones(g) {
    // Auriculares colgados de la esquina del monitor
    Px.line(g, 268, 92, 272, 84, P.coalD, 2); Px.line(g, 272, 84, 286, 86, P.coalD, 2); Px.line(g, 286, 86, 288, 96, P.coalD, 2);
    R(g, 265, 92, 6, 9, P.coal); R(g, 266, 93, 4, 7, P.coral);
    R(g, 285, 95, 6, 9, P.coal); R(g, 286, 96, 4, 7, P.coral);
  }

  function drawLampGlowBehind(g, st) {
    if (!st.owned.lampara || st.phase === 'morning') return;
    g.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[38, 0.05], [26, 0.07], [16, 0.1]]) { g.globalAlpha = a; Px.ellipse(g, 49, 14, r, r * 0.8, P.orange); }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  // ---------------- Luz ----------------
  const TINT = { morning: '#F4F0FF', evening: '#F2DCEE', night: '#8676C2' };
  function drawLighting(g, st, dt) {
    // Tinte de la hora del día (y de lo raro que se está volviendo todo)
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = st.dark ? PK.mix(TINT[st.phase] || TINT.evening, '#6A5A9A', Math.min(0.5, st.dark / 14)) : (TINT[st.phase] || TINT.evening);
    g.fillRect(0, 0, RW, RH);
    // Brillo cálido de la ventana (bandas, sin degradados borrosos)
    g.globalCompositeOperation = 'lighter';
    const wc = st.phase === 'morning' ? P.yellowL : st.phase === 'evening' ? P.orange : P.magenta;
    const wa = st.phase === 'night' ? 0.04 : 0.07;
    for (const [rx, ry, a] of [[70, 56, wa], [52, 42, wa * 1.2], [36, 30, wa * 1.4]]) { g.globalAlpha = a; Px.ellipse(g, WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, rx, ry, wc); }
    // Luz del monitor: más fuerte de noche, del color de la operación
    const gl = Desk.glow;
    gl.flash = Math.max(0, gl.flash - dt * 2.5);
    const base = st.phase === 'night' ? 0.075 : 0.045;
    const k = base * (0.6 + gl.k * 0.8);
    for (const [rx, ry, a] of [[170, 60, k * 0.5], [130, 44, k * 0.7], [96, 30, k]]) { g.globalAlpha = a; Px.ellipse(g, SCR.x + SCR.w / 2, DESK_Y + 22, rx, ry, gl.color); }
    if (gl.flash > 0) { g.globalAlpha = gl.flash * 0.18; Px.ellipse(g, SCR.x + SCR.w / 2, DESK_Y + 20, 190, 90, gl.flashColor); }
    // Motas de polvo flotando en la luz de la ventana
    g.globalAlpha = st.phase === 'night' ? 0.35 : 0.6;
    for (const m of motes) {
      m.y -= m.s * dt * 4; m.x += Math.sin(t * 0.7 + m.ph) * dt * 1.2;
      if (m.y < WIN.y) { m.y = WIN.y + WIN.h + 50; m.x = WIN.x + 2 + ((m.ph * 29 + t * 13) % (WIN.w + 6)); }
      R(g, Math.round(m.x), Math.round(m.y), 1, 1, wc);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  void U;
})(window.SN);
