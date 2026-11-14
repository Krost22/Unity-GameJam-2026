// Pruebas de lógica pura: traducción línea a línea de tools/test/logic.test.js (mismos bloques, mismo orden y
// mismos mensajes). Cada bloque de la JS es un método público con su nombre. No usa NUnit: lo llaman
// LogicTests.cs (EditMode) y el banco rápido de .NET (Unity/Tools~/LogicLab).
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using SaldoNegro.Logic;

namespace SaldoNegro.Tests
{
    public sealed class LogicSuite
    {
        public readonly string dataJson, repoRoot;
        public int passed, failed;
        public readonly List<string> failures = new List<string>(), log = new List<string>();

        public LogicSuite(string dataJson, string repoRoot) { this.dataJson = dataJson; this.repoRoot = repoRoot; }

        // ok(cond, msg): un acierto o un fallo (el console.log de la JS va a log)
        void ok(bool cond, string msg)
        {
            if (cond) passed++;
            else { failed++; failures.Add(msg); log.Add("  FALLO: " + msg); }
        }
        // Igual, con un valor de JS (se mira su "verdad", como el if de la JS)
        void ok(V cond, string msg) { ok(cond.truthy, msg); }

        // load() de la JS: una SN nueva, como recargar la página. Sin real, la partida empieza con el
        // MULTIPLICADOR al máximo (×10). SN es estático: las pruebas con varias SN a la vez se hacen en orden.
        void load(bool real = false, MemoryStorage store = null)
        {
            SN.Load(dataJson, store ?? new MemoryStorage());
            if (!real) SN.State.afterNewRun = (r) => { r["upgrades"]["multiplicador"] = 3; };
        }

        static bool near(double a, double b, double eps = 0.011) { return Math.Abs(a - b) <= eps; }
        // El mayor multiplicador comprado que no pase de `want` (×1 siempre está)
        static V bestLev(double want)
        {
            return SN.Data["sim"]["leverages"].arr.map((l) => l["value"]).filter((v) => v <= want && SN.Trading.leverageAvailable(v)).pop() || 1;
        }

        // Resultado de una partida del bot (fullRun)
        sealed class RunResult { public bool done; public double day; public int rewinds, rescues; public Dictionary<int, double> stepDay; }
        static double avg(List<RunResult> a, Func<RunResult, double> f) { double s = 0; foreach (var r in a) s += f(r); return s / Math.Max(1, a.Count); }

        public void RunAll()
        {
            Block01_FormulaYLimites();
            Block02_RegresionApuestaComprometida();
            Block03_BajaGanaPerdidaLimitada();
            Block04_Cobrar();
            Block05_Giros();
            Block06_PistaPredice();
            Block07_PlazoDeuda();
            Block08_MejorasYEventos();
            Block10b_Multiplicador();
            Block11_EscaleraProgresion();
            Block12_TopesPorMercado();
            Block13_DeudasPosteriores();
            Block14_Resistencia();
            Block09_Tutorial();
            Block10_Equilibrio();
            Block15_PartidaEntera();
            Block19_Academia();
            Block20_PalabrasClave();
            Block21_NumerosRojos();
            Block22_Noticias();
            Block16_PuntosDeControl();
            Block17_IdiomaSecreto();
            Block18_DiasDeLaSuerte();
            Block2_0_HistoriaFinal();
        }

        // 1) Fórmula de la operación y límites
        public void Block01_FormulaYLimites()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            ok(run["capital"] == 100 && run["debt"]["amount"] == 250 && run["debt"]["deadlineDay"] == 7, "estado inicial: $100, deuda $250, 7 días");
            ok(SN.Unlocks.isUnlocked("salud") && !SN.Unlocks.isUnlocked("tecno"), "solo Salud desbloqueado");
            run["form"] = V.Obj("amount", 500, "leverage", 1);
            SN.Trading.clampForm();
            ok(run["form"]["amount"] == 100, "no se puede invertir más que el capital");
            run["form"] = V.Obj("amount", 5, "leverage", 1);
            SN.Trading.clampForm();
            ok(run["form"]["amount"] == SN.Data["sim"]["minInvestment"], "la apuesta mínima es " + Js.String(SN.Data["sim"]["minInvestment"]));
            run["form"] = V.Obj("amount", 60, "leverage", 2);
            V p = SN.Trading.open(1);
            ok(p.truthy && run["capital"] == 40 && run["committed"] == 60 && p["amount"] == 60, "el dinero queda comprometido al abrir");
            ok(SN.Trading.open(1).isNull, "no se pueden abrir dos operaciones a la vez");
            ok(p["total"] == SN.Data["markets"][0]["candles"], "la operación dura las velas del mercado");
            double expected = p["liquidated"].truthy ? -60 : JsMath.round(JsMath.max(-60, 60 * ((p["exit"] - p["entry"]) / p["entry"]) * 1 * 2));
            V r = SN.Trading.close();
            ok(near(r["pnl"], expected), "P/L según la fórmula, en dólares enteros (" + Js.String(r["pnl"]) + " vs " + JsNumber.toFixed(expected, 2) + ")");
            ok(near(run["capital"], 100 + r["pnl"]) && run["committed"] == 0, "capital final = inicial + P/L");
            ok(run["turn"] == 1, "operar consume un turno");
            ok(SN.Trading.close().isNull, "cerrar dos veces no hace nada");
        }

        // 2) Regresión: la apuesta comprometida y la de la posición son la misma aunque el formulario se recalcule
        public void Block02_RegresionApuestaComprometida()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            run["form"] = V.Obj("amount", 50, "frac", 0.5, "leverage", 2);
            // La interfaz recalcula la apuesta (50% del capital) cada vez que cambia el capital
            SN.Events.on("capital:changed", (_) => { if (!run["position"]) run["form"]["amount"] = Math.Floor(run["capital"] * run["form"]["frac"] * 100) / 100; });
            V p = SN.Trading.open(1);
            ok(p["amount"] == 50 && run["committed"] == 50, "apuesta comprometida = apuesta de la operación (" + Js.String(p["amount"]) + " / " + Js.String(run["committed"]) + ")");
            SN.Trading.close();
            ok(run["committed"] == 0, "no queda dinero comprometido fantasma");
        }

        // 3) BAJA gana si el precio baja; pérdida limitada a lo invertido; liquidación con x10
        public void Block03_BajaGanaPerdidaLimitada()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            run["flags"]["debtPaid"] = true;
            int shortWins = 0, shortTrades = 0, liq = 0;
            double minPnl = 0;
            bool negCapital = false;
            for (int i = 0; i < 400; i++)
            {
                run["capital"] = 100; run["position"] = V.@null; run["committed"] = 0;
                run["form"] = V.Obj("amount", 100, "leverage", 10);
                V p = SN.Trading.open(-1);
                V res = SN.Trading.close();
                shortTrades++;
                if (p["liquidated"].truthy || res["pnl"] == 0 || ((p["exit"] < p["entry"]) == (res["pnl"] > 0))) shortWins++; // 0 = movimiento de centavos
                minPnl = JsMath.min(minPnl, res["pnl"]);
                if (p["liquidated"].truthy) liq++;
                if (run["capital"] < 0) negCapital = true;
            }
            ok(shortWins == shortTrades, "en BAJA se gana cuando el precio baja");
            ok(minPnl >= -100, "la pérdida nunca supera lo invertido (mín " + Js.String(minPnl) + ")");
            ok(liq > 0, "con x10 hay liquidaciones (" + liq + "/400)");
            ok(!negCapital, "el capital nunca es negativo");
        }

        // 4) COBRAR: el dinero entra al momento, al precio que se ve, y el mercado sigue sin ti
        public void Block04_Cobrar()
        {
            load();
            SN.Luck.todayPatch = () => V.@null; // sin días de la suerte: aquí se comprueba el dinero exacto
            SN.State.newRun();
            V run = SN.State.run;
            bool allGood = true;
            int compared = 0;
            for (int i = 0; i < 200; i++)
            {
                run["capital"] = 100; run["position"] = V.@null; run["committed"] = 0;
                run["form"] = V.Obj("amount", 50, "leverage", 2);
                V p = SN.Trading.open(1);
                V h = run["markets"]["salud"]["history"];
                double seen = JsMath.min(5, p["candles"] - 1);
                V price = h[h.length - p["candles"] + seen - 1]["c"];
                V r = SN.Trading.cashOut(price, seen);
                double want = JsMath.round(JsMath.max(-50, 50 * (price - p["entry"]) / p["entry"] * 2));
                if (!r || !near(r["pnl"], want) || !near(run["capital"], 100 + want) || run["committed"] != 0) allGood = false;
                V r2 = SN.Trading.close();
                if (r2["pnl"] != r["pnl"] || !near(run["capital"], 100 + want)) allGood = false;
                if (r["stayPnl"].isNumber) compared++;
            }
            ok(allGood, "COBRAR paga al precio visto, una sola vez, sin dejar dinero comprometido");
            ok(compared == 200, "COBRAR guarda lo que habría pasado si te quedabas");
        }

        // 5) Giros: solo en la zona de peligro (últimas velas) y la cámara lenta se marca en ellas
        public void Block05_Giros()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            SN.Data["markets"][0]["twist"]["chance"] = 1;
            bool inDanger = true;
            int marked = 0, n = 0;
            for (int i = 0; i < 150; i++)
            {
                run["capital"] = 100; run["position"] = V.@null; run["committed"] = 0;
                run["form"] = V.Obj("amount", 20, "leverage", 1);
                V p = SN.Trading.open(i % 2 != 0 ? 1 : -1);
                JsArray h = run["markets"]["salud"]["history"].arr.slice(-p["candles"].i);
                int tw = h.findIndex((c) => c["tw"]);
                if (!p["liquidated"].truthy)
                {
                    n++;
                    if (tw >= 0 && tw < p["total"] - SN.Data["sim"]["dangerCandles"]) inDanger = false;
                    if (p["climax"] >= p["total"] - SN.Data["sim"]["dangerCandles"]) marked++;
                }
                SN.Trading.close();
            }
            ok(inDanger, "los giros solo caen en las últimas velas");
            ok((double)marked / n > 0.9, "las velas de giro activan la cámara lenta (" + marked + "/" + n + ")");
        }

        // 6) La PISTA predice de verdad: más flechas, más aciertos
        public void Block06_PistaPredice()
        {
            load();
            int[] hit = new int[4], tot = new int[4];
            for (int r = 0; r < 60; r++)
            {
                SN.State.newRun();
                V run = SN.State.run;
                for (int t = 0; t < 50; t++)
                {
                    run["capital"] = 100; run["committed"] = 0; run["position"] = V.@null; run["debt"]["paid"] = true;
                    V h = SN.Market.hint("salud");
                    run["form"] = V.Obj("amount", 50, "leverage", 1);
                    SN.Trading.open(h["dir"] || 1);
                    V res = SN.Trading.close();
                    tot[h["power"].i]++;
                    if (res["pnl"] > 0) hit[h["power"].i]++;
                }
            }
            Func<int, double> rate = (k) => (double)hit[k] / Math.Max(1, tot[k]);
            log.Add("  aciertos de la pista: sin señal " + JsNumber.toFixed(rate(0) * 100, 0) + "% · ▲ " + JsNumber.toFixed(rate(1) * 100, 0) + "% · ▲▲ " + JsNumber.toFixed(rate(2) * 100, 0) + "% · ▲▲▲ " + JsNumber.toFixed(rate(3) * 100, 0) + "%");
            ok(rate(1) > 0.6 && rate(2) > rate(1) && rate(3) > rate(2), "cuantas más flechas, más fiable es la pista");
            ok(rate(0) < 0.62, "sin pista clara es casi una moneda al aire");
        }

        // 7) Plazo de la deuda: pago automático, embargo o "ya no llegas"
        public void Block07_PlazoDeuda()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            V defaulted = V.@null;
            SN.Events.on("debt:defaulted", (d) => { defaulted = d; });
            for (int i = 0; i < 21; i++) SN.Trading.skipTurn();
            ok(run["day"] == 8 && defaulted.truthy && run["debt"]["defaulted"].truthy, "tras 7 días sin pagar llega el embargo");

            // (cada escenario es una partida nueva: SN se recarga)
            load();
            SN.State.newRun();
            SN.State.run["capital"] = 300;
            V paid = V.@null;
            SN.Events.on("debt:paid", (d) => { paid = d; });
            for (int i = 0; i < 21; i++) SN.Trading.skipTurn();
            ok(paid.truthy && paid["auto"].truthy && SN.State.run["capital"] == 50 && SN.Debt.pendingBonus() == 75, "si te alcanza al vencer, se cobra sola (el bono llega luego, con el encapuchado)");
            SN.Debt.giveBonus(paid["debt"]);
            ok(SN.State.run["capital"] == 50 + 75, "y al dártelo él, se suma");

            load();
            SN.State.newRun();
            V r3 = SN.State.run;
            ok(SN.Debt.turnsLeft() == 21 && !SN.Debt.hopeless(), "al empezar quedan 21 turnos y se puede llegar");
            r3.obj.assign(V.Obj("day", 7, "turn", 1, "capital", 20));
            ok(SN.Debt.turnsLeft() == 2 && SN.Debt.hopeless(), "día 7, tarde, con $20: ya no se llega (fin de partida)");
            r3.obj.assign(V.Obj("day", 7, "turn", 2, "capital", 90));
            ok(!SN.Debt.hopeless(), "día 7, noche, con $90: todavía hay una última oportunidad");
            r3["capital"] = 260;
            ok(SN.Debt.pay() && r3["debt"]["paid"].truthy && r3["capital"] == 10 && SN.Debt.giveBonus(r3["debt"]) == 75 && r3["capital"] == 10 + 75 && !SN.Debt.hopeless(),
                "pago anticipado de la deuda (+ bono de $75 al dártelo el encapuchado)");
            // La escalera: Pleyzeta pagada -> paso completado -> primer regalo (LÍMITE + una deuda)
            V ev = SN.Unlocks.check();
            ok(ev.truthy && ev["type"] == "done" && ev["step"]["id"] == "pleyzeta", "pagar la Pleyzeta completa el primer paso");
            ev = SN.Unlocks.check();
            ok(ev.truthy && ev["type"] == "gift" && SN.Upgrades.isUnlocked("limite") && SN.Upgrades.level("limite") == 0 && SN.Debt.active() && r3["debt"]["amount"] == SN.Data.stepById("regalo1")["debt"],
                "el regalo desbloquea LÍMITE (sin darte ningún nivel) y trae una deuda");
            ok(SN.Unlocks.check().isNull, "con una deuda pendiente la escalera no avanza");
        }

        // 8) Mejoras y eventos
        public void Block08_MejorasYEventos()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            ok(!SN.Upgrades.isUnlocked("suerte") && !SN.Upgrades.buy("suerte"), "al empezar no hay mejoras: llegan como \"regalo\"");
            run["gifts"]["suerte"] = true;
            run["capital"] = 500;
            double cred = JsMath.round(400 * (1 + SN.Data["credit"]["interest"]));
            ok(SN.Upgrades.buy("suerte") && run["capital"] == 500 && SN.Upgrades.value("suerte") == 1 && run["debt"]["id"] == "pleyzeta" && run["debt"]["amount"] == 250 + cred,
                "tras el regalo, Suerte nivel 1 se compra a crédito: hoy $0 y $" + Js.String(cred) + " ($400 + intereses) se suman a la deuda abierta");
            ok(!SN.Upgrades.buy("limite"), "Límite bloqueado hasta su regalo");
            ok(SN.Trading.limit() == 250, "límite base de inversión: $250");
            run["capital"] = 30;
            run["debt"]["deadlineDay"] = run["day"];
            ok(!SN.Upgrades.canBuy("suerte")["ok"] && SN.Upgrades.canBuy("suerte")["reason"] == "YA NO PODRÍAS PAGAR A TIEMPO", "no se compra a crédito lo que ya no se podría pagar a tiempo");
            run["debt"]["amount"] = 0; run["debt"]["paid"] = true;
            run["capital"] = 75;
            V m = run["markets"]["salud"];
            V shock = SN.Market.addEvent(m, SN.Data["marketEvents"]["salud"][1]); // shock
            ok(SN.Market.hint("salud")["move"] > SN.Market.forecast("salud")["move"] - 1, "la pista incluye los eventos conocidos");
            int resolved = 0;
            SN.Events.on("market:event-resolved", (n) => { resolved++; if (!n["art"]) resolved = -99; });
            SN.Trading.skipTurn();
            // (por su uid: al acabar el turno puede salir otra vez la misma noticia, y es otro evento)
            ok(resolved >= 1 && !m["events"].arr.includes(shock), "los shocks se aplican y se publican (con su foto) en las velas siguientes");
        }

        // 10b) MULTIPLICADOR: al empezar solo ×1; ×2, ×5 y ×10 se compran a crédito, en orden (el tutorial presta su ×2)
        public void Block10b_Multiplicador()
        {
            load(true);
            SN.State.newRun();
            V run = SN.State.run;
            var T = SN.Trading;
            var Up = SN.Upgrades;
            ok(T.leverageAvailable(1) && !T.leverageAvailable(2) && !T.leverageAvailable(5) && !T.leverageAvailable(10), "al empezar solo hay ×1");
            ok(Up.isUnlocked("multiplicador") && Up.canBuy("multiplicador")["ok"].truthy, "el MULTIPLICADOR se puede comprar desde el principio (no es un regalo)");
            run["form"] = V.Obj("amount", 50, "leverage", 5);
            ok(!T.validate()["ok"] && Regex.IsMatch(T.validate()["reason"].str, "MULTIPLICADOR"), "no se puede operar con un multiplicador que no has comprado");
            T.clampForm();
            ok(run["form"]["leverage"] == 1, "el formulario vuelve a ×1 si eliges uno que no tienes");
            double d0 = run["debt"]["amount"], cr = Up.creditCost("multiplicador");
            ok(Up.buy("multiplicador") && T.leverageAvailable(2) && !T.leverageAvailable(5) && run["capital"] == 100 && run["debt"]["amount"] == d0 + cr,
                "el ×2 a crédito: hoy $0 y +$" + Js.String(cr) + " a la deuda");
            ok(Up.buy("multiplicador") && T.leverageAvailable(5) && !T.leverageAvailable(10), "después el ×5...");
            run["capital"] = 5000;
            ok(Up.buy("multiplicador") && T.leverageAvailable(10) && !Up.next("multiplicador").truthy, "...y por último el ×10");
            V lv = Up.def("multiplicador")["levels"];
            ok(lv.arr.every((l, i) => i == 0 || l["cost"] > lv.arr[i - 1]["cost"]), "cada multiplicador cuesta más que el anterior");
            // El tutorial presta el ×2 (y nada más)
            load(true);
            SN.State.newRun();
            var tf = new TutorialFlags { active = true };
            SaldoNegro.Logic.SN.Tutorial = tf; // (la bandera que mira la lógica; el tutorial de verdad es SN.Tutorial)
            ok(SN.Trading.leverageAvailable(2) && !SN.Trading.leverageAvailable(5), "durante el tutorial el ×2 va prestado");
            tf.active = false;
            ok(!SN.Trading.leverageAvailable(2), "acabado el tutorial, se devuelve");
        }

        // 11) Escalera de progresión: una cadena de deudas (al pagar una llega la siguiente), objetos clave con la
        // oferta de FUTURO.exe
        public void Block11_EscaleraProgresion()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            var U = SN.Unlocks;
            Func<string> drain = () =>
            {
                var outp = new List<string>();
                V e;
                while ((e = U.check()).truthy) outp.Add(e["type"].str);
                return string.Join(",", outp);
            };
            run["capital"] = 5000; // con dinero de sobra tampoco se salta ningún paso
            ok(drain() == "", "con la Pleyzeta sin pagar no avanza nada (aunque tengas $5,000)");
            ok(!U.canBuyItem("tele")["ok"].truthy && U.canBuyItem("tele")["locked"].truthy, "la tele no se puede comprar antes de su paso");
            run["capital"] = 253;
            SN.Debt.pay();
            ok(run["capital"] == 3 && run["debt"]["bonus"] == 75 && run["debt"]["bonusPending"].truthy && SN.Debt.pendingBonus() == 75,
                "al saldar la Pleyzeta con $253 te quedan $3: el bono todavía no ha llegado (" + Js.String(run["capital"]) + ")");
            ok(SN.Debt.giveBonus(run["debt"]) == 75 && run["capital"] == 3 + 75 && run["debts"].length == 0 && !run["debt"]["bonusPending"].truthy,
                "el bono (30%) llega cuando te lo da el encapuchado: $78 (" + Js.String(run["capital"]) + ")");
            ok(SN.Debt.giveBonus(run["debt"]) == 0 && run["capital"] == 78 && SN.Debt.pendingBonus() == 0, "el bono solo se entrega una vez");
            run["capital"] = 5000;
            ok(drain() == "done,gift", "tras la Pleyzeta llega el primer regalo");
            ok(SN.Data["chain"].arr.slice(0, -1).every((st) => st["kind"] != "goal"), "no hay metas de dinero entre deudas: solo la final");
            ok(!U.isUnlocked("tecno"), "Tecnología no se abre antes de su regalo, aunque tengas el dinero");
            SN.Debt.pay();
            ok(drain() == "done" && U.step()["id"] == "tele", "pagado el regalo, el siguiente paso es comprar la tele");
            ok(!U.canBuyItem("movil")["ok"].truthy && U.canBuyItem("movil")["locked"].truthy, "los objetos clave van en orden");
            // Comprobar si se puede comprar no cambia nada
            string before = Json.stringify(V.Arr(run["capital"], run["owned"], run["debt"], run["step"]));
            ok(U.canBuyItem("tele")["ok"].truthy && before == Json.stringify(V.Arr(run["capital"], run["owned"], run["debt"], run["step"])), "mirar la oferta no cambia nada");
            V o = U.offer("tele");
            double teleDebt = JsMath.round(SN.Data.keyItemById("tele")["price"] * 1.5);
            ok(o["now"] == 0 && o["debt"] == teleDebt && o["need"] == 0,
                "la oferta: $0 hoy, el 150% después ($" + Js.String(teleDebt) + ") y no pide dinero en la cuenta (" + Js.String(o["now"]) + " / " + Js.String(o["debt"]) + " / " + Js.String(o["need"]) + ")");
            run["capital"] = 12;
            ok(U.canBuyItem("tele")["ok"].truthy, "la oferta se puede aceptar aunque casi no tengas dinero: la deuda se paga después");
            ok(U.acceptOffer("tele").truthy && run["owned"]["tele"].truthy && run["capital"] == 12 && SN.Debt.active() && run["debt"]["amount"] == o["debt"] && U.isUnlocked("salud_negro"),
                "aceptar la oferta: hoy no pagas nada, lo debes todo y se abre Salud negro");
            run["capital"] = 5000;
            ok(U.acceptOffer("tele").isNull, "no se puede comprar dos veces");
            SN.Debt.pay();
            ok(drain() == "done,gift" && U.isUnlocked("tecno") && SN.Upgrades.isUnlocked("analisis") && SN.Debt.active(),
                "pagada la tele llega la siguiente deuda al momento: el regalo de ANÁLISIS, que abre Tecnología");
            // El resto de la escalera con dinero de sobra: termina en la meta final con los 8 mercados abiertos
            run["capital"] = 1e7;
            for (int i = 0; i < 80 && U.step().truthy; i++)
            {
                drain();
                V st = U.step();
                if (!st) break;
                if (SN.Debt.active()) SN.Debt.pay();
                else if (st["kind"] == "item") U.acceptOffer(st["item"]);
            }
            drain();
            ok(!U.step() && SN.Data["markets"].arr.every((d) => U.isUnlocked(d["id"])), "la escalera se completa y abre los 8 mercados");
            ok(V.Arr("limite", "analisis", "suerte", "resistencia").arr.every((id) => SN.Upgrades.isUnlocked(id)), "las 4 mejoras llegan como regalo");
            ok(run["debts"].length == 8 && run["debts"].arr.every((d) => d["paid"].truthy), "9 deudas en total, todas pagadas (" + Js.String(run["debts"].length + 1) + ")");
        }

        // 12) Topes por mercado: ninguna operación gana ni pierde más que su tope; el negro es el doble que el suyo
        public void Block12_TopesPorMercado()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            JsArray normal = SN.Data["markets"].arr.filter((d) => !d["black"]);
            bool ladder = true;
            normal.forEach((d, i) =>
            {
                V b = SN.Data.marketById(d["id"] + "_negro");
                V next = normal[i + 1];
                if (!b || b["cap"] != d["cap"] * 2 || (next.truthy && b["cap"] >= next["cap"])) ladder = false;
            });
            ok(ladder, "cada mercado negro: el doble que el suyo y menos que el siguiente normal");
            ok(normal.every((d, i) => i == 0 || d["cap"] > normal[i - 1]["cap"]), "cada mercado normal da más que el anterior");
            ok(SN.Data["markets"].arr.every((d) => (SN.Data["marketEvents"][d["id"]] || V.Arr()).length >= 5), "todos los mercados (también los negros) tienen sus noticias");
            run["flags"]["debtPaid"] = true; run["debt"]["paid"] = true; // sin deuda: que no se cobre sola a mitad de la prueba
            SN.Luck.todayPatch = () => V.@null; // ni bonificaciones de la suerte
            run["gifts"]["limite"] = true; run["upgrades"]["limite"] = 3; // apuestas de hasta $25,000
            bool within = true;
            int hit = 0;
            for (int i = 0; i < 300; i++)
            {
                run["capital"] = 100000; run["position"] = V.@null; run["committed"] = 0;
                run["form"] = V.Obj("amount", 5000, "leverage", 10);
                SN.Trading.open(i % 2 != 0 ? 1 : -1);
                V r = SN.Trading.close();
                if (Math.Abs((double)r["pnl"]) > 300 || run["capital"] < 100000 - 300 || run["capital"] > 100000 + 300) within = false;
                if (r["capped"].truthy) hit++;
            }
            ok(within, "en Salud ninguna operación gana ni pierde más de $300");
            ok(hit > 50, "con apuestas grandes se llega al tope a menudo (" + hit + "/300)");
        }

        // 13) Deudas posteriores: plazo, pago automático y embargo como la primera; "ya no llegas" cuenta los topes
        public void Block13_DeudasPosteriores()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            V R1 = SN.Data.stepById("regalo1");
            run["capital"] = 300; SN.Debt.pay(); SN.Unlocks.check(); SN.Unlocks.check();
            ok(run["debt"]["id"] == "regalo1" && run["debt"]["start"] == 1 && run["debt"]["deadlineDay"] == R1["days"],
                "el regalo vence en " + Js.String(R1["days"]) + " días contando hoy (día " + Js.String(run["debt"]["deadlineDay"]) + ")");
            V defaulted = V.@null;
            SN.Events.on("debt:defaulted", (d) => { defaulted = d; });
            run["capital"] = 40;
            for (int i = 0; i < 40 && !defaulted.truthy; i++) SN.Trading.skipTurn();
            ok(defaulted.truthy && run["debt"]["defaulted"].truthy && run["day"] == R1["days"] + 1, "si no pagas el regalo a tiempo: embargo");

            load();
            SN.State.newRun();
            V r2 = SN.State.run;
            r2.obj.assign(V.Obj("capital", 2000, "day", 7, "turn", 1));
            r2["debt"]["amount"] = 5000;
            ok(SN.Debt.hopeless(), "con el tope de Salud, $2,000 no llegan a $5,000 en dos turnos");
            r2["markets"]["mineria"]["unlocked"] = true;
            ok(!SN.Debt.hopeless(), "con un mercado de tope mayor, todavía se puede");

            load();
            SN.State.newRun();
            V r3 = SN.State.run;
            r3["capital"] = 300; SN.Debt.pay(); SN.Debt.flushBonuses(); SN.Unlocks.check(); SN.Unlocks.check();
            r3["capital"] = 900;
            V paid = V.@null;
            SN.Events.on("debt:paid", (d) => { paid = d; });
            for (int i = 0; i < 40 && !paid.truthy; i++) SN.Trading.skipTurn();
            double owed = R1["debt"];
            double bonus = JsMath.max(60, JsMath.round(owed * SN.Data["payBonus"]["frac"]));
            ok(paid.truthy && paid["auto"].truthy && paid["debt"]["id"] == "regalo1" && paid["bonus"] == bonus && r3["capital"] == 900 - owed && paid["debt"]["bonusPending"].truthy,
                "si al vencer te alcanza, el regalo se cobra solo (el bono de la app, $" + Js.String(bonus) + ", queda pendiente)");
            SN.Debt.flushBonuses();
            ok(r3["capital"] == 900 - owed + bonus && SN.Debt.pendingBonus() == 0, "una partida cargada con bonos sin entregar los recibe al momento");
        }

        // 14) RESISTENCIA: menos giros en las últimas velas
        public void Block14_Resistencia()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            V def = SN.Data["markets"][0];
            def["twist"]["chance"] = 0.5;
            Func<int> count = () =>
            {
                int n = 0;
                for (int i = 0; i < 600; i++) if (SN.Trading.planTwist(def, 12, false) >= 0) n++;
                return n;
            };
            int baseCount = count();
            run["upgrades"]["resistencia"] = 3;
            int res = count();
            ok(res < baseCount * 0.6, "RESISTENCIA 3 quita giros (" + baseCount + " -> " + res + " de 600)");
        }

        // 9) Tutorial: la primera operación enseña a cobrar y luego enseña el susto desde fuera
        public void Block09_Tutorial()
        {
            bool allPositive = true;
            int scared = 0;
            for (int i = 0; i < 120; i++)
            {
                load();
                SN.State.newRun();
                V run = SN.State.run;
                run["form"] = V.Obj("amount", 50, "leverage", 2);
                V tp = SN.Data["sim"]["tutorial"];
                V p = SN.Trading.open(1, V.Obj("tutorial", true));
                JsArray h = run["markets"]["salud"]["history"].arr.slice(-p["candles"].i);
                V r = SN.Trading.cashOut(h[tp["holdAt"].i - 1]["c"], tp["holdAt"]);
                SN.Trading.close();
                if (r["pnl"] <= 0) allPositive = false;
                if (r["stayPnl"] <= r["pnl"]) scared++; // en dólares enteros puede empatar si el giro es de centavos
                if (p["climax"] != tp["twistAt"]) allPositive = false;
            }
            ok(allPositive, "cobrar en el tutorial siempre deja ganancias (y el giro llega con cámara lenta)");
            ok(scared == 120, "quedarse en el tutorial habría salido peor: se ve el susto");
        }

        // 10) Equilibrio: estrategias durante los 7 días
        double strategy(string name, Func<V> pick, int N = 500)
        {
            int paidCount = 0, ruined = 0;
            for (int i = 0; i < N; i++)
            {
                load(true);
                SN.State.newRun();
                V run = SN.State.run;
                while (run["day"] <= 7 && !run["debt"]["paid"].truthy)
                {
                    if (SN.Debt.canPay()) { SN.Debt.pay(); break; }
                    if (run["capital"] < SN.Data["sim"]["bankruptcyThreshold"] || SN.Debt.hopeless()) { ruined++; break; }
                    V choice = pick();
                    if (!choice.truthy) { SN.Trading.skipTurn(); continue; }
                    // ¿Quiere un multiplicador que no tiene? Lo compra a crédito si lo que tiene ya cubre lo que suma a la deuda
                    V mc = SN.Upgrades.canBuy("multiplicador");
                    if (!SN.Trading.leverageAvailable(choice["lev"]) && mc["ok"].truthy && run["capital"] >= mc["debt"]) SN.Upgrades.buy("multiplicador");
                    run["form"] = V.Obj("amount", SN.Trading.maxAmount() * choice["frac"], "leverage", bestLev(choice["lev"]));
                    SN.Trading.clampForm();
                    SN.Trading.open(choice["dir"]);
                    SN.Trading.close();
                }
                if (run["debt"]["paid"].truthy) paidCount++;
            }
            log.Add("  " + JsString.padEnd(name, 34) + " paga la deuda: " + JsString.padStart(JsNumber.toFixed((double)paidCount / N * 100, 0), 3) + "%  fin de partida antes: " + JsNumber.toFixed((double)ruined / N * 100, 0) + "%");
            return (double)paidCount / N;
        }

        public void Block10_Equilibrio()
        {
            log.Add("Equilibrio de los 7 primeros días:");
            double coin = strategy("al azar, 50%, x2", () => V.Obj("dir", JsMath.rnd() < 0.5 ? 1 : -1, "frac", 0.5, "lev", 2));
            double follow = strategy("sigue la pista, 50%, x2", () =>
            {
                V h = SN.Market.hint("salud");
                return h["power"].truthy ? V.Obj("dir", h["dir"], "frac", 0.5, "lev", 2) : V.@null;
            });
            double sized = strategy("apuesta según la fuerza de la pista", () =>
            {
                V h = SN.Market.hint("salud");
                return h["power"].truthy ? V.Obj("dir", h["dir"], "frac", V.Arr(0, 0.3, 0.6, 1)[h["power"]], "lev", V.Arr(1, 2, 2, 5)[h["power"]]) : V.@null;
            });
            ok(coin < 0.2, "jugar al azar casi nunca basta");
            // (1.8: los multiplicadores se compran. Con el ×2 y la apuesta por defecto la Pleyzeta es difícil; quien compra
            // el ×5 y ajusta la apuesta a la fuerza de la pista casi siempre llega)
            ok(follow > 0.35 && follow < 0.65, "seguir la pista con ×2 y la apuesta por defecto a veces basta: el inicio es difícil (" + JsNumber.toFixed(follow * 100, 0) + "%, entre 35 y 65)");
            ok(sized > follow + 0.15, "comprar el ×5 y ajustar la apuesta a la fuerza de la pista da mucha más ventaja");
        }

        // 15) La partida entera: un bot sensato (sigue la pista, opera en el mercado abierto de mayor tope, paga en
        // cuanto puede, acepta las ofertas en cuanto FUTURO.exe le deja, compra alguna mejora y nodos de la Academia).
        // Al perder hace lo mismo que el juego: el rescate bancario (una vez por paso) o vuelve al punto de
        // control. Sirve para ajustar la cadena de deudas.
        RunResult fullRun(double maxDays)
        {
            load(true);
            SN.State.newRun();
            var S = SN.State;
            var U = SN.Unlocks;
            var T = SN.Trading;
            V run = S.run;
            V last = -1;
            int rewinds = 0, rescues = 0;
            var stepDay = new Dictionary<int, double>();
            Action mark = () =>
            {
                if (run["step"] != last) { last = run["step"]; stepDay[run["step"].i] = run["day"]; S.checkpoint("x"); }
            };
            mark();
            for (int guard = 0; guard < 20000 && U.step().truthy && run["day"] <= maxDays; guard++)
            {
                if (SN.Debt.canPay()) SN.Debt.pay();
                SN.Debt.flushBonuses(); // (también los de los pagos automáticos al vencer)
                while (U.check().truthy) mark();
                mark();
                V st = U.step();
                if (!st) break;
                if (st["kind"] == "item" && U.canBuyItem(st["item"])["ok"].truthy) { U.acceptOffer(st["item"]); continue; }
                if (run["flags"]["debtPaid"].truthy) run["flags"]["academy"] = true; // Bravo Fines se presenta tras la Pleyzeta
                foreach (V n in SN.Academy.buyable())
                {
                    V keep = SN.Debt.active() ? run["debt"]["amount"] : (V)0;
                    if (run["capital"] - n["cost"] >= JsMath.max(keep, run["capital"] * 0.6)) SN.Academy.buy(n["id"]);
                }
                // Mejoras a crédito: cuando lo que tiene ya cubre lo que la mejora suma a la deuda y, echando cuentas hasta
                // el plazo, todavía paga con margen... o, si es Límite o Multiplicador (hasta ×5, el que usa), le deja más
                // dinero al final que no comprarla
                foreach (var id in new[] { "multiplicador", "limite", "analisis", "suerte", "resistencia" })
                {
                    V c = SN.Upgrades.canBuy(id);
                    if (!c["ok"].truthy || run["capital"] < c["debt"] || (id == "multiplicador" && SN.Upgrades.level(id) >= 2)) continue;
                    V nx = SN.Upgrades.next(id);
                    V L0 = bestLev(10);
                    double cap = T.bestCap();
                    V L1 = id == "multiplicador" ? nx["value"] : L0;
                    double lim0 = T.limit();
                    double lim1 = id == "limite" ? (double)nx["value"] : lim0;
                    double turns = SN.Debt.active() ? SN.Debt.turnsLeft() : SN.Data["credit"]["days"].num * 3;
                    double owed0 = SN.Debt.active() ? (double)run["debt"]["amount"] : 0;
                    double owed1 = owed0 + c["debt"];
                    Func<double, double, double> proj = (L, lim) =>
                    {
                        double x = run["capital"];
                        for (int t = 0; t < turns; t++) x += JsMath.min(cap * 0.47, JsMath.min(x, lim) * L * 0.045) * 0.5;
                        return x;
                    };
                    double p0 = proj(L0, lim0), p1 = proj(L1, lim1);
                    if (p1 >= 1.3 * owed1 || ((id == "multiplicador" || id == "limite") && p1 - owed1 > p0 - owed0)) SN.Upgrades.buy(id);
                }
                // ¿Se ha perdido? Rescate (con 2 días más si era por el plazo) o vuelta al punto de control
                bool late = (run["debt"].truthy && run["debt"]["defaulted"].truthy) || SN.Debt.hopeless();
                if (late || run["capital"] + run["committed"] < SN.Data["sim"]["bankruptcyThreshold"])
                {
                    if (run["rescue"] == "ready")
                    {
                        rescues++;
                        SN.Economy.add(S.rescueAmount(), "rescue");
                        run["rescue"] = "used";
                        if (late) { run["debt"]["deadlineDay"] = JsMath.max(run["debt"]["deadlineDay"], run["day"]) + 2; run["debt"]["defaulted"] = false; }
                    }
                    else
                    {
                        // Al volver, un jugador no repite exactamente lo mismo: el bot tampoco (si no, las mismas velas)
                        rewinds++;
                        S.restoreCheckpoint();
                        run = S.run;
                        S.rng.s = JsMath.toInt32(S.rng.s + rewinds * 7919);
                    }
                    continue;
                }
                // Mercado: el de mayor tope entre los abiertos con pista clara
                V bestD = null, bestH = null;
                foreach (V d in SN.Data["markets"])
                {
                    if (!U.isUnlocked(d["id"])) continue;
                    V h = SN.Market.hint(d["id"]);
                    if (h["power"].truthy && (bestD is null || d["cap"] > bestD["cap"] || (d["cap"] == bestD["cap"] && h["power"] > bestH["power"])))
                    {
                        bestD = d;
                        bestH = h;
                    }
                }
                if (bestD is null) { T.skipTurn(); continue; }
                run["selected"] = bestD["id"];
                V p = bestH["power"];
                // El multiplicador que quiere según la pista o, si todavía no lo ha comprado, el mayor que tenga por debajo
                V lev = bestLev(V.Arr(1, 2, 2, 5)[p]);
                double want = JsMath.min(T.maxAmount() * V.Arr(0, 0.3, 0.6, 1)[p], bestD["cap"] / (lev * 0.06));
                run["form"] = V.Obj("amount", JsMath.max(SN.Data["sim"]["minInvestment"], Math.Floor(want)), "leverage", lev);
                T.clampForm();
                if (!T.open(bestH["dir"])) { T.skipTurn(); continue; }
                T.close();
            }
            return new RunResult { done = !U.step(), day = run["day"], rewinds = rewinds, rescues = rescues, stepDay = stepDay };
        }

        public void Block15_PartidaEntera()
        {
            const int N = 30;
            const double MAX = 140;
            var runs = new List<RunResult>();
            for (int i = 0; i < N; i++) runs.Add(fullRun(MAX));
            var done = runs.FindAll((r) => r.done);
            log.Add("Partida entera (" + N + " bots, máximo " + Js.String(MAX) + " días):");
            log.Add("  la terminan: " + JsNumber.toFixed((double)done.Count / N * 100, 0) + "% · días de media: " + JsNumber.toFixed(avg(done, (r) => r.day), 0)
                + " · rescates: " + JsNumber.toFixed(avg(runs, (r) => r.rescues), 1) + " · vueltas al punto de control: " + JsNumber.toFixed(avg(runs, (r) => r.rewinds), 1));
            load(); // (la JS usa SN0(): una SN aparte solo para leer los datos de la cadena)
            V chain = SN.Data["chain"];
            var by = new List<string>();
            for (int i = 0; i < chain.length; i++)
            {
                int idx = i;
                var withDay = runs.FindAll((r) => r.stepDay.ContainsKey(idx));
                by.Add(chain[idx]["id"].str + ":" + JsNumber.toFixed(avg(withDay, (r) => r.stepDay[idx]), 0));
            }
            log.Add("  día medio en que empieza cada paso: " + string.Join(" ", by));
            ok((double)done.Count / N >= 0.5, "un jugador sensato puede terminar la escalera");
            // (1.8: un jugador sensato pierde una vez cada una o dos partidas; 30 bots dan una media de ~0.6, con margen)
            ok(avg(runs, (r) => r.rewinds + r.rescues) >= 0.25, "pero no es un paseo: alguna vez se pierde");
            int maxRew = 0;
            foreach (var r in runs) maxRew = Math.Max(maxRew, r.rewinds);
            ok(runs.TrueForAll((r) => r.rewinds < 25), "nunca se queda atascado volviendo al mismo punto de control (máx. " + maxRew + ")");
        }

        // 19) La Academia de Bravo Fines: en orden, negocios que pagan cada mañana, tiburón, Plan B y letra pequeña
        public void Block19_Academia()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            var A = SN.Academy;
            SN.Luck.todayPatch = () => V.@null; // sin bonificaciones de la suerte
            run["capital"] = 100000;
            ok(!A.canBuy("limonada")["ok"].truthy, "la Academia está cerrada hasta que Bravo se presenta");
            run["flags"]["academy"] = true;
            ok(!A.canBuy("chicles")["ok"].truthy && A.canBuy("chicles")["locked"].truthy, "cada nodo necesita el anterior de su rama");
            ok(!A.canBuy("foodtruck")["ok"].truthy && A.canBuy("foodtruck")["soon"].truthy, "los avances futuros salen como \"Próximamente\"");
            ok(A.buy("limonada") && A.buy("chicles") && run["capital"] == 100000 - 200 - 1200, "se compran con dinero, en orden");
            ok(!A.buy("limonada"), "no se compra dos veces");
            V inc = V.@null;
            SN.Events.on("academy:income", (d) => { inc = d; });
            run["debt"]["paid"] = true; run["flags"]["debtPaid"] = true;
            V c0 = run["capital"];
            for (int i = 0; i < 3; i++) SN.Trading.skipTurn();
            ok(inc.truthy && inc["amount"] == 140 && run["capital"] == c0 + 140, "los negocios pagan cada mañana (+$" + Js.String(inc.truthy ? inc["amount"] : inc) + ")");
            // Tiburón: +5% en cada ganancia; Plan B: la primera pérdida del día, a la mitad
            A.buy("tiburon"); A.buy("planb");
            ok(A.bonus(1000) == 50 && A.bonus(-1000) == 0, "Mentalidad de tiburón: +5% solo si ganas");
            run["planBDay"] = 0;
            ok(A.halve(-400) == -200 && A.halve(-400) == -400 && A.halve(300) == 300, "Plan B: solo la primera pérdida del día, a la mitad");
            double before = SN.Unlocks.offer("tele")["debt"];
            A.buy("letrapeq");
            // (la letra pequeña: las ofertas traen un 10% menos de deuda)
            ok(SN.Unlocks.offer("tele")["debt"] == JsMath.round(before * 0.9), "leer la letra pequeña: las ofertas traen un 10% menos de deuda");
            ok(SN.Data["academy"]["branches"].arr.every((b) => b["nodes"].arr.some((n) => n["soon"].truthy)), "cada rama deja hueco para futuras versiones");
        }

        // 20) Palabras clave: dinero en dorado (con sus 7 en arcoíris), "siete", suerte en verde y FUTURO.exe cifrado
        public void Block20_PalabrasClave()
        {
            load();
            SN.State.newRun();
            var K = SN.KW;
            Func<string, string> h = (t) => K.html(t);
            ok(Regex.IsMatch(h("Debes $250 hoy."), @"<span class=""kw kw-gold"">\$250</span>"), "una cantidad sale en dorado");
            ok(Regex.IsMatch(h("Te faltan $1,750."), @"kw-gold"">\$1,<span class=""kw-7 in""><i style=""--i:0"">7</i></span>50</span>"), "el 7 de una cantidad sale en arcoíris dentro del dorado");
            ok(h("$60.").EndsWith("</span>.", StringComparison.Ordinal), "el punto final no forma parte de la cantidad");
            ok(Regex.IsMatch(h("Día 17"), "kw-7") && Regex.IsMatch(h("Siete pavos"), "kw-7") && Regex.IsMatch(h("Siete pavos"), @"kw-gold"">pavos"), "cada 7 y la palabra \"siete\" en arcoíris; \"pavos\" es dinero");
            ok(Regex.IsMatch(h("¡Qué suerte!"), "kw-luck") && Regex.IsMatch(h("Estás afortunada"), "kw-luck") && !Regex.IsMatch(h("suertes"), "kw-luck"), "la suerte sale en verde");
            string gift1 = h("Toma un regalo de bienvenida: ya puedes comprar LÍMITE. Y un multiplicador ×10.");
            ok(Regex.IsMatch(gift1, "kw-gift") && Regex.IsMatch(gift1, @"kw-up"">(<i[^>]*>.</i>){6}") && Regex.IsMatch(gift1, @"kw-up"">.*×"), "regalo en magenta; LÍMITE, multiplicador y ×10 como mejora");
            ok(Regex.IsMatch(h("Tienes una deuda con plazo"), "kw-risk") && Regex.IsMatch(h("¡Liquidado!"), "kw-risk") && Regex.IsMatch(h("Se abre el Mercado Dorado"), "kw-gift"), "deuda, plazo y liquidado en peligro; el Mercado Dorado como regalo");
            ok(Regex.IsMatch(h("Pulsa COBRAR ya"), "kw-act") && !Regex.IsMatch(h("vas a cobrar mañana"), "kw-act"), "las acciones solo cuentan en mayúsculas, como el botón");
            ok(Regex.IsMatch(h("apuesta x2"), "kw-up") && !Regex.IsMatch(h("max2 y xbox"), "kw-up"), "x2 es un multiplicador; dentro de una palabra, no");
            ok(!Regex.IsMatch(K.html("Regalo: Límite", V.Obj("terms", false)), "kw-gift|kw-up"), "en la tienda y las mejoras solo se marca dinero, 7 y suerte");
            ok(!Regex.IsMatch(h("EL DIARIO DEL FUTURO"), "kw") && !Regex.IsMatch(h("Nada que pintar"), "kw"), "sin palabras clave, el texto no cambia");
            ok(h("<b>$5</b>").StartsWith("&lt;b&gt;", StringComparison.Ordinal), "el texto se escapa (no se cuela HTML)");
            string brand = h("FUTURO.exe ha encontrado algo");
            ok(brand.Contains("cx-brand") && !brand.Contains("FUTURO") && brand.Contains(SN.Data["cipher"]["alphabet"]["F"].str), "FUTURO.exe sale en el idioma secreto");
            foreach (var l in new[] { "F", "U", "T", "R", "O" }) SN.Cipher.state()["known"][l] = true;
            ok(SN.Cipher.brandText() == "FUTURO.exe" && SN.Cipher.brandify("Abre FUTURO.EXE") == "Abre FUTURO.EXE", "con sus 5 letras descubiertas, FUTURO se lee");
            ok(SN.Cipher.clue("acerca").truthy && SN.Cipher.clue("acerca")["letter"] == "F" && SN.Cipher.total() == 16, "la F tiene su pista (\"Acerca de\"): 16 letras");
        }

        // 21) Números rojos: lo que se puede comprar y todavía no has visto; la oferta salta sola al quedar pendiente
        public void Block21_NumerosRojos()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            var W = SN.ShopWatch;
            run["capital"] = 45;
            ok(W.badge("shop") == 1 && W.badge("upgrades") == 0, "con $45 se puede comprar la taza: un número rojo en la Tienda");
            W.markSeen("shop");
            ok(W.badge("shop") == 0, "al abrir la Tienda, lo visto deja de contar");
            run["capital"] = 130;
            ok(W.badge("shop") == 1, "algo nuevo que ya te alcanza vuelve a contar");
            V news = V.@null, prompt = V.@null;
            SN.Events.on("shop:new", (d) => { news = d; });
            SN.Events.on("offer:prompt", (d) => { prompt = d; });
            W.afterTurn();
            ok(news.truthy && news["items"].arr.some((x) => x["key"] == "shop:planta"), "y se avisa (una vez)");
            news = V.@null; W.afterTurn();
            ok(!news.truthy, "el mismo aviso no se repite");
            run["capital"] = 500; SN.Debt.pay(); SN.Debt.flushBonuses(); while (SN.Unlocks.check().truthy) { }
            SN.Debt.pay(); SN.Debt.flushBonuses(); while (SN.Unlocks.check().truthy) { }
            W.afterTurn();
            ok(prompt.truthy && prompt["item"]["id"] == "tele" && prompt["why"] == "new", "pagada la deuda anterior, la oferta de la tele salta sola");
            prompt = V.@null; W.afterTurn();
            ok(prompt.truthy && prompt["why"] == "insist", "es el siguiente paso de la historia: vuelve a salir cada turno hasta que la aceptas");
            SN.Unlocks.acceptOffer("tele"); prompt = V.@null; W.afterTurn();
            ok(!prompt.truthy, "aceptada, ya no sale");
        }

        // 22) Noticias que se entienden: cada noticia de mercado tiene su foto propia (que existe), su texto de
        // primera plana y palabras sencillas; y salen los presidentes de parodia
        public void Block22_Noticias()
        {
            load();
            var all = new JsArray();
            foreach (var kv in SN.Data["marketEvents"].obj)
                foreach (V e in kv.Value.arr)
                    all.push(JsObject.Assign(V.Obj("market", kv.Key), e));
            string art = File.ReadAllText(Path.Combine(repoRoot, "js/render/news-art.js"));
            var scenes = new HashSet<string>();
            foreach (Match m in Regex.Matches(art, @"\n    (\w+)\(g\) \{")) scenes.Add(m.Groups[1].Value);
            ok(all.every((e) => e["more"].truthy && e["more"].length > 10), "todas las noticias de mercado tienen su \"más información\"");
            string miss = all.filter((e) => !scenes.Contains(e["art"].str)).map((e) => e["art"]).join(", ");
            ok(all.every((e) => scenes.Contains(e["art"].str)), "todas las fotos existen (" + (miss.Length > 0 ? miss : "sí") + ")");
            var artSet = new HashSet<string>();
            foreach (var e in all) artSet.Add(e["art"].str);
            ok(artSet.Count == all.length, "cada noticia tiene su propia foto (" + artSet.Count + " de " + all.length + ")");
            V hard = V.Arr("auditoría", "financiación", "censo", "yacimiento", "colectiva", "suministro", "reforma", "patente", "ensayos", "filtración", "escasez", "redada", "acontecimientos", "alcaldía", "fármaco", "prometedor", "investigador", "encuestados", "tesis", "doctorado", "autoridades");
            // (texto en minúsculas de todo lo que se publica: filter(Boolean) quita lo vacío)
            JsArray texts = all.flatMap((e) => V.Arr(e["title"], e["text"], e["more"], e["yesText"], e["noText"]))
                .concat(SN.Data["story"]["fillerNews"].arr.flatMap((n) => V.Arr(n["title"], n["text"], n["more"])))
                .concat(SN.Data["story"]["darkNews"].obj.values().flat())
                .filter((t) => t.truthy)
                .map((t) => JsString.lower(t.str));
            string found = hard.arr.filter((w) => texts.some((t) => t.str.Contains(w.str))).join(", ");
            ok(found.Length == 0, "las noticias no usan palabras difíciles (" + (found.Length > 0 ? found : "ninguna") + ")");
            JsArray pres = all.filter((e) => Regex.IsMatch(e["title"].str, "Trompa|Patín"));
            ok(pres.length >= 5 && !all.some((e) => Regex.IsMatch((e["title"] + e["text"] + e["more"]).str, "Trump|Putin", RegexOptions.IgnoreCase)), "noticias de Trompa y Patín, con nombres de parodia (" + pres.length + ")");
            ok(SN.Data["story"]["fillerNews"].arr.every((n) => scenes.Contains(n["art"].str)) && SN.Data["luck"]["events"].arr.every((e) => scenes.Contains(e["art"].str) && e["more"].truthy), "las de la ciudad y las de la suerte también tienen foto");
        }

        // 16) Puntos de control: nunca en un momento sin dinero para apostar
        public void Block16_PuntosDeControl()
        {
            load();
            SN.State.newRun();
            V run = SN.State.run;
            SN.State.checkpoint("inicio");
            run["capital"] = 250;
            SN.Debt.pay(); // te quedarías con $0... pero llega el bono de la app
            ok(run["capital"] == 0 && SN.Debt.pendingBonus() >= SN.Data["sim"]["bankruptcyThreshold"], "mientras el encapuchado no te lo da, el bono pendiente cuenta como tuyo (no es bancarrota)");
            SN.Debt.flushBonuses();
            ok(run["capital"] >= SN.Data["sim"]["bankruptcyThreshold"], "pagar justo lo que debes ya no te deja a cero: el bono de la app (" + Js.String(run["capital"]) + ")");
            run["capital"] = 3;
            ok(SN.State.checkpoint("sin dinero") == false && run["checkpoint"]["label"] == "inicio" && run["checkpoint"]["capital"] == 100,
                "sin dinero para apostar no se guarda un punto de control (sigue el anterior)");
        }

        // 17) Idioma secreto: traducción progresiva, tildes, se guarda en la partida (no pasa a una nueva) y todo texto cifrado tiene pistas
        public void Block17_IdiomaSecreto()
        {
            var store = new MemoryStorage();
            load(false, store);
            SN.State.newRun();
            var C = SN.Cipher;
            V X = SN.Data["cipher"];
            ok(C.text("No le creas") == "ИФ БД ЮЛДЖЯ", "sin pistas todo sale en cirílico (" + C.text("No le creas") + ")");
            V found = V.@null;
            SN.Events.on("cipher:found", (d) => { found = d; });
            V clueA = X["clues"].arr.find((c) => c["letter"] == "A");
            ok(C.discover(clueA["id"]).truthy && found.truthy && found["letter"] == "A" && found["glyph"] == "Ж" && found["isNew"].truthy, "encontrar una pista avisa con su letra y su símbolo");
            ok(C.text("No le creas") == "ИФ БД ЮЛДAЯ", "la letra encontrada se traduce en todos los textos");
            ok(C.html("NO LE CREAS", "A").Contains("<span class=\"cx-k cx-new\">A</span>") && C.html("NO").Contains("<span class=\"cx\">И</span>"), "en HTML se marcan las letras (y la recién encontrada)");
            ok(C.discover(clueA["id"]).isNull, "una pista solo cuenta una vez");
            ok(C.text("Señor, está aquí") == C.text("SENOR, ESTA AQUI"), "las tildes y la Ñ no cambian el cifrado");
            ok(Json.parse(store.store["saldonegro.run.v1"])["cipher"]["known"]["A"].truthy && !(Json.parse(store.store["saldonegro.profile.v1"])["cipher"].truthy), "lo descubierto se guarda en la partida, no en el perfil");
            SN.State.checkpoint("test");
            V clueB = X["clues"].arr.find((c) => c["letter"] != "A");
            C.discover(clueB["id"]);
            SN.State.restoreCheckpoint();
            ok(C.knows("A") && C.knows(clueB["letter"]) && C.found(clueB["id"]), "volver a un punto de control no quita las letras encontradas");
            SN.State.newRun();
            ok(!C.knows("A") && C.count() == 0 && !C.found(clueA["id"]), "una partida nueva empieza sin ninguna letra");
            ok(C.discover(clueA["id"]).truthy && C.knows("A"), "y sus pistas se pueden volver a encontrar");
            var letters = new HashSet<string>();
            foreach (var cl in X["clues"].arr) letters.Add(cl["letter"].str);
            JsArray texts = V.Arr(X["contact"]["name"]).arr.concat(
                X["messages"].arr.filter((m) => m["text"].truthy).map((m) => m["text"]),
                X["news"].arr.map((n) => n["text"]),
                X["hidden"].obj.values());
            JsArray bad = texts.filter((t) => C.letters(t).some((ch) => !letters.Contains(ch.str)));
            ok(bad.length == 0, "todo texto cifrado usa solo letras que tienen pista " + bad.join(" | "));
            ok(letters.Count == X["alphabet"].obj.keys().Count && X["alphabet"].obj.keys().TrueForAll((l) => letters.Contains(l)), "cada letra del alfabeto tiene su pista");
            var syms = new HashSet<string>();
            foreach (var sy in X["alphabet"].obj.values()) syms.Add(sy.str);
            ok(syms.Count == X["alphabet"].obj.keys().Count, "cada letra tiene un símbolo distinto");
            V w = C.wildcard(SN.State.rng);
            ok(w.truthy && w["letter"] != "A" && C.knows(w["letter"]), "el comodín descubre una letra que faltaba");
            foreach (var cd in X["clues"].arr) C.discover(cd["id"]);
            ok(C.complete() && C.text("El de la capa miente") == "EL DE LA CAPA MIENTE" && C.wildcard(SN.State.rng).isNull, "con las 15 pistas se lee todo");
            // (esta prueba va al final: carga otra SN y el resto de la sección usa la de arriba. El resultado es el mismo)
            load();
            SN.State.newRun();
            SN.State.run.delete("cipher");
            SN.State.profile["cipher"] = V.Obj("known", V.Obj("A", true), "found", V.Obj(clueA["id"].str, true));
            ok(SN.Cipher.knows("A") && SN.State.run["cipher"]["known"]["A"].truthy && !SN.State.profile["cipher"].truthy, "las letras de una partida guardada antes del cambio se conservan");
        }

        // 18) Días de la suerte: los que llevan un 7; crecen los mercados, bonificación, estrella y ruleta
        public void Block18_DiasDeLaSuerte()
        {
            load();
            var L = SN.Luck;
            ok(L.sevens(7) == 1 && L.sevens(17) == 1 && L.sevens(77) == 2 && L.sevens(777) == 3 && L.sevens(8) == 0, "cuenta los sietes del día");
            ok(V.Arr(7, 17, 27, 70, 79).arr.every((d) => L.isLucky(d)) && !V.Arr(1, 6, 8, 16, 80).arr.some((d) => L.isLucky(d)), "días de la suerte: los que llevan un 7");
            SN.State.newRun();
            V run = SN.State.run;
            run["debt"]["paid"] = true; run["flags"]["debtPaid"] = true;
            for (int i = 0; i < 18; i++) SN.Trading.skipTurn();
            ok(run["day"] == 7 && L.today().truthy && L.k() == 1 && run["luck"]["events"].length == 1, "el día 7 es de la suerte, con un evento especial");
            for (int i = 0; i < 3; i++) SN.Trading.skipTurn();
            ok(run["day"] == 8 && !L.today().truthy, "el día 8 ya no");
            double s0 = SN.State.rng.s;
            string a = Json.stringify(L.roll(77));
            SN.State.rng.s = s0;
            string b = Json.stringify(L.roll(77));
            ok(a == b, "el sorteo del día sale igual con el mismo generador (recargar no lo cambia)");
            run["day"] = 77;
            V l2 = L.roll(77);
            ok(l2["k"] == 2 && l2["events"].length >= 2 && l2["events"].arr.some((e) => SN.Data["luck"]["big"].arr.includes(e)), "el 77 vale doble: más eventos y uno grande");
            run["day"] = 777;
            ok(L.roll(777)["events"].length == 5, "el 777: todos los eventos");
            // Crecimiento: 12 velas desde el precio de referencia, con y sin suerte
            Func<bool, double> growth = (lucky) =>
            {
                double sum = 0;
                V m = run["markets"]["salud"];
                for (int i = 0; i < 700; i++)
                {
                    run["day"] = 17; run["luck"] = V.@null;
                    if (lucky) L.roll(17);
                    m["price"] = m["anchor"]; m["events"] = V.Arr();
                    V p0 = m["price"];
                    for (int k = 0; k < 12; k++) SN.Market.step("salud", new JsObject());
                    sum += JsMath.log(m["price"] / p0);
                }
                return sum / 700;
            };
            double g0 = growth(false), g1 = growth(true);
            log.Add("  rendimiento medio de 12 velas: normal " + JsNumber.toFixed(g0 * 100, 2) + "% · día de la suerte " + JsNumber.toFixed(g1 * 100, 2) + "%");
            ok(g1 > g0 + 0.015, "los días de la suerte los mercados crecen");
            run["day"] = 17; run["luck"] = V.@null; L.roll(17);
            run["luck"]["star"] = "salud";
            ok(L.starMul("salud") == 1.77 && L.starMul("tecno") == 1, "la Estrella de la Suerte multiplica un solo mercado");
            ok(L.bonus(100) == 7 && L.bonus(-50) == 0, "bonificación del 7% por siete en cada operación ganadora");
            run["luck"]["events"] = V.Arr("ruleta"); run["luck"]["spun"] = false;
            V spin = L.spin();
            ok(spin.truthy && spin["text"].truthy && L.spin().isNull, "la ruleta da un premio y solo gira una vez por día");
        }

        // 2.0) La historia del final: LOS DESFASADOS, NULL.EXE por partes, la despedida y la última oferta
        public void Block2_0_HistoriaFinal()
        {
            load();
            V X = SN.Data["cipher"], chat = SN.Data["chat"], F = SN.Data["finale"];
            ok(X["contact"]["name"] == "LOS DESFASADOS", "quienes escriben en el idioma secreto se llaman LOS DESFASADOS");
            V gone = chat["convos"].arr.find((c) => c["gone"]);
            V s6 = X["messages"].arr.find((m) => m["id"] == "s6");
            ok(gone.truthy && gone["when"] == s6["when"] && s6["delay"] > gone["delay"], "\"TU AMIGO ESTÁ CON NOSOTROS\" llega justo después de que Kevo desaparezca");
            ok(X["messages"].arr.filter((m) => m["null"].truthy).map((m) => m["null"]).join() == "1,2,3", "NULL.EXE llega en tres partes, en orden");
            ok(!X["messages"].arr.some((m) => m["text"] == F["farewell"]) && Regex.IsMatch(F["farewell"].str, "[HB]"), "la despedida va en letras normales: lleva H o B, que no existen en el idioma secreto");
            ok(F["pact"]["lines"].length == 4 && F["pact"]["turns"] == 3, "la última oferta: cuatro frases y, a la tercera, la entidad elige por ti");
            ok(F["term"]["steps"].length == 5 && Regex.IsMatch(F["term"]["steps"][4]["cmd"].str, @"EXECUTE NULL\.EXE"), "NULL.EXE: cinco comandos, el último lo ejecuta");
            ok(SN.Data["story"]["hoodedEvents"]["kevoPaid"].length == 3 && !SN.Data["story"]["endDemo"].truthy, "la revelación de Kevo existe y el cartel provisional del final ya no");
            // Todos los objetos que se puede llevar el embargo tienen su nombre para la lista del agente
            JsArray ids = V.Arr("pleyzeta").arr.concat(
                SN.Data["keyItems"].arr.map((k) => k["id"]),
                SN.Data["shop"].arr.map((s) => s["id"]),
                SN.Data["luck"]["golden"].arr.map((g) => g["id"]));
            ok(ids.every((id) => F["police"]["goods"][id].truthy), "la Policía Fiscal sabe nombrar todo lo que se puede tener");
        }
    }
}
