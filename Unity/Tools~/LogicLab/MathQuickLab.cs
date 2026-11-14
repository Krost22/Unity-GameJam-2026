using System;
using System.Diagnostics;
using SaldoNegro.Logic;
public static class MathQuickLab
{
    public static void Velocidad()
    {
        var r = new Random(1);
        foreach (var fn in new[] { "sin", "cos", "exp", "log", "pow" })
        {
            var sw = Stopwatch.StartNew(); double acc = 0;
            for (int i = 0; i < 2000; i++)
            {
                double x = r.NextDouble() * 20 - 5;
                acc += fn == "sin" ? JsMath.sin(x) : fn == "cos" ? JsMath.cos(x) : fn == "exp" ? JsMath.exp(x) : fn == "log" ? JsMath.log(x + 6) : JsMath.pow(x + 6, 1.3);
                if (sw.ElapsedMilliseconds > 5000) { Console.WriteLine($"  {fn}: lento, {i} en 5 s (x={x})"); break; }
            }
            Console.WriteLine($"  {fn}: 2000 en {sw.ElapsedMilliseconds} ms");
        }
    }
}
