// DeskInteractionController: conecta el ratón y el teclado reales con la escena.
// - El cursor sobre el monitor mueve el ratón de la mesa (y la mano del protagonista con él).
// - Cada clic hace que el protagonista pulse el ratón; cada tecla se hunde en el teclado de la mesa.
// - Las reacciones (celebrar, lamentarse) las interpreta el protagonista (js/render/hero.js).
(function (SN) {
  'use strict';

  SN.Hands = {
    drumming: false, // compatibilidad: el protagonista ya sabe por el juego cuándo hay una operación abierta
    pointAt(sx, sy) { SN.Hero.pointAt(sx, sy); },
    press() { SN.Hero.press(); },
    tapKey(code) {
      const k = SN.Desk.keyFor(code);
      if (k) k.press = 0.14;
    },
    celebrate(big) { SN.Hero.celebrate(big); },
    flinch(big) { SN.Hero.flinch(big); },
  };

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
