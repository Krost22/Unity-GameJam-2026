// El encuadre del escenario sale igual que en la web para cada tamaño de ventana.
// Refs/StageRefs.json lo genera Unity/Tools~/ref-stage.js: son los valores que calcula SN.Game (layout y applyCam)
// en Chrome: escala base, modo ('full' o 'monitor', con la cámara acercada en ventanas pequeñas) y traslación.
using System.IO;
using NUnit.Framework;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro.Tests
{
    public class StageTests
    {
        [Test]
        public void El_encuadre_coincide_con_la_web_en_cada_ventana()
        {
            var refs = Json.obj(Json.parse(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Tests/EditMode/Refs/StageRefs.json"))));
            var stage = new Stage(new VisualElement());
            int n = 0;
            foreach (var sv in Json.arr(refs["sizes"]))
            {
                var s = Json.obj(sv);
                int w = Json.integer(s["w"]), h = Json.integer(s["h"]);
                stage.layout(w, h);
                string at = w + "x" + h;
                Assert.AreEqual(Json.num(s["base"]), stage.@base, at + ": escala base");
                Assert.AreEqual(Json.str(s["mode"]), stage.mode, at + ": modo");
                Assert.AreEqual(Json.num(s["tx"]), stage.tx, at + ": tx");
                Assert.AreEqual(Json.num(s["ty"]), stage.ty, at + ": ty");
                Assert.AreEqual(Json.num(s["z"]), stage.z, at + ": z");
                n++;
            }
            Assert.GreaterOrEqual(n, 10, "tamaños comprobados");
        }

        static Color32 pixel(Canvas c, int i) { return new Color32(c.data[i * 4], c.data[i * 4 + 1], c.data[i * 4 + 2], c.data[i * 4 + 3]); }

        [Test]
        public void La_carta_de_ajuste_llena_el_lienzo_de_la_habitacion()
        {
            var c = new Canvas(Stage.ROOM_W, Stage.ROOM_H);
            Stage.testPattern(c);
            Assert.AreEqual(new Color32(255, 255, 255, 255), pixel(c, 0), "marco");
            Assert.AreEqual(new Color32(0, 0, 0, 255), pixel(c, 9 * 320 + 9), "damero (9,9)");
            Assert.AreEqual(new Color32(255, 255, 255, 255), pixel(c, 9 * 320 + 10), "damero (10,9)");
            Assert.AreEqual(new Color32((100 * 7 + 50 * 13) & 255, ((100 ^ 50) * 3) & 255, (100 * 50) & 255, 255), pixel(c, 50 * 320 + 100), "fórmula (100,50)");
        }
    }
}
