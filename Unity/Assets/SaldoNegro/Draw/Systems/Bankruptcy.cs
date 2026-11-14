// Port de js/systems/bankruptcy.js (SN.Bankruptcy). BankruptcyManager: qué pasa al perder. Se pierde sin dinero ni para la
// apuesta mínima (nunca por tener dinero comprometido en una operación), cuando vence el plazo sin pagar, o cuando ya es
// imposible pagar a tiempo.
// 1) VIDA EXTRA: el rescate bancario (js/render/bailout.js). Llamas a la Línea de Rescate Financiero, te haces
//    pasar por un banco "demasiado grande para caer" y Donald Trompa te transfiere el dinero de los
//    contribuyentes. La partida sigue (si el problema era el plazo: nadie embarga a un banco sistémico, 2 días
//    más). Uno por meta.
// 2) SIN RESCATE: pierdes de verdad y vuelves al inicio de la meta en la que ibas, con los fondos que
//    tenías al empezarla (punto de control de SN.State). Nunca se pierde toda la partida.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Bankruptcy
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public bool active;
        public DomElement ui;
        public double coins;
        public string reason;
        public Action<string> resolve;

        static string esc(V t) { return t.str.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;"); }
        // String.prototype.replace con un texto: solo reemplaza la primera aparición
        static string once(string s, string find, string with)
        {
            int k = s.IndexOf(find, StringComparison.Ordinal);
            return k < 0 ? s : s.Substring(0, k) + with + s.Substring(k + find.Length);
        }

        public bool shouldTrigger()
        {
            V run = S.run;
            return run.truthy && !run["position"] && run["capital"].num + run["committed"].num + SN.Debt.pendingBonus() < D["sim"]["bankruptcyThreshold"].num;
        }

        // Sin fondos para seguir apostando: aviso corto y directo a la vida extra
        public async Promise<string> broke()
        {
            SN.Game.setState("BANKRUPTCY");
            SN.Game.resetTime();
            V a = D["story"]["broke"][0], b = D["story"]["broke"][1];
            if (SN.Music != null) SN.Music.tapeStop(); // sin dinero: la cinta se para
            SN.Audio.sfx("notifyBad");
            SN.FX.shake(3, 0.4);
            await SN.UI.stamp(a.str, "coral", b.str, 1.8);
            return await lose("broke");
        }

        // Plazo vencido (o imposible de cumplir) sin dinero suficiente: el cobrador se lo lleva todo
        public async Promise<string> embargo(V opts = null)
        {
            bool early = !(opts is null) && opts["early"].truthy;
            SN.Game.setState("BANKRUPTCY");
            SN.Game.resetTime();
            if (SN.Music != null) SN.Music.tapeStop();
            SN.Audio.setMood("tense");
            SN.Desk.led = "alert";
            V st = early ? D["story"]["embargoEarly"] : D["story"]["embargo"];
            V a = st[0], b0 = st[1], c = st[2];
            string b = once(b0.str, "{amount}", Util.money(S.run["debt"].truthy ? S.run["debt"]["amount"].num : D["sim"]["startDebt"].num));
            SN.Audio.sfx("notifyBad");
            SN.FX.shake(4, 0.6);
            string last = S.run["rescue"] == "ready" ? D["story"]["rescue"]["embargo"].str : c.str + ": " + Util.money(S.run["capital"].num);
            await SN.UI.card("<div class=\"overlay-panel\"><div class=\"t1\">" + a.str + "</div><div class=\"t2\">" + b + "</div><div class=\"t2\">" + last + "</div></div>", "daycard embargo", 2.6);
            await SN.wait(0.4);
            return await lose(early ? "hopeless" : "deadline");
        }

        public async Promise<string> lose(string reason)
        {
            this.reason = reason;
            SN.Game.setState("BANKRUPTCY");
            SN.Windows.close(true);
            SN.Dialog.hide();
            SN.UI.clearSpot();
            SN.Hands.drumming = false;
            if (S.run["rescue"] == "ready") return await extraLife();
            return await finalLoss();
        }

        // Vida extra: la llamada a la Línea de Rescate y la videollamada con el Presidente
        public async Promise<string> extraLife()
        {
            V st = D["story"]["rescue"]["card"];
            SN.Audio.setMood("tense");
            await SN.UI.card("<div class=\"overlay-panel\"><div class=\"t1\">" + st["title"].str + "</div><div class=\"t2\">" + st["lines"][0].str + "</div><div class=\"t3\">" + st["lines"][1].str + "</div></div>", "daycard", 3.2);
            coins = S.rescueAmount();
            active = true;
            V done = await SN.Bailout.play(V.Obj("coins", coins));
            if (!done.truthy) return null; // se salió al menú en mitad de la llamada (undefined en la web)
            return await showRescue();
        }

        // De vuelta en FUTURO.exe: el justificante de la transferencia y el mensaje
        public Promise<string> showRescue()
        {
            V R = D["story"]["rescue"], rc = R["receipt"], st = R["done"];
            bool late = reason == "deadline" || reason == "hopeless";
            SN.Audio.setMood("normal");
            SN.Audio.sfx("notify");
            SN.Audio.sfx("cash");
            DomElement el = Dom.el("div", "overlay-panel rescue-ui");
            el.innerHTML = "<div class=\"rc-receipt\">\n" +
                "          <div class=\"rc-h\"><span class=\"rc-seal\"></span>" + esc(rc["title"]) + "</div>\n" +
                "          <div class=\"rc-row\"><span>De</span><b>" + esc(rc["from"]) + "</b></div>\n" +
                "          <div class=\"rc-row\"><span>Para</span><b>" + esc(rc["to"]) + "</b></div>\n" +
                "          <div class=\"rc-row\"><span>Concepto</span><b>" + esc(rc["concept"]) + "</b></div>\n" +
                "          <div class=\"rc-amt\">+" + Util.money(coins) + "</div>\n" +
                "        </div>\n" +
                "        <div class=\"t1\">" + esc(st["title"]) + "</div><div class=\"t2\">" + esc(st["message"]) + "</div>\n" +
                "        <div class=\"t3\">" + esc(late ? st["extension"] : st["extra"]) + "</div>\n" +
                "        <div class=\"row\"><button class=\"btn btn-yellow\" id=\"bk-continue\">Seguir jugando</button></div>";
            // El escudo del justificante: la moneda con el ojo
            DomElement seal = Dom.el("canvas");
            seal.width = 9;
            seal.height = 9;
            Ctx2D g = seal.getContext();
            Px.ellipse(g, 4, 4, 4, 4, PAL.yellowD); Px.ellipse(g, 4, 4, 3, 3, PAL.yellow);
            Px.rect(g, 2, 4, 5, 1, PAL.coalD); Px.rect(g, 4, 4, 1, 1, PAL.coalDD);
            seal.style.width = "9px";
            seal.style.height = "9px";
            el.querySelector(".rc-seal").replaceWith(seal);
            SN.KW.apply(el);
            Dom.byId("layer-top").appendChild(el);
            ui = el;
            el.querySelector("#bk-continue").addEventListener("click", (e) => finish("continue"));
            return new Promise<string>((r) => { resolve = r; });
        }

        // Sin rescate: vuelves al inicio de la meta con lo que tenías entonces
        public async Promise<string> finalLoss()
        {
            V cp = S.run["checkpoint"], st = D["story"]["finalLoss"];
            SN.Audio.setMood("silent");
            SN.Audio.sfx("liquidation");
            SN.Audio.sfx("broke", V.Obj("at", 0.7)); // y una caja de música rota
            SN.Desk.led = "alert";
            S.profile["runs"] = S.profile["runs"] + 1;
            S.restoreCheckpoint();
            SN.Save.saveRun();
            SN.Save.saveProfile();
            string where = cp.truthy ? cp["label"].str : "la deuda de la Pleyzeta";
            string money = Util.money(cp.truthy ? cp["capital"].num : D["sim"]["startCapital"].num);
            DomElement el = Dom.el("div", "overlay-panel final-loss");
            el.innerHTML = "<div class=\"t1\">" + st["title"].str + "</div><div class=\"t2\">" + st["message"].str + "</div>\n" +
                "        <div class=\"t3\">" + once(once(st["back"].str, "{where}", where), "{money}", money) + "</div>\n" +
                "        <div class=\"row\"><button class=\"btn btn-yellow\" id=\"bk-retry\">Volver a intentarlo</button><button class=\"btn btn-cream\" id=\"bk-menu\">Volver al menú</button></div>";
            SN.KW.apply(el);
            Dom.byId("layer-top").appendChild(el);
            ui = el;
            active = true;
            return await new Promise<string>((r) =>
            {
                resolve = r;
                el.querySelector("#bk-retry").addEventListener("click", (e) => finish("retry"));
                el.querySelector("#bk-menu").addEventListener("click", (e) => finish("menu"));
            });
        }

        // Limpia la secuencia (también se usa al salir al menú)
        public void reset()
        {
            if (SN.Bailout != null) SN.Bailout.abort();
            if (ui != null) ui.remove();
            ui = null;
            active = false;
            SN.Desk.led = "idle";
        }

        public void finish(string choice)
        {
            SN.Audio.sfx("click");
            double c = coins;
            reset();
            var r = resolve;
            resolve = null;
            if (choice == "continue") resume(c);
            else if (choice == "retry") SN.Game.startRun(loaded: true, greeting: "rewind");
            else SN.Game.toMenu();
            if (r != null) r(choice);
        }

        // Tras el rescate: el dinero entra y la partida sigue donde estaba
        public void resume(double coins)
        {
            V run = S.run, R = D["story"]["rescue"];
            run["rescue"] = "used";
            run["rescues"] = (run["rescues"] || (V)0) + 1;
            if (reason == "deadline" || reason == "hopeless")
            {
                V debt = run["debt"];
                debt["deadlineDay"] = JsMath.max(debt["deadlineDay"].num, run["day"].num) + 2;
                debt["defaulted"] = false;
            }
            SN.Game.setState("GAMEPLAY");
            SN.Audio.setMood("normal");
            SN.Economy.add(coins, "rescue");
            // El dinero llega a la cuenta: monedas sobre el capital
            V cap = SN.UI.posIn(Dom.byId("hud-capital"));
            SN.FX.coins(cap["x"].num + 60, cap["y"].num + 14, 14, 1.4);
            SN.FX.floatText("+" + Util.money(coins), cap["x"].num + cap["w"].num / 2, cap["y"].num + cap["h"].num + 6, "gain");
            SN.Audio.sfx("coin");
            SN.Narrative.addNews(JsObject.Assign(V.Obj(), R["news"]));
            SN.UI.busy = false;
            SN.UI.allow = V.@null;
            SN.UI.renderAll();
            SN.Events.emit("rescue:done", V.Obj("coins", coins));
            SN.Save.saveRun();
            SN.after(1, () => SN.Desktop.check());
        }
    }
}
