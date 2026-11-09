// Eventos de mercado. Cada evento altera el precio de forma cuantificable:
//  shock  -> salto de precio en las próximas velas (rango estimado: min..max)
//  trend  -> empuja la tendencia durante N velas
//  vol    -> multiplica la volatilidad durante N velas (evento neutral)
//  rumor  -> se resuelve en 1-3 velas: con probabilidad `prob` ocurre `yes`, si no ocurre `no`
// tone: pos | neg | neu (color e icono en la interfaz)
// art: nombre de la foto de periódico (js/render/news-art.js)
// window: lo que se ve por la ventana de la habitación cuando sale la noticia (SN.Desk.windowEvent)
(function (SN) {
  'use strict';

  SN.Data.marketEvents = {
    salud: [
      { id: 'vacuna', kind: 'rumor', tone: 'pos', art: 'vacuna', title: 'Vacuna en fase final', text: 'Las autoridades deciden si aprueban la nueva vacuna.', prob: 0.65, yes: 0.11, no: -0.07, yesText: 'Vacuna aprobada', noText: 'Vacuna rechazada' },
      { id: 'medicamento', kind: 'shock', tone: 'pos', art: 'pastillas', title: 'Descubren un medicamento', text: 'Un laboratorio local anuncia un fármaco prometedor.', min: 0.04, max: 0.1 },
      { id: 'demanda', kind: 'trend', tone: 'pos', art: 'hospital', title: 'Hospitales a tope', text: 'Los hospitales están a tope. Las acciones, también.', trend: 0.75, candles: 16 },
      { id: 'investigacion', kind: 'trend', tone: 'neg', art: 'microscopio', title: 'Fallan los ensayos', text: 'Retrasos y resultados confusos en los ensayos.', trend: -0.75, candles: 14 },
      { id: 'demandacol', kind: 'shock', tone: 'neg', art: 'juzgado', title: 'Demanda colectiva', text: 'Pacientes demandan a una farmacéutica por efectos secundarios.', min: -0.1, max: -0.04 },
      { id: 'auditoria', kind: 'vol', tone: 'neu', art: 'lupa', title: 'Auditoría del sector', text: 'Inspectores revisan las cuentas. Nadie sabe qué encontrarán.', vol: 1.9, candles: 12 },
      { id: 'patente', kind: 'rumor', tone: 'neg', art: 'documento', title: 'Patente en disputa', text: 'Un juez decide sobre la patente estrella del sector.', prob: 0.55, yes: -0.1, no: 0.05, yesText: 'Patente anulada', noText: 'Patente confirmada' },
      { id: 'ambulancias', kind: 'trend', tone: 'pos', art: 'hospital', title: 'Noche de ambulancias', text: 'Las sirenas no paran. Una pasa ahora mismo bajo tu ventana.', trend: 0.7, candles: 12, window: 'ambulancia' },
      { id: 'brote', kind: 'rumor', tone: 'pos', art: 'alerta', title: '¿Un brote en la ciudad?', text: 'Dicen que hay un virus nuevo. Nadie lo ha visto.', prob: 0.5, yes: 0.1, no: -0.06, yesText: 'Brote confirmado', noText: 'Era un resfriado', window: 'ambulancia' },
      { id: 'cesped', kind: 'trend', tone: 'pos', art: 'hospital', title: 'Los médicos recetan "tocar césped"', text: 'Funciona. Las farmacias ya venden césped en sobres.', trend: 0.7, candles: 14 },
      { id: 'sopa', kind: 'shock', tone: 'pos', art: 'pastillas', title: 'La sopa de pollo, medicamento del año', text: 'Las abuelas ya lo sabían. Ahora cotiza en bolsa.', min: 0.03, max: 0.08 },
      { id: 'todobien', kind: 'shock', tone: 'neg', art: 'perrollamas', title: '"Todo está bien", dice el director del hospital', text: 'Lo dice tomándose un café. Detrás de él, todo arde.', min: -0.11, max: -0.05 },
      { id: 'aguafuturo', kind: 'rumor', tone: 'neg', art: 'redes', title: 'Un influencer vende "agua del futuro"', text: '¿Le multarán o le copiarán todos?', prob: 0.5, yes: -0.08, no: 0.06, yesText: 'Multa al influencer', noText: 'Todos venden agua' },
    ],
    tecno: [
      { id: 'lanzamiento', kind: 'shock', tone: 'pos', art: 'movil', title: 'Nuevo móvil milagroso', text: 'Presentan un móvil que se carga con tu aliento.', min: 0.05, max: 0.13 },
      { id: 'ia', kind: 'trend', tone: 'pos', art: 'robot', title: 'Avance en IA', text: 'Una IA aprueba un examen de conducir. Sin coche.', trend: 0.8, candles: 18 },
      { id: 'filtracion', kind: 'rumor', tone: 'neg', art: 'candado', title: 'Posible filtración', text: 'Se rumorea que han filtrado datos de millones de usuarios.', prob: 0.6, yes: -0.12, no: 0.04, yesText: 'Filtración confirmada', noText: 'Falsa alarma' },
      { id: 'seguridad', kind: 'shock', tone: 'neg', art: 'alerta', title: 'Fallo de seguridad', text: 'Una actualización deja a medio país sin contraseña.', min: -0.13, max: -0.05 },
      { id: 'hype', kind: 'vol', tone: 'neu', art: 'redes', title: 'Euforia en redes', text: 'Todo el mundo opina. Nadie sabe nada.', vol: 2.2, candles: 10 },
      { id: 'chips', kind: 'trend', tone: 'neg', art: 'chip', title: 'Escasez de chips', text: 'No hay chips ni para las tostadoras.', trend: -0.75, candles: 15 },
      { id: 'apagonev', kind: 'shock', tone: 'neg', art: 'apagon', title: 'Apagón en media ciudad', text: 'Mira por la ventana: no queda una luz encendida.', min: -0.12, max: -0.05, window: 'apagon' },
      { id: 'drones', kind: 'trend', tone: 'pos', art: 'robot', title: 'Llegan los drones de reparto', text: 'Repartos por el aire. Uno pasa ahora por delante de tu ventana.', trend: 0.75, candles: 14, window: 'dron' },
      { id: 'stonks', kind: 'vol', tone: 'neu', art: 'stonks', title: 'STONKS', text: 'Un señor trajeado explica la economía con una flecha que sube.', vol: 2.1, candles: 12 },
      { id: 'luna', kind: 'rumor', tone: 'pos', art: 'luna', title: '¡A la luna!', text: 'Una moneda con cara de perro sube un 7.000%. ¿Seguirá subiendo?', prob: 0.55, yes: 0.13, no: -0.1, yesText: 'Llega a la luna', noText: 'Se estrella' },
      { id: 'pulsaf', kind: 'shock', tone: 'neg', art: 'botones', title: 'Pulsa F para presentar tus respetos', text: 'Se cae la red social más usada. Millones de personas pulsan F.', min: -0.12, max: -0.05 },
      { id: 'seviene', kind: 'trend', tone: 'pos', art: 'robot', title: '"Se viene": la IA anuncia algo', text: 'Nadie sabe qué. Todos compran por si acaso.', trend: 0.7, candles: 14 },
    ],
    negocios: [
      { id: 'consumidores', kind: 'trend', tone: 'pos', art: 'compras', title: 'El barrio sale de compras', text: 'El barrio compra como si no hubiera mañana.', trend: 0.7, candles: 20 },
      { id: 'temporada', kind: 'rumor', tone: 'pos', art: 'rebajas', title: 'Temporada de compras', text: 'Se esperan grandes ventas este fin de semana.', prob: 0.7, yes: 0.09, no: -0.05, yesText: 'Ventas récord', noText: 'Temporada floja' },
      { id: 'suministro', kind: 'trend', tone: 'neg', art: 'camion', title: 'No llegan los camiones', text: 'Los camiones no llegan. Las estanterías, vacías.', trend: -0.8, candles: 16 },
      { id: 'embargos', kind: 'trend', tone: 'neg', art: 'documento', title: 'Ola de embargos', text: 'Los camiones de embargos recorren el barrio. Uno pasa por tu calle.', trend: -0.75, candles: 14, window: 'camion' },
      { id: 'quiebra', kind: 'shock', tone: 'neg', art: 'persiana', title: 'Quiebra un negocio', text: 'Cierra un comercio con 40 años de historia.', min: -0.1, max: -0.04 },
      { id: 'impuestos', kind: 'vol', tone: 'neu', art: 'impuestos', title: 'Reforma de impuestos', text: 'Nuevas reglas. Nadie las ha leído.', vol: 1.8, candles: 14 },
      { id: 'feria', kind: 'shock', tone: 'pos', art: 'feria', title: 'Feria del barrio', text: 'Churros, música, fuegos artificiales y cajas registradoras felices.', min: 0.03, max: 0.08, window: 'fuegos' },
      { id: 'simios', kind: 'trend', tone: 'pos', art: 'compras', title: 'Simios juntos, fuertes', text: 'Unos vecinos compran entre todos una tienda de videojuegos en ruina. Por diversión.', trend: 0.8, candles: 16 },
      { id: 'hamburguesa', kind: 'vol', tone: 'neu', art: 'dinero', title: '"Señor, esto es una hamburguesería"', text: 'Un cliente pide consejos de inversión con el menú infantil.', vol: 1.8, candles: 12 },
      { id: 'distraido', kind: 'shock', tone: 'neg', art: 'redes', title: 'Los clientes miran otra tienda', text: 'Como el novio distraído del meme. La tienda de siempre, ofendida.', min: -0.09, max: -0.04 },
    ],
    mineria: [
      { id: 'mina', kind: 'shock', tone: 'pos', art: 'mina', title: 'Nueva mina bajo la ciudad', text: 'Un yacimiento enorme. Justo bajo tus pies.', min: 0.06, max: 0.16 },
      { id: 'demanda', kind: 'trend', tone: 'pos', art: 'fabrica', title: 'Las fábricas piden más', text: 'Las fábricas piden más. Siempre más.', trend: 0.8, candles: 16 },
      { id: 'ambiental', kind: 'trend', tone: 'neg', art: 'rio', title: 'El río cambia de color', text: 'El río de al lado ya no es de ningún color conocido.', trend: -0.9, candles: 14 },
      { id: 'escasez', kind: 'rumor', tone: 'pos', art: 'vagoneta', title: '¿Se agota el mineral?', text: 'Dicen que el mineral se está agotando.', prob: 0.6, yes: 0.13, no: -0.08, yesText: 'Escasez confirmada', noText: 'Hay de sobra' },
      { id: 'derrumbe', kind: 'vol', tone: 'neu', art: 'grietas', title: 'Ruidos en los túneles', text: 'Algo cruje ahí abajo. Nadie quiere bajar a mirar.', vol: 2.4, candles: 10 },
      { id: 'huelga', kind: 'shock', tone: 'neg', art: 'huelga', title: 'Huelga minera', text: 'Los mineros se niegan a bajar. Dicen que algo les mira.', min: -0.14, max: -0.05 },
      { id: 'temblor', kind: 'vol', tone: 'neu', art: 'grietas', title: 'Tiembla la ciudad', text: 'Tiembla el suelo. Tu taza también.', vol: 2.3, candles: 10, window: 'temblor' },
      { id: 'lluviaacida', kind: 'trend', tone: 'neg', art: 'rio', title: 'Lluvia que huele a monedas', text: 'Llueve sobre la ciudad. Nadie sabe de dónde sale esta lluvia.', trend: -0.8, candles: 14, window: 'lluvia' },
      { id: 'diamante', kind: 'trend', tone: 'pos', art: 'mina', title: 'Mineros con manos de diamante', text: 'No sueltan el pico. Ni las acciones.', trend: 0.75, candles: 14 },
      { id: 'perrominero', kind: 'shock', tone: 'pos', art: 'luna', title: 'Encuentran una moneda con cara de perro', text: 'Bajo la mina. Los expertos: "mucho valor, muy guau".', min: 0.06, max: 0.14 },
      { id: 'seacabo', kind: 'vol', tone: 'neu', art: 'grietas', title: '"Se acabó." "Hemos vuelto."', text: 'El mercado cambia de opinión cuatro veces antes del desayuno.', vol: 2.2, candles: 10 },
    ],

    // ---------- Mercados negros: lo mismo, sin preguntas ----------
    salud_negro: [
      { id: 'sinetiqueta', kind: 'shock', tone: 'pos', art: 'pastillas', title: 'Pastillas sin etiqueta', text: 'Nadie sabe qué llevan. Todo el mundo las quiere.', min: 0.06, max: 0.14 },
      { id: 'garaje', kind: 'trend', tone: 'pos', art: 'hospital', title: 'Clínica en un garaje', text: 'Abre una clínica en un garaje. La cola llega a la esquina.', trend: 0.85, candles: 14 },
      { id: 'redada', kind: 'shock', tone: 'neg', art: 'juzgado', title: 'Redada en la trastienda', text: 'La policía entra en una farmacia que no existía.', min: -0.14, max: -0.06 },
      { id: 'recetas', kind: 'rumor', tone: 'pos', art: 'documento', title: 'Recetas de un médico que no existe', text: 'Las firma el doctor "Nadie". ¿Colarán?', prob: 0.6, yes: 0.13, no: -0.09, yesText: 'Colaron', noText: 'No colaron' },
      { id: 'segunda', kind: 'vol', tone: 'neu', art: 'vacuna', title: 'Vacunas de segunda mano', text: 'Usadas, pero como nuevas. Eso dice la etiqueta escrita a mano.', vol: 2.2, candles: 12 },
      { id: 'donantes', kind: 'trend', tone: 'neg', art: 'alerta', title: 'Faltan donantes', text: 'Nadie quiere donar nada. Dicen que se lo quitan igual.', trend: -0.85, candles: 12 },
    ],
    tecno_negro: [
      { id: 'datosvecino', kind: 'trend', tone: 'pos', art: 'candado', title: 'Datos de tu vecino, en oferta', text: 'Contraseñas, fotos y el PIN del portal. Dos por uno.', trend: 0.9, candles: 14 },
      { id: 'camionchips', kind: 'shock', tone: 'pos', art: 'chip', title: 'Chips caídos del camión', text: 'Se ha caído un camión entero. Qué mala suerte. Para el camión.', min: 0.07, max: 0.15 },
      { id: 'virus', kind: 'shock', tone: 'neg', art: 'alerta', title: 'Un virus se come los servidores', text: 'Se come los datos y deja una nota: "gracias".', min: -0.15, max: -0.07 },
      { id: 'iasin', kind: 'rumor', tone: 'pos', art: 'robot', title: 'IA sin licencia', text: 'Predice tu cumpleaños, tu sueldo y tu próxima deuda.', prob: 0.55, yes: 0.14, no: -0.1, yesText: 'La IA acierta', noText: 'La IA se equivoca' },
      { id: 'cortealmacen', kind: 'vol', tone: 'neu', art: 'apagon', title: 'Corte de luz en el almacén', text: 'Algo se ha quemado. Nadie llama a los bomberos.', vol: 2.4, candles: 10, window: 'apagon' },
    ],
    negocios_negro: [
      { id: 'prestamos', kind: 'trend', tone: 'pos', art: 'dinero', title: 'Préstamos del barrio', text: 'Sin papeles, sin bancos, sin preguntas. Con intereses.', trend: 0.8, candles: 18 },
      { id: 'nocturna', kind: 'shock', tone: 'pos', art: 'persiana', title: 'Tienda que solo abre de noche', text: 'Vende de todo. Nadie recuerda haberle vendido nada.', min: 0.05, max: 0.12 },
      { id: 'inspeccion', kind: 'rumor', tone: 'neg', art: 'impuestos', title: '¿Viene un inspector?', text: 'Dicen que viene un inspector. Las persianas bajan solas.', prob: 0.5, yes: -0.12, no: 0.07, yesText: 'Inspección sorpresa', noText: 'Falsa alarma' },
      { id: 'cobrador', kind: 'trend', tone: 'neg', art: 'camion', title: 'Vuelve el cobrador', text: 'Recorre las tiendas. Se lleva lo que le debes... y lo otro.', trend: -0.85, candles: 14, window: 'camion' },
      { id: 'denadie', kind: 'vol', tone: 'neu', art: 'rebajas', title: 'Rebajas de cosas que no son de nadie', text: 'Precios increíbles. Nadie pregunta de quién eran.', vol: 2, candles: 12 },
    ],
    mineria_negro: [
      { id: 'orosin', kind: 'shock', tone: 'pos', art: 'mina', title: 'Oro sin factura', text: 'Brilla igual. Pesa igual. No existe en ningún papel.', min: 0.08, max: 0.18 },
      { id: 'sinmapa', kind: 'trend', tone: 'pos', art: 'vagoneta', title: 'Una mina que no sale en los mapas', text: 'Se baja por una alcantarilla. Se sube con los bolsillos llenos.', trend: 0.9, candles: 14 },
      { id: 'sinrecuerdos', kind: 'trend', tone: 'neg', art: 'huelga', title: 'Mineros sin recuerdos', text: 'Vuelven del turno sin saber cómo se llaman. Pero vuelven ricos.', trend: -0.9, candles: 12 },
      { id: 'tunel7', kind: 'rumor', tone: 'neg', art: 'grietas', title: '¿Derrumbe en el túnel 7?', text: 'Nadie confirma nada. Nadie baja a mirar.', prob: 0.55, yes: -0.15, no: 0.08, yesText: 'Derrumbe confirmado', noText: 'Solo era un ruido' },
      { id: 'respira', kind: 'vol', tone: 'neu', art: 'grietas', title: 'Algo respira bajo la ciudad', text: 'El suelo sube y baja. Como si respirara.', vol: 2.6, candles: 10, window: 'temblor' },
    ],
  };
})(window.SN);
