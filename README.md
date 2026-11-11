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
| `1-4` | multiplicador ×1 ×2 ×5 ×10 (los que todavía no has comprado salen con candado) |
| `P` | ESPERAR (pasar el turno sin apostar) |
| `Tab` | cambiar de mercado (de la pestaña que se ve) |
| `X` | pestañas Legal / Negro (cuando tienes un mercado negro) |
| `M` `N` `T` | mejoras (y la Academia de Bravo Fines), noticias, tienda |
| `D` | minimizar FUTURO.exe y ver el escritorio |
| cualquier tecla | escribir en Mensajín (`Enter` envía) |
| `Esc` | menú / cerrar ventana |

## Reglas

- **La PISTA:** a la derecha de la última vela hay un cono que apunta hacia donde irá el precio. Se calcula con el
  estado real del mercado (tendencia, siguiente fase y noticias conocidas), con un pequeño error de lectura que la
  mejora ANÁLISIS reduce. Más flechas, más fiable: ▲ acierta ~70%, ▲▲ ~80%, ▲▲▲ ~93%. Con `?` es una moneda al aire.
- **SUBIRÁ / BAJARÁ:** ganas si el precio va hacia donde apostaste. APUESTA (25% / 50% / TODO o la barra) y MULTIPLICADOR
  deciden cuánto. La barrita de colores bajo el multiplicador es el riesgo de la apuesta de un vistazo.
- **Multiplicadores:** al empezar solo tienes el ×1. El ×2 ($20), el ×5 ($50) y el ×10 ($2,000) son los tres niveles
  de la mejora MULTIPLICADOR de la Tienda y se compran a crédito, como las demás mejoras (+40% a tu deuda). Pulsar un
  multiplicador con candado abre la Tienda justo ahí. El primer SUBIRÁ del tutorial usa un ×2 prestado.
- **COBRAR:** una operación dura unas 12 velas, pero puedes cobrar cuando quieras al precio que ves. Las velas que
  faltan se siguen mostrando en gris: lo que te ahorraste... o lo que te perdiste.
- **Zona de peligro:** las últimas velas (rayadas en naranja) pueden traer un **giro inesperado**. Cuando llega, el
  tiempo se frena, la cámara se acerca, late un corazón y la vela se arrastra antes del latigazo: aún puedes cobrar.
- **Topes:** cada mercado gana o pierde como mucho una cantidad por apuesta (Salud $300, Tecnología $1,500,
  Negocios $7,500, Minería $30,000). Al llegar al tope el marcador se pone dorado: para ganar más hay que subir de mercado.
- **Cada apuesta o ESPERAR gasta un turno.** 3 turnos = 1 día. La deuda vence al final de su último día (la primera, el día 7).
- **Una cadena de deudas:** la partida es una lista de pasos en orden y solo hay una deuda a la vez. Al pagar una,
  llega la siguiente al momento: siempre debes algo.
  1. **La Pleyzeta:** $250 en 7 días.
  2. **Los "regalos" del encapuchado:** te "regala" una mejora (que solo queda desbloqueada para comprarla) y, desde
     el segundo, un mercado nuevo: Tecnología, Negocios y Minería. Cada regalo trae una deuda con su plazo.
  3. **Los objetos clave** (Tele SAMSONG 98", Móvil iFON 17 Pro Max Plus, Moto YAMAJA, Reloj RÓLEZ): al pagar la
     deuda anterior, FUTURO.exe salta sola con una oferta que no se puede rechazar: hoy $0 y, en unos días, el 150%
     del precio (la letra pequeña). Aceptarla te endeuda... y el encapuchado te abre un **mercado negro**.
  4. **La meta final:** $300,000.
- **Números rojos:** Mejoras y Tienda enseñan un número rojo, como las noticias, cuando hay algo nuevo que ya puedes
  comprar, y sale un aviso. Abrir la ventana lo da por visto.
- **Bravo Fines y su Academia:** la mañana siguiente a pagar la Pleyzeta aparece un gurú del trading (gafas de sol,
  tres Lambos alquilados) que escribe por Mensajín y abre su **Academia** (pestaña de MEJORAS): un árbol de
  habilidades que se compra con dinero, en orden. Negocios que pagan cada mañana (limonada, chicles, lavandería),
  Mentalidad de tiburón (+5% en cada ganancia), Plan B (la primera pérdida del día, a la mitad) y Leer la letra
  pequeña (las ofertas traen un 10% menos de deuda). El resto de nodos sale como "Próximamente".
- **Palabras clave:** en los textos, el dinero sale en dorado, el 7 en arcoíris y la suerte en verde, y se mueven.
- **Mercado negro:** cada mercado tiene su versión negra (pestaña Negro, logo con calavera, FUTURO.exe se oscurece).
  Paga el doble que su versión normal (Salud negro: ±$600 por apuesta, frente a ±$300), pero menos que el siguiente
  mercado normal (Tecnología: ±$1,500).
  Ganar ahí casi siempre trae una noticia extraña.
- **Días de la suerte:** los días cuyo número lleva un 7 (7, 17, 27... del 70 al 79; el 77 vale doble). Los mercados
  crecen, cada ganancia trae un 7% extra por siete y sale algo especial: Lluvia de Oro, Mercado Dorado de Don Siete,
  Ruleta de la Fortuna (en la tienda), Estrella de la Suerte (un mercado vale ×1.77) o Bendición de la Fortuna.
- **Perder:** si no te alcanza para la apuesta mínima ($10), si vence el plazo, o si ya es matemáticamente imposible
  pagar a tiempo, se pierde en ese momento (nada de pasar turnos esperando lo inevitable). Pero no se pierde todo:
  - **Vida extra: los ahorros de Timmy.** Te cuelas en el cuarto de tu hermano pequeño (mantén pulsado para avanzar
    y suelta cuando se mueva), coges el cerdito con sus ahorros para la cirugía y lo rompes tú mismo en tu mesa. Su
    dinero es tuyo y la partida sigue (si era por el plazo, el cobrador te da 2 días más). Una vez por paso.
  - **Sin ahorros que romper:** vuelves al inicio del paso en el que ibas (una deuda, un regalo, una oferta) con el
    dinero, las mejoras y los mercados que tenías al empezarlo.

## El idioma secreto (no lo leas si quieres descubrirlo tú)

Algunas cosas están escritas con letras que parecen rusas: "erratas" del periódico (la primera la ves en el tutorial,
y el encapuchado dice que no es relevante) y los mensajes de **LOS PAGADOS**, alguien que te escribe por Mensajín y a
quien no se puede contestar. Es una sustitución de letras: cada símbolo escondido que encuentras (en el escritorio, en
la habitación, en las ventanas de la app...) se traduce para siempre, en todos los textos y en todas las partidas.
La app **Símbolos** aparece al encontrar el primero, con una pista vaga más cada día de la suerte.
Hasta el nombre del programa, **FUTURO**, está escrito así (la F tiene su propia pista).
El encapuchado sabe leerlo. No le gusta que lo leas.

## Qué hay en la versión 1.8: multiplicadores a la venta y deudas a la altura

Las deudas se quedaban pequeñas al lado de lo que se ganaba y la partida se pasaba volando. Se ha rehecho el
equilibrio con un simulador (jugadores de tres niveles sobre los sistemas reales del juego, 40 partidas de cada uno).

| Cambio | Detalle |
|---|---|
| Multiplicadores | Ya no vienen de regalo: al empezar solo hay ×1. ×2 $20, ×5 $50 y ×10 $2,000, a crédito, en la Tienda (mejora MULTIPLICADOR). Pagar la Pleyzeta ya no regala el ×10 |
| Mercado negro | Paga el doble que su versión normal (antes, 4 veces): $600, $3,000, $15,000 y $60,000 por apuesta |
| Deudas y plazos | Regalos: $300 (7 días), $1,200 (8), $10,000 (8) y $70,000 (9). Objetos: tele $450 (7 días), móvil $3,000 (8), moto $24,000 (9) y reloj $230,000 (9), y se debe el 150%. Meta final: $300,000 |

| Jugador simulado | Antes (1.7) | Ahora |
|---|---|---|
| Experto | 22 días (~14 min) | 40 días (~20 min) |
| Normal | 38 días, se atascaba en la tele | 55 días (~27 min), cada paso se paga a la primera al menos 7 de cada 10 veces |
| Prudente | 31 días | 48 días (~27 min) |

## Qué hay en la versión 1.6.1: Tienda y Academia nuevas

| Cambio | Detalle |
|---|---|
| Tienda | Ventana grande con tu dinero arriba, 6 categorías (Destacados, Mejoras, Objetos clave, Estilo de vida, Coleccionables, Mercados), banner con la oferta del objeto que toca, ofertas del día, tarjetas con iconos propios y panel de detalle. Las compras son las de siempre |
| Academia | Árbol de habilidades en grande: Bravo y tu dinero arriba, navegación por ramas, nodos unidos por líneas con su estado (comprado, disponible, bloqueado, próximamente), detalle del nodo y barra de progreso |
| Legibilidad | Mejoras con más aire, botón Volver visible en el periódico, papel sin rayas de monitor y Notas.txt que ya no se sale |
| Cerdito | El de la bancarrota es el mismo cerdito rosa del cuarto de Timmy, sin letras |

## Qué hay en la versión 1.6: deudas en cadena, Bravo Fines y noticias que se entienden

| Cambio | Detalle |
|---|---|
| Deudas en cadena | Sin metas de dinero entre medias: al pagar una deuda llega la siguiente. Los mercados legales llegan con los regalos |
| La oferta salta sola | Al pagar la deuda anterior, FUTURO.exe ofrece el siguiente objeto sin ir a la tienda; pide un 25% de la deuda en la cuenta |
| Números rojos y avisos | Mejoras y Tienda avisan, como las noticias, cuando hay algo nuevo que comprar |
| Tutorial | Un paso nuevo enseña Mejoras, la Tienda y el número rojo |
| Bravo Fines | Gurú del trading con retrato, chat en Mensajín y su Academia: árbol de habilidades con 6 nodos que ya funcionan y hueco para más |
| Inicio más difícil | Sin ANÁLISIS la pista falla más y Salud sube más despacio: la primera deuda se paga ~63% de las veces siguiendo la pista (antes ~78%). La Academia acelera después |
| Palabras clave | Dinero en dorado, 7 en arcoíris y suerte en verde, con movimiento (diálogos, noticias, chat, avisos, tienda) |
| FUTURO cifrado | El nombre del programa está en el idioma secreto; nueva letra (F → Ы) con su pista en "Acerca de" |
| El protagonista habla | Globos de texto encima del teclado cuando pasa algo: pagar, regalos, ofertas, grandes ganancias y pérdidas, días de la suerte... |
| El gato | Se estira, bosteza, se lava, se sienta a mirar el ratón, ronronea al ganar, se eriza al perder y vigila la ventana |
| Ahorros de Timmy | "¡Felicidades! Rompiste los ahorros para la cirugía del pequeño Timmy". El cirujano no acepta velas japonesas |
| Primera plana | Clic en cualquier noticia: foto grande a color, más información, a quién afecta y qué puede pasar |
| Noticias | Palabras sencillas en todas; una foto propia por noticia (45 escenas nuevas) con una pegatina del efecto; Donald Trompa y Vladímir Patín |

## Qué hay en la versión 1.5: deudas, mercado negro, idioma secreto y días de la suerte

| Cambio | Detalle |
|---|---|
| Escalera de deudas | La partida es una lista de pasos en orden: la Pleyzeta, cuatro "regalos" del encapuchado (cada mejora llega desbloqueada... con una deuda), cuatro objetos clave y cuatro metas. Una deuda a la vez; HUD, calendario de la pared y pósit siguen la deuda activa |
| Topes por mercado | Cada mercado da o quita como mucho una cantidad por apuesta, cada vez más grande. Aviso dorado al llegar al tope |
| Tienda abierta siempre | Se mira desde el primer día. Objetos clave en orden y solo cuando te llega el precio; la oferta de FUTURO.exe con letra pequeña |
| Mercado negro | Cuatro mercados nuevos con su logo, pestaña Legal/Negro (`X`), tema oscuro y noticias propias |
| Resistencia | Ya funciona: menos giros en las últimas velas |
| Timmy | El hermano pequeño ahora se llama Timmy |
| Noticias y memes | Unas 30 noticias nuevas (STONKS, "todo está bien", ¡a la luna!, simios juntos fuertes, dos botones...), 7 fotos nuevas y una noticia de la ciudad cada día |
| Idioma secreto | 15 símbolos escondidos, erratas en el periódico, LOS PAGADOS en Mensajín y la app Símbolos. La fuente pixel tiene ahora letras cirílicas |
| Días de la suerte | Los días con un 7: mercados al alza, bonificación, ruleta, Mercado Dorado con objetos que se ven en tu cuarto, lluvia de oro por la ventana |
| En tu cuarto | La caja de la tele bajo la ventana, el móvil en la mesa, el casco de la moto, el reloj en la muñeca y los objetos dorados |

Las partidas guardadas de la 1.4 no se cargan (cambió el formato); el perfil se conserva y el tutorial se ve una vez más
(tiene un paso nuevo: las noticias).

## Qué hay en la versión 1.4: el cerdito, Kevo y la ventana

| Cambio | Detalle |
|---|---|
| Resultado sin prisa | Al terminar cada apuesta sale una tarjeta grande con lo que ganaste o perdiste y lo que tienes ahora. Se queda 2.6 s (clic o tecla para seguir antes) |
| Perder no reinicia | Punto de control al empezar cada meta: al perder del todo vuelves ahí con los fondos que tenías, no al día 1 |
| El cerdito de Timmy | Ya no es un fin de partida: es una vida extra. Cinemática jugable a escondidas en el cuarto de Timmy (si te ve moverte, retrocedes) y después lo rompes a golpes en tu mesa |
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

Los finales A/B quedan para futuras fases (hay un adelanto al llegar a $25,000).
Las partidas guardadas de la versión 1.0 no se cargan (cambió el formato); el perfil (intro vista, ajustes) se conserva
y quien hizo el tutorial antiguo ve el nuevo una vez.

## Estructura

Cada sistema del documento es un archivo independiente; se comunican con un bus de eventos (`SN.Events`).

```
index.html            escenario 640x360 y la interfaz del monitor
css/style.css         estilos (paleta oficial en variables CSS)
css/font.css          fuente pixel propia, generada (no editar a mano)
js/core/              sn.js (utilidades, RNG con semilla), events.js, state.js, game.js (GameManager, bucle, tiempo y cámara)
js/data/              los "ScriptableObjects": mercados (también los negros), eventos, simulación/mejoras/tienda,
                      progression.js (la cadena de deudas y los objetos clave), luck.js (días de la suerte),
                      cipher.js (el idioma secreto), academy.js (el árbol de Bravo Fines), historia (también lo
                      que dice el protagonista en sus globos), chat.js (las conversaciones con Kevo)
js/systems/           economy, debt, time, market-sim (+ PISTA), trading (+ COBRAR, giros y topes), drama (cámara lenta),
                      unlocks (la cadena), upgrades, academy, shopwatch (números rojos y ofertas que saltan solas),
                      save, cipher, luck, audio, tutorial, narrative, bankruptcy
js/render/            pixel.js, pixkit.js (kit de pixel art procedural), sprites.js, desk.js (habitación y ventana), hero.js (manos,
                      gato y primeros planos), hands.js, chart.js, fx.js, news-art.js, characters.js, cinematic.js,
                      sneak.js (el cuarto de Timmy)
js/ui/                ui.js (UIManager), dialog.js, windows.js (mejoras y Academia, periódico con primera plana,
                      tienda, oferta, ruleta, ajustes, "Acerca de"), desktop.js (escritorio del PC, Mensajín y
                      Símbolos), keywords.js (palabras clave con color), hero-say.js (los globos del protagonista)
tools/                build-font.js y pruebas
```

| Documento (Unity) | Aquí |
|---|---|
| GameManager | `js/core/game.js` |
| EconomyManager · DebtManager | `js/systems/economy.js` · `debt.js` |
| MarketSimulator · TradingManager | `js/systems/market-sim.js` · `trading.js` |
| MarketUnlockManager (escalera) · UpgradeManager | `js/systems/unlocks.js` · `upgrades.js` |
| CipherManager · LuckManager | `js/systems/cipher.js` · `luck.js` |
| AcademyManager · ShopWatch (números rojos) | `js/systems/academy.js` · `shopwatch.js` |
| TutorialManager · NarrativeManager · BankruptcyManager | `js/systems/tutorial.js` · `narrative.js` · `bankruptcy.js` |
| DeskInteractionController | `js/render/hands.js` |
| UIManager · SaveManager | `js/ui/ui.js` · `js/systems/save.js` |
| ScriptableObjects | `js/data/*.js` |

**Añadir un mercado:** una entrada en `js/data/markets.js` (volatilidad, deriva, fases, velas por operación, giros y
tope) y su lista de eventos en `js/data/events.js` (cada evento con su foto `art`). Su versión negra se crea sola.

**Cambiar la escalera:** pasos, importes de las deudas, plazos y objetos clave en `js/data/progression.js`; la prueba
de lógica juega partidas enteras con un bot y dice cuánto se tarda en cada paso.

**El idioma secreto:** alfabeto, pistas, mensajes de LOS PAGADOS y erratas en `js/data/cipher.js`. Los textos cifrados
solo pueden usar las 15 letras del alfabeto (la prueba de lógica lo comprueba).
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
node tools/test/logic.test.js       # fórmulas, COBRAR, giros, pista, topes, cadena de deudas, Academia, números rojos, palabras clave, noticias, idioma secreto, suerte y equilibrio (con un bot que juega la partida entera)
node tools/test/e2e.test.js         # partida completa en Chrome/Edge sin ventana: tutorial (errata, mejoras y tienda), regalo, oferta que salta sola, mercado negro, ahorros de Timmy
node tools/test/e2e-paths.test.js   # continuar (también tras cobrar), repetir tutorial, tienda, Bravo Fines y su Academia, primera plana, día de la suerte y ruleta, los 3 finales y pantallas pequeñas
node tools/test/e2e-desktop.test.js # minimizar, Mensajín, la historia de Kevo, LOS PAGADOS, una pista que traduce sus mensajes, Símbolos
```

Abre `index.html?debug` para atajos de prueba: `F6` descubre un símbolo, `F7` salta al siguiente día de la suerte,
`F8` bancarrota, `F9` +$1,000, `F10` pasar un día.
