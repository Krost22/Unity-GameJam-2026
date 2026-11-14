// Port de js/systems/academy.js. AcademyManager: el árbol de habilidades de Bravo Fines (datos en
// js/data/academy.js). Se abre cuando Bravo se presenta (run.flags.academy). Lo comprado se guarda en
// run.academy. Efectos:
//   negocios  -> dinero cada mañana ('day:changed'), con su aviso ('academy:income')
//   tiburón   -> un extra en cada operación ganadora (SN.Trading.settle)
//   Plan B    -> la primera pérdida de cada día, a la mitad (SN.Trading.settle)
//   letra pequeña -> menos deuda en las ofertas de FUTURO.exe (SN.Unlocks.offer)
// No toca la interfaz.
namespace SaldoNegro.Logic
{
    public sealed class Academy
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }
        static V A { get { return D["academy"]; } }

        public Academy()
        {
            // Cada mañana, los negocios pagan
            SN.Events.on("day:changed", (_) =>
            {
                double v = income();
                if (v == 0 || double.IsNaN(v) || !S.run) return;
                SN.Economy.add(v, "academy");
                SN.Events.emit("academy:income", V.Obj("amount", v, "nodes", owned().filter((n) => n["income"].truthy)));
            });
        }

        public bool open() { return !!(S.run && S.run["flags"]["academy"]); }
        public JsArray nodes() { return A["branches"].arr.flatMap((b) => b["nodes"].arr.map((n) => (V)JsObject.Assign(V.Obj("branch", b["id"]), n))); }
        public V node(V id) { return nodes().find((n) => n["id"] == id); }
        public bool has(V id) { return !!(S.run && S.run["academy"] && S.run["academy"][id]); }
        public JsArray owned() { return nodes().filter((n) => has(n["id"])); }

        // ¿Se puede comprar? Abierta, que no sea "Próximamente", con el anterior de su rama y con dinero
        // (sin quedarte por debajo de la apuesta mínima)
        public V canBuy(V id)
        {
            V run = S.run, n = node(id);
            if (!run || !n) return V.Obj("ok", false);
            if (!open()) return V.Obj("ok", false, "reason", "BRAVO TODAVÍA NO TE CONOCE", "locked", true);
            if (has(id)) return V.Obj("ok", false, "reason", "YA ES TUYO", "owned", true);
            if (n["soon"]) return V.Obj("ok", false, "reason", "PRÓXIMAMENTE", "locked", true, "soon", true);
            V br = A["branches"].arr.find((b) => b["id"] == n["branch"]);
            int i = br["nodes"].arr.findIndex((x) => x["id"] == id);
            if (i > 0 && !has(br["nodes"][i - 1]["id"])) return V.Obj("ok", false, "reason", "PRIMERO: " + JsString.upper(br["nodes"][i - 1]["name"].str), "locked", true);
            if (run["position"]) return V.Obj("ok", false, "reason", "HAY UNA OPERACIÓN EN CURSO");
            if (run["capital"] - n["cost"] < D["sim"]["bankruptcyThreshold"]) return V.Obj("ok", false, "reason", run["capital"] < n["cost"] ? "NO TE ALCANZA" : "TE QUEDARÍAS SIN NADA");
            return V.Obj("ok", true, "cost", n["cost"]);
        }
        // Lo que se puede comprar ahora mismo (para los números rojos)
        public JsArray buyable() { return open() ? nodes().filter((n) => canBuy(n["id"])["ok"].truthy) : new JsArray(); }

        public bool buy(V id)
        {
            V can = canBuy(id);
            if (!can["ok"]) return false;
            V run = S.run;
            SN.Economy.spend(can["cost"], "academy");
            if (!run["academy"]) run["academy"] = new JsObject();
            run["academy"][id] = true;
            SN.Events.emit("academy:bought", V.Obj("node", node(id)));
            return true;
        }

        // ---------- Efectos ----------
        public double income() { return owned().reduce((s, n) => s + (n["income"] || 0), 0); }
        // Extra de la Mentalidad de tiburón en una operación ganadora
        public double bonus(double pnl) { return pnl > 0 ? JsMath.round(pnl * owned().reduce((s, n) => s + (n["bonus"] || 0), 0)) : 0; }
        // Plan B: la primera pérdida del día, a la mitad (devuelve la pérdida que queda)
        public double halve(double pnl)
        {
            V run = S.run;
            if (pnl >= 0 || !owned().some((n) => n["halve"].truthy) || run["planBDay"] == run["day"]) return pnl;
            run["planBDay"] = run["day"];
            return JsMath.round(pnl / 2);
        }
        public double offerMul() { return owned().reduce((k, n) => k * (n["offer"] || 1), 1); }
    }
}
