// Semilla fija contra la web en Chrome (ver GoldenSuite.cs) y Math de V8 bit a bit (ver MathSuite.cs).
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace SaldoNegro.Tests
{
    public class GoldenTests
    {
        static string A(string rel) { return File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro", rel)); }
        static GoldenSuite make() { return new GoldenSuite(A("Resources/SaldoNegro/Data.json"), A("Tests/EditMode/Refs/GoldenRefs.json")); }

        [Test] public void Generador_igual_que_Chrome() { var g = make(); g.Rng(); Assert.IsEmpty(g.failures, string.Join("\n", g.failures)); }
        [Test] public void Textos_igual_que_Chrome() { var g = make(); g.Textos(); Assert.IsEmpty(g.failures, string.Join("\n", g.failures)); }

        [Test, Category("Lenta")]
        public void Partidas_con_semilla_fija_igual_que_Chrome([Values(0, 1, 2, 3, 4)] int index)
        {
            var g = make();
            g.Partida(index);
            foreach (var l in g.log) Debug.Log(l);
            Assert.IsEmpty(g.failures, string.Join("\n", g.failures));
        }

        [Test]
        public void Math_igual_que_Chrome([Values("sin", "cos", "exp", "log", "log10", "pow", "hypot")] string fn)
        {
            var m = new MathSuite(A("Tests/EditMode/Refs/MathRefs.json"));
            var fails = m.check(fn, out int n);
            Assert.IsEmpty(fails, fn + " (" + n + " casos):\n" + string.Join("\n", fails));
        }
    }
}
