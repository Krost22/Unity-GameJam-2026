// Port de js/systems/tutorial.js (SN.Tutorial). TutorialManager: se aprende haciendo, con frases cortas. Obligatorio en la
// primera partida y repetible desde AJUSTES (al repetirlo, la partida se restaura tal y como estaba).
// 1. La PISTA de la gráfica.  2. SUBE.  3. COBRAR a tiempo.  4. Ver el susto de las últimas velas
// desde fuera.  5. Apuesta y multiplicador.  6. Las noticias (y una "errata" que "no es relevante").
// 7. Mejoras y Tienda (y el número rojo cuando hay algo que comprar).  8. La meta.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Tutorial : ITutorialFlags
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public const int VERSION = 4; // si cambia, los jugadores que hicieron el tutorial antiguo ven el nuevo (4: mejoras y tienda)
        public bool active { get; set; }
        public bool replaying { get; set; }
        public bool controlledTrade;

        public async Promise run(V opts = null)
        {
            var UI = SN.UI;
            // (V sobrecarga == y !=: un null de C# se comprueba con "is null", no con "!= null")
            bool replay = !(opts is null) && opts["replay"].truthy;
            V snapshot = V.@null;
            if (replay) snapshot = Util.copy(S.run);
            if (replay)
            {
                // El repaso se juega en una partida de práctica idéntica a la primera ($100, día 1, solo Salud).
                // Mientras dura no se guarda nada: la partida real queda intacta en el guardado.
                replaying = true;
                S.newRun();
                S.run["cipher"] = Util.copy(snapshot["cipher"] || V.Obj("known", V.Obj(), "found", V.Obj())); // las letras que ya tenías
                SN.Chart.setMarket(S.run["selected"]);
                SN.Desk.dirty();
            }
            setup();
            active = true;
            SN.Game.setState("TUTORIAL");
            UI.allow = V.Arr();
            UI.renderAll();
            try
            {
                foreach (var st in D["story"]["tutorial"]) await step(st);
            }
            finally
            {
                SN.Dialog.hide();
                UI.clearSpot();
                UI.allow = V.@null;
                active = false;
                controlledTrade = false;
                S.profile["tutorialDone"] = true;
                S.profile["tutorialV"] = VERSION;
                if (snapshot.truthy)
                {
                    // Repaso terminado: todo vuelve a como estaba
                    replaying = false;
                    S.adopt(snapshot);
                    SN.Chart.setMarket(S.run["selected"]);
                    SN.Desk.dirty();
                    await SN.Dialog.show(V.Arr("Fin del repaso. Tu partida sigue exactamente como estaba."), V.Obj("pos", V.Obj("v", "bottom", "h", "center")));
                }
                SN.Save.saveRun();
                SN.Game.setState("GAMEPLAY");
                UI.renderAll();
            }
        }

        // Mercado de la Salud preparado para la clase: subiendo, sin noticias y con una PISTA clarísima
        public void setup()
        {
            V run = S.run, m = run["markets"]["salud"], tp = D["sim"]["tutorial"];
            m["events"] = V.Arr();
            m["regime"] = tp["regime"];
            m["phaseLeft"] = 14;
            m["hintNoise"] = 0;
            SN.Market.advance("salud", 10, V.Obj("tutorial", true, "quiet", true));
            run["form"]["frac"] = tp["frac"];
            run["form"]["leverage"] = tp["leverage"];
        }

        public void replay()
        {
            if (active || SN.UI.busy || S.run["position"].truthy) return;
            run(V.Obj("replay", true));
        }

        public async Promise step(V st)
        {
            var UI = SN.UI;
            V run = S.run;
            if (st["wait"] == "buy")
            {
                // Indicación que no bloquea: se queda a la vista mientras pulsas SUBE (o la flecha ↑)
                run["form"]["frac"] = D["sim"]["tutorial"]["frac"];
                run["form"]["leverage"] = D["sim"]["tutorial"]["leverage"];
                controlledTrade = true;
                UI.allow = V.Arr("buy");
                UI.renderForm();
                V rect = UI.spot(st["target"].str);
                SN.Dialog.show(st["lines"], V.Obj("pos", dialogPos(rect), "sticky", true));
                await until("trade:opened");
                SN.Dialog.hide();
                UI.allow = V.Arr();
                UI.clearSpot();
                return;
            }
            if (st["wait"] == "cashout")
            {
                // La gráfica se detiene con la operación en verde: hay que COBRAR (clic o ESPACIO)
                if (!(SN.Chart.anim && SN.Chart.anim["held"])) await until("chart:held");
                UI.allow = V.Arr("cashout");
                V rect = UI.spot(st["target"].str);
                SN.Dialog.show(st["lines"], V.Obj("pos", dialogPos(rect), "sticky", true));
                await until("trade:cashed");
                SN.Dialog.hide();
                UI.allow = V.Arr();
                UI.clearSpot();
                return;
            }
            if (st["wait"] == "trade")
            {
                await until("turn:ready");
                controlledTrade = false;
                return;
            }
            if (st["news"].truthy)
            {
                // El periódico, con una noticia normal y otra que nadie sabe leer: la "errata" (el idioma secreto)
                SN.Narrative.addNews(V.Obj("title", "Vacuna en fase final", "text", "Las autoridades deciden si aprueban la nueva vacuna.", "tone", "pos", "market", "salud", "art", "vacuna"));
                SN.Narrative.cipherNews("tuto");
                SN.Windows.open("news");
                await SN.wait(0.35);
                V spots = st["spots"] || V.Arr();
                await SN.Dialog.show(st["lines"], V.Obj("pos", V.Obj("v", "bottom", "h", "center"), "onLine", (JsFn)((a) =>
                {
                    if (spots[a[0].i].truthy) UI.spot(spots[a[0].i].str);
                    return V.undefined;
                })));
                UI.clearSpot();
                SN.Windows.close();
                return;
            }
            if (st["buy"].truthy)
            {
                // Mejoras y Tienda: primero los botones (con su número rojo), luego cada ventana por dentro
                UI.renderNav();
                V acts = st["acts"] || V.Arr();
                await SN.Dialog.show(st["lines"], V.Obj("pos", V.Obj("v", "bottom", "h", "center"), "onLine", (JsFn)((args) =>
                {
                    V a = acts[args[0].i] || V.Obj();
                    if (a["open"].truthy && SN.Windows.current != a["open"].str) SN.Windows.open(a["open"].str);
                    if (a["spot"].truthy) UI.spot(a["spot"].str);
                    return V.undefined;
                })));
                UI.clearSpot();
                SN.Windows.close();
                return;
            }
            V target = st["target"].truthy ? UI.spot(st["target"].str) : V.@null;
            if (st["lines"]["length"].truthy) await SN.Dialog.show(st["lines"], V.Obj("pos", dialogPos(target)));
            UI.clearSpot();
        }

        // Espera a que un evento cumpla una condición
        static Promise<V> until(string type, Func<V, bool> test = null)
        {
            return new Promise<V>((resolve) =>
            {
                Action off = null;
                off = SN.Events.on(type, (d) => { if (test == null || test(d)) { off(); resolve(d); } });
            });
        }

        // Coloca el diálogo donde no tape el elemento resaltado
        static V dialogPos(V rect)
        {
            if (!rect.truthy) return V.Obj("v", "bottom", "h", "center");
            double cx = rect["x"].num + rect["w"].num / 2, cy = rect["y"].num + rect["h"].num / 2;
            string v = cy > 128 ? "top" : "bottom";
            string h = rect["w"].num > 250 ? "center" : cx < 150 ? "right" : cx > 270 ? "left" : "center";
            return V.Obj("v", v, "h", h);
        }
    }
}
