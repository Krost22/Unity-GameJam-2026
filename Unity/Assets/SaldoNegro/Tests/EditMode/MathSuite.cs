// Math.sin, cos, exp, log, log10, pow y hypot del port contra los de Chrome (Refs/MathRefs.json, generado por
// Unity/Tools~/ref-math.js). Casos límite guardados tal cual y casos aleatorios regenerados con el mismo
// splitmix64 que usó el generador (así el archivo no pesa). Tienen que salir los mismos bits.
// No usa NUnit: lo llaman MathTests.cs (EditMode) y el banco rápido de .NET.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro.Tests
{
    public sealed class MathSuite
    {
        readonly V refs;
        public MathSuite(string json) { refs = Json.parse(json); }

        static double unhex(string h) { return BitConverter.Int64BitsToDouble((long)Convert.ToUInt64(h, 16)); }
        static string hex(double x) { return double.IsNaN(x) ? "7ff8000000000000" : ((ulong)BitConverter.DoubleToInt64Bits(x)).ToString("x16"); }
        static ulong bits(double x) { ulong b = (ulong)BitConverter.DoubleToInt64Bits(x); return double.IsNaN(x) ? b | 0x0008000000000000UL : b; } // (al leerlo, JS vuelve "silencioso" un NaN)

        static double call(string fn, double[] a)
        {
            switch (fn)
            {
                case "sin": return JsMath.sin(a[0]);
                case "cos": return JsMath.cos(a[0]);
                case "exp": return JsMath.exp(a[0]);
                case "log": return JsMath.log(a[0]);
                case "log10": return JsMath.log10(a[0]);
                case "pow": return JsMath.pow(a[0], a[1]);
                case "hypot": return JsMath.hypot(a);
            }
            throw new ArgumentException(fn);
        }

        public IEnumerable<string> functions() { foreach (var k in refs["funcs"].obj.keys()) yield return k; }
        // Diferencias CONOCIDAS con Chrome (no se pueden igualar sin el código de su librería matemática):
        //   · pow en empates exactos o casi exactos entre dos doubles (10 ** 23, 9 ** 17, 0.9999999999999999 ** -1...):
        //     el port da el double más cercano (redondeo al par) y Chrome a veces el otro. El juego no eleva a
        //     potencias que caigan justo en un empate (curvas (1-t)^3, 2^(-10t), 0.0005^dt).
        //   · sin de un número de 10^-307 (Chrome resta un último bit). El juego nunca calcula senos tan pequeños.
        public static readonly HashSet<string> KNOWN = new HashSet<string> {
            "sin 00246934017a9a67",
            "pow 3ff8000000000000 3fd0000000000000", "pow 3fefffffffffffff bff0000000000000", "pow 4024000000000000 4037000000000000",
            "pow 4022000000000000 4031000000000000", "pow c022000000000000 4031000000000000", "pow 419ffffffc000000 4008000000000000",
            "pow 4008000000000000 4041000000000000", "pow 3fc7323280d6c658 4008000000000000", "pow c0015c2a3d84aa88 c010000000000000",
            "pow 401d72265ea309fc c000000000000000", "pow 3e5146211d18e3e6 c0395ace2b1175c2", "pow 4032000000000000 4031000000000000",
        };
        public int known;

        // Devuelve los fallos (vacío si todo sale igual) y cuántos casos se miraron
        public List<string> check(string fn, out int cases)
        {
            var fails = new List<string>();
            cases = 0;
            V f = refs["funcs"][fn];
            foreach (var e in f["edges"])
            {
                var parts = e.str.Split(' ');
                var a = new double[parts.Length - 1];
                for (int i = 0; i < a.Length; i++) a[i] = unhex(parts[i]);
                string got = hex(call(fn, a)), want = parts[parts.Length - 1];
                cases++;
                if (got != want && KNOWN.Contains(fn + " " + string.Join(" ", parts, 0, a.Length))) { known++; continue; }
                if (got != want && fails.Count < 20) fails.Add(fn + "(" + string.Join(", ", parts, 0, a.Length) + ") = " + got + ", Chrome " + want);
            }
            int gi = 0;
            foreach (var g in f["groups"])
            {
                ulong s = Convert.ToUInt64(g["seed"].str, 16);
                Func<ulong> next = () =>
                {
                    s = unchecked(s + 0x9E3779B97F4A7C15UL);
                    ulong z = s;
                    z = unchecked((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL);
                    z = unchecked((z ^ (z >> 27)) * 0x94D049BB133111EBUL);
                    return z ^ (z >> 31);
                };
                var args = g["args"];
                Func<V, double> arg = (k) =>
                {
                    string kind = k["k"].str;
                    if (kind == "const") return unhex(k["lo"].str);
                    ulong r = next();
                    if (kind == "bits") return BitConverter.Int64BitsToDouble((long)r);
                    if (kind == "logb")
                    {
                        ulong blo = Convert.ToUInt64(k["lo"].str, 16), bhi = Convert.ToUInt64(k["hi"].str, 16);
                        ulong b = blo + r % (bhi - blo + 1);
                        if (k["sign"].truthy && (r >> 63) != 0) b |= 1UL << 63;
                        return BitConverter.Int64BitsToDouble((long)b);
                    }
                    double u = (double)(r >> 11) * Math.Pow(2, -53);
                    double lo = unhex(k["lo"].str), hi = unhex(k["hi"].str);
                    if (kind == "lin") return lo + u * (hi - lo);
                    if (kind == "int") return lo + Math.Floor(u * (hi - lo + 1));
                    throw new Exception("tipo " + kind);
                };
                ulong h = 0xCBF29CE484222325UL;
                string outs = g["out"].str;
                int n = g["n"].i;
                for (int i = 0; i < n; i++)
                {
                    var a = new double[args.length.i];
                    for (int j = 0; j < a.Length; j++) a[j] = arg(args[j]);
                    foreach (var x in a) h = unchecked((h ^ bits(x)) * 0x100000001B3UL);
                    string got = hex(call(fn, a)), want = outs.Substring(i * 16, 16);
                    cases++;
                    if (got != want && KNOWN.Contains(fn + " " + string.Join(" ", Array.ConvertAll(a, hex)))) { known++; continue; }
                    if (got != want && fails.Count < 20)
                    {
                        var ins = new List<string>(); foreach (var x in a) ins.Add(hex(x));
                        fails.Add(fn + "(" + string.Join(", ", ins) + ") = " + got + ", Chrome " + want + " (grupo " + gi + ")");
                    }
                }
                if (h.ToString("x16") != g["hash"].str) fails.Add(fn + ": las entradas del grupo " + gi + " no salen iguales que en ref-math.js");
                gi++;
            }
            return fails;
        }
    }
}
