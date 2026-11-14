// Port de js/systems/market-sim.js (SN.Market). MarketSimulator: genera las velas de cada mercado. El precio
// sigue fases de tendencia (alcistas, bajistas o planas) con su ruido, sus eventos y una leve atracción a un
// precio de referencia. Todo lo que se ve en la gráfica sale de aquí: el resultado de una operación depende de
// estas velas. La PISTA de la gráfica se calcula con este mismo estado real: predice de verdad, aunque nunca
// al 100%.
using System;

namespace SaldoNegro.Logic
{
    public sealed class Market
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        static double newRegime(RNG rng, V def)
        {
            if (rng.next() < def["flatChance"]) return rng.range(-0.15, 0.15);
            return (rng.next() < 0.5 ? -1 : 1) * rng.range(0.5, 1);
        }
        static double phaseLength(RNG rng, V def) { return rng.@int(def["phase"][0], def["phase"][1]); }

        public V create(V def, RNG rng)
        {
            V m = V.Obj(
                "id", def["id"],
                "price", def["startPrice"],
                "anchor", def["startPrice"],
                "regime", newRegime(rng, def),
                "nextRegime", newRegime(rng, def),
                "phaseLeft", phaseLength(rng, def),
                "hintNoise", rng.normal(),
                "history", new JsArray(),
                "events", new JsArray(),
                "unlocked", def["unlock"]["type"] == "start"
            );
            // Historial inicial para que la gráfica muestre el comportamiento anterior
            for (int i = 0; i < D["sim"]["initialHistory"]; i++) stepState(m, def, rng, V.Obj("quiet", true));
            return m;
        }

        public V state(V id) { return S.run["markets"][id]; }
        public V def(V id) { return D.marketById(id); }

        // Suma de los efectos activos de los eventos (tendencia y volatilidad)
        public V effects(V m)
        {
            double trend = 0, vol = 1;
            foreach (var e in m["events"])
            {
                if (e["kind"] == "trend") trend += e["trend"];
                if (e["kind"] == "vol") vol *= e["vol"];
            }
            return V.Obj("trend", trend, "vol", vol);
        }

        // Genera una vela. ctx: { direction, luck, tutorial, quiet, jump }
        public V stepState(V m, V def, RNG rng, V ctx = null)
        {
            if (ctx is null || ctx.isUndefined) ctx = new JsObject();
            V sim = D["sim"];
            if (ctx["tutorial"]) m["regime"] = sim["tutorial"]["regime"];
            else
            {
                m["phaseLeft"] = m["phaseLeft"] - 1;
                if (m["phaseLeft"] <= 0)
                {
                    m["regime"] = m["nextRegime"];
                    m["nextRegime"] = newRegime(rng, def);
                    m["phaseLeft"] = phaseLength(rng, def);
                }
            }

            V eff = ctx["quiet"] ? V.Obj("trend", 0, "vol", 1) : effects(m);
            double sigma = def["volatility"] * eff["vol"] * (ctx["tutorial"] ? sim["tutorial"]["volMul"].num : 1);
            // Días de la suerte: todos los mercados abiertos tiran hacia arriba (js/systems/luck.js)
            double lucky = ctx["quiet"] || ctx["tutorial"] || SN.Luck == null ? 0 : SN.Luck.trend(m["id"]);
            double mu = (m["regime"] + eff["trend"] + lucky) * def["drift"] - def["reversion"] * JsMath.log(m["price"] / m["anchor"]);
            // La suerte inclina ligeramente el ruido a favor de tu operación (no garantiza nada)
            if (ctx["direction"] && ctx["luck"]) mu += ctx["direction"] * ctx["luck"] * sim["luckBiasPerLevel"] * sigma;
            double ret = mu + sigma * rng.normal();
            // Tutorial: hasta el susto, ninguna vela baja (al pulsar COBRAR siempre vas ganando de verdad);
            // después del susto, ninguna sube
            if (ctx["tutorial"]) ret = ctx["after"] ? JsMath.min(ret, -0.1 * sigma) : JsMath.max(ret, 0.3 * sigma);

            var marks = new JsArray();
            var resolved = new JsArray();
            if (ctx["jump"]) { ret += ctx["jump"]; marks.push(ctx["jump"] >= 0 ? "pos" : "neg"); }
            if (!ctx["quiet"])
            {
                foreach (var e in m["events"].arr.slice())
                {
                    if (e["kind"] == "shock")
                    {
                        e["delay"] = e["delay"] - 1;
                        if (e["delay"] <= 0)
                        {
                            ret += e["jump"];
                            marks.push(e["jump"] >= 0 ? "pos" : "neg");
                            resolved.push(V.Obj("e", e, "text", e["title"] + ": " + Util.pct(e["jump"]), "tone", e["jump"] >= 0 ? "pos" : "neg"));
                            remove(m, e);
                        }
                    }
                    else if (e["kind"] == "rumor")
                    {
                        e["resolveIn"] = e["resolveIn"] - 1;
                        if (e["resolveIn"] <= 0)
                        {
                            double p = e["prob"];
                            // Con suerte, el rumor tiende a salir a favor de tu operación
                            if (ctx["direction"] && ctx["luck"])
                            {
                                bool yesHelps = JsMath.sign(e["yes"]) == ctx["direction"].num;
                                p += (yesHelps ? 1 : -1) * ctx["luck"] * sim["luckRumorPerLevel"];
                            }
                            bool yes = rng.next() < p;
                            double jump = yes ? e["yes"] : e["no"];
                            ret += jump;
                            marks.push(jump >= 0 ? "pos" : "neg");
                            resolved.push(V.Obj("e", e, "text", (yes ? e["yesText"] : e["noText"]) + ": " + Util.pct(jump), "tone", jump >= 0 ? "pos" : "neg"));
                            remove(m, e);
                        }
                    }
                    else
                    {
                        e["left"] = e["left"] - 1;
                        if (e["left"] <= 0) { resolved.push(V.Obj("e", e, "text", e["title"] + ": TERMINA", "tone", "neu", "silent", true)); remove(m, e); }
                    }
                }
            }

            double o = m["price"];
            double c = JsMath.max(0.01, o * JsMath.exp(ret));
            double h = JsMath.max(o, c) * (1 + Math.Abs(rng.normal()) * sigma * 0.55);
            double l = JsMath.min(o, c) * (1 - Math.Abs(rng.normal()) * sigma * 0.55);
            // Un giro amaga primero hacia el lado contrario: ese amago queda como mecha de la vela
            if (ctx["jump"] > 0) l = JsMath.min(l, o * (1 - ctx["jump"] * 0.3));
            if (ctx["jump"] < 0) h = JsMath.max(h, o * (1 - ctx["jump"] * 0.3));
            V candle = V.Obj("o", r4(o), "h", r4(h), "l", r4(l), "c", r4(c));
            if (marks.length > 0) candle["m"] = marks[0];
            if (ctx["jump"]) candle["tw"] = 1;
            // Las noticias de esta vela se publican cuando la vela se muestra (flush), no antes
            var notes = resolved.filter((r) => !r["silent"]);
            if (notes.length > 0) candle["ev"] = notes.map((r) => V.Obj("market", m["id"], "text", r["text"], "tone", r["tone"], "title", r["e"]["title"], "art", r["e"]["art"]));
            m["price"] = candle["c"];
            m["anchor"] = m["anchor"] * 1.0004; // inflación suave a largo plazo
            m["history"].arr.push(candle);
            if (m["history"].length > D["sim"]["historyLength"]) m["history"].arr.shift();
            return candle;
        }

        // Publica las noticias pendientes de una vela ya visible
        public void flush(V candle)
        {
            if (!candle["ev"]) return;
            foreach (var n in candle["ev"]) SN.Events.emit("market:event-resolved", n);
            candle.delete("ev");
        }

        public V step(V id, V ctx = null) { return stepState(state(id), def(id), S.rng, ctx); }

        public JsArray advance(V id, int n, V ctx = null)
        {
            var @out = new JsArray();
            for (int i = 0; i < n; i++) @out.push(step(id, ctx));
            return @out;
        }

        // Mercados que no has operado en este turno: también se mueven
        public void advanceIdle(V exceptId)
        {
            foreach (var def in D["markets"])
            {
                if (def["id"] == exceptId) continue;
                V m = state(def["id"]);
                V ctx = m["unlocked"] ? new JsObject() : V.Obj("quiet", true);
                for (int i = 0; i < D["sim"]["idleCandles"]; i++) flush(stepState(m, def, S.rng, ctx));
            }
        }

        // Al empezar cada turno puede aparecer un evento nuevo en cada mercado desbloqueado
        public void spawnEvents(V force = null)
        {
            force = force ?? V.undefined;
            foreach (var def in D["markets"])
            {
                V m = state(def["id"]);
                if (!m["unlocked"] || m["events"].length >= D["sim"]["maxEventsPerMarket"]) continue;
                bool want = force.truthy && force["market"] == def["id"];
                if (!want && S.rng.next() >= def["eventRate"]) continue;
                // Los días de la suerte también pueden salir noticias de la fortuna
                V lucky = SN.Luck != null && SN.Luck.today() ? D["luck"]["events"] : new JsArray();
                V pool = D["marketEvents"][def["id"]].arr.concat(lucky).filter((e) => !m["events"].arr.some((x) => x["id"] == e["id"]));
                V evDef = want && force["id"] ? (pool.arr.find((e) => e["id"] == force["id"]) || S.rng.pick(pool)) : S.rng.pick(pool);
                if (evDef) addEvent(m, evDef);
            }
        }

        public V addEvent(V m, V evDef)
        {
            RNG rng = S.rng;
            V e = JsObject.Assign(evDef, V.Obj("uid", S.nextUid(), "market", m["id"], "day", S.run["day"], "turn", S.run["turn"]));
            if (e["kind"] == "shock")
            {
                e["delay"] = rng.@int(1, 2);
                // El impacto real varía: a veces el mercado ya lo había descontado
                e["jump"] = r4(rng.range(e["min"], e["max"]) * rng.range(0.55, 1.2));
            }
            else if (e["kind"] == "rumor")
            {
                e["resolveIn"] = rng.@int(1, 3);
            }
            else
            {
                e["left"] = e["candles"];
            }
            m["events"].arr.push(e);
            m["newEvents"] = true;
            SN.Events.emit("market:event", V.Obj("market", m["id"], "event", e));
            return e;
        }

        // La lectura de la PISTA cambia una vez por turno, no en cada fotograma
        public void rollHints()
        {
            foreach (var def in D["markets"]) state(def["id"])["hintNoise"] = S.rng.normal();
        }

        // --- La PISTA: qué se espera de las próximas velas ---
        // Suma la tendencia real (incluida la fase siguiente si llega antes de acabar), los eventos conocidos
        // y la vuelta al precio de referencia. move = rendimiento esperado, sd = incertidumbre.
        public V forecast(V id)
        {
            V m = state(id), def = this.def(id);
            double n = def["candles"];
            V eff = effects(m);
            double trend = 0;
            for (int k = 1; k <= n; k++) trend += k < m["phaseLeft"] ? m["regime"] : m["nextRegime"];
            if (SN.Luck != null) trend += SN.Luck.trend(id) * n; // la PISTA también ve la suerte del día
            foreach (var e in m["events"]) if (e["kind"] == "trend") trend += e["trend"] * JsMath.min(e["left"], n);
            double move = trend * def["drift"] - n * def["reversion"] * JsMath.log(m["price"] / m["anchor"]);
            double spread = JsMath.pow(def["volatility"] * eff["vol"], 2) * n;
            foreach (var e in m["events"])
            {
                if (e["kind"] == "shock") move += e["jump"];
                if (e["kind"] == "rumor")
                {
                    move += e["prob"] * e["yes"] + (1 - e["prob"]) * e["no"];
                    spread += e["prob"] * (1 - e["prob"]) * JsMath.pow(e["yes"] - e["no"], 2);
                }
            }
            double sd = JsMath.sqrt(spread);
            return V.Obj("move", move, "sd", sd, "z", move / sd, "n", n);
        }

        // Lo que ve el jugador: la previsión con el error de lectura de su nivel de ANÁLISIS.
        // power 0 = sin pista clara, 1-3 = fuerza de la señal. dir: 1 sube, -1 baja, 0 ni idea.
        public V hint(V id)
        {
            V f = forecast(id);
            V cfg = D["sim"]["hint"];
            double noise = cfg["noise"][SN.Upgrades.level("analisis")] * (state(id)["hintNoise"] || 0);
            double z = f["z"] + noise;
            double a = Math.Abs(z);
            int power = a < cfg["powers"][0] ? 0 : a < cfg["powers"][1] ? 1 : a < cfg["powers"][2] ? 2 : 3;
            return V.Obj("dir", power != 0 ? JsMath.sign(z) : 0, "power", power, "z", z, "move", z * f["sd"], "sd", f["sd"], "n", f["n"]);
        }

        // --- Lecturas para la interfaz ---
        public JsArray sma(V history, int period)
        {
            var @out = new JsArray();
            double sum = 0;
            for (int i = 0; i < history.length; i++)
            {
                sum += history[i]["c"];
                if (i >= period) sum -= history[i - period]["c"];
                @out.push(i >= period - 1 ? (V)(sum / period) : V.@null);
            }
            return @out;
        }

        public V stats(V id)
        {
            V m = state(id), def = this.def(id);
            V eff = effects(m);
            return V.Obj("price", m["price"], "sigma", def["volatility"] * eff["vol"]);
        }

        static void remove(V m, V e) { int i = m["events"].arr.indexOf(e); if (i >= 0) m["events"].arr.splice(i, 1); }
        static double r4(double v) { return JsMath.round(v * 10000) / 10000; }
    }
}
