// DeskInteractionController: ratón físico, manos y teclado del escritorio.
// - El ratón de la mesa sigue al cursor real cuando está sobre el monitor.
// - Cada clic baja el dedo índice y hunde el botón del ratón.
// - Las teclas pulsadas se hunden en el teclado y un dedo de la mano izquierda las toca.
// - Las manos reaccionan a las ganancias (saltito) y a las pérdidas (respingo).
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const S = SN.SCREEN;
  const SKIN_L = '#FFDDBF';
  const MOUSE_BASE = { x: 492, y: 320 };
  const LEFT_BASE = { x: 184, y: 320 };

  const H = SN.Hands = {
    mouse: { x: MOUSE_BASE.x, y: MOUSE_BASE.y, tx: MOUSE_BASE.x, ty: MOUSE_BASE.y },
    click: 0,
    fingers: [0, 0, 0, 0],
    bounce: { y: 0, v: 0 },
    shake: 0,
    idle: 2,
    drumming: false,
    drumT: 0,
    t: 0,

    // Punto del escenario (coordenadas de pixel art) al que apunta el cursor
    pointAt(sx, sy) {
      const nx = SN.Util.clamp((sx - (S.x + S.w / 2)) / (S.w / 2), -1.2, 1.2);
      const ny = SN.Util.clamp((sy - (S.y + S.h / 2)) / (S.h / 2), -1.2, 1.2);
      this.mouse.tx = MOUSE_BASE.x + nx * 24;
      this.mouse.ty = MOUSE_BASE.y + ny * 12;
    },
    press() { this.click = 0.14; },
    tapKey(code) {
      const k = SN.Desk.keyFor(code);
      if (k) k.press = 0.14;
      const f = Math.floor(Math.random() * 4);
      this.fingers[f] = 0.14;
      if (!k) {
        // Tecla sin dibujo: se hunde la que hay bajo el dedo
        const fx = LEFT_BASE.x + 4 + f * 8;
        const under = SN.Desk.KEYS.find((kk) => fx >= kk.x && fx < kk.x + kk.w && kk.r === 1);
        if (under) under.press = 0.14;
      }
    },
    celebrate() { this.bounce.v = -95; },
    flinch() { this.bounce.v = 60; this.shake = 0.35; },

    draw(g, dt) {
      this.t += dt;
      const m = this.mouse;
      m.x += (m.tx - m.x) * Math.min(1, dt * 14);
      m.y += (m.ty - m.y) * Math.min(1, dt * 14);
      this.click = Math.max(0, this.click - dt);
      for (let i = 0; i < 4; i++) this.fingers[i] = Math.max(0, this.fingers[i] - dt);
      for (const k of SN.Desk.KEYS) if (k.press > 0) k.press = Math.max(0, k.press - dt);
      // Muelle de reacción
      const b = this.bounce;
      b.v += (-b.y * 260 - b.v * 14) * dt;
      b.y += b.v * dt;
      this.shake = Math.max(0, this.shake - dt);
      // Pequeños gestos en reposo / dedos nerviosos durante una operación
      if (this.drumming) {
        this.drumT += dt;
        if (this.drumT > 0.11) { this.drumT = 0; const f = Math.floor(this.t * 9) % 4; this.fingers[f] = 0.09; }
      } else {
        this.idle -= dt;
        if (this.idle <= 0) { this.idle = SN.Util.rand(2.5, 6); this.fingers[Math.floor(Math.random() * 4)] = 0.12; }
      }
      const sx = this.shake > 0 ? Math.round(Math.sin(this.t * 70) * 2) : 0;
      const by = Math.round(b.y);
      drawMouse(g, Math.round(m.x) + sx, Math.round(m.y) + by, this.click > 0);
      drawLeftHand(g, LEFT_BASE.x + sx, LEFT_BASE.y + by, this.fingers);
      drawRightHand(g, Math.round(m.x) + sx, Math.round(m.y) + by, this.click > 0);
    },
  };

  // Rellena un trapecio con lados superior e inferior horizontales (manga), sin antialiasing
  function quad(g, y0, xl0, xr0, y1, xl1, xr1, fill, edge) {
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / Math.max(1, y1 - y0);
      const l = Math.round(xl0 + (xl1 - xl0) * k), r = Math.round(xr0 + (xr1 - xr0) * k);
      R(g, l, y, r - l, 1, fill);
      if (edge) { R(g, l, y, 1, 1, edge); R(g, r - 1, y, 1, 1, edge); }
    }
  }

  function sleeve(g, y0, xl0, xr0, xl1, xr1) {
    quad(g, y0, xl0, xr0, 360, xl1, xr1, P.orange, P.orangeDD);
    // Puño acanalado de la sudadera
    for (let i = 0; i < 5; i++) {
      const y = y0 + i;
      const k = (y - y0) / (360 - y0);
      const l = Math.round(xl0 + (xl1 - xl0) * k), r = Math.round(xr0 + (xr1 - xr0) * k);
      R(g, l + 1, y, r - l - 2, 1, i === 0 ? P.orangeDD : P.orangeD);
      for (let x = l + 2; x < r - 2; x += 3) R(g, x, y, 1, 1, P.orangeDD);
    }
    // Pliegue
    const midY = y0 + 18;
    const k = (midY - y0) / (360 - y0);
    const l = Math.round(xl0 + (xl1 - xl0) * k);
    R(g, l + 6, midY, 10, 1, P.orangeD);
    R(g, l + 4, midY + 10, 14, 1, P.orangeD);
  }

  // Dedo visto desde arriba: contorno, relleno, sombra lateral y uña en la punta
  function finger(g, x, top, bottom, w = 7) {
    R(g, x, top + 1, w, bottom - top - 1, P.skinDD);
    R(g, x + 1, top, w - 2, 1, P.skinDD);
    R(g, x + 1, top + 1, w - 2, bottom - top - 1, P.skin);
    R(g, x + w - 2, top + 3, 1, bottom - top - 3, P.skinM);
    R(g, x + 2, top + 1, w - 4, 3, SKIN_L); // uña
    R(g, x + 1, top + 6, w - 2, 1, P.skinM); // nudillo del dedo
  }

  function drawLeftHand(g, ox, oy, presses) {
    sleeve(g, oy + 20, ox - 4, ox + 40, ox - 28, ox + 34);
    // Dedos sobre las teclas (meñique -> índice); bajan 2 px al pulsar
    const lens = [12, 16, 18, 16];
    for (let i = 0; i < 4; i++) {
      const drop = presses[i] > 0 ? 2 : 0;
      finger(g, ox + 1 + i * 8, oy - lens[i] + drop, oy + 5, i === 0 ? 6 : 7);
    }
    // Pulgar apoyado en la barra espaciadora
    R(g, ox + 32, oy + 9, 11, 9, P.skinDD);
    R(g, ox + 38, oy + 14, 11, 9, P.skinDD);
    R(g, ox + 33, oy + 10, 9, 7, P.skin);
    R(g, ox + 39, oy + 15, 9, 7, P.skin);
    R(g, ox + 43, oy + 15, 4, 3, SKIN_L);
    // Dorso de la mano
    R(g, ox, oy + 2, 36, 22, P.skinDD);
    R(g, ox + 1, oy + 1, 34, 1, P.skinDD);
    R(g, ox + 1, oy + 2, 34, 21, P.skin);
    R(g, ox + 25, oy + 4, 10, 19, P.skinM);
    R(g, ox + 2, oy + 3, 28, 1, SKIN_L);
    for (let i = 0; i < 4; i++) R(g, ox + 3 + i * 8, oy + 6, 3, 1, P.skinM);
    R(g, ox + 6, oy + 15, 14, 1, P.skinM);
  }

  function drawMouse(g, x, y, pressed) {
    // Cable
    Px.line(g, x, y - 15, x - 2, y - 22, P.coal);
    Px.line(g, x - 2, y - 22, x - 10, y - 30, P.coal);
    Px.line(g, x - 10, y - 30, 470, 268, P.coal);
    // Cuerpo
    for (let j = -14; j <= 14; j++) {
      const w = Math.round(10 * Math.sqrt(1 - Math.pow(Math.max(0, Math.abs(j + 2) - 7) / 10, 2)));
      R(g, x - w, y + j, w * 2 + 1, 1, P.coal);
      if (Math.abs(j) < 14) R(g, x - w + 1, y + j, w * 2 - 1, 1, j < -2 ? P.creamL : P.cream);
    }
    if (pressed) R(g, x - 8, y - 13, 8, 11, P.creamD);
    R(g, x, y - 13, 1, 11, P.coal);
    R(g, x - 1, y - 11, 3, 5, P.cyanD); R(g, x - 1, y - 11, 3, 1, P.cyan);
  }

  function drawRightHand(g, mx, my, pressed) {
    sleeve(g, my + 18, mx - 16, mx + 18, mx + 6, mx + 64);
    // Índice y corazón sobre los botones; anular y meñique doblados al lado
    finger(g, mx - 11, my - 16 + (pressed ? 1 : 0), my + 2);
    finger(g, mx - 3, my - 15, my + 2);
    finger(g, mx + 5, my - 10, my + 3, 6);
    finger(g, mx + 11, my - 4, my + 5, 5);
    // Pulgar en el lateral izquierdo del ratón
    R(g, mx - 19, my - 1, 8, 13, P.skinDD);
    R(g, mx - 18, my, 6, 11, P.skin);
    R(g, mx - 18, my, 6, 2, SKIN_L);
    // Palma sobre el ratón
    R(g, mx - 14, my + 1, 31, 20, P.skinDD);
    R(g, mx - 13, my + 1, 29, 19, P.skin);
    R(g, mx + 8, my + 3, 8, 17, P.skinM);
    R(g, mx - 12, my + 2, 22, 1, SKIN_L);
    for (let i = 0; i < 4; i++) R(g, mx - 9 + i * 7, my + 5, 2, 1, P.skinM);
  }

  // Cursor pixel art dentro del monitor (se reescala con el escenario)
  SN.Hands.applyCursor = function (scale) {
    const s = Math.max(1, Math.min(4, Math.round(scale)));
    const mon = document.getElementById('monitor');
    const arrow = `url(${SN.Sprites.url('cursor', s)}) 0 0, default`;
    const hand = `url(${SN.Sprites.url('pointer', s)}) ${3 * s} 0, pointer`;
    mon.style.cursor = arrow;
    let st = document.getElementById('cursor-style');
    if (!st) { st = document.createElement('style'); st.id = 'cursor-style'; document.head.appendChild(st); }
    st.textContent = `#monitor button:not(:disabled), #monitor .mcard:not(.locked), #monitor #slider, #monitor .dlg-catch, #monitor #events:not(.empty), #monitor #chart-wrap, #monitor canvas.clickable { cursor: ${hand}; }`;
  };
})(window.SN);
