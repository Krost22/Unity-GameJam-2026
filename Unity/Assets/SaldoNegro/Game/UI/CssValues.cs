// Valores CSS que USS no lee y que el reflejo necesita para animar (Game/UI/CssAnimator.cs), sin nada de Unity:
//   · Lin: una longitud o un tiempo (px, %, deg, s, número) y calc() con + - * / (lo que usa el juego: calc(var(--i) * -.2s));
//   · Tf: la lista de transformaciones (translate, scale, rotate...) reducida a su forma canónica (traslación, escala,
//     giro), en el orden de UI Toolkit (traslación, giro, escala), que es el del navegador para estas funciones;
//   · Easing: ease, linear, ease-in, ease-out, ease-in-out, step-start, step-end, steps(n, salto) y cubic-bezier();
//   · AnimSpec / TransSpec: las abreviaturas de animation y transition, como las lee el navegador.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace SaldoNegro
{
    // Combinación lineal de unidades: px + pct% + deg + s + número. (Un % se resuelve con el tamaño del elemento.)
    public struct Lin
    {
        public double px, pct, deg, sec, num;

        public static Lin Number(double v) { return new Lin { num = v }; }
        public static Lin operator +(Lin a, Lin b) { return new Lin { px = a.px + b.px, pct = a.pct + b.pct, deg = a.deg + b.deg, sec = a.sec + b.sec, num = a.num + b.num }; }
        public static Lin operator -(Lin a, Lin b) { return new Lin { px = a.px - b.px, pct = a.pct - b.pct, deg = a.deg - b.deg, sec = a.sec - b.sec, num = a.num - b.num }; }
        public static Lin operator *(Lin a, double k) { return new Lin { px = a.px * k, pct = a.pct * k, deg = a.deg * k, sec = a.sec * k, num = a.num * k }; }
        public Lin Lerp(Lin b, double k) { return this * (1 - k) + b * k; }
        public bool IsNumber { get { return px == 0 && pct == 0 && deg == 0 && sec == 0; } }
        // Píxeles, con los % sobre `size`
        public double Px(double size) { return px + pct * size / 100.0; }
    }

    // Transformación canónica: traslación (Lin, para poder llevar %), escala y giro en grados
    public struct Tf
    {
        public Lin tx, ty;
        public double sx, sy, rot;

        public static Tf Identity { get { return new Tf { sx = 1, sy = 1 }; } }
        public bool IsIdentity { get { return tx.px == 0 && tx.pct == 0 && ty.px == 0 && ty.pct == 0 && sx == 1 && sy == 1 && rot == 0; } }
        public static Tf Lerp(Tf a, Tf b, double k)
        {
            return new Tf
            {
                tx = a.tx.Lerp(b.tx, k), ty = a.ty.Lerp(b.ty, k),
                sx = a.sx + (b.sx - a.sx) * k, sy = a.sy + (b.sy - a.sy) * k, rot = a.rot + (b.rot - a.rot) * k,
            };
        }
        public static bool Same(Tf a, Tf b)
        {
            return Same(a.tx, b.tx) && Same(a.ty, b.ty) && a.sx == b.sx && a.sy == b.sy && a.rot == b.rot;
        }
        public static bool Same(Lin a, Lin b) { return a.px == b.px && a.pct == b.pct && a.deg == b.deg && a.sec == b.sec && a.num == b.num; }
    }

    // Analizador de longitudes y tiempos (con calc() y var() ya resueltos por quien llama)
    public static class CssLin
    {
        public static bool TryParse(string s, out Lin v)
        {
            v = default(Lin);
            if (string.IsNullOrEmpty(s)) return false;
            var p = new Parser { s = s.Trim() };
            try
            {
                v = p.Expr();
                p.Skip();
                return p.i == p.s.Length;
            }
            catch (FormatException) { return false; }
        }

        sealed class Parser
        {
            public string s;
            public int i;

            public void Skip() { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }

            public Lin Expr()
            {
                Lin a = Term();
                while (true)
                {
                    Skip();
                    if (i < s.Length && (s[i] == '+' || s[i] == '-')) { char op = s[i++]; Lin b = Term(); a = op == '+' ? a + b : a - b; }
                    else return a;
                }
            }

            Lin Term()
            {
                Lin a = Factor();
                while (true)
                {
                    Skip();
                    if (i < s.Length && s[i] == '*')
                    {
                        i++; Lin b = Factor();
                        if (a.IsNumber) a = b * a.num; else if (b.IsNumber) a = a * b.num; else throw new FormatException();
                    }
                    else if (i < s.Length && s[i] == '/')
                    {
                        i++; Lin b = Factor();
                        if (!b.IsNumber || b.num == 0) throw new FormatException();
                        a = a * (1 / b.num);
                    }
                    else return a;
                }
            }

            Lin Factor()
            {
                Skip();
                if (i >= s.Length) throw new FormatException();
                char c = s[i];
                if (c == '(') { i++; Lin e = Expr(); Close(); return e; }
                if (c == '-') { i++; return Factor() * -1; }
                if (c == '+') { i++; return Factor(); }
                if (char.IsLetter(c))
                {
                    int st = i;
                    while (i < s.Length && (char.IsLetter(s[i]) || s[i] == '-')) i++;
                    string word = s.Substring(st, i - st);
                    if (word != "calc" || i >= s.Length || s[i] != '(') throw new FormatException();
                    i++; Lin e = Expr(); Close(); return e;
                }
                return Number();
            }

            void Close() { Skip(); if (i >= s.Length || s[i] != ')') throw new FormatException(); i++; }

            Lin Number()
            {
                int st = i;
                while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '.')) i++;
                if (i == st) throw new FormatException();
                string num = s.Substring(st, i - st);
                if (!double.TryParse(num, NumberStyles.Float, CultureInfo.InvariantCulture, out double d)) throw new FormatException();
                int us = i;
                while (i < s.Length && (char.IsLetter(s[i]) || s[i] == '%')) i++;
                string unit = s.Substring(us, i - us).ToLowerInvariant();
                switch (unit)
                {
                    case "": return Lin.Number(d);
                    case "px": return new Lin { px = d };
                    case "%": return new Lin { pct = d };
                    case "deg": return new Lin { deg = d };
                    case "s": return new Lin { sec = d };
                    case "ms": return new Lin { sec = d / 1000.0 };
                    default: throw new FormatException();
                }
            }
        }

        // Parte por un separador que no esté dentro de paréntesis
        public static List<string> SplitTop(string s, char sep)
        {
            var o = new List<string>();
            int depth = 0, st = 0;
            for (int k = 0; k < s.Length; k++)
            {
                if (s[k] == '(') depth++;
                else if (s[k] == ')') depth--;
                else if (depth == 0 && (sep == ',' ? s[k] == ',' : char.IsWhiteSpace(s[k])))
                {
                    if (k > st) o.Add(s.Substring(st, k - st));
                    st = k + 1;
                }
            }
            if (s.Length > st) o.Add(s.Substring(st));
            return o;
        }
    }

    // transform: "translate(-50%, -50%) scale(var(--k, 2))" (var() ya resuelto)
    public static class CssXf
    {
        public static bool TryParse(string s, out Tf t)
        {
            t = Tf.Identity;
            if (s == null) return false;
            s = s.Trim();
            if (s == "" || s == "none") return true;
            int i = 0;
            while (i < s.Length)
            {
                while (i < s.Length && char.IsWhiteSpace(s[i])) i++;
                if (i >= s.Length) break;
                int open = s.IndexOf('(', i);
                if (open < 0) return false;
                string fn = s.Substring(i, open - i).Trim();
                int depth = 0, close = -1;
                for (int k = open; k < s.Length; k++)
                {
                    if (s[k] == '(') depth++;
                    else if (s[k] == ')') { depth--; if (depth == 0) { close = k; break; } }
                }
                if (close < 0) return false;
                var args = CssLin.SplitTop(s.Substring(open + 1, close - open - 1), ',');
                for (int k = 0; k < args.Count; k++) args[k] = args[k].Trim();
                if (!Apply(fn, args, ref t)) return false;
                i = close + 1;
            }
            return true;
        }

        static bool Apply(string fn, List<string> a, ref Tf t)
        {
            Lin x, y;
            switch (fn)
            {
                case "translate":
                case "translate3d":
                    if (a.Count < 1 || a.Count > 3 || !CssLin.TryParse(a[0], out x)) return false;
                    if (a.Count >= 2) { if (!CssLin.TryParse(a[1], out y)) return false; } else y = default(Lin);
                    t.tx = t.tx + x; t.ty = t.ty + y;
                    return true;
                case "translateX": if (a.Count != 1 || !CssLin.TryParse(a[0], out x)) return false; t.tx = t.tx + x; return true;
                case "translateY": if (a.Count != 1 || !CssLin.TryParse(a[0], out y)) return false; t.ty = t.ty + y; return true;
                case "scale":
                case "scale3d":
                    {
                        if (a.Count < 1 || a.Count > 3 || !CssLin.TryParse(a[0], out x) || !x.IsNumber) return false;
                        double sy = x.num;
                        if (a.Count >= 2) { if (!CssLin.TryParse(a[1], out y) || !y.IsNumber) return false; sy = y.num; }
                        t.sx *= x.num; t.sy *= sy;
                        return true;
                    }
                case "scaleX": if (a.Count != 1 || !CssLin.TryParse(a[0], out x) || !x.IsNumber) return false; t.sx *= x.num; return true;
                case "scaleY": if (a.Count != 1 || !CssLin.TryParse(a[0], out y) || !y.IsNumber) return false; t.sy *= y.num; return true;
                case "rotate":
                    if (a.Count != 1 || !CssLin.TryParse(a[0], out x)) return false;
                    if (x.IsNumber && x.num != 0) return false;
                    t.rot += x.deg + x.num;
                    return true;
                default: return false;
            }
        }
    }

    // Función de temporización: se aplica dentro de cada intervalo entre dos fotogramas clave
    public struct Easing
    {
        public enum Kind { Bezier, Steps }
        public Kind kind;
        public double x1, y1, x2, y2;     // cubic-bezier
        public int steps;                 // steps(n, ...)
        public bool jumpStart, jumpEnd;   // posición del salto (por defecto jump-end)

        public static Easing Parse(string s)
        {
            s = (s ?? "").Trim().ToLowerInvariant();
            switch (s)
            {
                case "": case "ease": return Bez(.25, .1, .25, 1);
                case "linear": return Bez(0, 0, 1, 1);
                case "ease-in": return Bez(.42, 0, 1, 1);
                case "ease-out": return Bez(0, 0, .58, 1);
                case "ease-in-out": return Bez(.42, 0, .58, 1);
                case "step-start": return Stp(1, true, false);
                case "step-end": return Stp(1, false, true);
            }
            if (s.StartsWith("cubic-bezier(") && s.EndsWith(")"))
            {
                var p = CssLin.SplitTop(s.Substring(13, s.Length - 14), ',');
                if (p.Count == 4)
                {
                    var v = new double[4];
                    for (int k = 0; k < 4; k++) if (!double.TryParse(p[k].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out v[k])) return Bez(.25, .1, .25, 1);
                    return Bez(v[0], v[1], v[2], v[3]);
                }
            }
            if (s.StartsWith("steps(") && s.EndsWith(")"))
            {
                var p = CssLin.SplitTop(s.Substring(6, s.Length - 7), ',');
                if (p.Count >= 1 && int.TryParse(p[0].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) && n >= 1)
                {
                    string pos = p.Count > 1 ? p[1].Trim() : "jump-end";
                    bool st = pos == "jump-start" || pos == "start";
                    bool en = pos == "jump-end" || pos == "end" || pos == "jump-none" || pos == "jump-both";
                    return Stp(n, st, en, pos);
                }
            }
            return Bez(.25, .1, .25, 1);
        }

        static Easing Bez(double a, double b, double c, double d) { return new Easing { kind = Kind.Bezier, x1 = a, y1 = b, x2 = c, y2 = d }; }
        static Easing Stp(int n, bool start, bool end, string pos = null)
        {
            var e = new Easing { kind = Kind.Steps, steps = n, jumpStart = start, jumpEnd = end };
            e.none = pos == "jump-none"; e.both = pos == "jump-both";
            return e;
        }
        bool none, both;

        // Progreso de salida para un progreso de entrada t (0..1)
        public double Apply(double t)
        {
            if (kind == Kind.Steps)
            {
                if (t >= 1) return 1;
                // (la especificación: jump-start y jump-both suman un salto al principio; jump-none quita uno)
                double cur = Math.Floor(t * steps) + ((jumpStart || both) ? 1 : 0);
                return Math.Min(1, Math.Max(0, cur / Jumps()));
            }
            if (t <= 0) return 0;
            if (t >= 1) return 1;
            // cubic-bezier: buscar s con x(s) = t (bisección) y devolver y(s)
            double lo = 0, hi = 1, sm = t;
            for (int k = 0; k < 60; k++)
            {
                sm = (lo + hi) / 2;
                if (Bz(x1, x2, sm) < t) lo = sm; else hi = sm;
            }
            return Bz(y1, y2, sm);
        }

        double Jumps()
        {
            if (none) return steps - 1;
            if (both) return steps + 1;
            return steps;
        }

        static double Bz(double p1, double p2, double s)
        {
            double u = 1 - s;
            return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s;
        }
    }

    // Una animación (abreviatura de animation: nombre, duración, temporización, retraso, iteraciones, dirección, relleno)
    public sealed class AnimSpec
    {
        public string name;
        public double duration;        // s
        public Easing easing;
        public double delay;           // s
        public double iterations = 1;  // double.PositiveInfinity = infinite
        public string direction = "normal";
        public bool fillForwards, fillBackwards;

        // Una lista separada por comas ("a .5s, b 1s infinite"). Devuelve vacío para "none".
        public static List<AnimSpec> ParseList(string s)
        {
            var o = new List<AnimSpec>();
            if (string.IsNullOrWhiteSpace(s)) return o;
            foreach (var group in CssLin.SplitTop(s, ','))
            {
                var g = group.Trim();
                if (g == "" || g == "none") continue;
                var a = Parse(g);
                if (a != null) o.Add(a);
            }
            return o;
        }

        static AnimSpec Parse(string g)
        {
            var a = new AnimSpec { easing = Easing.Parse("ease") };
            bool timeSeen = false;
            foreach (var tok0 in CssLin.SplitTop(g, ' '))
            {
                string tok = tok0.Trim(), low = tok.ToLowerInvariant();
                if (tok == "") continue;
                if (low == "normal" || low == "reverse" || low == "alternate" || low == "alternate-reverse") { a.direction = low; continue; }
                if (low == "forwards") { a.fillForwards = true; continue; }
                if (low == "backwards") { a.fillBackwards = true; continue; }
                if (low == "both") { a.fillForwards = a.fillBackwards = true; continue; }
                if (low == "none" || low == "running" || low == "paused") continue;
                if (low == "infinite") { a.iterations = double.PositiveInfinity; continue; }
                if (double.TryParse(low, NumberStyles.Float, CultureInfo.InvariantCulture, out double n)) { a.iterations = n; continue; }
                if (IsTime(low, out double secs))
                {
                    if (!timeSeen) { a.duration = secs; timeSeen = true; } else a.delay = secs;
                    continue;
                }
                if (low.StartsWith("steps(") || low.StartsWith("cubic-bezier(") || low == "ease" || low == "linear" || low == "ease-in" || low == "ease-out" || low == "ease-in-out" || low == "step-start" || low == "step-end")
                {
                    a.easing = Easing.Parse(tok); continue;
                }
                a.name = tok; // identificador: el nombre de la @keyframes
            }
            return a.name == null ? null : a;
        }

        // Un tiempo ("1.5s", "800ms", "0s"): segundos
        public static bool IsTime(string low, out double secs)
        {
            secs = 0;
            if (!low.EndsWith("s") || !CssLin.TryParse(low, out Lin t)) return false;
            if (t.px != 0 || t.pct != 0 || t.deg != 0 || t.num != 0) return false;
            secs = t.sec;
            return true;
        }
    }

    // Una transición (abreviatura de transition: propiedad, duración, temporización, retraso)
    public sealed class TransSpec
    {
        public string prop;
        public double duration;
        public Easing easing;
        public double delay;

        public static List<TransSpec> ParseList(string s)
        {
            var o = new List<TransSpec>();
            if (string.IsNullOrWhiteSpace(s)) return o;
            foreach (var group in CssLin.SplitTop(s, ','))
            {
                var t = new TransSpec { easing = Easing.Parse("ease") };
                bool timeSeen = false;
                foreach (var tok0 in CssLin.SplitTop(group.Trim(), ' '))
                {
                    string tok = tok0.Trim(), low = tok.ToLowerInvariant();
                    if (tok == "") continue;
                    if (AnimSpec.IsTime(low, out double secs))
                    {
                        if (!timeSeen) { t.duration = secs; timeSeen = true; } else t.delay = secs;
                        continue;
                    }
                    if (low.StartsWith("steps(") || low.StartsWith("cubic-bezier(") || low == "ease" || low == "linear" || low == "ease-in" || low == "ease-out" || low == "ease-in-out") { t.easing = Easing.Parse(tok); continue; }
                    t.prop = low;
                }
                if (t.prop != null) o.Add(t);
            }
            return o;
        }
    }
}
