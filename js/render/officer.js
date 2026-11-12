// El agente de la Policía Fiscal: el embargo del epílogo del final B (la secuencia está en js/systems/finale.js).
// Entra en la habitación por el lado de la ventana, de cuerpo entero (gorra de cuadros, bigote, chaleco
// reflectante), y se mueve POR DETRÁS de la mesa y del monitor: se le ve a los lados (junto a la ventana y junto a
// la estantería) y, cuando pasa por detrás de la pantalla, solo asoma su mano por debajo para llevarse lo que hay
// en la mesa. Va hasta cada objeto, alarga el brazo, lo coge y lo mete en su caja; al final empuja el PC hasta la
// puerta. Pixel art por código con el kit SN.PK, como el protagonista, dentro del lienzo de la habitación
// (js/render/desk.js lo pinta en dos capas: el cuerpo, detrás de la mesa; el brazo que coge algo, por delante).
// El cuerpo y la cabeza se cachean; los brazos se dibujan en cada fotograma (del hombro a donde esté la mano) y,
// cuando mira a la izquierda, todo se pinta en espejo.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, PK = SN.PK, U = SN.Util;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const RW = 320, RH = 180;
  const DESK_Y = 128;               // el borde de la mesa: por debajo, el agente queda tapado
  const BW = 48, BH = 100, AX = 24; // lienzo del cuerpo (mirando a la derecha) y su eje
  const TOP = 42;                   // y de la habitación donde empieza (la gorra)
  const AW = 200, AH = 230, AO = 100, AY = 30; // lienzo de los brazos: eje y margen de arriba
  const SHOULDER = { back: -14, front: 14, y: 36 };
  const BOXW = 30;                  // la caja del embargo
  const LIGHT = [1, -1];
  const RIM = '#FF6FC4'; // contraluz de la ventana, de noche (como las manos del protagonista)

  const SHIRT = ['#2A3A7A', '#4A64B0', '#7C9BE0', '#AFC6F5', '#DDE8FF'];
  const NAVY = ['#0B0F2A', '#1F2A66', '#33439A', '#5266C8'];
  const VEST = [P.yellowDD, P.yellowD, P.yellow, P.yellowL];
  const SKIN = [P.skinDD, P.skinD, P.skinM, P.skin, P.skinL];
  const HAIR = [P.hairDD, P.hairD, P.hair];
  const CARD = ['#4A3320', '#7A5A2C', '#A0782E', '#C8A048', '#E3C374'];
  const FPAL = { B: P.hairDD, W: P.creamL, I: P.coalDD, M: P.hairD };

  // ---------- Piezas quietas (con caché; la versión en espejo se saca de la original) ----------
  const cache = new Map();
  function flip(src) {
    const c = Px.canvas(src.width, src.height), g = Px.ctx(c);
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  function piece(key, dir, build) {
    if (!cache.has(key)) cache.set(key, build());
    if (dir > 0) return cache.get(key);
    if (!cache.has(key + '|flip')) cache.set(key + '|flip', flip(cache.get(key)));
    return cache.get(key + '|flip');
  }

  // Cuello, camisa celeste de hombros anchos, chaleco reflectante con sus bandas, corbata, placa y cinturón
  function buildBody() {
    const sp = new PK.Sprite(BW, BH);
    sp.part(sp.mask().poly([[21, 22], [28, 22], [29, 30], [20, 30]]), SKIN, { light: LIGHT, base: 1, outline: false });
    const torso = sp.mask().poly([[5, BH], [5, 41], [7, 35], [12, 31], [19, 28], [30, 28], [36, 31], [41, 35], [43, 41], [43, BH]]);
    sp.part(torso, SHIRT, { light: LIGHT, lit: 2, sh: 3 });
    sp.rim(torso, RIM, [-1, -1]);
    // Hombreras
    sp.rect(7, 33, 6, 2, NAVY[1]).rect(36, 33, 6, 2, NAVY[2]);
    // Chaleco: abierto en pico sobre la camisa y la corbata
    // (por abajo cubre todo el torso: de la camisa solo se ven los hombros y las mangas)
    const vest = sp.mask().poly([[6, 80], [6, 44], [9, 36], [13, 32], [18, 29], [24, 38], [30, 29], [35, 32], [39, 36], [42, 44], [42, 80]]);
    sp.part(vest, VEST, { light: LIGHT, lit: 2, sh: 2 });
    sp.line(24, 39, 24, 79, P.yellowD);
    for (const x of [13, 33]) sp.rect(x, 33, 2, 47, P.creamD).rect(x, 33, 1, 47, P.creamL);
    for (const y of [47, 70]) sp.rect(7, y, 35, 1, P.creamL).rect(7, y + 1, 35, 1, P.creamD);
    // Cuello de la camisa y corbata
    sp.part(sp.mask().poly([[19, 28], [23, 30], [22, 34]]).poly([[30, 28], [26, 30], [27, 34]]), SHIRT, { light: LIGHT, base: 3, outline: false });
    sp.part(sp.mask().poly([[23, 30], [26, 30], [26, 33], [24.5, 37], [23, 33]]), NAVY, { light: LIGHT, outline: false });
    // La placa: un escudo dorado sobre un parche oscuro
    sp.rect(27, 40, 5, 5, NAVY[0]).rect(28, 41, 3, 3, P.yellowD).rect(28, 41, 3, 1, P.yellowL).px(29, 42, P.coalD);
    // Cinturón con hebilla
    sp.rect(8, 80, 33, 3, P.coalD).rect(8, 80, 33, 1, P.coalL).rect(22, 80, 4, 3, P.creamD).px(23, 81, P.coalD).px(24, 81, P.coalD);
    sp.part(sp.mask().rect(6, 83, 37, BH - 83), NAVY, { light: LIGHT, base: 1, outline: false });
    return sp.c;
  }

  // Cabeza de tres cuartos: gorra de plato con la banda de cuadros y la placa, cejas en uve, ojos entornados
  // bajo la visera y un bigote enorme. talk: la boca abierta; blink: parpadeo
  function buildHead(talk, blink) {
    const sp = new PK.Sprite(BW, 32);
    // Pelo corto en la nuca, por debajo de la gorra
    sp.part(sp.mask().ellipse(19, 13.5, 2.6, 4.5), HAIR, { light: LIGHT, base: 1 });
    const face = sp.mask().poly([[18, 9], [31, 9], [33, 13], [33, 19], [31, 23], [27, 25], [22, 24], [19, 21], [18, 15]]).ellipse(34, 17, 1.4, 1.8);
    sp.part(face, SKIN, { light: LIGHT, lit: 2, sh: 2 });
    sp.part(sp.mask().ellipse(19.5, 17, 1.4, 2.2), SKIN, { light: LIGHT, base: 2, outline: false });
    sp.px(19, 17, P.skinD);
    // Cejas y ojos
    sp.stamp(['BB..', '..BB'], 24, 12, FPAL).stamp(['.BB', 'B..'], 30, 12, FPAL);
    if (!blink) sp.stamp(['WI'], 25, 14, FPAL).stamp(['WI'], 30, 14, FPAL);
    else sp.rect(25, 14, 2, 1, P.skinD).rect(30, 14, 2, 1, P.skinD);
    // Boca y bigote
    if (talk) sp.rect(28, 21, 2, 2, '#3A1420');
    else sp.rect(28, 21, 2, 1, P.skinDD);
    sp.stamp(['.MMMMMM.', 'MM....MM'], 25, 19, FPAL);
    // Gorra: copa, banda de cuadros y visera (que da sombra a la frente)
    const crown = sp.mask().poly([[15, 9], [16, 4], [20, 1], [27, 0], [32, 2], [35, 6], [35, 9]]);
    sp.part(crown, NAVY, { light: LIGHT, lit: 1, sh: 1, base: 1 });
    sp.rim(crown, RIM, [-1, -1]);
    for (let x = 16; x < 35; x++) { const a = ((x - 16) >> 1) % 2; sp.px(x, 7, a ? P.creamL : NAVY[0]).px(x, 8, a ? NAVY[0] : P.creamL); }
    sp.part(sp.mask().poly([[25, 9], [36, 9], [38, 11], [26, 11]]), [P.coalDD, P.coalD, P.coal, P.coalL], { light: LIGHT, cast: 1 });
    sp.rect(27, 2, 3, 4, P.yellowD).rect(28, 3, 1, 2, P.yellowL);
    return sp.c;
  }

  // La caja del embargo, en dos capas (lo que se lleva asoma entre las dos): el fondo con la solapa de detrás,
  // y el frente con su precinto
  function buildBox(front) {
    const sp = new PK.Sprite(BOXW + 4, 28);
    if (!front) {
      sp.part(sp.mask().poly([[5, 9], [BOXW - 1, 9], [BOXW - 3, 4], [7, 4]]), CARD, { light: LIGHT, base: 1, lit: 1, sh: 1 });
      sp.rect(3, 8, BOXW - 2, 3, CARD[0]);
      return sp.c;
    }
    sp.part(sp.mask().rect(2, 9, BOXW, 16), CARD, { light: LIGHT, lit: 1, sh: 2, base: 2 });
    sp.rect(2, 9, BOXW, 1, CARD[4]);
    // Precinto rojo y etiqueta
    sp.rect(2, 19, BOXW, 2, P.coralD);
    for (let x = 3; x < BOXW + 1; x += 4) sp.rect(x, 19, 2, 2, P.creamL);
    sp.rect(10, 11, 14, 7, P.coralD).rect(11, 12, 12, 5, P.creamL).rect(13, 13, 8, 1, P.coralD).rect(13, 15, 5, 1, P.creamDD);
    return sp.c;
  }

  // Lo que no está en las capas de la habitación: el reloj (va en tu muñeca) y la lista del embargo
  const WATCH = () => Px.fromRows(['.YYYYYYY.', 'YyyWWWyyY', 'YyyWkWyyY', 'YyyWWWyyY', '.YYYYYYY.'], { Y: P.yellowD, y: P.yellow, W: P.creamL, k: P.coalD });
  function drawList(g, x, y) {
    R(g, x, y, 10, 13, P.creamDD); R(g, x + 1, y, 9, 12, P.creamL);
    R(g, x + 2, y + 2, 7, 1, P.coralD);
    for (let i = 0; i < 4; i++) R(g, x + 2, y + 4 + i * 2, i % 2 ? 5 : 7, 1, P.creamDD);
  }

  // ---------- Brazos: del hombro a la mano (coordenadas del lienzo de los brazos) ----------
  // Casi rectos: el codo se dobla muy poco (bend: hacia qué lado), para que no se retuerzan. Si la mano queda
  // más lejos que el brazo, se estira.
  let armSp = null;
  function drawArm(sp, sx, sy, hx, hy, bend, finger) {
    const L = 14;
    const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
    const h = d < L * 2 ? Math.min(2.5, Math.sqrt(L * L - d * d / 4)) * bend : 0;
    const ex = sx + dx / 2 - dy / d * h, ey = sy + dy / 2 + dx / d * h;
    const fl = Math.hypot(hx - ex, hy - ey) || 1, ux = (hx - ex) / fl, uy = (hy - ey) / fl;
    sp.part(sp.mask().taper(sx, sy, 3.6, ex, ey, 3.2).taper(ex, ey, 3.2, hx - ux * 3, hy - uy * 3, 2.7), SHIRT, { light: LIGHT, lit: 1, sh: 2 });
    sp.part(sp.mask().capsule(hx - ux * 4, hy - uy * 4, hx - ux * 3, hy - uy * 3, 2.9), NAVY, { light: LIGHT, lit: 1, sh: 1, base: 2 });
    const hand = sp.mask().ellipse(hx, hy, 2.7, 2.7).ellipse(hx + ux * 1.5, hy + uy * 1.5, 2.2, 2.2);
    if (finger) hand.capsule(hx + ux * 2, hy + uy * 2 - 1, hx + ux * 7, hy + uy * 7 - 1, 1.2); // el índice, estirado
    sp.part(hand, SKIN, { light: LIGHT, lit: 1, sh: 1, base: 3 });
  }

  // ---------- Animaciones: valores que cambian con el tiempo del juego (como SN.wait) ----------
  const tweens = [];
  const lin = (k) => k;
  function tween(dur, step, ease = U.ease.inOutSine) {
    return new Promise((res) => { step(0); tweens.push({ t: 0, dur: Math.max(0.01, dur), step, ease, res }); });
  }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  const O = SN.Officer = {
    on: false,
    x: -40, dir: 1,
    walking: false, walkT: 0, t: 0,
    rise: 0,        // un saltito, para lo que está alto (px)
    box: false, dip: 0,
    loot: [],       // lo que ya va en la caja: { img, w, h }
    taken: [],      // los ids de lo que se ha llevado
    near: [],       // lo que está en la mesa por delante de él y lo tapa: { id, cut }
    reach: null,    // la mano de delante, de camino: { ax, ay, bx, by, k }
    held: null,     // lo que lleva en esa mano: { img, w, h, s }
    carry: null,    // lo que lleva de pie en la mano, sin guardarlo (la pala): { img, rot }
    drag: null,     // el PC, empujado: { img, x, y, x0 }
    grip: false,    // la mano de delante, en el borde del monitor (lo empuja)
    point: false,   // señala con el brazo estirado
    prop: null,     // 'list': la lista del embargo en la mano
    talk: false,    // mueve la boca mientras sale su subtítulo

    reset() {
      tweens.length = 0;
      Object.assign(this, { on: false, x: -40, dir: 1, walking: false, rise: 0, box: false, dip: 0, loot: [], taken: [], near: [],
        reach: null, held: null, carry: null, drag: null, grip: false, point: false, prop: null, talk: false });
    },

    // ---------- Lo que sabe hacer (cada cosa devuelve una promesa que se cumple al acabar) ----------
    walkTo(x, speed = 80) {
      const x0 = this.x, d = Math.abs(x - x0);
      if (d < 1) return Promise.resolve();
      this.dir = x > x0 ? 1 : -1;
      this.walking = true;
      return tween(d / speed, (k) => { this.x = x0 + (x - x0) * k; }, lin).then(() => { this.walking = false; });
    },
    // Entra por la izquierda (el lado de la ventana) y va hasta x
    async enter(x, speed) {
      this.on = true;
      Object.assign(this, { x: -26, dir: 1, rise: 0, box: false, loot: [] });
      await this.walkTo(x, speed);
    },
    // Se va por donde ha venido
    async leave(speed) {
      await this.walkTo(-30, speed);
      this.on = false;
    },
    // Lo que hay en la mesa por delante de él (la consola, los auriculares del monitor...): se pinta encima
    occlude(ids) {
      this.near = ids.map((id) => ({ id, cut: SN.Desk.cutout(id) })).filter((n) => n.cut);
    },

    // Va hasta un objeto de la habitación, lo coge y lo mete en la caja. pace: < 1, cada vez con más prisa
    async take(id, pace = 1) {
      const Dk = SN.Desk;
      // (el reloj no está en la habitación: está en tu muñeca, por debajo del plano)
      const cut = id === 'reloj' ? { img: WATCH(), x: 100, y: 172, w: 9, h: 5 } : Dk.cutout(id);
      this.taken.push(id);
      if (!cut) { Dk.stripped.add(id); Dk.dirty(); return; }
      // (lo que está en la mesa lo agarra por abajo: así, cuando él va por detrás del monitor, se ve bajar el brazo)
      const cx = cut.x + cut.w / 2, onDesk = cut.y + cut.h / 2 > DESK_Y;
      const cy = Math.min(174, onDesk ? Math.max(cut.y + cut.h * 0.7, DESK_Y + 14) : cut.y + cut.h / 2);
      // Se pone a su altura (por detrás del monitor, si hace falta), con el objeto un poco por delante
      const s = Math.abs(cx - this.x) < 2 ? this.dir : Math.sign(cx - this.x);
      await this.walkTo(U.clamp(cx - s * 11, 18, 302), 95 / pace);
      this.dir = cx >= this.x ? 1 : -1;
      // Lo que está alto, de un saltito
      const up = U.clamp(TOP + SHOULDER.y - 30 - cy, 0, 22);
      const a = this.frontRest();
      this.reach = { ax: a.x, ay: a.y, bx: cx, by: cy, k: 0 };
      await tween(0.32 * pace, (k) => { this.reach.k = k; this.rise = up * k; }, U.ease.outCubic);
      // Lo coge: desaparece de la habitación y va en su mano
      SN.Audio.sfx('whoosh');
      Dk.stripped.add(id);
      Dk.dirty();
      this.near = this.near.filter((n) => n.id !== id).map((n) => (overlap(n.cut, cut) ? { id: n.id, cut: Dk.cutout(n.id) } : n)).filter((n) => n.cut);
      this.held = { img: cut.img, w: cut.w, h: cut.h, s: 1 };
      await SN.wait(0.12 * pace);
      // A la caja (encogiéndose: dentro cabe todo)
      const s1 = Math.min(1, 10 / Math.max(cut.w, cut.h)), m = this.boxMouth();
      this.reach = { ax: cx, ay: cy, bx: m.x, by: m.y - 3, k: 0 };
      await tween(0.4 * pace, (k) => { this.reach.k = k; this.rise = up * (1 - k); this.held.s = U.lerp(1, s1, k); });
      this.loot.push({ img: cut.img, w: Math.max(3, Math.round(cut.w * s1)), h: Math.max(3, Math.round(cut.h * s1)) });
      this.held = null;
      this.reach = null;
      this.dip = 1;
      SN.Audio.sfx('drop');
      await SN.wait(0.12 * pace);
    },

    // La pala: la coge de su rincón y se la queda en la mano, de pie
    async takePala() {
      const Dk = SN.Desk, cx = 314, cy = 110;
      await this.walkTo(cx - 20, 110);
      this.dir = 1;
      const a = this.frontRest();
      this.reach = { ax: a.x, ay: a.y, bx: cx, by: cy, k: 0 };
      await tween(0.3, (k) => { this.reach.k = k; }, U.ease.outCubic);
      SN.Audio.sfx('whoosh');
      this.carry = { img: Dk.palaSprite(), rot: 0 };
      Dk.palaPos = 'held';
      Dk.dirty();
      const r = this.frontRest();
      this.reach = { ax: cx, ay: cy, bx: r.x, by: r.y, k: 0 };
      await tween(0.3, (k) => { this.reach.k = k; });
      this.reach = null;
    },
    // ...y te la deja en el escritorio: te la tiende por encima de la mesa, se inclina y la tumba delante de ti
    async givePala() {
      const Dk = SN.Desk, to = Dk.PALA_DESK, lean = 16;
      // Te la tiende: el brazo estirado hacia ti, la pala todavía casi de pie
      const a = this.frontRest(), mid = { x: to.x - 2, y: DESK_Y - 12 };
      this.reach = { ax: a.x, ay: a.y, bx: mid.x, by: mid.y, k: 0 };
      await tween(0.4, (k) => { this.reach.k = k; this.carry.rot = 0.3 * k; }, U.ease.outCubic);
      await SN.wait(0.35);
      // La baja hasta la madera, tumbándola, mientras se inclina sobre la mesa
      this.reach = { ax: mid.x, ay: mid.y, bx: to.x - 2, by: to.y, k: 0 };
      await tween(0.6, (k) => { this.reach.k = k; this.rise = -lean * k; this.carry.rot = 0.3 + 0.7 * k; });
      SN.Audio.sfx('thud');
      SN.FX.shake(2, 0.15);
      this.carry = null;
      Dk.palaPos = 'desk';
      Dk.dirty();
      // La mano se queda un momento encima: es tuya
      await SN.wait(0.5);
      // Se incorpora
      this.rise = 0;
      const r = this.frontRest();
      this.rise = -lean;
      this.reach = { ax: to.x - 2, ay: to.y, bx: r.x, by: r.y, k: 0 };
      await tween(0.35, (k) => { this.reach.k = k; this.rise = -lean * (1 - k); });
      this.reach = null;
    },

    // El PC: lo apaga y lo empuja por la mesa hasta la puerta. Él va detrás, así se le ve todo el camino
    // (hay que llamarlo con el agente a la derecha del monitor)
    async takePC() {
      const Dk = SN.Desk, cut = Dk.cutout('pc');
      this.dir = -1;
      this.grip = true;
      await SN.wait(0.4);
      SN.Audio.sfx('powerOff');
      document.getElementById('monitor').classList.add('hidden');
      if (cut) this.drag = { img: cut.img, x: cut.x, y: cut.y, x0: this.x };
      Dk.noPC = true;
      Dk.dirty();
      this.taken.push('pc');
      await SN.wait(0.5);
      SN.Hero.catDo('arch', 2.6, 'hiss'); // la mesa entera se le viene encima al gato
      await this.walkTo(this.x - 340, 105);
      this.drag = null;
      this.grip = false;
      this.on = false;
    },

    // ---------- Dónde tiene las manos (coordenadas de la habitación) ----------
    bodyY() { return TOP - Math.round(this.rise) + (this.walking ? Math.round(Math.abs(Math.sin(this.walkT * 11)) * 1.6) : 0); },
    boxMouth() { return { x: Math.round(this.x) + this.dir * 2, y: this.bodyY() + 52 + Math.round(this.dip * 2) }; },
    frontRest() {
      const X = Math.round(this.x), by = this.bodyY(), d = this.dir;
      if (this.grip) return { x: X + d * 21, y: by + 42 };
      if (this.carry) return { x: X + d * 23, y: by + 42 }; // a un lado y en alto: que se vea entera
      if (this.point) return { x: X + d * 30, y: by + 44 };
      if (this.prop === 'list') return { x: X + d * 13, y: by + 54 };
      if (this.box) { const m = this.boxMouth(); return { x: m.x + d * (BOXW / 2 + 1), y: m.y + 10 }; }
      return { x: X + d * 17, y: by + 64 + (this.walking ? Math.round(Math.sin(this.walkT * 11) * 2) : 0) };
    },
    backRest() {
      const X = Math.round(this.x), by = this.bodyY(), d = this.dir;
      if (this.box) { const m = this.boxMouth(); return { x: m.x - d * (BOXW / 2 + 1), y: m.y + 10 }; }
      return { x: X - d * 17, y: by + 64 - (this.walking ? Math.round(Math.sin(this.walkT * 11) * 2) : 0) };
    },
    // La mano de delante está ocupada por delante de la mesa (cogiendo algo o empujando el PC)
    busy() { return !!(this.reach || this.grip); },

    // ---------- Cada fotograma (lo llama js/render/desk.js) ----------
    update(dt) {
      this.t += dt;
      if (this.walking) {
        const s0 = Math.floor(this.walkT * 11 / Math.PI);
        this.walkT += dt;
        if (Math.floor(this.walkT * 11 / Math.PI) !== s0 && this.on) SN.Audio.sfx(this.drag ? 'drag' : 'step');
      }
      this.dip = Math.max(0, this.dip - dt * 6);
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        tw.step(tw.ease(tw.t));
        if (tw.t >= 1) { tweens.splice(i, 1); tw.res(); }
      }
    },

    // Brazos en su lienzo y de ahí a la habitación (en espejo si mira a la izquierda)
    arms(g, which) {
      const X = Math.round(this.x), d = this.dir, by = this.bodyY();
      if (!armSp) armSp = new PK.Sprite(AW, AH);
      armSp.g.clearRect(0, 0, AW, AH);
      const lx = (rx) => AO + (rx - X) * d, sy = by + SHOULDER.y + AY;
      if (which.back) { const b = this.backRest(); drawArm(armSp, AO + SHOULDER.back, sy, lx(b.x), b.y + AY, 1); }
      if (which.front) {
        const f = this.frontHand(), fx = lx(f.x), fy = f.y + AY;
        const across = Math.abs(fx - AO - SHOULDER.front) > Math.abs(fy - sy);
        drawArm(armSp, AO + SHOULDER.front, sy, fx, fy, across ? 1 : -1, this.point && !this.reach);
      }
      if (d > 0) g.drawImage(armSp.c, X - AO, -AY);
      else { g.save(); g.translate(X + AO, -AY); g.scale(-1, 1); g.drawImage(armSp.c, 0, 0); g.restore(); }
    },
    frontHand() {
      const r = this.reach;
      return r ? { x: U.lerp(r.ax, r.bx, r.k), y: U.lerp(r.ay, r.by, r.k) } : this.frontRest();
    },
    // Lo que lleva de pie en la mano (la pala), agarrado por el mango; al dejarlo en la mesa, se va tumbando
    drawCarry(g) {
      const c = this.carry, f = this.frontHand();
      g.save();
      g.translate(Math.round(f.x), Math.round(f.y));
      g.rotate(-Math.PI / 2 * c.rot);
      g.drawImage(c.img, -Math.round(c.img.width / 2), -Math.round(c.img.height * 0.45));
      g.restore();
    },

    // Capa de atrás: el cuerpo, la caja y los brazos en reposo, por detrás de la mesa y del monitor (solo se ve a
    // los lados de la pantalla y por encima del borde de la mesa; sin PC, a todo lo ancho)
    drawBack(g, dt) {
      this.update(dt);
      if (!this.on) return;
      const noPC = SN.Desk.noPC, M = SN.Desk.MON;
      const X = Math.round(this.x), d = this.dir, by = this.bodyY();
      g.save();
      g.beginPath();
      if (noPC) g.rect(0, 0, RW, DESK_Y);
      else { g.rect(0, 0, M.x, DESK_Y); g.rect(M.x + M.w, 0, RW - M.x - M.w, DESK_Y); }
      g.clip();
      // Cuerpo y cabeza (la cabeza se mueve un píxel al andar y al hablar)
      const say = SN.Cine && SN.Cine.say_;
      const mouth = this.talk && say && say.shown < say.full.length && Math.floor(this.t * 9) % 2 === 0;
      const blink = (this.t % 3.4) > 3.27;
      const nod = this.walking ? (Math.sin(this.walkT * 11 + 0.9) > 0 ? 1 : 0) : (mouth ? 1 : 0);
      g.drawImage(piece('body', d, buildBody), X - AX, by);
      g.drawImage(piece(`head|${mouth ? 1 : 0}|${blink ? 1 : 0}`, d, () => buildHead(mouth, blink)), X - AX, by + nod);
      // La caja, con lo que ya lleva dentro asomando
      if (this.box) {
        const m = this.boxMouth(), bx = m.x - BOXW / 2 - 2, top = m.y - 9;
        g.drawImage(piece('box0', 1, () => buildBox(false)), bx, top);
        this.loot.forEach((it, i) => g.drawImage(it.img, bx + 4 + ((i * 7) % (BOXW - 10)), m.y + 3 - it.h - Math.min(5, (i >> 2) * 2), it.w, it.h));
        g.drawImage(piece('box1', 1, () => buildBox(true)), bx, top);
      }
      if (this.carry && !this.busy()) this.drawCarry(g);
      this.arms(g, { back: true, front: !this.busy() });
      if (this.prop === 'list' && !this.reach) { const f = this.frontRest(); drawList(g, f.x - 5, f.y - 13); }
      g.restore();
      // Lo que tiene por delante en la mesa lo tapa
      for (const n of this.near) g.drawImage(n.cut.img, n.cut.x, n.cut.y);
    },

    // Capa de delante: el PC que empuja y el brazo que alarga por encima de la mesa (con lo que acaba de coger).
    // Detrás del monitor no se ve: la mano asoma por debajo de la pantalla
    drawFront(g) {
      if (this.drag) {
        // El PC, de camino a la puerta (con el ratón encima de la alfombrilla), dando tumbos
        const dx = Math.round(this.x - this.drag.x0), wob = this.walking && Math.sin(this.walkT * 22) > 0 ? 1 : 0;
        g.drawImage(this.drag.img, this.drag.x + dx, this.drag.y + wob);
        const H = SN.Desk.HANDS;
        g.drawImage(SN.Hero.mouseOnly(), H.mx - 24 + dx, H.my - 13 + wob);
      }
      if (!this.on || !this.busy()) return;
      const M = SN.Desk.MON;
      g.save();
      if (!SN.Desk.noPC) {
        g.beginPath();
        g.rect(0, 0, RW, RH);
        g.rect(M.x, 0, M.w, M.y + M.h);
        g.clip('evenodd');
      }
      if (this.held) {
        const h = this.held, f = this.frontHand(), w = Math.max(2, Math.round(h.w * h.s)), hh = Math.max(2, Math.round(h.h * h.s));
        g.drawImage(h.img, Math.round(f.x - w / 2), Math.round(f.y - hh / 2), w, hh);
      }
      if (this.carry) this.drawCarry(g);
      this.arms(g, { front: true });
      g.restore();
    },
  };
})(window.SN);
