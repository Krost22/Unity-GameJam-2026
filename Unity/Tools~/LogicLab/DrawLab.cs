// El dibujo contra Chrome, en el banco rápido. Ver Assets/SaldoNegro/Tests/EditMode/DrawSuite.cs.
// Uso: dotnet ../out/lab-mine/LogicLab.dll DrawLab           (todos los grupos)
// Guarda port | Chrome | diferencias en Unity/Tools~/out/draw/<grupo>-<n>.png
using System;
using System.IO;
using SaldoNegro;
using SaldoNegro.Tests;

public static class DrawLab
{
    static string A(string rel) { return Path.GetFullPath(Path.Combine("../../Assets/SaldoNegro", rel)); }
    static void group(string name)
    {
        string refs = A("Tests/EditMode/Refs/Draw-" + name + ".json");
        if (!File.Exists(refs)) { Console.WriteLine("  (sin referencias para " + name + ")"); return; }
        PxFont.source = () => File.ReadAllText(A("Resources/SaldoNegro/Fonts.json"));
        SaldoNegro.Sprites.source = () => File.ReadAllText(A("Resources/SaldoNegro/Sprites.json"));
        var s = new DrawSuite(File.ReadAllText(refs), File.ReadAllText(A("Resources/SaldoNegro/Data.json")));
        int ok = 0, textBytes = 0, withText = 0; var fails = new System.Collections.Generic.List<string>();
        for (int i = 0; i < s.count; i++)
        {
            string r;
            try { r = s.run(i, out var mine, out var chrome, out int w, out int h); if (r != null && mine != null) Png.Save("../out/draw/" + name + "-" + i + ".png", mine, chrome, w, h); }
            catch (Exception e) { r = s.label(i) + ": " + e.GetType().Name + " " + e.Message.Split('\n')[0]; }
            if (r == null) ok++; else fails.Add(r);
            if (s.textBytes > 0) { textBytes += s.textBytes; withText++; }
        }
        foreach (var f in fails) Console.WriteLine("  " + f);
        Console.WriteLine($"  {name}: {ok} de {s.count} sondas iguales a Chrome" + (withText > 0 ? $" ({withText} con letras: {textBytes} bytes distintos, todos donde hay texto)" : ""));
        if (fails.Count > 0) throw new Exception(fails.Count + " sondas distintas en " + name);
    }
    public static void Sprites() { group("sprites"); }
    public static void Chars() { group("chars"); }
    public static void Room() { group("room"); }
    public static void News() { group("news"); }
}
