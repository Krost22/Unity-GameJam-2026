// El elemento del reflejo del DOM que pinta sombras de caja (box-shadow) y degradados (background-image).
// Se pinta en generateVisualContent, así que UI Toolkit lo pone encima del fondo y debajo de los hijos, como el
// navegador: sombras de fuera, degradado, sombras de dentro.
//   · Sombras sin desenfoque (la mayoría del juego): rectángulos exactos (lo que queda fuera o dentro de la caja).
//   · Con desenfoque (el #crt del monitor) y los degradados: una textura sin filtrado calculada píxel a píxel,
//     con la aproximación gaussiana de Chrome (sigma = desenfoque / 2) y su matriz de tramado 8x8.
// Las sombras llegan como propiedades USS (--sn-bs-N, --sn-bsc-N) que genera Unity/Tools~/css2uss.js.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class BoxElement : VisualElement
    {
        public struct Shadow { public bool inset; public float x, y, blur, spread; public Color color; }

        public const int MAX_SHADOWS = 10;
        // Sombras que se pintan: las de la hoja (baseShadows) o, mientras una @keyframes las controla, las de la animación
        public readonly List<Shadow> shadows = new List<Shadow>();
        public readonly List<Shadow> baseShadows = new List<Shadow>();
        bool animShadows;
        // capa(s) de degradado en CSS ya con las variables resueltas (null si no hay)
        public string gradient;

        string key = "";      // firma de lo que se pinta: si cambia, se rehace la textura
        Texture2D tex;        // textura de sombras con desenfoque y degradados
        Rect texRect;         // zona que cubre la textura (coordenadas locales)
        bool texDirty = true;
        float texW = -1, texH = -1; // tamaño con el que se hizo la textura

        public BoxElement() { generateVisualContent += paint; }

        // Lee las propiedades --sn-* de sombra y degradado del estilo resuelto
        static readonly CustomStyleProperty<string> P_BSN = new CustomStyleProperty<string>("--sn-bs-n");
        static readonly CustomStyleProperty<string> P_BG = new CustomStyleProperty<string>("--sn-background");
        static readonly CustomStyleProperty<string>[] P_BS = MakeStr();
        static readonly CustomStyleProperty<Color>[] P_BSC = MakeCol();
        static CustomStyleProperty<string>[] MakeStr()
        {
            var a = new CustomStyleProperty<string>[MAX_SHADOWS];
            for (int i = 0; i < a.Length; i++) a[i] = new CustomStyleProperty<string>("--sn-bs-" + i);
            return a;
        }
        static CustomStyleProperty<Color>[] MakeCol()
        {
            var a = new CustomStyleProperty<Color>[MAX_SHADOWS];
            for (int i = 0; i < a.Length; i++) a[i] = new CustomStyleProperty<Color>("--sn-bsc-" + i);
            return a;
        }

        // Llamado cuando UI Toolkit resuelve el estilo del elemento
        public static void readStyle(VisualElement v, DomElement e)
        {
            if (!(v is BoxElement b)) return;
            b.baseShadows.Clear();
            int n = 0;
            if (v.customStyle.TryGetValue(P_BSN, out var ns)) int.TryParse(ns.Trim('"'), out n);
            for (int i = 0; i < Math.Min(n, MAX_SHADOWS); i++)
            {
                if (!v.customStyle.TryGetValue(P_BS[i], out var g)) continue;
                var s = new Shadow();
                var parts = g.Trim('"', ' ').Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                int k = 0;
                if (parts.Length > 0 && parts[0] == "inset") { s.inset = true; k = 1; }
                float[] nums = new float[4];
                for (int j = 0; j < 4 && k + j < parts.Length; j++)
                    float.TryParse(parts[k + j], NumberStyles.Float, CultureInfo.InvariantCulture, out nums[j]);
                s.x = nums[0]; s.y = nums[1]; s.blur = Math.Max(0, nums[2]); s.spread = nums[3];
                s.color = v.customStyle.TryGetValue(P_BSC[i], out var c) ? c : v.resolvedStyle.color;
                b.baseShadows.Add(s);
            }
            inlineShadowColors(v, e, b.baseShadows);
            if (!b.animShadows) { b.shadows.Clear(); b.shadows.AddRange(b.baseShadows); }
            string bg = null;
            if (v.customStyle.TryGetValue(P_BG, out var bgs))
            {
                bg = CssVars.resolve(bgs, e);
                if (bg == null || !bg.Contains("gradient")) bg = null;
            }
            b.setLook(bg);
        }

        // USS solo conoce las variables de las hojas de estilo: las que el juego pone en línea (style.setProperty('--mk', ...)
        // en #app) no le llegan, y var(--mk) saldría con el valor de :root. Si la sombra usa una variable que un
        // antepasado define en línea, el color se toma del texto de box-shadow resuelto con esas variables.
        static readonly CustomStyleProperty<string> P_BOX = new CustomStyleProperty<string>("--sn-box-shadow");
        static void inlineShadowColors(VisualElement v, DomElement e, List<Shadow> shadows)
        {
            if (e == null || !v.customStyle.TryGetValue(P_BOX, out var raw) || !raw.Contains("var(")) return;
            bool inline = false;
            foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(raw, @"var\(\s*(--[\w-]+)"))
                for (var p = e; p != null && !inline; p = p.parentElement) if (!string.IsNullOrEmpty(p.style[m.Groups[1].Value])) inline = true;
            if (!inline) return;
            var list = CssVars.splitTop(CssVars.resolve(raw, e), ',');
            for (int i = 0; i < Math.Min(list.Count, shadows.Count); i++)
                foreach (var tok in CssVars.splitTop(list[i].Trim(), ' '))
                {
                    if (tok == "inset" || char.IsDigit(tok[0]) || tok[0] == '-' || tok[0] == '.') continue;
                    try { var c = CssColor.parse(tok); var sh = shadows[i]; sh.color = new Color(c.r / 255f, c.g / 255f, c.b / 255f, (float)c.a); shadows[i] = sh; } catch (Exception) { }
                }
        }

        // box-shadow dentro de una @keyframes: manda sobre la hoja hasta que la animación lo suelta
        public void setAnimShadows(List<Shadow> list)
        {
            animShadows = true;
            shadows.Clear(); shadows.AddRange(list);
            setLook(gradient);
        }
        public void clearAnimShadows()
        {
            if (!animShadows) return;
            animShadows = false;
            shadows.Clear(); shadows.AddRange(baseShadows);
            setLook(gradient);
        }

        void setLook(string grad)
        {
            var sb = new StringBuilder();
            foreach (var s in shadows) sb.Append(s.inset ? "i" : "o").Append(s.x).Append(',').Append(s.y).Append(',').Append(s.blur).Append(',').Append(s.spread).Append(',').Append(s.color).Append(';');
            sb.Append('|').Append(grad);
            string k = sb.ToString();
            if (k == key) return;
            key = k;
            gradient = grad;
            texDirty = true;
            MarkDirtyRepaint();
        }

        void paint(MeshGenerationContext mgc)
        {
            float w = layout.width, h = layout.height;
            if (float.IsNaN(w) || float.IsNaN(h) || w <= 0 || h <= 0) return;
            var box = new Rect(0, 0, w, h);
            // 1. sombras de fuera sin desenfoque (rectángulos fuera de la caja; la primera queda encima)
            for (int i = shadows.Count - 1; i >= 0; i--)
            {
                var s = shadows[i];
                if (s.inset || s.blur > 0 || s.color.a <= 0) continue;
                fillMinus(mgc, new Rect(s.x - s.spread, s.y - s.spread, w + 2 * s.spread, h + 2 * s.spread), box, s.color);
            }
            // 2. textura: sombras con desenfoque de fuera, degradado y sombras de dentro con desenfoque
            if (texDirty || w != texW || h != texH) build(w, h);
            if (tex != null) quad(mgc, texRect, tex);
            // 3. sombras de dentro sin desenfoque (encima del fondo y debajo de los hijos)
            for (int i = shadows.Count - 1; i >= 0; i--)
            {
                var s = shadows[i];
                if (!s.inset || s.blur > 0 || s.color.a <= 0) continue;
                fillMinus(mgc, box, new Rect(s.x + s.spread, s.y + s.spread, w - 2 * s.spread, h - 2 * s.spread), s.color);
            }
        }

        // Rectángulo A menos el hueco H (4 trozos como mucho)
        static void fillMinus(MeshGenerationContext mgc, Rect a, Rect hole, Color c)
        {
            float x0 = Math.Max(a.xMin, hole.xMin), x1 = Math.Min(a.xMax, hole.xMax);
            float y0 = Math.Max(a.yMin, hole.yMin), y1 = Math.Min(a.yMax, hole.yMax);
            if (hole.width <= 0 || hole.height <= 0 || x1 <= x0 || y1 <= y0) { solid(mgc, a, c); return; }
            if (y0 > a.yMin) solid(mgc, new Rect(a.xMin, a.yMin, a.width, y0 - a.yMin), c);
            if (a.yMax > y1) solid(mgc, new Rect(a.xMin, y1, a.width, a.yMax - y1), c);
            if (x0 > a.xMin) solid(mgc, new Rect(a.xMin, y0, x0 - a.xMin, y1 - y0), c);
            if (a.xMax > x1) solid(mgc, new Rect(x1, y0, a.xMax - x1, y1 - y0), c);
        }

        static void solid(MeshGenerationContext mgc, Rect r, Color c)
        {
            if (r.width <= 0 || r.height <= 0) return;
            var mesh = mgc.Allocate(4, 6, Texture2D.whiteTexture);
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMin, Vertex.nearZ), tint = c, uv = Vector2.zero });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMin, Vertex.nearZ), tint = c, uv = Vector2.zero });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMax, Vertex.nearZ), tint = c, uv = Vector2.zero });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMax, Vertex.nearZ), tint = c, uv = Vector2.zero });
            mesh.SetNextIndex(0); mesh.SetNextIndex(1); mesh.SetNextIndex(2);
            mesh.SetNextIndex(2); mesh.SetNextIndex(3); mesh.SetNextIndex(0);
        }

        static void quad(MeshGenerationContext mgc, Rect r, Texture2D t)
        {
            var mesh = mgc.Allocate(4, 6, t);
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMin, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMin, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMax, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 1) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMax, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 1) });
            mesh.SetNextIndex(0); mesh.SetNextIndex(1); mesh.SetNextIndex(2);
            mesh.SetNextIndex(2); mesh.SetNextIndex(3); mesh.SetNextIndex(0);
        }

        // Textura de la zona de la caja más el margen que necesitan las sombras con desenfoque de fuera
        void build(float w, float h)
        {
            texDirty = false; texW = w; texH = h;
            float margin = 0;
            foreach (var s in shadows)
                if (!s.inset && s.blur > 0) margin = Math.Max(margin, 3 * s.blur / 2 + Math.Abs(s.x) + Math.Abs(s.y) + Math.Abs(s.spread) + 1);
            int mg = Mathf.CeilToInt(margin);
            texRect = new Rect(-mg, -mg, w + 2 * mg, h + 2 * mg);
            bool any = gradient != null || shadows.Exists(s => s.blur > 0);
            if (!any) { if (tex != null) { destroy(tex); tex = null; } return; }
            int tw = Mathf.Max(1, Mathf.RoundToInt(texRect.width)), th = Mathf.Max(1, Mathf.RoundToInt(texRect.height));
            var layers = gradient != null ? CssGradient.layers(gradient, w, h) : null;
            var px = new Color32[tw * th];
            var box = new Rect(0, 0, w, h);
            for (int y = 0; y < th; y++)
            {
                for (int x = 0; x < tw; x++)
                {
                    // punto en coordenadas locales de la caja (el centro del píxel)
                    float qx = texRect.xMin + x + 0.5f, qy = texRect.yMin + y + 0.5f;
                    bool inside = box.Contains(new Vector2(qx, qy));
                    var acc = new Acc();
                    // sombras con desenfoque de fuera (de la última a la primera)
                    for (int i = shadows.Count - 1; i >= 0; i--)
                    {
                        var s = shadows[i];
                        if (s.inset || s.blur <= 0 || inside || s.color.a <= 0) continue;
                        var r = new Rect(s.x - s.spread, s.y - s.spread, w + 2 * s.spread, h + 2 * s.spread);
                        double sigma = s.blur / 2.0;
                        double a = s.color.a * (1 - Gauss.cdf(Sdf(qx, qy, r) / sigma));
                        acc.over(s.color, a);
                    }
                    // degradado (solo dentro de la caja)
                    if (layers != null && inside)
                        foreach (var layer in layers) acc.over(layer(qx, qy));
                    // sombras con desenfoque de dentro
                    for (int i = shadows.Count - 1; i >= 0; i--)
                    {
                        var s = shadows[i];
                        if (!s.inset || s.blur <= 0 || !inside || s.color.a <= 0) continue;
                        var r = new Rect(s.x + s.spread, s.y + s.spread, w - 2 * s.spread, h - 2 * s.spread);
                        double sigma = s.blur / 2.0;
                        double a = s.color.a * Gauss.cdf(Sdf(qx, qy, r) / sigma);
                        acc.over(s.color, a);
                    }
                    // la textura va de arriba abajo, como los lienzos (la fila 0 es la de arriba)
                    px[y * tw + x] = acc.toColor32(x, y);
                }
            }
            if (tex == null || tex.width != tw || tex.height != th)
            {
                if (tex != null) destroy(tex);
                tex = new Texture2D(tw, th, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.HideAndDontSave };
            }
            tex.SetPixels32(px);
            tex.Apply(false, false);
        }

        // Distancia con signo de un punto a un rectángulo (negativa dentro)
        static double Sdf(double px, double py, Rect r)
        {
            double dx = Math.Max(r.xMin - px, px - r.xMax), dy = Math.Max(r.yMin - py, py - r.yMax);
            double outside = Math.Sqrt(Math.Max(dx, 0) * Math.Max(dx, 0) + Math.Max(dy, 0) * Math.Max(dy, 0));
            return outside + Math.Min(Math.Max(dx, dy), 0);
        }

        // Composición "encima" no premultiplicada acumulada en un píxel
        struct Acc
        {
            public double r, g, b, a;
            public void over(Color c, double alpha) { over(new Color(c.r, c.g, c.b, (float)alpha)); }
            public void over(Color src)
            {
                double sa = src.a;
                if (sa <= 0) return;
                double oa = sa + a * (1 - sa);
                if (oa <= 0) return;
                r = (src.r * sa + r * a * (1 - sa)) / oa;
                g = (src.g * sa + g * a * (1 - sa)) / oa;
                b = (src.b * sa + b * a * (1 - sa)) / oa;
                a = oa;
            }
            // Pasa a bytes con el tramado 8x8 de Chrome (igual que Stage.cs: sumar entre -63/128 y +63/128)
            public Color32 toColor32(int x, int y)
            {
                int Y = y ^ x;
                int M = (Y & 1) << 5 | (x & 1) << 4 | (Y & 2) << 2 | (x & 2) << 1 | (Y & 4) >> 1 | (x & 4) >> 2;
                double dither = M * (2 / 128.0) - 63 / 128.0;
                return new Color32(Level(r * 255 + dither), Level(g * 255 + dither), Level(b * 255 + dither), Level(a * 255));
            }
            static byte Level(double v) { long n = (long)Math.Round(v); return (byte)(n < 0 ? 0 : n > 255 ? 255 : n); }
        }

        static void destroy(UnityEngine.Object o)
        {
            if (Application.isPlaying) UnityEngine.Object.Destroy(o); else UnityEngine.Object.DestroyImmediate(o);
        }
    }

    // Distribución normal (aproximación de erf de Abramowitz y Stegun 7.1.26, error < 1.5e-7)
    static class Gauss
    {
        public static double cdf(double x) { return 0.5 * (1 + erf(x / Math.Sqrt(2))); }
        static double erf(double x)
        {
            double sign = x < 0 ? -1 : 1; x = Math.Abs(x);
            double t = 1 / (1 + 0.3275911 * x);
            double y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.Exp(-x * x);
            return sign * y;
        }
    }
}
