// Port de js/systems/luck.js. LuckManager: los DÍAS DE LA SUERTE (configuración en js/data/luck.js). Un día es
// de la suerte si su número lleva un 7; su intensidad es cuántos sietes tiene (1-3). Ese día los mercados
// abiertos crecen, las operaciones ganadoras dan un extra y pueden salir eventos especiales: Lluvia de Oro,
// Mercado Dorado, Ruleta de la Fortuna, Estrella de la Suerte y Bendición de la Fortuna.
// El día se sortea al empezar con el generador de la partida (recargar no cambia nada) y se guarda en run.luck.
// No toca la interfaz: avisa con 'luck:day' y 'luck:spin'.
using System;

namespace SaldoNegro.Logic
{
    public sealed class Luck
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }
        static V cfg() { return D["luck"]; }

        // Para las pruebas (logic.test.js hace SN.Luck.today = () => null)
        public Func<V> todayPatch;

        public Luck()
        {
            // Cada día nuevo se mira si lleva un 7
            SN.Events.on("day:changed", (e) => roll(e["day"]));
        }

        public int sevens(V day) { int n = 0; foreach (char c in day.str) if (c == '7') n++; return n; }
        public int intensity(V day) { return Math.Min(3, sevens(day)); }
        public bool isLucky(V day) { return sevens(day) > 0; }
        // El día de la suerte de hoy (o null)
        public V today()
        {
            if (todayPatch != null) return todayPatch();
            V run = S.run;
            return run && run["luck"] && run["luck"]["day"] == run["day"] ? run["luck"] : V.@null;
        }
        public double k() { V l = today(); return l ? l["k"].num : 0; }
        public bool has(V ev) { V l = today(); return !!l && l["events"].arr.includes(ev); }

        // Sorteo del día: qué eventos especiales salen (según los sietes)
        public V roll(V day)
        {
            V run = S.run, c = cfg();
            int k = intensity(day);
            if (k == 0) { run["luck"] = V.@null; return V.@null; }
            RNG rng = S.rng;
            JsArray events;
            if (k >= 3) events = c["big"].arr.concat(c["light"]);
            else if (k == 2)
            {
                events = new JsArray();
                events.push(c["big"][rng.@int(0, c["big"].length - 1)]);
                var sh = shuffle(c["light"].arr, rng);
                foreach (var x in sh.slice(0, (int)rng.@int(1, 2))) events.push(x);
            }
            else events = V.Arr(c["light"][rng.@int(0, c["light"].length - 1)]).arr;
            JsArray open = D["markets"].arr.filter((d) => run["markets"][d["id"]] && run["markets"][d["id"]]["unlocked"]).map((d) => d["id"]);
            // Objetos dorados: todos con el MERCADO DORADO; si no, quizá alguno (más con la Bendición)
            JsArray golden = new JsArray();
            if (events.includes("dorado")) golden = c["golden"].arr.map((g) => g["id"]);
            else
            {
                double p = c["goldenChance"] * k * (events.includes("bendicion") ? 2 : 1);
                if (rng.next() < p) golden = V.Arr(c["golden"][rng.@int(0, c["golden"].length - 1)]["id"]).arr;
            }
            run["luck"] = V.Obj(
                "day", day, "k", k, "events", events, "golden", golden,
                "star", events.includes("estrella") && open.length > 0 ? open[(int)rng.@int(0, open.length - 1)] : V.@null,
                "spun", false);
            // Cada día de la suerte, la app Símbolos enseña una pista más del idioma secreto
            if (SN.Cipher != null) { V cs = SN.Cipher.state(); cs["hints"] = (cs["hints"] || 0) + 1; }
            SN.Events.emit("luck:day", run["luck"]);
            return run["luck"];
        }

        // Tendencia extra (en unidades de fase: 1 = una fase alcista completa) para los mercados abiertos
        public double trend(V marketId)
        {
            V l = today(), run = S.run;
            if (!l || !run["markets"][marketId] || !run["markets"][marketId]["unlocked"]) return 0;
            double t = cfg()["trend"] * l["k"];
            if (l["events"].arr.includes("lluvia")) t += cfg()["rainTrend"];
            if (!run["flags"]["debtPaid"]) t *= cfg()["firstDebtScale"]; // el día 7 es el plazo de la Pleyzeta
            return t;
        }
        // ESTRELLA DE LA SUERTE: las ganancias (y el tope) de ese mercado valen más hoy
        public double starMul(V marketId) { V l = today(); return l && l["star"] == marketId ? cfg()["starMul"].num : 1; }
        // Bonificación por una operación ganadora
        public double bonus(double pnl) { V l = today(); return l && pnl > 0 ? JsMath.round(pnl * cfg()["bonus"] * l["k"]) : 0; }
        // BENDICIÓN: un nivel más de Suerte hoy
        public double luckBoost() { return has("bendicion") ? 1 : 0; }
        // Rebaja de Don Siete en el estilo de vida (día del MERCADO DORADO)
        public double discount() { return has("dorado") ? cfg()["discount"].num : 0; }
        public V goldenToday() { V l = today(); return l ? (l["golden"] || new JsArray()) : new JsArray(); }

        // ---------- Ruleta de la Fortuna ----------
        public bool canSpin() { V l = today(); return !!l && l["events"].arr.includes("ruleta") && !l["spun"] && !S.run["position"]; }
        // Elige casilla (las raras salen el doble con la Bendición) y gasta el giro del día. El premio, con apply()
        // (la interfaz primero hace girar la ruleta y luego lo entrega).
        public V pick()
        {
            if (!canSpin()) return V.@null;
            V l = today();
            RNG rng = S.rng;
            V wheel = cfg()["wheel"];
            double rare = has("bendicion") ? 2 : 1;
            JsArray weights = wheel.arr.map((w) => w["weight"] * (w["rare"] ? rare : 1));
            double r = rng.next() * weights.reduce((a, b) => a + b, 0);
            int i = 0;
            while (r >= weights[i] && i < wheel.length - 1) { r -= weights[i]; i++; }
            l["spun"] = true;
            return V.Obj("index", i, "id", wheel[i]["id"], "label", wheel[i]["label"]);
        }
        public V spin()
        {
            V p = pick();
            if (!p) return V.@null;
            V @out = p.obj.assign(apply(p["id"], k()));
            SN.Events.emit("luck:spin", @out);
            return @out;
        }
        public V apply(V id, double k)
        {
            V run = S.run, debt = SN.Debt.active() ? run["debt"] : V.@null;
            Func<double, V> money = (v) => { v = JsMath.round(v); SN.Economy.add(v, "luck"); return V.Obj("money", v, "text", "+" + Util.money(v)); };
            if (id == "poco") return money(JsMath.max(20, run["capital"] * 0.05 * k));
            if (id == "mucho") return money(JsMath.max(100, run["capital"] * 0.2 * k));
            if (id == "siete") return money(777 * k);
            if (id == "plazo")
            {
                if (!debt) return money(JsMath.max(20, run["capital"] * 0.05 * k));
                debt["deadlineDay"] = debt["deadlineDay"] + 1;
                return V.Obj("text", "+1 día para pagar " + debt["label"]);
            }
            if (id == "seguro") { run["shield"] = true; return V.Obj("text", "Tu próxima pérdida será $0"); }
            if (id == "maldita")
            {
                if (!debt) return V.Obj("text", "Nada... esta vez");
                debt["amount"] = JsMath.round(debt["amount"] * 1.07);
                return V.Obj("text", "Tu deuda sube a " + Util.money(debt["amount"]));
            }
            if (id == "simbolo")
            {
                V clue = SN.Cipher != null ? SN.Cipher.wildcard(S.rng) : V.@null;
                if (clue) return V.Obj("text", "Un símbolo: " + D["cipher"]["alphabet"][clue["letter"]] + " = " + clue["letter"], "clue", clue);
                return money(777 * k);
            }
            return V.Obj("text", "La casa siempre gana.");
        }

        static JsArray shuffle(JsArray a, RNG r)
        {
            JsArray b = a.slice();
            for (int i = b.length - 1; i > 0; i--) { int j = (int)r.@int(0, i); V t = b[i]; b[i] = b[j]; b[j] = t; }
            return b;
        }
    }
}
