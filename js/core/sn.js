// SALDO NEGRO — espacio de nombres global y utilidades compartidas.
// Todo el juego son scripts clásicos (sin módulos) para que funcione abriendo index.html con file://.
window.SN = window.SN || {};
(function (SN) {
  'use strict';

  SN.VERSION = '1.5';
  SN.W = 640; // resolución de referencia 16:9 del escritorio (px de pixel art)
  SN.H = 360;
  // Pantalla física del monitor dentro del escenario: TODA la interfaz jugable vive aquí
  SN.SCREEN = { x: 108, y: 14, w: 420, h: 236 };
  SN.DEBUG = /[?&]debug\b/.test(location.search);
  SN.Data = SN.Data || {};

  // Paleta lo-fi neón: noche violeta, luz cálida de ventana y acentos de neón.
  // Las rampas cambian de tono (sombras hacia violeta, luces hacia naranja/amarillo), no solo de brillo.
  // Los nombres antiguos se conservan con el mismo papel (cream = claro, coal = oscuro, green = gana...).
  SN.PAL = {
    green: '#3DDC84', greenL: '#9CF5BE', greenD: '#1E9A5C', greenDD: '#135C45',
    yellow: '#FFD34E', yellowL: '#FFF0A3', yellowD: '#E39A2D', yellowDD: '#9C5A22',
    coral: '#FF4F6D', coralL: '#FF9DB0', coralD: '#C42A52', coralDD: '#7A1640',
    cyan: '#45E3DA', cyanL: '#AEFFF4', cyanD: '#2394B4', cyanDD: '#174C74',
    orange: '#FF8F3F', orangeL: '#FFC27E', orangeD: '#D3502F', orangeDD: '#842B33',
    cream: '#E8E0FA', creamL: '#F8F4FF', creamM: '#D4CAEE', creamD: '#AEA3D2', creamDD: '#8378AC',
    coal: '#231838', coalL: '#3F2F60', coalM: '#2F2249', coalD: '#180F2A', coalDD: '#0E0A1C',
    wood: '#9C4A3E', woodM: '#7A3438', woodD: '#55222F', woodDD: '#331425',
    skin: '#F7B996', skinM: '#E38E72', skinD: '#B85E58', skinDD: '#7E3A47', skinL: '#FFDCC4',
    wall: '#3B2557', wallM: '#2F1D48', wallD: '#24153A',
    white: '#FFFFFF',
    // Habitación e interfaz
    violetDD: '#1F0F3F', violetD: '#3A1E6A', violet: '#6B3FC4', violetL: '#A880FF',
    magentaDD: '#470F3C', magentaD: '#86206A', magenta: '#D33F9C', magentaL: '#FF82CB',
    navyDD: '#070A17', navyD: '#0C1025', navy: '#121835', navyM: '#1A2148', navyL: '#262F62', navyLL: '#38448C',
    // Protagonista y gato
    hairDD: '#26101F', hairD: '#4A1A2A', hair: '#7A2C32', hairM: '#AB4237', hairL: '#E2723F',
    shirtDD: '#3A3162', shirtD: '#6A5D9A', shirt: '#A99CD0', shirtM: '#D2C8EE', shirtL: '#F5F0FF',
    tieD: '#13122C', tie: '#232350', tieL: '#3B3B7A',
    catD: '#120C20', cat: '#1F1733', catL: '#3A2C59', catEye: '#FFD34E', catPink: '#FF8FB4',
    leafDD: '#0D3A35', leafD: '#1A684C', leaf: '#33A35E', leafL: '#8FDB6A',
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

  // Dinero en dólares enteros: $1,234 (sin centavos en ningún sitio)
  U.money = (v, { sign = false } = {}) => {
    const r = Math.round(v);
    const s = Math.abs(r).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const pre = r < 0 ? '-' : (sign ? '+' : '');
    return `${pre}$${s}`;
  };
  U.short = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return `$${Math.round(v / 1e6)}M`;
    if (a >= 1e4) return `$${Math.round(v / 1e3)}K`;
    return U.money(v);
  };
  U.pct = (v, digits = 0) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;

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
