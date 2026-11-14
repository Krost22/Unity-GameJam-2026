// El dibujo de js/render contra Chrome (ver DrawSuite.cs): sprites, personajes y la habitación.
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace SaldoNegro.Tests
{
    public class DrawTests
    {
        static readonly Dictionary<string, DrawSuite> suites = new Dictionary<string, DrawSuite>();
        static string A(string rel) { return Path.Combine(Application.dataPath, "SaldoNegro", rel); }
        static DrawSuite S(string group)
        {
            if (!suites.TryGetValue(group, out var s))
            {
                PxFont.source = () => File.ReadAllText(A("Resources/SaldoNegro/Fonts.json"));
                Sprites.source = () => File.ReadAllText(A("Resources/SaldoNegro/Sprites.json"));
                suites[group] = s = new DrawSuite(File.ReadAllText(A("Tests/EditMode/Refs/Draw-" + group + ".json")), File.ReadAllText(A("Resources/SaldoNegro/Data.json")));
            }
            return s;
        }
        static IEnumerable<TestCaseData> Cases(string group)
        {
            if (!File.Exists(A("Tests/EditMode/Refs/Draw-" + group + ".json"))) yield break;
            var s = S(group);
            for (int i = 0; i < s.count; i++) yield return new TestCaseData(group, i).SetName(group + " " + s.label(i));
        }
        static IEnumerable<TestCaseData> Todos() { foreach (var g in new[] { "sprites", "chars", "room", "news" }) foreach (var c in Cases(g)) yield return c; }

        [TestCaseSource(nameof(Todos))]
        public void Dibujo_igual_que_Chrome(string group, int i)
        {
            string r = S(group).run(i, out _, out _, out _, out _);
            Assert.IsNull(r, r);
        }
    }
}
