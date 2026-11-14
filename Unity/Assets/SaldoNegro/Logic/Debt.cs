// Port de js/systems/debt.js. DebtManager: la deuda activa (solo hay una a la vez), su plazo, el pago y el
// vencimiento. La primera es la Pleyzeta; después llegan los "regalos" del encapuchado y las ofertas de
// FUTURO.exe (ver js/data/progression.js). Todas funcionan igual: si vence el plazo y no te alcanza, embargo.
namespace SaldoNegro.Logic
{
    public sealed class Debt
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public Debt()
        {
            // Al empezar un día después del plazo: si te alcanza se cobra sola; si no, embargo
            SN.Events.on("day:changed", (e) =>
            {
                V day = e["day"];
                V debt = S.run["debt"];
                if (!debt || debt["paid"] || debt["defaulted"] || day <= debt["deadlineDay"]) return;
                if (S.run["capital"] >= debt["amount"]) SN.Debt.pay(true);
                else
                {
                    debt["defaulted"] = true;
                    SN.Events.emit("debt:defaulted", V.Obj("amount", debt["amount"], "seized", S.run["capital"], "debt", debt));
                }
            });
        }

        public V current { get { return S.run["debt"]; } }
        // ¿Hay una deuda sin pagar?
        public bool active() { V d = S.run && S.run["debt"]; return !!d && !d["paid"]; }
        public double amount { get { return active() ? S.run["debt"]["amount"].num : 0; } }
        public double daysLeft() { return active() ? JsMath.max(0, S.run["debt"]["deadlineDay"] - S.run["day"] + 1) : 0; }
        public bool canPay() { return active() && !S.run["position"] && S.run["capital"] >= S.run["debt"]["amount"]; }

        // Turnos que quedan para operar antes de que venza el plazo
        public double turnsLeft()
        {
            V run = S.run;
            if (!active()) return 0;
            double n = D["sim"]["turnNames"].length;
            return JsMath.max(0, (run["debt"]["deadlineDay"] - run["day"]) * n + n - run["turn"]);
        }

        // Ya no hay forma de llegar: ni multiplicando el capital al máximo en cada turno que queda se alcanza.
        // Cada mercado tiene un tope por apuesta: un turno no puede dar más que el mejor tope abierto.
        // extra: lo que se sumaría a la deuda (para no dejar comprar a crédito algo que ya no podrías pagar)
        public bool hopeless(double extra = 0)
        {
            V run = S.run, d = run["debt"];
            if (!active() || d["defaulted"] || run["position"]) return false;
            double cap = SN.Trading.bestCap(), goal = d["amount"] + extra;
            double c = run["capital"];
            for (double n = turnsLeft(); n > 0 && c < goal; n--) c += JsMath.min(c * (D["sim"]["maxTurnGrowth"] - 1), cap);
            return c < goal;
        }

        // Compra a crédito: suma a la deuda activa o, si no debes nada, abre una nueva (mismo plazo para todo)
        public V charge(double amount, V label)
        {
            V run = S.run;
            amount = JsMath.round(amount);
            if (active())
            {
                run["debt"]["amount"] = run["debt"]["amount"] + amount;
                run["debt"]["extra"] = (run["debt"]["extra"] || 0) + amount;
                SN.Events.emit("debt:charged", V.Obj("amount", amount, "debt", run["debt"]));
                return run["debt"];
            }
            return open(V.Obj("id", "credito-" + run["day"] + "-" + run["turn"], "kind", "credit", "label", label, "amount", amount, "days", D["credit"]["days"]));
        }

        // Abre una deuda nueva: { id, kind, label, amount, days }. "N días" cuenta el de hoy, como la Pleyzeta.
        public V open(V o)
        {
            V run = S.run;
            if (run["debt"]) run["debts"].arr.push(run["debt"]);
            run["debt"] = V.Obj(
                "id", o["id"], "kind", o["kind"], "label", o["label"], "amount", JsMath.round(o["amount"]),
                "start", run["day"], "deadlineDay", run["day"] + o["days"] - 1, "paid", false, "defaulted", false);
            SN.Events.emit("debt:opened", V.Obj("debt", run["debt"]));
            return run["debt"];
        }

        public bool pay(bool auto = false)
        {
            if (!canPay()) return false;
            V d = S.run["debt"];
            SN.Economy.spend(d["amount"], "debt");
            d["paid"] = true;
            d["paidDay"] = S.run["day"];
            if (d["id"] == "pleyzeta") S.run["flags"]["debtPaid"] = true;
            // Bono por usar la app: nunca te quedas a cero al saldar una deuda. No llega todavía: lo entrega
            // el encapuchado en su escena (giveBonus, desde js/systems/narrative.js)
            d["bonus"] = D.payBonusFor(d["amount"], SN.Unlocks.nextDebtAmount(), S.run["capital"]);
            d["bonusPending"] = true;
            SN.Events.emit("debt:paid", V.Obj("auto", auto, "amount", d["amount"], "debt", d, "bonus", d["bonus"]));
            return true;
        }

        // El encapuchado entrega el bono de una deuda saldada: ahora sí se suma al dinero
        public double giveBonus(V d)
        {
            if (!d || !d["bonusPending"]) return 0;
            d["bonusPending"] = false;
            SN.Economy.add(d["bonus"], "reward");
            return d["bonus"];
        }
        // Bonos ya ganados que todavía no te ha dado (cuentan como tuyos: no te arruinas esperándolos)
        public double pendingBonus()
        {
            V run = S.run;
            if (!run) return 0;
            V all = new JsArray(); all.arr.push(run["debt"]); foreach (var x in (run["debts"] || new JsArray())) all.arr.push(x);
            return all.arr.reduce((t, d) => t + (d && d["bonusPending"] ? d["bonus"] : 0), 0);
        }
        // Partida cargada con un bono sin entregar (se cerró el juego en medio de la escena): se entrega ya
        public void flushBonuses()
        {
            V run = S.run;
            if (!run) return;
            var all = new JsArray(); all.push(run["debt"]); foreach (var x in (run["debts"] || new JsArray())) all.push(x);
            foreach (var d in all) giveBonus(d);
        }
    }
}
