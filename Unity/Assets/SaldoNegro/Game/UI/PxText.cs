// Texto de la interfaz con la fuente pixel: un trozo de texto (una "caja de línea" del navegador) pintado con el
// mismo rasterizador que los lienzos (Draw/Canvas.cs fillText, comprobado contra Chrome) en una textura sin
// filtrado. Lo que en la web es un nodo de texto dentro de un elemento.
//   · Mide como el navegador: ancho = suma de avances (+ letter-spacing por letra), alto = line-height.
//   · La línea base cae donde la pone Chrome: arriba + (line-height - 12 * tamaño/8) / 2 + 10 * tamaño/8, con la
//     mitad del interlineado redondeada hacia abajo arriba (la fuente mide 10 sobre la base y 2 debajo).
//   · Sombras de texto (text-shadow: x y 0 color, la "negrita pixel" del juego): se pintan antes, desplazadas.
// El color, el tamaño y el interlineado los da el estilo (USS y propiedades --sn-*), los lee el reflejo del DOM.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class PxText : VisualElement
    {
        public struct Shadow { public int dx, dy; public string color; }

        string text = "";
        string colorCss = "#F8F4FF";
        int size = 8;
        int lineHeight = 10;
        double letterSpacing = 0;
        readonly List<Shadow> shadows = new List<Shadow>();
        bool dirty = true;
        Canvas canvas;
        Texture2D tex;
        int padL, padR, padT, padB; // margen para las sombras (la caja no crece: se dibuja por fuera)

        public PxText() { pickingMode = PickingMode.Ignore; generateVisualContent += paint; }
        public PxText(string t) : this() { this.text = t ?? ""; }

        public string value { get { return text; } set { if (value == text) return; text = value ?? ""; dirty = true; relayout(); } }
        public void setStyle(string color, int size, int lineHeight, double letterSpacing, IList<Shadow> sh)
        {
            bool ch = color != colorCss || size != this.size || lineHeight != this.lineHeight || letterSpacing != this.letterSpacing || sh.Count != shadows.Count;
            if (!ch) for (int i = 0; i < sh.Count; i++) if (sh[i].dx != shadows[i].dx || sh[i].dy != shadows[i].dy || sh[i].color != shadows[i].color) { ch = true; break; }
            if (!ch) return;
            colorCss = color; this.size = size; this.lineHeight = lineHeight; this.letterSpacing = letterSpacing;
            shadows.Clear(); shadows.AddRange(sh);
            dirty = true; relayout();
        }

        public double textWidth
        {
            get
            {
                var f = PxFont.SaldoPixel;
                double w = f.width(text) * (size / 8);
                if (letterSpacing != 0) w += letterSpacing * JsString.chars(text).length;
                return w;
            }
        }

        void relayout()
        {
            style.width = (float)textWidth;
            style.height = lineHeight;
            MarkDirtyRepaint();
        }

        void build()
        {
            dirty = false;
            int w = Math.Max(1, (int)Math.Ceiling(textWidth)), h = Math.Max(1, lineHeight);
            padL = padR = padT = padB = 0;
            foreach (var s in shadows) { padL = Math.Max(padL, -s.dx); padR = Math.Max(padR, s.dx); padT = Math.Max(padT, -s.dy); padB = Math.Max(padB, s.dy); }
            // la fuente baja 2 * escala por debajo de la base: que quepa aunque el interlineado sea pequeño
            int s8 = size / 8;
            int baseline = (int)Math.Floor((lineHeight - 12 * s8) / 2.0) + 10 * s8;
            int top = Math.Min(0, baseline - 10 * s8), bottom = Math.Max(h, baseline + 2 * s8);
            int CW = w + padL + padR, CH = (bottom - top) + padT + padB;
            if (canvas == null || canvas.width != CW || canvas.height != CH) canvas = new Canvas(CW, CH);
            else Array.Clear(canvas.data, 0, canvas.data.Length);
            var g = Px.ctx(canvas);
            g.font = size + "px SaldoPixel";
            g.textAlign = "left";
            double x0 = padL, by = padT - top + baseline;
            foreach (var sh in shadows) draw(g, x0 + sh.dx, by + sh.dy, sh.color);
            draw(g, x0, by, colorCss);
            if (tex == null || tex.width != CW || tex.height != CH)
            {
                if (tex != null) UnityEngine.Object.Destroy(tex);
                tex = new Texture2D(CW, CH, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            }
            tex.SetPixelData(canvas.data, 0);
            tex.Apply(false);
            texTop = top - padT;
        }
        int texTop;

        void draw(Ctx2D g, double x, double y, string color)
        {
            g.fillStyle = color;
            if (letterSpacing == 0) { g.fillText(text, x, y); return; }
            // con letter-spacing, letra a letra (como el navegador: el espacio va detrás de cada letra)
            foreach (var ch in JsString.codePoints(text))
            {
                g.fillText(ch, x, y);
                x += g.measureText(ch).width + letterSpacing;
            }
        }

        void paint(MeshGenerationContext mgc)
        {
            if (text.Length == 0) return;
            if (dirty || tex == null) build();
            float x0 = -padL, y0 = texTop, w = canvas.width, h = canvas.height;
            var mesh = mgc.Allocate(4, 6, tex);
            mesh.SetNextVertex(new Vertex { position = new Vector3(x0, y0, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(x0 + w, y0, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(x0 + w, y0 + h, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 1) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(x0, y0 + h, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 1) });
            mesh.SetNextIndex(0); mesh.SetNextIndex(1); mesh.SetNextIndex(2);
            mesh.SetNextIndex(0); mesh.SetNextIndex(2); mesh.SetNextIndex(3);
        }

        public void dispose() { if (tex != null) UnityEngine.Object.Destroy(tex); tex = null; }
    }
}
