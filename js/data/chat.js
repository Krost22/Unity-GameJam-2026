// Mensajín (parodia de mensajería de los 2000): las conversaciones con Kevo, el amigo que también se
// endeudó por la PLEYZETA 6 y también recibió FUTURO.exe. Su historia acompaña toda la partida:
// de la emoción del dinero fácil a olvidar cosas, a desaparecer... y a que te escriba su madre.
//
// convos = la historia principal, en orden. Cada una llega cuando se cumple su condición:
//   day/turn  -> a partir de ese día y turno
//   when      -> cuando pasa algo ('debtPaid', 'g1000', 'g5000', 'g25000', 'g100000'), y delay turnos después
//   skipIf    -> se salta si ya pasó eso (p. ej. no preguntar por el plazo si ya pagaste)
// side = conversaciones que solo llegan si pasa algo concreto ('piggy', 'bigLoss', 'rewind').
// msgs = lo que escribe Kevo · reply = lo que escribe el protagonista (el jugador solo pulsa teclas)
// after = la respuesta de Kevo. Líneas especiales: '!zumbido' sacude la ventana · '*texto' aviso del
// sistema · '>ventana' hace que pase algo al otro lado de la ventana (ver SN.Desk.windowEvent).
(function (SN) {
  'use strict';

  SN.Data.chat = {
    app: 'Mensajín',
    friend: { name: 'Kevo', nick: 'Kevo ~ PLEYZETA 6 o muerte ~' },
    convos: [
      // ---------- La deuda (días 1-7) ----------
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
        id: 'cobrador', day: 4, turn: 0,
        msgs: ['¿a ti te llama el cobrador?', 'a mí me llamaron 3 veces ayer', 'yo ya pagué. pero siguen llamando', 'dicen que falta algo'],
        reply: 'Si ya pagaste, no les debes nada. ¿Qué más quieren?',
        after: ['no sé', 'no dicen dinero', 'dicen "lo otro"'],
      },
      {
        id: 'hermano', day: 5, turn: 0,
        msgs: ['mi hermana dice que estoy raro', 'que hablo dormido. de velas', '¿tú tienes hermanos?'],
        reply: 'Tengo a Tommy. Tiene 8 años y ahorra para su operación.',
        after: ['qué bonito', 'cuídalo', 'en serio, bro. cuídalo'],
      },
      {
        id: 'plazo', day: 6, turn: 2, skipIf: 'debtPaid',
        msgs: ['mañana es el último día ¿no?', 'si no llegas te presto', 'bueno no. ya no tengo nada que prestar'],
        reply: 'Llegaré. Tengo que llegar.',
        after: ['eso dijo mi primo', 'da igual. suerte'],
      },
      // ---------- Libre (después de pagar) ----------
      {
        id: 'libre', when: 'debtPaid', delay: 1,
        msgs: ['¿¿PAGASTE??', 'ahora eres libre', 'jaja. libre', '¿y por qué sigues abriendo el programa?'],
        reply: 'Solo un poco más. Para tener un colchón.',
        after: ['ya. un colchón', 'yo voy a por 5 mil', 'mi madre cree que vendo cosas por internet'],
        nick: 'Kevo ~ a por los 5K ~',
      },
      {
        id: 'hospital', when: 'debtPaid', delay: 4,
        msgs: ['¿viste lo del hospital del barrio norte?', 'mi tía trabajaba ahí', 'dice que un día llegaron y no estaba el dinero', 'ni los papeles. ni la mitad de los pacientes'],
        reply: 'Qué raro. Seguro que es un error de las noticias.',
        after: ['eso dijo ella', 'y luego se le olvidó a qué se dedicaba'],
      },
      {
        id: 'toby', when: 'debtPaid', delay: 8,
        msgs: ['bro pregunta rara', '¿cómo se llamaba mi perro?', 'el que tuve de pequeño. tú lo conocías'],
        reply: 'Toby. Se llamaba Toby. ¿Estás bien?',
        after: ['Toby', 'lo tenía en la punta de la lengua', 'es como si alguien se lo hubiera llevado'],
      },
      // ---------- $1,000: Tecnología ----------
      {
        id: 'farolas', when: 'g1000', delay: 1,
        msgs: ['¿te abrió TECNOLOGÍA?', 'a mí también', 'ahí se gana rapidísimo. y se pierde más rápido', 'ayer las farolas de mi calle se apagaron cuando gané', '>apagon'],
        reply: 'Casualidad. Las farolas siempre se apagan.',
        after: ['a la vez que gané', 'las 12. una por una'],
      },
      {
        id: 'perdio', when: 'g1000', delay: 5,
        msgs: ['perdí todo', 'TODO', '$3,000 en una vela. la última. siempre es la última', 'el programa dice que siga. que la próxima es la buena'],
        reply: 'Para, Kevo. Cierra el programa. Te paso algo si lo necesitas.',
        after: ['no puedo cerrarlo', 'no tiene botón de cerrar', '¿el tuyo sí?'],
        nick: 'Kevo',
      },
      // ---------- $5,000: Negocios ----------
      {
        id: 'frio', when: 'g5000', delay: 1,
        msgs: ['!zumbido', 'lo recuperé todo', 'tengo 30 mil', 'el encapuchado vino a felicitarme. en persona', 'dice que soy de los buenos'],
        reply: '¿Vino a tu casa? Kevo, eso da miedo.',
        after: ['no da miedo', 'da... frío', 'mi casa está muy fría desde entonces'],
        nick: 'Kevo ~ de los buenos ~',
      },
      {
        id: 'ventana', when: 'g5000', delay: 6,
        msgs: ['!zumbido', 'hay alguien en mi ventana', 'con capucha', 'dice que viene a cobrar', 'lo otro'],
        reply: 'No abras. Llama a tu madre. ¿Kevo? ¿Sigues ahí?',
        after: ['*Kevo se ha desconectado.'],
        offline: true,
      },
      // ---------- $25,000: Minería ----------
      {
        id: 'pagado', when: 'g25000', delay: 1,
        msgs: ['*Kevo se ha conectado.', 'ya pagué', 'todo está bien ahora', 'no me acuerdo de qué me preocupaba', 'tú también vas a pagar :)'],
        reply: '¿Quién eres? Tú no eres Kevo.',
        after: ['soy de los buenos', 'nos vemos pronto', '*Kevo se ha desconectado.'],
        nick: 'Kevo [PAGADO]',
        offline: true,
      },
      {
        id: 'madre', when: 'g25000', delay: 4,
        msgs: ['*Kevo se ha conectado.', 'hola. soy la madre de Kevo', 'estoy usando su ordenador', 'Kevo no vuelve a casa desde hace cuatro días', 'en su pantalla solo hay un programa abierto. FUTURO.exe', 'dice que tú también lo tienes'],
        reply: 'Señora, no sé dónde está. Pero voy a averiguarlo.',
        after: ['gracias', 'si lo ves, dile que su perro se llamaba Toby', 'él siempre se olvidaba', '*Kevo se ha desconectado.'],
        nick: 'Kevo',
        offline: true,
      },
      // ---------- $100,000 ----------
      {
        id: 'mira', when: 'g100000', delay: 1,
        msgs: ['*Kevo se ha conectado.', '!zumbido', 'ya casi estás listo', 'eso me dijeron a mí', 'mira por la ventana', '>encapuchado'],
        reply: '¿Kevo? ¿Eres tú? ¿Dónde estás?',
        after: ['al otro lado del mercado', 'aquí siempre hay alguien que paga', '*Kevo se ha desconectado.'],
        offline: true,
      },
    ],
    side: [
      {
        id: 'piggy', when: 'piggy', delay: 1,
        msgs: ['bro', 'no contestas desde ayer', '¿estás bien?'],
        reply: 'Rompí el cerdito de Tommy. El dinero de su operación.',
        after: ['...', 'yo rompí la hucha de mi abuela', 'no se lo digas a nadie', 'ella ya no se acuerda de que tenía una'],
      },
      {
        id: 'bigloss', when: 'bigLoss', delay: 0,
        msgs: ['¿te pasó lo de la última vela?', 'a mí siempre me pasa', 'es como si el programa supiera lo que vas a hacer'],
        reply: 'Sabe. Estoy seguro de que sabe.',
        after: ['shh', 'no lo digas en voz alta'],
      },
      {
        id: 'rewind', when: 'rewind', delay: 1,
        msgs: ['oye', '¿tú también sientes que esto ya lo vivimos?', 'el mismo día. las mismas velas'],
        reply: 'Sí. Como si alguien hubiera rebobinado.',
        after: ['déjà vu, dicen', 'yo creo que es el programa', 'nos deja volver para que sigamos jugando'],
      },
    ],
  };
})(window.SN);
