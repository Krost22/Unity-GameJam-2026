// Mensajín (parodia de mensajería de los 2000): las conversaciones con Kevo, el amigo que también se
// endeudó por la PLEYZETA 6 y también recibió FUTURO.exe. Una conversación por momento de la historia.
// day/turn = a partir de cuándo llega · msgs = lo que escribe Kevo · reply = lo que escribe el protagonista
// (el jugador solo pulsa teclas; el juego pone las letras) · after = la respuesta de Kevo.
// Líneas especiales: '!zumbido' sacude la ventana · '*texto' es un aviso del sistema.
(function (SN) {
  'use strict';

  SN.Data.chat = {
    app: 'Mensajín',
    friend: { name: 'Kevo', nick: 'Kevo ~ PLEYZETA 6 o muerte ~' },
    convos: [
      {
        id: 'hola', day: 1, turn: 0,
        msgs: ['bro', 'BRO', '¿¿viste la oferta de la Pleyzeta 6??', 'yo la pedí. con dinero que no tengo jajaja'],
        reply: 'Yo también. Debo $250 y tengo 7 días. Estoy frito.',
        after: ['jajaja somos iguales', 'oye... ¿a ti también te apareció un tipo con capucha?', 'a mí me dio un programa raro. FUTURO.exe'],
      },
      {
        id: 'pista', day: 1, turn: 2,
        msgs: ['lo probé', 'le metí 20 pavos y ahora tengo 60', '¿¿¿CÓMO???'],
        reply: 'Mira el cono de la gráfica. Si sigues la flecha, casi siempre aciertas.',
        after: ['eres un genio', 'voy a meterle TODO'],
      },
      {
        id: 'racha', day: 2, turn: 1,
        msgs: ['!zumbido', 'BRO. llevo $400', 'ya pagué mi Pleyzeta y me sobra', 'me voy a comprar otra. una para cada ojo'],
        reply: 'No te pases. Esto no es normal. Si ganamos tanto, ¿quién lo paga?',
        after: ['ni idea ni me importa jajaja', 'el de la capucha dijo algo de eso', '"siempre hay alguien que paga las ganancias". ni idea'],
        nick: 'Kevo ~ $$$ REY DEL MERCADO $$$ ~',
      },
      {
        id: 'sueno', day: 3, turn: 0,
        msgs: ['oye', '¿tú duermes?', 'yo ya no', 'cierro los ojos y veo velas. verdes y rojas'],
        reply: 'Yo también las veo. Mañana descanso, te lo juro.',
        after: ['mentiroso jaja', 'yo tampoco puedo parar'],
      },
      {
        id: 'perdio', day: 4, turn: 0,
        msgs: ['perdí todo', 'TODO', '$3,000 en una vela. la última. siempre es la última', 'el programa dice que siga. que la próxima es la buena'],
        reply: 'Para, Kevo. Cierra el programa. Si llego, mañana te paso algo.',
        after: ['no puedo cerrarlo', 'no tiene botón de cerrar', '¿el tuyo sí?'],
        nick: 'Kevo',
      },
      {
        id: 'ventana', day: 5, turn: 0,
        msgs: ['!zumbido', 'hay alguien en mi ventana', 'con capucha', 'dice que viene a cobrar'],
        reply: 'No abras. Llama a tu madre. ¿Kevo? ¿Sigues ahí?',
        after: ['*Kevo se ha desconectado.'],
        offline: true,
      },
      {
        id: 'pagado', day: 6, turn: 0,
        msgs: ['*Kevo se ha conectado.', 'ya pagué', 'todo está bien ahora', 'tú también vas a pagar :)'],
        reply: '¿Quién eres? Tú no eres Kevo.',
        after: ['nos vemos el día 7', '*Kevo se ha desconectado.'],
        nick: 'Kevo [PAGADO]',
        offline: true,
      },
    ],
  };
})(window.SN);
