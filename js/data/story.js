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
      price: '$250',
      oldPrice: 'Antes: $249',
      balance: 'Tu saldo: $100',
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
      { id: 'operar', target: '#btn-buy', wait: 'buy', lines: ['Apunta arriba. Pulsa SUBIRÁ.'] },
      { id: 'cobrar', target: '#btn-close', wait: 'cashout', lines: ['¡Vas ganando! Pulsa COBRAR antes de que cambie.'] },
      { id: 'esperar', wait: 'trade', lines: [] },
      { id: 'susto', target: '#hud-capital', lines: ['¿Lo ves? Las últimas velas pueden darle la vuelta a todo.', 'Tú ya habías cobrado. Dinero fácil.'] },
      { id: 'apuesta', target: '#trade-form', lines: ['Más apuesta y más multiplicador: más premio... y más riesgo.'] },
      // news: abre el periódico con una noticia normal y una "errata" en el idioma secreto. spots: qué se resalta en cada frase
      { id: 'noticias', news: true, spots: ['.win.paper .np-grid', '.np-hero.cipher', '.np-hero.cipher'],
        lines: ['Y esto son las noticias. Mueven el precio: léelas siempre.', '¿Eso? Una errata de la imprenta.', 'No es relevante. Mira la gráfica, no el periódico.'] },
      { id: 'meta', target: '#hud-goal', lines: ['Junta $250 antes del día 7 y paga la deuda.', 'Si te quedas sin dinero... tendrás que sacarlo de otra parte. Suerte.'] },
    ],
    tutorialPayHint: ['¡Ya tienes para pagar!', 'Pulsa PAGAR DEUDA. O sigue jugando... tú sabrás.'],
    retryGreeting: ['¿Otra vez por aquí?', 'Te he renovado el crédito. $250, siete días. Como siempre.', 'Esta vez intenta no romper nada.'],

    // Apariciones del encapuchado tras los hitos. {debt} y {days}: la deuda que trae el "regalo".
    hoodedEvents: {
      // Regalos: desbloquean una mejora (que luego se compra)... y traen una deuda
      gift1: ['¿Ves? Te dije que funcionaría.', 'Ahora que estás dentro, podrías conseguir mucho más. Toma un regalo de bienvenida: ya puedes comprar LÍMITE. Y un multiplicador ×10.', 'Bueno... los regalos también se pagan. {debt} en {days} días. Sin prisa.'],
      gift2: ['Mil dólares. Hace nada no tenías ni para pagar una consola.', 'Te he abierto otra puerta: TECNOLOGÍA. Más volátil. Más divertido.', 'Y otro regalo: ya puedes comprar ANÁLISIS. Son {debt}. Tienes {days} días.'],
      gift3: ['Pequeños negocios. Grandes sueños.', 'Muy... rentables. Los sueños, digo. Toma: ya puedes comprar SUERTE. Te hará falta.', 'Nada es gratis. {debt} en {days} días.'],
      gift4: ['Minería. Aquí excavamos más hondo que nadie.', 'Un último regalo: RESISTENCIA. Para lo que todavía no ha pasado.', 'No mires abajo. Y no olvides pagar: {debt} en {days} días.'],
      // Objetos clave: al endeudarte con la oferta de FUTURO.exe se abre un mercado negro
      item1: ['¿Problemas de dinero?', 'Tranquilo. Te desbloqueo un nuevo mercado: SALUD... pero negro.', 'Aquí nadie hace preguntas. Y paga mejor.'],
      item2: ['¿Otra vez justo de dinero? Qué casualidad.', 'Tranquilo. Te desbloqueo un nuevo mercado: TECNOLOGÍA NEGRA.', 'Datos, chips... cosas que se caen de los camiones.'],
      item3: ['¿Problemas de dinero? Para eso estoy.', 'Te desbloqueo un nuevo mercado: NEGOCIOS NEGROS.', 'Tiendas que solo abren de noche. Como yo.'],
      item4: ['Un reloj precioso. El tiempo es lo único que no se puede comprar.', 'Bueno... casi. Te desbloqueo el último mercado: MINERÍA NEGRA.', 'Ahí abajo siempre hay alguien que paga.'],
      darkNews: ['¿Lees las noticias? No te preocupes por eso.', 'El dinero no sale de la nada. Pero eso no es asunto tuyo.'],
      goal100000: ['Cien mil. Ya casi estás listo.', 'Pronto tendrás que decidir de qué lado del mercado estás.'],
    },
    // La oferta de FUTURO.exe al comprar un objeto clave. {item} {now} {debt} {days}
    offer: {
      title: '¡ESPERA!',
      line: 'FUTURO.exe ha encontrado {item} por solo {now}.',
      save: '−90%',
      later: 'Hoy pagas {now}. El resto, después.',
      small: 'Letra pequeña',
      smallText: 'El resto, con intereses: {debt} en {days} días. FUTURO.exe no se hace responsable de lo que pase después.',
      yes: '¡Lo quiero!',
      no: 'No, gracias',
    },
    // Nombres de cada deuda (lo que se ve en el HUD y en las notas)
    debtNames: { pleyzeta: 'la Pleyzeta', gift: 'el regalo', item: '{item}' },

    // Noticias extrañas: empiezan como economía normal y poco a poco coinciden con tus ganancias
    darkNews: {
      salud: ['Un hospital del barrio norte pierde su financiación.', 'Un investigador de vacunas desaparece sin dejar rastro.', 'La clínica de la calle 4 cierra "por falta de futuro".', 'Pacientes del hospital olvidan por qué fueron.'],
      tecno: ['Un barrio entero comienza a quedarse sin electricidad.', 'Una programadora olvida cómo se escribe su propio nombre.', 'Las farolas del centro se apagan una a una.', 'Nadie recuerda quién inventó el semáforo.'],
      negocios: ['Una pequeña tienda cierra tras 40 años abierta.', 'La panadería de Doña Rosa baja la persiana. Nadie sabe por qué.', 'El taller de bicis amanece vacío. Sin herramientas. Sin dueño.', 'Los vecinos olvidan el nombre de su calle.'],
      mineria: ['Mineros aseguran haber perdido años enteros de recuerdos.', 'Un pueblo minero aparece deshabitado de la noche a la mañana.', 'Los túneles bajo la ciudad crecen solos.', 'Un niño dibuja un hombre encapuchado. Todos los niños lo dibujan.'],
      // Mercados negros: sus ganancias se cobran antes y más caro
      salud_negro: ['Un hombre despierta en un banco del parque sin recordar la semana.', 'La farmacia del garaje vende pastillas para olvidar. Se agotan.', 'Los pacientes de la clínica sin nombre no vuelven a casa.'],
      tecno_negro: ['Un barrio entero pierde sus fotos de la infancia. Los móviles, intactos.', 'Las contraseñas de la ciudad aparecen escritas en una pared.', 'Una niña recibe un mensaje de su abuela. Su abuela no sabe escribir.'],
      negocios_negro: ['El cobrador visita tiendas que ya habían cerrado.', 'Una tienda abre de madrugada. Vende recuerdos de segunda mano.', 'Los vecinos pagan deudas que no recuerdan haber pedido.'],
      mineria_negro: ['Los mineros vuelven del túnel 7 con los ojos grises.', 'Del alcantarillado sube un ruido de monedas.', 'La plaza amanece hundida. Debajo, un túnel sin fondo.'],
      generic: ['Personas olvidan acontecimientos de la semana pasada.', 'La alcaldía no encuentra a la mitad del censo.', 'Un parque infantil amanece sin columpios y sin niños.'],
    },
    // Foto de cada noticia extraña (mismo orden que darkNews)
    darkArt: {
      salud: ['hospital', 'cartel', 'persiana', 'hospital'],
      tecno: ['apagon', 'alerta', 'farolas', 'semaforo'],
      negocios: ['persiana', 'persiana', 'bici', 'letrero'],
      mineria: ['huelga', 'ciudad', 'grietas', 'dibujo'],
      salud_negro: ['ciudad', 'pastillas', 'hospital'],
      tecno_negro: ['movil', 'candado', 'redes'],
      negocios_negro: ['persiana', 'letrero', 'documento'],
      mineria_negro: ['huelga', 'grietas', 'mina'],
      generic: ['cartel', 'documento', 'columpio'],
    },

    bankrupt: {
      title: '¡Felicidades!',
      message: 'Rompiste los ahorros de la cirugía de tu hermano Timmy.',
      extra: ['Timmy lo entenderá. Probablemente.', 'Recuperas {coins}.'],
      extension: 'Con eso convences al cobrador: 2 días más.',
      hint: '¡Rómpelo!',
    },
    // Vida extra: antes de perder del todo
    piggyLife: { title: 'Queda una salida...', lines: ['El cerdito de Timmy. Sus ahorros para la operación.', 'Está durmiendo. No hagas ruido.'] },
    embargoPiggy: 'Pero aún te queda el cerdito de Timmy...',
    // Sin cerdito: se vuelve al inicio de la meta
    finalLoss: {
      title: 'Se acabó',
      message: 'Ya no queda cerdito que romper.',
      back: 'FUTURO.exe te devuelve al inicio de {where}, con {money}.',
    },
    rewindGreeting: ['Vaya. Otra vez sin nada.', 'Te devuelvo al principio de este tramo. Con lo que tenías entonces.', 'Y tu hermano ha vuelto a llenar el cerdito. Qué niño tan ahorrador.'],
    // Noticias de la ciudad: rellenan el periódico (nunca sale vacío) y cada día nuevo trae una.
    // minDark: solo salen cuando la ciudad ya está así de oscura.
    fillerNews: [
      { title: 'LA PLEYZETA 6 ULTRA, AGOTADA EN TODA LA CIUDAD', text: 'Los que la tienen dicen que calienta la casa. Literalmente.', tone: 'neu', art: 'rebajas' },
      { title: 'UN VECINO JURA QUE SU APP DE INVERSIÓN LE HABLA', text: 'Dice que le llama por su nombre. Nadie le cree.', tone: 'neu', art: 'redes' },
      { title: 'SE DISPARAN LAS COMPRAS A PLAZOS ENTRE LOS JÓVENES', text: 'Los expertos piden calma. Los bancos, más plazos.', tone: 'neg', art: 'compras' },
      { title: 'EL AYUNTAMIENTO PROMETE ARREGLAR LAS FAROLAS', text: 'Es la cuarta vez este año.', tone: 'neu', art: 'farolas' },
      { title: 'HOMBRE SUDA FRENTE A DOS BOTONES: SUBIRÁ Y BAJARÁ', text: 'Lleva así desde el martes. No se decide.', tone: 'neu', art: 'botones' },
      { title: 'PERRO EN UNA HABITACIÓN EN LLAMAS: "TODO ESTÁ BIEN"', text: 'Los bomberos no están de acuerdo.', tone: 'neg', art: 'perrollamas' },
      { title: 'LOS DIBUJOS AMARILLOS YA LO HABÍAN PREDICHO', text: 'Lo dicen en redes de todo lo que pasa. Siempre.', tone: 'neu', art: 'redes' },
      { title: 'NOVIO DISTRAÍDO MIRA OTRA GRÁFICA', text: 'La suya acaba de caer un 30%. Su novia no dice nada.', tone: 'neg', art: 'stonks' },
      { title: 'FILÓSOFO RESUME SU TESIS EN DOS PALABRAS: "NÚMERO SUBE"', text: 'Le dan el doctorado. Con honores.', tone: 'pos', art: 'stonks' },
      { title: 'UN TRADER LLORA FRENTE A SEIS PANTALLAS ROJAS', text: 'Dice que es alergia. A las velas.', tone: 'neg', art: 'alerta' },
      { title: 'EL "NIÑO DEL ÉXITO", 20 AÑOS DESPUÉS: DEBE UNA PLEYZETA', text: 'Sigue con el puño cerrado. Ahora de rabia.', tone: 'neg', art: 'compras' },
      { title: 'UN ENLACE PROMETE DINERO FÁCIL: ES UN SEÑOR BAILANDO EN LOS 80', text: 'Millones de personas pican cada día. Ninguna se arrepiente.', tone: 'neu', art: 'movil' },
      { title: 'UN GATO CON CARA DE ENFADO, NUEVO DIRECTOR FINANCIERO', text: 'Su primera medida: tirar el presupuesto de la mesa.', tone: 'neu', art: 'documento' },
      { title: 'ESTUDIO: "COMPRAR EN LA BAJADA" ES LO QUE DICES CUANDO YA HAS PERDIDO', text: 'El 100% de los encuestados lo dijo mientras perdía.', tone: 'neg', art: 'dinero' },
      { title: 'ANUNCIAN LA PLEYZETA 7: IGUAL QUE LA 6, PERO CON UN 7', text: 'Ya hay cola. Nadie sabe qué hace el 7.', tone: 'neu', art: 'rebajas' },
      { title: 'BAILARINES CON UN ATAÚD ACTUARÁN ESTA NOCHE EN LA BOLSA', text: 'Dicen que alguien no ha pagado.', tone: 'neg', art: 'ataud', minDark: 3 },
      { title: 'LA CIUDAD AMANECE CON MENOS VECINOS QUE AYER', text: 'Nadie recuerda quiénes faltan.', tone: 'neg', art: 'ciudad', minDark: 5 },
    ],
    embargo: ['PLAZO VENCIDO', 'El cobrador se lo lleva todo', 'Capital embargado'],
    embargoEarly: ['YA NO LLEGAS', 'Ni con suerte juntas {amount} a tiempo', 'El cobrador se adelanta'],
    broke: ['SIN FONDOS', 'No te alcanza ni para la apuesta mínima'],
    teaser: 'ACTIVOS HUMANOS: LIQUIDACIÓN EN CURSO',
    endDemo: ['FIN DE LA VERSIÓN 1.5', 'La historia continuará.', 'Puedes seguir operando... si te atreves.'],
  };
})(window.SN);
