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
  const HANDS = { kx: 104, ky: 158, mx: 247, my: 154 };
  SN.SCREEN = { x: SCR.x * 2, y: SCR.y * 2, w: SCR.w * 2, h: SCR.h * 2 };

  // Dígitos diminutos (3x5) para el pósit y el calendario
  const MINI = {
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'], $: ['.##', '##.', '.#.', '.##', '##.'], '!': ['#', '#', '#', '.', '#'], '/': ['..#', '..#', '.#.', '#..', '#..'],
    P: ['##.', '#.#', '##.', '#..', '#..'], K: ['#.#', '##.', '#..', '##.', '#.#'],
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
  // Cosas que pasan al otro lado de la ventana (ver Desk.windowEvent)
  const winEvents = [];
  let blindLift = 0;
  const WIN_DUR = { ambulancia: 6, apagon: 7, fuegos: 4.5, encapuchado: 7, dron: 6, camion: 7, lluvia: 22, cuervo: 8, temblor: 2.5, oro: 14 };
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
    // Un suceso visible por la ventana: ambulancia, apagon, fuegos, encapuchado, dron, camion, lluvia, cuervo, temblor
    windowEvent(kind) {
      if (!WIN_DUR[kind] || winEvents.some((e) => e.kind === kind)) return;
      winEvents.push({ kind, t0: t, dur: WIN_DUR[kind], seed: Math.random() * 1000 });
      const A = SN.Audio;
      if (kind === 'ambulancia') A.sfx('siren');
      else if (kind === 'fuegos') [0, 0.6, 1.3, 2].forEach((d) => SN.after(d, () => A.sfx('pop')));
      else if (kind === 'encapuchado') { A.sfx('whisper'); SN.after(0.5, () => A.sfx('heart')); }
      else if (kind === 'apagon') A.sfx('static', { dur: 0.4 });
      else if (kind === 'temblor') { SN.FX.shake(3, 1.6); A.sfx('thud'); }
      else if (kind === 'cuervo') A.sfx('tick');
      SN.Events.emit('window:event', { kind });
    },
    get windowEvents() { return winEvents.map((e) => e.kind); },

    // Clic en la habitación (coordenadas de 320x180): hay símbolos del idioma secreto escondidos
    hotspot(x, y) {
      const run = SN.State.run;
      if (!run || !SN.Cipher || SN.Game.state !== 'GAMEPLAY') return;
      const inside = (r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
      const win = [WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 8];
      const ev = this.windowEvents;
      // El cuervo del alféizar y el encapuchado de la azotea: solo mientras se ven
      if (inside(win) && ev.includes('cuervo')) { SN.Audio.sfx('tick'); return SN.Cipher.discover('cuervo'); }
      if (inside(win) && ev.includes('encapuchado')) return SN.Cipher.discover('azotea');
      // El gato: solo despierto se le ve el collar
      if (inside([2, 142, 64, 34])) {
        const st = SN.Hero.cat.state;
        SN.Hero.petCat();
        // (solo cuando algo le ha despertado de verdad: un susto, una gran pérdida, alguien en la ventana)
        if (!['awake', 'arch', 'alert'].includes(st)) { SN.Audio.sfx('tick'); return null; }
        return SN.Cipher.discover('gato');
      }
      // El póster, cuando la ciudad ya se ha apagado un poco
      if (inside([280, 52, 32, 30]) && run.owned.poster && run.darkness >= 3) return SN.Cipher.discover('poster');
      return null;
    },

    state() {
      const run = SN.State.run;
      return {
        phase: this.phaseOverride || (run ? SN.Time.phase() : 'evening'),
        day: run ? run.day : 1,
        // Sin deuda activa = "libre" (el calendario se tacha con un check)
        paid: run ? !SN.Debt.active() : false,
        owned: run ? run.owned : {},
        dark: run ? run.darkness : 0,
        start: run && run.debt ? run.debt.start || 1 : 1,
        deadline: run && run.debt ? run.debt.deadlineDay : 7,
        defaulted: run && run.debt ? run.debt.defaulted : false,
        owe: run && SN.Debt.active() ? run.debt.amount : 0,
        // La consola: en la intro no aparece hasta que se compra (js/render/cinematic.js)
        console: !this.hideConsole,
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
      // Las persianas se suben solas cuando pasa algo fuera (para que se vea), y bajan después
      blindLift += ((winEvents.length ? 1 : 0) - blindLift) * Math.min(1, dt * 2.5);
      drawBlinds(rg, st, blindLift);
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
    drawKeyItems(g, st);
    return c;
  }

  // Objetos clave de la tienda (los de la "oferta" de FUTURO.exe)
  function drawKeyItems(g, st) {
    if (st.owned.tele) {
      // La tele de 98" sin desembalar, apoyada bajo la ventana: no cabe en ningún otro sitio
      const x = 2, y = 94, w = 44, h = 34;
      R(g, x + 1, y + 1, w, h, P.coalD);
      R(g, x, y, w, h, P.creamD); R(g, x, y, w, 2, P.creamL); R(g, x, y, 2, h, P.creamL);
      R(g, x + 5, y + 6, 26, 15, P.coal); R(g, x + 6, y + 7, 24, 13, P.cyanDD); Px.line(g, x + 8, y + 18, x + 26, y + 9, P.cyanD);
      mini(g, '98', x + 33, y + 8, P.coralD); R(g, x + 41, y + 8, 1, 2, P.coralD);
      R(g, x + 5, y + 25, 30, 2, P.coralD); R(g, x + 5, y + 29, 20, 1, P.creamDD);
    }
    if (st.owned.movil) {
      // El móvil nuevo sobre la mesa: siempre con notificaciones
      const x = 226, y = 133;
      R(g, x, y, 9, 13, P.coalD); R(g, x + 1, y + 1, 7, 11, P.navyM);
      R(g, x + 2, y + 2, 5, 2, P.cyan); R(g, x + 2, y + 5, 4, 1, P.creamD); R(g, x + 2, y + 7, 5, 1, P.creamD); R(g, x + 6, y + 1, 1, 1, P.coral);
    }
    // Objetos dorados de Don Siete (días de la suerte), en fila sobre la mesa
    if (st.owned.maneki) {
      const x = 92, y = 134;
      R(g, x + 1, y + 4, 7, 7, P.creamL); R(g, x + 1, y, 6, 5, P.creamL); R(g, x + 1, y - 1, 1, 1, P.creamL); R(g, x + 6, y - 1, 1, 1, P.creamL);
      R(g, x + 2, y + 2, 1, 1, P.coal); R(g, x + 5, y + 2, 1, 1, P.coal); R(g, x + 1, y + 5, 6, 1, P.coral); R(g, x + 3, y + 6, 2, 1, P.yellow);
      R(g, x, y + 1, 1, 3, P.creamL); // la pata que saluda
    }
    if (st.owned.trebol4) {
      const x = 106, y = 137;
      R(g, x, y, 9, 9, P.yellowD); R(g, x + 1, y + 1, 7, 7, P.creamL);
      for (const [dx, dy] of [[2, 2], [5, 2], [2, 5], [5, 5]]) R(g, x + dx, y + dy, 2, 2, P.green);
    }
    if (st.owned.herradura) {
      const x = 120, y = 138;
      R(g, x, y, 2, 7, P.yellow); R(g, x + 6, y, 2, 7, P.yellow); R(g, x + 1, y + 6, 6, 2, P.yellow); R(g, x, y, 1, 1, P.yellowL);
    }
    if (st.owned.billete7) {
      const x = 184, y = 141;
      R(g, x, y, 13, 7, P.greenD); R(g, x + 1, y + 1, 11, 5, P.green); mini(g, 7, x + 5, y + 1, P.greenDD);
    }
    if (st.owned.moto) {
      // El casco de la moto (la moto no cabe en el cuarto)
      const sp = new PK.Sprite(22, 16);
      sp.part(sp.mask().ellipse(11, 9, 10, 7.5), [P.coralDD, P.coralD, P.coral, P.coralL], { light: [1, -1] });
      sp.rect(9, 6, 12, 4, P.navyDD).rect(10, 6, 9, 1, P.cyanD).rect(2, 14, 18, 2, P.coalD);
      g.drawImage(sp.c, 36, 114);
    }
  }

  // Capa delantera (fondo transparente): persianas, planta y pósit, por delante de la ventana animada
  function buildFront(st) {
    const c = Px.canvas(RW, RH), g = Px.ctx(c);
    drawPlant(g, st);
    drawPostit(g, st);
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

  // lift: 0 = bajadas, 1 = subidas casi del todo (las láminas se amontonan arriba)
  function drawBlinds(g, st, lift = 0) {
    const { x, y, w, h } = WIN;
    const lit = st.phase === 'morning' ? [P.creamL, P.creamM, '#CFC4EE'] : st.phase === 'evening' ? ['#FFD49A', '#FFA65A', '#E0663F'] : ['#5C4A96', '#45367A', '#2E2458'];
    // Láminas: entra luz por los huecos (se ve la ciudad)
    const bottom = Math.round(y + h - 1 - (h - 12) * lift);
    for (let sy = y + 2; sy < bottom; sy += 5) {
      R(g, x, sy, w, 1, lit[0]);
      R(g, x, sy + 1, w, 1, lit[1]);
      R(g, x, sy + 2, w, 1, lit[2]);
    }
    // Láminas recogidas: un bloque apretado en el borde de abajo de la persiana
    if (lift > 0.05) { R(g, x, bottom - 1, w, 3, lit[2]); R(g, x, bottom - 1, w, 1, lit[0]); }
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
    const vines = healthy ? [[10, 20, 4, 60], [18, 20, 12, 92], [24, 20, 30, 70], [14, 20, 0, 40]] : [[12, 20, 9, 44], [19, 20, 21, 50], [23, 20, 27, 34]];
    for (const [x0, y0, x1, y1] of vines) {
      sp.line(x0, y0, x1, y1, healthy ? P.leafDD : '#4A3A22');
      const n = Math.floor((y1 - y0) / (healthy ? 8 : 7));
      for (let i = 1; i <= n; i++) {
        const k = i / n, side = i % 2 ? 1 : -1;
        const lx = Math.round(x0 + (x1 - x0) * k), ly = Math.round(y0 + (y1 - y0) * k);
        if (healthy) {
          // Hojas de potos: corazones verdes hacia fuera
          const leaf = sp.mask().ellipse(lx + side * 3, ly, 3.4, 2.4).ellipse(lx + side * 5, ly + 1, 1.6, 1.4);
          sp.part(leaf, [P.leafDD, P.leafD, P.leaf, P.leafL], { light: [1, -1], hi: 1, lit: 1, sh: 1 });
        } else {
          // Hojas secas que cuelgan
          const leaf = sp.mask().capsule(lx + side, ly, lx + side * 3, ly + 4, 1.05);
          sp.part(leaf, ['#3A2A18', '#6A4A22', '#A0782E', '#C8A048'], { light: [1, -1], hi: 1, lit: 1, sh: 1 });
        }
      }
    }
    g.drawImage(sp.c, -4, 0);
    if (!healthy) {
      // Hojas caídas en el alféizar
      R(g, 9, WIN.y + WIN.h + 1, 3, 1, '#A0782E'); R(g, 10, WIN.y + WIN.h, 2, 1, '#6A4A22');
      R(g, 30, WIN.y + WIN.h + 1, 3, 1, '#C8A048'); R(g, 31, WIN.y + WIN.h, 1, 1, '#6A4A22');
    }
  }

  // Pósit en la esquina del monitor (por delante de la ventana y de la cortina): lo que debes ahora
  function drawPostit(g, st) {
    R(g, 41, 4, 13, 13, P.yellowD); R(g, 40, 3, 13, 13, P.yellow); R(g, 40, 3, 13, 3, P.yellowL);
    if (!st.owe) { Px.line(g, 43, 9, 45, 11, P.greenD); Px.line(g, 45, 11, 50, 6, P.greenD); return; }
    const txt = st.owe >= 1000 ? Math.round(st.owe / 1000) + 'K' : String(st.owe);
    mini(g, txt, 40 + Math.max(0, Math.floor((13 - (txt.length * 4 - 1)) / 2)), 7, P.coralD);
    mini(g, '! !', 44, 11, P.coralD);
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
      // Cuando la ciudad se apaga, alguien escribe en el póster (un símbolo del idioma secreto: Щ)
      if (st.dark >= 3) { for (const cx of [284, 286, 288]) R(g, cx, 56, 1, 5, P.coralD); R(g, 284, 60, 5, 1, P.coralD); R(g, 288, 61, 1, 1, P.coralD); }
    }
    // Estantería
    R(g, 271, 88, 49, 3, P.woodM); R(g, 271, 88, 49, 1, P.wood); R(g, 271, 91, 49, 1, P.woodDD);
    const books = [[P.cyan, 14], [P.orange, 16], [P.violetL, 13], [P.coral, 15]];
    let bx = 274;
    for (const [c, h] of books) { R(g, bx, 88 - h, 4, h, P.coalD); R(g, bx + 1, 89 - h, 2, h - 1, c); R(g, bx + 1, 92 - h, 2, 1, P.creamL); bx += 5; }
    drawPlush(g, 293, 74);
  }

  // Calendario de pared: los días del plazo de la deuda activa (hasta 8), hoy en amarillo, el último marcado
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
    const first = Math.max(st.start, st.deadline - 7);
    for (let d = first; d <= st.deadline; d++) {
      const i = d - first, cx = x + 2 + (i % 4) * 9, cy = y + 9 + Math.floor(i / 4) * 13;
      const today = d === st.day, past = d < st.day;
      R(g, cx, cy, 8, 11, today ? P.yellow : P.cream);
      mini(g, d, cx + (d >= 10 ? 1 : 3), cy + 3, today ? P.coal : P.creamDD);
      if (past) { Px.line(g, cx, cy + 1, cx + 7, cy + 10, P.coral); Px.line(g, cx + 7, cy + 1, cx, cy + 10, P.coral); }
      if (d === st.deadline) { R(g, cx, cy, 8, 1, P.coralD); R(g, cx, cy + 10, 8, 1, P.coralD); R(g, cx, cy, 1, 11, P.coralD); R(g, cx + 7, cy, 1, 11, P.coralD); }
    }
  }

  // La PLEYZETA 6 ULTRA: la misma consola de la tienda (js/render/characters.js, Chars.console) en pequeño:
  // torre de alas blancas curvadas, núcleo negro con la luz azul y el mando blanco al lado. Es el motivo de la
  // deuda (y lleva el toro de oro encima si lo compraste). En la intro no está hasta que se compra.
  function drawConsoleBox(g, st) {
    if (!st.console) return;
    const sp = new PK.Sprite(40, 44);
    const WHITE = [P.creamDD, P.creamD, P.creamM, P.cream, P.creamL], INK = [P.coalDD, P.coalD, P.coal, P.coalL];
    // Núcleo negro entre las alas, con la luz azul a los dos lados
    sp.part(sp.mask().rect(13, 6, 6, 34), INK, { light: [-1, -1], lit: 1, sh: 1 });
    sp.rect(13, 12, 1, 24, P.cyanD).rect(18, 12, 1, 24, P.cyanD).px(13, 20, P.cyan).px(18, 20, P.cyan);
    for (let i = 0; i < 3; i++) sp.rect(14, 8 + i * 2, 4, 1, P.coalM);
    // Alas blancas: anchas arriba y abajo, más estrechas en el centro
    const wingL = sp.mask().poly([[5, 5], [13, 3], [13, 41], [6, 42], [8, 30], [8, 17]]);
    const wingR = sp.mask().poly([[19, 3], [27, 5], [24, 17], [24, 30], [26, 42], [19, 41]]);
    sp.part(wingL, WHITE, { light: [-1, -1], lit: 2, sh: 1, base: 3 });
    sp.part(wingR, WHITE, { light: [-1, -1], lit: 1, sh: 2, base: 2 });
    sp.rim(wingL, P.creamL, [-1, 0]);
    // Peana
    sp.rect(10, 41, 12, 2, P.coalD);
    // Mando blanco apoyado al lado
    const pad = sp.mask().ellipse(33, 38, 6, 2.6).capsule(29, 39, 28, 42, 1.8).capsule(37, 39, 38, 42, 1.8);
    sp.part(pad, WHITE, { light: [-1, -1], lit: 1, sh: 1, base: 3 });
    sp.rect(31, 37, 4, 1, P.coal).px(29, 38, P.coalL).px(37, 37, P.cyan).px(38, 38, P.coral);
    g.drawImage(sp.c, 278, 98);
    if (st.owned.trofeo) {
      const tp = new PK.Sprite(26, 14);
      const m = tp.mask().ellipse(12, 7, 8, 4).ellipse(19, 5, 4, 3).poly([[17, 2], [16, -1], [19, 2]]).poly([[21, 2], [23, -1], [23, 3]]);
      tp.part(m, [P.yellowDD, P.yellowD, P.yellow, P.yellowL], { light: [1, -1] });
      tp.rect(5, 10, 3, 3, P.yellowD).rect(15, 10, 3, 3, P.yellowD);
      g.drawImage(tp.c, 281, 89);
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
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    sky.forEach((c, i) => R(g, x, y + i * band, w, band, c));
    if (st.phase === 'night') {
      for (let i = 0; i < 18; i++) {
        const sx = x + ((i * 37) % w), sy = y + ((i * 23) % 40);
        if (Math.sin(t * 2 + i) > -0.3) R(g, sx, sy, 1, 1, P.cream);
      }
      Px.ellipse(g, x + 26, y + 12, 5, 5, P.creamL);
      Px.ellipse(g, x + 28, y + 11, 4, 4, '#140E30');
    } else if (st.phase === 'morning') {
      Px.ellipse(g, x + 12, y + 14, 6, 6, P.yellowL);
      const cx = x + ((t * 3) % (w + 30)) - 20;
      R(g, cx, y + 24, 16, 4, P.creamL); R(g, cx + 4, y + 21, 8, 3, P.creamL);
    } else {
      Px.ellipse(g, x + 24, y + 50, 10, 10, P.yellowL);
      Px.ellipse(g, x + 24, y + 50, 7, 7, P.yellow);
    }
    g.restore();
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
    drawWindowEvents(g, x, y, w, h, base, par, night);
    g.restore();
  }

  // Sucesos al otro lado de la ventana (dentro del recorte de la ventana, detrás de las persianas)
  function drawWindowEvents(g, x, y, w, h, base, par, night) {
    for (let i = winEvents.length - 1; i >= 0; i--) {
      const e = winEvents[i];
      const a = t - e.t0, k = a / e.dur;
      if (k >= 1) { winEvents.splice(i, 1); continue; }
      const fade = U.clamp(Math.min(a / 0.6, (e.dur - a) / 0.8), 0, 1);
      if (e.kind === 'ambulancia') {
        // Luces rojas y azules barriendo la calle, y la ambulancia cruzando
        const on = Math.floor(a * 6) % 2 === 0;
        g.globalAlpha = 0.22 * fade; R(g, x, y, w, h, on ? P.coral : P.cyan); g.globalAlpha = 1;
        const vx = Math.round(x - 12 + k * (w + 24));
        R(g, vx, base - 6, 10, 5, P.creamL); R(g, vx, base - 4, 10, 1, P.coral); R(g, vx + 7, base - 6, 3, 2, '#7FA8D8');
        R(g, vx + 2, base - 7, 2, 1, on ? P.coral : P.cyan); R(g, vx + 5, base - 7, 2, 1, on ? P.cyan : P.coral);
        R(g, vx + 1, base - 1, 2, 1, P.coalD); R(g, vx + 7, base - 1, 2, 1, P.coalD);
      } else if (e.kind === 'apagon') {
        // Las luces de la ciudad se apagan de golpe; al final parpadean y vuelven
        const flicker = k > 0.8 && Math.sin(a * 40) > 0;
        if (!flicker) { g.globalAlpha = 0.85 * fade; R(g, x, y + 20, w, h - 20, '#07061A'); g.globalAlpha = 1; }
      } else if (e.kind === 'fuegos') {
        for (let n = 0; n < 4; n++) {
          const ta = a - n * 0.65 - 0.2;
          if (ta < 0 || ta > 1.4) continue;
          const cx = x + 8 + ((e.seed + n * 53) % (w - 16)), cy = y + 10 + ((e.seed * 3 + n * 29) % 26);
          const r = 2 + ta * 9, col = [P.yellowL, P.magentaL, P.cyanL, P.greenL][n % 4];
          g.globalAlpha = U.clamp(1.4 - ta, 0, 1);
          for (let j = 0; j < 10; j++) { const an = j / 10 * Math.PI * 2; R(g, Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r + ta * ta * 3), 1, 1, col); }
          g.globalAlpha = 1;
        }
      } else if (e.kind === 'encapuchado') {
        // Una silueta encapuchada en una azotea, mirándote. Parpadea.
        const b = city.reduce((m, c) => (c.x + par > 4 && c.x + par < w - 8 && c.h > m.h ? c : m), { h: 0, x: 14, w: 8 });
        const sx = x + b.x + par + Math.floor(b.w / 2) - 2, sy = base - b.h - 9;
        g.globalAlpha = fade;
        R(g, sx + 1, sy, 3, 1, '#05040A'); R(g, sx, sy + 1, 5, 4, '#05040A'); R(g, sx - 1, sy + 5, 7, 4, '#05040A');
        if (Math.sin(a * 3) > -0.85) { R(g, sx + 1, sy + 2, 1, 1, P.yellowL); R(g, sx + 3, sy + 2, 1, 1, P.yellowL); }
        g.globalAlpha = 1;
      } else if (e.kind === 'dron') {
        const dx = Math.round(x + w + 8 - k * (w + 20)), dy = Math.round(y + 30 + Math.sin(a * 4) * 2);
        R(g, dx - 2, dy, 9, 1, P.coalD); R(g, dx, dy + 1, 5, 2, P.coal); R(g, dx + 1, dy + 3, 3, 3, P.coral); R(g, dx + 2, dy + 4, 1, 1, P.creamL);
        if (Math.floor(a * 4) % 2) R(g, dx + 2, dy - 1, 1, 1, P.greenL);
      } else if (e.kind === 'camion') {
        // Camión de embargos cruzando la calle
        const vx = Math.round(x + w + 14 - k * (w + 30));
        R(g, vx, base - 8, 12, 7, '#6A6A82'); R(g, vx - 4, base - 6, 4, 5, '#4E4E66'); R(g, vx - 3, base - 5, 2, 2, '#9FB6FF');
        R(g, vx + 4, base - 6, 3, 3, P.coral); R(g, vx + 5, base - 5, 1, 1, P.creamL);
        R(g, vx - 2, base - 1, 2, 1, P.coalD); R(g, vx + 8, base - 1, 2, 1, P.coalD);
      } else if (e.kind === 'oro') {
        // LLUVIA DE ORO (día de la suerte): monedas que caen y brillan
        g.globalAlpha = 0.22 * fade; R(g, x, y, w, h, P.yellowD); g.globalAlpha = fade;
        for (let n = 0; n < 14; n++) {
          const rx = x + ((n * 11 + e.seed) % (w - 2)), ry = y + ((n * 23 + a * 40) % h);
          const flip = Math.floor(a * 8 + n) % 4;
          R(g, Math.round(rx), Math.round(ry), flip === 1 ? 1 : 2, 2, flip === 3 ? P.yellowL : P.yellow);
        }
        g.globalAlpha = 1;
      } else if (e.kind === 'lluvia') {
        g.globalAlpha = 0.18 * fade; R(g, x, y, w, h, '#1A2050'); g.globalAlpha = 0.55 * fade;
        for (let n = 0; n < 26; n++) {
          const rx = x + ((n * 13 + e.seed) % w), ry = y + ((n * 29 + a * 90) % h);
          R(g, Math.round(rx), Math.round(ry), 1, 3, '#9FB6FF');
        }
        g.globalAlpha = 1;
      } else if (e.kind === 'cuervo') {
        // Llega volando, se posa en el alféizar, gira la cabeza y se va
        const land = U.clamp(a / 1.2, 0, 1), leave = U.clamp((a - e.dur + 1.4) / 1.4, 0, 1);
        const cx = Math.round(x + w - 10 + (1 - land) * 16 + leave * 18), cy = Math.round(base - 4 - (1 - land) * 14 - leave * 16);
        R(g, cx, cy, 5, 3, '#0A0812'); R(g, cx + 4, cy - 2, 3, 3, '#0A0812');
        const look = Math.sin(a * 1.5) > 0 ? 1 : -1;
        R(g, look > 0 ? cx + 7 : cx + 3, cy - 1, 1, 1, P.yellow);
        R(g, cx + (look > 0 ? 5 : 4), cy - 1, 1, 1, P.coral);
        if (land < 1 || leave > 0) R(g, cx + 1, cy - 2 + (Math.floor(a * 10) % 2) * 3, 3, 1, '#0A0812');
      } else if (e.kind === 'temblor') {
        g.globalAlpha = 0.4 * fade;
        for (let n = 0; n < 14; n++) R(g, x + ((n * 11 + e.seed) % w), y + 20 + ((n * 17 + a * 40) % (h - 20)), 1, 1, P.creamD);
        g.globalAlpha = 1;
      }
    }
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
    // Ondas de calor sobre la consola ("también calienta la habitación")
    for (let i = 0; i < 4 && st.console; i++) {
      const hx = 284 + i * 5;
      for (let yy = 0; yy < 12; yy += 2) {
        const off = Math.round(Math.sin(t * 3 + yy * 0.5 + i) * 1.2);
        g.globalAlpha = 0.32 - yy * 0.022;
        R(g, hx + off, 104 - yy - Math.floor((t * 8 + i * 5) % 5), 1, 2, P.orange);
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
    // (en el marco, a la altura de los dos botones y a su derecha: más abajo quedaba sobre el borde de la mesa)
    R(g, MON.x + MON.w - 16, MON.y + MON.h - 5, 2, 2, on ? (Desk.led === 'alert' ? P.coral : P.green) : P.greenDD);
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
