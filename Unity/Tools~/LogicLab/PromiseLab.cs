// Las promesas del port (Assets/SaldoNegro/Logic/Promise.cs) se comportan como las de JS: orden de microtareas,
// await que cede el turno, race, valores, rechazos con try/catch y esperas en tiempo de juego (SN.wait).
using System;
using System.Collections.Generic;
using System.IO;
using SaldoNegro.Logic;
using static Program;

public static class PromiseLab
{
    static readonly List<string> log = new List<string>();
    static string Log { get { return string.Join(" ", log); } }
    sealed class Skip : Exception { }

    static async Promise a()
    {
        log.Add("a1");
        await SN.wait(1);
        log.Add("a2");
        int v = await b();
        log.Add("a3:" + v);
        try { await fails(); } catch (Skip) { log.Add("cazada"); }
        await Promise.race(SN.wait(5), SN.wait(0.5));
        log.Add("a4");
    }
    static async Promise<int> b() { log.Add("b1"); await SN.wait(1); log.Add("b2"); return 7; }
    static async Promise fails() { await Promise.resolved(); throw new Skip(); }

    public static void Orden()
    {
        SN.Load(File.ReadAllText("../../Assets/SaldoNegro/Resources/SaldoNegro/Data.json"));
        var errors = new List<string>();
        SN.logError = (m) => errors.Add(m);
        log.Clear();
        var p = a();
        log.Add("sync");
        Check(Log == "a1 sync", "corre hasta el primer await: " + Log);
        void frame(double dt) { SN.tickTimers(dt); Microtasks.drain(); }
        frame(0.5); Check(Log == "a1 sync", "aún no: " + Log);
        frame(0.5); Check(Log == "a1 sync a2 b1", "tras 1 s: " + Log);
        frame(1); Check(Log == "a1 sync a2 b1 b2 a3:7 cazada", "valor y rechazo: " + Log);
        frame(0.4); Check(!p.settled, "race pendiente");
        frame(0.1); Check(Log.EndsWith("a4") && p.fulfilled, "race: " + Log);

        // resolve() no ejecuta lo de detrás del await en el momento: va después del código en curso
        log.Clear();
        var gate = new Promise();
        Func<Promise> waiter = async () => { await gate; log.Add("después"); };
        waiter();
        gate.resolve(); log.Add("antes");
        Microtasks.drain();
        Check(Log == "antes después", "microtarea: " + Log);

        // await de una promesa ya cumplida también cede el turno
        log.Clear();
        Func<Promise> w2 = async () => { log.Add("1"); await Promise.resolved(); log.Add("3"); };
        w2(); log.Add("2");
        Microtasks.drain();
        Check(Log == "1 2 3", "await cede: " + Log);

        // new Promise con valor y then / catch
        log.Clear();
        Action<string> res = null;
        var pv = new Promise<string>((r) => { res = r; });
        pv.then((s) => log.Add("then:" + s));
        res("hola"); res("otra");
        Microtasks.drain();
        Check(Log == "then:hola", "then: " + Log);

        // Rechazo que nadie espera: se avisa
        Check(errors.Count == 0, "sin errores hasta aquí: " + string.Join(" | ", errors));
        fails();
        Microtasks.drain();
        Check(errors.Count == 1 && errors[0].Contains("Uncaught"), "rechazo sin dueño: " + errors.Count);
        SN.logError = (m) => { };
    }
}
