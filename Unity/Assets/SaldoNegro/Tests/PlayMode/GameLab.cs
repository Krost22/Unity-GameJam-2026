// El juego ENTERO sin Unity: carga el <body> de la web (Body.html), los datos y todos los módulos, arranca
// SN.Game y lo hace avanzar fotograma a fotograma (60 por segundo), con clics y teclas como los del jugador.
// Cualquier excepción o SN.logError hace fallar la prueba. Es la versión rápida de "jugar una partida sin errores
// en consola". Lo usan el banco de .NET (Unity/Tools~/LogicLab) y las pruebas PlayMode de Unity (FlowTests.cs), que
// enganchan aquí la lectura de los recursos, el reflejo en UI Toolkit y la espera de fotogramas.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using SaldoNegro;
using SaldoNegro.Logic;
using static FlowCheck;

public static class GameLab
{
    static string A(string rel) { return Path.GetFullPath(Path.Combine("../../Assets/SaldoNegro", rel)); }
    // Ganchos (los pone Unity): leer un recurso por su ruta bajo Assets/SaldoNegro, después de abrir, y tras cada fotograma
    public static Func<string, string> read = (rel) => File.ReadAllText(A(rel));
    public static Action afterOpen;
    public static Action afterFrame;
    public static Action<string> log = (m) => Console.WriteLine(m);
    public static readonly List<string> errors = new List<string>();
    public static readonly List<string> trace = new List<string>();
    static string lastState;

    // Abre "la página": DOM, módulos y arranque
    public static void open(IStorage storage = null, int w = 1280, int h = 720)
    {
        PxFont.source = () => read("Resources/SaldoNegro/Fonts.json");
        Sprites.source = () => read("Resources/SaldoNegro/Sprites.json");
        errors.Clear(); trace.Clear(); lastState = null;
        Dom.host = null;
        Dom.innerWidth = w; Dom.innerHeight = h;
        Dom.load(read("Resources/SaldoNegro/Body.html"));
        SaldoNegro.SN.LoadAll(read("Resources/SaldoNegro/Data.json"), storage ?? new MemoryStorage());
        SaldoNegro.Logic.SN.logError = (m) => { errors.Add(m); };
        afterOpen?.Invoke();
        SaldoNegro.SN.Game.start();
        Microtasks.drain();
    }

    // Avanza `sec` segundos de reloj a 60 fotogramas por segundo
    public static void run(double sec)
    {
        int n = (int)Math.Round(sec * 60);
        for (int i = 0; i < n; i++)
        {
            Dom.tick(1000.0 / 60);
            Microtasks.drain();
            afterFrame?.Invoke();
            string s = SaldoNegro.SN.Game.state;
            if (s != lastState) { trace.Add(Math.Round(Dom.now() / 1000, 2).ToString(System.Globalization.CultureInfo.InvariantCulture) + "s " + s); lastState = s; }
            if (errors.Count > 0) throw new Exception("error a los " + Math.Round(Dom.now() / 1000, 2) + " s (" + string.Join(" > ", trace) + "): " + errors[0]);
        }
    }

    public static bool visible(DomElement e)
    {
        for (var p = e; p != null; p = p.parentElement) if (p.classList.contains("hidden")) return false;
        return e != null && Dom.document.contains(e);
    }
    public static void click(string sel)
    {
        var e = sel.StartsWith("#") && !sel.Contains(" ") ? Dom.byId(sel.Substring(1)) : Dom.querySelector(sel);
        Check(e != null, "no existe " + sel + " (" + string.Join(" > ", trace) + ")");
        Check(visible(e), "no se ve " + sel + " (" + string.Join(" > ", trace) + ")");
        Check(!e.disabled, "está desactivado " + sel);
        e.dispatchUser(new DomEvent("pointerdown"));
        e.dispatchUser(new DomEvent("click"));
        if (errors.Count > 0) throw new Exception("error al pulsar " + sel + ": " + errors[0]);
    }
    public static void key(string code, string k = null)
    {
        (Dom.focused ?? Dom.document).dispatchUser(new DomEvent("keydown") { code = code, key = k ?? code });
        if (errors.Count > 0) throw new Exception("error al pulsar la tecla " + code + ": " + errors[0]);
    }
    // Espera (hasta `max` segundos) a que se cumpla algo
    public static void until(Func<bool> test, double max, string what)
    {
        for (double t = 0; t < max; t += 0.25) { if (test()) return; run(0.25); }
        Check(test(), "no llegó: " + what + " en " + max + " s (" + string.Join(" > ", trace) + ")");
    }

    // ---------- Pruebas ----------
    // Arranca, pasa la bienvenida y llega al menú
    public static void Arranque()
    {
        open();
        run(3);
        Check(SaldoNegro.SN.Game.state == "BOOT" || SaldoNegro.SN.Game.state == "MENU", "estado tras arrancar: " + SaldoNegro.SN.Game.state);
        var go = Dom.querySelector("#boot button");
        Check(go != null && visible(go), "la ventana de bienvenida tiene su botón");
        click("#boot button");
        until(() => SaldoNegro.SN.Game.state == "MENU", 6, "el menú");
        Check(visible(Dom.byId("btn-new")), "se ve Nueva partida");
        log("  " + string.Join(" > ", trace));
    }
}

// Comprobaciones de las partidas (lanzan una excepción con el mensaje si fallan)
public static class FlowCheck
{
    public static void Check(bool cond, string msg) { if (!cond) throw new Exception(msg); }
}
