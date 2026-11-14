// Parte 2 de SN.Game (js/core/game.js): arranque y menú, partida nueva y cargada, turnos del día, COBRAR,
// ESPERAR, pagar la deuda, compras de objetos clave y los atajos de depuración (?debug).
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using System.Text;
using SaldoNegro.Logic;
using U = SaldoNegro.Logic.Util;

namespace SaldoNegro
{
    public sealed partial class Game
    {
        // ---------- Arranque y menú ----------
        public async Promise boot()
        {
            setState("BOOT");
            DomElement screen = Dom.byId("screen"), bootEl = Dom.byId("boot");
            SN.Desk.phaseOverride = "evening";
            SN.Desk.hideConsole = !S.profile["introSeen"];
            screen.classList.add("off");
            await SN.wait(0.6);
            screen.classList.remove("off");
            screen.classList.add("poweron");
            Dom.byId("os").classList.remove("hidden");
            bootEl.classList.remove("hidden");
            // Ventana de bienvenida: agradecimiento por jugar (juego de game jam). Se cierra con el botón o Enter.
            bootEl.innerHTML = @"<div class=""thanks"">
        <div class=""win-head""><span>¡GRACIAS POR JUGAR!</span></div>
        <div class=""jam-logo"" title=""Official 2026 Unity Game Jam"">" + unityLogo() + @"</div>
        <div class=""thanks-body"">
          <p class=""hi"">¡Hola! Qué bueno tenerte aquí.</p>
          <p>Saldo Negro nació en la <b class=""y"">Official 2026 Unity Game Jam</b>, con el tema <b class=""y"">Lucky Number</b>: aquí la suerte también cotiza en bolsa.</p>
          <p>Puede que encuentres algún bug suelto. Si pasa, cuéntanoslo: tus comentarios nos ayudan muchísimo.</p>
          <p class=""warn"">Recuerda: aquí nada es consejo financiero. El dinero fácil casi nunca lo es.</p>
          <div class=""thanks-foot"">
            <span class=""sign"">— Por KrostGames y Adrede</span>
            <button class=""btn btn-yellow"">¡A jugar!<kbd>Enter</kbd></button>
          </div>
        </div>
      </div>";
            DomElement box = bootEl.querySelector(".thanks");
            await new Promise((resolve) =>
            {
                Action<DomEvent> onKey = null;
                Action done = () =>
                {
                    Dom.document.removeEventListener("keydown", onKey);
                    SN.Audio.sfx("click");
                    resolve();
                };
                onKey = (e) => { if (e.key == "Enter" || e.key == " ") { e.preventDefault(); done(); } };
                DomElement btn = box.querySelector("button");
                Action<DomEvent> onClick = null;
                // (el { once: true } de la web: el clic se quita al dispararse)
                onClick = (e) => { e.stopPropagation(); btn.removeEventListener("click", onClick); done(); };
                btn.addEventListener("click", onClick);
                Dom.document.addEventListener("keydown", onKey);
            });
            box.classList.add("closing");
            await SN.wait(0.15);
            bootEl.innerHTML = "";
            showMenu();
        }

        // Logo de Unity en pixel art (31x34, a partir del oficial): cubo con el hueco de arriba y el tallo central
        string unityLogo()
        {
            string[] map =
            {
                "............##...##............",
                "...........###...###...........",
                ".........#####...#####.........",
                ".......#######...#######.......",
                ".....#########...#########.....",
                "....##########...##########....",
                "..##########.......##########..",
                "##########...........##########",
                "#########.............#########",
                "########..............#########",
                "##########...........##########",
                "############.......############",
                "##############....#############",
                "###############################",
                "#####..#################..#####",
                "#####....#############....#####",
                "#####.....###########.....#####",
                "#####.......#######.......#####",
                "#####........#####........#####",
                "#####........#####........#####",
                "#####........#####........#####",
                "####.........#####.........####",
                "##...........#####...........##",
                ".............#####.............",
                ".....###.....#####.....###.....",
                "...#######...#####...#######...",
                "..##########.#####.##########..",
                "...########################....",
                ".....#####################.....",
                ".......#################.......",
                ".........#############.........",
                "..........###########..........",
                "............#######............",
                "..............###..............",
            };
            var rects = new StringBuilder();
            for (int y = 0; y < map.Length; y++)
            {
                string row = map[y];
                for (int x = 0; x < row.Length; x++)
                    if (row[x] == '#') rects.Append("<rect x=\"" + x + "\" y=\"" + y + "\" width=\"1\" height=\"1\"/>");
            }
            return "<svg width=\"31\" height=\"34\" viewBox=\"0 0 31 34\" fill=\"#F8F4FF\" shape-rendering=\"crispEdges\">" + rects.ToString() + "</svg>";
        }

        void bindMenu()
        {
            DomElement btnNew = Dom.byId("btn-new");
            btnNew.addEventListener("click", () =>
            {
                if (SN.Save.hasRun() && string.IsNullOrEmpty(btnNew.dataset["confirm"]))
                {
                    btnNew.dataset["confirm"] = "1";
                    btnNew.textContent = "¿Seguro? Se borra";
                    SN.Audio.sfx("error");
                    SN.after(2.5, () => { btnNew.dataset.delete("confirm"); btnNew.textContent = "Nueva partida"; });
                    return;
                }
                btnNew.dataset.delete("confirm");
                btnNew.textContent = "Nueva partida";
                newGame();
            });
            Dom.byId("btn-continue").addEventListener("click", () => continueGame());
            Dom.byId("btn-intro").addEventListener("click", () => introClick());
            Dom.byId("btn-menu-settings").addEventListener("click", () => SN.Windows.open("settings"));
        }

        async Promise introClick()
        {
            Dom.byId("menu").classList.add("hidden");
            await SN.Cine.playIntro();
            showMenu();
        }

        public void showMenu()
        {
            setState("MENU");
            SN.Windows.close(true);
            SN.Dialog.hide();
            SN.UI.clearSpot();
            S.run = V.@null;
            Dom.byId("app").classList.add("hidden");
            Dom.byId("webshop").classList.add("hidden");
            Dom.byId("os").classList.remove("hidden");
            Dom.byId("boot").classList.add("hidden");
            Dom.byId("menu").classList.remove("hidden");
            Dom.byId("btn-continue").classList.toggle("hidden", !SN.Save.hasRun());
            Dom.byId("btn-intro").classList.toggle("hidden", !S.profile["introSeen"]);
            // Quien no ha visto la intro todavía no ha comprado la Pleyzeta
            SN.Desk.hideConsole = !S.profile["introSeen"];
            SN.Desk.phaseOverride = "evening";
            SN.Desk.led = "idle";
            SN.Desk.dirty();
            SN.Audio.setMood("normal");
            SN.Audio.setDarkness(0);
            camTo(V.Obj("x", 320, "y", 180, "zoom", 1), 0.5);
        }

        public async Promise newGame()
        {
            SN.Audio.unlock();
            SN.Audio.startMusic();
            // La intro sale en cada partida nueva; SALTAR solo si ya hay algo guardado (partida o intro vista)
            bool firstTime = !S.profile["introSeen"];
            bool canSkip = !firstTime || SN.Save.hasRun();
            SN.Save.clearRun();
            Dom.byId("menu").classList.add("hidden");
            bool tutorial = S.profile["tutorialV"] != Tutorial.VERSION;
            await SN.Cine.playIntro(canSkip);
            if (firstTime) await startRun(tutorial: true);
            else await startRun(tutorial: tutorial, greeting: !tutorial && S.profile["runs"].num > 0);
        }

        public void continueGame()
        {
            V run = SN.Save.loadRun();
            if (!run.truthy) { showMenu(); return; }
            SN.Audio.startMusic();
            S.adopt(run);
            startRun(loaded: true);
        }

        public void retry()
        {
            startRun(tutorial: false, greeting: true);
        }

        public void toMenu()
        {
            SN.Bailout.abort();
            if (SN.Bankruptcy.active) SN.Bankruptcy.reset();
            if (S.run.truthy && !S.run["over"].truthy && !S.run["position"].truthy) SN.Save.saveRun();
            resetTime();
            SN.FX.clear();
            SN.Chart.anim = V.@null;
            SN.UI.busy = false;
            SN.UI.allow = V.@null;
            showMenu();
        }

        // greeting: false, true o 'rewind' (el saludo de la encapuchada al volver a empezar)
        public async Promise startRun(bool tutorial = false, V greeting = null, bool loaded = false)
        {
            V g = greeting ?? V.@false;
            if (!loaded) { S.newRun(); S.checkpoint("la deuda de la Pleyzeta"); }
            V run = S.run;
            // Partida sin punto de control (por si acaso): se guarda uno ahora
            if (!run["checkpoint"].truthy) S.checkpoint(SN.Narrative.stepLabel(SN.Unlocks.step()));
            // La vida extra (el rescate). Las partidas de antes la llamaban "piggy" (el cerdito): 'broken' = gastada
            if (run["rescue"].isNullish) run["rescue"] = run["piggy"] == "broken" ? "used" : "ready";
            run.delete("piggy");
            SN.Finale.reset();
            SN.Desktop.reset();
            SN.HeroSay.clear();
            SN.Bailout.abort();
            if (SN.Bankruptcy.active) SN.Bankruptcy.reset();
            resetTime();
            SN.Narrative.pending = new List<Func<Promise>>();
            SN.Debt.flushBonuses(); // (un bono que quedó a medio entregar al cerrar el juego)
            SN.Narrative.profitableSinceDebt = 0;
            SN.FX.clear();
            SN.Chart.anim = V.@null;
            SN.Chart.setMarket(run["selected"]);
            SN.Desk.phaseOverride = null;
            SN.Desk.led = "idle";
            SN.Desk.dirty();
            SN.Audio.setDarkness(run["darkness"].num / 12);
            SN.Audio.setMood("normal");
            Dom.byId("os").classList.add("hidden");
            Dom.byId("webshop").classList.add("hidden");
            DomElement app = Dom.byId("app");
            app.classList.remove("hidden");
            DomElement screen = Dom.byId("screen");
            screen.classList.remove("poweron", "off"); screen.reflow(); screen.classList.add("poweron");
            setState("GAMEPLAY");
            SN.UI.busy = false;
            SN.UI.tabSel = null;
            SN.UI.endTrade();
            SN.UI.renderSound();
            camTo(V.Obj("x", 320, "y", 180, "zoom", 1), 0.6);
            if (!loaded && !tutorial) SN.Market.spawnEvents();
            if (!loaded) SN.Save.saveRun();
            SN.UI.renderAll();
            if (loaded && run["position"].truthy)
            {
                // Operación que quedó abierta al cerrar el juego: se liquida con sus velas ya simuladas
                SN.UI.setBusy(true);
                await SN.wait(0.6);
                closeTrade();
                return;
            }
            // Partida guardada en el final: de vuelta a la elección (el mercado TÚ y la última oferta)
            if (loaded && run["finale"].truthy && run["finale"]["phase"].truthy) { SN.Finale.resume(); return; }
            // Partida guardada justo al perder (se cerró el juego en medio): se retoma la derrota
            if (loaded && !tutorial && lost())
            {
                SN.UI.setBusy(true);
                await SN.wait(0.6);
                await checkLoss();
                return;
            }
            if (tutorial) await SN.Tutorial.run();
            else if (g.truthy)
            {
                SN.UI.setBusy(true);
                await SN.wait(0.6);
                await SN.Narrative.hoodedScene(g == "rewind" ? D["story"]["rewindGreeting"] : D["story"]["retryGreeting"]);
                if (g == "rewind") SN.Desktop.flag("rewind");
                SN.UI.setBusy(false);
            }
            // Kevo escribe en cuanto el jugador tiene las manos libres
            Dom.setTimeout(() => SN.Desktop.check(), 2500);
        }

        // ¿Se ha perdido? (plazo vencido, sin dinero para la apuesta mínima o ya imposible pagar a tiempo)
        public bool lost()
        {
            if (!S.run.truthy) return false;
            V run = S.run;
            return (run["debt"].truthy && run["debt"]["defaulted"].truthy) || SN.Bankruptcy.shouldTrigger() || SN.Debt.hopeless();
        }

        public async Promise checkLoss()
        {
            if (S.run["debt"].truthy && S.run["debt"]["defaulted"].truthy) { await SN.Bankruptcy.embargo(); return; }
            // Sin dinero para la apuesta mínima: se acaba en el momento, sin esperar al último día
            if (SN.Bankruptcy.shouldTrigger()) { await SN.Bankruptcy.broke(); return; }
            // Ya es imposible llegar a la deuda a tiempo: el cobrador se adelanta
            if (SN.Debt.hopeless()) { await SN.Bankruptcy.embargo(V.Obj("early", true)); return; }
        }

        // ---------- Turnos ----------
        public void trade(double dir)
        {
            var ui = SN.UI;
            ui.setBusy(true);
            dayChanged = false;
            V pos = SN.Trading.open(dir, V.Obj("tutorial", SN.Tutorial.controlledTrade));
            if (!pos.truthy) { ui.setBusy(false); return; }
            SN.Chart.setMarket(pos["market"]);
            SN.Chart.play(pos["candles"], V.Obj(
                "speed", D["sim"]["candleTime"],
                "climax", pos["climax"],
                "holdAt", pos["tutorial"].truthy ? D["sim"]["tutorial"]["holdAt"] : (V)(-1),
                "onCandle", new JsFn((a) => { ui.onCandle(a[0], a[1]); return V.undefined; }),
                "onDone", new JsFn((a) => { closeTrade(); return V.undefined; })));
        }

        // COBRAR: al precio que se ve ahora mismo. Las velas que faltan se siguen viendo (más rápido)
        public void cashOut()
        {
            V pos = S.run.truthy ? S.run["position"] : V.undefined;
            V a = SN.Chart.anim;
            if (!pos.truthy || pos["settled"].truthy || !a.truthy) return;
            V r = SN.Trading.cashOut(SN.Chart.livePrice, a["revealed"].num);
            if (!r.truthy) return;
            SN.UI.onCashOut(r);
            SN.Drama.cashed();
            SN.Chart.release();
            SN.Chart.fast(2.5);
            SN.Events.emit("trade:cashed", r);
        }

        public void closeTrade()
        {
            V r = SN.Trading.close();
            SN.UI.onTradeDone(r);
            SN.Events.emit("trade:done", r);
            afterTurn(r);
        }

        // ESPERAR: no apuestas; los mercados avanzan solos y lo ves en la gráfica
        public void skipTurn()
        {
            if (SN.UI.busy || !S.run.truthy || S.run["position"].truthy) return;
            var ui = SN.UI;
            ui.setBusy(true);
            dayChanged = false;
            SN.Audio.sfx("whoosh");
            SN.Trading.skipTurn();
            SN.Chart.setMarket(S.run["selected"]);
            SN.Chart.play(D["sim"]["idleCandles"], V.Obj(
                "speed", 0.14,
                "onCandle", new JsFn((a) => { SN.Audio.sfx("candle", V.Obj("up", a[1]["c"].num >= a[1]["o"].num, "quiet", true)); return V.undefined; }),
                "onDone", new JsFn((a) => { afterTurn(V.@null); return V.undefined; })));
        }

        public async Promise afterTurn(V result)
        {
            var ui = SN.UI;
            V run = S.run;
            if (result.truthy)
            {
                // SEGUIR (botón o ESPACIO) corta la espera y el resultado
                bool skipped = false;
                Action skip = null;
                var skipP = new Promise((res) => { skip = res; });
                ui.onContinue = () => { if (skipped) return; skipped = true; SN.Audio.sfx("click"); skip(); };
                await Promise.race(SN.wait(0.6), skipP);
                if (!skipped) await ui.resultCard(result, skipP);
                ui.onContinue = null;
            }
            else await SN.wait(0.15);
            ui.endTrade();
            if (lost()) { await checkLoss(); return; }
            if (dayChanged)
            {
                dayChanged = false;
                SN.Audio.sfx("day");
                double left = SN.Debt.daysLeft();
                bool owing = SN.Debt.active();
                string sub = !owing
                    ? (run["darkness"].num >= 4 ? "La ciudad está más silenciosa" : "Otro día, otra oportunidad")
                    : left <= 1 ? "¡Último día para pagar!" : "Faltan " + Js.String(left) + " días para pagar";
                await ui.dayCard(run["day"], sub, owing && left <= 2);
                // ¿El día lleva un 7? Día de la suerte
                V luck = SN.Luck.today();
                if (luck.truthy) await ui.luckyCard(luck);
            }
            await SN.Narrative.afterTurn();
            await advanceSteps();
            if (!SN.Tutorial.active) SN.ShopWatch.afterTurn();
            if (!run["flags"]["debtPaid"].truthy && SN.Debt.canPay() && !run["flags"]["payHintShown"].truthy && !SN.Tutorial.active)
            {
                run["flags"]["payHintShown"] = true;
                // El botón se ve (busy = false) pero no se puede pulsar hasta cerrar el aviso (allow vacío)
                ui.busy = false;
                ui.allow = V.Arr();
                ui.renderAll();
                ui.spot("#btn-pay");
                await SN.Dialog.show(D["story"]["tutorialPayHint"], V.Obj("pos", V.Obj("v", "bottom", "h", "center")));
                ui.clearSpot();
                ui.allow = V.@null;
            }
            SN.Save.saveRun();
            ui.setBusy(false);
            SN.Events.emit("turn:ready");
        }

        public async Promise payDebt()
        {
            if (!SN.Debt.canPay()) return;
            SN.UI.setBusy(true);
            SN.UI.allow = V.@null;
            SN.Dialog.hide();
            SN.UI.clearSpot();
            SN.Debt.pay(false);
            await SN.Narrative.afterTurn();
            await advanceSteps();
            SN.Save.saveRun();
            SN.UI.setBusy(false);
            // Pagada una deuda, salta la siguiente: si es un objeto clave, su oferta aparece sola
            SN.ShopWatch.afterTurn();
        }

        // La escalera avanza todo lo que pueda (paso completado, regalo, meta) y la narrativa lo cuenta
        public async Promise advanceSteps()
        {
            V ev = V.@null;
            while ((ev = SN.Unlocks.check()).truthy) await SN.Narrative.onStep(ev);
        }

        // Comprar un objeto clave con la oferta de FUTURO.exe
        public async Promise<bool> buyKeyItem(V id)
        {
            if (SN.UI.busy) return false;
            V ev = SN.Unlocks.acceptOffer(id);
            if (!ev.truthy) return false;
            SN.UI.setBusy(true);
            SN.Windows.close(true);
            SN.Save.saveRun();
            await SN.Narrative.onStep(ev);
            SN.Save.saveRun();
            SN.UI.setBusy(false);
            return true;
        }

        // ?debug: atajos para probar (F6 descubre un símbolo, F7 salta al siguiente día de la suerte,
        // F8 bancarrota, F9 +$1,000, F10 día siguiente, F11 salta al final)
        void debugFinale()
        {
            V run = S.run;
            int goal = D["chain"].arr.findIndex((st) => st["kind"] == "goal");
            if (goal < 0 || run["finale"].truthy || run["step"].num >= goal) return;
            if (run["debt"].truthy && !run["debt"]["paid"].truthy)
            {
                run["debt"]["paid"] = true; run["debts"].arr.push(run["debt"]); run["debt"] = V.@null;
            }
            run["step"] = goal; run["stepOpen"] = false;
            run["flags"]["debtPaid"] = true;
            run["flags"]["academy"] = true; run["flags"]["bravoQueued"] = true; // Bravo Fines ya se presentó hace mucho
            foreach (var it in D["keyItems"]) run["owned"][it["id"]] = true;
            foreach (var st in D["chain"]) if (st["kind"] == "gift") run["gifts"][st["upgrade"]] = true;
            foreach (var d in D["markets"]) run["markets"][d["id"]]["unlocked"] = true;
            // Kevo, a punto de su último mensaje; LOS DESFASADOS, con dos partes de NULL.EXE entregadas
            V ch = SN.Desktop.chat();
            int at = D["chat"]["convos"].arr.findIndex((c) => c["id"] == "mira");
            if (ch["i"].num < at) { ch["i"] = at; ch["goneDay"] = run["day"]; ch["offline"] = true; ch["nick"] = "Kevo"; }
            V cs = SN.Desktop.ser();
            int s8 = D["cipher"]["messages"].arr.findIndex((m) => m["id"] == "s8");
            if (cs["i"].num < s8) cs["i"] = s8;
            run["nullParts"] = 2;
            run["capital"] = D["chain"][goal]["amount"];
            SN.UI.setBusy(true);
            afterTurn(V.@null);
        }

        void debugKeys()
        {
            Dom.document.addEventListener("keydown", (e) =>
            {
                if (!S.run.truthy || state != "GAMEPLAY" || SN.UI.busy) return;
                if (e.code == "F6") { e.preventDefault(); SN.Cipher.wildcard(); }
                if (e.code == "F11") { e.preventDefault(); debugFinale(); }
                if (e.code == "F7")
                {
                    e.preventDefault();
                    for (int i = 0; i < 300 && !SN.Luck.isLucky(S.run["day"] + 1); i++) S.run["day"] = S.run["day"] + 1;
                    S.run["turn"] = 2;
                    SN.Trading.skipTurn();
                    SN.UI.setBusy(true);
                    afterTurn(V.@null);
                }
                if (e.code == "F8") { e.preventDefault(); SN.Economy.spend(S.run["capital"].num, "debug"); SN.UI.setBusy(true); afterTurn(V.@null); }
                if (e.code == "F9") { e.preventDefault(); SN.Economy.add(1000, "debug"); }
                if (e.code == "F10") { e.preventDefault(); for (int i = 0; i < 3; i++) SN.Trading.skipTurn(); SN.UI.setBusy(true); afterTurn(V.@null); }
            });
        }
    }
}
