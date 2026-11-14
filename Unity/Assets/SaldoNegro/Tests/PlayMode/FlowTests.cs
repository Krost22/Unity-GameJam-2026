// Las partidas completas (GameFlowLab.cs: intro y tutorial, primera deuda, bancarrota y rescate, la escalera, los
// dos finales, guardar y cargar) DENTRO de Unity, con la escena del juego: el DOM se refleja en UI Toolkit en cada
// fotograma de juego (estilos, texto pixel, lienzos), así que también se prueba la capa de Unity. Equivalen a los
// e2e de la web (tools/test/e2e*.test.js). Cualquier error en la consola de Unity hace fallar la prueba.
// La partida corre en un hilo aparte y, tras cada fotograma de juego, espera a que el hilo principal refleje el
// DOM y deje pasar un fotograma de Unity (UI Toolkit solo resuelve estilos y maqueta en el hilo principal).
// (El sonido va en silencio: sintetizar AudioClips es cosa del hilo principal y aquí no se escucha nada.)
using System;
using System.Collections;
using System.Threading;
using NUnit.Framework;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace SaldoNegro.Tests
{
    public class FlowTests
    {
        static readonly string[] FLOWS = { "Intro", "PrimeraDeuda", "Bancarrota", "EscaleraCompleta", "FinalA", "FinalB", "GuardarYCargar" };

        [UnityTest, Timeout(1800000)]
        public IEnumerator Partida([ValueSource(nameof(FLOWS))] string flow)
        {
            SceneManager.LoadScene("Main");
            yield return null;
            yield return null;
            var app = SaldoNegroApp.instance;
            Assert.IsNotNull(app, "la escena tiene el juego (SaldoNegroApp)");
            SaldoNegroApp.manualClock = true;

            var step = new SemaphoreSlim(0);   // la partida pide un fotograma
            var done = new SemaphoreSlim(0);   // el hilo principal lo ha reflejado
            bool finished = false;
            Exception failure = null;
            GameLab.read = (rel) =>
            {
                string p = rel.Replace("Resources/", "");
                int dot = p.LastIndexOf('.');
                return Resources.Load<TextAsset>(dot > 0 ? p.Substring(0, dot) : p).text;
            };
            GameLab.afterOpen = () => { Dom.host = app.view; SN.Audio.backend = null; SN.Audio.musicBackend = null; Dom.audioFactory = () => new SilentAudio(); };
            GameLab.afterFrame = () => { step.Release(); done.Wait(); };
            GameLab.log = (m) => Debug.Log(m);

            // (los recursos se cargan antes, en el hilo principal: Resources solo funciona ahí)
            var cache = new System.Collections.Generic.Dictionary<string, string>();
            foreach (var r in new[] { "Resources/SaldoNegro/Fonts.json", "Resources/SaldoNegro/Sprites.json", "Resources/SaldoNegro/Body.html", "Resources/SaldoNegro/Data.json" }) cache[r] = GameLab.read(r);
            GameLab.read = (rel) => cache[rel];

            var th = new Thread(() =>
            {
                try { typeof(GameFlowLab).GetMethod(flow).Invoke(null, null); }
                catch (System.Reflection.TargetInvocationException e) { failure = e.InnerException; }
                catch (Exception e) { failure = e; }
                finally { finished = true; step.Release(); }
            }, 16 << 20);
            th.Start();
            int frames = 0;
            while (true)
            {
                // (se espera sin ceder el fotograma: si Unity actualizase el panel con la partida corriendo, los
                // estilos se resolverían a la vez que el hilo cambia el DOM; ese cruce no pasa en el juego, que es de un hilo)
                step.Wait();
                if (finished) break;
                app.view.sync();
                if (++frames % 2 == 0) yield return null;
                done.Release();
            }
            SaldoNegroApp.manualClock = false;
            GameLab.afterFrame = null; GameLab.afterOpen = null;
            if (failure != null) Assert.Fail(flow + ": " + failure.Message + "\n" + failure.StackTrace);
            Debug.Log(flow + ": " + frames + " fotogramas de juego");
        }
    }
}
