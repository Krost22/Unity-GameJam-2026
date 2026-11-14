// El único MonoBehaviour del juego: engancha el port (C# normal, sin Unity) al bucle de Unity, como el navegador
// engancha la web: abre "la página" (el <body> de index.html en el DOM mínimo, los datos y todos los módulos),
// arranca SN.Game y cada fotograma le pasa el tiempo real (requestAnimationFrame, setTimeout), el teclado, el
// ratón (a través de DomView) y el tamaño de la ventana; DomView refleja el DOM en UI Toolkit.
using System.Collections.Generic;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;
using IKey = UnityEngine.InputSystem.Key;

namespace SaldoNegro
{
    [RequireComponent(typeof(UIDocument))]
    [DisallowMultipleComponent]
    public sealed class SaldoNegroApp : MonoBehaviour
    {
        public static SaldoNegroApp instance { get; private set; }
        public DomView view { get; private set; }
        int screenW, screenH;
        // Las pruebas PlayMode llevan el reloj a mano (Tests/PlayMode/FlowTests.cs): Update no avanza el juego
        public static bool manualClock;

        void OnEnable()
        {
            instance = this;
            PxFont.source = () => Resources.Load<TextAsset>("SaldoNegro/Fonts").text;
            Sprites.source = () => Resources.Load<TextAsset>("SaldoNegro/Sprites").text;
            var root = GetComponent<UIDocument>().rootVisualElement;
            if (root == null) { Debug.LogError("SALDO NEGRO: el UIDocument no tiene panel (¿falta el PanelSettings?)"); return; }
            root.Clear();
            // El raíz ocupa todo el panel. (Sin el tema por defecto de Unity, que es quien lo estira, mediría 0x0.)
            root.style.position = Position.Absolute;
            root.style.left = 0; root.style.top = 0; root.style.right = 0; root.style.bottom = 0;

            SaldoNegro.Logic.SN.logError = (m) => Debug.LogError("SALDO NEGRO: " + m);
            SaldoNegro.Logic.SN.logWarn = (m) => Debug.LogWarning("SALDO NEGRO: " + m);
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            Dom.locationSearch = "?debug"; // atajos de depuración (F6-F11), solo en el editor y en desarrollo
#else
            Dom.locationSearch = "";
#endif
            screenW = Screen.width; screenH = Screen.height;
            Dom.innerWidth = screenW; Dom.innerHeight = screenH;
            Dom.load(Resources.Load<TextAsset>("SaldoNegro/Body").text);
            view = new DomView(root);
            Dom.host = view;
            SN.LoadAll(Resources.Load<TextAsset>("SaldoNegro/Data").text, Storage.Create());
            new UnityAudio(gameObject).attach();
            SN.Game.start();
            Microtasks.drain();
            view.sync();
        }

        void OnDisable()
        {
            if (Dom.host == view) Dom.host = null;
            view = null;
            if (instance == this) instance = null;
        }

        void Update()
        {
            if (view == null || manualClock) return;
            if (Screen.width != screenW || Screen.height != screenH)
            {
                screenW = Screen.width; screenH = Screen.height;
                Dom.innerWidth = screenW; Dom.innerHeight = screenH;
                Dom.dispatchWindow(new DomEvent("resize"));
            }
            keyboard();
            Dom.tick(UnityEngine.Time.unscaledDeltaTime * 1000.0);
            Microtasks.drain();
            view.sync();
        }

        // ---------- Teclado: Input System -> keydown / keyup con los códigos del navegador (event.code) ----------
        static readonly Dictionary<IKey, string> CODES = buildCodes();
        static Dictionary<IKey, string> buildCodes()
        {
            var d = new Dictionary<IKey, string>();
            for (IKey k = IKey.A; k <= IKey.Z; k++) d[k] = "Key" + k.ToString();
            d[IKey.Digit0] = "Digit0"; d[IKey.Digit1] = "Digit1"; d[IKey.Digit2] = "Digit2"; d[IKey.Digit3] = "Digit3"; d[IKey.Digit4] = "Digit4";
            d[IKey.Digit5] = "Digit5"; d[IKey.Digit6] = "Digit6"; d[IKey.Digit7] = "Digit7"; d[IKey.Digit8] = "Digit8"; d[IKey.Digit9] = "Digit9";
            d[IKey.Space] = "Space"; d[IKey.Enter] = "Enter"; d[IKey.NumpadEnter] = "NumpadEnter"; d[IKey.Escape] = "Escape"; d[IKey.Backspace] = "Backspace"; d[IKey.Tab] = "Tab";
            d[IKey.UpArrow] = "ArrowUp"; d[IKey.DownArrow] = "ArrowDown"; d[IKey.LeftArrow] = "ArrowLeft"; d[IKey.RightArrow] = "ArrowRight";
            d[IKey.LeftShift] = "ShiftLeft"; d[IKey.RightShift] = "ShiftRight"; d[IKey.LeftCtrl] = "ControlLeft"; d[IKey.RightCtrl] = "ControlRight";
            d[IKey.Minus] = "Minus"; d[IKey.Equals] = "Equal"; d[IKey.Comma] = "Comma"; d[IKey.Period] = "Period"; d[IKey.Slash] = "Slash";
            d[IKey.Semicolon] = "Semicolon"; d[IKey.Quote] = "Quote"; d[IKey.LeftBracket] = "BracketLeft"; d[IKey.RightBracket] = "BracketRight"; d[IKey.Backquote] = "Backquote";
            d[IKey.F1] = "F1"; d[IKey.F2] = "F2"; d[IKey.F3] = "F3"; d[IKey.F4] = "F4"; d[IKey.F5] = "F5"; d[IKey.F6] = "F6";
            d[IKey.F7] = "F7"; d[IKey.F8] = "F8"; d[IKey.F9] = "F9"; d[IKey.F10] = "F10"; d[IKey.F11] = "F11"; d[IKey.F12] = "F12";
            return d;
        }
        // event.key: la letra o el nombre (para las pocas comprobaciones que lo miran)
        static string keyName(string code)
        {
            if (code.StartsWith("Key")) return code.Substring(3).ToLowerInvariant();
            if (code.StartsWith("Digit")) return code.Substring(5);
            if (code == "Space") return " ";
            return code;
        }
        void keyboard()
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            foreach (var kv in CODES)
            {
                var k = kb[kv.Key];
                if (k.wasPressedThisFrame) send("keydown", kv.Value, kb);
                else if (k.wasReleasedThisFrame) send("keyup", kv.Value, kb);
            }
        }
        static void send(string type, string code, Keyboard kb)
        {
            var ev = new DomEvent(type) { code = code, key = keyName(code), shiftKey = kb.shiftKey.isPressed, ctrlKey = kb.ctrlKey.isPressed, altKey = kb.altKey.isPressed };
            (Dom.focused ?? Dom.document).dispatchUser(ev);
            if (!ev.propagationStopped) Dom.dispatchWindow(ev);
        }
    }
}
