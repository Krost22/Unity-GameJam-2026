# SALDO NEGRO

Roguelite económico de trading con misterio narrativo, en pixel art arcade.
Un joven se endeuda por comprar una consola absurda y un encapuchado le regala **FUTURO.exe**,
una app de trading que promete dinero fácil... y que se cobra algo más valioso que el dinero.

## Jugar

Abre `index.html` con doble clic. Funciona sin internet, sin servidor y sin instalar nada (HTML, CSS y JS puros).
La partida se guarda sola en el navegador.

**Cómo se juega (en una frase):** mira la PISTA de la gráfica, pulsa **SUBIRÁ** o **BAJARÁ**, y **COBRA** antes de que
las últimas velas te den un susto. Junta $250 antes del día 7.

**Controles:** todo se puede hacer con el ratón (también los diálogos: clic en cualquier parte).
El teclado es un atajo y cada botón muestra su tecla:

| Tecla | Acción |
|---|---|
| `↑` / `B` | SUBIRÁ (ganas si el precio sube) |
| `↓` / `V` | BAJARÁ (ganas si el precio baja) |
| `Espacio` | COBRAR (durante una operación) · avanzar diálogos |
| `F` | acelerar las velas |
| `← →` | apuesta (en pasos de 5%) |
| `1-4` | multiplicador ×1 ×2 ×5 ×10 |
| `P` | ESPERAR (pasar el turno sin apostar) |
| `Tab` | cambiar de mercado |
| `M` `N` `T` | mejoras, noticias, tienda |
| `D` | minimizar FUTURO.exe y ver el escritorio |
| cualquier tecla | escribir en Mensajín (`Enter` envía) |
| `Esc` | menú / cerrar ventana |

## Reglas

- **La PISTA:** a la derecha de la última vela hay un cono que apunta hacia donde irá el precio. Se calcula con el
  estado real del mercado (tendencia, siguiente fase y noticias conocidas), con un pequeño error de lectura que la
  mejora ANÁLISIS reduce. Más flechas, más fiable: ▲ acierta ~70%, ▲▲ ~80%, ▲▲▲ ~93%. Con `?` es una moneda al aire.
- **SUBIRÁ / BAJARÁ:** ganas si el precio va hacia donde apostaste. APUESTA (25% / 50% / TODO o la barra) y MULTIPLICADOR
  deciden cuánto. La barrita de colores bajo el multiplicador es el riesgo de la apuesta de un vistazo.
- **COBRAR:** una operación dura unas 12 velas, pero puedes cobrar cuando quieras al precio que ves. Las velas que
  faltan se siguen mostrando en gris: lo que te ahorraste... o lo que te perdiste.
- **Zona de peligro:** las últimas velas (rayadas en naranja) pueden traer un **giro inesperado**. Cuando llega, el
  tiempo se frena, la cámara se acerca, late un corazón y la vela se arrastra antes del latigazo: aún puedes cobrar.
- **Cada apuesta o ESPERAR gasta un turno.** 3 turnos = 1 día. La deuda vence al final del día 7.
- **Perder:** si no te alcanza para la apuesta mínima ($10), si vence el plazo, o si ya es matemáticamente imposible
  pagar a tiempo, se pierde en ese momento (nada de pasar turnos esperando lo inevitable). Pero no se pierde todo:
  - **Vida extra: el cerdito de Tommy.** Te cuelas en el cuarto de tu hermano pequeño (mantén pulsado para avanzar y
    suelta cuando se mueva), coges su cerdito y lo rompes tú mismo en tu mesa. Su dinero es tuyo y la partida sigue
    (si era por el plazo, el cobrador te da 2 días más). Hay un cerdito por meta.
  - **Sin cerdito:** vuelves al inicio de la meta en la que ibas (la deuda, $1,000, $5,000, $25,000...) con el dinero,
    las mejoras y los mercados que tenías al empezarla. Si ibas por los $25,000, te quedas en los $25,000.

## Qué hay en la versión 1.4: el cerdito, Kevo y la ventana

| Cambio | Detalle |
|---|---|
| Resultado sin prisa | Al terminar cada apuesta sale una tarjeta grande con lo que ganaste o perdiste y lo que tienes ahora. Se queda 2.6 s (clic o tecla para seguir antes) |
| Perder no reinicia | Punto de control al empezar cada meta: al perder del todo vuelves ahí con los fondos que tenías, no al día 1 |
| El cerdito de Tommy | Ya no es un fin de partida: es una vida extra. Cinemática jugable a escondidas en el cuarto de Tommy (si te ve moverte, retrocedes) y después lo rompes a golpes en tu mesa |
| Kevo dura toda la partida | Sus conversaciones siguen tus hitos: pagar la deuda, cada meta, romper el cerdito, una gran pérdida o volver a un punto de control. Empieza eufórico, deja de dormir, olvida el nombre de su perro, el encapuchado le visita... y al final te escribe su madre desde su cuenta |
| Más noticias | 9 noticias nuevas (noche de ambulancias, apagón, drones de reparto, ola de embargos, temblor, lluvia que huele a monedas...) |
| La ventana | Lo que pasa en la ciudad se ve por la ventana y las persianas se suben solas para mirarlo: ambulancias, apagones, fuegos artificiales (también al ganar mucho o cumplir una meta), drones, el camión de embargos, lluvia, un cuervo en el alféizar, temblores... y, cuanto más oscura es la historia, el encapuchado en una azotea |

## Qué hay en la versión 1.3: el escritorio del PC

| Cambio | Detalle |
|---|---|
| Escritorio | FUTURO.exe se minimiza (botón `_` o `D`) y aparece el ordenador del protagonista: fondo de la Pleyzeta, iconos, barra de tareas con el día. Programas: Mensajín, Notas (la lista de tareas, que se tacha al pagar) y Papelera. FUTURO.exe no tiene botón de cerrar... |
| Mensajín | Parodia de la mensajería de los 2000. Kevo, tu amigo, también se endeudó por la Pleyzeta 6 y también recibió FUTURO.exe; su historia avanza día a día (con zumbidos). Para contestar se pulsa cualquier tecla (el clic no escribe, a propósito): el juego escribe por ti lo que dice el protagonista. Los mensajes seguidos van agrupados bajo un solo nombre. Cuando escribe estando en FUTURO.exe sale un aviso que lleva al chat |
| Dinero entero | Sin centavos ni decimales: dinero, ganancias, precios y la gráfica en números enteros |
| Números legibles | Fuente de números propia (SaldoNum): cifras gruesas de 2 px, todas del mismo ancho para que las cantidades no bailen, sin la negrita falsa que emborronaba el 0, el 6, el 8 y el 9 |
| Botones claros | SUBE / BAJA pasan a **SUBIRÁ / BAJARÁ** con una línea debajo ("ganas si sube"): es una predicción, no una orden |
| Manos | Rehechas: una sola silueta (no piezas sueltas, también los pulgares), dedos en abanico y de distinto largo, brazo en diagonal con la manga remangada. La derecha agarra el ratón (se ven los botones y la rueda) |

## Qué hay en la versión 1.2: estilo lo-fi neón

La perspectiva no cambia: primera persona, mirando al monitor, y del protagonista solo se ven las manos.
Cambia el acabado, inspirado en un cuarto lo-fi de noche: violetas, luz cálida de ventana y acentos de neón.

| Cambio | Detalle |
|---|---|
| Habitación a doble píxel | El escritorio se dibuja a 320x180 y se ve al doble: píxel grande y legible, como en las referencias. La interfaz de FUTURO.exe sigue a resolución completa para que se lea bien |
| Luz | Dos luces: cálida de la ventana (contraluz) y fría del monitor. Rampas de color que cambian de tono (sombras violeta, luces naranja) y contorno selectivo, más claro del lado de la luz |
| La luz del monitor juega | Tiñe la mesa y las manos de verde si la operación va bien y de rojo si va mal, y destella en cada cierre y en la cámara lenta |
| Escena viva | Persianas con la ciudad detrás (mañana, tarde, noche; se apaga con la historia), letrero de neón que parpadea, guirnalda de luces, motas de polvo, vapor de la taza y del ramen, calor sobre la caja de la consola, gato dormido que se despierta con los sustos y las grandes ganancias |
| Manos | Camisa blanca remangada. El ratón sigue al cursor, los dedos pulsan las teclas y tamborilean durante una operación, se cierran en la cámara lenta, celebran y dan un respingo |
| Interfaz | Tema oscuro neón: paneles azul noche con borde violeta, botones con bisel, iconos en Mejoras / Noticias / Tienda, gráfica oscura. El periódico sigue siendo de papel |
| Textos | La fuente pixel ya tiene minúsculas: interfaz y diálogos en mayúsculas y minúsculas (más fáciles de leer); los sellos y avisos grandes siguen en mayúsculas |
| Primeros planos | Las cinemáticas muestran la cara del protagonista con el nuevo estilo (pelo castaño despeinado, pecas, camisa y corbata floja) |
| Compras en la habitación | Taza con mando, planta que revive, farolillo de papel, póster, alfombrilla XXL con neón, teclado RGB animado, auriculares colgados del monitor y toro de oro sobre la consola |

## Qué hay en la versión 1.1

| Cambio | Detalle |
|---|---|
| Tutorial | Se aprende haciendo (8 frases cortas): la pista, SUBE, COBRAR y el susto de las últimas velas visto desde fuera. Clic en cualquier parte para avanzar; las indicaciones de acción no bloquean |
| Ratón y teclado | Todo se juega con ratón; las teclas se ven en cada botón, en el teclado de la mesa (teclas de color) y en AJUSTES |
| Menos texto | Un panel con dos botones grandes (SUBE / BAJA), apuesta y multiplicador. Sin plazos ni porcentajes que leer. Consejos de una sola vez, justo cuando hacen falta |
| Dificultad | Pista en la gráfica y fases de tendencia más claras. Siguiendo la pista con la apuesta por defecto se paga la deuda ~70% de las veces; al azar, ~5% |
| Noticias | Periódico "EL DIARIO DEL FUTURO" con portada y fotos de semitono en pixel art (36 escenas propias). Las noticias extrañas salen grises... con alguien al fondo |
| Cámara lenta | Giros en las últimas velas: tiempo frenado, zoom de cámara y de gráfica, viñeta, barras de cine, latidos, amago, latigazo, congelado, destello, grietas y ¡BOOM! / ¡CRASH! |
| Efectos de la gráfica | Cada vela suena más aguda cuanto mejor te va, golpecitos y chispas en velas fuertes, ganancias que saltan, fondo verde/rojo según el resultado |
| Fallos corregidos | El resaltado del tutorial se comía los clics; clic a mitad de frase cortaba el texto; el pósit quedaba detrás de la ventana; sin dinero había que pasar turnos hasta el final |

Los finales A/B y los mercados ilegales quedan para futuras fases (hay un adelanto al llegar a $25,000).
Las partidas guardadas de la versión 1.0 no se cargan (cambió el formato); el perfil (intro vista, ajustes) se conserva
y quien hizo el tutorial antiguo ve el nuevo una vez.

## Estructura

Cada sistema del documento es un archivo independiente; se comunican con un bus de eventos (`SN.Events`).

```
index.html            escenario 640x360 y la interfaz del monitor
css/style.css         estilos (paleta oficial en variables CSS)
css/font.css          fuente pixel propia, generada (no editar a mano)
js/core/              sn.js (utilidades, RNG con semilla), events.js, state.js, game.js (GameManager, bucle, tiempo y cámara)
js/data/              los "ScriptableObjects": mercados, eventos, simulación/mejoras/objetivos/tienda, historia,
                      chat.js (las conversaciones con Kevo)
js/systems/           economy, debt, time, market-sim (+ PISTA), trading (+ COBRAR y giros), drama (cámara lenta),
                      unlocks, upgrades, save, audio, tutorial, narrative, bankruptcy
js/render/            pixel.js, pixkit.js (kit de pixel art procedural), sprites.js, desk.js (habitación y ventana), hero.js (manos,
                      gato y primeros planos), hands.js, chart.js, fx.js, news-art.js, characters.js, cinematic.js,
                      sneak.js (el cuarto de Tommy)
js/ui/                ui.js (UIManager), dialog.js, windows.js (mejoras, periódico, tienda, ajustes),
                      desktop.js (escritorio del PC y Mensajín)
tools/                build-font.js y pruebas
```

| Documento (Unity) | Aquí |
|---|---|
| GameManager | `js/core/game.js` |
| EconomyManager · DebtManager | `js/systems/economy.js` · `debt.js` |
| MarketSimulator · TradingManager | `js/systems/market-sim.js` · `trading.js` |
| MarketUnlockManager · UpgradeManager | `js/systems/unlocks.js` · `upgrades.js` |
| TutorialManager · NarrativeManager · BankruptcyManager | `js/systems/tutorial.js` · `narrative.js` · `bankruptcy.js` |
| DeskInteractionController | `js/render/hands.js` |
| UIManager · SaveManager | `js/ui/ui.js` · `js/systems/save.js` |
| ScriptableObjects | `js/data/*.js` |

**Añadir un mercado:** una entrada en `js/data/markets.js` (volatilidad, deriva, fases, velas por operación y giros)
y su lista de eventos en `js/data/events.js` (cada evento con su foto `art`).
Apuesta mínima, velas de la zona de peligro, error de la pista y la operación del tutorial están en `js/data/simulation.js`.

**Arte:** todo el pixel art es propio y está dibujado por código (sin imágenes externas ni marcadores de posición).
`js/render/pixkit.js` convierte formas (polígonos, elipses, cápsulas) en pixel art con sombreado según la luz y
contorno selectivo; con él se dibujan las manos, el gato, la cara del protagonista (`js/render/hero.js`) y los objetos
de la habitación (`js/render/desk.js`). La paleta está en `js/core/sn.js` (y en las variables de `css/style.css`).
Los iconos son dibujos en texto en `js/render/sprites.js`; el encapuchado, el cerdito y la consola de la intro en
`js/render/characters.js`; las fotos del periódico en `js/render/news-art.js`.

**Fuente:** `node tools/build-font.js` regenera `css/font.css` a partir de los glifos dibujados en ese archivo: SaldoPixel
(texto) y SaldoNum (cifras en negrita de ancho fijo para el dinero; lo que no tiene lo pone SaldoPixel).

**Añadir una conversación de Mensajín:** una entrada en `js/data/chat.js` con el día y turno en que llega, lo que escribe
Kevo, la respuesta del protagonista y lo que Kevo contesta.

## Pruebas

```
node tools/test/logic.test.js       # fórmulas, COBRAR, giros, fiabilidad de la pista, plazo, fin de partida y equilibrio
node tools/test/e2e.test.js         # partida completa en Chrome sin ventana, con clics REALES de ratón y capturas
node tools/test/e2e-paths.test.js   # continuar (también tras cobrar), repetir tutorial, tienda, los 3 finales y pantallas pequeñas
node tools/test/e2e-desktop.test.js # minimizar, Mensajín (escribir con teclas; el clic no escribe), la historia de Kevo por hitos, Notas, Papelera
```

Abre `index.html?debug` para atajos de prueba: `F8` bancarrota, `F9` +$1,000, `F10` pasar un día.
