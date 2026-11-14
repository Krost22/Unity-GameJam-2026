// Port de js/systems/upgrades.js. UpgradeManager: estadísticas mejorables (Suerte, Límite de inversión,
// Análisis, Resistencia futura). Precios y efectos vienen de data/simulation.js. Se compran A CRÉDITO: cada
// mejora es también una deuda (precio + intereses de D.credit, que se suman a la deuda activa).
namespace SaldoNegro.Logic
{
    public sealed class Upgrades
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public V def(V id) { return D["upgrades"].arr.find((u) => u["id"] == id); }
        public double level(V id) { return (S.run && S.run["upgrades"][id]) || 0; }

        // Valor actual del efecto (0 / base si no se ha comprado)
        public V value(V id)
        {
            V d = def(id);
            double lv = level(id);
            if (lv == 0 || double.IsNaN(lv)) return d["base"] || 0;
            return d["levels"][lv - 1]["value"];
        }
        public V next(V id) { V d = def(id); return d["levels"][level(id)] || V.@null; }

        public bool isUnlocked(V id)
        {
            V u = def(id)["unlock"];
            if (u["type"] == "start") return true;
            if (u["type"] == "gift") return !!(S.run["gifts"] && S.run["gifts"][id]); // llegó como "regalo" del encapuchado
            if (u["type"] == "flag") return !!S.run["flags"][u["flag"]];
            if (u["type"] == "goal") return SN.Unlocks.goalReached(u["goal"]);
            return false; // 'future': preparado para próximas versiones
        }

        // A crédito: hoy no pagas nada. Lo que se suma a la deuda (precio + intereses)
        public double creditCost(V id) { V n = next(id); return n ? JsMath.round(n["cost"] * (1 + D["credit"]["interest"])) : 0; }

        // Se puede comprar si está desbloqueada, no hay una operación en curso y, con lo que se suma a la deuda,
        // todavía se podría pagar a tiempo (si no, sería perder seguro)
        public V canBuy(V id)
        {
            V n = next(id);
            if (!n || !isUnlocked(id) || S.run["position"]) return V.Obj("ok", false);
            double debt = creditCost(id);
            if (SN.Debt.active() && SN.Debt.hopeless(debt)) return V.Obj("ok", false, "reason", "YA NO PODRÍAS PAGAR A TIEMPO", "debt", debt);
            return V.Obj("ok", true, "cost", n["cost"], "debt", debt);
        }

        public bool buy(V id)
        {
            V can = canBuy(id);
            if (!can["ok"]) return false;
            SN.Debt.charge(can["debt"], "la mejora (" + def(id)["name"] + ")");
            S.run["upgrades"][id] = level(id) + 1;
            SN.Events.emit("upgrade:bought", V.Obj("id", id, "level", S.run["upgrades"][id], "debt", can["debt"]));
            return true;
        }
    }
}
