// Definición de los mercados (equivalente a los ScriptableObjects de mercado).
// Para añadir un sector nuevo basta con añadir una entrada aquí y sus eventos en data/events.js:
// el simulador, el trading y la interfaz lo recogen sin tocar el sistema central.
(function (SN) {
  'use strict';
  const P = SN.PAL;

  SN.Data.markets = [
    {
      id: 'salud',
      name: 'MERCADO DE LA SALUD',
      short: 'SALUD',
      tag: 'ESTABLE, CON SUSTOS',
      desc: 'Farmacéuticas, hospitales y laboratorios. Estable... hasta que sale una noticia.',
      icon: 'salud',
      colors: { main: P.green, alt: P.cream, dark: P.greenD, ink: P.greenDD },
      startPrice: 100,
      volatility: 0.016, // desviación típica por vela
      drift: 0.0105,     // deriva por vela con tendencia máxima
      phase: [16, 30],   // velas que dura cada fase de tendencia
      flatChance: 0.16,  // probabilidad de que una fase no tenga dirección clara
      reversion: 0.012,  // vuelta suave al precio de referencia (evita precios absurdos)
      eventRate: 0.4,    // probabilidad por turno de que aparezca un evento
      candles: 12,       // velas que dura una operación si no la cierras antes
      twist: { chance: 0.26, min: 0.055, max: 0.1 }, // giro inesperado en las últimas velas
      unlock: { type: 'start' },
    },
    {
      id: 'tecno',
      name: 'MERCADO TECNOLÓGICO',
      short: 'TECNOLOGÍA',
      tag: 'SUBE Y CAE RÁPIDO',
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
      unlock: { type: 'goal', goal: 'g1000', label: '$1K' },
    },
    {
      id: 'negocios',
      name: 'MERCADO DE PEQUEÑOS NEGOCIOS',
      short: 'NEGOCIOS',
      tag: 'TENDENCIAS LARGAS',
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
      unlock: { type: 'goal', goal: 'g5000', label: '$5K' },
    },
    {
      id: 'mineria',
      name: 'MERCADO MINERO',
      short: 'MINERÍA',
      tag: 'VOLATILIDAD EXTREMA',
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
      unlock: { type: 'goal', goal: 'g25000', label: '$25K' },
    },
  ];

  SN.Data.marketById = (id) => SN.Data.markets.find((m) => m.id === id);
})(window.SN);
