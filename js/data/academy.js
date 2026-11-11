// La Academia de BRAVO FINES (equivalente a un ScriptableObject de árbol de habilidades): un gurú del trading
// que aparece después de pagar la Pleyzeta y vende "conocimiento". Cada rama es una fila de nodos en orden:
// para comprar uno hay que tener el anterior de su rama. Se pagan con dinero.
// Efectos que ya funcionan (js/systems/academy.js):
//   income -> negocio: da ese dinero cada mañana
//   bonus  -> se suma a cada operación ganadora (0.05 = +5%)
//   halve  -> la primera pérdida de cada día, a la mitad
//   offer  -> multiplica la deuda de las ofertas de FUTURO.exe (0.9 = un 10% menos)
// soon: true -> "Próximamente": se ve con candado. Para añadir un avance nuevo basta con quitarle `soon`,
// darle `cost` y un efecto (y, si es un efecto nuevo, su línea en js/systems/academy.js).
(function (SN) {
  'use strict';

  SN.Data.academy = {
    guru: { id: 'bravo', name: 'Bravo Fines', nick: 'BRAVO FINES ~ 3 Lambos ~' },
    branches: [
      {
        id: 'negocios', name: 'Negocios', color: 'orange',
        nodes: [
          { id: 'limonada', short: 'Limonada', name: 'Puesto de limonada', cost: 200, income: 20, icon: 'limonada', desc: 'Tu primer negocio. Gana dinero mientras duermes. Bueno, mientras duerme el limón.' },
          { id: 'chicles', short: 'Chicles', name: 'Máquina de chicles', cost: 1200, income: 120, icon: 'chicles', desc: 'En la puerta del colegio. Los niños pagan en monedas. Muchas monedas.' },
          { id: 'lavanderia', short: 'Lavadero', name: 'Lavandería', cost: 8000, income: 800, icon: 'lavadora', desc: 'Lava ropa. Solo ropa. Bravo insiste mucho en eso.' },
          { id: 'foodtruck', short: 'Camión', name: 'Food truck', soon: true, icon: 'camion', desc: 'Hamburguesas sobre ruedas. Próximamente.' },
          { id: 'franquicia', short: 'Franquic.', name: 'Franquicia', soon: true, icon: 'tienda', desc: 'Tu cara en mil tiendas. Próximamente.' },
        ],
      },
      {
        id: 'trading', name: 'Trading', color: 'cyan',
        nodes: [
          { id: 'tiburon', short: 'Tiburón', name: 'Mentalidad de tiburón', cost: 500, bonus: 0.05, icon: 'tiburon', desc: '+5% en cada operación ganadora. "Los tiburones no duermen." Bravo tampoco.' },
          { id: 'planb', short: 'Plan B', name: 'Plan B', cost: 3000, halve: true, icon: 'escudo', desc: 'La primera pérdida de cada día, a la mitad. "Si no hay plan A, hay plan B."' },
          { id: 'bot', short: 'Bot', name: 'Bot de trading', soon: true, icon: 'robot', desc: 'Opera solo mientras tú duermes. Próximamente.' },
          { id: 'insider', short: 'Chivato', name: 'Información privilegiada', soon: true, icon: 'lupa', desc: 'Saber las noticias antes que nadie. Próximamente.' },
        ],
      },
      {
        id: 'contactos', name: 'Contactos', color: 'violet',
        nodes: [
          { id: 'letrapeq', short: 'Letra peq', name: 'Leer la letra pequeña', cost: 2000, offer: 0.9, icon: 'lupa', desc: 'Las ofertas de FUTURO.exe traen un 10% menos de deuda. "Nadie la lee. Por eso funciona."' },
          { id: 'angel', short: 'Ángel', name: 'Inversor ángel', soon: true, icon: 'trebol', desc: 'Alguien que pone dinero por ti. Próximamente.' },
          { id: 'contable', short: 'Contable', name: 'Contable creativo', soon: true, icon: 'documento', desc: 'Los números dicen lo que tú quieras. Próximamente.' },
        ],
      },
    ],

    // Se presenta (con su retrato) la mañana siguiente a pagar la Pleyzeta
    intro: [
      '¡HOLA, FUTURO MILLONARIO! Soy BRAVO FINES.',
      'Gurú del trading, coach de vida y dueño de tres Lambos. Alquilados, pero tres.',
      'He visto cómo operas. Fatal. Pero tienes HAMBRE. Me gusta.',
      'Te abro mi ACADEMIA: negocios que dan dinero cada día, trucos de trading y contactos.',
      'La tienes en la TIENDA (tecla T), categoría Academia. Recuerda: el dinero no se gana. Se MANIFIESTA.',
    ],

    // Lo que escribe por Mensajín (no se le puede contestar: no lee los mensajes, solo los manda)
    // when/delay: como js/data/chat.js ('bravo' = el día que se presenta)
    messages: [
      { id: 'b1', when: 'bravo', delay: 0, lines: ['¿CANSADO DE PERDER?', 'Soy BRAVO FINES. Mentor, emprendedor y padre de tres Lambos.', 'Mi ACADEMIA ya está en tu FUTURO.exe. TIENDA → ACADEMIA.', 'Empieza por la limonada. Todos los imperios empiezan por una limonada.'] },
      { id: 'b2', when: 'bravo', delay: 4, lines: ['CONSEJO DEL DÍA: compra barato y vende caro.', 'De nada.'] },
      { id: 'b3', when: 'tele', delay: 3, lines: ['Los pobres ahorran.', 'Los ricos tienen un puesto de limonada.', '¿Ya tienes el tuyo?'] },
      { id: 'b4', when: 'regalo2', delay: 3, lines: ['Hoy me he levantado a las 4:00.', 'He meditado, he corrido 10 km y he perdido $8,000.', 'Pero con MENTALIDAD.'] },
      { id: 'b5', when: 'movil', delay: 2, lines: ['¿Sabes leer la letra pequeña?', 'Yo tampoco. Por eso la enseño.', 'Nodo LEER LA LETRA PEQUEÑA. Solo en mi Academia.'] },
      { id: 'b6', when: 'regalo3', delay: 3, lines: ['¿El tipo de la capucha?', 'Sí. Le conozco.', 'Todos los gurús le debemos algo. No se lo digas.'] },
      { id: 'b7', when: 'regalo4', delay: 2, lines: ['Te voy a contar un secreto.', 'Mi Lambo es alquilado. Mi casa es alquilada.', 'Mi sonrisa... también.'] },
      { id: 'b8', when: 'g100000', delay: 1, lines: ['Trescientos mil. Ya eres casi como yo.', 'Eso no es un cumplido.'] },
    ],
  };
})(window.SN);
