// Escalera de progresión (equivalente a un ScriptableObject de campaña): una lista ORDENADA de pasos.
// Solo el paso actual está activo y solo hay UNA deuda a la vez: nada se desbloquea antes que lo anterior.
//   debt -> la deuda inicial (la Pleyzeta). El paso termina al pagarla.
//   gift -> "regalo" del encapuchado: desbloquea una mejora (que luego hay que comprar) y crea una deuda.
//           El paso termina al pagarla.
//   item -> objeto clave de la tienda: solo se compra con la oferta de FUTURO.exe (una deuda nueva) y abre
//           un mercado negro. El paso termina al pagarla.
//   goal -> meta de capital: abre un mercado normal y da el bono de la app.
// Para cambiar el ritmo de la partida basta con tocar importes y plazos aquí (la prueba de equilibrio avisa).
(function (SN) {
  'use strict';
  const D = SN.Data;

  // Objetos clave de la tienda (nombres de parodia). Se compran en orden y solo cuando te llega el precio
  // completo... pero FUTURO.exe siempre encuentra una oferta "mejor": un poco hoy y el resto, en `days` días.
  D.keyItems = [
    { id: 'tele', name: 'Tele SAMSONG 98"', short: 'la tele', price: 600, days: 5, market: 'salud_negro',
      desc: 'Curva, plana y tan grande que tapa media pared.' },
    { id: 'movil', name: 'Móvil iFON 17 Pro Max Plus', short: 'el móvil', price: 2500, days: 5, market: 'tecno_negro',
      desc: 'Tres cámaras más que el anterior. Las mismas llamadas.' },
    { id: 'moto', name: 'Moto YAMAJA Turbo 3000', short: 'la moto', price: 12000, days: 6, market: 'negocios_negro',
      desc: 'Tan rápida que llegas antes de salir. El casco, de regalo.' },
    { id: 'reloj', name: 'Reloj RÓLEZ Perpetuo', short: 'el reloj', price: 60000, days: 6, market: 'mineria_negro',
      desc: 'Da la hora. Muy cara.' },
  ];
  D.keyItemById = (id) => D.keyItems.find((k) => k.id === id);

  // La oferta de FUTURO.exe: pagas un 10% hoy y debes el 150% del precio (la letra pequeña)
  D.offer = { upfront: 0.1, debt: 1.5 };

  D.chain = [
    { id: 'pleyzeta', kind: 'debt', label: 'la deuda de la Pleyzeta' },
    { id: 'regalo1', kind: 'gift', upgrade: 'limite', debt: 150, days: 5, story: 'gift1' },
    { id: 'tele', kind: 'item', item: 'tele', story: 'item1' },
    { id: 'g1000', kind: 'goal', amount: 1000, reward: 100, markets: ['tecno'], story: 'goal1000' },
    { id: 'regalo2', kind: 'gift', upgrade: 'analisis', debt: 2000, days: 5, story: 'gift2' },
    { id: 'movil', kind: 'item', item: 'movil', story: 'item2' },
    { id: 'g5000', kind: 'goal', amount: 5000, reward: 400, markets: ['negocios'], story: 'goal5000' },
    { id: 'regalo3', kind: 'gift', upgrade: 'suerte', debt: 10000, days: 5, story: 'gift3' },
    { id: 'moto', kind: 'item', item: 'moto', story: 'item3' },
    { id: 'g25000', kind: 'goal', amount: 25000, reward: 2000, markets: ['mineria'], story: 'goal25000' },
    { id: 'regalo4', kind: 'gift', upgrade: 'resistencia', debt: 50000, days: 6, story: 'gift4' },
    { id: 'reloj', kind: 'item', item: 'reloj', story: 'item4' },
    { id: 'g100000', kind: 'goal', amount: 100000, reward: 0, markets: [], story: 'goal100000' },
  ];
  D.stepById = (id) => D.chain.find((s) => s.id === id);
})(window.SN);
