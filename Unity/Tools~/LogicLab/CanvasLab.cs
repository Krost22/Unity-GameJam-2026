// El lienzo contra Chrome, en el banco rápido. Ver Assets/SaldoNegro/Tests/EditMode/CanvasSuite.cs.
// Guarda las imágenes (port | Chrome | diferencias) en Unity/Tools~/out/canvas/.
using System;
using System.IO;
using SaldoNegro;
using SaldoNegro.Tests;

public static class CanvasLab
{
    public static void Casos()
    {
        PxFont.source = () => File.ReadAllText(Path.GetFullPath("../../Assets/SaldoNegro/Resources/SaldoNegro/Fonts.json"));
        var s = new CanvasSuite(File.ReadAllText(Path.GetFullPath("../../Assets/SaldoNegro/Tests/EditMode/Refs/CanvasRefs.json")));
        int ok = 0, bad = 0;
        var fails = new System.Collections.Generic.List<string>();
        foreach (var n in s.names())
        {
            string r;
            try { r = s.run(n, out var mine, out var chrome, out int w, out int h, out int edge); if (r != null || edge > 0) Png.Save("../out/canvas/" + n + ".png", mine, chrome, w, h); if (edge > 0) Console.WriteLine("  (aproximado) " + n + ": " + edge + " bytes de borde distintos"); }
            catch (Exception e) { r = n + ": " + e.GetType().Name + " " + e.Message; }
            if (r == null) ok++; else { bad++; fails.Add(r); }
        }
        foreach (var f in fails) Console.WriteLine("  " + f);
        Console.WriteLine($"  lienzo: {ok} casos iguales a Chrome, {bad} distintos");
        if (bad > 0) throw new Exception(bad + " casos distintos");
    }
}
