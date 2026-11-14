// Port de js/render/pixkit.js (SN.PK): kit de pixel art: máscaras (polígonos, elipses, cápsulas), sprites que
// sombrean cada parte según la luz y le ponen contorno selectivo, mezcla de colores y trama de Bayer.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public static class PK
    {
        // "#RRGGBB" -> [r, g, b]
        public static int[] hexRGB(string c)
        {
            return new[] { Convert.ToInt32(c.Substring(1, 2), 16), Convert.ToInt32(c.Substring(3, 2), 16), Convert.ToInt32(c.Substring(5, 2), 16) };
        }

        // Uint8ClampedArray: recorta a 0..255 y redondea al más cercano (empate al par)
        internal static byte U8(double v)
        {
            if (!(v > 0)) return 0;
            if (v >= 255) return 255;
            return (byte)Math.Round(v, MidpointRounding.ToEven);
        }

        // ---------- Máscaras ----------
        public sealed class Mask
        {
            public readonly int w, h;
            public readonly byte[] d;
            public struct Box { public int x, y, w, h; }

            public Mask(int w, int h) { this.w = w; this.h = h; d = new byte[w * h]; }
            public int get(int x, int y) { return x >= 0 && y >= 0 && x < w && y < h ? d[y * w + x] : 0; }
            public void set(int x, int y, int v = 1) { if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = (byte)v; }

            // Polígono relleno (regla par-impar, muestreo en el centro del píxel: bordes nítidos)
            public Mask poly((double x, double y)[] pts, int v = 1)
            {
                double y0 = double.PositiveInfinity, y1 = double.NegativeInfinity;
                foreach (var p in pts) { y0 = Math.Min(y0, p.y); y1 = Math.Max(y1, p.y); }
                int yEnd = (int)Math.Min(h - 1, Math.Ceiling(y1));
                for (int y = (int)Math.Max(0, Math.Floor(y0)); y <= yEnd; y++)
                {
                    double sy = y + 0.5;
                    var xs = new List<double>();
                    for (int i = 0; i < pts.Length; i++)
                    {
                        var a = pts[i]; var b = pts[(i + 1) % pts.Length];
                        if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) xs.Add(a.x + (sy - a.y) / (b.y - a.y) * (b.x - a.x));
                    }
                    xs.Sort();
                    for (int k = 0; k + 1 < xs.Count; k += 2)
                    {
                        int xEnd = (int)Math.Min(w - 1, Math.Floor(xs[k + 1] - 0.5));
                        for (int x = (int)Math.Max(0, Math.Ceiling(xs[k] - 0.5)); x <= xEnd; x++) d[y * w + x] = (byte)v;
                    }
                }
                return this;
            }

            public Mask ellipse(double cx, double cy, double rx, double ry, int v = 1)
            {
                for (int y = (int)Math.Floor(cy - ry); y <= Math.Ceiling(cy + ry); y++)
                {
                    for (int x = (int)Math.Floor(cx - rx); x <= Math.Ceiling(cx + rx); x++)
                    {
                        double dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                        if (dx * dx + dy * dy <= 1) set(x, y, v);
                    }
                }
                return this;
            }

            public Mask rect(int x, int y, int rw, int rh, int v = 1)
            {
                for (int j = 0; j < rh; j++) for (int i = 0; i < rw; i++) set(x + i, y + j, v);
                return this;
            }

            // Trazo grueso entre dos puntos (brazos, mangas, tallos)
            public Mask capsule(double x0, double y0, double x1, double y1, double r, int v = 1)
            {
                int minx = (int)Math.Floor(Math.Min(x0, x1) - r), maxx = (int)Math.Ceiling(Math.Max(x0, x1) + r);
                int miny = (int)Math.Floor(Math.Min(y0, y1) - r), maxy = (int)Math.Ceiling(Math.Max(y0, y1) + r);
                double dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
                if (len2 == 0 || double.IsNaN(len2)) len2 = 1; // JS: `|| 1`
                for (int y = miny; y <= maxy; y++)
                {
                    for (int x = minx; x <= maxx; x++)
                    {
                        double px = x + 0.5, py = y + 0.5;
                        double t = Math.Max(0, Math.Min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
                        double qx = x0 + dx * t - px, qy = y0 + dy * t - py;
                        if (qx * qx + qy * qy <= r * r) set(x, y, v);
                    }
                }
                return this;
            }

            // Cápsula que cambia de grosor (antebrazo que se estrecha hacia la muñeca)
            public Mask taper(double x0, double y0, double r0, double x1, double y1, double r1, int v = 1)
            {
                int steps = (int)Math.Ceiling(JsMath.hypot(x1 - x0, y1 - y0)) * 2 + 1;
                for (int i = 0; i <= steps; i++)
                {
                    double k = (double)i / steps;
                    double r = r0 + (r1 - r0) * k;
                    ellipse(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r, r, v);
                }
                return this;
            }

            // Rectángulo que ocupa (con margen) o null si está vacía
            public Box? bbox(int pad = 0)
            {
                int x0 = int.MaxValue, y0 = int.MaxValue, x1 = -1, y1 = -1;
                for (int y = 0; y < h; y++)
                {
                    for (int x = 0; x < w; x++)
                    {
                        if (d[y * w + x] == 0) continue;
                        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
                    }
                }
                if (x1 < 0) return null;
                x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad);
                x1 = Math.Min(w - 1, x1 + pad); y1 = Math.Min(h - 1, y1 + pad);
                return new Box { x = x0, y = y0, w = x1 - x0 + 1, h = y1 - y0 + 1 };
            }

            public Mask clear(Mask other)
            {
                for (int i = 0; i < d.Length; i++) if (other.d[i] != 0) d[i] = 0;
                return this;
            }

            public Mask keep(Mask other)
            {
                for (int i = 0; i < d.Length; i++) if (other.d[i] == 0) d[i] = 0;
                return this;
            }
        }

        // ---------- Sprite: lienzo donde se van apilando partes ----------
        public sealed class Sprite
        {
            public readonly int w, h;
            public readonly Canvas canvas;
            public readonly Ctx2D g;

            public Sprite(int w, int h)
            {
                this.w = w; this.h = h;
                canvas = Px.canvas(w, h);
                g = Px.ctx(canvas);
            }

            public Mask mask() { return new Mask(w, h); }

            // Pinta una máscara con su rampa [más oscuro ... más claro] y luz direccional.
            // light = [lx, ly] (de dónde viene la luz), hi/lit/sh = grosor de brillo, luz y sombra,
            // outline (contorno), inner (el contorno se calcula pero no se pinta: outline === 'inner' en JS),
            // cast (sombra arrojada sobre lo que hay debajo), flat (sin sombreado), baseIdx = opts.base
            public Sprite part(Mask m, string[] ramp, int[] light = null, int hi = 1, int lit = 3, int sh = 2,
                bool outline = true, bool inner = false, int cast = 0, bool flat = false, bool dither = true,
                bool deep = true, int? baseIdx = null)
            {
                light = light ?? new[] { 1, -1 };
                var bb = m.bbox(Math.Max(cast, 1) + 1);
                if (bb == null) return this;
                var b = bb.Value;
                var tmp = g.getImageData(b.x, b.y, b.w, b.h);
                var outp = tmp.data;
                int bw = b.w, bh = b.h, ox = b.x, oy = b.y;
                int M(int x, int y) { return m.get(x + ox, y + oy); }
                var cols = new int[ramp.Length][];
                for (int i = 0; i < ramp.Length; i++) cols[i] = PK.hexRGB(ramp[i]);
                int n = cols.Length;
                int baseK = Math.Min(n - 1, Math.Max(0, baseIdx ?? (n - 1) / 2));
                int lx = Math.Sign(light[0]), ly = Math.Sign(light[1]);
                int maxD = Math.Max(hi, Math.Max(lit, sh)) + 2; // si el tope coincide con el grosor, todo el interior se tramaría
                int Dist(int x, int y, int sx, int sy, int max)
                {
                    int dd = 0;
                    while (dd < max && M(x + sx * (dd + 1), y + sy * (dd + 1)) != 0) dd++;
                    return dd;
                }

                // Sombra arrojada: oscurece lo que hay debajo y a la sombra de la pieza
                if (cast != 0)
                {
                    for (int y = 0; y < bh; y++)
                    {
                        for (int x = 0; x < bw; x++)
                        {
                            if (M(x, y) != 0) continue;
                            bool hit = false;
                            for (int k = 1; k <= cast && !hit; k++) if (M(x + lx * k, y + ly * k) != 0) hit = true;
                            if (!hit) continue;
                            int i = (y * bw + x) * 4;
                            if (outp[i + 3] == 0) continue;
                            outp[i] = PK.U8(outp[i] * 0.62);
                            outp[i + 1] = PK.U8(outp[i + 1] * 0.55);
                            outp[i + 2] = PK.U8(Math.Min(255, outp[i + 2] * 0.72 + 10));
                        }
                    }
                }

                for (int y = 0; y < bh; y++)
                {
                    for (int x = 0; x < bw; x++)
                    {
                        if (M(x, y) == 0) continue;
                        int k = baseK;
                        if (!flat)
                        {
                            int dL = Dist(x, y, lx, ly, maxD), dS = Dist(x, y, -lx, -ly, maxD), dB = Dist(x, y, 0, 1, 4);
                            if (dL < hi) k = n - 1;
                            else if (dL < lit || (dither && dL == lit && (x + y) % 2 == 0)) k = Math.Min(n - 1, baseK + 1);
                            if (dS < sh || (dither && dS == sh && (x + y) % 2 == 0)) k = Math.Max(0, baseK - 1);
                            if (deep && dS < 1 && dB < 2) k = 0;
                        }
                        var c = cols[k];
                        int i = (y * bw + x) * 4;
                        outp[i] = (byte)c[0]; outp[i + 1] = (byte)c[1]; outp[i + 2] = (byte)c[2]; outp[i + 3] = 255;
                    }
                }

                // Contorno selectivo alrededor de esta pieza
                if (outline)
                {
                    var add = new List<(int x, int y, double r, double gg, double bb)>();
                    for (int y = 0; y < bh; y++)
                    {
                        for (int x = 0; x < bw; x++)
                        {
                            if (M(x, y) != 0) continue;
                            int nbx, nby;
                            if (M(x - 1, y) != 0) { nbx = x - 1; nby = y; }
                            else if (M(x + 1, y) != 0) { nbx = x + 1; nby = y; }
                            else if (M(x, y - 1) != 0) { nbx = x; nby = y - 1; }
                            else if (M(x, y + 1) != 0) { nbx = x; nby = y + 1; }
                            else continue;
                            // Del lado de la luz el contorno es más claro
                            bool litSide = (lx != 0 && Math.Sign(x - nbx) == lx) || (ly != 0 && Math.Sign(y - nby) == ly);
                            var c = cols[litSide ? Math.Min(1, n - 1) : 0];
                            double f = litSide ? 0.78 : 0.55;
                            add.Add((x, y, c[0] * f, c[1] * f * 0.92, Math.Min(255, c[2] * f + 14)));
                        }
                    }
                    if (!inner)
                    {
                        foreach (var a in add)
                        {
                            int i = (a.y * bw + a.x) * 4;
                            outp[i] = PK.U8(a.r); outp[i + 1] = PK.U8(a.gg); outp[i + 2] = PK.U8(a.bb); outp[i + 3] = 255;
                        }
                    }
                }
                g.putImageData(tmp, ox, oy);
                return this;
            }

            // Luz de borde (contraluz): pinta los píxeles de la máscara cuyo vecino hacia (dx,dy) está vacío
            public Sprite rim(Mask m, string color, int dx = -1, int dy = -1, int width = 1)
            {
                var bb = m.bbox(1);
                if (bb == null) return this;
                var b = bb.Value;
                g.fillStyle = color;
                for (int y = b.y; y < b.y + b.h; y++)
                {
                    for (int x = b.x; x < b.x + b.w; x++)
                    {
                        if (m.get(x, y) == 0) continue;
                        bool edge = false;
                        for (int k = 1; k <= width && !edge; k++) if (m.get(x + dx * k, y + dy * k) == 0) edge = true;
                        if (edge) g.fillRect(x, y, 1, 1);
                    }
                }
                return this;
            }

            // Detalle a mano: filas de texto, una letra = un color de pal ('.' transparente)
            public Sprite stamp(IList<string> rows, int x, int y, IDictionary<char, string> pal, bool flip = false)
            {
                for (int j = 0; j < rows.Count; j++)
                {
                    string row = rows[j];
                    for (int i = 0; i < row.Length; i++)
                    {
                        char ch = row[flip ? row.Length - 1 - i : i];
                        if (ch == '.' || ch == ' ' || !pal.TryGetValue(ch, out var col) || string.IsNullOrEmpty(col)) continue;
                        g.fillStyle = col;
                        g.fillRect(x + i, y + j, 1, 1);
                    }
                }
                return this;
            }

            public Sprite px(int x, int y, string col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); return this; }
            public Sprite rect(int x, int y, int rw, int rh, string col) { g.fillStyle = col; g.fillRect(x, y, rw, rh); return this; }
            public Sprite line(double x0, double y0, double x1, double y1, string col, double lw = 1) { Px.line(g, x0, y0, x1, y1, col, lw); return this; }
        }

        // Mezcla dos colores hex (k = 0 -> a, 1 -> b)
        public static string mix(string a, string b, double k)
        {
            var A = hexRGB(a); var B = hexRGB(b);
            return "#" + hex2(A[0] + (B[0] - A[0]) * k) + hex2(A[1] + (B[1] - A[1]) * k) + hex2(A[2] + (B[2] - A[2]) * k);
        }

        // Math.round(v).toString(16) con relleno a dos dígitos
        static string hex2(double v)
        {
            double r = JsMath.round(v);
            string s = (r < 0 ? "-" : "") + Math.Abs((long)r).ToString("x");
            return JsString.padStart(s, 2, "0");
        }

        // Trama de Bayer 4x4 (para luces y degradados sin desenfoque)
        static readonly int[] BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        public static double bayer(int x, int y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
    }
}
