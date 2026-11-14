// Banco rápido de la suite de lógica (logic.test.js traducido, ver Assets/SaldoNegro/Tests/EditMode/LogicSuite.cs).
// Uso: dotnet run -c Release -- LogicSuite
using System;
using System.IO;
using SaldoNegro.Tests;

public static class LogicSuiteLab
{
    public static void All()
    {
        var s = new LogicSuite(File.ReadAllText(Path.GetFullPath("../../Assets/SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath("../../.."));
        s.RunAll();
        foreach (var l in s.log) Console.WriteLine(l);
        Console.WriteLine();
        Console.WriteLine(s.passed + " correctas, " + s.failed + " fallos");
        if (s.failed > 0) throw new Exception(string.Join("\n", s.failures));
    }
}
