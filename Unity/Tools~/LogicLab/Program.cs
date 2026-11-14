// Mini ejecutor de pruebas del banco LogicLab: cada método estático público de una clase *Lab sin parámetros
// es una prueba; lanza una excepción si falla. Uso: dotnet run -c Release -- [filtro]
using System;
using System.Diagnostics;
using System.Linq;
using System.Reflection;

public static class Program
{
    public static int Main(string[] args)
    {
        string filter = args.Length > 0 ? args[0] : "";
        int ok = 0, bad = 0;
        var types = Assembly.GetExecutingAssembly().GetTypes().Where(t => t.Name.EndsWith("Lab")).OrderBy(t => t.Name);
        foreach (var t in types)
            foreach (var m in t.GetMethods(BindingFlags.Public | BindingFlags.Static).Where(m => m.GetParameters().Length == 0 && m.ReturnType == typeof(void)))
            {
                string name = t.Name + "." + m.Name;
                if (filter.Length > 0 && name.IndexOf(filter, StringComparison.OrdinalIgnoreCase) < 0) continue;
                var sw = Stopwatch.StartNew();
                try { m.Invoke(null, null); ok++; Console.WriteLine($"ok    {name} ({sw.ElapsedMilliseconds} ms)"); }
                catch (TargetInvocationException e) { bad++; Console.WriteLine($"FALLO {name}: {e.InnerException}"); }
            }
        Console.WriteLine($"\n{ok} pasan, {bad} fallan");
        return bad > 0 ? 1 : 0;
    }

    public static void Check(bool cond, string msg) { if (!cond) throw new Exception(msg); }
}
