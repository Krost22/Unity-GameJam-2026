// Escalera de progresión (equivalente a un ScriptableObject de campaña): una lista ORDENADA de pasos.
// Es una CADENA DE DEUDAS: solo hay una a la vez y, al pagarla, salta la siguiente. Siempre debes algo.
//   debt -> la deuda inicial (la Pleyzeta). El paso termina al pagarla.
//   gift -> "regalo" del encapuchado: desbloquea una mejora (que luego hay que comprar), abre los mercados
//           de `markets` y crea una deuda. El paso termina al pagarla.
//   item -> objeto clave de la tienda: FUTURO.exe lo ofrece en cuanto pagas la deuda anterior (nada hoy, todo
//           en unos días: una deuda nueva) y abre un mercado negro. El paso termina al pagarla.
// Cada deuda saldada trae un BONO de la app (D.payBonus): así nunca empiezas la siguiente a cero.
//   goal -> meta de capital: solo la final (el fin de la demo).
// Para cambiar el ritmo de la partida basta con tocar importes y plazos aquí (la prueba de equilibrio avisa).
(function (SN) {
  'use strict';
  const D = SN.Data;

  // Objetos clave de la tienda (nombres de parodia). Se compran en orden y solo con la oferta de FUTURO.exe,
  // que salta sola al pagar la deuda anterior: nada hoy y todo, con intereses, en `days` días.
  D.keyItems = [
    { id: 'tele', name: 'Tele SAMSONG 98"', short: 'la tele', price: 450, days: 7, market: 'salud_negro',
      desc: 'Curva, plana y tan grande que tapa media pared.' },
    { id: 'movil', name: 'Móvil iFON 17 Pro Max Plus', short: 'el móvil', price: 3000, days: 8, market: 'tecno_negro',
      desc: 'Tres cámaras más que el anterior. Las mismas llamadas.' },
    { id: 'moto', name: 'Moto YAMAJA Turbo 3000', short: 'la moto', price: 24000, days: 9, market: 'negocios_negro',
      desc: 'Tan rápida que llegas antes de salir. El casco, de regalo.' },
    { id: 'reloj', name: 'Reloj RÓLEZ Perpetuo', short: 'el reloj', price: 230000, days: 9, market: 'mineria_negro',
      desc: 'Da la hora. Muy cara.' },
  ];
  D.keyItemById = (id) => D.keyItems.find((k) => k.id === id);

  // La oferta de FUTURO.exe: hoy no pagas nada y debes el 150% del precio (la letra pequeña). Es el paso de la
  // historia: no se puede rechazar ni pide tener dinero en la cuenta (la deuda se paga después).
  D.offer = { upfront: 0, debt: 1.5, solvency: 0 };

  // Bono por usar la app: al saldar cada deuda, el encapuchado te devuelve una parte (nunca te quedas a cero
  // justo antes de que llegue la siguiente deuda). frac: parte de la deuda pagada; min: lo mínimo que da;
  // ready: además, te deja con al menos esta parte de la SIGUIENTE deuda (si no, las deudas crecen x5 en cada
  // escalón y empezar casi a cero sería imposible de remontar).
  D.payBonus = { frac: 0.3, min: 60, ready: 0.12 };
  D.payBonusFor = (amount, next = 0, capital = 0) =>
    Math.max(D.payBonus.min, Math.round(amount * D.payBonus.frac), Math.round(next * D.payBonus.ready - capital));

  // Mejoras a crédito: no pagas nada hoy; su precio, con estos intereses, se suma a la deuda que tengas.
  // Si no debes nada, abren su propia deuda con `days` días de plazo.
  D.credit = { interest: 0.4, days: 4 };

  D.chain = [
    { id: 'pleyzeta', kind: 'debt', label: 'la deuda de la Pleyzeta' },
    { id: 'regalo1', kind: 'gift', upgrade: 'limite', debt: 300, days: 7, story: 'gift1' },
    { id: 'tele', kind: 'item', item: 'tele', story: 'item1' },
    { id: 'regalo2', kind: 'gift', upgrade: 'analisis', markets: ['tecno'], debt: 1200, days: 8, story: 'gift2' },
    { id: 'movil', kind: 'item', item: 'movil', story: 'item2' },
    { id: 'regalo3', kind: 'gift', upgrade: 'suerte', markets: ['negocios'], debt: 10000, days: 8, story: 'gift3' },
    { id: 'moto', kind: 'item', item: 'moto', story: 'item3' },
    { id: 'regalo4', kind: 'gift', upgrade: 'resistencia', markets: ['mineria'], debt: 70000, days: 9, story: 'gift4' },
    { id: 'reloj', kind: 'item', item: 'reloj', story: 'item4' },
    { id: 'g100000', kind: 'goal', amount: 300000, reward: 0, markets: [], story: 'goal100000' },
  ];
  D.stepById = (id) => D.chain.find((s) => s.id === id);
})(window.SN);
