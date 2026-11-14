// Port de js/render/pixel.js (SN.Px): utilidades de dibujo pixel art: rectángulos, líneas sin suavizado, elipses
// por filas, texto con la fuente pixel y sprites definidos como texto.
// Las opciones que en JS van en un objeto ({ size, align, outline }) aquí son parámetros con nombre:
//   Px.text(g, "Hola", 10, 20, P.cream, size: 16, align: "center")
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public static class Px
    {
        // Letras de los sprites en texto -> color
        public static readonly Dictionary<char, string> KEY = new Dictionary<char, string>
        {
            { 'k', PAL.coal }, { 'K', PAL.coalD }, { 'l', PAL.coalL }, { 'm', PAL.cream }, { 'w', PAL.creamL }, { 'n', PAL.creamM }, { 'd', PAL.creamD }, { 'D', PAL.creamDD },
            { 'g', PAL.green }, { 'G', PAL.greenD }, { 'h', PAL.greenL }, { 'y', PAL.yellow }, { 'Y', PAL.yellowD }, { 'u', PAL.yellowL }, { 'U', PAL.yellowDD },
            { 'r', PAL.coral }, { 'R', PAL.coralD }, { 'p', PAL.coralL }, { 'c', PAL.cyan }, { 'C', PAL.cyanD }, { 'b', PAL.cyanL },
            { 'o', PAL.orange }, { 'O', PAL.orangeD }, { 'q', PAL.orangeL }, { 's', PAL.skin }, { 'S', PAL.skinM }, { 'z', PAL.skinD }, { 'Z', PAL.skinDD },
            { 'x', "#FFFFFF" },
        };

        public static Canvas canvas(int w, int h) { return new Canvas(w, h); }
        public static Canvas canvas(double w, double h) { return new Canvas((int)w, (int)h); }

        public static Ctx2D ctx(Canvas canvas)
        {
            var g = canvas.getContext();
            g.imageSmoothingEnabled = false;
            return g;
        }

        public static void rect(Ctx2D g, double x, double y, double w, double h, string color)
        {
            g.fillStyle = color;
            g.fillRect(JsMath.round(x), JsMath.round(y), JsMath.round(w), JsMath.round(h));
        }

        // Caja con contorno de 1px y esquinas recortadas
        public static void box(Ctx2D g, double x, double y, double w, double h, string fill, string outline = null)
        {
            x = JsMath.round(x); y = JsMath.round(y);
            if (!string.IsNullOrEmpty(outline))
            {
                g.fillStyle = outline;
                g.fillRect(x + 1, y, w - 2, h);
                g.fillRect(x, y + 1, w, h - 2);
            }
            g.fillStyle = fill;
            g.fillRect(x + 1, y + 1, w - 2, h - 2);
        }

        // Línea de píxeles (Bresenham), sin antialiasing
        public static void line(Ctx2D g, double x0, double y0, double x1, double y1, string color, double w = 1)
        {
            x0 = JsMath.round(x0); y0 = JsMath.round(y0); x1 = JsMath.round(x1); y1 = JsMath.round(y1);
            g.fillStyle = color;
            double dx = Math.Abs(x1 - x0), dy = -Math.Abs(y1 - y0);
            double sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            double err = dx + dy;
            for (int i = 0; i < 2000; i++)
            {
                g.fillRect(x0, y0, w, w);
                if (x0 == x1 && y0 == y1) break;
                double e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }

        // Elipse rellena trazada por filas (bordes nítidos)
        public static void ellipse(Ctx2D g, double cx, double cy, double rx, double ry, string color)
        {
            g.fillStyle = color;
            for (double y = -ry; y <= ry; y++)
            {
                double w = JsMath.round(rx * JsMath.sqrt(JsMath.max(0, 1 - (y * y) / (ry * ry))));
                g.fillRect(JsMath.round(cx - w), JsMath.round(cy + y), w * 2 + 1, 1);
            }
        }

        public static void circleOutline(Ctx2D g, double cx, double cy, double r, string color, double step = 1)
        {
            g.fillStyle = color;
            var seen = new HashSet<string>();
            for (double a = 0; a < 360; a += JsMath.max(1, 90 / JsMath.max(r, 1)))
            {
                double x = JsMath.round(cx + JsMath.cos(a * Math.PI / 180) * r), y = JsMath.round(cy + JsMath.sin(a * Math.PI / 180) * r);
                string k = Js.String(x) + "," + Js.String(y);
                if (seen.Contains(k)) continue;
                seen.Add(k);
                if (step > 1 && seen.Count % step != 0) continue;
                g.fillRect(x, y, 1, 1);
            }
        }

        // Trama de puntos (sombreado de 2 tonos sin transparencias)
        public static void dither(Ctx2D g, double x, double y, double w, double h, string color, int phase = 0)
        {
            g.fillStyle = color;
            for (int j = 0; j < h; j++) for (int i = (j + phase) % 2; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
        }

        // JS: text(g, str, x, y, color, opts = {}) con opts { size, align, outline }
        public static void text(Ctx2D g, V str, double x, double y, string color, int size = 8, string align = null, string outline = null)
        {
            if (size == 0) size = 8;
            g.font = size + "px SaldoPixel";
            g.textBaseline = "alphabetic";
            g.textAlign = align ?? "left";
            string s = str.str;
            if (!string.IsNullOrEmpty(outline))
            {
                g.fillStyle = outline;
                double o = size / 8.0;
                g.fillText(s, JsMath.round(x - o), JsMath.round(y));
                g.fillText(s, JsMath.round(x + o), JsMath.round(y));
                g.fillText(s, JsMath.round(x), JsMath.round(y - o));
                g.fillText(s, JsMath.round(x), JsMath.round(y + o));
                g.fillText(s, JsMath.round(x), JsMath.round(y + o * 2));
            }
            g.fillStyle = color;
            g.fillText(s, JsMath.round(x), JsMath.round(y));
            g.textAlign = "left";
        }

        public static double textWidth(Ctx2D g, V str, int size = 8)
        {
            g.font = size + "px SaldoPixel";
            return g.measureText(str.str).width;
        }

        // Sprite desde filas de texto. pal opcional para remapear letras.
        public static Canvas fromRows(IList<string> rows, IDictionary<char, string> pal = null)
        {
            int h = rows.Count, w = 0;
            foreach (var r in rows) w = Math.Max(w, r.Length);
            var c = canvas(w, h); var g = ctx(c);
            for (int y = 0; y < h; y++)
            {
                string row = rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if (ch == '.' || ch == ' ') continue;
                    string col = null;
                    if (pal != null && pal.TryGetValue(ch, out var pc) && !string.IsNullOrEmpty(pc)) col = pc;
                    else if (KEY.TryGetValue(ch, out var kc)) col = kc;
                    else col = ch.ToString();
                    g.fillStyle = col;
                    g.fillRect(x, y, 1, 1);
                }
            }
            return c;
        }

        // Copia escalada (para usar sprites como fondo CSS o cursor)
        public static Canvas scaled(Canvas src, int s)
        {
            var c = canvas(src.width * s, src.height * s); var g = ctx(c);
            g.drawImage(src, 0, 0, c.width, c.height);
            return c;
        }
    }
}
