// Las piezas que imitan a JavaScript se comportan como JavaScript (valores comprobados en Node).
using NUnit.Framework;
using SaldoNegro.Logic;

namespace SaldoNegro.Tests
{
    public class JsTests
    {
        [Test]
        public void Math_round_redondea_los_medios_hacia_arriba()
        {
            Assert.AreEqual(3, JsMath.round(2.5));
            Assert.AreEqual(-2, JsMath.round(-2.5));
            Assert.AreEqual(2, JsMath.round(1.5));
            Assert.AreEqual(1, JsMath.round(0.5));
            Assert.AreEqual(0, JsMath.round(-0.5));
            Assert.AreEqual(0, JsMath.round(0.49999999999999994));
            Assert.AreEqual(-1, JsMath.round(-0.5000000000000001));
            Assert.AreEqual(4503599627370497.0, JsMath.round(4503599627370497.0));
            Assert.AreEqual(7, JsMath.round(7.4999));
        }

        [Test]
        public void Los_numeros_se_escriben_como_en_JS()
        {
            Assert.AreEqual("0", Js.numberToString(0));
            Assert.AreEqual("1234", Js.numberToString(1234));
            Assert.AreEqual("-7", Js.numberToString(-7));
            Assert.AreEqual("0.5", Js.numberToString(0.5));
            Assert.AreEqual("0.30000000000000004", Js.numberToString(0.1 + 0.2));
            Assert.AreEqual("0.1", Js.numberToString(0.1));
            Assert.AreEqual("1.0004", Js.numberToString(1.0004));
            Assert.AreEqual("0.000001", Js.numberToString(0.000001));
            Assert.AreEqual("1e-7", Js.numberToString(0.0000001));
            Assert.AreEqual("1.5e-7", Js.numberToString(0.00000015));
            Assert.AreEqual("100000000000000000000", Js.numberToString(1e20));
            Assert.AreEqual("1e+21", Js.numberToString(1e21));
            Assert.AreEqual("1.2345678901234568e+21", Js.numberToString(1234567890123456789012.0));
            Assert.AreEqual("123456789012345680000", Js.numberToString(123456789012345678901.0));
            Assert.AreEqual("5e-324", Js.numberToString(double.Epsilon));
            Assert.AreEqual("1.7976931348623157e+308", Js.numberToString(double.MaxValue));
            Assert.AreEqual("4.35", Js.numberToString(4.35));
            Assert.AreEqual("9007199254740993000", Js.numberToString(9007199254740993000.0));
            Assert.AreEqual("NaN", Js.numberToString(double.NaN));
            Assert.AreEqual("-Infinity", Js.numberToString(double.NegativeInfinity));
        }

        [Test]
        public void Los_objetos_guardan_el_orden_de_claves_de_JS()
        {
            var o = new JsObject();
            o["b"] = 1; o["10"] = 2; o["a"] = 3; o["2"] = 4; o["01"] = 5; o["-1"] = 6;
            CollectionAssert.AreEqual(new[] { "2", "10", "b", "a", "01", "-1" }, o.keys());
            o.delete("b"); o["b"] = 7;
            CollectionAssert.AreEqual(new[] { "2", "10", "a", "01", "-1", "b" }, o.keys());
            Assert.IsTrue(o["no-existe"].isUndefined);
            Assert.IsFalse(o.has("no-existe"));
        }

        [Test]
        public void JSON_parse_lee_todos_los_tipos()
        {
            var o = Json.obj(Json.parse("{ \"n\": -12.5e1, \"s\": \"a\\n\\u00f1\\\"\", \"t\": true, \"f\": false, \"z\": null, \"a\": [1, [2], {}], \"o\": { \"k\": \"v\" } }"));
            Assert.AreEqual(-125.0, o["n"].num);
            Assert.AreEqual("a\nñ\"", o["s"].str);
            Assert.IsTrue(o["t"] == true);
            Assert.IsTrue(o["f"] == false);
            Assert.IsTrue(o["z"].isNull);
            Assert.IsTrue(o.has("z"));
            Assert.AreEqual(3, Json.arr(o["a"]).Count);
            Assert.AreEqual("v", Json.obj(o["o"])["k"].str);
            Assert.Throws<System.FormatException>(() => Json.parse("{ \"a\": 1, }"));
            Assert.Throws<System.FormatException>(() => Json.parse("[1] x"));
        }
    }
}
