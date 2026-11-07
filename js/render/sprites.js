// Sprites pixel art pequeños (iconos, monedas, cursor). Cada uno es un dibujo en texto:
// una letra = un color de la paleta (ver SN.Px.KEY), '.' = transparente.
// Para reemplazarlos por arte final basta con cambiar estas filas o cargar una imagen con el mismo nombre.
(function (SN) {
  'use strict';
  const Px = SN.Px;

  const DEFS = {
    // --- Mercados (12x12) ---
    salud: [
      '...kkkkkk...',
      '...khhhgk...',
      '...khgggk...',
      'kkkkhgggkkkk',
      'khhhhggggggk',
      'khgggggggggk',
      'khgggggggGGk',
      'kGGGgggGGGGk',
      'kkkkgggGkkkk',
      '...kgggGk...',
      '...kGGGGk...',
      '...kkkkkk...',
    ],
    tecno: [
      '..y.y..y.y..',
      '.kkkkkkkkkk.',
      'ykcccccccCky',
      '.kcbbbbbbCk.',
      'ykcbkkkkbCky',
      '.kcbkyykbCk.',
      'ykcbkyykbCky',
      '.kcbkkkkbCk.',
      'ykcbbbbbbCky',
      '.kCCCCCCCCk.',
      '.kkkkkkkkkk.',
      '..y.y..y.y..',
    ],
    negocios: [
      '.kkkkkkkkkk.',
      'kowowowowowk',
      'kowowowowowk',
      'kkkkkkkkkkkk',
      '.kwwwwwwwwk.',
      '.kwkkkwkkkk.',
      '.kwkbkwkggk.',
      '.kwkkkwkggk.',
      '.kwwwwwkgyk.',
      '.kwwwwwkggk.',
      '.kdddddkggk.',
      'kkkkkkkkkkkk',
    ],
    mineria: [
      '......w.....',
      '.....www....',
      '..kkkkwkk...',
      '.kuuuuuuuk..',
      'kyyyyyyyyYk.',
      'kYYYYYYYYYk.',
      'kkkkkkkkkkkk',
      'kuuuuukuuuuk',
      'kyyyyYkyyyyk',
      'kyyyyYkyyyYk',
      'kYYYYYkYYYYk',
      'kkkkkkkkkkkk',
    ],
    lock: [
      '..kkkk..',
      '.kk..kk.',
      '.k....k.',
      '.k....k.',
      'kkkkkkkk',
      'kyyyyyyk',
      'kyyykyyk',
      'kyyykyyk',
      'kYYYYYYk',
      'kkkkkkkk',
    ],
    // --- Mejoras (12x12) ---
    trebol: [
      '..kk..kk....',
      '.khgkkhgk...',
      '.kgggggGk...',
      'kkgggggGkk..',
      'khgggggggGk.',
      'kgGGgggGGGk.',
      '.kkkgggkkk..',
      '...kGGGk....',
      '....kGk.....',
      '.....kGk....',
      '......kGk...',
      '.......k....',
    ],
    caja: [
      '............',
      '..kkkkkkkk..',
      '.kuuuuuuuuk.',
      '.kyyyyyyyYk.',
      '.kkkkkkkkkk.',
      '.kuuuuuuuuk.',
      '.kyyyyyyyYk.',
      '.kkkkkkkkkk.',
      '.kuuuuuuuuk.',
      '.kyyyyyyyYk.',
      '.kYYYYYYYYk.',
      '..kkkkkkkk..',
    ],
    lupa: [
      '..kkkk......',
      '.kbbwbk.....',
      'kbbwbbbk....',
      'kbwbbbbk....',
      'kbbbbbCk....',
      'kbbbbCCk....',
      '.kCCCCk.....',
      '..kkkkok....',
      '......kok...',
      '.......kok..',
      '........kok.',
      '.........kk.',
    ],
    escudo: [
      '.kkkkkkkkkk.',
      '.kqqqqqqqok.',
      '.kqoooooOok.',
      '.kqoooooOok.',
      '.kqoooooOok.',
      '.kqoooooOok.',
      '..kqooooOk..',
      '..kqoooOOk..',
      '...kqoOOk...',
      '....kOOk....',
      '.....kk.....',
      '............',
    ],
    // --- Calavera de la liquidación (7x6) y llama de la racha (7x8) ---
    skull: ['.kkkkk.', 'kwwwwwk', 'kwkwkwk', 'kwwwwwk', '.kwkwk.', '..kkk..'],
    // --- Moneda girando (8x8, 4 fotogramas) ---
    coin0: ['..kkkk..', '.kuuuyk.', 'kuyyyyYk', 'kuyYyyYk', 'kuyYyyYk', 'kuyyyyYk', '.kyYYYk.', '..kkkk..'],
    coin1: ['...kkk..', '..kuyYk.', '.kuyyYk.', '.kuyYYk.', '.kuyYYk.', '.kuyyYk.', '..kYYk..', '...kkk..'],
    coin2: ['...kk...', '...kYk..', '...kYk..', '...kYk..', '...kYk..', '...kYk..', '...kYk..', '...kk...'],
    coin3: ['..kkk...', '.kuyYk..', '.kuyyYk.', '.kuYyYk.', '.kuYyYk.', '.kuyyYk.', '..kYYk..', '..kkk...'],
    // --- FUTURO.exe ---
    app: ['..kkkk..', '.kyggyk.', 'kyggggyk', 'kyyggyyk', 'kyyggyyk', 'kyyggyyk', '.kyyyyk.', '..kkkk..'],
    appBig: [
      '....kkkkkkkk....',
      '..kkyyyyyyyykk..',
      '.kyyuuuuyyyyyyk.',
      '.kyuyyyhgyyyyYk.',
      'kyuyyyhgggyyyyYk',
      'kyuyyhgggggyyyYk',
      'kyyyyyyggyyyyyYk',
      'kyyyyyyggyyyyyYk',
      'kyyyyyyggyyyyyYk',
      'kyyyykyggykyyyYk',
      'kyyyyykggkyyyyYk',
      '.kyyyyykkyyyyYk.',
      '.kYyyyyyyyyyYYk.',
      '..kkYYYYYYYYkk..',
      '....kkkkkkkk....',
      '................',
    ],
    // --- Cursor del ratón (9x13) ---
    cursor: [
      'k........',
      'kk.......',
      'kwk......',
      'kwwk.....',
      'kwwwk....',
      'kwwwwk...',
      'kwwwwwk..',
      'kwwwwwwk.',
      'kwwwwkkkk',
      'kwkwwk...',
      'kk.kwwk..',
      'k...kwk..',
      '.....k...',
    ],
    pointer: [
      '...kk....',
      '..kwwk...',
      '..kwwk...',
      '..kwwkkk.',
      '..kwwkwwk',
      'kkkwwwwwk',
      'kwkwwwwwk',
      'kwwwwwwwk',
      '.kwwwwwwk',
      '..kwwwwk.',
      '...kwwwk.',
      '...kkkkk.',
      '.........',
    ],
  };

  const cache = {};
  const urls = {};
  SN.Sprites = {
    DEFS,
    get(name) {
      if (!cache[name]) cache[name] = Px.fromRows(DEFS[name]);
      return cache[name];
    },
    // Data URL escalada (fondos CSS, cursores)
    url(name, scale = 1) {
      const k = name + '@' + scale;
      if (!urls[k]) urls[k] = Px.scaled(this.get(name), scale).toDataURL();
      return urls[k];
    },
    // Canvas pequeño listo para insertar en el DOM
    node(name, scale = 1) {
      const src = this.get(name);
      const c = Px.scaled(src, scale);
      c.style.width = c.width + 'px';
      c.style.height = c.height + 'px';
      return c;
    },
    coinFrame(t) { return this.get('coin' + (Math.floor(t) % 4)); },
  };
})(window.SN);
