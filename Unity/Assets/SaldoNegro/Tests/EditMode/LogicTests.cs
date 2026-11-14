// Pruebas de lógica pura (tools/test/logic.test.js traducido): un [Test] por bloque, en el mismo orden.
// La lógica está en LogicSuite.cs; aquí solo se reparte cada bloque y se comprueba que no hay fallos.
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace SaldoNegro.Tests
{
    public class LogicTests
    {
        [Test]
        public void Block01_FormulaYLimites()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block01_FormulaYLimites();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block02_RegresionApuestaComprometida()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block02_RegresionApuestaComprometida();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block03_BajaGanaPerdidaLimitada()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block03_BajaGanaPerdidaLimitada();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block04_Cobrar()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block04_Cobrar();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block05_Giros()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block05_Giros();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block06_PistaPredice()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block06_PistaPredice();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block07_PlazoDeuda()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block07_PlazoDeuda();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block08_MejorasYEventos()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block08_MejorasYEventos();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block10b_Multiplicador()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block10b_Multiplicador();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block11_EscaleraProgresion()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block11_EscaleraProgresion();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block12_TopesPorMercado()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block12_TopesPorMercado();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block13_DeudasPosteriores()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block13_DeudasPosteriores();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block14_Resistencia()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block14_Resistencia();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block09_Tutorial()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block09_Tutorial();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test, Category("Lenta"), Timeout(1800000)] // (en Mono tarda más de los 3 minutos que da NUnit por defecto)
        public void Block10_Equilibrio()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block10_Equilibrio();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test, Category("Lenta"), Timeout(1800000)] // (en Mono tarda más de los 3 minutos que da NUnit por defecto)
        public void Block15_PartidaEntera()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block15_PartidaEntera();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block19_Academia()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block19_Academia();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block20_PalabrasClave()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block20_PalabrasClave();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block21_NumerosRojos()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block21_NumerosRojos();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block22_Noticias()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block22_Noticias();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block16_PuntosDeControl()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block16_PuntosDeControl();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block17_IdiomaSecreto()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block17_IdiomaSecreto();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block18_DiasDeLaSuerte()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block18_DiasDeLaSuerte();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }

        [Test]
        public void Block2_0_HistoriaFinal()
        {
            var s = new LogicSuite(File.ReadAllText(Path.Combine(Application.dataPath, "SaldoNegro/Resources/SaldoNegro/Data.json")), Path.GetFullPath(Path.Combine(Application.dataPath, "../..")));
            s.Block2_0_HistoriaFinal();
            Assert.AreEqual(0, s.failed, string.Join("\n", s.failures));
        }
    }
}
