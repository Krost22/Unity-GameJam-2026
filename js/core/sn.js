// SALDO NEGRO — espacio de nombres global y utilidades compartidas.
// Todo el juego son scripts clásicos (sin módulos) para que funcione abriendo index.html con file://.
window.SN = window.SN || {};
(function (SN) {
  'use strict';

  SN.VERSION = '1.1';
  SN.W = 640; // resolución de referencia 16:9 del escritorio (px de pixel art)
  SN.H = 360;
  // Pantalla física del monitor dentro del escenario: TODA la interfaz jugable vive aquí
  SN.SCREEN = { x: 108, y: 14, w: 420, h: 236 };
  SN.DEBUG = /[?&]debug\b/.test(location.search);
  SN.Data = SN.Data || {};

  // Paleta oficial + tonos derivados para sombrear el pixel art
  SN.PAL = {
    green: '#55C957', greenL: '#8EE08A', greenD: '#2F8A3C', greenDD: '#1F5E2A',
    yellow: '#FFD447', yellowL: '#FFE98F', yellowD: '#D9A520', yellowDD: '#A8761A',
    coral: '#F05B54', coralL: '#F78F87', coralD: '#C23B36', coralDD: '#8A2724',
    cyan: '#42C5E5', cyanL: '#8EE0F2', cyanD: '#2192B0', cyanDD: '#186A80',
    orange: '#F28B43', orangeL: '#F7B27A', orangeD: '#C9662A', orangeDD: '#8F4520',
    cream: '#F4EBD3', creamL: '#FFFAEC', creamM: '#E6DABB', creamD: '#CDBE98', creamDD: '#A89A78',
    coal: '#30332B', coalL: '#4A4E43', coalM: '#3B3E35', coalD: '#22241E', coalDD: '#171814',
    wood: '#D39A5B', woodM: '#B87A40', woodD: '#94592C', woodDD: '#6E3F1E',
    skin: '#F6C49A', skinM: '#E39E6E', skinD: '#BF7448', skinDD: '#8E4E2C',
    wall: '#F0DDB6', wallM: '#E5CC9E', wallD: '#D6B985',
    white: '#FFFFFF',
  };

  const U = SN.Util = {};
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a); // solo para efectos visuales
  U.randi = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.copy = (o) => JSON.parse(JSON.stringify(o));
  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  };

  // Dinero en formato $1,234.56 (USD)
  U.money = (v, { sign = false, cents = true } = {}) => {
    const abs = Math.abs(v);
    const s = abs.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    const pre = v < 0 ? '-' : (sign ? '+' : '');
    return `${pre}$${s}`;
  };
  U.short = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `$${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
    if (a >= 1e4) return `$${(v / 1e3).toFixed(0)}K`;
    return U.money(v, { cents: a < 1000 });
  };
  U.pct = (v, digits = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;

  // Crea un elemento DOM con clase y contenido
  U.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  // Generador con semilla (mulberry32) para la simulación económica: su estado se guarda con la partida
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      this.s = (this.s + 0x6D2B79F5) | 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    normal() {
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  }
  SN.RNG = RNG;

  // Temporizadores en tiempo de juego (se pausan con el bucle y funcionan en pruebas paso a paso)
  const timers = [];
  SN.after = (sec, fn) => { const t = { left: sec, fn }; timers.push(t); return t; };
  SN.cancel = (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
  SN.wait = (sec) => new Promise((r) => SN.after(sec, r));
  SN.tickTimers = (dt) => {
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i];
      t.left -= dt;
      if (t.left <= 0) { timers.splice(i, 1); t.fn(); }
    }
  };
})(window.SN);
