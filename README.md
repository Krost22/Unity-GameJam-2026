# SALDO NEGRO

Roguelite económico de trading con misterio narrativo, en pixel art arcade.
Un joven se endeuda por comprar una consola absurda y un encapuchado le regala **FUTURO.exe**,
una app de trading que promete dinero fácil... y que se cobra algo más valioso que el dinero.

## Jugar

Abre `index.html` con doble clic. Funciona sin internet, sin servidor y sin instalar nada (HTML, CSS y JS puros).
La partida se guarda sola en el navegador.

**Cómo se juega (en una frase):** mira la PISTA de la gráfica, pulsa **SUBE** o **BAJA**, y **COBRA** antes de que
las últimas velas te den un susto. Junta $250 antes del día 7.

**Controles:** todo se puede hacer con el ratón (también los diálogos: clic en cualquier parte).
El teclado es un atajo y cada botón muestra su tecla:

| Tecla | Acción |
|---|---|
| `↑` / `B` | SUBE |
| `↓` / `V` | BAJA |
| `Espacio` | COBRAR (durante una operación) · avanzar diálogos |
| `F` | acelerar las velas |
| `← →` | apuesta (en pasos de 5%) |
| `1-4` | multiplicador ×1 ×2 ×5 ×10 |
| `P` | ESPERAR (pasar el turno sin apostar) |
| `Tab` | cambiar de mercado |
| `M` `N` `T` | mejoras, noticias, tienda |
| `Esc` | menú / cerrar ventana |

## Reglas

- **La PISTA:** a la derecha de la última vela hay un cono que apunta hacia donde irá el precio. Se calcula con el
  estado real del mercado (tendencia, siguiente fase y noticias conocidas), con un pequeño error de lectura que la
  mejora ANÁLISIS reduce. Más flechas, más fiable: ▲ acierta ~70%, ▲▲ ~80%, ▲▲▲ ~93%. Con `?` es una moneda al aire.
- **SUBE / BAJA:** ganas si el precio va hacia donde apostaste. APUESTA (25% / 50% / TODO o la barra) y MULTIPLICADOR
  deciden cuánto. La barrita de colores bajo el multiplicador es el riesgo de la apuesta de un vistazo.
- **COBRAR:** una operación dura unas 12 velas, pero puedes cobrar cuando quieras al precio que ves. Las velas que
  faltan se siguen mostrando en gris: lo que te ahorraste... o lo que te perdiste.
- **Zona de peligro:** las últimas velas (rayadas en naranja) pueden traer un **giro inesperado**. Cuando llega, el
  tiempo se frena, la cámara se acerca, late un corazón y la vela se arrastra antes del latigazo: aún puedes cobrar.
- **Cada apuesta o ESPERAR gasta un turno.** 3 turnos = 1 día. La deuda vence al final del día 7.
- **Fin de partida inmediato:** si no te alcanza para la apuesta mínima ($10), o si ya es matemáticamente imposible
  pagar a tiempo, se acaba en ese momento (el cobrador se adelanta). Nada de pasar turnos esperando lo inevitable.

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
js/data/              los "ScriptableObjects": mercados, eventos, simulación/mejoras/objetivos/tienda, historia
js/systems/           economy, debt, time, market-sim (+ PISTA), trading (+ COBRAR y giros), drama (cámara lenta),
                      unlocks, upgrades, save, audio, tutorial, narrative, bankruptcy
js/render/            pixel.js, sprites.js, desk.js, hands.js, chart.js, fx.js, news-art.js, characters.js, cinematic.js
js/ui/                ui.js (UIManager), dialog.js, windows.js (mejoras, periódico, tienda, ajustes)
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
Los iconos son dibujos en texto en `js/render/sprites.js`; personajes, cerdito y consola en `js/render/characters.js`;
la habitación en `js/render/desk.js`; las fotos del periódico en `js/render/news-art.js`.

**Fuente:** `node tools/build-font.js` regenera `css/font.css` a partir de los glifos dibujados en ese archivo.

## Pruebas

```
node tools/test/logic.test.js       # fórmulas, COBRAR, giros, fiabilidad de la pista, plazo, fin de partida y equilibrio
node tools/test/e2e.test.js         # partida completa en Chrome sin ventana, con clics REALES de ratón y capturas
node tools/test/e2e-paths.test.js   # continuar (también tras cobrar), repetir tutorial, tienda, los 3 finales y pantallas pequeñas
```

Abre `index.html?debug` para atajos de prueba: `F8` bancarrota, `F9` +$1,000, `F10` pasar un día.
