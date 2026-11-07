// Parámetros de simulación, mejoras, objetivos y tienda (equivalentes a ScriptableObjects de configuración).
(function (SN) {
  'use strict';
  const D = SN.Data;

  D.sim = {
    startCapital: 100,
    startDebt: 250,
    deadlineDays: 7,
    turnNames: ['MAÑANA', 'TARDE', 'NOCHE'], // cada operación consume un turno; 3 turnos = 1 día
    initialHistory: 60,  // velas de historial al empezar
    historyLength: 120,  // velas que se guardan por mercado
    idleCandles: 3,      // velas que avanzan los mercados que no operas en cada turno
    maxEventsPerMarket: 2,
    baseInvestLimit: 250,
    minInvestment: 10,       // apuesta mínima
    bankruptcyThreshold: 10, // si no te alcanza para la apuesta mínima, se acabó
    maxTurnGrowth: 3,        // lo máximo que se puede multiplicar el capital en un turno (para saber si ya no llegas)
    candleTime: 0.38,        // segundos que tarda en formarse una vela durante una operación
    dangerCandles: 3,        // últimas velas de la operación: la ZONA DE PELIGRO, donde pueden saltar los giros
    twistRescue: 0.62,       // si vas perdiendo, probabilidad de que el giro te salve (si vas ganando es 50%)
    climaxSigma: 2.6,        // tamaño (en desviaciones típicas) a partir del cual una vela final merece cámara lenta
    // Multiplicador de la operación (apalancamiento). La pérdida nunca supera lo invertido.
    leverages: [
      { value: 1 },
      { value: 2 },
      { value: 5 },
      { value: 10, unlock: 'debtPaid' },
    ],
    luckBiasPerLevel: 0.03,  // sesgo por vela (en desviaciones típicas) a favor de tu operación
    luckRumorPerLevel: 0.03, // +3% por nivel a que un rumor salga a tu favor
    // PISTA: error de lectura según el nivel de ANÁLISIS y umbrales de fuerza (1, 2 y 3 flechas)
    hint: { noise: [0.6, 0.42, 0.26, 0.1], powers: [0.5, 1.1, 1.8] },
    // Primera operación del tutorial: parámetros controlados. Se detiene en `holdAt` para enseñar a
    // CERRAR y en `twistAt` llega el susto, que el jugador ve ya a salvo.
    tutorial: { frac: 0.5, leverage: 2, candles: 12, regime: 1, volMul: 0.45, holdAt: 7, twistAt: 10, twistJump: -0.11 },
  };

  D.upgrades = [
    {
      id: 'suerte', name: 'SUERTE', icon: 'trebol', color: 'green',
      desc: 'Inclina un poquito el mercado a tu favor.',
      unlock: { type: 'start' },
      levels: [{ cost: 25, value: 1 }, { cost: 90, value: 2 }, { cost: 320, value: 3 }, { cost: 1400, value: 4 }, { cost: 6000, value: 5 }],
      effect: (v) => (v ? `≈ +${v * 3}% DE ACIERTO` : 'SIN EFECTO'),
    },
    {
      id: 'limite', name: 'LÍMITE', icon: 'caja', color: 'yellow',
      desc: 'Apuestas más grandes.',
      unlock: { type: 'flag', flag: 'debtPaid', label: 'PAGA TU DEUDA' },
      base: 250,
      levels: [{ cost: 150, value: 1000 }, { cost: 700, value: 5000 }, { cost: 3500, value: 25000 }, { cost: 15000, value: 100000 }, { cost: 60000, value: 1000000 }],
      effect: (v) => `MÁXIMO: ${SN.Util.short(v)}`,
    },
    {
      id: 'analisis', name: 'ANÁLISIS', icon: 'lupa', color: 'cyan',
      desc: 'La PISTA de la gráfica acierta más.',
      unlock: { type: 'goal', goal: 'g1000', label: 'META $1,000' },
      levels: [{ cost: 400, value: 1 }, { cost: 2500, value: 2 }, { cost: 12000, value: 3 }],
      effect: (v) => ['SIN EFECTO', 'PISTA NÍTIDA', 'PISTA MUY NÍTIDA', 'PISTA CASI EXACTA'][v],
    },
    {
      id: 'resistencia', name: 'RESISTENCIA', icon: 'escudo', color: 'orange',
      desc: 'Reduce ciertos efectos... de cosas que todavía no han pasado.',
      unlock: { type: 'future', label: 'PRÓXIMAMENTE' },
      levels: [],
      effect: () => '???',
    },
  ];

  // Objetivos económicos tras pagar la deuda. La app "premia" la ambición con bonos.
  D.goals = [
    { id: 'g1000', amount: 1000, reward: 100, markets: ['tecno'], story: 'goal1000' },
    { id: 'g5000', amount: 5000, reward: 400, markets: ['negocios'], story: 'goal5000' },
    { id: 'g25000', amount: 25000, reward: 2000, markets: ['mineria'], story: 'goal25000' },
    { id: 'g100000', amount: 100000, reward: 0, markets: [], story: 'goal100000' },
  ];

  // Tienda de estilo de vida: cada compra aparece en el escritorio
  D.shop = [
    { id: 'taza', name: 'TAZA DECENTE', price: 30, desc: 'Adiós al vaso de papel de hace tres días.' },
    { id: 'planta', name: 'PLANTA QUE NO SE MUERE', price: 90, desc: 'De plástico. Garantizado.' },
    { id: 'lampara', name: 'LÁMPARA DE ESCRITORIO', price: 250, desc: 'Luz cálida para decisiones frías.' },
    { id: 'poster', name: 'PÓSTER MOTIVACIONAL', price: 600, desc: '"EL DINERO NO DUERME". Tú tampoco.' },
    { id: 'alfombrilla', name: 'ALFOMBRILLA XXL', price: 1500, desc: 'Más superficie para hacer clic en SUBE.' },
    { id: 'teclado', name: 'TECLADO DE COLORES', price: 4000, desc: 'Cada tecla, un color. Cada color, una deuda menos.' },
    { id: 'cascos', name: 'AURICULARES PRO', price: 9000, desc: 'Para no oír lo que pasa fuera.' },
    { id: 'trofeo', name: 'TORO DE ORO', price: 30000, desc: 'Un toro alcista de oro macizo. Bueno, chapado.' },
  ];
})(window.SN);
