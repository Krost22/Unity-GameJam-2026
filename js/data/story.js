// Textos narrativos: intro, encapuchado, tutorial, noticias extrañas y bancarrota (equivalente a ScriptableObjects de diálogo).
(function (SN) {
  'use strict';

  SN.Data.story = {
    shop: {
      store: 'MEGATIENDA.COM',
      product: 'PLEYZETA 6 ULTRA',
      edition: 'Edición horno doméstico',
      includes: 'Incluye: Gran robo de autos VI: Vice Bahía',
      bullets: [
        'Gráficos tan reales que necesitarás gafas nuevas',
        'También calienta la habitación (y la cocina)',
        'Acceso anticipado a contenido que todavía no existe',
        'Mundo abierto con 45.000 errores exclusivos',
      ],
      price: '$250.00',
      oldPrice: 'Antes: $249.99',
      balance: 'Tu saldo: $100.00',
      insufficient: 'Saldo insuficiente',
      buy: 'Compra ahora. Paga después.',
      thanks: '¡Gracias por tu compra!',
    },
    introSubs: {
      browsing: '(Llevo meses esperando esta oferta...)',
      noMoney: '(No me alcanza... pero dice "paga después")',
      click: '¡¡SÍ!!',
      happy: '¡ES MÍA! ¡POR FIN ES MÍA!',
      confused: '...¿Endeudado?',
      worried: '¿Siete días? ¿Y de dónde saco yo $250?',
    },
    debtLines: [
      { text: 'COMPRA APROBADA.', color: 'green' },
      { text: 'ESTÁS ENDEUDADO.', color: 'coral' },
      { text: 'DEUDA: $250 USD.', color: 'yellow' },
      { text: 'FECHA LÍMITE: 7 DÍAS.', color: 'orange' },
    ],
    notifications: ['Pago pendiente: $250', 'Recordatorio: quedan 7 días', 'Aviso: intereses por mora', '¿Seguro que podrás pagar?'],
    hoodedIntro: [
      '¿Problemas de dinero?',
      'Tranquilo. Todos tienen una oportunidad.',
      'Te he conseguido algo que puede convertir cien dólares en mucho más.',
      'Solo tienes que aprender a utilizarlo.',
    ],
    hoodedApp: 'Recuerda una cosa: en este mercado siempre hay alguien que paga las ganancias.',
    hoodedName: '???',

    // Pasos del tutorial (TutorialManager): se aprende haciendo, con frases cortas.
    // target = selector a resaltar dentro del monitor. wait = acción que el jugador tiene que hacer.
    tutorial: [
      { id: 'hola', lines: ['Esta es FUTURO.exe. A partir de hoy, tu mejor amiga.'] },
      { id: 'pista', target: '#chart-wrap', lines: ['¿Ves ese cono con flechas? Es la PISTA: por dónde irá el precio.', 'Más flechas, más segura. No siempre acierta... pero casi.'] },
      { id: 'operar', target: '#btn-buy', wait: 'buy', lines: ['Apunta arriba. Pulsa SUBE.'] },
      { id: 'cobrar', target: '#btn-close', wait: 'cashout', lines: ['¡Vas ganando! Pulsa COBRAR antes de que cambie.'] },
      { id: 'esperar', wait: 'trade', lines: [] },
      { id: 'susto', target: '#hud-capital', lines: ['¿Lo ves? Las últimas velas pueden darle la vuelta a todo.', 'Tú ya habías cobrado. Dinero fácil.'] },
      { id: 'apuesta', target: '#trade-form', lines: ['Más apuesta y más multiplicador: más premio... y más riesgo.'] },
      { id: 'meta', target: '#hud-goal', lines: ['Junta $250 antes del día 7 y paga la deuda.', 'Si te quedas sin dinero, se acabó. Suerte.'] },
    ],
    tutorialPayHint: ['¡Ya tienes para pagar!', 'Pulsa PAGAR DEUDA. O sigue jugando... tú sabrás.'],
    retryGreeting: ['¿Otra vez por aquí?', 'Te he renovado el crédito. $250, siete días. Como siempre.', 'Esta vez intenta no romper nada.'],

    // Apariciones del encapuchado tras los hitos
    hoodedEvents: {
      debtPaid: ['¿Ves? Te dije que funcionaría.', 'Ahora que estás dentro, podrías conseguir mucho más.', 'Toma un pequeño regalo de bienvenida. Y un multiplicador ×10.'],
      goal1000: ['Mil dólares. Hace nada no tenías ni para pagar una consola.', 'Te he abierto otra puerta: TECNOLOGÍA.', 'Más volátil. Más divertido. Y ya puedes comprar ANÁLISIS.'],
      darkNews: ['¿Lees las noticias? No te preocupes por eso.', 'El dinero no sale de la nada. Pero eso no es asunto tuyo.'],
      goal5000: ['Pequeños negocios. Grandes sueños.', 'Muy... rentables. Los sueños, digo.'],
      goal25000: ['Minería. Aquí excavamos más hondo que nadie.', 'No mires abajo.'],
      goal100000: ['Cien mil. Ya casi estás listo.', 'Pronto tendrás que decidir de qué lado del mercado estás.'],
    },

    // Noticias extrañas: empiezan como economía normal y poco a poco coinciden con tus ganancias
    darkNews: {
      salud: ['Un hospital del barrio norte pierde su financiación.', 'Un investigador de vacunas desaparece sin dejar rastro.', 'La clínica de la calle 4 cierra "por falta de futuro".', 'Pacientes del hospital olvidan por qué fueron.'],
      tecno: ['Un barrio entero comienza a quedarse sin electricidad.', 'Una programadora olvida cómo se escribe su propio nombre.', 'Las farolas del centro se apagan una a una.', 'Nadie recuerda quién inventó el semáforo.'],
      negocios: ['Una pequeña tienda cierra tras 40 años abierta.', 'La panadería de Doña Rosa baja la persiana. Nadie sabe por qué.', 'El taller de bicis amanece vacío. Sin herramientas. Sin dueño.', 'Los vecinos olvidan el nombre de su calle.'],
      mineria: ['Mineros aseguran haber perdido años enteros de recuerdos.', 'Un pueblo minero aparece deshabitado de la noche a la mañana.', 'Los túneles bajo la ciudad crecen solos.', 'Un niño dibuja un hombre encapuchado. Todos los niños lo dibujan.'],
      generic: ['Personas olvidan acontecimientos de la semana pasada.', 'La alcaldía no encuentra a la mitad del censo.', 'Un parque infantil amanece sin columpios y sin niños.'],
    },
    // Foto de cada noticia extraña (mismo orden que darkNews)
    darkArt: {
      salud: ['hospital', 'cartel', 'persiana', 'hospital'],
      tecno: ['apagon', 'alerta', 'farolas', 'semaforo'],
      negocios: ['persiana', 'persiana', 'bici', 'letrero'],
      mineria: ['huelga', 'ciudad', 'grietas', 'dibujo'],
      generic: ['cartel', 'documento', 'columpio'],
    },

    bankrupt: {
      title: '¡Felicidades!',
      message: 'Rompiste los ahorros de la cirugía del pequeño Tommy.',
      extra: ['Tommy lo entenderá. Probablemente.', 'Has recuperado {coins}. No llega ni para la anestesia.'],
      hint: '¡Rómpelo!',
    },
    // Noticias de relleno de la ciudad: el periódico nunca sale vacío
    fillerNews: [
      { title: 'LA PLEYZETA 6 ULTRA, AGOTADA EN TODA LA CIUDAD', text: 'Los que la tienen dicen que calienta la casa. Literalmente.', tone: 'neu', art: 'rebajas' },
      { title: 'UN VECINO JURA QUE SU APP DE INVERSIÓN LE HABLA', text: 'Dice que le llama por su nombre. Nadie le cree.', tone: 'neu', art: 'redes' },
      { title: 'SE DISPARAN LAS COMPRAS A PLAZOS ENTRE LOS JÓVENES', text: 'Los expertos piden calma. Los bancos, más plazos.', tone: 'neg', art: 'compras' },
      { title: 'EL AYUNTAMIENTO PROMETE ARREGLAR LAS FAROLAS', text: 'Es la cuarta vez este año.', tone: 'neu', art: 'farolas' },
    ],
    embargo: ['PLAZO VENCIDO', 'El cobrador se lo lleva todo', 'Capital embargado'],
    embargoEarly: ['YA NO LLEGAS', 'Ni con suerte juntas $250 a tiempo', 'El cobrador se adelanta'],
    broke: ['SIN FONDOS', 'No te alcanza ni para la apuesta mínima'],
    teaser: 'ACTIVOS HUMANOS: LIQUIDACIÓN EN CURSO',
    endDemo: ['FIN DE LA VERSIÓN 1.2', 'La historia continuará.', 'Puedes seguir operando... si te atreves.'],
  };
})(window.SN);
