// El <canvas> del navegador, en C# puro: un búfer de píxeles y su contexto 2D con las operaciones que usa el juego.
// Todo el pixel art de SALDO NEGRO se pinta por código sobre lienzos así (js/render/*): aquí no hay sprites.
//
// Pinta lo mismo que Chrome sin GPU (Skia en la CPU), byte a byte. Las fórmulas salen de barridos exhaustivos
// contra Chrome (Unity/Tools~/ref-canvas.js -> Tests/EditMode/Refs/CanvasRefs.json; prueba: CanvasSuite.cs):
//   · el búfer guarda el color PREMULTIPLICADO (RGBA, fila 0 arriba), como Skia;
//   · premultiplicar (putImageData): p = mulDiv255Round(c, a);
//   · quitar la premultiplicación (getImageData): en float, (p/255) * (1 / (a/255)) * 255, redondeo al par;
//   · un color con opacidad α: sa = round(α * 255), src = premultiplicado; dst' = src + (dst * (256 - sa)) >> 8
//     (el SkBlitRow::Color32 de Skia).
// Los nombres son los de la API de canvas (fillRect, drawImage, globalAlpha...) para que el código portado se lea
// igual que el original.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Canvas
    {
        public readonly int width, height;
        public readonly byte[] data;    // RGBA premultiplicado; píxel i en data[i*4 .. i*4+3], fila 0 arriba
        public int version;             // sube con cada cambio: quien lo enseña en pantalla sabe si tiene que subirlo
        Ctx2D ctx;

        public Canvas(int width, int height)
        {
            if (width <= 0 || height <= 0) throw new ArgumentException("Lienzo sin tamaño: " + width + "x" + height);
            this.width = width; this.height = height;
            data = new byte[width * height * 4];
        }

        // Escribe un píxel ya premultiplicado (para quien rellena el búfer directamente)
        public void set(int i, byte r, byte g, byte b, byte a) { int o = i * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a; }

        // canvas.getContext('2d')
        public Ctx2D getContext() { return ctx ?? (ctx = new Ctx2D(this)); }
    }

    // Lo que devuelven getImageData / createImageData: RGBA sin premultiplicar, fila 0 arriba
    public sealed class ImageData
    {
        public readonly int width, height;
        public readonly byte[] data;
        public ImageData(int width, int height) { this.width = width; this.height = height; data = new byte[width * height * 4]; }
    }

    public struct TextMetrics { public double width; }

    public sealed partial class Ctx2D
    {
        // Una operación de float32 (Skia trabaja en float): se calcula en double y se redondea a float. Con +, -, *, / y
        // raíz el resultado es el mismo que en float32 (53 >= 2*24 + 2 bits), y así no depende de cómo trate Mono
        // los float (los guarda con más precisión de la cuenta).
        static double f32(double x) { return (float)x; }

        public readonly Canvas canvas;
        readonly int W, H;
        readonly byte[] px;

        // ---------- Estado (save / restore) ----------
        struct St
        {
            public double a, b, c, d, e, f;        // transformación
            public double globalAlpha;
            public string fillCss, strokeCss;
            public Rgba fill, stroke;
            public double lineWidth;
            public string op;
            public bool smoothing;
            public string fontCss; public int fontSize; public PxFont fontFace;
            public string textAlign, textBaseline;
            public byte[] clip;                     // cobertura del recorte por píxel (null = sin recorte)
        }
        St s;
        readonly Stack<St> stack = new Stack<St>();

        internal Ctx2D(Canvas canvas)
        {
            this.canvas = canvas;
            W = canvas.width; H = canvas.height; px = canvas.data;
            s.a = 1; s.d = 1;
            s.globalAlpha = 1;
            s.fillCss = s.strokeCss = "#000000";
            s.fill = s.stroke = new Rgba(0, 0, 0);
            s.lineWidth = 1;
            s.op = "source-over";
            s.smoothing = true;
            s.fontCss = "10px sans-serif"; s.fontSize = 10;
            s.textAlign = "start"; s.textBaseline = "alphabetic";
        }

        public double globalAlpha { get { return s.globalAlpha; } set { if (value >= 0 && value <= 1) s.globalAlpha = value; } }
        public bool imageSmoothingEnabled { get { return s.smoothing; } set { s.smoothing = value; } }
        public double lineWidth { get { return s.lineWidth; } set { if (value > 0 && !double.IsInfinity(value)) s.lineWidth = value; } }
        public string textAlign { get { return s.textAlign; } set { s.textAlign = value; } }
        public string textBaseline { get { return s.textBaseline; } set { s.textBaseline = value; } }
        public string globalCompositeOperation
        {
            get { return s.op; }
            set { if (value == "source-over" || value == "lighter" || value == "multiply") s.op = value; else throw new NotSupportedException("globalCompositeOperation '" + value + "' (el juego solo usa source-over, lighter y multiply)"); }
        }
        public string fillStyle
        {
            get { return s.fillCss; }
            set { if (value == s.fillCss) return; s.fill = CssColor.parse(value); s.fillCss = value; }
        }
        public string strokeStyle
        {
            get { return s.strokeCss; }
            set { if (value == s.strokeCss) return; s.stroke = CssColor.parse(value); s.strokeCss = value; }
        }
        // '16px SaldoPixel'
        public string font
        {
            get { return s.fontCss; }
            set
            {
                if (value == s.fontCss) return;
                int p = value.IndexOf("px", StringComparison.Ordinal);
                if (p <= 0 || !int.TryParse(value.Substring(0, p).Trim(), out int size)) throw new NotSupportedException("Fuente de lienzo no soportada: '" + value + "'");
                string family = value.Substring(p + 2).Trim().Trim('\'', '"');
                if (family == "SaldoPixel") s.fontFace = PxFont.SaldoPixel;
                else if (family == "SaldoNum") s.fontFace = PxFont.SaldoNum;
                else throw new NotSupportedException("El juego solo pinta con SaldoPixel y SaldoNum; se pidió '" + family + "'");
                if (size % 8 != 0) throw new NotSupportedException("Tamaño de fuente " + size + "px: la fuente pixel solo cae en la rejilla en múltiplos de 8");
                s.fontSize = size; s.fontCss = value;
            }
        }

        public void save() { stack.Push(s); }
        public void restore() { if (stack.Count > 0) s = stack.Pop(); }

        // ---------- Transformación ----------
        public void setTransform(double a, double b, double c, double d, double e, double f) { s.a = a; s.b = b; s.c = c; s.d = d; s.e = e; s.f = f; }
        public void resetTransform() { setTransform(1, 0, 0, 1, 0, 0); }
        public void transform(double a, double b, double c, double d, double e, double f)
        {
            double na = s.a * a + s.c * b, nb = s.b * a + s.d * b;
            double nc = s.a * c + s.c * d, nd = s.b * c + s.d * d;
            double ne = s.a * e + s.c * f + s.e, nf = s.b * e + s.d * f + s.f;
            setTransform(na, nb, nc, nd, ne, nf);
        }
        public void translate(double x, double y) { transform(1, 0, 0, 1, x, y); }
        public void scale(double x, double y) { transform(x, 0, 0, y, 0, 0); }
        public void rotate(double ang) { double c = JsMath.cos(ang), sn = JsMath.sin(ang); transform(c, sn, -sn, c, 0, 0); }
        bool identity { get { return s.a == 1 && s.b == 0 && s.c == 0 && s.d == 1; } }

        // ---------- Mezcla de un píxel ----------
        // Color premultiplicado (r, g, b, a) con cobertura cov (0..256, 256 = entera) sobre el píxel i.
        // source-over: el de Skia para colores (SkBlitRow::Color32): src + dst * (256 - a) >> 8.
        void blendPm(int i, int r, int g, int b, int a, int cov)
        {
            if (cov <= 0) return;
            if (cov < 256)
            {
                r = (r * cov) >> 8; g = (g * cov) >> 8; b = (b * cov) >> 8; a = (a * cov) >> 8;
            }
            int o = i * 4;
            if (a == 255) { px[o] = (byte)r; px[o + 1] = (byte)g; px[o + 2] = (byte)b; px[o + 3] = 255; return; }
            if (a == 0 && r == 0 && g == 0 && b == 0) return;
            int sc = 256 - a;
            px[o] = (byte)(r + ((px[o] * sc) >> 8));
            px[o + 1] = (byte)(g + ((px[o + 1] * sc) >> 8));
            px[o + 2] = (byte)(b + ((px[o + 2] * sc) >> 8));
            px[o + 3] = (byte)(a + ((px[o + 3] * sc) >> 8));
        }

        // Un color con la opacidad de globalAlpha: premultiplica y mezcla. El alfa del color ya va en 8 bits
        // (como al leer el CSS) y se multiplica por globalAlpha: sa = round(A8 * globalAlpha).
        // 'lighter' y 'multiply' van por la tubería de 8 bits de Skia (lowp): ver blendLowp.
        void blendColor(int i, Rgba c, double ga, int cov)
        {
            int a8 = (int)Math.Floor(c.a * 255 + 0.5);
            if (s.op != "source-over") { blendLowp(i, c, a8, ga, cov); return; }
            int sa = a8 == 255 ? alpha8(ga) : (int)Math.Floor(a8 * ga + 0.5);
            if (sa <= 0) return;
            if (sa > 255) sa = 255;
            blendPm(i, mulDiv255Round(c.r, sa), mulDiv255Round(c.g, sa), mulDiv255Round(c.b, sa), sa, cov);
        }

        // globalAlpha a 8 bits como Chrome: en float32 (alfa * 255 + 0.5, truncado). No es lo mismo que en double justo
        // en los valores a medias (0.8333... * 255 = 212.5). Por debajo de medio nivel no pinta. Calibrado con 5 715 alfas.
        static int alpha8(double ga)
        {
            if (255.0 * ga < 0.5) return 0;
            int v = (int)Math.Floor(f32(f32(f32(ga) * 255.0) + 0.5));
            return v > 255 ? 255 : v;
        }

        public static int mulDiv255Round(int a, int b) { int t = a * b + 128; return (t + (t >> 8)) >> 8; }

        // ---------- Rectángulos ----------
        // clearRect no suaviza: redondea los bordes al píxel (como SkScan::FillRect sin antialias)
        public void clearRect(double x, double y, double w, double h)
        {
            if (!identity || s.clip != null) { pathRectOp(x, y, w, h, clear: true); return; }
            if (w < 0) { x += w; w = -w; }
            if (h < 0) { y += h; h = -h; }
            double L = f32(x + s.e), T = f32(y + s.f), R = f32(L + f32(w)), B = f32(T + f32(h));
            int x0 = Math.Max(0, (int)Math.Floor(L + 0.5)), x1 = Math.Min(W, (int)Math.Floor(R + 0.5));
            int y0 = Math.Max(0, (int)Math.Floor(T + 0.5)), y1 = Math.Min(H, (int)Math.Floor(B + 0.5));
            for (int j = y0; j < y1; j++) Array.Clear(px, (j * W + x0) * 4, Math.Max(0, x1 - x0) * 4);
            canvas.version++;
        }

        public void fillRect(double x, double y, double w, double h)
        {
            if (!identity || s.clip != null) { pathRectOp(x, y, w, h, clear: false); return; }
            Rgba c = s.fill;
            if (c.a <= 0 || s.globalAlpha <= 0) return;
            antiFillRect(x + s.e, y + s.f, w, h, (i, cov) => blendColor(i, c, s.globalAlpha, cov));
            canvas.version++;
        }

        // Rectángulo alineado con bordes suavizados, como SkScan::AntiFillRect (antifilldot8): las coordenadas pasan
        // a float32 y a 24.8 de punto fijo; cada píxel del borde recibe una cobertura de 0 a 255 y se pinta con
        // cov = cobertura + 1 (sobre 256). fn(índice, cov) con cov = 256 si el píxel está entero.
        void antiFillRect(double x, double y, double w, double h, Action<int, int> fn)
        {
            if (double.IsNaN(x + y + w + h) || double.IsInfinity(x + y + w + h)) return;
            double fx = f32(x), fy = f32(y), fw = f32(w), fh = f32(h);
            double l = fx, t = fy, r = f32(fx + fw), b = f32(fy + fh);
            if (r < l) { double k = l; l = r; r = k; }
            if (b < t) { double k = t; t = b; b = k; }
            int L = dot8(l), T = dot8(t), R = dot8(r), B = dot8(b);
            if (L >= R || T >= B) return;
            int top = T >> 8;
            if (top == ((B - 1) >> 8)) { scanline(L, top, R, B - T - 1, fn); return; }
            if ((T & 0xFF) != 0) { scanline(L, top, R, 256 - (T & 0xFF), fn); top += 1; }
            int bot = B >> 8, height = bot - top;
            if (height > 0)
            {
                int left = L >> 8;
                if (left == ((R - 1) >> 8)) vline(left, top, height, R - L - 1, fn);
                else
                {
                    if ((L & 0xFF) != 0) { vline(left, top, height, 256 - (L & 0xFF), fn); left += 1; }
                    int rite = R >> 8, width = rite - left;
                    if (width > 0) for (int j = top; j < top + height; j++) { if (j < 0 || j >= H) continue; for (int i = Math.Max(0, left); i < Math.Min(W, left + width); i++) fn(j * W + i, 256); }
                    if ((R & 0xFF) != 0) vline(rite, top, height, R & 0xFF, fn);
                }
            }
            if ((B & 0xFF) != 0) scanline(L, bot, R, B & 0xFF, fn);
        }
        // float -> 16.16 (truncando) -> 24.8 (redondeando)
        static int dot8(double v)
        {
            double f = (double)v * 65536.0;
            long fixd = f >= int.MaxValue ? int.MaxValue : f <= int.MinValue ? int.MinValue : (long)f;
            return (int)((fixd + 0x80) >> 8);
        }
        void scanline(int L, int top, int R, int alpha, Action<int, int> fn)
        {
            if (L >= R || top < 0 || top >= H) return;
            if ((L >> 8) == ((R - 1) >> 8)) { px1(L >> 8, top, (alpha * (R - L)) >> 8, fn); return; }
            int left = L >> 8;
            if ((L & 0xFF) != 0) { px1(left, top, (alpha * (256 - (L & 0xFF))) >> 8, fn); left += 1; }
            int rite = R >> 8, width = rite - left;
            for (int i = left; i < left + width; i++) px1(i, top, alpha, fn);
            if ((R & 0xFF) != 0) px1(rite, top, (alpha * (R & 0xFF)) >> 8, fn);
        }
        void vline(int x, int top, int height, int alpha, Action<int, int> fn) { for (int j = top; j < top + height; j++) px1(x, j, alpha, fn); }
        void px1(int x, int y, int alpha, Action<int, int> fn)
        {
            if (x < 0 || x >= W || y < 0 || y >= H || alpha <= 0) return;
            fn(y * W + x, alpha >= 255 ? 256 : alpha + 1);
        }

        // ---------- Texto ----------
        // Como en Chrome: el texto empieza en x (izquierda), x - ancho / 2 (centro) o x - ancho (derecha) SIN redondear.
        // Un texto centrado de ancho impar cae a medio píxel y cada columna se reparte entre dos píxeles.
        // Cada glifo se compone por separado. y es la línea base (textBaseline 'alphabetic', la única que usa el juego).
        // (El suavizado extra de ClearType en Windows no se copia: depende del sistema, no del juego.)
        public void fillText(string text, double x, double y)
        {
            if (s.textBaseline != "alphabetic") throw new NotSupportedException("textBaseline '" + s.textBaseline + "'");
            if (s.fontFace == null) throw new InvalidOperationException("fillText sin fuente: pon antes g.font = '8px SaldoPixel'");
            if (skipText) return;
            // Con escala entera (las fotos de las noticias se pintan al doble) cada píxel del glifo crece lo mismo
            if (s.b != 0 || s.c != 0 || s.a != s.d || s.a < 1 || s.a != Math.Floor(s.a)) throw new NotSupportedException("fillText con giro o con una escala que no es entera");
            int zoom = (int)s.a;
            x = x * zoom + s.e; y = y * zoom + s.f;
            if (y != Math.Floor(y)) throw new NotSupportedException("Texto con la línea base a medio píxel (y = " + y + ")");
            Rgba col = s.fill;
            double alpha = col.a * s.globalAlpha;
            if (alpha <= 0 || string.IsNullOrEmpty(text)) return;
            var face = s.fontFace;
            int sz = s.fontSize / 8 * zoom, baseY = (int)y;
            double pen = x;
            if (s.textAlign == "center") pen = x - face.width(text) * sz / 2.0;
            else if (s.textAlign == "right" || s.textAlign == "end") pen = x - face.width(text) * sz;
            else if (s.textAlign != "left" && s.textAlign != "start") throw new NotSupportedException("textAlign '" + s.textAlign + "'");

            double[] cov = covBuf;
            for (int i = 0; i < text.Length; i++)
            {
                var gl = face.glyph(PxFont.codePointAt(text, ref i));
                int left = (int)Math.Floor(pen);
                double f = pen - left;
                int span = gl.adv * sz + sz + 2;
                if (cov.Length < span) cov = covBuf = new double[span * 2];
                for (int r = 0; r < PxFont.ROWS; r++)
                {
                    int bits = gl.rows[r];
                    if (bits == 0) continue;
                    int used = 0;
                    Array.Clear(cov, 0, span);
                    for (int c = 0; bits != 0; c++, bits >>= 1)
                    {
                        if ((bits & 1) == 0) continue;
                        double a0 = c * sz + f, a1 = a0 + sz;
                        int p0 = (int)Math.Floor(a0), p1 = (int)Math.Ceiling(a1);
                        for (int p = p0; p < p1; p++) cov[p] += Math.Min(a1, p + 1) - Math.Max(a0, p);
                        if (p1 > used) used = p1;
                    }
                    int top = baseY - (PxFont.ASCENT - r) * sz;
                    for (int j = 0; j < sz; j++)
                    {
                        int py = top + j;
                        if (py < 0 || py >= H) continue;
                        for (int p = 0; p < used; p++)
                        {
                            double c = cov[p];
                            if (c <= 0) continue;
                            int pxX = left + p;
                            if (pxX < 0 || pxX >= W) continue;
                            int cv = c >= 1 ? 256 : (int)Math.Floor(c * 256 + 0.5);
                            int idx = py * W + pxX;
                            if (s.clip != null) cv = (cv * (s.clip[idx] + 1)) >> 8;
                            blendColor(idx, col, s.globalAlpha, cv);
                        }
                    }
                }
                pen += gl.adv * sz;
            }
            canvas.version++;
        }
        double[] covBuf = new double[64];
        // Solo para las pruebas de dibujo: con esto fillText no pinta nada. Así se compara con Chrome todo lo que
        // no es texto, byte a byte, también debajo de las letras (ver DrawSuite.cs).
        public static bool skipText;

        public TextMetrics measureText(string text)
        {
            if (s.fontFace == null) throw new InvalidOperationException("measureText sin fuente");
            return new TextMetrics { width = s.fontFace.width(text) * (s.fontSize / 8) };
        }

        // ---------- Píxeles ----------
        public ImageData createImageData(int w, int h) { return new ImageData(Math.Abs(w), Math.Abs(h)); }

        public ImageData getImageData(int x, int y, int w, int h)
        {
            var img = new ImageData(w, h);
            for (int j = 0; j < h; j++)
            {
                int sy = y + j;
                if (sy < 0 || sy >= H) continue;
                for (int i = 0; i < w; i++)
                {
                    int sx = x + i;
                    if (sx < 0 || sx >= W) continue;
                    int so = (sy * W + sx) * 4, o = (j * w + i) * 4;
                    int a = px[so + 3];
                    if (a == 255) { img.data[o] = px[so]; img.data[o + 1] = px[so + 1]; img.data[o + 2] = px[so + 2]; img.data[o + 3] = 255; }
                    else if (a != 0)
                    {
                        img.data[o] = unpremul(px[so], a); img.data[o + 1] = unpremul(px[so + 1], a); img.data[o + 2] = unpremul(px[so + 2], a);
                        img.data[o + 3] = (byte)a;
                    }
                }
            }
            return img;
        }

        // Quitar la premultiplicación como Skia (en float, redondeo al par)
        static readonly double INV255 = f32(1.0 / 255.0);
        public static byte unpremul(int p, int a)
        {
            double v = f32(p * INV255);
            double A = f32(a * INV255);
            double inv = f32(1.0 / A);
            double u = f32(f32(v * inv) * 255.0);
            int r = (int)Math.Round(u, MidpointRounding.ToEven);
            return (byte)(r > 255 ? 255 : r < 0 ? 0 : r);
        }

        // putImageData: copia tal cual (sin transformación, sin recorte, sin mezcla), premultiplicando
        public void putImageData(ImageData img, int dx, int dy)
        {
            for (int j = 0; j < img.height; j++)
            {
                int y = dy + j;
                if (y < 0 || y >= H) continue;
                for (int i = 0; i < img.width; i++)
                {
                    int x = dx + i;
                    if (x < 0 || x >= W) continue;
                    int so = (j * img.width + i) * 4, o = (y * W + x) * 4;
                    int a = img.data[so + 3];
                    if (a == 255) { px[o] = img.data[so]; px[o + 1] = img.data[so + 1]; px[o + 2] = img.data[so + 2]; px[o + 3] = 255; }
                    else
                    {
                        px[o] = (byte)mulDiv255Round(img.data[so], a); px[o + 1] = (byte)mulDiv255Round(img.data[so + 1], a);
                        px[o + 2] = (byte)mulDiv255Round(img.data[so + 2], a); px[o + 3] = (byte)a;
                    }
                }
            }
            canvas.version++;
        }
    }

}
