// El lienzo del port contra Chrome (ver CanvasSuite.cs).
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace SaldoNegro.Tests
{
    public class CanvasTests
    {
        static CanvasSuite suite;
        static CanvasSuite S
        {
            get
            {
                if (suite == null)
                {
                    PxFont.source = () => File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Fonts.json"));
                    suite = new CanvasSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Tests/EditMode/Refs/CanvasRefs.json")));
                }
                return suite;
            }
        }
        static IEnumerable<string> Casos() { return S.names(); }

        [TestCaseSource(nameof(Casos))]
        public void Lienzo_igual_que_Chrome(string caso)
        {
            string r = S.run(caso, out _, out _, out _, out _, out int edge);
            if (edge > 0) Debug.Log(caso + " (aproximado): " + edge + " bytes de borde distintos de Chrome");
            Assert.IsNull(r, r);
        }
    }
}
