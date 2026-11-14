// Pruebas rápidas de JsNumber y V (las de verdad, contra Node/Chrome, están en los tests EditMode).
using System;
using SaldoNegro.Logic;
using static Program;

public static class NumberLab
{
    public static void ToStringBasics()
    {
        Check(JsNumber.toString(0.1 + 0.2) == "0.30000000000000004", "0.1+0.2 -> " + JsNumber.toString(0.1 + 0.2));
        Check(JsNumber.toString(1e21) == "1e+21", "1e21");
        Check(JsNumber.toString(123e-20) == "1.23e-18", "1.23e-18 -> " + JsNumber.toString(123e-20));
        Check(JsNumber.toString(0.000001) == "0.000001", "1e-6");
        Check(JsNumber.toString(1e-7) == "1e-7", "1e-7");
        Check(JsNumber.toString(double.MaxValue) == "1.7976931348623157e+308", "max -> " + JsNumber.toString(double.MaxValue));
        Check(JsNumber.toString(5e-324) == "5e-324", "min -> " + JsNumber.toString(5e-324));
        Check(JsNumber.toString(Math.Pow(2, -2 / 12.0)) == "0.8908987181403393", "2^(-1/6) -> " + JsNumber.toString(Math.Pow(2, -2 / 12.0)));
        Check(JsNumber.toString(-1.5) == "-1.5", "-1.5");
        Check(JsNumber.toString(100) == "100", "100");
        Check(JsNumber.toString(1.0004) == "1.0004", "1.0004");
    }

    public static void ParseRoundTrip()
    {
        var r = new Random(7);
        for (int i = 0; i < 200000; i++)
        {
            double x = BitConverter.Int64BitsToDouble((long)(r.NextDouble() * long.MaxValue));
            if (double.IsNaN(x) || double.IsInfinity(x)) continue;
            string s = JsNumber.toString(x);
            Check(JsNumber.fromString(s) == x, "ida y vuelta " + x.ToString("R") + " -> " + s);
            Check(double.Parse(s, System.Globalization.CultureInfo.InvariantCulture) == x, ".NET lee distinto " + s);
            // .NET 8 tiene el "R" más corto: tiene que dar las mismas cifras
            string net = x.ToString("R", System.Globalization.CultureInfo.InvariantCulture);
            Check(double.Parse(net) == x && digits(net) == digits(s), "cifras distintas de .NET: " + s + " vs " + net);
        }
    }
    static string digits(string s)
    {
        int e = s.IndexOfAny(new[] { 'e', 'E' });
        string m = e >= 0 ? s.Substring(0, e) : s;
        return m.Replace("-", "").Replace(".", "").TrimStart('0').TrimEnd('0');
    }

    public static void ToFixed()
    {
        Check(JsNumber.toFixed(1.005, 2) == "1.00", "1.005");
        Check(JsNumber.toFixed(1.5, 0) == "2", "1.5");
        Check(JsNumber.toFixed(2.5, 0) == "3", "2.5");
        Check(JsNumber.toFixed(-2.5, 0) == "-3", "-2.5");
        Check(JsNumber.toFixed(0.07, 2) == "0.07", "0.07");
        Check(JsNumber.toFixed(-0.001, 2) == "-0.00", "-0.001");
        Check(JsNumber.toFixed(12.3456, 1) == "12.3", "12.3456");
        Check(JsNumber.toFixed(0, 2) == "0.00", "0");
        Check(JsNumber.toFixed(0.15 * 100, 0) == "15", "15");
    }

    public static void Locale()
    {
        Check(JsNumber.locale(1234567) == "1,234,567", "1234567");
        Check(JsNumber.locale(999) == "999", "999");
        Check(JsNumber.locale(1000) == "1,000", "1000");
        Check(JsNumber.locale(0) == "0", "0");
    }

    public static void ValueSemantics()
    {
        var o = new JsObject();
        V run = o;
        run["capital"] = 100;
        run["capital"] = run["capital"] + 5;
        Check(run["capital"] == 105, "suma");
        run["uid"] = 1;
        V u = run["uid"]; run["uid"] = u + 1;
        Check(run["uid"] == 2, "uid");
        Check(!run["nada"], "undefined es falso");
        Check(run["nada"].isUndefined, "undefined");
        V s = "credito-" + run["capital"];
        Check(s == "credito-105", "concatenar: " + s);
        V a = run["nada"] || "x";
        Check(a == "x", "||");
        V b = run["capital"] && "y";
        Check(b == "y", "&&");
        double d = run["capital"] * 2;
        Check(d == 210, "*");
        Check(run["capital"] > 100, "<");
        var arr = new JsArray(); arr.push(1, 2, 3);
        V va = arr;
        Check(va.length == 3 && va[1] == 2, "array");
        Check(arr.indexOf(2) == 1 && arr.includes(3) && !arr.includes("3"), "indexOf/includes estrictos");
        V obj2 = new JsObject();
        arr.push(obj2);
        Check(arr.indexOf(obj2) == 3 && arr.indexOf(new JsObject()) == -1, "identidad");
        Check(((V)0.1 + 0.2).str == "0.30000000000000004", "String");
    }

    public static void KeyOrder()
    {
        var o = new JsObject();
        o["b"] = 1; o["2"] = 1; o["a"] = 1; o["1"] = 1;
        Check(string.Join(",", o.keys()) == "1,2,b,a", "orden de claves: " + string.Join(",", o.keys()));
    }
}
