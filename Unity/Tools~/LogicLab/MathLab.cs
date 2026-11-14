// Math de V8 (Chrome) bit a bit, en el banco rápido. Ver Assets/SaldoNegro/Tests/EditMode/MathSuite.cs.
using System;
using System.IO;
using SaldoNegro.Tests;

public static class MathLab
{
    public static void Todas()
    {
        var m = new MathSuite(File.ReadAllText(Path.GetFullPath("../../Assets/SaldoNegro/Tests/EditMode/Refs/MathRefs.json")));
        var all = new System.Collections.Generic.List<string>();
        foreach (var fn in m.functions())
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var f = m.check(fn, out int n);
            Console.WriteLine($"  {fn}: {n} casos, {f.Count} distintos ({sw.ElapsedMilliseconds} ms)"); 
            all.AddRange(f);
        }
        Console.WriteLine($"  diferencias conocidas (MathSuite.KNOWN): {m.known}");
        if (all.Count > 0) throw new Exception(string.Join("\n", all));
    }
}
