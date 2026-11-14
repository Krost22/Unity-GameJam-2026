// Semilla fija contra la web (Chrome), en el banco rápido. Ver Assets/SaldoNegro/Tests/EditMode/GoldenSuite.cs.
using System;
using System.IO;
using SaldoNegro.Tests;

public static class GoldenLab
{
    static string A(string rel) { return Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../../Assets/SaldoNegro", rel)); }
    static GoldenSuite make() { return new GoldenSuite(File.ReadAllText(A("Resources/SaldoNegro/Data.json")), File.ReadAllText(A("Tests/EditMode/Refs/GoldenRefs.json"))); }
    static void report(GoldenSuite g)
    {
        foreach (var l in g.log) Console.WriteLine("  " + l);
        if (g.failures.Count > 0) throw new Exception(string.Join("\n", g.failures));
    }
    public static void Rng() { var g = make(); g.Rng(); report(g); }
    public static void Textos() { var g = make(); g.Textos(); report(g); }
    public static void Partidas()
    {
        var g = make();
        for (int i = 0; i < g.runCount; i++) g.Partida(i);
        report(g);
    }
}
