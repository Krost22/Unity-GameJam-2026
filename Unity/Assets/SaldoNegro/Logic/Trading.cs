// Port de js/systems/trading.js. TradingManager: SUBE (compra, apuesta a que el precio sube) y BAJA (venta en
// corto, apuesta a que baja).
//   marketChange = (exit - entry) / entry
//   tradeReturn  = marketChange * direction * leverage   (direction: 1 sube, -1 baja)
//   profitLoss   = investment * tradeReturn, nunca menor que -investment (pérdida máxima = lo comprometido)
//                  y siempre dentro del TOPE del mercado: entre -cap y +cap (el primero da poco, el último mucho)
// Las velas de la operación se simulan al abrirla y la interfaz las va mostrando. El jugador puede CERRAR
// en cualquier momento: cobra al precio que ve, y el mercado sigue su curso sin él.
using System;

namespace SaldoNegro.Logic
{
    public sealed class Trading
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        static double round2(double v) { return JsMath.round(v); } // dólares enteros

        public V position { get { return S.run["position"]; } }

        public double limit() { return SN.Upgrades.value("limite") || D["sim"]["baseInvestLimit"]; }

        // Tope por apuesta de un mercado (lo máximo que se gana o se pierde en una operación)
        public double cap(V id) { V d = SN.Market.def(id); return (d && d["cap"]) || V.Infinity; }
        // El mejor tope entre los mercados abiertos (para saber si todavía se llega a pagar)
        public double bestCap()
        {
            double best = 0;
            foreach (var d in D["markets"]) if (S.run["markets"][d["id"]] && S.run["markets"][d["id"]]["unlocked"]) best = JsMath.max(best, cap(d["id"]));
            return best != 0 && !double.IsNaN(best) ? best : double.PositiveInfinity;
        }
        // Resultado dentro de los límites: nunca más pérdida que lo apostado, y siempre dentro del tope.
        // La ESTRELLA DE LA SUERTE multiplica las ganancias (y el tope) de su mercado ese día.
        public double clampPnl(V p, double v)
        {
            double cap = p["cap"] || V.Infinity;
            if (v > 0 && p["star"] > 1) v *= p["star"];
            return JsMath.max(-JsMath.min(p["amount"], cap), JsMath.min(cap, v));
        }
        public double maxAmount() { return JsMath.max(0, Math.Floor(JsMath.min(S.run["capital"], limit()))); }

        // ×1 siempre; ×2, ×5 y ×10 hay que comprarlos (mejora MULTIPLICADOR). El tutorial presta su ×2.
        public bool leverageAvailable(V v)
        {
            V l = D["sim"]["leverages"].arr.find((x) => x["value"] == v);
            if (!l) return false;
            if (!l["level"] || SN.Upgrades.level("multiplicador") >= l["level"]) return true;
            return SN.Tutorial != null && SN.Tutorial.active && v <= D["sim"]["tutorial"]["leverage"];
        }

        // Ajusta la cantidad del formulario a los límites (capital y límite de inversión)
        public void clampForm()
        {
            V f = S.run["form"];
            double max = maxAmount();
            f["amount"] = round2(JsMath.max(JsMath.min(D["sim"]["minInvestment"], max), JsMath.min(f["amount"], max)));
            if (!leverageAvailable(f["leverage"])) f["leverage"] = 1;
        }

        public V validate()
        {
            V f = S.run["form"];
            if (S.run["position"]) return V.Obj("ok", false, "reason", "YA TIENES UNA OPERACIÓN ABIERTA");
            if (!SN.Unlocks.isUnlocked(S.run["selected"])) return V.Obj("ok", false, "reason", "MERCADO BLOQUEADO");
            if (f["amount"] < D["sim"]["minInvestment"]) return V.Obj("ok", false, "reason", "MÍNIMO " + Util.money(D["sim"]["minInvestment"]));
            if (f["amount"] > S.run["capital"] + 1e-9) return V.Obj("ok", false, "reason", "NO TIENES TANTO DINERO");
            if (f["amount"] > limit() + 1e-9) return V.Obj("ok", false, "reason", "LÍMITE: " + Util.money(limit()));
            if (!leverageAvailable(f["leverage"])) return V.Obj("ok", false, "reason", "COMPRA EL MULTIPLICADOR ×" + f["leverage"]);
            return V.Obj("ok", true);
        }

        // Índice de la vela con giro inesperado de esta operación (o -1): solo en la zona de peligro
        public double planTwist(V def, double n, bool tutorial)
        {
            if (tutorial) return D["sim"]["tutorial"]["twistAt"];
            // RESISTENCIA: menos giros en "las cosas que todavía no han pasado"
            double chance = def["twist"]["chance"] * JsMath.max(0, 1 - SN.Upgrades.level("resistencia") * D["sim"]["resistPerLevel"]);
            if (S.rng.next() >= chance) return -1;
            return n - 1 - S.rng.@int(0, D["sim"]["dangerCandles"] - 1);
        }

        // Tamaño y sentido del giro. Si vas perdiendo es algo más fácil que te salve;
        // en conjunto es un riesgo casi neutro: ni regala ni roba, añade tensión.
        public double twistJump(V def, V m, double entry, double direction, bool tutorial)
        {
            if (tutorial) return D["sim"]["tutorial"]["twistJump"];
            bool losing = (m["price"] - entry) * direction < 0;
            bool good = S.rng.next() < (losing ? D["sim"]["twistRescue"].num : 0.5);
            return (good ? direction : -direction) * S.rng.range(def["twist"]["min"], def["twist"]["max"]);
        }

        // La vela de la zona de peligro que merece cámara lenta (la más brusca), o -1 si ninguna destaca
        public double findClimax(JsArray candles, V def, bool liquidated)
        {
            if (liquidated) return candles.length - 1;
            // Una vela de giro cuenta aunque el ruido la haya suavizado; las demás tienen que ser muy bruscas
            double best = -1, size = 0;
            int from = (int)JsMath.max(0, candles.length - D["sim"]["dangerCandles"]);
            for (int i = from; i < candles.length; i++)
            {
                V c = candles[i];
                double r = Math.Abs(c["c"] - c["o"]) / c["o"];
                double need = def["volatility"] * (c["tw"] ? 1.5 : D["sim"]["climaxSigma"].num);
                if (r >= need && r > size) { size = r; best = i; }
            }
            return best;
        }

        public V open(double direction, V opts = null)
        {
            if (opts is null || opts.isUndefined) opts = new JsObject();
            V check = validate();
            if (!check["ok"]) { SN.Events.emit("trade:rejected", check); return V.@null; }
            V run = S.run, f = run["form"];
            V id = run["selected"];
            V m = SN.Market.state(id), def = SN.Market.def(id);
            V lev = f["leverage"];
            V amount = f["amount"]; // se copia ya: el formulario se recalcula cuando cambia el capital
            double entry = m["price"];
            bool tutorial = opts["tutorial"].truthy;
            double n = tutorial ? D["sim"]["tutorial"]["candles"].num : def["candles"].num;
            // SUERTE (y la Bendición de la Fortuna, un nivel más ese día)
            V ctx = V.Obj("direction", direction, "luck", SN.Upgrades.value("suerte") + (SN.Luck != null && !tutorial ? SN.Luck.luckBoost() : 0), "tutorial", tutorial);
            double twistAt = planTwist(def, n, tutorial);

            var candles = new JsArray();
            double exit = entry;
            bool liquidated = false;
            for (int i = 0; i < n; i++)
            {
                // (en el tutorial, después del susto ninguna vela vuelve a subir: quedarse habría salido peor)
                V step = i == twistAt ? JsObject.Assign(ctx, V.Obj("jump", twistJump(def, m, entry, direction, tutorial)))
                    : tutorial && i > twistAt ? JsObject.Assign(ctx, V.Obj("after", true)) : ctx;
                V c = SN.Market.step(id, step);
                candles.push(c);
                // Peor momento dentro de la vela: si la pérdida apalancada llega al 100%, se liquida
                double worst = direction > 0 ? (c["l"] - entry) / entry : (entry - c["h"]) / entry;
                if (worst * lev <= -1)
                {
                    liquidated = true;
                    exit = entry * (1 - direction / lev);
                    break;
                }
                exit = c["c"];
            }

            // Primero la posición y luego el dinero: así nadie recalcula la apuesta a mitad de camino
            run["position"] = V.Obj(
                "market", id, "direction", direction, "amount", amount, "leverage", lev,
                "star", SN.Luck != null && !tutorial ? SN.Luck.starMul(id) : 1,
                "cap", cap(id) * (SN.Luck != null && !tutorial ? SN.Luck.starMul(id) : 1),
                "entry", entry, "exit", exit, "liquidated", liquidated, "candles", candles.length, "total", n, "tutorial", tutorial,
                "climax", findClimax(candles, def, liquidated),
                "day", run["day"], "turn", run["turn"]);
            SN.Economy.commit(amount);
            SN.Save.saveRun(); // se guarda ya: recargar la página no deshace una operación
            SN.Events.emit("trade:opened", V.Obj("position", run["position"], "candles", candles));
            return run["position"];
        }

        // Resultado si la operación se cerrara a este precio (para el marcador en vivo)
        public double pnlAt(double price)
        {
            V p = S.run["position"];
            if (!p) return 0;
            double ret = (price - p["entry"]) / p["entry"] * p["direction"] * p["leverage"];
            return clampPnl(p, p["amount"] * ret);
        }

        // Lo que dejaría la operación si llegase hasta el final
        public double finalPnl(V p)
        {
            if (p["liquidated"]) return clampPnl(p, -p["amount"]);
            return round2(clampPnl(p, p["amount"] * (p["exit"] - p["entry"]) / p["entry"] * p["direction"] * p["leverage"]));
        }

        // CERRAR: cobras al precio que ves. Las velas restantes se siguen mostrando: es lo que te ahorraste (o te perdiste)
        public V cashOut(double price, double candlesSeen)
        {
            V p = S.run["position"];
            if (!p || p["settled"]) return V.@null;
            p["stayPnl"] = finalPnl(p);
            p["exit"] = price;
            p["liquidated"] = false;
            p["cashed"] = true;
            p["cashedAt"] = candlesSeen;
            V r = settle();
            SN.Save.saveRun();
            return r;
        }

        // Cobra la operación: el dinero se mueve aquí; el turno termina en close()
        public V settle()
        {
            V run = S.run, p = run["position"];
            if (!p || p["settled"]) return V.@null;
            double marketChange = (p["exit"] - p["entry"]) / p["entry"];
            double pnl = finalPnl(p);
            bool shielded = false;
            // SEGURO de la ruleta: la próxima pérdida no cuenta
            if (pnl < 0 && run["shield"] && !p["tutorial"]) { pnl = 0; shielded = true; run["shield"] = false; }
            // PLAN B de la Academia: la primera pérdida del día, a la mitad
            double halved = 0;
            if (pnl < 0 && SN.Academy != null && !p["tutorial"]) { double h = SN.Academy.halve(pnl); halved = h - pnl; pnl = h; }
            SN.Economy.settle(p["amount"], pnl);
            // Día de la suerte: bonificación por cada operación ganadora
            double luckBonus = SN.Luck != null && !p["tutorial"] ? SN.Luck.bonus(pnl) : 0;
            if (luckBonus != 0 && !double.IsNaN(luckBonus)) SN.Economy.add(luckBonus, "luck");
            // Mentalidad de tiburón (Academia): un extra por cada operación ganadora
            double academyBonus = SN.Academy != null && !p["tutorial"] ? SN.Academy.bonus(pnl) : 0;
            if (academyBonus != 0 && !double.IsNaN(academyBonus)) SN.Economy.add(academyBonus, "academy");
            V st = run["stats"];
            st["trades"] = st["trades"] + 1;
            if (pnl >= 0) st["wins"] = st["wins"] + 1; else st["losses"] = st["losses"] + 1;
            st["best"] = JsMath.max(st["best"], pnl);
            st["worst"] = JsMath.min(st["worst"], pnl);
            if (pnl > 0) st["earned"] = st["earned"] + pnl;
            p["settled"] = true;
            bool capped = p["cap"].truthy && p["cap"] != double.PositiveInfinity && Math.Abs(pnl) >= p["cap"];
            V result = JsObject.Assign(p, V.Obj("pnl", pnl, "ret", pnl / p["amount"], "marketChange", marketChange, "capped", capped, "luckBonus", luckBonus, "shielded", shielded, "academyBonus", academyBonus, "halved", halved));
            p["result"] = result;
            result.delete("result");
            SN.Events.emit("trade:closed", p["result"]);
            return p["result"];
        }

        public V close()
        {
            V run = S.run, p = run["position"];
            if (!p) return V.@null;
            V r = p["settled"] ? p["result"] : settle();
            run["position"] = V.@null;
            SN.Time.advance(p["market"]);
            SN.Events.emit("turn:settled", r);
            return r;
        }

        // Esperar sin operar (los mercados siguen moviéndose)
        public void skipTurn()
        {
            if (S.run["position"]) return;
            SN.Time.advance(V.@null);
            SN.Events.emit("turn:settled", V.@null);
        }
    }
}
