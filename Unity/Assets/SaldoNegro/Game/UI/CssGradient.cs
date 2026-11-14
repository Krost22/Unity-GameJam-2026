// background-image con degradados de css/style.css (linear-gradient, repeating-linear-gradient, radial-gradient)
// convertidos en funciones color(x, y) sobre una caja de w x h píxeles, como las calcula el navegador:
//   · la línea de un lineal sale del ángulo y del tamaño de la caja (esquina a esquina);
//   · el radial es una elipse "farthest-corner" con el centro de "at X Y";
//   · las paradas se interpolan premultiplicadas; las posiciones sin valor se reparten a partes iguales;
//   · con repeating, el patrón se repite entre la primera y la última parada.
// Devuelve las capas de arriba abajo (la primera queda encima), como en CSS. Las capas que no entiende se omiten.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace SaldoNegro
{
    public static class CssGradient
    {
        public delegate Color Layer(float x, float y);

        struct Stop { public Color c; public double v; public bool isPx, has; }

        public static List<Layer> layers(string css, float w, float h)
        {
            var o = new List<Layer>();
            foreach (var raw in CssVars.splitTop(css, ','))
            {
                var s = raw.Trim();
                int open = s.IndexOf('(');
                if (open < 0 || !s.EndsWith(")")) continue;
                string fn = s.Substring(0, open).Trim();
                bool rep = fn.StartsWith("repeating-");
                string kind = rep ? fn.Substring(10) : fn;
                var parts = CssVars.splitTop(s.Substring(open + 1, s.Length - open - 2), ',');
                Layer l = null;
                if (kind == "linear-gradient") l = linear(parts, rep, w, h);
                else if (kind == "radial-gradient") l = radial(parts, rep, w, h);
                if (l != null) o.Add(l);
            }
            return o;
        }

        static Layer linear(List<string> parts, bool rep, float w, float h)
        {
            double angle = Math.PI; // 180deg: hacia abajo (valor por defecto)
            int from = 0;
            if (parts.Count > 0 && !isColor(first(parts[0])))
            {
                string d = parts[0].Trim();
                from = 1;
                if (d.EndsWith("deg")) angle = num(d.Substring(0, d.Length - 3)) * Math.PI / 180;
                else if (d == "to top") angle = 0;
                else if (d == "to right") angle = Math.PI / 2;
                else if (d == "to left") angle = 3 * Math.PI / 2;
                else if (d == "to bottom") angle = Math.PI;
                else return null; // dirección que no entiende
            }
            double sin = Math.Sin(angle), cos = Math.Cos(angle);
            double L = Math.Abs(w * sin) + Math.Abs(h * cos); // longitud de la línea del degradado
            if (!stops(parts, from, L, 1, rep, out double[] pos, out Color[] col)) return null;
            double cx = w / 2.0, cy = h / 2.0;
            return (x, y) => eval(pos, col, (x - cx) * sin - (y - cy) * cos + L / 2, rep);
        }

        static Layer radial(List<string> parts, bool rep, float w, float h)
        {
            double cx = w / 2.0, cy = h / 2.0;
            bool circle = false;
            int from = 0;
            if (parts.Count > 0 && !isColor(first(parts[0])))
            {
                string d = parts[0].Trim();
                from = 1;
                if (d.StartsWith("circle")) circle = true;
                int at = d.IndexOf("at ", StringComparison.Ordinal);
                if (at >= 0) center(d.Substring(at + 3), w, h, ref cx, ref cy);
            }
            // radio "farthest-corner": la elipse pasa por la esquina más lejana, con la proporción de los lados
            double fx = Math.Max(cx, w - cx), fy = Math.Max(cy, h - cy);
            double rx = fx * Math.Sqrt(2), ry = fy * Math.Sqrt(2);
            if (circle) rx = ry = Math.Sqrt(fx * fx + fy * fy);
            // (en radiales las posiciones van en unidades del radio: t = 1 es el borde de la elipse)
            if (!stops(parts, from, 1, rx, rep, out double[] pos, out Color[] col)) return null;
            return (x, y) =>
            {
                double dx = (x - cx) / rx, dy = (y - cy) / ry;
                return eval(pos, col, Math.Sqrt(dx * dx + dy * dy), rep);
            };
        }

        // Centro de un radial: "center", "top left", "35% 40%"...
        static void center(string where, float w, float h, ref double cx, ref double cy)
        {
            double? x = null, y = null;
            foreach (var s in where.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (s == "left") x = 0; else if (s == "right") x = w; else if (s == "top") y = 0; else if (s == "bottom") y = h;
                else if (s == "center") { if (x == null) x = w / 2.0; else y = h / 2.0; }
                else if (s.EndsWith("%")) { double v = num(s.TrimEnd('%')) / 100.0; if (x == null) x = w * v; else y = h * v; }
            }
            cx = x ?? w / 2.0; cy = y ?? h / 2.0;
        }

        // Paradas -> posiciones en unidades de la línea: pct * S, px / pxScale. Las sin posición se reparten.
        static bool stops(List<string> parts, int from, double S, double pxScale, bool rep, out double[] pos, out Color[] col)
        {
            pos = null; col = null;
            var ps = new List<Stop>();
            for (int i = from; i < parts.Count; i++)
            {
                var tk = CssVars.splitTop(parts[i].Trim(), ' ');
                if (tk.Count == 0 || !color(tk[0], out Color c)) return false;
                if (tk.Count == 1) ps.Add(new Stop { c = c });
                // dos posiciones en una parada: son dos paradas del mismo color (franja dura)
                for (int k = 1; k < tk.Count && k <= 2; k++)
                {
                    var q = tk[k];
                    if (q.EndsWith("px")) ps.Add(new Stop { c = c, v = num(q.Substring(0, q.Length - 2)) / pxScale, isPx = true, has = true });
                    else if (q.EndsWith("%")) ps.Add(new Stop { c = c, v = num(q.TrimEnd('%')) / 100.0 * S, has = true });
                    else ps.Add(new Stop { c = c, v = num(q) / pxScale, isPx = true, has = true });
                }
            }
            if (ps.Count < 2) return false;
            int n = ps.Count;
            pos = new double[n]; col = new Color[n];
            var has = new bool[n];
            for (int i = 0; i < n; i++) { pos[i] = ps[i].v; has[i] = ps[i].has; col[i] = ps[i].c; }
            if (!has[0]) { pos[0] = 0; has[0] = true; }
            if (!has[n - 1]) { pos[n - 1] = S; has[n - 1] = true; }
            for (int i = 0; i < n; i++)
            {
                if (has[i]) continue;
                int a = i - 1; while (!has[a]) a--;
                int b = i + 1; while (!has[b]) b++;
                pos[i] = pos[a] + (pos[b] - pos[a]) * (i - a) / (b - a);
                has[i] = true;
            }
            for (int i = 1; i < n; i++) if (pos[i] < pos[i - 1]) pos[i] = pos[i - 1];
            return true;
        }

        static Color eval(double[] pos, Color[] col, double p, bool rep)
        {
            int n = pos.Length;
            if (rep && pos[n - 1] > pos[0])
            {
                double per = pos[n - 1] - pos[0];
                p = pos[0] + ((p - pos[0]) % per + per) % per;
            }
            if (p <= pos[0]) return col[0];
            if (p >= pos[n - 1]) return col[n - 1];
            for (int i = 0; i < n - 1; i++)
            {
                if (p < pos[i + 1])
                {
                    double d = pos[i + 1] - pos[i];
                    float k = d <= 0 ? 0f : (float)((p - pos[i]) / d);
                    return mix(col[i], col[i + 1], k);
                }
            }
            return col[n - 1];
        }

        // Interpolación premultiplicada (como el navegador)
        static Color mix(Color a, Color b, float k)
        {
            float al = a.a + (b.a - a.a) * k;
            if (al <= 0) return new Color(0, 0, 0, 0);
            float r = (a.r * a.a * (1 - k) + b.r * b.a * k) / al;
            float g = (a.g * a.a * (1 - k) + b.g * b.a * k) / al;
            float bl = (a.b * a.a * (1 - k) + b.b * b.a * k) / al;
            return new Color(r, g, bl, al);
        }

        static string first(string part)
        {
            var t = CssVars.splitTop(part.Trim(), ' ');
            return t.Count > 0 ? t[0] : "";
        }

        static bool isColor(string s) { return color(s, out _); }

        static double num(string s)
        {
            return double.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out double d) ? d : 0;
        }

        // #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), transparent, white, black
        static bool color(string s, out Color c)
        {
            c = default;
            s = s.Trim();
            if (s == "transparent") { c = new Color(0, 0, 0, 0); return true; }
            if (s == "white") { c = Color.white; return true; }
            if (s == "black") { c = Color.black; return true; }
            if (s.StartsWith("#"))
            {
                string h = s.Substring(1);
                if (h.Length == 3 || h.Length == 4)
                {
                    var e = new StringBuilder();
                    foreach (char ch in h) e.Append(ch).Append(ch);
                    h = e.ToString();
                }
                if (h.Length != 6 && h.Length != 8) return false;
                int r = Convert.ToInt32(h.Substring(0, 2), 16), g = Convert.ToInt32(h.Substring(2, 2), 16), b = Convert.ToInt32(h.Substring(4, 2), 16);
                int a = h.Length == 8 ? Convert.ToInt32(h.Substring(6, 2), 16) : 255;
                c = new Color(r / 255f, g / 255f, b / 255f, a / 255f);
                return true;
            }
            if (s.StartsWith("rgb"))
            {
                int o = s.IndexOf('('), e = s.LastIndexOf(')');
                if (o < 0 || e < o) return false;
                var p = s.Substring(o + 1, e - o - 1).Split(new[] { ',', ' ', '/' }, StringSplitOptions.RemoveEmptyEntries);
                if (p.Length < 3) return false;
                float r = (float)num(p[0]) / 255f, g = (float)num(p[1]) / 255f, b = (float)num(p[2]) / 255f;
                float a = p.Length > 3 ? (float)num(p[3]) : 1f;
                c = new Color(r, g, b, a);
                return true;
            }
            return false;
        }
    }
}
