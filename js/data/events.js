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
    ],
    negocios: [
      { id: 'consumidores', kind: 'trend', tone: 'pos', art: 'compras', title: 'El barrio sale de compras', text: 'El barrio compra como si no hubiera mañana.', trend: 0.7, candles: 20 },
      { id: 'temporada', kind: 'rumor', tone: 'pos', art: 'rebajas', title: 'Temporada de compras', text: 'Se esperan grandes ventas este fin de semana.', prob: 0.7, yes: 0.09, no: -0.05, yesText: 'Ventas récord', noText: 'Temporada floja' },
      { id: 'suministro', kind: 'trend', tone: 'neg', art: 'camion', title: 'No llegan los camiones', text: 'Los camiones no llegan. Las estanterías, vacías.', trend: -0.8, candles: 16 },
      { id: 'embargos', kind: 'trend', tone: 'neg', art: 'documento', title: 'Ola de embargos', text: 'Los camiones de embargos recorren el barrio. Uno pasa por tu calle.', trend: -0.75, candles: 14, window: 'camion' },
      { id: 'quiebra', kind: 'shock', tone: 'neg', art: 'persiana', title: 'Quiebra un negocio', text: 'Cierra un comercio con 40 años de historia.', min: -0.1, max: -0.04 },
      { id: 'impuestos', kind: 'vol', tone: 'neu', art: 'impuestos', title: 'Reforma de impuestos', text: 'Nuevas reglas. Nadie las ha leído.', vol: 1.8, candles: 14 },
      { id: 'feria', kind: 'shock', tone: 'pos', art: 'feria', title: 'Feria del barrio', text: 'Churros, música, fuegos artificiales y cajas registradoras felices.', min: 0.03, max: 0.08, window: 'fuegos' },
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
    ],
  };
})(window.SN);
