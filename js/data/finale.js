// Los dos finales (la secuencia está en js/systems/finale.js). Al llegar a la meta se abre el mercado TÚ y hay
// que elegir: aceptar la última oferta del encapuchado (FINAL A, el avatar perfecto) o ejecutar NULL.EXE, que
// entregan LOS DESFASADOS por partes (FINAL B: lo pierdes todo... y luego llega Hacienda).
// La pala solo se gana en el final B.
(function (SN) {
  'use strict';
  SN.Data.finale = {
    // ---------- El mercado TÚ ----------
    you: { name: 'TÚ', label: 'TÚ · ACTIVO HUMANO', tag: 'Sin tope', warn: 'ACTIVOS HUMANOS: LIQUIDACIÓN EN CURSO', locked: 'Bloqueado' },
    // Lo que se lee en el panel de operar mientras eliges
    choice: { title: 'Tu cuenta está en venta.', offer: 'Ver la oferta', or: 'o', min: 'Ir al escritorio' },

    // ---------- La última oferta (final A) ----------
    pact: {
      title: 'ÚLTIMA OFERTA',
      lines: ['No tienes que perderlo todo.', 'Podrías tenerlo todo.', 'No volverías a preocuparte por el dinero.', 'No volverías a depender de nadie.'],
      yes: '¡Lo quiero!',
      no: 'Ahora no',
      // Si no eliges, vuelve cada turno. A la tercera, la entidad elige por ti
      insist: ['FUTURO.EXE insiste', 'FUTURO.EXE insiste. Otra vez', 'FUTURO.EXE ya no pregunta'],
      turns: 3,
    },

    // ---------- FINAL A: el avatar perfecto ----------
    a: {
      fusion: ['La entidad consigue su avatar.', 'El protagonista sigue consciente, pero ya no controla del todo su cuerpo.'],
      admin: ['NUEVO ADMINISTRADOR REGISTRADO.', 'BIENVENIDO A TU NUEVO PUESTO.', 'TENEMOS MUCHOS USUARIOS ESPERANDO.'],
      kevo: 'Destino de Kevo: desconocido. La entidad no da ninguna explicación.',
    },

    // ---------- FINAL B: NULL.EXE ----------
    // El LÉEME lo escribió el primero de LOS DESFASADOS, cuando todavía recordaba su idioma
    // (un párrafo por línea)
    readme: [
      'LÉEME',
      'Lo escribió el primero de nosotros, cuando todavía recordaba cómo se escribía.',
      'NULL.EXE no destruye al de la capa. Borra lo que le deja existir dentro de FUTURO.EXE: mercados, transacciones, valores, acumulación. Sin eso, pierde su poder y su conexión con nuestro mundo.',
      'El precio: NULL.EXE no distingue entre su riqueza y la tuya. Perderás tus inversiones, tu capital y tus propiedades. Todo.',
      'No sabemos si tu amigo volverá. Solo sabemos que el ciclo puede detenerse.',
    ],
    term: {
      prompt: 'C:\\> ',
      // Primero: ¿el encapuchado es un programa? ({capital}: lo que tienes)
      intro: [
        { cmd: 'tasklist', out: ['FUTURO.EXE          memoria: {capital}', 'encapuchado.exe     memoria: ∞      usuario: TÚ'] },
        { cmd: 'taskkill encapuchado.exe', out: ['Acceso denegado.', 'No se puede cerrar lo que no es un programa.'] },
      ],
      // Después, la secuencia de NULL.EXE (y la entidad interrumpe)
      steps: [
        { cmd: 'FUTURO.EXE --disconnect MARKET_SYSTEM', out: ['MARKET_SYSTEM: desconectado.'], hood: 'No sabes lo que estás haciendo.' },
        { cmd: 'FUTURO.EXE --rollback ENTITY_LINK', out: ['ENTITY_LINK: revertido.'], hood: 'No puedes reiniciar algo que no comprendes.' },
        { cmd: 'FUTURO.EXE --terminate BALANCE', out: ['BALANCE: terminado.'], hood: '¡Ese dinero también es tuyo!' },
        { cmd: 'FUTURO.EXE --reset', out: ['Todo listo para el reinicio.'] },
        { cmd: 'EXECUTE NULL.EXE', out: ['Ejecutando...'] },
      ],
      fear: ['¡No puedes hacer esto!', '¡Todo lo que has conseguido desaparecerá!'],
      x: 'Pulsa la X',
      done: ['SYSTEM RESET COMPLETE', 'ENTITY CONNECTION: TERMINATED', 'FUTURO.EXE: NOT FOUND'],
    },
    // Su despedida, por primera vez en letras normales (lleva H y B: no se puede escribir en el idioma secreto)
    farewell: 'EL CICLO HA TERMINADO. EL COBRO HA SIDO CANCELADO. GRACIAS.',
    b: {
      alive: ['No tiene dinero, ni inversiones, ni FUTURO.EXE.', 'Pero está vivo.'],
      kevo: 'Destino de Kevo: desconocido.',
    },

    // ---------- Epílogo B: la pala... y Hacienda ----------
    letter: {
      head: 'FUTURO.EXE — SERVICIO DE COMPENSACIÓN',
      body: [
        'Estimado usuario:',
        'Gracias por utilizar nuestros servicios.',
        'Lamentamos informarle de que ha perdido su fortuna, inversiones, propiedades y aplicación favorita.',
        'Como compensación por las molestias ocasionadas, hemos decidido enviarle un pequeño regalo.',
      ],
      gift: '+1 PALA',
      foot: 'No sabemos para qué sirve. Pero ahora es tuya.',
    },
    police: {
      name: 'Policía Fiscal',
      me: 'Tú',
      knock: '¡POLICÍA FISCAL! ¡ABRA!',
      read: 'Según nuestros registros, usted no tiene ingresos. Ni cuenta. Ni dinero. Pero tiene {list}.',
      // Lo que se lleva el embargo, con su artículo (la lista sale de lo que el jugador tiene de verdad)
      goods: {
        pleyzeta: 'una consola PLEYZETA 6', tele: 'una tele SAMSONG de 98 pulgadas', movil: 'un iFON 17 Pro Max Plus',
        moto: 'una moto YAMAJA Turbo 3000', reloj: 'un reloj RÓLEZ', taza: 'una taza decente', planta: 'una planta de plástico',
        lampara: 'un farolillo de papel', poster: 'un póster motivacional', alfombrilla: 'una alfombrilla XXL',
        teclado: 'un teclado de colores', cascos: 'unos auriculares pro', maneki: 'un gato de la suerte', herradura: 'una herradura',
        trebol4: 'un trébol de cuatro hojas', billete7: 'un billete de siete dólares', trofeo: 'un toro de oro',
      },
      // El protagonista protesta por lo último de la lista
      objection: { trofeo: 'Chapado.', planta: 'Es de plástico.', moto: 'Es a plazos.', reloj: 'Es de imitación.', tele: 'Es a plazos.' },
      taken: 'Se lo lleva igual.',
      defense: ['¡Lo gané con velas japonesas!', '¿Y declaró las velas?'],
      hits: ['¡PAF!', '¡PUM!', '¡CATAPLÁN!'],
      cries: ['¡Ay! ¡Que la Pleyzeta es a plazos!', '¡Que tengo el ticket!'],
      pc: ['¡Si ya no hay nada dentro!', 'Por eso.'],
      shovel: 'Toma. Herramienta de trabajo: no se embarga.',
    },
    paper: {
      mast: 'EL DIARIO DEL FUTURO',
      kicker: 'SUCESOS',
      title: 'CAE BRAVO FINES: DETENIDO POR ESTAFA EL GURÚ DEL «DINERO QUE SE MANIFIESTA»',
      lines: [
        'Los tres Lambos eran alquilados, y llevaba seis meses sin pagar el alquiler.',
        'La «Academia» era su cocina; la pizarra, la puerta de la nevera.',
        'Al subir al coche patrulla, levantó el pulgar a las cámaras: «¡Esto es una oportunidad de crecimiento!».',
        'Sus alumnos reclaman lo que pagaron por «Mentalidad de tiburón».',
        'El juez le ofreció un Plan B: la mitad de la condena. Bravo pidió leer la letra pequeña.',
      ],
      caption: 'Bravo Fines, con gafas de sol, en el asiento de atrás del coche patrulla.',
    },

    // ---------- FIN ----------
    end: 'FIN',
    credits: {
      title: 'SALDO NEGRO',
      lines: ['Un juego de KrostGames y Adrede', 'Hecho para la Official 2026 Unity Game Jam', 'Tema: Lucky Number', '', 'Gracias por jugar.'],
      a: 'Final: EL AVATAR PERFECTO',
      b: 'Final: NULL.EXE',
      pala: 'Has conseguido: LA PALA',
      back: 'Volver al menú',
    },
  };
})(window.SN);
