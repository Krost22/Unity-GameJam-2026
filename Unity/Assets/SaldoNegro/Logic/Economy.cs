// Port de js/systems/economy.js. EconomyManager: capital disponible, dinero comprometido en operaciones,
// ganancias, pérdidas y pagos.
namespace SaldoNegro.Logic
{
    public sealed class Economy
    {
        static State S { get { return SN.State; } }

        void changed(double from, V reason, V extra = null)
        {
            V to = S.run["capital"];
            SN.Events.emit("capital:changed", JsObject.Assign(V.Obj("from", from, "to", to, "delta", to - from, "reason", reason), extra || new JsObject()));
            if (to > S.profile["bestCapital"]) S.profile["bestCapital"] = to;
        }

        public V capital { get { return S.run ? S.run["capital"] : 0; } }
        public V committed { get { return S.run ? S.run["committed"] : 0; } }

        public bool canAfford(double cost) { return S.run["capital"] >= cost; }

        public void add(double amount, V reason)
        {
            double from = S.run["capital"];
            S.run["capital"] = JsMath.max(0, round2(from + amount));
            changed(from, reason);
        }

        public bool spend(double cost, V reason)
        {
            if (!canAfford(cost)) return false;
            double from = S.run["capital"];
            S.run["capital"] = round2(from - cost);
            changed(from, reason);
            return true;
        }

        // Reserva dinero para una operación abierta (no cuenta como bancarrota)
        public void commit(double amount)
        {
            double from = S.run["capital"];
            S.run["capital"] = round2(from - amount);
            S.run["committed"] = round2(S.run["committed"] + amount);
            changed(from, "commit");
        }

        // Devuelve lo comprometido más el resultado (nunca deja capital negativo)
        public void settle(double amount, double pnl)
        {
            double from = S.run["capital"];
            S.run["committed"] = JsMath.max(0, round2(S.run["committed"] - amount));
            S.run["capital"] = JsMath.max(0, round2(from + amount + pnl));
            changed(from, "trade", V.Obj("pnl", pnl));
        }

        // Capital disponible y liquidable (lo que realmente tienes si no hay operaciones abiertas)
        public double liquid() { return S.run["capital"] + S.run["committed"]; }

        static double round2(double v) { return JsMath.round(v); } // dinero siempre en dólares enteros
    }
}
