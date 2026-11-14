// Ctx2D (2/2): trazados (rect, arc, moveTo/lineTo), relleno, contorno y recorte; drawImage con la
// transformación; y las mezclas 'lighter' y 'multiply'. Como el resto del lienzo, calibrado contra Chrome
// (CanvasSuite). Los trazados se rasterizan con supermuestreo (16 x 16 muestras por píxel); en el juego solo se
// usan para la ruleta de la suerte y para recortes rectangulares, que salen exactos.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Ctx2D
    {
        // ---------- Trazado actual (en píxeles del lienzo: la transformación se aplica al añadir cada punto) ----------
        sealed class Sub { public readonly List<double> pts = new List<double>(); public bool closed; }
        readonly List<Sub> path = new List<Sub>();
        Sub cur;

        void tp(double x, double y, out double X, out double Y) { X = s.a * x + s.c * y + s.e; Y = s.b * x + s.d * y + s.f; }

        public void beginPath() { path.Clear(); cur = null; }
        public void moveTo(double x, double y)
        {
            cur = new Sub(); path.Add(cur);
            tp(x, y, out double X, out double Y); cur.pts.Add(X); cur.pts.Add(Y);
        }
        public void lineTo(double x, double y)
        {
            if (cur == null) { moveTo(x, y); return; }
            tp(x, y, out double X, out double Y); cur.pts.Add(X); cur.pts.Add(Y);
        }
        public void closePath()
        {
            if (cur == null || cur.pts.Count == 0) return;
            cur.closed = true;
            double x0 = cur.pts[0], y0 = cur.pts[1];
            cur = new Sub(); path.Add(cur); cur.pts.Add(x0); cur.pts.Add(y0);
        }
        public void rect(double x, double y, double w, double h)
        {
            moveTo(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h);
            cur.closed = true;
            tp(x, y, out double X, out double Y);
            cur = new Sub(); path.Add(cur); cur.pts.Add(X); cur.pts.Add(Y);
        }
        public void arc(double cx, double cy, double r, double a0, double a1, bool ccw = false)
        {
            double sweep = a1 - a0;
            const double TAU = 2 * Math.PI;
            if (!ccw) { if (sweep >= TAU) sweep = TAU; else { sweep %= TAU; if (sweep < 0) sweep += TAU; } }
            else { if (sweep <= -TAU) sweep = -TAU; else { sweep %= TAU; if (sweep > 0) sweep -= TAU; } }
            int n = Math.Max(2, (int)Math.Ceiling(Math.Abs(sweep) / TAU * 512));
            for (int i = 0; i <= n; i++)
            {
                double a = a0 + sweep * i / n;
                double x = cx + Math.Cos(a) * r, y = cy + Math.Sin(a) * r;
                if (i == 0 && (cur == null || cur.pts.Count == 0)) moveTo(x, y); else lineTo(x, y);
            }
        }

        // ---------- Rasterizar polígonos (cobertura 0..256 por píxel) ----------
        const int SS = 16; // muestras por lado
        // Devuelve la cobertura de cada píxel de la caja [x0,x1) x [y0,y1) (null si vacía)
        int[] raster(List<List<double>> polys, bool evenOdd, out int bx0, out int by0, out int bw, out int bh)
        {
            double minx = double.PositiveInfinity, miny = double.PositiveInfinity, maxx = double.NegativeInfinity, maxy = double.NegativeInfinity;
            foreach (var p in polys) for (int i = 0; i < p.Count; i += 2) { minx = Math.Min(minx, p[i]); maxx = Math.Max(maxx, p[i]); miny = Math.Min(miny, p[i + 1]); maxy = Math.Max(maxy, p[i + 1]); }
            bx0 = Math.Max(0, (int)Math.Floor(minx)); by0 = Math.Max(0, (int)Math.Floor(miny));
            int bx1 = Math.Min(W, (int)Math.Ceiling(maxx)), by1 = Math.Min(H, (int)Math.Ceiling(maxy));
            bw = bx1 - bx0; bh = by1 - by0;
            if (bw <= 0 || bh <= 0) return null;
            var cov = new int[bw * bh];
            var xs = new List<double>(); var dirs = new List<int>();
            for (int j = 0; j < bh; j++)
            {
                for (int sy = 0; sy < SS; sy++)
                {
                    double yy = by0 + j + (sy + 0.5) / SS;
                    xs.Clear(); dirs.Clear();
                    foreach (var p in polys)
                    {
                        int n = p.Count / 2;
                        for (int i = 0; i < n; i++)
                        {
                            double ax = p[i * 2], ay = p[i * 2 + 1], cx = p[((i + 1) % n) * 2], cy = p[((i + 1) % n) * 2 + 1];
                            if ((ay <= yy && cy > yy) || (cy <= yy && ay > yy))
                            {
                                xs.Add(ax + (yy - ay) / (cy - ay) * (cx - ax));
                                dirs.Add(cy > ay ? 1 : -1);
                            }
                        }
                    }
                    if (xs.Count == 0) continue;
                    // ordenar cruces
                    var idx = new int[xs.Count];
                    for (int k = 0; k < idx.Length; k++) idx[k] = k;
                    Array.Sort(idx, (a, b) => xs[a].CompareTo(xs[b]));
                    int wind = 0;
                    for (int k = 0; k + 1 < idx.Length; k++)
                    {
                        wind += dirs[idx[k]];
                        bool inside = evenOdd ? ((k + 1) & 1) == 1 : wind != 0;
                        if (!inside) continue;
                        double xa = xs[idx[k]], xb = xs[idx[k + 1]];
                        // muestras de x en esta fila que caen dentro de [xa, xb)
                        int s0 = (int)Math.Ceiling((xa - bx0) * SS - 0.5), s1 = (int)Math.Ceiling((xb - bx0) * SS - 0.5);
                        if (s0 < 0) s0 = 0;
                        if (s1 > bw * SS) s1 = bw * SS;
                        for (int sx = s0; sx < s1; sx++) cov[j * bw + sx / SS]++;
                    }
                }
            }
            return cov; // en 1/256
        }

        List<List<double>> pathPolys()
        {
            var polys = new List<List<double>>();
            foreach (var sp in path) if (sp.pts.Count >= 6) polys.Add(sp.pts);
            return polys;
        }

        public void fill(string rule = "nonzero")
        {
            Rgba c = s.fill;
            double alpha = c.a * s.globalAlpha;
            if (alpha <= 0) return;
            var cov = raster(pathPolys(), rule == "evenodd", out int bx, out int by, out int bw, out int bh);
            if (cov == null) return;
            for (int j = 0; j < bh; j++) for (int i = 0; i < bw; i++)
            {
                int cv = cov[j * bw + i];
                if (cv <= 0) continue;
                int idx = (by + j) * W + bx + i;
                if (s.clip != null) cv = (cv * (s.clip[idx] + 1)) >> 8;
                blendColor(idx, c, s.globalAlpha, cv >= 256 ? 256 : cv);
            }
            canvas.version++;
        }

        // Contorno: cada tramo es un rectángulo de ancho lineWidth, con uniones en ángulo (miter, límite 10)
        public void stroke()
        {
            Rgba c = s.stroke;
            double alpha = c.a * s.globalAlpha;
            if (alpha <= 0) return;
            double hw = s.lineWidth * Math.Sqrt(Math.Abs(s.a * s.d - s.b * s.c)) / 2;
            var polys = new List<List<double>>();
            foreach (var sp in path)
            {
                var p = sp.pts;
                int n = p.Count / 2;
                if (n < 2) continue;
                int segs = sp.closed ? n : n - 1;
                for (int i = 0; i < segs; i++)
                {
                    double ax = p[i * 2], ay = p[i * 2 + 1], bx = p[((i + 1) % n) * 2], by = p[((i + 1) % n) * 2 + 1];
                    double dx = bx - ax, dy = by - ay, len = Math.Sqrt(dx * dx + dy * dy);
                    if (len == 0) continue;
                    double nx = -dy / len * hw, ny = dx / len * hw;
                    polys.Add(new List<double> { ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny });
                }
                // uniones (miter) entre tramos consecutivos
                int joins = sp.closed ? n : n - 2;
                for (int i = 0; i < joins; i++)
                {
                    int i0 = sp.closed ? (i + n - 1) % n : i, i1 = (i0 + 1) % n, i2 = (i1 + 1) % n;
                    if (!sp.closed) { i0 = i; i1 = i + 1; i2 = i + 2; }
                    addJoin(polys, p[i0 * 2], p[i0 * 2 + 1], p[i1 * 2], p[i1 * 2 + 1], p[i2 * 2], p[i2 * 2 + 1], hw);
                }
            }
            var cov = raster(polys, false, out int bx0, out int by0, out int bw, out int bh);
            if (cov == null) return;
            for (int j = 0; j < bh; j++) for (int i = 0; i < bw; i++)
            {
                int cv = cov[j * bw + i];
                if (cv <= 0) continue;
                int idx = (by0 + j) * W + bx0 + i;
                if (s.clip != null) cv = (cv * (s.clip[idx] + 1)) >> 8;
                blendColor(idx, c, s.globalAlpha, cv >= 256 ? 256 : cv);
            }
            canvas.version++;
        }
        static void addJoin(List<List<double>> polys, double ax, double ay, double bx, double by, double cx, double cy, double hw)
        {
            double d1x = bx - ax, d1y = by - ay, d2x = cx - bx, d2y = cy - by;
            double l1 = Math.Sqrt(d1x * d1x + d1y * d1y), l2 = Math.Sqrt(d2x * d2x + d2y * d2y);
            if (l1 == 0 || l2 == 0) return;
            d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
            double cross = d1x * d2y - d1y * d2x;
            if (Math.Abs(cross) < 1e-12) return;
            double side = cross > 0 ? -1 : 1; // el lado de fuera del giro
            double n1x = -d1y * hw * side, n1y = d1x * hw * side, n2x = -d2y * hw * side, n2y = d2x * hw * side;
            double cosT = -(d1x * d2x + d1y * d2y);
            double miter = 1 / Math.Sqrt(Math.Max(1e-12, (1 - cosT) / 2)); // 1 / sin(theta / 2)
            if (miter <= 10)
            {
                double mx = n1x + n2x, my = n1y + n2y, ml = Math.Sqrt(mx * mx + my * my);
                mx = mx / ml * hw * miter; my = my / ml * hw * miter;
                polys.Add(new List<double> { bx, by, bx + n1x, by + n1y, bx + mx, by + my, bx + n2x, by + n2y });
            }
            else polys.Add(new List<double> { bx, by, bx + n1x, by + n1y, bx + n2x, by + n2y });
        }

        // clip(): el recorte nuevo es la intersección con el anterior
        public void clip(string rule = "nonzero")
        {
            var cov = raster(pathPolys(), rule == "evenodd", out int bx, out int by, out int bw, out int bh);
            var m = new byte[W * H];
            if (cov != null)
                for (int j = 0; j < bh; j++) for (int i = 0; i < bw; i++)
                {
                    int cv = cov[j * bw + i];
                    m[(by + j) * W + bx + i] = (byte)(cv >= 256 ? 255 : cv);
                }
            if (s.clip != null) for (int i = 0; i < m.Length; i++) m[i] = (byte)((m[i] * (s.clip[i] + 1)) >> 8);
            s.clip = m;
        }

        // fillRect / clearRect con giro, escala o recorte
        void pathRectOp(double x, double y, double w, double h, bool clear)
        {
            // Con escala y traslación (sin giro), o girado justo un cuarto de vuelta (la pala tumbada en la mesa),
            // es otro rectángulo alineado: mismos bordes que fillRect
            if ((s.b == 0 && s.c == 0) || (s.a == 0 && s.d == 0))
            {
                double X0 = s.a * x + s.c * y + s.e, X1 = s.a * (x + w) + s.c * (y + h) + s.e;
                double Y0 = s.b * x + s.d * y + s.f, Y1 = s.b * (x + w) + s.d * (y + h) + s.f;
                Rgba c = s.fill;
                double alpha = c.a * s.globalAlpha;
                antiFillRect(Math.Min(X0, X1), Math.Min(Y0, Y1), Math.Abs(X1 - X0), Math.Abs(Y1 - Y0), (i, cov) =>
                {
                    if (s.clip != null) cov = (cov * (s.clip[i] + 1)) >> 8;
                    if (cov <= 0) return;
                    if (clear)
                    {
                        int o = i * 4, k = 256 - cov;
                        px[o] = (byte)((px[o] * k) >> 8); px[o + 1] = (byte)((px[o + 1] * k) >> 8); px[o + 2] = (byte)((px[o + 2] * k) >> 8); px[o + 3] = (byte)((px[o + 3] * k) >> 8);
                    }
                    else if (alpha > 0) blendColor(i, c, s.globalAlpha, cov);
                });
                canvas.version++;
                return;
            }
            throw new NotSupportedException("fillRect / clearRect con un giro que no es de un cuarto de vuelta: el juego no lo usa");
        }

        // ---------- Mezclas de la tubería de 8 bits de Skia (lowp) ----------
        // El color se premultiplica en float y se redondea (al par) a 8 bits; div255(v) = (v + 255) >> 8.
        //   lighter : min(255, s + d)
        //   multiply: div255(s·(255−da) + d·(255−sa) + s·d)    (el alfa, igual con s = sa y d = da)
        static int rheF(double v) { return (int)Math.Round(v, MidpointRounding.ToEven); }
        static int div255(int v) { return (v + 255) >> 8; }
        void blendLowp(int i, Rgba c, int a8, double ga, int cov)
        {
            double al = a8 == 255 ? f32(ga) : f32(f32(a8 / 255.0) * f32(ga));
            if (al <= 0) return;
            int sr = rheF(f32(f32(f32(c.r / 255.0) * al) * 255.0)), sg = rheF(f32(f32(f32(c.g / 255.0) * al) * 255.0)), sb = rheF(f32(f32(f32(c.b / 255.0) * al) * 255.0));
            int sa = rheF(f32(al * 255.0));
            if (cov < 256) throw new NotSupportedException("'" + s.op + "' con bordes suavizados: el juego no lo usa");
            int o = i * 4;
            if (s.op == "lighter")
            {
                px[o] = (byte)Math.Min(255, px[o] + sr); px[o + 1] = (byte)Math.Min(255, px[o + 1] + sg);
                px[o + 2] = (byte)Math.Min(255, px[o + 2] + sb); px[o + 3] = (byte)Math.Min(255, px[o + 3] + sa);
            }
            else
            {
                int da = px[o + 3];
                px[o] = (byte)div255(sr * (255 - da) + px[o] * (255 - sa) + sr * px[o]);
                px[o + 1] = (byte)div255(sg * (255 - da) + px[o + 1] * (255 - sa) + sg * px[o + 1]);
                px[o + 2] = (byte)div255(sb * (255 - da) + px[o + 2] * (255 - sa) + sb * px[o + 2]);
                px[o + 3] = (byte)div255(sa * (255 - da) + da * (255 - sa) + sa * da);
            }
        }

        // ---------- drawImage ----------
        // Sin suavizado (imageSmoothingEnabled = false en todo el juego), como Skia:
        //   · sin escala ni giro: se copia la imagen desplazada al píxel más cercano (round de la posición) y se
        //     mezcla con SkPMSrcOver (opaca) o SkBlendARGB32 (con globalAlpha);
        //   · con escala, espejo o giro: cada píxel cuyo centro cae dentro del destino toma el texel de su centro
        //     transformado al revés; mezcla de la tubería de 8 bits.
        public void drawImage(Canvas img, double dx, double dy) { drawImage(img, 0, 0, img.width, img.height, dx, dy, img.width, img.height); }
        public void drawImage(Canvas img, double dx, double dy, double dw, double dh) { drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh); }
        public void drawImage(Canvas img, double sx, double sy, double sw, double sh, double dx, double dy, double dw, double dh)
        {
            if (img == null) throw new ArgumentNullException(nameof(img));
            if (s.op != "source-over") throw new NotSupportedException("drawImage con " + s.op + ": el juego no lo usa");
            if (sw == 0 || sh == 0 || dw == 0 || dh == 0) return;
            if (sw < 0) { sx += sw; sw = -sw; }
            if (sh < 0) { sy += sh; sh = -sh; }
            if (dw < 0) { dx += dw; dw = -dw; }
            if (dh < 0) { dy += dh; dh = -dh; }
            double fx = dw / sw, fy = dh / sh;
            if (sx < 0) { dx -= sx * fx; dw += sx * fx; sw += sx; sx = 0; }
            if (sy < 0) { dy -= sy * fy; dh += sy * fy; sh += sy; sy = 0; }
            if (sx + sw > img.width) { double cut = sx + sw - img.width; sw -= cut; dw -= cut * fx; }
            if (sy + sh > img.height) { double cut = sy + sh - img.height; sh -= cut; dh -= cut * fy; }
            if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
            double ga = s.globalAlpha;
            if (ga <= 0) return;
            int a8 = alpha8(ga);
            byte[] src = img.data;
            int iw = img.width;

            // Matriz usuario -> lienzo del destino: M = CTM · [fx 0 dx - sx*fx; 0 fy dy - sy*fy]
            double ma = s.a * fx, mb = s.b * fx, mc = s.c * fy, md = s.d * fy;
            double me = s.a * (dx - sx * fx) + s.c * (dy - sy * fy) + s.e;
            double mf = s.b * (dx - sx * fx) + s.d * (dy - sy * fy) + s.f;

            // Copia directa (sin escala ni giro)
            if (ma == 1 && md == 1 && mb == 0 && mc == 0 && sx == Math.Floor(sx) && sy == Math.Floor(sy) && sw == Math.Floor(sw) && sh == Math.Floor(sh))
            {
                int ox = (int)Math.Floor(me + 0.5), oy = (int)Math.Floor(mf + 0.5); // posición del texel (0,0)
                int isx = (int)sx, isy = (int)sy, iswid = (int)sw, ish = (int)sh;
                for (int j = isy; j < isy + ish; j++)
                {
                    int y = oy + j;
                    if (y < 0 || y >= H) continue;
                    for (int i = isx; i < isx + iswid; i++)
                    {
                        int x = ox + i;
                        if (x < 0 || x >= W) continue;
                        int so = (j * iw + i) * 4;
                        spritePx(y * W + x, src[so], src[so + 1], src[so + 2], src[so + 3], a8);
                    }
                }
                canvas.version++;
                return;
            }

            double det = ma * md - mb * mc;
            if (det == 0) return;
            double ia = md / det, ib = -mb / det, ic = -mc / det, id = ma / det;
            double ie = -(ia * me + ic * mf), iF = -(ib * me + id * mf);
            double minx = double.PositiveInfinity, miny = double.PositiveInfinity, maxx = double.NegativeInfinity, maxy = double.NegativeInfinity;
            foreach (var cc in new[] { new[] { sx, sy }, new[] { sx + sw, sy }, new[] { sx, sy + sh }, new[] { sx + sw, sy + sh } })
            {
                double X = ma * cc[0] + mc * cc[1] + me, Y = mb * cc[0] + md * cc[1] + mf;
                minx = Math.Min(minx, X); maxx = Math.Max(maxx, X); miny = Math.Min(miny, Y); maxy = Math.Max(maxy, Y);
            }
            bool rotated = mb != 0 || mc != 0;
            double[] quad = null;
            if (rotated) { quad = new double[8]; int q = 0; foreach (var cc in new[] { new[] { sx, sy }, new[] { sx + sw, sy }, new[] { sx + sw, sy + sh }, new[] { sx, sy + sh } }) { quad[q++] = ma * cc[0] + mc * cc[1] + me; quad[q++] = mb * cc[0] + md * cc[1] + mf; } }
            int x0 = Math.Max(0, (int)Math.Floor(minx)), x1 = Math.Min(W, (int)Math.Ceiling(maxx));
            int y0 = Math.Max(0, (int)Math.Floor(miny)), y1 = Math.Min(H, (int)Math.Ceiling(maxy));
            for (int y = y0; y < y1; y++)
            {
                double py = y + 0.5;
                for (int x = x0; x < x1; x++)
                {
                    double pxc = x + 0.5;
                    double u = ia * pxc + ic * py + ie - BIAS, v = ib * pxc + id * py + iF - BIAS; // (Skia redondea hacia atrás lo que cae justo en un borde)
                    int cov8 = 255;
                    if (rotated)
                    {
                        // Con giro Chrome suaviza el borde: cobertura = área del píxel dentro del destino (APROXIMADO: Skia
                        // da valores parecidos, no iguales; solo lo usa la pala que gira en la escena del embargo)
                        cov8 = (int)Math.Floor(quadArea(quad, x, y) * 255 + 0.5);
                        if (cov8 <= 0) continue;
                        if (u < sx) u = sx; if (v < sy) v = sy; if (u >= sx + sw) u = sx + sw - 1e-9; if (v >= sy + sh) v = sy + sh - 1e-9;
                    }
                    else if (u < sx || v < sy || u >= sx + sw || v >= sy + sh) continue; // centro fuera del destino
                    int tx = (int)Math.Floor(u), ty = (int)Math.Floor(v);
                    int so = (ty * iw + tx) * 4;
                    int idx = y * W + x;
                    int a = src[so + 3];
                    if (a == 0) continue;
                    int r = src[so], g = src[so + 1], b = src[so + 2];
                    if (s.clip != null && s.clip[idx] < 255) { if (s.clip[idx] == 0) continue; throw new NotSupportedException("drawImage con escala o giro bajo un recorte suavizado"); }
                    if (a8 < 255) { r = div255(r * a8); g = div255(g * a8); b = div255(b * a8); a = div255(a * a8); }
                    if (cov8 < 255) { r = div255(r * cov8); g = div255(g * cov8); b = div255(b * cov8); a = div255(a * cov8); if (a == 0 && r == 0 && g == 0 && b == 0) continue; }
                    int o = idx * 4;
                    if (a == 255) { px[o] = (byte)r; px[o + 1] = (byte)g; px[o + 2] = (byte)b; px[o + 3] = 255; continue; }
                    int inv = 255 - a;
                    px[o] = (byte)(r + div255(px[o] * inv)); px[o + 1] = (byte)(g + div255(px[o + 1] * inv));
                    px[o + 2] = (byte)(b + div255(px[o + 2] * inv)); px[o + 3] = (byte)(a + div255(px[o + 3] * inv));
                }
            }
            canvas.version++;
        }

        const double BIAS = 1.0 / 65536;

        // Área del cuadrilátero convexo q (4 puntos) dentro del píxel [x, x+1] x [y, y+1]
        static double quadArea(double[] q, int x, int y)
        {
            var p = new List<double>(q);
            double[][] edges = { new double[] { 1, 0, -x }, new double[] { -1, 0, x + 1 }, new double[] { 0, 1, -y }, new double[] { 0, -1, y + 1 } };
            foreach (var e in edges)
            {
                var o = new List<double>();
                int n = p.Count / 2;
                for (int i = 0; i < n; i++)
                {
                    double px0 = p[i * 2], py0 = p[i * 2 + 1], qx = p[((i + 1) % n) * 2], qy = p[((i + 1) % n) * 2 + 1];
                    double dp = e[0] * px0 + e[1] * py0 + e[2], dq = e[0] * qx + e[1] * qy + e[2];
                    if (dp >= 0) { o.Add(px0); o.Add(py0); }
                    if ((dp >= 0) != (dq >= 0)) { double t = dp / (dp - dq); o.Add(px0 + t * (qx - px0)); o.Add(py0 + t * (qy - py0)); }
                }
                p = o;
                if (p.Count == 0) return 0;
            }
            double A = 0;
            int m = p.Count / 2;
            for (int i = 0; i < m; i++) A += p[i * 2] * p[((i + 1) % m) * 2 + 1] - p[((i + 1) % m) * 2] * p[i * 2 + 1];
            return Math.Abs(A) / 2;
        }

        // Un texel copiado tal cual: SkPMSrcOver si globalAlpha es 1; SkBlendARGB32 si no. El recorte (siempre de
        // bordes enteros en el juego) solo deja pasar o no.
        void spritePx(int idx, int r, int g, int b, int a, int a8)
        {
            if (s.clip != null)
            {
                int cv = s.clip[idx];
                if (cv == 0) return;
                if (cv < 255) throw new NotSupportedException("drawImage bajo un recorte suavizado");
            }
            int o = idx * 4;
            if (a8 >= 255)
            {
                if (a == 0) return;
                if (a == 255) { px[o] = (byte)r; px[o + 1] = (byte)g; px[o + 2] = (byte)b; px[o + 3] = 255; return; }
                int sc = 256 - a;
                px[o] = (byte)(r + ((px[o] * sc) >> 8)); px[o + 1] = (byte)(g + ((px[o + 1] * sc) >> 8));
                px[o + 2] = (byte)(b + ((px[o + 2] * sc) >> 8)); px[o + 3] = (byte)(a + ((px[o + 3] * sc) >> 8));
                return;
            }
            int ss = a8 + 1;
            int prod = 0xFFFF - a * ss, ds = (prod + (prod >> 8)) >> 8;
            px[o] = (byte)((r * ss + px[o] * ds) >> 8); px[o + 1] = (byte)((g * ss + px[o + 1] * ds) >> 8);
            px[o + 2] = (byte)((b * ss + px[o + 2] * ds) >> 8); px[o + 3] = (byte)((a * ss + px[o + 3] * ds) >> 8);
        }
    }
}
