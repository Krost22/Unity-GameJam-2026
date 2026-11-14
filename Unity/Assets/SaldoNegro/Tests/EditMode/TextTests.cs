// El texto de los lienzos sale igual que en Chrome.
// Las referencias (Refs/TextRefs.json) las genera Unity/Tools~/ref-text.js: es lo que pinta el SN.Px.text de la
// web en Chrome sin GPU, sobre fondo transparente (así el alfa de cada píxel es su cobertura).
//   · Texto en píxel entero: el NÚCLEO de la referencia (alfa >= 170) tiene que ser exactamente lo que pinta el
//     port. Por debajo queda el halo de ClearType de Windows (152 como mucho), que no se copia: depende del
//     sistema operativo, no del juego.
//   · Texto a medio píxel (centrado de ancho impar): tiene que coincidir el centro de masas horizontal y las
//     filas ocupadas (el halo es simétrico y no los mueve).
using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using SaldoNegro.Logic;
using UnityEngine;

namespace SaldoNegro.Tests
{
    public class TextTests
    {
        const int CORE = 170;

        static V refs;
        static V Refs
        {
            get
            {
                if (refs is null) refs = Json.parse(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Tests/EditMode/Refs/TextRefs.json")));
                return refs;
            }
        }
        static TextTests() { PxFont.source = () => File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Fonts.json")); }

        static IEnumerable<string> CaseNames()
        {
            foreach (var c in Json.arr(Refs["cases"])) yield return Json.str(Json.obj(c)["name"]);
        }

        struct Box { public int x0, x1, y0, y1; public bool whole; public string t; }

        [TestCaseSource(nameof(CaseNames))]
        public void Texto_de_lienzo_igual_que_Chrome(string name)
        {
            JsObject k = null;
            foreach (var c in Json.arr(Refs["cases"])) if (Json.str(Json.obj(c)["name"]) == name) k = Json.obj(c);
            int w = Json.integer(k["w"]), h = Json.integer(k["h"]);
            byte[] web = Convert.FromBase64String(Json.str(k["alpha"])); // la cobertura (alfa) de cada píxel en Chrome
            Assert.AreEqual(w * h, web.Length, "tamaño de la referencia");

            var canvas = Px.canvas(w, h);
            var g = Px.ctx(canvas);
            var boxes = new List<Box>();
            bool allWhole = true;
            foreach (var dv in Json.arr(k["draws"]))
            {
                var d = Json.obj(dv);
                int size = d.has("size") ? Json.integer(d["size"]) : 8;
                string align = d.has("align") ? Json.str(d["align"]) : null;
                string outline = d.has("outline") ? Json.str(d["outline"]) : null;
                double x = Json.num(d["x"]), y = Json.num(d["y"]);
                Px.text(g, d["t"], x, y, Json.str(d["c"]), size, align, outline);

                // Dónde cae este texto y si empieza en un píxel entero
                string str = Js.String(d["t"]);
                int s = size / 8;
                double tw = PxFont.SaldoPixel.width(str) * s, rx = JsMath.round(x), ry = JsMath.round(y);
                double pen = align == "center" ? rx - tw / 2 : align == "right" ? rx - tw : rx;
                bool whole = pen == Math.Floor(pen);
                allWhole &= whole;
                boxes.Add(new Box { x0 = (int)Math.Floor(pen) - 2, x1 = (int)Math.Ceiling(pen + tw) + 2, y0 = (int)ry - 10 * s, y1 = (int)ry + 2 * s, whole = whole, t = str });
            }
            if (allWhole) { boxes.Clear(); boxes.Add(new Box { x0 = 0, x1 = w, y0 = 0, y1 = h, whole = true, t = "(todo el lienzo)" }); }

            var fails = new List<string>();
            foreach (var b in boxes)
            {
                int x0 = Math.Max(0, b.x0), x1 = Math.Min(w, b.x1), y0 = Math.Max(0, b.y0), y1 = Math.Min(h, b.y1);
                if (b.whole)
                {
                    int n = 0; string first = null;
                    for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++)
                    {
                        byte mine = canvas.data[(y * w + x) * 4 + 3], chrome = web[y * w + x];
                        if (mine != 0 && mine != 255) { n++; if (first == null) first = x + "," + y + " a medias (alfa " + mine + ")"; continue; }
                        if ((mine == 255) != (chrome >= CORE)) { n++; if (first == null) first = x + "," + y + (mine == 255 ? " sobra" : " falta") + " (alfa de Chrome " + chrome + ")"; }
                    }
                    if (n > 0) fails.Add("\"" + b.t + "\": " + n + " píxeles distintos, p. ej. " + first);
                }
                else
                {
                    double sm = 0, mm = 0, sr = 0, mr = 0; int rowsBad = 0;
                    for (int y = y0; y < y1; y++)
                    {
                        double rm = 0, rr = 0;
                        for (int x = x0; x < x1; x++)
                        {
                            double mine = canvas.data[(y * w + x) * 4 + 3], chrome = web[y * w + x];
                            sm += mine; mm += mine * (x + 0.5); rm += mine;
                            sr += chrome; mr += chrome * (x + 0.5); rr += chrome;
                        }
                        if ((rm > 0) != (rr > 0)) rowsBad++;
                    }
                    double dx = mm / sm - mr / sr;
                    if (Math.Abs(dx) > 0.06 || rowsBad > 0) fails.Add("\"" + b.t + "\": centro desplazado " + dx.ToString("0.000") + " px, filas distintas " + rowsBad);
                }
            }
            Assert.IsEmpty(fails, name + ":\n" + string.Join("\n", fails));
        }

        [Test]
        public void Anchos_igual_que_measureText()
        {
            var g = Px.ctx(Px.canvas(4, 4));
            foreach (var wv in Json.arr(Refs["widths"]))
            {
                var wd = Json.obj(wv);
                string t = Json.str(wd["t"]);
                Assert.AreEqual(Json.num(wd["w8"]), Px.textWidth(g, t), "ancho a 8 px de \"" + t + "\"");
                Assert.AreEqual(Json.num(wd["w16"]), Px.textWidth(g, t, 16), "ancho a 16 px de \"" + t + "\"");
            }
        }

        [Test]
        public void Las_dos_fuentes_cargan_con_sus_glifos()
        {
            Assert.IsTrue(PxFont.SaldoPixel.has('A') && PxFont.SaldoPixel.has('ñ') && PxFont.SaldoPixel.has('Ж') && PxFont.SaldoPixel.has('▲'));
            Assert.AreEqual(6, PxFont.SaldoPixel.glyph('A').adv, "avance de la A");
            Assert.AreEqual(4, PxFont.SaldoPixel.glyph(' ').adv, "avance del espacio");
            // SaldoNum: cifras de ancho fijo (7) para que las cantidades no bailen
            foreach (char c in "0123456789") Assert.AreEqual(7, PxFont.SaldoNum.glyph(c).adv, "avance de " + c + " en SaldoNum");
            Assert.IsFalse(PxFont.SaldoNum.has('A'), "SaldoNum no tiene letras: las pone SaldoPixel");
            // Una minúscula sin glifo propio usa el de la mayúscula (ж -> Ж)
            CollectionAssert.AreEqual(PxFont.SaldoPixel.glyph('Ж').rows, PxFont.SaldoPixel.glyph('ж').rows);
        }

        [Test]
        public void Los_13_caracteres_que_no_trae_la_fuente_de_la_web_tienen_glifo()
        {
            foreach (char c in "«»−ºª©à∞⏎⌨░▒▓")
            {
                Assert.IsTrue(PxFont.SaldoPixel.has(c), "falta el glifo de " + c);
                int ink = 0;
                foreach (int r in PxFont.SaldoPixel.glyph(c).rows) ink |= r;
                Assert.AreNotEqual(0, ink, "glifo vacío: " + c);
            }
        }
    }
}
