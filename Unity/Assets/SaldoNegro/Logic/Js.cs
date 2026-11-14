// Lo que JavaScript hace con los números y los textos y C# hace distinto.
// Sin esto, el port daría otros píxeles (Math.round) y otros textos (String(0.1 + 0.2), toUpperCase...).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SaldoNegro.Logic
{
    public static partial class JsMath
    {
        public const double PI = Math.PI;

        // Math.round de JS: al entero más cercano y, si está justo en medio, hacia arriba (-2.5 -> -2).
        // (Math.Round de C# redondea los medios al par; Math.Floor(x + 0.5) falla con 0.49999999999999994.)
        public static double round(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return x;
            double f = Math.Floor(x);
            return x - f >= 0.5 ? f + 1 : f;
        }
        public static int roundi(double x) { return (int)round(x); }

        // % de JS: el resto con el signo del dividendo (como fmod)
        // (el % de C# con doubles es el fmod de C, exacto, igual que el de JS)
        public static double mod(double a, double b) { return a % b; }

        public static double sign(double x) { if (double.IsNaN(x)) return double.NaN; return x > 0 ? 1 : x < 0 ? -1 : x; }
        public static double trunc(double x) { return x < 0 ? Math.Ceiling(x) : Math.Floor(x); }
        // Math.max / Math.min de JS: NaN si alguno es NaN; max(-0, 0) = 0
        public static double max(double a, double b) { if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN; if (a == b && a == 0) return (BitConverter.DoubleToInt64Bits(a) < 0) ? b : a; return a > b ? a : b; }
        public static double min(double a, double b) { if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN; if (a == b && a == 0) return (BitConverter.DoubleToInt64Bits(a) < 0) ? a : b; return a < b ? a : b; }
        public static double max(params double[] v) { double r = double.NegativeInfinity; foreach (var x in v) r = max(r, x); return r; }
        public static double min(params double[] v) { double r = double.PositiveInfinity; foreach (var x in v) r = min(r, x); return r; }

        // Math.imul y los operadores de bits de JS (todo pasa a int32)
        public static int toInt32(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return 0;
            double t = trunc(x);
            double m = t - Math.Floor(t / 4294967296.0) * 4294967296.0; // módulo 2^32, positivo
            return unchecked((int)(uint)m);
        }
        public static uint toUint32(double x) { return unchecked((uint)toInt32(x)); }
        public static int imul(int a, int b) { return unchecked(a * b); }

        // Math.random(): no hace falta que coincida con la web (solo efectos y la semilla de cada partida)
        static readonly Random random = new Random();
        // Para comparar con la web: las pruebas ponen aquí un generador con semilla (el mismo que en Chrome)
        public static Func<double> rndOverride;
        public static double rnd() { if (rndOverride != null) return rndOverride(); lock (random) return random.NextDouble(); }
    }

    public static class Js
    {
        // String(x) de JS
        public static string String(V v)
        {
            object o = v.o;
            if (v.isUndefined) return "undefined";
            if (v.isNull) return "null";
            if (v.isNumber) return JsNumber.toString(v.n);
            if (o is string s) return s;
            if (v.isBool) return v.truthy ? "true" : "false";
            if (o is JsArray a) return a.join(",");
            if (o is JsObject) return "[object Object]";
            if (o is JsFn) return "function () { [native code] }";
            return o.ToString();
        }
        public static string String(double d) { return JsNumber.toString(d); }
        public static string numberToString(double x) { return JsNumber.toString(x); }
    }

    // Textos: JS trabaja en unidades UTF-16 (como C#), pero for...of y Array.from recorren puntos de código
    public static class JsString
    {
        public static IEnumerable<string> codePoints(string s)
        {
            for (int i = 0; i < s.Length; i++)
            {
                if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) { yield return s.Substring(i, 2); i++; }
                else yield return s[i].ToString();
            }
        }
        public static JsArray chars(string s) { var a = new JsArray(); foreach (var c in codePoints(s)) a.push(c); return a; }
        public static string sortKey(V v) { return v.str; }

        // toUpperCase / toLowerCase: mapeo de Unicode sin idioma (como JS)
        public static string upper(string s)
        {
            var sb = new StringBuilder(s.Length);
            foreach (char c in s)
            {
                if (c == 'ß') sb.Append("SS");
                else sb.Append(char.ToUpperInvariant(c));
            }
            return sb.ToString();
        }
        public static string lower(string s) { return s.ToLowerInvariant(); }

        public static string repeat(string s, int n) { var sb = new StringBuilder(); for (int i = 0; i < n; i++) sb.Append(s); return sb.ToString(); }
        public static string padStart(string s, int len, string pad = " ")
        {
            if (s.Length >= len || pad.Length == 0) return s;
            var sb = new StringBuilder();
            while (sb.Length < len - s.Length) sb.Append(pad);
            return sb.ToString(0, len - s.Length) + s;
        }
        public static string padEnd(string s, int len, string pad = " ")
        {
            if (s.Length >= len || pad.Length == 0) return s;
            var sb = new StringBuilder(s);
            while (sb.Length < len) sb.Append(pad);
            return sb.ToString(0, len);
        }
        // slice / substring de JS
        public static string slice(string s, int start, int end = int.MaxValue)
        {
            int len = s.Length;
            if (start < 0) start = Math.Max(0, len + start); else start = Math.Min(start, len);
            if (end < 0) end = Math.Max(0, len + end); else end = Math.Min(end, len);
            return end > start ? s.Substring(start, end - start) : "";
        }
        public static string substring(string s, int a, int b = int.MaxValue)
        {
            a = Math.Max(0, Math.Min(a, s.Length)); b = Math.Max(0, Math.Min(b, s.Length));
            if (a > b) { int t = a; a = b; b = t; }
            return s.Substring(a, b - a);
        }
        // trim de JS (espacios de Unicode y saltos)
        public static string trim(string s) { return s.Trim(); }
        // split de JS con separador de texto
        public static JsArray split(string s, string sep)
        {
            var a = new JsArray();
            if (sep == "") { foreach (char c in s) a.push(c.ToString()); return a; }
            int i = 0;
            while (true)
            {
                int j = s.IndexOf(sep, i, StringComparison.Ordinal);
                if (j < 0) { a.push(s.Substring(i)); break; }
                a.push(s.Substring(i, j - i));
                i = j + sep.Length;
            }
            return a;
        }
        public static string replaceAll(string s, string find, string with) { return s.Replace(find, with); }
        public static bool startsWith(string s, string p) { return s.StartsWith(p, StringComparison.Ordinal); }
        public static bool endsWith(string s, string p) { return s.EndsWith(p, StringComparison.Ordinal); }
        public static bool includes(string s, string p) { return s.IndexOf(p, StringComparison.Ordinal) >= 0; }
        public static int indexOf(string s, string p, int from = 0) { return s.IndexOf(p, Math.Min(from, s.Length), StringComparison.Ordinal); }
        public static string fromCharCode(params int[] codes) { var sb = new StringBuilder(); foreach (var c in codes) sb.Append((char)c); return sb.ToString(); }
        public static string fromCodePoint(int cp) { return char.ConvertFromUtf32(cp); }
        public static int codePointAt(string s, int i) { return char.IsSurrogatePair(s, i) ? char.ConvertToUtf32(s, i) : s[i]; }
        public static string ToStr(int v) { return v.ToString(CultureInfo.InvariantCulture); }
    }
}
