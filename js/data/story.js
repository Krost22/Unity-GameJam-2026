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
      // buy: enseña Mejoras y Tienda. acts: qué se abre y qué se resalta en cada frase
      { id: 'compras', buy: true,
        acts: [{ spot: '#nav' }, { spot: '#nav-shop' }, { open: 'shop', spot: '.win' }, { open: 'shop', spot: '.win' }],
        lines: ['Todo se compra en la TIENDA (tecla T): mejoras, objetos y caprichos.', 'Cuando haya algo que puedas comprar, saldrá un número rojo. Como ese.', '¿Las mejoras? Bloqueadas. Ya te iré haciendo... regalos. Y se pagan a crédito: hoy nada, después con intereses.', 'A veces, hasta ofertas que no podrás rechazar.'] },
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
    // Bono por usar la app: el encapuchado, al saldar cada deuda. {bonus}
    payBonus: [
      'Pagas lo que debes. Eso me gusta. Toma {bonus}: un bono por usar la app.',
      'Deuda saldada. FUTURO.exe premia a los buenos clientes: {bonus} para que sigas jugando.',
      'Mira qué responsable. {bonus} de bono. No te lo gastes todo... o sí.',
    ],
    // La oferta de FUTURO.exe al comprar un objeto clave. {item} {now} {debt} {days}
    offer: {
      title: '¡ESPERA!',
      line: 'FUTURO.exe te consigue {item} sin pagar nada hoy.',
      free: '$0 HOY',
      save: '−100%',
      later: 'Hoy no pagas nada. Todo, después.',
      small: 'Letra pequeña',
      smallText: 'Todo, con intereses: {debt} en {days} días. FUTURO.exe no se hace responsable de lo que pase después.',
      yes: '¡Lo quiero!',
      insist: 'FUTURO.exe insiste',
    },
    // Nombres de cada deuda (lo que se ve en el HUD y en las notas)
    debtNames: { pleyzeta: 'la Pleyzeta', gift: 'el regalo', item: '{item}' },

    // Noticias extrañas: empiezan como economía normal y poco a poco coinciden con tus ganancias
    darkNews: {
      salud: ['Un hospital del barrio norte se queda sin dinero.', 'Un científico de vacunas desaparece sin dejar rastro.', 'La clínica de la calle 4 cierra "por falta de futuro".', 'Pacientes del hospital olvidan por qué fueron.'],
      tecno: ['Un barrio entero comienza a quedarse sin electricidad.', 'Una programadora olvida cómo se escribe su propio nombre.', 'Las farolas del centro se apagan una a una.', 'Nadie recuerda quién inventó el semáforo.'],
      negocios: ['Una pequeña tienda cierra tras 40 años abierta.', 'La panadería de Doña Rosa baja la persiana. Nadie sabe por qué.', 'El taller de bicis amanece vacío. Sin herramientas. Sin dueño.', 'Los vecinos olvidan el nombre de su calle.'],
      mineria: ['Unos mineros dicen que han perdido años de recuerdos.', 'Un pueblo minero aparece deshabitado de la noche a la mañana.', 'Los túneles bajo la ciudad crecen solos.', 'Un niño dibuja un hombre encapuchado. Todos los niños lo dibujan.'],
      // Mercados negros: sus ganancias se cobran antes y más caro
      salud_negro: ['Un hombre despierta en un banco del parque sin recordar la semana.', 'La farmacia del garaje vende pastillas para olvidar. Se agotan.', 'Los pacientes de la clínica sin nombre no vuelven a casa.'],
      tecno_negro: ['Un barrio entero pierde sus fotos de la infancia. Los móviles, intactos.', 'Las contraseñas de la ciudad aparecen escritas en una pared.', 'Una niña recibe un mensaje de su abuela. Su abuela no sabe escribir.'],
      negocios_negro: ['El cobrador visita tiendas que ya habían cerrado.', 'Una tienda abre de madrugada. Vende recuerdos de segunda mano.', 'Los vecinos pagan deudas que no recuerdan haber pedido.'],
      mineria_negro: ['Los mineros vuelven del túnel 7 con los ojos grises.', 'Del alcantarillado sube un ruido de monedas.', 'La plaza amanece hundida. Debajo, un túnel sin fondo.'],
      generic: ['La gente olvida lo que pasó la semana pasada.', 'El ayuntamiento no encuentra a la mitad de los vecinos.', 'Un parque infantil amanece sin columpios y sin niños.'],
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
      title: '¡Felicidades! Rompiste los ahorros para la cirugía del pequeño Timmy',
      message: 'El cirujano no aceptará velas japonesas como forma de pago.',
      extra: ['Timmy lo entenderá. Probablemente.', 'Recuperas {coins}.'],
      extension: 'Con eso convences al cobrador: 2 días más.',
      hint: '¡Rompe los ahorros!',
    },
    // Vida extra: antes de perder del todo
    piggyLife: { title: 'Queda una salida...', lines: ['Los ahorros de Timmy. El dinero de su cirugía.', 'Está durmiendo. No hagas ruido.'] },
    embargoPiggy: 'Pero aún te quedan los ahorros de Timmy...',
    // Sin ahorros que romper: se vuelve al inicio del paso
    finalLoss: {
      title: 'Se acabó',
      message: 'Ya no quedan ahorros que romper.',
      back: 'FUTURO.exe te devuelve al inicio de {where}, con {money}.',
    },
    rewindGreeting: ['Vaya. Otra vez sin nada.', 'Te devuelvo al principio de este tramo. Con lo que tenías entonces.', 'Y tu hermano ha vuelto a juntar sus ahorros. Qué niño tan ahorrador.'],
    // Noticias de la ciudad: rellenan el periódico (nunca sale vacío) y cada día nuevo trae una.
    // minDark: solo salen cuando la ciudad ya está así de oscura.
    // (1.6: palabras sencillas; more = lo que se lee en primera plana al hacer clic)
    fillerNews: [
      { title: 'LA PLEYZETA 6 ULTRA, AGOTADA EN TODA LA CIUDAD', text: 'Los que la tienen dicen que calienta la casa. De verdad.', more: 'Ya hay quien cocina huevos encima. Y quien se ha quedado sin cejas.', tone: 'neu', art: 'rebajas' },
      { title: 'UN VECINO JURA QUE SU APP DE BOLSA LE HABLA', text: 'Dice que le llama por su nombre. Nadie le cree.', more: 'Dice que le susurra "una más" por las noches. Su familia está preocupada.', tone: 'neu', art: 'redes' },
      { title: 'LOS JÓVENES COMPRAN TODO A PLAZOS', text: 'Los bancos, encantados. Los padres, no tanto.', more: 'Una consola, en 48 meses. Unas zapatillas, en 12. Un bocadillo, en 3.', tone: 'neg', art: 'compras' },
      { title: 'EL AYUNTAMIENTO PROMETE ARREGLAR LAS FAROLAS', text: 'Es la cuarta vez este año.', more: 'Las farolas no se dan por aludidas. Siguen apagadas.', tone: 'neu', art: 'farolas' },
      { title: 'UN HOMBRE SUDA DELANTE DE DOS BOTONES: SUBIRÁ Y BAJARÁ', text: 'Lleva así desde el martes. No se decide.', more: 'Su gato ha pulsado uno por él. No se sabe cuál.', tone: 'neu', art: 'botones' },
      { title: 'UN PERRO EN UNA HABITACIÓN EN LLAMAS: "TODO ESTÁ BIEN"', text: 'Los bomberos no están de acuerdo.', more: 'El perro sigue tomándose su café. Muy tranquilo. Demasiado.', tone: 'neg', art: 'perrollamas' },
      { title: 'LOS DIBUJOS AMARILLOS YA LO HABÍAN ADIVINADO', text: 'Lo dicen en redes de todo lo que pasa. Siempre.', more: 'Hay un capítulo para cada cosa. Hasta para esta noticia.', tone: 'neu', art: 'stonks' },
      { title: 'UN SABIO RESUME LA ECONOMÍA EN DOS PALABRAS: "NÚMERO SUBE"', text: 'Le dan un premio. Y un diploma.', more: 'Su segundo libro se llamará "Número baja". Ya lo ha vendido entero.', tone: 'pos', art: 'dinero' },
      { title: 'UN CHICO LLORA DELANTE DE SEIS PANTALLAS EN ROJO', text: 'Dice que es alergia. A las velas.', more: 'Su madre le ha traído pañuelos. Y un currículum.', tone: 'neg', art: 'alerta' },
      { title: 'UN ENLACE PROMETE DINERO FÁCIL: ES UN SEÑOR BAILANDO EN LOS 80', text: 'Millones de personas pican cada día. Ninguna se arrepiente.', more: 'El señor no piensa dejar de bailar. Nunca. Jamás.', tone: 'neu', art: 'movil' },
      { title: 'UN GATO CON CARA DE ENFADO, NUEVO JEFE DE LAS CUENTAS', text: 'Su primera medida: tirar los papeles de la mesa.', more: 'La segunda: dormir encima del teclado. La empresa va mejor que nunca.', tone: 'neu', art: 'documento' },
      { title: '"COMPRAR EN LA BAJADA" ES LO QUE DICES CUANDO YA HAS PERDIDO', text: 'Lo dice todo el mundo... mientras pierde dinero.', more: 'Y luego llega otra bajada. Y otra. Y otra.', tone: 'neg', art: 'sello' },
      { title: 'ANUNCIAN LA PLEYZETA 7: IGUAL QUE LA 6, PERO CON UN 7', text: 'Ya hay cola. Nadie sabe qué hace el 7.', more: 'Costará el doble. Será igual. La gente ya hace cola desde ayer.', tone: 'neu', art: 'cartel' },
      { title: 'TROMPA Y PATÍN JUEGAN AL AJEDREZ POR VIDEOLLAMADA', text: 'Llevan tres días. Nadie ha movido ninguna pieza.', more: 'Trompa dice que va ganando. Patín no dice nada. Patín nunca dice nada.', tone: 'neu', art: 'ajedrez' },
      { title: 'BAILARINES CON UN ATAÚD ACTUARÁN ESTA NOCHE EN LA BOLSA', text: 'Dicen que alguien no ha pagado.', more: 'Nadie sabe quién es. Pero los bailarines ya saben su dirección.', tone: 'neg', art: 'ataud', minDark: 3 },
      { title: 'LA CIUDAD AMANECE CON MENOS VECINOS QUE AYER', text: 'Nadie recuerda quiénes faltan.', more: 'Las casas siguen ahí. Las luces, encendidas. Pero no hay nadie.', tone: 'neg', art: 'ciudad', minDark: 5 },
    ],
    // Lo que dice el protagonista en voz alta (globos encima del teclado, js/ui/hero-say.js)
    heroSays: {
      debtPaid: ['¡PAGADO! Uf...', 'Una deuda menos. Quedan... todas las demás.', '¡Libre! Durante cinco minutos.', 'Pagado. Y ahora, ¿qué me cae?'],
      gift: ['¿Un regalo? ¿Y por qué me suena a trampa?', 'Otra deuda. Genial. GENIAL.', 'Los regalos no se pagan... ¿no?'],
      offer: ['¿Tan barato? ¿Dónde está la trampa?', 'No lo necesito. Bueno... un poco sí.', 'La letra pequeña es MUY pequeña.'],
      black: ['¿Un mercado... negro? Esto no puede ser legal.', 'Paga más. Eso es lo importante. ¿No?', 'Nadie tiene por qué enterarse.'],
      newMarket: ['¡Un mercado nuevo! Más dinero.', 'Más mercados, más oportunidades. Y más deudas.'],
      bigWin: ['¡¡SÍ!! ¡SOY UN GENIO!', '¡Toma ya! ¡Toma, toma!', '¡Lo sabía! Bueno, casi.', '¡Así se gana dinero!', '¡A la luna!'],
      bigLoss: ['No, no, no, NO.', '¿Por qué siempre la última vela?', 'Vale. Respira. Solo es dinero.', 'Mi dinero...', 'Eso no ha pasado. No ha pasado.'],
      loss: ['Bah. La próxima.', 'Ha sido mala suerte.', 'Lo recupero en la siguiente.'],
      cap: ['¿Tope? ¿Cómo que tope?', 'El mercado no da más de sí. Necesito uno más grande.'],
      lucky: ['¡Un día con 7! Hoy me siento con suerte.', 'Hoy es mi día de suerte. Lo noto en los dedos.'],
      cipher: ['¿Qué es este símbolo...?', 'Otra letra. Esto dice algo.', 'Lo estoy entendiendo...', 'Alguien quiere que lo lea.'],
      kevo: ['Kevo me escribe.', 'Kevo otra vez...', '¿Qué querrá Kevo ahora?'],
      bravo: ['¿Quién es este tío?', 'Tres Lambos... alquilados.', 'Mentalidad de tiburón, dice.'],
      academy: ['Ya está. Ahora soy un emprendedor.', 'Bravo dice que esto se paga solo. Ojalá.'],
      income: ['La limonada da dinero. ¿Quién lo diría?', 'Dinero mientras duermo. Bueno, yo no duermo.'],
      shopNew: ['Me llega para algo... Tentador.', 'Podría permitírmelo...', 'Un caprichito. Me lo merezco.'],
      timmy: ['Lo siento, Timmy. Te lo devolveré. Te lo juro.', 'Timmy no puede enterarse.'],
      night: ['Debería dormir. Una más y lo dejo.', 'Otra noche sin dormir...', 'Las velas no duermen. Yo tampoco.'],
      lastDay: ['Último día. No llego. No llego...', 'Hoy o nunca.'],
    },
    embargo: ['PLAZO VENCIDO', 'El cobrador se lo lleva todo', 'Capital embargado'],
    embargoEarly: ['YA NO LLEGAS', 'Ni con suerte juntas {amount} a tiempo', 'El cobrador se adelanta'],
    broke: ['SIN FONDOS', 'No te alcanza ni para la apuesta mínima'],
    teaser: 'ACTIVOS HUMANOS: LIQUIDACIÓN EN CURSO',
    endDemo: ['FIN DE LA VERSIÓN 1.6', 'La historia continuará.', 'Puedes seguir operando... si te atreves.'],
  };
})(window.SN);
