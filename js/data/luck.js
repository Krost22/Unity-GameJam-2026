// Días de la suerte (equivalente a un ScriptableObject de evento): un día es de la suerte si su número
// lleva un 7 (7, 17, 27... y del 70 al 79). Cuantos más sietes, más fuerte: el 77 vale doble, el 777 triple.
(function (SN) {
  'use strict';

  SN.Data.luck = {
    trend: 0.3,          // tendencia extra de todos los mercados abiertos, por cada siete
    rainTrend: 0.75,     // LLUVIA DE ORO: crecimiento extraordinario
    firstDebtScale: 0.5, // el día 7 es el plazo de la Pleyzeta: mientras no la pagues, la suerte es más tímida
    bonus: 0.07,         // bonificación por cada operación ganadora (+7% por cada siete)
    starMul: 1.77,       // ESTRELLA DE LA SUERTE: ganancia (y tope) ×1.77 en un mercado
    goldenChance: 0.35,  // probabilidad (por siete) de que aparezca un objeto dorado sin MERCADO DORADO
    discount: 0.3,       // Don Siete rebaja el estilo de vida un 30% el día del MERCADO DORADO

    // Eventos especiales: con 1 siete sale uno de los "ligeros"; con 2, uno grande y 1-2 ligeros; con 3, todos
    specials: {
      lluvia: { name: 'Lluvia de Oro', text: 'Llueve oro sobre la ciudad. Los mercados se disparan.' },
      dorado: { name: 'Mercado Dorado', text: 'Don Siete abre su puesto: objetos que solo se venden hoy.' },
      ruleta: { name: 'Ruleta de la Fortuna', text: 'Un giro gratis. En la TIENDA.' },
      estrella: { name: 'Estrella de la Suerte', text: 'Un mercado brilla: sus ganancias valen ×1.77 hoy.' },
      bendicion: { name: 'Bendición de la Fortuna', text: 'Todo lo raro es más probable hoy. Y tu suerte, mayor.' },
    },
    light: ['estrella', 'ruleta', 'bendicion'],
    big: ['lluvia', 'dorado'],

    // La ruleta (un giro por día de la suerte). weight = peso; rare = sale el doble con la Bendición
    wheel: [
      { id: 'poco', label: '+$', weight: 26 },
      { id: 'nada', label: 'Nada', weight: 18 },
      { id: 'plazo', label: '+1 día', weight: 14 },
      { id: 'seguro', label: 'Seguro', weight: 12 },
      { id: 'maldita', label: 'Deuda +7%', weight: 10 },
      { id: 'mucho', label: '+$$$', weight: 8, rare: true },
      { id: 'simbolo', label: 'Símbolo', weight: 6, rare: true },
      { id: 'siete', label: '777', weight: 6, rare: true },
    ],

    // Objetos dorados de Don Siete: solo se venden los días de la suerte (y se ven en tu cuarto)
    golden: [
      { id: 'maneki', name: 'Gato de la fortuna', price: 77, desc: 'Saluda sin parar. Nadie sabe a quién.' },
      { id: 'herradura', name: 'Herradura dorada', price: 777, desc: 'Encontrada en un caballo que no la echará de menos.' },
      { id: 'trebol4', name: 'Trébol de cuatro hojas', price: 7777, desc: 'Plastificado. La quinta hoja se perdió por el camino.' },
      { id: 'billete7', name: 'Billete de 7 dólares', price: 77777, desc: 'No existe. Por eso vale tanto.' },
    ],

    // Noticias de la fortuna que pueden salir ese día (con su efecto en el precio)
    events: [
      { id: 'gatonegro', kind: 'shock', tone: 'pos', art: 'trebol', title: 'Un gato negro cruza la calle marcha atrás', text: 'Los expertos dicen que eso trae suerte. Los gatos no opinan.', min: 0.04, max: 0.09 },
      { id: 'trebolsiete', kind: 'trend', tone: 'pos', art: 'trebol', title: 'Encuentran un trébol de siete hojas', text: 'Una vecina lo ha plastificado. Cola para verlo.', trend: 0.6, candles: 12 },
      { id: 'loteria', kind: 'rumor', tone: 'pos', art: 'oro', title: '¿Ha tocado la lotería en el barrio?', text: 'Todos dicen tener el número premiado. Todos acaban en 7.', prob: 0.7, yes: 0.09, no: -0.04, yesText: 'Premio confirmado', noText: 'Era otro número' },
    ],
    news: { title: 'HOY ES DÍA DE LA SUERTE', text: 'El número 7 está en todas partes. Los mercados lo celebran.' },
  };
})(window.SN);
