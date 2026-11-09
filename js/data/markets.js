// Definición de los mercados (equivalente a los ScriptableObjects de mercado).
// Para añadir un sector nuevo basta con añadir una entrada aquí y sus eventos en data/events.js:
// el simulador, el trading y la interfaz lo recogen sin tocar el sistema central.
// cap = TOPE por apuesta: lo máximo que una operación puede ganar o perder en ese mercado.
// El primero da poco; cada mercado siguiente da más.
(function (SN) {
  'use strict';
  const P = SN.PAL;

  SN.Data.markets = [
    {
      id: 'salud',
      name: 'Mercado de la Salud',
      short: 'Salud',
      tag: 'Estable, con sustos',
      desc: 'Farmacéuticas, hospitales y laboratorios. Estable... hasta que sale una noticia.',
      icon: 'salud',
      colors: { main: P.green, alt: P.cream, dark: P.greenD, ink: P.greenDD },
      startPrice: 100,
      volatility: 0.016, // desviación típica por vela
      drift: 0.0093,     // deriva por vela con tendencia máxima (1.6: un poco menos, para un inicio más difícil)
      phase: [16, 30],   // velas que dura cada fase de tendencia
      flatChance: 0.16,  // probabilidad de que una fase no tenga dirección clara
      reversion: 0.012,  // vuelta suave al precio de referencia (evita precios absurdos)
      eventRate: 0.4,    // probabilidad por turno de que aparezca un evento
      candles: 12,       // velas que dura una operación si no la cierras antes
      twist: { chance: 0.26, min: 0.055, max: 0.1 }, // giro inesperado en las últimas velas
      cap: 300,          // tope por apuesta (gana o pierde como mucho esto)
      unlock: { type: 'start' },
    },
    {
      id: 'tecno',
      name: 'Mercado tecnológico',
      short: 'Tecnología',
      tag: 'Sube y cae rápido',
      desc: 'Apps, chips e inteligencia artificial. Sube rápido, cae más rápido.',
      icon: 'tecno',
      colors: { main: P.cyan, alt: P.yellow, dark: P.cyanD, ink: P.cyanDD },
      startPrice: 240,
      volatility: 0.02,
      drift: 0.0095,
      phase: [12, 24],
      flatChance: 0.14,
      reversion: 0.01,
      eventRate: 0.45,
      candles: 10,
      twist: { chance: 0.32, min: 0.07, max: 0.13 },
      cap: 1500,
      unlock: { type: 'gift', step: 'regalo2', label: '2º regalo' },
    },
    {
      id: 'negocios',
      name: 'Mercado de pequeños negocios',
      short: 'Negocios',
      tag: 'Tendencias largas',
      desc: 'Tiendas, bares y talleres del barrio. Tendencias largas y previsibles.',
      icon: 'negocios',
      colors: { main: P.orange, alt: P.green, dark: P.orangeD, ink: P.orangeDD },
      startPrice: 60,
      volatility: 0.015,
      drift: 0.0085,
      phase: [22, 38],
      flatChance: 0.12,
      reversion: 0.012,
      eventRate: 0.4,
      candles: 14,
      twist: { chance: 0.22, min: 0.05, max: 0.1 },
      cap: 7500,
      unlock: { type: 'gift', step: 'regalo3', label: '3er regalo' },
    },
    {
      id: 'mineria',
      name: 'Mercado minero',
      short: 'Minería',
      tag: 'Volatilidad extrema',
      desc: 'Oro, cobre y cosas que mejor no preguntar. Volatilidad extrema.',
      icon: 'mineria',
      colors: { main: P.yellow, alt: P.coal, dark: P.yellowDD, ink: P.coal },
      startPrice: 420,
      volatility: 0.028,
      drift: 0.012,
      phase: [10, 22],
      flatChance: 0.12,
      reversion: 0.009,
      eventRate: 0.5,
      candles: 10,
      twist: { chance: 0.4, min: 0.1, max: 0.18 },
      cap: 30000,
      unlock: { type: 'gift', step: 'regalo4', label: '4º regalo' },
    },
  ];

  // ---------- Mercados negros ----------
  // La versión "sin preguntas" de cada mercado: mismo carácter que el original (volatilidad, velas, giros),
  // logo y colores propios y un tope mejor que el suyo, pero un 20% peor que el del siguiente mercado normal
  // (Salud negro = 0.8 × Tecnología). Tras Minería no hay otro mercado: se imagina uno 4 veces mayor.
  // Se abren con los objetos clave de la tienda (js/data/progression.js). Ganar aquí sale caro: casi siempre
  // hay una noticia extraña después.
  const BLACK_RATIO = 0.8, LAST_STEP = 4;
  const normal = SN.Data.markets.slice();
  const BLACK = {
    salud: {
      name: 'Mercado negro de la Salud', label: 'Salud negro', tag: 'Sin receta', icon: 'saludNegro',
      desc: 'Pastillas sin etiqueta y clínicas en garajes. Paga más... y no hace preguntas.',
      colors: { main: P.magenta, alt: P.green, dark: P.magentaD, ink: P.magentaDD }, startPrice: 70,
      lock: 'Compra la tele',
    },
    tecno: {
      name: 'Mercado negro tecnológico', label: 'Tecno negro', tag: 'Caído del camión', icon: 'tecnoNegro',
      desc: 'Datos robados y chips sin número de serie. Nadie pregunta de dónde salen.',
      colors: { main: P.violetL, alt: P.cyan, dark: P.violet, ink: P.violetDD }, startPrice: 180,
      lock: 'Compra el móvil',
    },
    negocios: {
      name: 'Mercado negro de los negocios', label: 'Negocios negro', tag: 'Solo de noche', icon: 'negociosNegro',
      desc: 'Tiendas que abren cuando cierran las demás. Préstamos del barrio.',
      colors: { main: P.coral, alt: P.orange, dark: P.coralD, ink: P.coralDD }, startPrice: 45,
      lock: 'Compra la moto',
    },
    mineria: {
      name: 'Mercado negro minero', label: 'Minería negro', tag: 'Sin mapa', icon: 'mineriaNegro',
      desc: 'Oro sin factura de minas que no salen en ningún mapa.',
      colors: { main: P.yellowD, alt: P.coral, dark: P.yellowDD, ink: P.coalD }, startPrice: 300,
      lock: 'Compra el reloj',
    },
  };
  normal.forEach((base, i) => {
    const next = normal[i + 1];
    const extra = BLACK[base.id];
    SN.Data.markets.push(Object.assign({}, base, extra, {
      id: base.id + '_negro',
      parent: base.id,
      black: true,
      cap: Math.round((next ? next.cap : base.cap * LAST_STEP) * BLACK_RATIO),
      eventRate: base.eventRate + 0.1,
      twist: Object.assign({}, base.twist), // copia: cambiar el original no cambia el negro
      unlock: { type: 'item', label: extra.lock },
    }));
  });
  SN.Data.blackRatio = BLACK_RATIO;

  SN.Data.marketById = (id) => SN.Data.markets.find((m) => m.id === id);
  // Nombre corto para cabeceras y noticias (los negros llevan "negro")
  SN.Data.marketLabel = (id) => { const d = SN.Data.marketById(id); return d ? d.label || d.short : ''; };
})(window.SN);
