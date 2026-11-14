// SALDO NEGRO — port de js/core/sn.js: espacio de nombres SN, utilidades compartidas, generador con semilla y
// temporizadores en tiempo de juego.
// En la web SN es un objeto global al que cada script cuelga su módulo (SN.State, SN.Trading...). Aquí cada
// módulo es una clase y SN guarda la instancia en vigor; SN.Load() los crea todos en el orden de index.html,
// así que cada Load empieza de cero (como recargar la página, o como cada load() de logic.test.js).
// La capa del juego (SaldoNegro.Game) hereda de esta clase para colgar lo suyo (dibujo, interfaz...).
using System;
using System.Collections.Generic;

namespace SaldoNegro.Logic
{
    // Lo que en la web es localStorage
    public interface IStorage
    {
        string getItem(string key);
        void setItem(string key, string value);
        void removeItem(string key);
    }

    // Almacenamiento en memoria (pruebas, o si no hay otro)
    public sealed class MemoryStorage : IStorage
    {
        public readonly Dictionary<string, string> store = new Dictionary<string, string>();
        public string getItem(string key) { return store.TryGetValue(key, out var v) ? v : null; }
        public void setItem(string key, string value) { store[key] = value; }
        public void removeItem(string key) { store.Remove(key); }
    }

    // SN.Tutorial visto desde la lógica (el tutorial de verdad vive en la capa del juego)
    public interface ITutorialFlags { bool active { get; } bool replaying { get; } }
    public sealed class TutorialFlags : ITutorialFlags { public bool active { get; set; } public bool replaying { get; set; } }

    public class SN
    {
        public const string VERSION = "1.6";
        public const int W = 640; // resolución de referencia 16:9 del escritorio (px de pixel art)
        public const int H = 360;
        public static bool DEBUG;

        // ---------- Módulos (en el orden de index.html) ----------
        public static Data Data;
        public static Events Events;
        public static State State;
        public static Economy Economy;
        public static Academy Academy;
        public static Time Time;
        public static Debt Debt;
        public static Market Market;
        public static Trading Trading;
        public static Unlocks Unlocks;
        public static Upgrades Upgrades;
        public static ShopWatch ShopWatch;
        public static Save Save;
        public static Cipher Cipher;
        public static Luck Luck;
        public static KW KW;
        public static ITutorialFlags Tutorial; // null hasta que el juego lo crea

        public static IStorage localStorage = new MemoryStorage();
        // console.error de la web (la capa del juego lo manda a la consola de Unity)
        public static Action<string> logError = (m) => { };
        public static Action<string> logWarn = (m) => { };

        static string dataJson;
        static V dataParsed;

        // Carga la lógica entera: datos (el JSON exportado de js/data) y módulos.
        // storage: dónde guardar (null = en memoria). Devuelve nada: todo queda en los campos de SN.
        public static void Load(string data, IStorage storage = null)
        {
            if (data != dataJson) { dataJson = data; dataParsed = Json.parse(data); }
            localStorage = storage ?? new MemoryStorage();
            timers.Clear();
            Microtasks.reset();
            Tutorial = null;
            // Cada carga trabaja sobre una copia: las pruebas cambian datos (como la web, que los vuelve a leer)
            Data = new Data(Json.clone(dataParsed));
            Events = new Events();
            State = new State();
            Economy = new Economy();
            Academy = new Academy();
            Time = new Time();
            Debt = new Debt();
            Market = new Market();
            Trading = new Trading();
            Unlocks = new Unlocks();
            Upgrades = new Upgrades();
            ShopWatch = new ShopWatch();
            Save = new Save();
            Cipher = new Cipher();
            Luck = new Luck();
            KW = new KW();
        }

        // ---------- Temporizadores en tiempo de juego ----------
        // (se pausan con el bucle y funcionan en pruebas paso a paso)
        public sealed class Timer { public double left; public Action fn; }
        static readonly List<Timer> timers = new List<Timer>();
        public static Timer after(double sec, Action fn) { var t = new Timer { left = sec, fn = fn }; timers.Add(t); return t; }
        public static void cancel(Timer t) { int i = timers.IndexOf(t); if (i >= 0) timers.RemoveAt(i); }
        public static void tickTimers(double dt)
        {
            for (int i = timers.Count - 1; i >= 0; i--)
            {
                // (un temporizador puede cancelar otros al dispararse: la lista puede haber encogido)
                if (i >= timers.Count) continue;
                var t = timers[i];
                t.left -= dt;
                if (t.left <= 0) { timers.RemoveAt(i); t.fn(); }
            }
        }
        public static int timerCount { get { return timers.Count; } }
        // SN.wait(sec): una promesa que se cumple a los `sec` segundos de juego
        public static Promise wait(double sec) { var p = new Promise(); after(sec, p.resolve); return p; }
    }

    // Generador con semilla (mulberry32) para la simulación económica: su estado se guarda con la partida.
    // Da la misma secuencia que el de la web, bit a bit. s es un double, como en JS (puede valer más de 2^31
    // justo después de crearlo; tras el primer next() siempre es un int32).
    public sealed class RNG
    {
        public double s;
        public RNG(double seed) { uint u = JsMath.toUint32(seed); s = u != 0 ? u : 1; }
        public double next()
        {
            s = JsMath.toInt32(s + 0x6D2B79F5);
            int t = (int)s;
            t = JsMath.imul(t ^ (int)((uint)t >> 15), t | 1);
            t ^= unchecked(t + JsMath.imul(t ^ (int)((uint)t >> 7), t | 61));
            return (uint)(t ^ (int)((uint)t >> 14)) / 4294967296.0;
        }
        public double range(double a, double b) { return a + next() * (b - a); }
        public double @int(double a, double b) { return Math.Floor(range(a, b + 1)); }
        public V pick(V arr) { return arr[(int)Math.Floor(next() * arr.length.num)]; }
        public double normal()
        {
            double u = 0, v = 0;
            while (u == 0) u = next();
            while (v == 0) v = next();
            return JsMath.sqrt(-2 * JsMath.log(u)) * JsMath.cos(2 * Math.PI * v);
        }
    }

    // SN.Util
    public static class Util
    {
        public static double clamp(double v, double a, double b) { return JsMath.max(a, JsMath.min(b, v)); }
        public static double lerp(double a, double b, double t) { return a + (b - a) * t; }
        public static double rand(double a, double b) { return a + JsMath.rnd() * (b - a); } // solo para efectos visuales
        public static double randi(double a, double b) { return Math.Floor(rand(a, b + 1)); }
        public static V pick(V arr) { return arr[(int)Math.Floor(JsMath.rnd() * arr.length.num)]; }
        public static V copy(V o) { return Json.parse(Json.stringify(o)); }

        public static class ease
        {
            public static double outCubic(double t) { return 1 - JsMath.pow(1 - t, 3); }
            public static double inOutSine(double t) { return -(JsMath.cos(Math.PI * t) - 1) / 2; }
            public static double outBack(double t) { const double c = 1.70158; return 1 + (c + 1) * JsMath.pow(t - 1, 3) + c * JsMath.pow(t - 1, 2); }
            public static double outElastic(double t) { return t == 0 || t == 1 ? t : JsMath.pow(2, -10 * t) * JsMath.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; }
        }

        // Dinero en dólares enteros: $1,234 (sin centavos en ningún sitio)
        public static string money(double v, bool sign = false)
        {
            double r = JsMath.round(v);
            string s = JsNumber.locale(Math.Abs(r));
            string pre = r < 0 ? "-" : (sign ? "+" : "");
            return pre + "$" + s;
        }
        public static string @short(double v)
        {
            double a = Math.Abs(v);
            if (a >= 1e6) return "$" + Js.String(JsMath.round(v / 1e6)) + "M";
            if (a >= 1e4) return "$" + Js.String(JsMath.round(v / 1e3)) + "K";
            return money(v);
        }
        public static string pct(double v, int digits = 0) { return (v >= 0 ? "+" : "") + JsNumber.toFixed(v * 100, digits) + "%"; }
    }
}
