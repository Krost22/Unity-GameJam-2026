// Port de js/systems/narrative.js (SN.Narrative): noticias, apariciones del encapuchado e hitos de la historia.
// Tras pagar la deuda, algunas ganancias generan noticias extrañas sobre la ciudad (cada vez más
// relacionadas con tus operaciones). La ciudad de la ventana se apaga y la música se vuelve rara poco a poco.
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Narrative
    {
        // Superposición del encapuchado en la pantalla (JS: { t, a, out })
        public sealed class Hood { public double t, a; public bool @out; }

        public List<Func<Promise>> pending = new List<Func<Promise>>(); // escenas en cola (se reproducen al terminar el turno)
        public Hood hood;    // superposición del encapuchado en la pantalla
        public double profitableSinceDebt;

        static readonly Regex TOKEN = new Regex(@"\{([A-Za-z0-9_]+)\}");

        public Narrative()
        {
            Subscribe();
        }

        static V Story() { return SN.Data["story"]; }

        public void addNews(V n)
        {
            V run = SN.State.run;
            if (!run) return;
            run["news"].arr.push(JsObject.Assign(V.Obj("day", run["day"], "turn", run["turn"], "tone", "neu"), n));
            if (run["news"].arr.length > 80)
            {
                run["news"].arr.shift();
                run["newsSeen"] = JsMath.max(0, (run["newsSeen"] | 0) - 1);
            }
            SN.Events.emit("news:added", n);
        }

        // ---------- Escena: el encapuchado aparece entre interferencias ----------
        public async Promise hoodedScene(V lines, V opts = null)
        {
            opts = opts ?? V.Obj();
            DomElement screen = Dom.byId("screen");
            SN.Audio.setMood("silent");
            SN.Audio.sfx("static", V.Obj("dur", 0.7));
            SN.FX.glitch(0.7, 1.6);
            screen.classList.add("glitch");
            SN.Desk.led = "alert";
            await SN.wait(0.55);
            screen.classList.remove("glitch");
            hood = new Hood();
            SN.ScreenCanvas.take("hood");
            if (SN.Music != null) SN.Music.sting("hood"); // su música (antes que el susurro: así va en su tonalidad)
            SN.Audio.sfx("whisper");
            await SN.wait(0.6);
            await SN.Dialog.show(lines, V.Obj("pos", V.Obj("v", "bottom", "h", "center"), "glitchy", true, "smile", opts["smile"]));
            hood.@out = true;
            SN.Audio.sfx("static", V.Obj("dur", 0.4));
            SN.FX.glitch(0.4, 1.2);
            await SN.wait(0.45);
            hood = null;
            SN.ScreenCanvas.release("hood");
            SN.Desk.led = "idle";
            SN.Audio.setMood("normal");
        }

        public void renderHood(Ctx2D g, double dt)
        {
            Hood h = hood;
            if (h == null) return;
            h.t += dt;
            h.a = h.@out ? JsMath.max(0, h.a - dt * 3) : JsMath.min(1, h.a + dt * 1.6);
            g.clearRect(0, 0, 420, 236);
            g.globalAlpha = 0.82 * h.a;
            Px.rect(g, 0, 0, 420, 236, PAL.coalDD);
            g.globalAlpha = 0.35 * h.a;
            for (int i = 0; i < 260; i++) Px.rect(g, Util.randi(0, 419), Util.randi(0, 235), Util.randi(1, 2), 1, Util.pick(V.Arr(PAL.coalL, PAL.creamDD)).str);
            SN.Chars.hoodBacklight(g, 210, 96, h.t, h.a);
            g.globalAlpha = h.a;
            double bob = JsMath.round(JsMath.sin(h.t * 1.6) * 2);
            V run = SN.State.run;
            Canvas img = SN.Chars.hoodedCanvas(h.t, V.Obj("smile", run.truthy && run["darkness"].num >= 3));
            g.drawImage(img, 0, 0, 40, 46, 170, 34 + bob, 80, 92);
            // Líneas de barrido
            g.globalAlpha = 0.12 * h.a;
            for (double y = Math.Floor(h.t * 40) % 4; y < 236; y += 4) Px.rect(g, 0, y, 420, 1, PAL.creamL);
            if (JsMath.rnd() < 0.06) { g.globalAlpha = 0.5 * h.a; Px.rect(g, 0, Util.randi(30, 140), 420, Util.randi(2, 5), Util.pick(V.Arr(PAL.coral, PAL.cyan)).str); }
            g.globalAlpha = 1;
        }

        // ---------- Hitos ----------
        // Deuda pagada. La primera (la Pleyzeta) es una fiesta; las siguientes, un alivio corto.
        public async Promise onDebtPaid(V auto, V debt)
        {
            V run = SN.State.run;
            SN.Audio.sfx("debtPaid");
            SN.Audio.sfx("cheer");
            SN.FX.flash(PAL.yellowL, 0.3, 0.4);
            V cap = SN.UI.posIn(Dom.byId("hud-goal"));
            SN.FX.coins(cap["x"] + 60, cap["y"] + 14, 16, 1.5);
            SN.FX.ring(cap["x"] + 60, cap["y"] + 14, PAL.green, 120, 0.9);
            SN.Hands.celebrate(false);
            SN.Desk.dirty();
            if (!debt || debt["id"] == "pleyzeta")
            {
                SN.FX.confetti(70);
                SN.Desk.windowEvent("fuegos");
                await SN.UI.stamp("DEUDA SALDADA", "green", auto.truthy ? "Se cobró al vencer el plazo" : "Eres libre (más o menos)", 2);
                await SN.Cine.faceBeat("relieved", "Uf... Libre. Por fin.", 2.2);
                run["flags"]["debtPaid"] = true;
                addNews(V.Obj("title", "Deuda saldada: la Pleyzeta ya es tuya", "tone", "pos", "art", "sello"));
                SN.Events.emit("chat:flag", V.Obj("flag", "debtPaid"));
            }
            else
            {
                SN.FX.confetti(35);
                await SN.UI.stamp("DEUDA SALDADA", "green", auto.truthy ? "Se cobró al vencer el plazo" : "Pagaste " + debt["label"].str, 1.6);
                addNews(V.Obj("title", "Deuda saldada: " + debt["label"].str, "tone", "pos", "art", "sello"));
                SN.Events.emit("chat:flag", V.Obj("flag", "paid-" + debt["id"].str));
            }
            if (debt.truthy && debt["bonusPending"].truthy) await payBonus(debt);
            SN.UI.renderAll();
        }

        // Bono por usar la app: el encapuchado premia cada deuda saldada (así nunca empiezas la siguiente a cero)
        public async Promise payBonus(V debt)
        {
            V bonus = debt["bonus"];
            V lines = fill(Story()["payBonus"], V.Obj("bonus", Util.money(bonus)));
            await hoodedScene(V.Arr(Util.pick(lines)), V.Obj("smile", true));
            // Te lo da él: es ahora cuando el dinero llega a tu cuenta
            SN.Debt.giveBonus(debt);
            V cap = SN.UI.posIn(Dom.byId("hud-capital"));
            SN.FX.coins(cap["x"] + 60, cap["y"] + 14, 12, 1.2);
            SN.FX.floatText("+" + Util.money(bonus) + " bono", cap["x"] + cap["w"] / 2, cap["y"] + cap["h"] + 6, "gain");
            SN.Audio.sfx("coin");
            SN.UI.renderHUD();
            await SN.UI.stamp("BONO DE LA APP", "green", "+" + Util.money(bonus) + " por usar FUTURO.exe", 1.4);
        }

        // Cuenta en pantalla lo que devuelve SN.Unlocks.check() o la compra de un objeto clave
        public async Promise onStep(V ev)
        {
            if (ev["type"] == "gift") await onGift(ev["step"]);
            else if (ev["type"] == "goal") await onGoal(ev["step"], ev["next"]);
            else if (ev["type"] == "item") await onItem(ev);
            else if (ev["type"] == "done") stepCheckpoint();
            SN.UI.renderAll();
        }

        // Punto de control al empezar cada paso que empieza sin deuda (la oferta de un objeto o la meta final).
        // El regalo guarda el suyo al llegar, ya con su deuda.
        public void stepCheckpoint()
        {
            V st = SN.Unlocks.step();
            if (!st || st["kind"] == "gift") return;
            SN.State.checkpoint(stepLabel(st));
        }

        public V stepLabel(V st)
        {
            if (!st) return "esta parte";
            if (st["kind"] == "debt") return st["label"];
            if (st["kind"] == "gift") return "el regalo de " + JsString.upper(SN.Upgrades.def(st["upgrade"])["name"].str);
            if (st["kind"] == "item") return "la compra de " + SN.Data.keyItemById(st["item"])["short"].str;
            return "la meta de " + Util.@short(st["amount"]);
        }

        public V fill(V lines, V vars)
        {
            return lines.arr.map((V l) => (V)TOKEN.Replace(l.str, (Match m) =>
            {
                V v = vars[m.Groups[1].Value];
                return v.isNullish ? "" : v.str;
            }));
        }

        // "Regalo" del encapuchado: una mejora que ya se puede comprar, quizá un mercado nuevo... y una deuda
        public async Promise onGift(V st)
        {
            V up = SN.Upgrades.def(st["upgrade"]);
            string debt = Util.money(st["debt"]);
            V days = st["days"];
            V lines = fill(Story()["hoodedEvents"][st["story"]] | V.Arr(), V.Obj("debt", debt, "days", days));
            if (lines.length) await hoodedScene(lines, V.Obj("smile", st["id"] != "regalo1"));
            if (st["markets"].truthy && st["markets"].length.truthy)
            {
                SN.Desk.windowEvent("fuegos");
                SN.Audio.sfx("unlock");
                SN.FX.confetti(40);
                await SN.UI.stamp("MERCADO NUEVO", "", st["markets"].arr.map(id => SN.Data.marketById(id)["name"]).join(" · "), 1.6);
            }
            SN.Audio.sfx("unlock");
            await SN.UI.stamp("REGALO: " + JsString.upper(up["name"].str), "coral", "Deuda: " + debt + " · " + days.str + " días", 2.2);
            if (st["id"] == "regalo4") await teaser();
            addNews(V.Obj("title", "Un \"regalo\": " + up["name"].str + ". Y una deuda de " + debt, "tone", "neg", "art", "documento"));
            SN.State.checkpoint(stepLabel(st));
            SN.Events.emit("chat:flag", V.Obj("flag", st["id"]));
        }

        public async Promise onGoal(V g, V next)
        {
            SN.Desk.windowEvent("fuegos");
            SN.Audio.sfx("cheer");
            SN.FX.confetti(60);
            await SN.UI.stamp("¡OBJETIVO CUMPLIDO!", "green", g["reward"].truthy ? "Bono de la app: +" + Util.money(g["reward"]) : "", 1.8);
            if (g["markets"].length.truthy)
            {
                SN.Audio.sfx("unlock");
                await SN.UI.stamp("MERCADO NUEVO", "", g["markets"].arr.map(m => SN.Data.marketById(m)["name"]).join(" · "), 1.4);
            }
            V lines = Story()["hoodedEvents"][g["story"]];
            if (lines.truthy) await hoodedScene(lines, V.Obj("smile", true));
            addNews(V.Obj("title", "Objetivo " + Util.@short(g["amount"]) + " cumplido", "tone", "pos", "art", "dinero"));
            SN.Events.emit("chat:flag", V.Obj("flag", g["id"]));
            // La meta final: el mercado TÚ y la elección (js/systems/finale.js)
            if (!next) { await SN.Finale.start(); return; }
            if (next.truthy && next["kind"] != "gift") SN.State.checkpoint(stepLabel(next));
        }

        // Objeto clave comprado con la oferta de FUTURO.exe: te endeudas y se abre un mercado negro
        public async Promise onItem(V ev)
        {
            V it = ev["item"];
            V def = SN.Data.marketById(it["market"]);
            SN.Audio.sfx("pay");
            SN.Hands.celebrate(false);
            SN.FX.confetti(30);
            SN.Desk.dirty();
            await SN.UI.stamp("¡ES TUYO!", "", it["name"].str + " · hoy $0 · debes " + Util.money(ev["offer"]["debt"]) + " en " + ev["offer"]["days"].str + " días", 1.8);
            V lines = Story()["hoodedEvents"][ev["step"]["story"]];
            if (lines.truthy) await hoodedScene(lines, V.Obj("smile", true));
            SN.Audio.sfx("unlock");
            await SN.UI.stamp("MERCADO NEGRO", "coral", def["name"].str, 1.8);
            addNews(V.Obj("title", "Abre un mercado que no sale en ningún periódico", "text", def["desc"], "tone", "neg", "market", it["market"], "art", "cartel"));
            SN.Events.emit("chat:flag", V.Obj("flag", ev["step"]["id"]));
        }

        // Bravo Fines se presenta (la mañana siguiente a pagar la Pleyzeta) y abre su Academia
        public async Promise bravoIntro()
        {
            V run = SN.State.run, A = SN.Data["academy"];
            if (!run || run["flags"]["academy"].truthy) return;
            SN.Audio.sfx("notify");
            await SN.UI.stamp("¡NUEVO MENTOR!", "bravo", A["guru"]["name"].str + " quiere hablar contigo", 1.4);
            await SN.Dialog.show(A["intro"], V.Obj("pos", V.Obj("v", "bottom", "h", "center"), "name", A["guru"]["name"], "portrait", "bravo", "voice", "bravo"));
            run["flags"]["academy"] = true;
            SN.Audio.sfx("unlock");
            SN.FX.confetti(30);
            await SN.UI.stamp("ACADEMIA DE BRAVO FINES", "bravo", "En la TIENDA (tecla T): Academia", 1.8);
            addNews(V.Obj("title", "UN GURÚ DEL TRADING ABRE SU ACADEMIA: \"EL DINERO SE MANIFIESTA\"", "text", "Bravo Fines promete hacerte rico. Él ya lo es, dice. Sus tres Lambos son alquilados.", "tone", "neu", "art", "bravo"));
            SN.Events.emit("chat:flag", V.Obj("flag", "bravo"));
            SN.Events.emit("academy:open");
        }

        public async Promise teaser()
        {
            SN.FX.glitch(1.2, 2);
            SN.Audio.sfx("static", V.Obj("dur", 1));
            Dom.byId("screen").classList.add("glitch");
            await SN.UI.stamp(Story()["teaser"].str, "coral", "", 1.2);
            Dom.byId("screen").classList.remove("glitch");
        }

        // Tras cada turno: escenas pendientes y pequeñas inquietudes
        public async Promise afterTurn()
        {
            while (pending.Count > 0)
            {
                Func<Promise> scene = pending[0];
                pending.RemoveAt(0);
                await scene();
            }
            V run = SN.State.run;
            if (run["darkness"].num >= 2 && JsMath.rnd() < 0.12) { SN.FX.glitch(0.2, 0.6); SN.Audio.sfx("static", V.Obj("dur", 0.15)); }
        }

        // "Errata": una noticia escrita en el idioma secreto (js/data/cipher.js). Sin id, la siguiente sin publicar.
        public void cipherNews(V id = null)
        {
            V run = SN.State.run;
            if (!run) return;
            run["cipherNews"] = run["cipherNews"] | V.Obj();
            V all = SN.Data["cipher"]["news"];
            bool byId = (object)id != null && id.truthy;
            V n = byId
                ? all.arr.find(c => c["id"] == id)
                : all.arr.find(c => c["id"] != "tuto" && !run["cipherNews"][c["id"]]);
            if (!n || run["cipherNews"][n["id"]].truthy) return;
            run["cipherNews"][n["id"]] = true;
            addNews(V.Obj("title", SN.Cipher.text(n["text"]), "cipher", n["id"], "tone", "neu", "art", n["art"]));
        }

        // Cada día nuevo, una noticia de la ciudad (sin repetir; las más oscuras solo cuando toca)
        public void cityNews()
        {
            V run = SN.State.run;
            JsArray all = Story()["fillerNews"].arr;
            if (!run) return;
            run["cityUsed"] = run["cityUsed"] | V.Obj();
            JsArray pool = all.filter((n, i) => !run["cityUsed"][i] && (!n["minDark"] || run["darkness"].num >= n["minDark"].num));
            if (pool.length == 0) return;
            V n = pool[(int)Math.Floor(JsMath.rnd() * pool.length)];
            run["cityUsed"][all.indexOf(n)] = true;
            addNews(V.Obj("title", n["title"], "text", n["text"], "more", n["more"], "tone", n["tone"], "art", n["art"], "city", true));
        }

        // Noticia extraña vinculada al mercado donde acabas de ganar
        public void darkNews(V market)
        {
            V run = SN.State.run;
            double used = (run["darkUsed"][market] | 0).num;
            V pool = Story()["darkNews"][market] | V.Arr();
            V text, art;
            V arts = Story()["darkArt"];
            if (used < pool.length.num)
            {
                text = pool[(int)used];
                V am = arts[market];
                art = am.truthy ? am[(int)used] : am;
                run["darkUsed"][market] = used + 1;
            }
            else
            {
                double gi = (run["darkUsed"]["generic"] | 0).num;
                V gen = Story()["darkNews"]["generic"];
                text = gen[(int)JsMath.mod(gi, gen.length.num)];
                art = arts["generic"][(int)JsMath.mod(gi, arts["generic"].length.num)];
                run["darkUsed"]["generic"] = gi + 1;
            }
            // En el mercado negro la ciudad lo paga el doble
            run["darkness"] = run["darkness"] + (SN.Data.marketById(market)["black"].truthy ? 2 : 1);
            addNews(V.Obj("title", text, "tone", "neg", "market", market, "dark", true, "art", art, "text", "Momentos después de tu operación en " + SN.Data.marketLabel(market).str));
            SN.Desk.dirty();
            SN.Audio.setDarkness(run["darkness"].num / 12);
            SN.Audio.sfx("notifyBad");
            // A veces, junto a la noticia extraña, sale una "errata" en el idioma secreto
            if (JsMath.rnd() < 0.35) cipherNews();
            if (run["darkness"].num >= 3 && !run["storySeen"]["darkNews"])
            {
                run["storySeen"]["darkNews"] = true;
                pending.Add(() => hoodedScene(Story()["hoodedEvents"]["darkNews"], V.Obj("smile", true)));
            }
        }

        public void update(double dt) { }

        // ---------- Suscripciones ----------
        void Subscribe()
        {
            // Lo que se ve por la ventana: las noticias que pasan en tu calle, y la ciudad que va cambiando
            SN.Events.on("market:event", d =>
            {
                V ev = d["event"];
                if (ev["window"].truthy) SN.after(1.2, () => SN.Desk.windowEvent(ev["window"].str));
            });
            SN.Events.on("rescue:done", _ => { SN.after(1.5, () => SN.Desk.windowEvent("fuegos")); });
            SN.Events.on("turn:ready", _ =>
            {
                V run = SN.State.run;
                if (!run || SN.Game.state != "GAMEPLAY") return;
                // Cuanto más oscura la historia, más a menudo se le ve en una azotea
                if (run["darkness"].num >= 3 && run["turn"] == 2 && JsMath.rnd() < 0.18) { SN.Desk.windowEvent("encapuchado"); return; }
                if (JsMath.rnd() < 0.22) SN.Desk.windowEvent(Util.pick(run["darkness"].num >= 2 ? V.Arr("cuervo", "lluvia", "ambulancia", "cuervo") : V.Arr("cuervo", "dron", "ambulancia", "fuegos")).str);
            });
            SN.Events.on("market:event", d =>
            {
                V ev = d["event"];
                addNews(V.Obj("title", ev["title"], "text", ev["text"], "tone", ev["tone"], "market", d["market"], "art", ev["art"], "ev", ev["id"], "kind", ev["kind"]));
            });
            SN.Events.on("market:event-resolved", n =>
            {
                addNews(V.Obj("title", n["text"], "tone", n["tone"], "market", n["market"], "art", n["art"], "ev", n["e"].truthy ? n["e"]["id"] : n["e"], "kind", "result"));
            });
            SN.Events.on("debt:paid", d =>
            {
                V auto = d["auto"], debt = d["debt"];
                pending.Insert(0, () => onDebtPaid(auto, debt));
            });
            SN.Events.on("debt:defaulted", _ => { addNews(V.Obj("title", "Plazo vencido. Embargo.", "tone", "neg", "art", "documento")); });
            // La revelación: después de que "Kevo [PAGADO]" te escriba, el encapuchado te cuenta qué cobró
            SN.Events.on("kevo:done", d =>
            {
                V run = SN.State.run;
                if (d["id"] == "pagado" && run.truthy && !run["storySeen"]["kevoPaid"])
                {
                    run["storySeen"]["kevoPaid"] = true;
                    pending.Add(() => hoodedScene(Story()["hoodedEvents"]["kevoPaid"], V.Obj("smile", true)));
                }
            });
            SN.Events.on("day:changed", _ =>
            {
                cityNews();
                // Bravo Fines se presenta la mañana siguiente a pagar la Pleyzeta
                V run = SN.State.run;
                if (run.truthy && run["flags"]["debtPaid"].truthy && !run["flags"]["academy"] && !run["flags"]["bravoQueued"] && !(SN.Tutorial != null && SN.Tutorial.active))
                {
                    run["flags"]["bravoQueued"] = true;
                    pending.Add(() => bravoIntro());
                }
            });
            // Día de la suerte: portada, y si llueve oro, se ve por la ventana
            SN.Events.on("luck:day", l =>
            {
                V sp = SN.Data["luck"]["specials"];
                addNews(V.Obj("title", SN.Data["luck"]["news"]["title"].str + " " + JsString.repeat("★", (int)l["k"].num),
                    "text", SN.Data["luck"]["news"]["text"].str + " Hoy: " + l["events"].arr.map(e => sp[e]["name"]).join(", ") + ".",
                    "tone", "pos", "art", "trebol"));
                if (l["events"].arr.includes("lluvia"))
                {
                    addNews(V.Obj("title", "LLUEVE ORO SOBRE LA CIUDAD", "text", sp["lluvia"]["text"], "tone", "pos", "art", "oro"));
                    SN.after(2, () => SN.Desk.windowEvent("oro"));
                }
            });
            // El encapuchado sabe de este idioma: con el primer símbolo te pide que no digas nada; con todos, otra cosa
            SN.Events.on("cipher:found", d =>
            {
                V run = SN.State.run;
                if (!run || !d["isNew"].truthy) return;
                if (d["count"] == 1)
                {
                    SN.Events.emit("chat:flag", V.Obj("flag", "cipher"));
                    pending.Add(() => hoodedScene(SN.Data["cipher"]["hoodFirst"]));
                }
                if (d["count"] == d["total"]) pending.Add(() => hoodedScene(SN.Data["cipher"]["hoodAll"], V.Obj("smile", true)));
            });
            SN.Events.on("trade:closed", r =>
            {
                V run = SN.State.run;
                if (!run["flags"]["debtPaid"].truthy || r["pnl"].num <= 0) return;
                profitableSinceDebt++;
                // Cuanto más ganas (en proporción), más probable es que alguien lo pague. En el mercado negro, casi siempre.
                bool black = SN.Data.marketById(r["market"])["black"].truthy;
                double chance = black ? 0.85 : profitableSinceDebt == 2 ? 1 : Util.clamp(0.2 + r["pnl"].num / JsMath.max(50, run["capital"].num) * 0.8, 0.2, 0.75);
                if (JsMath.rnd() < chance) darkNews(r["market"]);
            });
        }
    }
}
