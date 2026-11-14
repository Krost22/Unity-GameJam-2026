// El resto del navegador que usa el juego y que no es el árbol: lienzos (<canvas>), campos con valor, medidas
// de maquetación (offsetWidth, getBoundingClientRect...), la ventana (tamaño, teclado, resize), relojes en tiempo
// real (setTimeout, requestAnimationFrame, performance.now) y pantalla completa.
// Lo que depende de la pantalla lo contesta el anfitrión (IDomHost): en Unity, el reflejo del DOM en UI Toolkit;
// en las pruebas sin Unity no hay anfitrión y las medidas valen 0.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    // getBoundingClientRect(): en píxeles CSS de la ventana (como clientX / clientY de los eventos)
    public struct DomRect
    {
        public double left, top, width, height;
        public double right { get { return left + width; } }
        public double bottom { get { return top + height; } }
        public double x { get { return left; } }
        public double y { get { return top; } }
    }

    public interface IDomHost
    {
        DomRect clientRect(DomElement e);                       // getBoundingClientRect
        void offset(DomElement e, out double left, out double top, out double width, out double height, out DomElement parent); // offsetLeft/Top/Width/Height/Parent
        void client(DomElement e, out double width, out double height);   // clientWidth / clientHeight
        void scroll(DomElement e, out double width, out double height);   // scrollWidth / scrollHeight
        void fullscreen(bool on);
        bool isFullscreen { get; }
    }

    public sealed partial class DomElement
    {
        // ---------- <canvas> ----------
        // El lienzo de un <canvas>. JS: c.width = 320; c.height = 180; c.getContext('2d')
        // (Un <canvas width="222" height="140"> escrito en HTML nace con ese tamaño; sin atributos, 300x150.)
        Canvas canvasBuf;
        public Canvas canvas
        {
            get
            {
                if (canvasBuf == null && tagName == "canvas") canvasBuf = new Canvas(attrInt("width", 300), attrInt("height", 150));
                return canvasBuf;
            }
        }
        int attrInt(string name, int def) { return int.TryParse(getAttribute(name), out int v) && v > 0 ? v : def; }
        public int width { get { return canvas != null ? canvas.width : 0; } set { setCanvasSize(value, canvas != null ? canvas.height : 150); } }
        public int height { get { return canvas != null ? canvas.height : 0; } set { setCanvasSize(canvas != null ? canvas.width : 300, value); } }
        public void setCanvasSize(int w, int h)
        {
            if (canvasBuf != null && canvasBuf.width == w && canvasBuf.height == h) { Array.Clear(canvasBuf.data, 0, canvasBuf.data.Length); canvasBuf.version++; return; }
            canvasBuf = new Canvas(Math.Max(1, w), Math.Max(1, h));
            touch();
        }
        public void setCanvas(Canvas c) { canvasBuf = c; touch(); }
        public Ctx2D getContext() { if (canvas == null) setCanvasSize(300, 150); return canvas.getContext(); }
        // el.setPointerCapture(id): los movimientos del puntero siguen llegando a este elemento hasta que se suelta
        public void setPointerCapture(int pointerId = 0) { Dom.pointerCapture = this; }
        public void releasePointerCapture(int pointerId = 0) { if (Dom.pointerCapture == this) Dom.pointerCapture = null; }

        // ---------- Campos (<input>, <button>) ----------
        public string value { get { return getAttribute("value") ?? ""; } set { setAttribute("value", value ?? ""); } }
        public bool @checked { get { return hasAttribute("checked"); } set { if (value) setAttribute("checked", ""); else removeAttribute("checked"); } }

        // ---------- Medidas (las da el anfitrión) ----------
        // `void el.offsetWidth` es el truco de la web para reiniciar una animación CSS (quitar la clase, forzar el
        // cálculo, volver a ponerla). Aquí es reflow(): el reflejo ve que `animEpoch` cambió y la reinicia.
        public int animEpoch;
        public void reflow() { animEpoch++; touch(); }
        public double offsetWidth { get { reflow(); off(out _, out _, out double w, out _, out _); return w; } }
        public double offsetHeight { get { off(out _, out _, out _, out double h, out _); return h; } }
        public double offsetLeft { get { off(out double l, out _, out _, out _, out _); return l; } }
        public double offsetTop { get { off(out _, out double t, out _, out _, out _); return t; } }
        public DomElement offsetParent { get { off(out _, out _, out _, out _, out DomElement p); return p; } }
        public double clientWidth { get { double w = 0, h = 0; Dom.host?.client(this, out w, out h); return w; } }
        public double clientHeight { get { double w = 0, h = 0; Dom.host?.client(this, out w, out h); return h; } }
        public double scrollWidth { get { double w = 0, h = 0; Dom.host?.scroll(this, out w, out h); return w; } }
        public double scrollHeight { get { double w = 0, h = 0; Dom.host?.scroll(this, out w, out h); return h; } }
        public DomRect getBoundingClientRect() { return Dom.host != null ? Dom.host.clientRect(this) : new DomRect(); }
        void off(out double l, out double t, out double w, out double h, out DomElement p)
        {
            l = t = w = h = 0; p = null;
            if (Dom.host != null) Dom.host.offset(this, out l, out t, out w, out h, out p);
        }
        // el.scrollTop = el.scrollHeight (bajar al final): el reflejo lo aplica; se guarda lo pedido
        double scrollTopValue;
        public double scrollTop { get { return scrollTopValue; } set { scrollTopValue = value; scrollEpoch++; touch(); } }
        public int scrollEpoch;

        // Los nodos de texto de dentro, en orden (document.createTreeWalker(root, NodeFilter.SHOW_TEXT))
        public List<DomText> textNodes()
        {
            var l = new List<DomText>();
            collectText(this, l);
            return l;
        }
        static void collectText(DomElement e, List<DomText> l)
        {
            foreach (var n in e.childNodes) { if (n is DomText t) l.Add(t); else collectText((DomElement)n, l); }
        }

        // Un evento que viene del usuario (ratón, teclado): como dispatch, y al acabar cada manejador corren las
        // microtareas (lo que hay detrás de los await), igual que en el navegador.
        public DomEvent dispatchUser(DomEvent ev)
        {
            ev.fromUser = true;
            dispatch(ev);
            Microtasks.drain();
            return ev;
        }
    }

    public sealed partial class DomEvent
    {
        public bool fromUser;
        public double deltaY;                  // rueda
        public string pointerType = "mouse";
        public int pointerId;
    }

    public static partial class Dom
    {
        public static IDomHost host;
        public static DomElement pointerCapture;   // quien tiene capturado el puntero (lo respeta el anfitrión)

        // Un lienzo ya pintado, como elemento <canvas> listo para insertar (lo que en la web es el propio canvas)
        public static DomElement canvasEl(Canvas c, string cls = null)
        {
            var e = new DomElement("canvas");
            if (!string.IsNullOrEmpty(cls)) e.className = cls;
            e.setCanvas(c);
            return e;
        }

        // ---------- window ----------
        public static double innerWidth = 1280, innerHeight = 720, devicePixelRatio = 1;
        public static string locationSearch = "";      // location.search ("?debug")
        static readonly Dictionary<string, List<Action<DomEvent>>> windowListeners = new Dictionary<string, List<Action<DomEvent>>>();
        // window.addEventListener('resize' | 'keydown' | ...). (document.addEventListener es Dom.document.addEventListener:
        // los eventos de los elementos suben hasta document; los de window solo los lanza el anfitrión.)
        public static void addWindowListener(string type, Action<DomEvent> fn)
        {
            if (!windowListeners.TryGetValue(type, out var l)) windowListeners[type] = l = new List<Action<DomEvent>>();
            l.Add(fn);
        }
        public static void addWindowListener(string type, Action fn) { addWindowListener(type, (e) => fn()); }
        public static void removeWindowListener(string type, Action<DomEvent> fn) { if (windowListeners.TryGetValue(type, out var l)) l.Remove(fn); }
        public static void dispatchWindow(DomEvent ev)
        {
            if (windowListeners.TryGetValue(ev.type, out var l))
                foreach (var fn in l.ToArray())
                {
                    try { fn(ev); } catch (Exception x) { SN.logError("[" + ev.type + " en window] " + x); }
                    Microtasks.drain();
                }
        }

        // ---------- Relojes en tiempo real ----------
        // (SN.after / SN.wait son tiempo de JUEGO y se paran con el bucle; setTimeout no.)
        sealed class TimeoutT { public int id; public double left, every; public Action fn; }
        static readonly List<TimeoutT> timeouts = new List<TimeoutT>();
        static readonly List<Action<double>> rafs = new List<Action<double>>();
        static int nextTimer = 1;
        static double clockMs;
        // performance.now(): milisegundos desde que arrancó
        public static double now() { return clockMs; }
        public static int setTimeout(Action fn, double ms = 0)
        {
            var t = new TimeoutT { id = nextTimer++, left = Math.Max(0, ms), fn = fn };
            timeouts.Add(t);
            return t.id;
        }
        public static void clearTimeout(int id) { for (int i = 0; i < timeouts.Count; i++) if (timeouts[i].id == id) { timeouts.RemoveAt(i); return; } }
        // setInterval(fn, ms) / clearInterval(id)
        public static int setInterval(Action fn, double ms)
        {
            var t = new TimeoutT { id = nextTimer++, left = Math.Max(1, ms), fn = fn, every = Math.Max(1, ms) };
            timeouts.Add(t);
            return t.id;
        }
        public static void clearInterval(int id) { clearTimeout(id); }
        // requestAnimationFrame(fn): fn(performance.now()) en el siguiente fotograma
        public static int requestAnimationFrame(Action<double> fn) { rafs.Add(fn); return rafs.Count; }

        // Lo llama el anfitrión una vez por fotograma con los milisegundos reales transcurridos: vencen los
        // setTimeout y corren los requestAnimationFrame (cada uno seguido de sus microtareas, como en el navegador).
        public static void tick(double ms)
        {
            clockMs += ms;
            if (timeouts.Count > 0)
            {
                foreach (var t in timeouts) t.left -= ms;
                var due = timeouts.FindAll((t) => t.left <= 0);
                foreach (var t in due)
                {
                    if (!timeouts.Contains(t)) continue; // lo canceló otro temporizador
                    if (t.every > 0) t.left += t.every * Math.Max(1, Math.Floor(-t.left / t.every) + 1); // (un intervalo no se acumula si el fotograma fue largo)
                    else timeouts.Remove(t);
                    try { t.fn(); } catch (Exception x) { SN.logError("[setTimeout] " + x); }
                    Microtasks.drain();
                }
            }
            if (rafs.Count > 0)
            {
                var run = rafs.ToArray();
                rafs.Clear();
                foreach (var fn in run)
                {
                    try { fn(clockMs); } catch (Exception x) { SN.logError("[requestAnimationFrame] " + x); }
                    Microtasks.drain();
                }
            }
        }
        public static int pendingFrames { get { return rafs.Count; } }

        // ---------- Pantalla completa ----------
        public static bool fullscreenElement { get { return host != null && host.isFullscreen; } }
        public static void requestFullscreen() { host?.fullscreen(true); }
        public static void exitFullscreen() { host?.fullscreen(false); }

        // Empezar de cero con un documento nuevo (como recargar la página). html: el <body> de index.html
        public static void load(string bodyHtml)
        {
            document = new DomElement("body");
            document.innerHTML = bodyHtml ?? "";
            byIdCache.Clear();
            windowListeners.Clear();
            timeouts.Clear();
            rafs.Clear();
            clockMs = 0;
            focus(null);
            pointerCapture = null;
        }

        // ---------- <audio> (la música: js/systems/music.js) ----------
        // new Audio(): lo da el anfitrión (en Unity, un AudioSource con su pista). Sin anfitrión, uno mudo.
        public static Func<IAudioEl> audioFactory;
        public static IAudioEl createAudio() { return audioFactory != null ? audioFactory() : new SilentAudio(); }
    }

    // Lo que el juego usa de un HTMLAudioElement
    public interface IAudioEl
    {
        string src { get; set; }
        double volume { get; set; }
        bool loop { get; set; }
        bool muted { get; set; }
        bool preservesPitch { get; set; }
        double playbackRate { get; set; }
        double currentTime { get; set; }
        double duration { get; }          // NaN hasta que carga
        bool paused { get; }
        bool ended { get; }
        int readyState { get; }
        Action onError { get; set; }
        void play();
        void pause();
    }

    // Un <audio> que no suena (pruebas sin Unity, o si no hay salida de sonido): nunca llega a cargar
    public sealed class SilentAudio : IAudioEl
    {
        public string src { get; set; }
        public double volume { get; set; } = 1;
        public bool loop { get; set; }
        public bool muted { get; set; }
        public bool preservesPitch { get; set; } = true;
        public double playbackRate { get; set; } = 1;
        public double currentTime { get; set; }
        public double duration { get { return double.NaN; } }
        public bool paused { get; private set; } = true;
        public bool ended { get { return false; } }
        public int readyState { get { return 0; } }
        public Action onError { get; set; }
        public void play() { paused = false; }
        public void pause() { paused = true; }
    }
}
