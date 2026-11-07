// Eventos de mercado. Cada evento altera el precio de forma cuantificable:
//  shock  -> salto de precio en las próximas velas (rango estimado: min..max)
//  trend  -> empuja la tendencia durante N velas
//  vol    -> multiplica la volatilidad durante N velas (evento neutral)
//  rumor  -> se resuelve en 1-3 velas: con probabilidad `prob` ocurre `yes`, si no ocurre `no`
// tone: pos | neg | neu (color e icono en la interfaz)
// art: nombre de la foto de periódico (js/render/news-art.js)
(function (SN) {
  'use strict';

  SN.Data.marketEvents = {
    salud: [
      { id: 'vacuna', kind: 'rumor', tone: 'pos', art: 'vacuna', title: 'VACUNA EN FASE FINAL', text: 'Las autoridades deciden si aprueban la nueva vacuna.', prob: 0.65, yes: 0.11, no: -0.07, yesText: 'VACUNA APROBADA', noText: 'VACUNA RECHAZADA' },
      { id: 'medicamento', kind: 'shock', tone: 'pos', art: 'pastillas', title: 'DESCUBREN UN MEDICAMENTO', text: 'Un laboratorio local anuncia un fármaco prometedor.', min: 0.04, max: 0.1 },
      { id: 'demanda', kind: 'trend', tone: 'pos', art: 'hospital', title: 'HOSPITALES A TOPE', text: 'Los hospitales están a tope. Las acciones, también.', trend: 0.75, candles: 16 },
      { id: 'investigacion', kind: 'trend', tone: 'neg', art: 'microscopio', title: 'FALLAN LOS ENSAYOS', text: 'Retrasos y resultados confusos en los ensayos.', trend: -0.75, candles: 14 },
      { id: 'demandacol', kind: 'shock', tone: 'neg', art: 'juzgado', title: 'DEMANDA COLECTIVA', text: 'Pacientes demandan a una farmacéutica por efectos secundarios.', min: -0.1, max: -0.04 },
      { id: 'auditoria', kind: 'vol', tone: 'neu', art: 'lupa', title: 'AUDITORÍA DEL SECTOR', text: 'Inspectores revisan las cuentas. Nadie sabe qué encontrarán.', vol: 1.9, candles: 12 },
      { id: 'patente', kind: 'rumor', tone: 'neg', art: 'documento', title: 'PATENTE EN DISPUTA', text: 'Un juez decide sobre la patente estrella del sector.', prob: 0.55, yes: -0.1, no: 0.05, yesText: 'PATENTE ANULADA', noText: 'PATENTE CONFIRMADA' },
    ],
    tecno: [
      { id: 'lanzamiento', kind: 'shock', tone: 'pos', art: 'movil', title: 'NUEVO MÓVIL MILAGROSO', text: 'Presentan un móvil que se carga con tu aliento.', min: 0.05, max: 0.13 },
      { id: 'ia', kind: 'trend', tone: 'pos', art: 'robot', title: 'AVANCE EN IA', text: 'Una IA aprueba un examen de conducir. Sin coche.', trend: 0.8, candles: 18 },
      { id: 'filtracion', kind: 'rumor', tone: 'neg', art: 'candado', title: 'POSIBLE FILTRACIÓN', text: 'Se rumorea que han filtrado datos de millones de usuarios.', prob: 0.6, yes: -0.12, no: 0.04, yesText: 'FILTRACIÓN CONFIRMADA', noText: 'FALSA ALARMA' },
      { id: 'seguridad', kind: 'shock', tone: 'neg', art: 'alerta', title: 'FALLO DE SEGURIDAD', text: 'Una actualización deja a medio país sin contraseña.', min: -0.13, max: -0.05 },
      { id: 'hype', kind: 'vol', tone: 'neu', art: 'redes', title: 'EUFORIA EN REDES', text: 'Todo el mundo opina. Nadie sabe nada.', vol: 2.2, candles: 10 },
      { id: 'chips', kind: 'trend', tone: 'neg', art: 'chip', title: 'ESCASEZ DE CHIPS', text: 'No hay chips ni para las tostadoras.', trend: -0.75, candles: 15 },
    ],
    negocios: [
      { id: 'consumidores', kind: 'trend', tone: 'pos', art: 'compras', title: 'EL BARRIO SALE DE COMPRAS', text: 'El barrio compra como si no hubiera mañana.', trend: 0.7, candles: 20 },
      { id: 'temporada', kind: 'rumor', tone: 'pos', art: 'rebajas', title: 'TEMPORADA DE COMPRAS', text: 'Se esperan grandes ventas este fin de semana.', prob: 0.7, yes: 0.09, no: -0.05, yesText: 'VENTAS RÉCORD', noText: 'TEMPORADA FLOJA' },
      { id: 'suministro', kind: 'trend', tone: 'neg', art: 'camion', title: 'NO LLEGAN LOS CAMIONES', text: 'Los camiones no llegan. Las estanterías, vacías.', trend: -0.8, candles: 16 },
      { id: 'quiebra', kind: 'shock', tone: 'neg', art: 'persiana', title: 'QUIEBRA UN NEGOCIO', text: 'Cierra un comercio con 40 años de historia.', min: -0.1, max: -0.04 },
      { id: 'impuestos', kind: 'vol', tone: 'neu', art: 'impuestos', title: 'REFORMA DE IMPUESTOS', text: 'Nuevas reglas. Nadie las ha leído.', vol: 1.8, candles: 14 },
      { id: 'feria', kind: 'shock', tone: 'pos', art: 'feria', title: 'FERIA DEL BARRIO', text: 'Churros, música y cajas registradoras felices.', min: 0.03, max: 0.08 },
    ],
    mineria: [
      { id: 'mina', kind: 'shock', tone: 'pos', art: 'mina', title: 'NUEVA MINA BAJO LA CIUDAD', text: 'Un yacimiento enorme. Justo bajo tus pies.', min: 0.06, max: 0.16 },
      { id: 'demanda', kind: 'trend', tone: 'pos', art: 'fabrica', title: 'LAS FÁBRICAS PIDEN MÁS', text: 'Las fábricas piden más. Siempre más.', trend: 0.8, candles: 16 },
      { id: 'ambiental', kind: 'trend', tone: 'neg', art: 'rio', title: 'EL RÍO CAMBIA DE COLOR', text: 'El río de al lado ya no es de ningún color conocido.', trend: -0.9, candles: 14 },
      { id: 'escasez', kind: 'rumor', tone: 'pos', art: 'vagoneta', title: '¿SE AGOTA EL MINERAL?', text: 'Dicen que el mineral se está agotando.', prob: 0.6, yes: 0.13, no: -0.08, yesText: 'ESCASEZ CONFIRMADA', noText: 'HAY DE SOBRA' },
      { id: 'derrumbe', kind: 'vol', tone: 'neu', art: 'grietas', title: 'RUIDOS EN LOS TÚNELES', text: 'Algo cruje ahí abajo. Nadie quiere bajar a mirar.', vol: 2.4, candles: 10 },
      { id: 'huelga', kind: 'shock', tone: 'neg', art: 'huelga', title: 'HUELGA MINERA', text: 'Los mineros se niegan a bajar. Dicen que algo les mira.', min: -0.14, max: -0.05 },
    ],
  };
})(window.SN);
