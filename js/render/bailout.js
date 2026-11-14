// Rescate bancario: la vida extra antes de perder del todo (una por meta, js/systems/bankruptcy.js).
// 1) EL TELÉFONO, en primera persona (como todo el juego: solo se ven tus manos). Llamas a la Línea de Rescate
//    Financiero del Gobierno: las personas no se rescatan y los bancos pequeños tampoco; hay que ser un banco
//    MUY grande. Escribes el nombre de tu banco (cualquier tecla pone las letras, como en Mensajín), te ponen en
//    espera... y entra una videollamada.
// 2) LA VIDEOLLAMADA con Donald Trompa (la parodia de las noticias) en su despacho dorado: gesticula, firma la
//    orden con su rotulador (plano detalle de la firma), la enseña a cámara y aplasta el botón rojo, que imprime
//    el dinero. Tu cara sale en la ventanita de la llamada. Su firma esconde una letra del idioma secreto.
// Pixel art por código con el kit SN.PK (mismas rampas, contornos y contraluz que el protagonista), en un búfer
// de 160x90 ampliado 4x como los primeros planos; los textos de las pantallas van a la resolución del escenario.
// Las piezas se cachean por pose: cada fotograma solo compone imágenes.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, U = SN.Util, PK = SN.PK;
  const R = (g, x, y, w, h, c) => Px.rect(g, x, y, w, h, c);
  const W = 160, H = 90, Z = 4;
  const TX = () => SN.Data.story.rescue;
  const $ = (id) => document.getElementById(id);

  // ---------- Rampas (de oscuro a claro) ----------
  const TAN = ['#6A2A22', '#A4472D', '#D46C3A', '#EF8F4E', '#FFBE7C']; // el bronceado naranja
  const PALE = '#FFD5A1';                                               // la marca blanca de las gafas de sol
  const HAIR = [P.yellowDD, P.yellowD, P.yellow, P.yellowL, P.creamL];
  const SUIT = ['#0B0F2A', P.navyM, P.navyL, P.navyLL, '#5563B0'];
  const SHIRT = [P.creamDD, P.creamD, P.creamM, P.cream, P.creamL];
  const TIE = [P.coralDD, P.coralD, P.coral, P.coralL];
  const GOLD = [P.yellowDD, P.yellowD, P.yellow, P.yellowL];
  const WOOD = [P.woodDD, P.woodD, P.woodM, P.wood];
  const LEATHER = [P.coalDD, P.coalD, P.coal, P.coalL];
  const SKIN = [P.skinDD, P.skinD, P.skinM, P.skin, P.skinL];     // las manos del protagonista
  const SLEEVE = [P.shirtDD, P.shirtD, P.shirt, P.shirtM, P.shirtL];
  const PHONE = [P.coalDD, P.coalD, P.coal, P.coalL, '#5B4888'];
  const LIGHT = [1, -1];        // el foco de la cámara: delante, arriba a la derecha
  const BACK = P.orangeL;       // contraluz: el atardecer de la ventana del despacho
  const NIGHT = '#FF6FC4';      // contraluz de tu cuarto, de noche (como las manos de la partida)

  const cache = new Map();
  const cached = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

  // =====================================================================================================
  // EL DESPACHO
  // =====================================================================================================
  // Pared, ventana con el atardecer (y la ciudad), cortinas doradas y banderas. Trompa tapa el centro.
  function buildOffice() {
    const c = Px.canvas(W, H), g = Px.ctx(c);
    R(g, 0, 0, W, H, '#8F82BC');
    for (let x = 2; x < W; x += 10) { R(g, x, 0, 1, H, '#8174AE'); R(g, x + 1, 0, 1, H, '#A194CC'); }
    // Ventana: cielo por franjas, el sol y la ciudad
    const wx = 48, wy = 9, ww = 64, wh = 50;
    const sky = [P.violetD, P.violet, P.magentaD, P.magenta, P.coralD, P.coral, P.orange];
    sky.forEach((col, i) => R(g, wx, wy + i * 7, ww, 7, col));
    R(g, wx, wy + 49, ww, 1, P.orangeL);
    Px.ellipse(g, wx + 51, wy + 38, 6, 6, P.yellow); Px.ellipse(g, wx + 51, wy + 38, 4, 4, P.yellowL);
    const city = [[0, 11], [6, 18], [12, 8], [17, 22], [25, 13], [31, 26], [39, 10], [45, 19], [51, 14], [57, 24]];
    for (const [x, h] of city) {
      R(g, wx + x, wy + wh - h, 6, h, P.violetDD);
      R(g, wx + x, wy + wh - h, 6, 1, P.violetD);
      for (let yy = wy + wh - h + 2; yy < wy + wh - 1; yy += 3) for (let xx = wx + x + 1; xx < wx + x + 5; xx += 2) if ((xx * 7 + yy * 3) % 5 === 0) R(g, xx, yy, 1, 1, P.yellow);
    }
    // En la azotea de la derecha, alguien con capucha. Nadie más lo ve.
    const hx = wx + 59, hy = wy + wh - 24 - 6;
    R(g, hx - 1, hy + 1, 3, 5, P.coalDD); Px.ellipse(g, hx, hy + 1, 1.5, 1.5, P.coalDD); R(g, hx, hy + 1, 1, 1, P.yellow);
    // Marco y parteluces
    R(g, wx - 3, wy - 3, ww + 6, 3, P.creamL); R(g, wx - 3, wy + wh, ww + 6, 3, P.creamL);
    R(g, wx - 3, wy, 3, wh, P.creamL); R(g, wx + ww, wy, 3, wh, P.creamL);
    R(g, wx + 31, wy, 2, wh, P.creamM); R(g, wx, wy + 24, ww, 2, P.creamM);
    R(g, wx - 3, wy + wh + 3, ww + 6, 1, '#7A6EA8');
    // Banderas: rayas y estrellas a la izquierda; azul con el sello dorado a la derecha
    flag(g, 32, 13, true);
    flag(g, 127, 13, false);
    // Cortinas doradas a los lados, recogidas con un cordón, y la galería de arriba
    curtain(g, 0, 27, 1);
    curtain(g, 133, 27, -1);
    for (let x = 0; x < W; x++) {
      const k = x % 10;
      R(g, x, 0, 1, 6, k < 2 ? P.yellowD : k < 7 ? P.yellow : P.yellowD);
      const drop = Math.round(Math.sin((k / 10) * Math.PI) * 2);
      R(g, x, 6, 1, drop, P.yellowD); R(g, x, 6 + drop, 1, 1, P.yellowDD);
    }
    R(g, 0, 1, W, 1, P.yellowL);
    // Alfombra azul con estrellas (asoma a los lados de la mesa)
    R(g, 0, 82, W, 8, P.navyM);
    for (let x = 3; x < W; x += 9) R(g, x, 85 + (x % 2), 1, 1, P.yellowD);
    return c;
  }
  function flag(g, x, y, stripes) {
    R(g, x, y - 2, 1, 62, P.yellowD);
    Px.ellipse(g, x, y - 3, 1.5, 1.5, P.yellow);
    const fx = stripes ? x + 1 : x - 14, fw = 14, fh = 30;
    for (let j = 0; j < fh; j++) {
      const sag = Math.round(Math.sin((j / fh) * Math.PI) * 1);
      for (let i = 0; i < fw; i++) {
        let c = stripes ? ((j >> 1) % 2 ? P.creamL : P.coralD) : P.navyL;
        if (stripes && i < 7 && j < 10) c = P.navyL;
        // Pliegues: franjas más oscuras
        if ((i + 1) % 5 === 0) c = stripes ? ((j >> 1) % 2 ? P.creamD : P.coralDD) : P.navyM;
        R(g, fx + i, y + j + (i % 5 === 2 ? sag : 0), 1, 1, c);
      }
    }
    if (stripes) for (const [sx, sy] of [[2, 2], [5, 2], [3, 5], [6, 6], [2, 8]]) R(g, fx + sx, y + sy, 1, 1, P.creamL);
    else { Px.ellipse(g, fx + 7, y + 12, 4, 4, P.yellowD); Px.ellipse(g, fx + 7, y + 12, 3, 3, P.yellow); R(g, fx + 6, y + 11, 3, 2, P.yellowD); }
  }
  // Cortina de 27 px de ancho; dir: hacia dónde se recoge (1 = hacia la izquierda, -1 = hacia la derecha)
  function curtain(g, x, w, dir) {
    const tie = 46;
    for (let y = 6; y < H; y++) {
      // Encima del cordón la tela cae recta; debajo se abre un poco
      const pinch = y < tie ? Math.round((y - 6) / (tie - 6) * 7) : Math.round(Math.max(0, 7 - (y - tie) * 0.5));
      const cw = w - pinch;
      for (let i = 0; i < cw; i++) {
        const xx = dir > 0 ? x + i : x + w - 1 - i;
        const fold = (i * 7 / cw + y * 0.02) % 2.4;
        let c = fold < 0.5 ? P.yellowDD : fold < 1.1 ? P.yellowD : fold < 1.9 ? P.yellow : P.yellowL;
        if (i === cw - 1) c = P.yellowDD;
        R(g, xx, y, 1, 1, c);
      }
    }
    // El lazo que la recoge (rojo) y su borla dorada
    const cw = w - 7, x0 = dir > 0 ? x : x + w - cw;
    R(g, x0, tie, cw, 2, P.coralD); R(g, x0, tie, cw, 1, P.coral);
    const bx = dir > 0 ? x0 + cw - 1 : x0;
    R(g, bx - 1, tie - 1, 3, 3, P.yellow); R(g, bx, tie - 1, 1, 1, P.yellowL);
    R(g, bx - 1, tie + 2, 3, 4, P.coralD); R(g, bx, tie + 2, 1, 4, P.coral);
  }

  // La mesa (por delante de Trompa): tablero, frente con paneles y el sello; encima, su foto (de él mismo)
  // y el botón rojo. press: 0..1, el botón aplastado.
  function buildDesk(press) {
    const sp = new PK.Sprite(W, H), g = sp.g;
    const top = sp.mask().poly([[14, 66], [146, 66], [150, 71], [10, 71]]);
    sp.part(top, WOOD, { light: [0, -1], lit: 1, sh: 1, base: 3, flat: true });
    R(g, 12, 66, 136, 1, P.wood); R(g, 13, 67, 134, 1, '#B85C4C');
    const front = sp.mask().rect(14, 71, 132, 19);
    sp.part(front, WOOD, { light: [0, -1], base: 2, lit: 1, sh: 1, dither: false });
    for (const [px, pw] of [[20, 36], [104, 36]]) { R(g, px, 74, pw, 12, P.woodD); R(g, px, 74, pw, 1, P.woodDD); R(g, px, 85, pw, 1, P.wood); }
    // Sello presidencial
    sp.part(sp.mask().ellipse(80, 80, 7, 7), GOLD, { light: LIGHT, lit: 2, sh: 2 });
    Px.ellipse(g, 80, 80, 4, 4, P.navyL); R(g, 79, 78, 3, 3, P.yellow); R(g, 77, 79, 7, 1, P.yellowD);
    // Placa con su nombre
    R(g, 44, 63, 18, 3, P.yellowD); R(g, 44, 63, 18, 1, P.yellowL); R(g, 46, 64, 14, 1, P.yellowDD);
    // Su foto en un marco dorado (de él mismo, claro)
    R(g, 27, 54, 12, 12, P.yellowDD); R(g, 28, 55, 10, 10, P.yellow); R(g, 29, 56, 8, 8, '#8F82BC');
    Px.ellipse(g, 33, 61, 2.5, 3, TAN[3]); R(g, 30, 57, 6, 2, P.yellow); R(g, 35, 57, 2, 1, P.yellowL); R(g, 29, 63, 8, 1, P.navyL);
    // El botón rojo (antes, para pedir refrescos)
    const p = press > 0.5 ? 1 : 0;
    sp.part(sp.mask().rect(113, 61, 14, 5), WOOD, { light: LIGHT, lit: 1, sh: 1, base: 2 });
    sp.part(sp.mask().ellipse(120, 61 + p, 4.5, 3 - p), [P.coralDD, P.coralD, P.coral, P.coralL], { light: LIGHT, lit: 2, sh: 1 });
    if (!p) R(g, 121, 59, 2, 1, P.white);
    return sp.c;
  }

  // ---------- Trompa ----------
  // El cuerpo: traje azul cuadrado, camisa blanca, la corbata roja larguísima y, en la solapa, una insignia
  // dorada con un ojo (la misma moneda que lleva el encapuchado)
  function buildBody() {
    const sp = new PK.Sprite(W, H), g = sp.g;
    const neck = sp.mask().poly([[70, 40], [90, 40], [89, 49], [71, 49]]);
    sp.part(neck, TAN, { light: LIGHT, base: 1, outline: false });
    // El torso y, en la misma silueta, los brazos del hombro al codo (apoyados en la mesa): así son parte de él
    const torso = sp.mask().poly([[40, 90], [42, 66], [47, 57], [56, 51], [69, 47], [91, 47], [104, 51], [113, 57], [118, 66], [120, 90]])
      .taper(51, 56, 5.4, 45.5, 66, 4.4).taper(109, 56, 5.4, 114.5, 66, 4.4);
    sp.part(torso, SUIT, { light: LIGHT, lit: 3, sh: 4, base: 2 });
    sp.rim(torso, BACK, [0, -1]);
    // Pliegue de la axila: separa el brazo del cuerpo
    sp.line(55, 60, 51, 66, SUIT[1]).line(105, 60, 109, 66, SUIT[1]);
    // Solapas
    for (const s of [-1, 1]) {
      const x0 = 80 + s * 9;
      sp.line(x0, 48, x0 + s * 3, 57, SUIT[0]).line(x0 + s * 3, 57, x0 - s * 1, 66, SUIT[0]);
      sp.line(x0 + s * 1, 49, x0 + s * 3, 55, SUIT[3]);
    }
    const shirt = sp.mask().poly([[71, 47], [89, 47], [80, 63]]);
    sp.part(shirt, SHIRT, { light: LIGHT, base: 3, lit: 2, outline: false });
    const collar = sp.mask().poly([[70, 45], [77, 47], [74, 52]]).poly([[90, 45], [83, 47], [86, 52]]);
    sp.part(collar, SHIRT, { light: LIGHT, base: 4, cast: 1 });
    // La corbata: nudo y una hoja que no se acaba nunca (llega por debajo de la mesa)
    const tie = sp.mask().poly([[77, 48], [83, 48], [82, 52], [78, 52]]).poly([[78, 52], [82, 52], [85, 90], [75, 90]]);
    sp.part(tie, TIE, { light: LIGHT, lit: 2, sh: 2, cast: 1 });
    sp.line(79, 54, 80, 66, P.coralL);
    // Insignia de la solapa: moneda con un ojo
    R(g, 94, 55, 3, 3, P.yellowD); R(g, 95, 55, 1, 1, P.yellowL); R(g, 95, 56, 1, 1, P.coalD);
    return sp.c;
  }

  // La cabeza: cara ancha y naranja con la marca blanca de las gafas, ojos entornados y boca de pato.
  // eyes: open | blink | down | wide | smug | wink · mouth: o | talk | wide | grin | smirk
  const FACE = [[67, 24], [70, 19], [76, 17], [84, 17], [90, 19], [93, 24], [94, 31], [93, 38], [90, 43], [85, 46], [80, 47], [75, 46], [70, 43], [67, 38], [66, 31]];
  const HPAL = { K: '#3A1A14', w: '#F8F4FF', b: '#4F78C8', k: TAN[1], y: P.yellowD, Y: P.yellow, l: '#B5452F', m: '#7A2420', D: '#2A0C14', t: P.coral, T: P.white };
  const EYES = {
    open: ['KKKKK', 'kwbwk'],
    blink: ['.....', 'KKKKK'],
    down: ['.....', 'KKKKK', '.kkk.'],
    wide: ['.KKK.', 'KwbwK', '.kkk.'],
    smug: ['KKKKK', 'kKbKk'],
  };
  const MOUTHS = {
    o: ['.lll.', 'lmDml', '.lll.'],
    talk: ['.lll.', 'lmDml', 'lDtDl', '.lll.'],
    wide: ['.lllll.', 'lTTTTTl', 'lDDtDDl', '.lllll.'],
    grin: ['ll...ll', '.lTTTl.', '..lll..'],
    smirk: ['.....ll', '.llll..'],
  };
  function buildHead(eyes, mouth) {
    const sp = new PK.Sprite(W, H), g = sp.g;
    const ears = sp.mask().ellipse(65.5, 31, 2.2, 3.6).ellipse(94.5, 31, 2.2, 3.6);
    sp.part(ears, TAN, { light: LIGHT, base: 2 });
    const face = sp.mask().poly(FACE);
    sp.part(face, TAN, { light: LIGHT, lit: 3, sh: 3, base: 2, cast: 1 });
    sp.rim(face, BACK, [-1, 0]);
    // La marca de las gafas de sol (piel sin broncear)
    Px.ellipse(g, 74, 30, 4, 2, PALE); Px.ellipse(g, 86, 30, 4, 2, PALE);
    R(g, 70, 32, 1, 1, TAN[3]); R(g, 90, 32, 1, 1, TAN[3]);
    // Ojos y cejas
    const L = eyes === 'wink' ? EYES.open : EYES[eyes] || EYES.open;
    const Rr = eyes === 'wink' ? EYES.blink : L;
    sp.stamp(L, 72, 29, HPAL).stamp(Rr, 84, 29, HPAL);
    const up = eyes === 'wide' ? -1 : 0;
    sp.stamp(['yYYY.'], 71, 27 + up, HPAL).stamp(['.YYYy'], 84, 27 + up, HPAL);
    if (eyes === 'down') { R(g, 72, 28, 4, 1, P.yellowD); R(g, 85, 28, 4, 1, P.yellowD); }
    // Nariz, mofletes y papada
    R(g, 81, 31, 1, 3, TAN[4]); R(g, 78, 35, 5, 1, TAN[1]); R(g, 78, 34, 1, 1, TAN[1]); R(g, 82, 34, 1, 1, TAN[1]);
    R(g, 69, 37, 2, 1, P.orangeD); R(g, 90, 37, 2, 1, P.orangeD);
    R(g, 76, 45, 8, 1, TAN[1]); R(g, 70, 41, 1, 2, TAN[1]); R(g, 89, 41, 1, 2, TAN[1]);
    const M = MOUTHS[mouth] || MOUTHS.o;
    sp.stamp(M, 80 - Math.floor(M[0].length / 2), 39, HPAL);
    return sp.c;
  }

  // El tupé: volumen enorme peinado hacia un lado y un mechón delantero que se levanta (flap = 1)
  function buildHair(flap) {
    const sp = new PK.Sprite(W, H);
    const f = flap ? 1 : 0;
    // Detrás: el volumen, más alto del lado de la raya (izquierda) y peinado hacia atrás por los lados
    const back = sp.mask().poly([[63, 28], [62, 19], [63, 13], [69, 8], [80, 6], [91, 7], [97, 11], [100, 17], [99, 25], [97, 30], [94, 28], [93, 22], [67, 22], [66, 29]]);
    sp.part(back, HAIR, { light: LIGHT, lit: 2, sh: 3, base: 1 });
    sp.rim(back, BACK, [0, -1]);
    // Delante: la ola. Nace en la raya, cruza la frente y cae sobre la sien derecha (con el aire, se levanta)
    const wave = sp.mask().poly([[64, 18 - f], [69, 11 - f], [80, 8 - f], [91, 10 - f], [98, 15 - f], [100, 22], [97, 26], [94, 21], [87, 18], [78, 18], [71, 20], [66, 24]]);
    sp.part(wave, HAIR, { light: LIGHT, lit: 3, sh: 2, base: 2, cast: 1 });
    sp.rim(wave, BACK, [0, -1]);
    // La raya, los surcos del peine (siguen la ola) y el brillo de la laca
    sp.line(64, 15, 65, 21, P.yellowDD);
    sp.line(68, 15 - f, 78, 11 - f, P.yellowD).line(78, 11 - f, 90, 12 - f, P.yellowD);
    sp.line(68, 19, 79, 15 - f, P.yellowD).line(79, 15 - f, 93, 17 - f, P.yellowD);
    sp.line(72, 12 - f, 82, 10 - f, P.creamL).line(84, 12 - f, 91, 13 - f, P.yellowL).line(94, 16 - f, 97, 19 - f, P.yellowL);
    sp.line(95, 23, 97, 28, P.yellowD);
    return sp.c;
  }

  // ---------- Brazos y manos (por gesto) ----------
  // Manos dibujadas a mano (son pequeñas: así se leen los dedos). Mano izquierda de la imagen (la derecha de
  // Trompa); la otra es la misma en espejo. La luz llega de la derecha. K contorno, D pliegue, m sombra,
  // s piel, L brillo.
  const HANDPAL = { K: '#4A1A16', D: TAN[1], m: TAN[2], s: TAN[3], L: TAN[4] };
  const HANDS = {
    // El "acordeón": los dedos juntos en pinza, apuntando arriba
    pinch: ['....KK..', '...KLsK.', '...KsLK.', '..KsDsK.', '..KsDsLK', '.KmsDssK', '.KmsDssK', 'KmmmsssK', 'KmmmmmsK', '.KKmmKK.'],
    // El índice en alto ("escúchame bien")
    point: ['...KK...', '..KLsK..', '..KsLK..', '..KssK..', '..KmsK..', '.KKmsKK.', 'KmsDsLsK', 'KmsDssLK', 'KmmDsssK', 'KmmmmmsK', '.KmmmmK.', '..KmmK..'],
    // Pulgar arriba, con los dedos doblados hacia la cámara
    thumb: ['...KK....', '..KLsK...', '..KsLK...', '..KssK...', '.KKmsKKK.', 'KmsssLLsK', 'KDDDDDDDK', 'KmsssssLK', 'KDDDDDDDK', 'KmsssssK.', '.KmmmmK..', '..KmmK...'],
    // La palma abierta (antes del golpe)
    palm: ['.K.K.K...', 'KsKsKsK..', 'KsKsKsKK.', 'KsKsKsKsK', 'KsssssKsK', 'KsssssssK', 'KmsssssLK', 'KmssssLK.', '.KmmssK..', '..KmmK...'],
    // Puño cerrado (sujeta el rotulador; aplasta el botón)
    fist: ['.KKKKKK.', 'KsLsLsLK', 'KDDDDDDK', 'KmsssssK', 'KDDDDDDK', '.KmmmmK.'],
    // Apoyada en la mesa
    rest: ['.KKKKKKK.', 'KsLsLsLsK', 'KmsDsDssK', '.KmmmmmK.'],
    // Sujetando la carpeta por el borde
    grip: ['.KK..', 'KLsK.', 'KssK.', 'KDsK.', 'KssK.', 'KmsK.', 'KmmK.', '.KK..'],
  };
  // Pone la mano con su muñeca (centro del borde de abajo) en (x, y); flip = la otra mano
  function putHand(sp, kind, x, y, flip) {
    const rows = HANDS[kind], w = rows[0].length;
    sp.stamp(rows, Math.round(x - w / 2), Math.round(y - rows.length + 1), HANDPAL, flip);
  }
  // El antebrazo: sale del codo (apoyado en el borde de la mesa; el brazo, del hombro al codo, es parte del
  // cuerpo, en buildBody) hasta la muñeca, con el puño blanco de la camisa. side: 'L' (izquierda de la imagen) o 'R'
  const ELBOW = { L: [46, 66], R: [114, 66] };
  function arm(sp, side, wrist) {
    const e = ELBOW[side], [x, y] = wrist;
    const len = Math.hypot(x - e[0], y - e[1]) || 1, ux = (x - e[0]) / len, uy = (y - e[1]) / len;
    const fore = sp.mask().taper(e[0], e[1], 4, x - ux * 1.5, y - uy * 1.5, 3.3);
    sp.part(fore, SUIT, { light: LIGHT, lit: 2, sh: 2, base: 2, cast: 1 });
    // El codo: un pliegue de la tela donde dobla el brazo
    sp.px(e[0] + (side === 'L' ? 1 : -1), e[1] - 1, SUIT[0]);
    sp.part(sp.mask().capsule(x - ux * 1.5, y - uy * 1.5, x, y, 2.9), SHIRT, { light: LIGHT, base: 4, lit: 1 });
  }
  function buildArms(gesture, k) {
    const sp = new PK.Sprite(W, H), g = sp.g;
    if (gesture === 'accordion' || gesture === 'money') {
      const s = k; // separación de las manos (0..4)
      arm(sp, 'L', [64 - s, 61]);
      arm(sp, 'R', [96 + s, 61]);
      putHand(sp, 'pinch', 66 - s, 60);
      putHand(sp, 'pinch', 94 + s, 60, true);
    } else if (gesture === 'point') {
      const p = k; // el dedo se adelanta un píxel con cada palabra
      arm(sp, 'L', [57, 51 - p]);
      arm(sp, 'R', [101, 66]);
      putHand(sp, 'point', 58, 50 - p);
      putHand(sp, 'rest', 98, 67, true);
    } else if (gesture === 'sign') {
      // La mano derecha (izquierda de la imagen) con el rotulador sobre el papel; la otra lo sujeta
      R(g, 62, 64, 36, 3, P.creamL); R(g, 62, 66, 36, 1, P.creamD);
      for (let i = 0; i < 4; i++) R(g, 65 + i * 7, 65, 5, 1, P.creamD);
      const hx = 68 + k, hy = 64;
      if (k > 0) for (let i = 0; i < k; i += 2) R(g, 66 + i, 65 - (i % 4 ? 1 : 0), 2, 1, P.coalDD);
      arm(sp, 'L', [hx - 4, hy]);
      arm(sp, 'R', [100, 66]);
      putHand(sp, 'rest', 96, 66, true);
      sp.line(hx + 2, hy - 1, hx + 4, hy + 1, P.coalDD).line(hx - 1, hy - 5, hx + 2, hy - 2, P.coalD);
      putHand(sp, 'fist', hx, hy);
    } else if (gesture === 'button') {
      // 0: en reposo junto al botón · 1: la mano en alto · 2: ¡golpe!
      arm(sp, 'L', [61, 66]);
      putHand(sp, 'rest', 63, 67);
      if (k === 0) { arm(sp, 'R', [105, 66]); putHand(sp, 'rest', 103, 67, true); }
      else if (k === 1) { arm(sp, 'R', [117, 50]); putHand(sp, 'palm', 117, 49, true); }
      else { arm(sp, 'R', [119, 62]); putHand(sp, 'fist', 120, 62, true); }
    } else if (gesture === 'thumbs') {
      const b = k;
      arm(sp, 'L', [62, 59 - b]);
      arm(sp, 'R', [98, 59 - b]);
      putHand(sp, 'thumb', 63, 58 - b);
      putHand(sp, 'thumb', 97, 58 - b, true);
    } else {
      // Manos juntas sobre la mesa
      arm(sp, 'L', [71, 66]);
      arm(sp, 'R', [89, 66]);
      putHand(sp, 'rest', 75, 67);
      putHand(sp, 'rest', 85, 67, true);
    }
    return sp.c;
  }

  // La carpeta con la orden firmada, en alto delante del pecho. Las manos la sujetan por los lados.
  function buildFolder() {
    const sp = new PK.Sprite(W, H), g = sp.g;
    const y = 47; // por debajo de la barbilla: se le ve la sonrisa
    const cover = sp.mask().rect(55, y, 50, 30);
    sp.part(cover, LEATHER, { light: LIGHT, lit: 2, sh: 2, base: 2, cast: 1 });
    R(g, 57, y + 2, 46, 26, P.yellowD);              // ribete dorado
    sp.part(sp.mask().rect(58, y + 3, 44, 24), SHIRT, { light: LIGHT, base: 4, lit: 1, outline: false });
    // Sello y renglones
    Px.ellipse(g, 80, y + 6, 2, 2, P.yellowD); R(g, 80, y + 6, 1, 1, P.coalD);
    for (let i = 0; i < 3; i++) R(g, 62, y + 11 + i * 2, i === 2 ? 22 : 36, 1, P.creamD);
    // La firma: un sismógrafo (con una Ш en medio, si te fijas)
    signature(g, 60, y + 18, 40, 6, 1, P.coalDD, 1);
    // Los codos en la mesa y las manos sujetando los lados
    for (const [x, side] of [[55, 'L'], [105, 'R']]) {
      arm(sp, side, [x + (side === 'L' ? -1 : 1), 65]);
      putHand(sp, 'grip', x, 64, side === 'R');
    }
    return sp.c;
  }

  // La firma de Trompa: picos como un sismógrafo, la Ш del idioma secreto en medio y un subrayado.
  // Puntos normalizados (0..1); se dibuja hasta la fracción p del trazo.
  const SIG = [[0, 0.7], [0.04, 0.05], [0.08, 0.95], [0.12, 0.1], [0.16, 0.9], [0.2, 0.2], [0.24, 0.85], [0.28, 0.15], [0.32, 0.92],
    [0.38, 0.05], [0.38, 0.95], [0.47, 0.95], [0.47, 0.1], [0.47, 0.95], [0.56, 0.95], [0.56, 0.05],
    [0.6, 0.85], [0.64, 0.2], [0.68, 0.9], [0.72, 0.1], [0.76, 0.88], [0.8, 0.25], [0.84, 0.9], [0.88, 0.3], [0.92, 0.8], [1, 0.6],
    [0.95, 1.15], [0.02, 1.2]];
  function sigLen() { let L = 0; for (let i = 1; i < SIG.length; i++) L += Math.hypot(SIG[i][0] - SIG[i - 1][0], SIG[i][1] - SIG[i - 1][1]); return L; }
  const SIG_LEN = sigLen();
  // Devuelve la punta del rotulador (para la mano del plano detalle)
  function signature(g, x, y, w, h, p, color, width) {
    let left = p * SIG_LEN, tip = [x + SIG[0][0] * w, y + SIG[0][1] * h];
    for (let i = 1; i < SIG.length && left > 0; i++) {
      const a = SIG[i - 1], b = SIG[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.min(1, left / seg);
      const ax = x + a[0] * w, ay = y + a[1] * h, bx = x + (a[0] + (b[0] - a[0]) * k) * w, by = y + (a[1] + (b[1] - a[1]) * k) * h;
      Px.line(g, Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), color, width);
      tip = [bx, by];
      left -= seg;
    }
    return tip;
  }

  // Plano detalle: la orden sobre la mesa, vista desde arriba, y la mano con el rotulador
  function drawInsert(b, p, t) {
    const office = cached('insertBg', () => {
      const c = Px.canvas(W, H), g = Px.ctx(c);
      R(g, 0, 0, W, H, P.woodM);
      for (let y = 0; y < H; y += 3) R(g, 0, y, W, 1, (y % 9) ? P.woodD : P.wood);
      // El papel (con sombra), el sello y el texto
      R(g, 25, 4, 112, 90, P.woodDD);
      R(g, 22, 2, 112, 92, P.creamL); R(g, 22, 2, 112, 1, P.white); R(g, 133, 2, 1, 92, P.creamD);
      Px.ellipse(g, 78, 12, 6, 6, P.yellowD); Px.ellipse(g, 78, 12, 4, 4, P.yellow); R(g, 77, 11, 3, 2, P.yellowD); R(g, 78, 11, 1, 1, P.coalD);
      for (let i = 0; i < 4; i++) R(g, 32, 30 + i * 4, i === 3 ? 50 : 92, 1, P.creamD);
      R(g, 34, 69, 88, 1, P.creamDD);
      return c;
    });
    b.drawImage(office, 0, 0);
    const tip = signature(b, 36, 46, 86, 18, p, P.coalDD, 2);
    // La mano (grande, desde abajo a la derecha) y el rotulador negro
    // La mano (vista desde arriba): agarra el rotulador como un bolígrafo, el pulgar encima y los nudillos marcados.
    // La punta del rotulador está en (3, 3) del sprite.
    const hm = cached('insertHand', () => {
      const sp = new PK.Sprite(72, 64);
      // El rotulador: negro, gordo, con la anilla gris
      sp.part(sp.mask().capsule(3, 3, 31, 27, 2.7), LEATHER, { light: LIGHT, lit: 1, sh: 1, base: 1 });
      sp.part(sp.mask().capsule(13, 11.5, 16, 14.5, 3), [P.coalD, P.coalL, P.creamDD, P.creamD], { light: LIGHT, lit: 1, sh: 1, base: 2, outline: false });
      sp.px(4, 3, P.coalL).px(6, 5, P.coalL).px(8, 7, P.coalL);
      // Los dedos doblados por debajo del rotulador, el dorso y el antebrazo
      const hand = sp.mask().ellipse(31, 27, 10, 8.5).ellipse(23, 25, 4.5, 4).ellipse(25, 31, 4.2, 3.6).ellipse(30, 35, 4, 3.4)
        .taper(36, 33, 8.5, 52, 60, 10);
      sp.part(hand, TAN, { light: LIGHT, lit: 3, sh: 3, base: 2, cast: 1 });
      // El pulgar: por encima, apretando el rotulador
      const thumb = sp.mask().taper(31, 19, 3.6, 21, 17, 2.6);
      sp.part(thumb, TAN, { light: LIGHT, lit: 2, sh: 2, base: 3, cast: 1 });
      sp.px(21, 16, TAN[4]).px(22, 16, TAN[4]);
      // Nudillos y pliegues de los dedos
      for (const [x, y] of [[33, 20], [37, 23], [39, 27]]) sp.px(x, y, TAN[4]).px(x - 1, y + 1, TAN[1]);
      sp.line(21, 27, 24, 28, TAN[1]).line(23, 33, 27, 33, TAN[1]).line(27, 37, 31, 37, TAN[1]);
      // Puño de la camisa y la manga del traje
      const cuff = sp.mask().taper(41, 45, 9.5, 49, 56, 10.5).keep(sp.mask().poly([[28, 50], [56, 38], [64, 52], [36, 64]]));
      sp.part(cuff, SHIRT, { light: LIGHT, base: 3, lit: 2 });
      sp.part(sp.mask().poly([[38, 64], [62, 50], [72, 58], [72, 64]]), SUIT, { light: LIGHT, base: 2, lit: 2 });
      return sp.c;
    });
    const wob = Math.round(Math.sin(t * 40) * 0.6);
    b.drawImage(hm, Math.round(tip[0]) - 4, Math.round(tip[1]) - 4 + wob);
    return tip;
  }

  // Billetes que salen volando (vista: girando: de frente, de canto, de perfil)
  function bill(b, x, y, big, frame) {
    const w = big ? 11 : 7, h = big ? 6 : 4;
    if (frame === 2) { R(b, x, y + (h >> 1), w, 1, P.greenDD); return; }
    const hh = frame === 1 ? Math.max(2, h >> 1) : h, yy = y + ((h - hh) >> 1);
    R(b, x, yy, w, hh, P.greenDD); R(b, x + 1, yy + (hh > 2 ? 1 : 0), w - 2, Math.max(1, hh - 2), P.green);
    if (frame === 0) { R(b, x + (w >> 1), yy + 1, 1, hh - 2, P.greenL); if (big) { R(b, x + 2, yy + 2, 1, 2, P.greenD); R(b, x + w - 3, yy + 2, 1, 2, P.greenD); } }
  }

  // =====================================================================================================
  // EL TELÉFONO (primera persona, de noche en tu cuarto)
  // =====================================================================================================
  // El móvil va 10 px más abajo de como está dibujado (lo sujetas desde abajo; el pie queda fuera del encuadre):
  // así el subtítulo cabe arriba, sobre la pared, sin taparlo. Todo lo del móvil está en sus coordenadas sin mover.
  const PDY = 10;
  const SCR = { x: 55, y: 9, w: 50, h: 73 };          // la pantalla del móvil (búfer)
  const BTN = (i) => ({ x: SCR.x + 3, y: SCR.y + 15 + i * 17, w: SCR.w - 6, h: 14 }); // botones del menú (0..2)
  const ACCEPT = { x: 89, y: 72 }, DECLINE = { x: 71, y: 72 };
  const REST = { x: 129, y: 55 }; // donde espera el dedo (asoma por abajo a la derecha)
  const SEND = { x: SCR.x + 3, y: SCR.y + 62, w: SCR.w - 6, h: 8 };

  function buildRoom() {
    const c = Px.canvas(W, H), g = Px.ctx(c);
    R(g, 0, 0, W, H, P.wallD);
    for (let x = 2; x < W; x += 7) R(g, x, 0, 1, H, P.wallM);
    // Ventana con las persianas (de noche) a la izquierda y el póster a la derecha, desenfocados
    R(g, 6, 6, 40, 46, P.coalDD);
    for (let y = 8; y < 50; y += 4) { R(g, 8, y, 36, 2, '#45367A'); R(g, 8, y + 2, 36, 2, '#140E30'); }
    R(g, 122, 14, 24, 30, P.violetD); R(g, 124, 16, 20, 26, P.magentaD); Px.ellipse(g, 134, 26, 5, 5, P.magenta);
    // La mesa
    R(g, 0, 72, W, 18, P.woodDD); R(g, 0, 72, W, 1, P.woodD);
    // Penumbra
    g.globalAlpha = 0.45; R(g, 0, 0, W, H, P.coalDD); g.globalAlpha = 1;
    return c;
  }
  // Tu móvil: viejo, oscuro y con la pantalla rajada
  function buildPhone() {
    const sp = new PK.Sprite(W, H), g = sp.g;
    const body = sp.mask().rect(50, 4, 60, 90).rect(52, 2, 56, 2).rect(51, 3, 58, 1);
    sp.part(body, PHONE, { light: [1, -1], lit: 2, sh: 2, base: 2 });
    sp.rim(body, NIGHT, [-1, 0]);
    R(g, SCR.x - 1, SCR.y - 1, SCR.w + 2, SCR.h + 2, P.coalDD);
    R(g, 74, 5, 12, 1, P.coalDD); R(g, 89, 5, 1, 1, P.cyanD);
    R(g, 76, 85, 8, 2, P.coalD);
    return sp.c;
  }
  // La mano izquierda sujeta el móvil por abajo: el pulgar por delante, los dedos asoman por el otro lado
  // Las yemas que agarran el móvil, dibujadas a mano (a este tamaño, las formas automáticas parecen salchichas).
  // La mano que pulsa es la del ratón de la partida (SN.Hero.pointHand) y el pulgar, de las mismas piezas.
  // K contorno, D pliegue, m sombra, s piel, L luz, n/N uña y su sombra. La luz llega de la pantalla y de la ventana
  // (izquierda); el contraluz de la noche, muy suave.
  const MYPAL = { K: '#5B2A3A', D: P.skinD, m: P.skinM, s: P.skin, L: P.skinL, n: '#FCE6EC', N: '#E9B9C9' };
  const SOFT_RIM = '#D9A3CF';
  // Las yemas que asoman por el borde derecho: rodean el canto y apoyan la punta (con la uña) en el marco
  const TIPS = {
    mid: ['..KKKKK.', '.KnnLssK', 'KnNnssmK', 'KLsssmmK', '.KmmmDDK', '..KKKKK.'],
    big: ['..KKKKKK.', '.KnnLsssK', 'KnNnsssmK', 'KLssssmmK', '.KmmmmDDK', '..KKKKKK.'],
    small: ['..KKKK.', '.KnLssK', 'KnNsmmK', '.KmmDDK', '..KKKK.'],
  };
  function buildHoldHand() {
    // Detrás del móvil: la palma (asoma abajo a la izquierda) y el antebrazo hacia la esquina
    const back = new PK.Sprite(W, H);
    const palm = back.mask().ellipse(53, 90, 9, 7).taper(46, 92, 7, 34, 104, 8);
    back.part(palm, SKIN, { light: [0, -1], lit: 2, sh: 3 });
    back.rim(palm, SOFT_RIM, [-1, 0]);
    // Delante: el pulgar y las cuatro yemas (índice, corazón, anular y meñique, de arriba abajo)
    const front = new PK.Sprite(W, H);
    // El pulgar: en diagonal sobre el marco izquierdo, con la punta apoyada en el borde de la pantalla
    const thumb = front.mask().ellipse(46, 86, 5.5, 7).taper(47, 82, 3.6, 56.5, 64, 2.5);
    front.part(thumb, SKIN, { light: [1, -1], lit: 2, sh: 2, cast: 1 });
    front.rim(thumb, NIGHT, [-1, 0]);
    front.stamp(['nn', 'nN'], 55, 63, MYPAL);      // la uña
    front.line(50, 72, 53, 74, P.skinD);           // el pliegue del nudillo
    front.stamp(TIPS.mid, 105, 49, MYPAL).stamp(TIPS.big, 104, 56, MYPAL).stamp(TIPS.mid, 105, 63, MYPAL).stamp(TIPS.small, 106, 70, MYPAL);
    // Sombra de las yemas sobre el marco del móvil
    for (const [x, y] of [[104, 51], [103, 58], [104, 65], [105, 72]]) front.px(x, y, P.coalDD).px(x, y + 1, P.coalDD);
    return { back: back.c, front: front.c };
  }
  // Iconos de 10x10 para los botones: banco, banco enorme, persona
  function icon(b, kind, x, y, col) {
    if (kind === 1) {
      R(b, x + 1, y + 2, 8, 1, col); R(b, x + 3, y + 1, 4, 1, col); R(b, x + 4, y, 2, 1, col);
      for (const cx of [x + 1, x + 4, x + 7]) R(b, cx, y + 4, 2, 4, col);
      R(b, x, y + 8, 10, 2, col);
    } else if (kind === 2) {
      R(b, x + 3, y, 4, 10, col); R(b, x, y + 4, 3, 6, col); R(b, x + 7, y + 2, 3, 8, col);
      for (let j = 1; j < 9; j += 2) R(b, x + 4, y + j, 2, 1, P.navyM);
      R(b, x + 4, y - 2, 1, 2, col);
    } else {
      // Una persona normal: cabeza, cuerpo, brazos y piernas
      R(b, x + 4, y, 3, 3, col); R(b, x + 3, y + 4, 5, 4, col); R(b, x + 1, y + 4, 1, 3, col); R(b, x + 9, y + 4, 1, 3, col);
      R(b, x + 2, y + 4, 1, 1, col); R(b, x + 8, y + 4, 1, 1, col); R(b, x + 4, y + 8, 1, 2, col); R(b, x + 6, y + 8, 1, 2, col);
    }
  }
  // La moneda con el ojo (el escudo del Gobierno... y el medallón del encapuchado)
  function seal(b, cx, cy, r, t) {
    Px.ellipse(b, cx, cy, r, r, P.yellowD); Px.ellipse(b, cx, cy, r - 1, r - 1, P.yellow);
    R(b, cx - Math.round(r * 0.6), cy, Math.round(r * 1.2) + 1, 1, P.coalD);
    R(b, cx, cy, 1, 1, Math.sin(t * 3) > 0.92 ? P.coral : P.coalDD);
    R(b, cx - 1, cy - Math.round(r * 0.5), 2, 1, P.yellowL);
  }

  // Lo que se ve en la pantalla del móvil (parte en el búfer: fondos e iconos)
  function drawScreen(b, V) {
    const s = SCR, t = V.ut;
    R(b, s.x, s.y, s.w, s.h, P.navy);
    for (let y = s.y; y < s.y + s.h; y += 2) R(b, s.x, y, s.w, 1, P.navyD);
    // Cabecera: el escudo y "RESCATE"
    R(b, s.x, s.y, s.w, 10, P.navyL); R(b, s.x, s.y + 10, s.w, 1, P.yellowD);
    seal(b, s.x + 6, s.y + 5, 3, V.t);
    const ui = V.ui;
    if (ui === 'dial' || ui === 'welcome') {
      const r = 8 + Math.round((t * 6) % 6);
      if (ui === 'dial') { b.globalAlpha = 0.5 * (1 - ((t * 6) % 6) / 6); Px.circleOutline(b, 80, 40, r, P.yellow); b.globalAlpha = 1; }
      seal(b, 80, 40, 8, V.t);
    } else if (ui === 'menu' || ui === 'wrong') {
      for (let i = 0; i < 3; i++) {
        const r = BTN(i), on = V.sel === i + 1, bad = ui === 'wrong' && on;
        const hot = ui === 'menu' && V.hover === i + 1;
        R(b, r.x, r.y, r.w, r.h, bad ? P.coralD : on ? P.yellowD : hot ? P.navyLL : P.navyM);
        R(b, r.x, r.y, r.w, 1, bad ? P.coral : on ? P.yellow : P.navyLL);
        R(b, r.x, r.y + r.h - 1, r.w, 1, P.navyD);
        Px.ellipse(b, r.x + 6, r.y + 7, 4, 4, bad ? P.coral : on ? P.yellow : P.navyL);
        icon(b, i + 1, r.x + 13, r.y + 2, bad ? P.creamL : on ? P.coalD : P.creamM);
        if (bad) { Px.line(b, r.x + 12, r.y + 1, r.x + 24, r.y + 12, P.creamL, 1); Px.line(b, r.x + 24, r.y + 1, r.x + 12, r.y + 12, P.creamL, 1); }
      }
    } else if (ui === 'name') {
      R(b, s.x + 3, s.y + 19, s.w - 6, 16, P.creamL); R(b, s.x + 3, s.y + 19, s.w - 6, 1, P.white); R(b, s.x + 3, s.y + 34, s.w - 6, 1, P.creamD);
      // Teclado: la tecla que acabas de pulsar se ilumina
      for (let j = 0; j < 3; j++) for (let i = 0; i < 9 - (j === 2 ? 2 : 0); i++) {
        const kx = s.x + 4 + i * 5 + (j === 2 ? 5 : 0), ky = s.y + 39 + j * 6;
        const lit = V.keyFlash > 0 && V.lastKey === j * 9 + i;
        R(b, kx, ky, 4, 4, lit ? P.yellow : P.navyL); R(b, kx, ky + 3, 4, 1, lit ? P.yellowD : P.navyM);
      }
      R(b, s.x + 12, s.y + 57, 26, 3, P.navyL);
      const ready = V.typed >= TX().bankName.length;
      // Listo para enviar: el botón parpadea (se puede pulsar con el ratón o con Enter)
      const blink = ready && Math.floor(V.t * 3) % 2 === 0;
      R(b, SEND.x, SEND.y, SEND.w, SEND.h, ready ? (blink ? P.green : P.greenD) : P.navyM);
      R(b, SEND.x, SEND.y, SEND.w, 1, ready ? P.greenL : P.navyL);
    } else if (ui === 'check') {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, on = (Math.floor(t * 10) % 8) === i;
        R(b, Math.round(80 + Math.cos(a) * 7), Math.round(38 + Math.sin(a) * 7), 2, 2, on ? P.yellow : P.navyL);
      }
    } else if (ui === 'verdict') {
      // El sello cae sobre la pantalla (grande -> su tamaño)
      const k = Math.min(1, t / 0.18), grow = Math.round((1 - k) * 6);
      const x = s.x + 3 - grow, y = s.y + 22 - grow, w = s.w - 6 + grow * 2, h = 26 + grow * 2;
      R(b, x, y, w, h, P.coral); R(b, x + 2, y + 2, w - 4, h - 4, P.navy); R(b, x + 3, y + 3, w - 6, h - 6, P.coralDD);
    } else if (ui === 'hold') {
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.8 + i / 3) % 1), x = 66 + i * 11 + Math.round(Math.sin(k * 6 + i) * 2), y = Math.round(54 - k * 26);
        b.globalAlpha = Math.sin(k * Math.PI);
        R(b, x, y, 1, 5, P.yellow); R(b, x - 2, y + 4, 3, 2, P.yellow); R(b, x + 1, y, 2, 1, P.yellow);
        b.globalAlpha = 1;
      }
      for (let i = 0; i < 3; i++) R(b, 74 + i * 5, 66, 3, 3, (Math.floor(t * 3) % 3) === i ? P.yellow : P.navyL);
    } else if (ui === 'incoming' || ui === 'accept') {
      const pulse = (t * 1.5) % 1;
      b.globalAlpha = 0.6 * (1 - pulse); Px.circleOutline(b, 80, 36, 11 + Math.round(pulse * 8), P.green); b.globalAlpha = 1;
      // Su foto: una bola naranja con un tupé amarillo
      Px.ellipse(b, 80, 36, 10, 10, P.navyL);
      Px.ellipse(b, 80, 39, 6, 6, TAN[3]); R(b, 74, 32, 12, 4, P.yellow); R(b, 73, 34, 3, 3, P.yellow); R(b, 78, 31, 6, 1, P.yellowL);
      R(b, 77, 39, 2, 1, PALE); R(b, 81, 39, 2, 1, PALE); R(b, 79, 42, 2, 1, '#7A2420');
      const ring = Math.sin(t * 18) > 0 ? 1 : 0;
      Px.ellipse(b, DECLINE.x, DECLINE.y, 5, 5, P.coralD); R(b, DECLINE.x - 3, DECLINE.y, 6, 1, P.creamL);
      Px.ellipse(b, ACCEPT.x, ACCEPT.y - (ui === 'incoming' ? ring : 0), 5, 5, ui === 'accept' ? P.greenL : P.green);
      R(b, ACCEPT.x - 2, ACCEPT.y - 1 - (ui === 'incoming' ? ring : 0), 4, 2, P.greenDD);
    }
    // La raja de la pantalla
    b.globalAlpha = 0.7;
    Px.line(b, 104, 10, 97, 18, P.creamL); Px.line(b, 97, 18, 100, 24, P.creamL); Px.line(b, 97, 18, 91, 16, P.creamL);
    b.globalAlpha = 0.35; Px.line(b, 103, 11, 96, 19, P.coalDD);
    b.globalAlpha = 1;
  }
  // Los textos de la pantalla, a la resolución del escenario (g = lienzo de 640x360)
  function screenText(g, V) {
    const s = SCR, X = TX(), x0 = s.x * Z, y0 = (s.y + PDY) * Z;
    Px.text(g, X.header, x0 + 48, y0 + 30, P.creamL, { size: 16 });
    const mm = String(Math.floor(V.t / 60)).padStart(2, '0'), ss = String(Math.floor(V.t % 60)).padStart(2, '0');
    if (V.ui !== 'dial') Px.text(g, `${mm}:${ss}`, x0 + 8, y0 + 57, P.creamDD); // (a la izquierda: a la derecha está la raja)
    const cx = (s.x + s.w / 2) * Z, ui = V.ui;
    if (ui === 'dial') Px.text(g, X.dialing, cx, y0 + 230, P.creamL, { align: 'center', size: 16 });
    if (ui === 'welcome') Px.text(g, X.connected, cx, y0 + 230, P.green, { align: 'center', size: 16 });
    if (ui === 'menu' || ui === 'wrong') {
      for (let i = 0; i < 3; i++) {
        const r = BTN(i), on = V.sel === i + 1, bad = ui === 'wrong' && on;
        Px.text(g, String(i + 1), (r.x + 6) * Z + 1, (r.y + PDY + 7) * Z + 8, bad || on ? P.coalD : P.creamL, { align: 'center', size: 16 });
        Px.text(g, X.options[i], (r.x + 25) * Z, (r.y + PDY + 7) * Z + 4, bad ? P.creamL : on ? P.coalD : P.creamL, {});
      }
    }
    if (ui === 'name') {
      Px.text(g, X.nameLabel, x0 + 14, y0 + 70, P.creamD);
      const txt = X.bankName.slice(0, V.typed).toUpperCase(), half = X.bankNameBreak;
      const l1 = txt.slice(0, half), l2 = txt.slice(half).trim();
      Px.text(g, l1, x0 + 18, y0 + 98, P.coal);
      Px.text(g, l2, x0 + 18, y0 + 122, P.coal);
      if (Math.floor(V.t * 3) % 2 === 0) { const w = Px.textWidth(g, l2 || l1); R(g, x0 + 19 + w, (l2 ? y0 + 113 : y0 + 89), 2, 11, P.coalL); }
      const ready = V.typed >= X.bankName.length;
      Px.text(g, X.send, cx, (SEND.y + PDY + 6) * Z + 1, ready ? P.creamL : P.creamDD, { align: 'center' });
    }
    if (ui === 'check') Px.text(g, X.checkingShort, cx, y0 + 210, P.creamL, { align: 'center' });
    if (ui === 'verdict' && V.ut > 0.18) X.stamp.forEach((l, i) => Px.text(g, l, cx, y0 + 116 + i * 24, P.coral, { align: 'center', size: i === 1 ? 16 : 8 }));
    if (ui === 'hold') Px.text(g, X.holdShort, cx, y0 + 230, P.creamL, { align: 'center', size: 16 });
    if (ui === 'incoming' || ui === 'accept') {
      Px.text(g, X.president.toUpperCase(), cx, y0 + 186, P.creamL, { align: 'center' });
      Px.text(g, X.videoCall, cx, y0 + 200, P.creamD, { align: 'center' });
    }
  }

  // =====================================================================================================
  // DIBUJO DE UN FOTOGRAMA (V = lo que hay que enseñar; también lo usan las pruebas para hacer capturas)
  // =====================================================================================================
  // layer: 'base' (la habitación, el móvil y su pantalla), 'hands' (las manos, que van por encima de los textos
  // de la pantalla: el dedo tapa el texto, no al revés) o nada (todo junto)
  function drawPhone(b, V, layer) {
    const hold = cached('holdHand', buildHoldHand);
    const bob = Math.round(Math.sin(V.t * 1.3) * 0.6);
    if (layer !== 'hands') {
      b.drawImage(cached('room', buildRoom), 0, 0);
      b.save(); b.translate(0, bob + PDY);
      b.drawImage(hold.back, 0, 0);
      b.drawImage(cached('phone', buildPhone), 0, 0);
      drawScreen(b, V);
      b.restore();
    }
    if (layer !== 'base') {
      b.save(); b.translate(0, bob + PDY);
      b.drawImage(hold.front, 0, 0);
      // El dedo: la mano del ratón de la partida, señalando; va al objetivo y se hunde un píxel al pulsar
      const f = V.finger;
      if (f) {
        const tap = SN.Hero.pointHand('night');
        b.drawImage(tap.c, Math.round(f.x) - tap.tip[0], Math.round(f.y) - tap.tip[1] + (f.down ? 1 : 0));
        if (f.down) { b.globalAlpha = 0.5; Px.circleOutline(b, Math.round(f.x), Math.round(f.y), 3, P.creamL); b.globalAlpha = 1; }
      }
      b.restore();
    }
  }

  function drawCall(b, V) {
    b.drawImage(cached('office', buildOffice), 0, 0);
    const g = V.gesture, nod = V.nod || 0, breath = Math.round(Math.sin(V.t * 2) * 0.5 + 0.5);
    const lean = g === 'sign' ? 1 : 0;
    b.drawImage(cached('body', buildBody), 0, breath);
    const head = cached(`head|${V.eyes}|${V.mouth}`, () => buildHead(V.eyes, V.mouth));
    b.drawImage(head, 0, nod + lean);
    b.drawImage(cached(`hair|${V.flap ? 1 : 0}`, () => buildHair(V.flap)), 0, nod + lean);
    b.drawImage(cached(`desk|${V.press > 0.5 ? 1 : 0}`, () => buildDesk(V.press)), 0, 0);
    if (g === 'show') {
      b.drawImage(cached('folder', buildFolder), 0, V.lift || 0);
    } else {
      const k = V.armK || 0;
      b.drawImage(cached(`arms|${g}|${k}`, () => buildArms(g, k)), 0, 0);
    }
    // Billetes volando hacia la cámara
    for (const p of V.bills || []) bill(b, Math.round(p.x), Math.round(p.y), p.z > 0.55, Math.floor(p.spin) % 3);
  }

  function draw(g, V) {
    const b = draw.buf || (draw.buf = Px.ctx(Px.canvas(W, H)));
    const up = () => g.drawImage(b.canvas, 0, 0, W, H, 0, 0, 640, 360);
    b.clearRect(0, 0, W, H);
    b.imageSmoothingEnabled = false;
    g.imageSmoothingEnabled = false;
    const z = V.zoom || 0;
    if (V.scene === 'phone' && z > 0) {
      // Zoom hacia la pantalla del móvil (al aceptar la videollamada): todo junto y sin textos
      drawPhone(b, V);
      const k = U.ease.inOutSine(z);
      const sw = U.lerp(W, SCR.w, k), sh = U.lerp(H, SCR.w * H / W, k);
      const sx = U.lerp(0, SCR.x, k), sy = U.lerp(0, SCR.y + 16 + PDY, k);
      g.drawImage(b.canvas, sx, sy, sw, sh, 0, 0, 640, 360);
    } else if (V.scene === 'phone') {
      // El móvil, los textos de su pantalla y, encima de todo, las manos
      drawPhone(b, V, 'base'); up();
      screenText(g, V);
      b.clearRect(0, 0, W, H);
      drawPhone(b, V, 'hands'); up();
    } else {
      if (V.scene === 'call') drawCall(b, V);
      else if (V.scene === 'insert') V.tip = drawInsert(b, V.sig, V.t);
      else R(b, 0, 0, W, H, P.coalDD);
      up();
    }
    if (V.scene === 'call') callUI(g, V);
    if (V.scene === 'insert') {
      Px.text(g, TX().order[0], 312, 92, P.coalL, { align: 'center', size: 16 });
      Px.text(g, TX().order[1], 312, 116, P.coalL, { align: 'center' });
    }
    if (V.flash > 0) { g.globalAlpha = Math.min(1, V.flash); R(g, 0, 0, 640, 360, P.creamL); g.globalAlpha = 1; }
    if (V.brr > 0) brrr(g, V);
    if (V.fade > 0) { g.globalAlpha = Math.min(1, V.fade); R(g, 0, 0, 640, 360, P.coalDD); g.globalAlpha = 1; }
    if (V.ended) {
      Px.text(g, TX().ended, 320, 172, P.coral, { align: 'center', size: 16 });
    }
  }

  // La interfaz de la videollamada: en directo, el lugar y tu cara en la ventanita
  function callUI(g, V) {
    const X = TX();
    R(g, 0, 0, 640, 22, 'rgba(14,10,28,0.55)');
    if (Math.floor(V.t * 2) % 2 === 0) Px.ellipse(g, 14, 11, 4, 4, P.coral);
    Px.text(g, X.live, 24, 15, P.creamL);
    Px.text(g, X.place, 92, 15, P.yellowL);
    for (let i = 0; i < 4; i++) R(g, 616 + i * 5, 16 - i * 3, 3, 3 + i * 3, i < 3 ? P.creamL : P.creamDD);
    // Tu cara (el primer plano del protagonista, a escala 1:1)
    if (SN.Cine && SN.Cine.renderFace) {
      const tmp = callUI.tmp || (callUI.tmp = Px.ctx(Px.canvas(640, 360)));
      SN.Cine.renderFace(tmp, { type: 'face', expr: V.hero || 'worried', opts: {}, t: V.t, night: true });
      // Recorte de la cara al doble (cada píxel del primer plano = 2 del escenario: nítido)
      const x = 472, y = 30;
      R(g, x - 3, y - 3, 166, 96, P.coalDD); R(g, x - 2, y - 2, 164, 94, P.creamL);
      g.drawImage(SN.Cine.buf, 40, 23, 80, 45, x, y, 160, 90);
      Px.text(g, X.you.toUpperCase(), x + 5, y + 85, P.creamL, { outline: P.coalDD });
    }
  }
  // "BRRRRR": la impresora de dinero
  function brrr(g, V) {
    const n = 2 + Math.min(5, Math.floor(V.brr * 6));
    const word = 'BR' + 'R'.repeat(n) + '!';
    const sx = Math.round(Math.sin(V.t * 70) * 2), sy = Math.round(Math.cos(V.t * 63) * 2);
    Px.text(g, word, 320 + sx, 70 + sy, P.yellow, { align: 'center', size: 32, outline: P.coalDD });
  }

  // =====================================================================================================
  // LA ESCENA JUGABLE
  // =====================================================================================================
  const ABORT = { abort: true };
  const DIGITS = { Digit1: 1, Digit2: 2, Digit3: 3, Numpad1: 1, Numpad2: 2, Numpad3: 3 };

  const B = SN.Bailout = {
    active: false,
    speed: 1, // (las pruebas la reproducen más deprisa)
    draw,     // (pruebas y capturas)

    // from: 'phone' (toda la escena) o 'call' (directamente la videollamada)
    play({ coins = 0, from = 'phone' } = {}) {
      this.active = true;
      this.coins = coins;
      this.from = from;
      this.V = { scene: 'phone', ui: 'dial', clock: 0, t: 0, ut: 0, eyes: 'open', mouth: 'o', gesture: 'idle', finger: { x: REST.x, y: REST.y }, bills: [] };
      this.cv = $('cine');
      this.g = Px.ctx(this.cv);
      this.cv.classList.remove('hidden');
      // En el móvil, el subtítulo va arriba (en la videollamada, abajo)
      if (from !== 'call') $('subs').classList.add('top');
      else this.V.scene = 'call';
      SN.Audio.setMood('silent');
      this.waiters = [];
      const down = (e) => {
        if (!(e.button === 0 || e.pointerType === 'touch')) return;
        e.stopPropagation();
        this.onPointer(e);
      };
      const move = (e) => this.onMove(e);
      const kd = (e) => {
        if (e.code === 'Escape') return;
        e.preventDefault(); e.stopPropagation();
        this.onKey(e);
      };
      document.addEventListener('pointerdown', down, true);
      document.addEventListener('pointermove', move, true);
      document.addEventListener('keydown', kd, true);
      this.off = () => {
        document.removeEventListener('pointerdown', down, true);
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('keydown', kd, true);
      };
      let last = performance.now();
      const loop = (now) => {
        if (!this.active) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.update(dt * this.speed);
        draw(this.g, this.V);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return new Promise((resolve) => {
        this.resolve = resolve;
        this.script().then(() => this.finish(), (e) => { if (e !== ABORT) { console.error(e); this.finish(); } });
      });
    },

    // Terminar ya, como si hubiera acabado la llamada (pruebas que solo comprueban lo que pasa después)
    skip() {
      if (!this.active) return;
      const ws = this.waiters;
      this.waiters = [];
      this.finish();
      for (const w of ws) w.reject(ABORT);
    },
    // Salir al menú (o empezar otra partida) en mitad de la escena
    abort() {
      if (!this.active) return;
      this.active = false;
      this.cleanup();
      this.resolve = null;
      for (const w of this.waiters) w.reject(ABORT);
      this.waiters = [];
    },
    finish() {
      if (!this.active) return;
      this.active = false;
      this.cleanup();
      const r = this.resolve;
      this.resolve = null;
      if (r) r({ coins: this.coins });
    },
    cleanup() {
      if (this.off) this.off();
      this.off = null;
      this.cv.classList.add('hidden');
      $('subs').classList.add('hidden');
      $('subs').classList.remove('top');
      this.say_ = null;
    },

    // ---------- Esperas (se cancelan si se aborta la escena) ----------
    until(test) {
      const p = new Promise((resolve, reject) => {
        const w = { test, resolve, reject };
        this.waiters.push(w);
      });
      // Algunas esperas no las espera nadie (el subtítulo que se queda en pantalla, la carpeta que sube):
      // si se corta la llamada, que su cancelación no salga como error
      p.catch(() => {});
      return p;
    },
    wait(s) { const end = this.V.clock + s; return this.until(() => this.V.clock >= end); },

    // Subtítulo con máquina de escribir (el mismo cuadro que las cinemáticas). auto: segundos para seguir solo;
    // hold: no se cierra (sigue en pantalla mientras pasa otra cosa, como el menú del contestador)
    say(name, text, { voice = 'me', auto = 0, hold = false } = {}) {
      const el = $('subs');
      el.classList.remove('hidden');
      el.classList.toggle('click', !auto && !hold);
      const me = this.say_ = { name, full: text, shown: 0, voice, auto, hold, t: 0, done: false };
      this.renderSubs();
      // Un subtítulo también termina si otro ocupa su lugar (p. ej., empiezas a escribir el nombre del banco
      // antes de que el contestador acabe la frase): si no, el guion se quedaría esperándolo para siempre
      if (hold) return this.until(() => this.say_ !== me || me.shown >= me.full.length);
      return this.until(() => me.done || this.say_ !== me).then(() => { if (this.say_ === me) this.clearSay(); });
    },
    clearSay() { this.say_ = null; $('subs').classList.add('hidden'); },
    renderSubs() {
      const s = this.say_;
      if (!s) return;
      const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      $('subs').innerHTML = (s.name ? `<b>${esc(s.name)}:</b> ` : '') + esc(s.full.slice(0, Math.floor(s.shown))) + (s.caret ? '<i class="caret"></i>' : '');
    },
    advance() {
      const s = this.say_;
      if (!s || s.hold) return;
      if (s.shown < s.full.length) { s.shown = s.full.length; this.renderSubs(); return; }
      s.done = true;
    },

    // ---------- Entrada ----------
    // En el móvil, las coordenadas del dibujo (sin los 10 px que baja)
    toPhone(e) { const p = this.toBuf(e); return { x: p.x, y: p.y - PDY }; },
    toBuf(e) {
      const p = SN.Game.toStage(e.clientX, e.clientY);
      return { x: p.x / Z, y: p.y / Z };
    },
    inRect(p, r) { return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; },
    onMove(e) {
      const V = this.V;
      if (!this.active || V.ui !== 'menu' || V.scene !== 'phone') return;
      const p = this.toPhone(e);
      V.hover = 0;
      for (let i = 0; i < 3; i++) if (this.inRect(p, BTN(i))) V.hover = i + 1;
    },
    onPointer(e) {
      const V = this.V, p = this.toBuf(e), q = this.toPhone(e);
      if (V.scene === 'phone' && V.ui === 'menu' && this.pick) {
        for (let i = 0; i < 3; i++) if (this.inRect(q, BTN(i))) { this.pick(i + 1); return; }
        return;
      }
      if (V.scene === 'phone' && V.ui === 'name') {
        if (this.inRect(q, SEND)) this.sendName(); else this.typeKey();
        return;
      }
      // La firma de Trompa: un garabato... con una letra del idioma secreto
      if ((V.scene === 'call' && V.gesture === 'show' && p.x >= 58 && p.x < 102 && p.y >= 62 + (V.lift || 0) && p.y < 74 + (V.lift || 0)) ||
        (V.scene === 'insert' && p.y > 42 && p.y < 72)) {
        if (SN.Cipher && SN.Cipher.discover('firma')) return;
      }
      this.advance();
    },
    onKey(e) {
      const V = this.V;
      if (V.scene === 'phone' && V.ui === 'menu' && this.pick && DIGITS[e.code]) { this.pick(DIGITS[e.code]); return; }
      if (V.scene === 'phone' && V.ui === 'name') {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') this.sendName();
        else if (!e.repeat || Math.random() < 0.35) this.typeKey(e.code);
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') this.advance();
    },
    // Cada tecla pone un trocito del nombre del banco (de 1 a 3 letras)
    typeKey(code) {
      const V = this.V, full = TX().bankName;
      if (V.typed >= full.length) return;
      V.typed = Math.min(full.length, V.typed + 1 + Math.floor(Math.random() * 3));
      V.keyFlash = 0.12;
      V.lastKey = (code ? code.charCodeAt(code.length - 1) : Math.floor(Math.random() * 25)) % 25;
      const r = SCR;
      V.finger = { x: r.x + 6 + (V.lastKey % 9) * 5, y: r.y + 41 + Math.floor(V.lastKey / 9) * 6, down: true };
      SN.Audio.sfx('key');
      if (SN.Hands) SN.Hands.tapKey(code || 'KeyJ');
      this.say_ = { name: TX().you, full: full.slice(0, V.typed), shown: V.typed, voice: 'me', hold: true, caret: true, t: 0 };
      $('subs').classList.remove('hidden', 'click');
      this.renderSubs();
    },
    sendName() {
      const V = this.V;
      if (V.typed < TX().bankName.length || V.sent) return;
      V.sent = true;
      V.finger = { x: SEND.x + SEND.w / 2, y: SEND.y + 4, down: true };
      SN.Audio.sfx('select');
    },

    // ---------- El guion ----------
    async script() {
      if (this.from !== 'call') await this.phonePart();
      await this.callPart();
    },
    // La llamada a la Línea de Rescate (el móvil, en primera persona)
    async phonePart() {
      const X = TX(), V = this.V;
      // 1) Llamando...
      V.ui = 'dial'; V.ut = 0;
      SN.Audio.sfx('ringback'); await this.wait(1.1);
      SN.Audio.sfx('ringback'); await this.wait(1.1);
      V.ui = 'welcome'; V.ut = 0;
      SN.Audio.sfx('select');
      await this.say(X.line, X.welcome, { voice: 'robot', auto: 1.1 });
      // 2) El menú: hasta que eliges ser un banco enorme
      for (;;) {
        V.ui = 'menu'; V.sel = 0; V.ut = 0;
        this.say(X.line, X.menu, { voice: 'robot', hold: true });
        const d = await new Promise((res, rej) => { this.pick = (n) => { this.pick = null; res(n); }; this.waiters.push({ test: () => false, resolve: res, reject: rej }); });
        V.sel = d;
        await this.tapAt({ x: BTN(d - 1).x + 6, y: BTN(d - 1).y + 7 }, () => SN.Audio.sfx('dtmf', { d }));
        await this.wait(0.25);
        this.clearSay();
        if (d === 2) break;
        V.ui = 'wrong'; V.ut = 0;
        SN.Audio.sfx('error');
        await this.say(X.line, X.wrong[d - 1], { voice: 'robot', auto: 1.5 });
      }
      // 3) El nombre del banco: lo escribes tú
      V.ui = 'name'; V.ut = 0; V.typed = 0; V.sent = false;
      await this.say(X.line, X.askName, { voice: 'robot', auto: 0.4 });
      // (lo que ya hayas tecleado mientras hablaba el contestador se conserva)
      this.say_ = { name: X.you, full: X.bankName.slice(0, V.typed), shown: V.typed, hold: true, caret: true, t: 0 };
      $('subs').classList.remove('hidden', 'click');
      this.renderSubs();
      await this.until(() => V.sent);
      await this.wait(0.3);
      this.clearSay();
      // 4) Comprobando... y el veredicto
      V.ui = 'check'; V.ut = 0; V.finger = { x: REST.x, y: REST.y };
      await this.say(X.line, X.checking, { voice: 'robot', auto: 0.8 });
      V.ui = 'verdict'; V.ut = 0;
      await this.wait(0.18);
      SN.Audio.sfx('thud'); SN.FX.shake(3, 0.25);
      await this.say(X.line, X.verdict, { voice: 'robot', auto: 1.1 });
      // 5) En espera (con su musiquita)
      V.ui = 'hold'; V.ut = 0;
      SN.Audio.sfx('holdMusic');
      $('subs').classList.remove('hidden', 'click');
      $('subs').innerHTML = `<i>${X.holdLine}</i>`;
      await this.wait(2.3);
      $('subs').classList.add('hidden');
      // 6) Videollamada entrante: la coges
      V.ui = 'incoming'; V.ut = 0;
      SN.Audio.sfx('ringback');
      await this.wait(1.0);
      await this.tapAt(ACCEPT, () => SN.Audio.sfx('select'));
      V.ui = 'accept';
      await this.tween(0.55, (k) => { V.zoom = k; });
      V.flash = 0.8;
      SN.Audio.sfx('static', { dur: 0.25 });
    },
    // La videollamada con el Presidente
    async callPart() {
      const X = TX(), V = this.V;
      // 7) La llamada con el Presidente
      V.scene = 'call'; V.t = 0; V.zoom = 0; V.finger = null; V.hero = 'worried';
      $('subs').classList.remove('top');
      await this.wait(0.5);
      for (const ln of X.call) await this.line(ln);
      // 8) Cuelga
      V.eyes = 'wink'; V.mouth = 'smirk'; V.gesture = 'thumbs'; V.armK = 0;
      await this.wait(0.7);
      SN.Audio.sfx('hangup');
      V.ended = true;
      await this.tween(0.5, (k) => { V.fade = k * 0.85; });
      await this.wait(0.6);
      V.ended = false;
      await this.say(X.you, X.heroLine, { voice: 'me', auto: 1.6 });
      await this.tween(0.3, (k) => { V.fade = 0.85 + k * 0.15; });
    },

    // Una frase de Trompa con su gesto
    async line(ln) {
      const V = this.V, X = TX();
      V.gesture = ln.g === 'money' ? 'money' : ln.g; V.gt = 0; V.armK = 0; V.flapT = 0.25;
      V.hero = ln.hero || V.hero;
      const text = ln.t.replace('{coins}', U.money(this.coins));
      if (ln.g === 'show') { V.lift = 30; this.tween(0.35, (k) => { V.lift = Math.round(Math.pow(1 - k, 2) * 30); }); SN.Audio.sfx('whoosh'); }
      if (ln.g === 'money') this.printMoney(2.6);
      await this.say(X.president, text, { voice: 'trompa', auto: ln.g === 'show' ? 0 : 2.4 });
      if (ln.g === 'sign') {
        // Plano detalle: la firma, trazo a trazo
        V.scene = 'insert'; V.sig = 0;
        let lastSeg = -1;
        await this.tween(1.7, (k) => {
          V.sig = U.ease.inOutSine(k);
          const seg = Math.floor(V.sig * 26);
          if (seg !== lastSeg) { lastSeg = seg; SN.Audio.sfx('scribble'); }
        });
        await this.wait(0.5);
        V.scene = 'call';
      }
      if (ln.g === 'button') {
        V.armK = 1; SN.Audio.sfx('whoosh');
        await this.wait(0.35);
        V.armK = 2; V.press = 1; V.eyes = 'wide'; V.mouth = 'wide';
        SN.Audio.sfx('bigButton'); SN.FX.shake(5, 0.35); V.flash = 0.6; V.hero = 'shocked';
        await this.wait(0.35);
        V.press = 0;
      }
    },

    // La mano derecha va al objetivo, pulsa y vuelve un poco
    async tapAt(to, onPress) {
      const V = this.V, from = { x: V.finger.x, y: V.finger.y };
      await this.tween(0.16, (k) => { const e = U.ease.outCubic(k); V.finger = { x: U.lerp(from.x, to.x, e), y: U.lerp(from.y, to.y, e) }; });
      V.finger = { x: to.x, y: to.y, down: true };
      if (SN.Hands) SN.Hands.press();
      onPress && onPress();
      await this.wait(0.12);
      V.finger = { x: to.x + 4, y: to.y + 6 };
    },
    tween(dur, fn) {
      const V = this.V, t0 = V.clock;
      fn(0);
      return this.until(() => { const k = Math.min(1, (V.clock - t0) / dur); fn(k); return k >= 1; });
    },
    // La impresora: billetes que salen de detrás de la mesa y vuelan hacia la cámara
    printMoney(dur) {
      const V = this.V;
      V.printing = dur; V.brr = 0.01;
      SN.Audio.sfx('printer', { dur });
      SN.Audio.sfx('cash');
      SN.Audio.sfx('coin');
    },

    // ---------- Cada fotograma ----------
    update(dt) {
      const V = this.V;
      V.clock = (V.clock || 0) + dt;
      V.t += dt; V.ut += dt; V.gt = (V.gt || 0) + dt;
      V.flash = Math.max(0, (V.flash || 0) - dt * 3);
      V.keyFlash = Math.max(0, (V.keyFlash || 0) - dt);
      if (V.finger && V.finger.down && V.keyFlash <= 0 && V.ui === 'name') V.finger = { x: V.finger.x + 2, y: V.finger.y + 5 };
      // Subtítulo: máquina de escribir y voz
      const s = this.say_;
      if (s && s.full && s.shown < s.full.length) {
        const before = Math.floor(s.shown);
        s.shown = Math.min(s.full.length, s.shown + dt * 40);
        if (Math.floor(s.shown) !== before) { this.renderSubs(); if (before % 2 === 0) SN.Audio.sfx('type', { voice: s.voice }); }
      } else if (s && s.auto && !s.hold) { s.t += dt; if (s.t >= s.auto) s.done = true; }
      // Trompa: boca al hablar (abierta en las vocales), cabeceo, parpadeo, el tupé y su gesto
      if (V.scene === 'call') {
        const talking = s && s.voice === 'trompa' && s.shown < s.full.length;
        const ch = talking ? s.full[Math.floor(s.shown)] || '' : '';
        const rest = V.gesture === 'show' || V.gesture === 'thumbs' || V.gesture === 'money' ? 'grin' : 'o';
        if (V.armK !== 2 || V.gesture !== 'button') {
          V.mouth = talking ? (/[aeiouáéíóúAEIOU]/.test(ch) ? (/[AÁ!]/.test(ch) ? 'wide' : 'talk') : 'o') : rest;
          const blink = (V.t % 3.4) > 3.27;
          V.eyes = V.gesture === 'sign' ? 'down' : blink ? 'blink' : V.gesture === 'show' || V.gesture === 'thumbs' ? 'smug' : 'open';
        }
        V.nod = talking && Math.floor(s.shown / 7) % 2 ? 1 : 0;
        V.flapT = Math.max(0, (V.flapT || 0) - dt);
        V.flap = V.flapT > 0 || Math.sin(V.t * 2.3) > 0.8;
        const G = V.gesture;
        if (G === 'accordion') V.armK = Math.round((Math.sin(V.gt * 5) * 0.5 + 0.5) * 4);
        else if (G === 'money') V.armK = 4;
        else if (G === 'point') V.armK = talking && Math.floor(s.shown / 5) % 2 ? 1 : 0;
        else if (G === 'thumbs') V.armK = Math.floor(V.gt * 3) % 2;
        else if (G === 'sign') { const nk = Math.floor(V.gt * 9) % 6 * 4 + Math.floor(V.gt * 2) % 3; if (nk !== V.armK) SN.Audio.sfx('scribble'); V.armK = Math.min(22, nk); }
      }
      // Billetes
      if (V.printing > 0) {
        V.printing -= dt;
        V.brr = Math.min(1, V.brr + dt * 1.5);
        for (let i = 0; i < 2; i++) if (Math.random() < dt * 22) {
          V.bills.push({ x: U.rand(46, 110), y: 62, vx: U.rand(-40, 40), vy: U.rand(-70, -40), z: 0, spin: U.rand(0, 3), vs: U.rand(6, 14) });
        }
        if (Math.random() < dt * 6) SN.Audio.sfx('coinBounce');
      } else if (V.brr > 0) V.brr = Math.max(0, V.brr - dt * 2);
      for (const p of V.bills) {
        p.z += dt * 0.9; p.spin += dt * p.vs;
        p.vx += (p.x < 80 ? -1 : 1) * 30 * dt; p.vy += 55 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      V.bills = V.bills.filter((p) => p.y < 100 && p.x > -14 && p.x < W + 4);
      // Comprobar las esperas
      if (this.waiters.length) {
        const ws = this.waiters;
        this.waiters = [];
        for (const w of ws) { let ok = false; try { ok = w.test(); } catch (_) { ok = false; } if (ok) w.resolve(); else this.waiters.push(w); }
      }
    },
  };
  void B;
})(window.SN);
