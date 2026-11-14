// UI (parte 3 de js/ui/ui.js): operación en curso, consejos, resaltado del tutorial, tarjetas y sellos, y update().
using System;
using System.Collections.Generic;
using System.Text;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class UI
    {
        // ---------- Operación en curso ----------
        public void onTradeOpened(V d)
        {
            V position = d["position"];
            bool isLong = position["direction"].num > 0;
            var btn = Dom.byId(isLong ? "btn-buy" : "btn-sell");
            btn.classList.remove("squash");
            btn.reflow();
            btn.classList.add("squash");
            V bp = posIn(btn);
            SN.FX.ring(bp["x"].num + bp["w"].num / 2, bp["y"].num + bp["h"].num / 2, isLong ? PAL.green : PAL.coral, 50, 0.5);
            SN.FX.burst(bp["x"].num + bp["w"].num / 2, bp["y"].num + bp["h"].num / 2, 14, new[] { PAL.cyan, PAL.creamL, isLong ? PAL.green : PAL.coral }, 80);
            SN.Audio.sfx(isLong ? "buy" : "sell");
            SN.Hands.drumming = true;
            SN.Desk.led = "busy";
            SN.Desk.glowTo(PAL.cyan, 0.9);
            Dom.byId("trade-form").classList.add("hidden");
            Dom.byId("trade-live").classList.remove("hidden");
            var dir = Dom.byId("live-dir");
            dir.textContent = isLong ? "▲ Subirá" : "▼ Bajará";
            dir.className = "dir " + (isLong ? "long" : "short");
            Dom.byId("live-bet").textContent = Util.@short(position["amount"]) + " ×" + position["leverage"].str;
            var steps = Dom.byId("live-steps");
            steps.innerHTML = "";
            double total = position["total"].num;
            double dangerFrom = total - SN.Data["sim"]["dangerCandles"].num;
            for (int i = 0; i < total; i++) steps.appendChild(Dom.el("i", i >= dangerFrom ? "danger" : ""));
            steps.title = "Las rayadas son las últimas velas: ahí puede haber giros";
            var close = Dom.byId("btn-close");
            close.className = "btn btn-yellow arming";
            close.disabled = true;
            // Medio segundo de margen: un doble clic en SUBE/BAJA no cobra sin querer al precio de entrada
            SN.after(0.5, () =>
            {
                if (SN.State.run.truthy && SN.State.run["position"] == position && !position["settled"].truthy)
                {
                    close.disabled = false;
                    close.classList.remove("arming");
                }
            });
            Dom.byId("close-lbl").textContent = "Cobrar";
            setLiveNote("");
            Dom.byId("btn-fast").classList.remove("hidden");
            live = new LiveState();
            renderLive(0);
            renderHUD();
            renderMarkets();
            renderNav();
        }

        // Marcador grande y botón COBRAR / SALIR con el resultado si cerraras ahora
        public void renderLive(double pnl)
        {
            var lv = live;
            if (lv == null || (lv.shown != null && Math.Abs(pnl - lv.shown.Value) < 0.005)) return;
            lv.shown = pnl;
            // La habitación se tiñe del color de la operación (verde si ganas, rojo si pierdes)
            V pos0 = SN.State.run["position"];
            double amount = pos0.truthy ? pos0["amount"].num : 1;
            SN.Desk.glowTo(pnl >= 0 ? PAL.green : PAL.coral, JsMath.min(1.4, 0.7 + Math.Abs(pnl) / JsMath.max(1, amount)));
            var pe = Dom.byId("live-pnl");
            pe.textContent = Util.money(pnl, true);
            pe.className = "pnl " + (pnl >= 0 ? "up" : "down");
            // TOPE del mercado: la operación no puede dar (ni quitar) más
            V p = SN.State.run["position"];
            bool capped = p.truthy && p["cap"].truthy && Math.Abs(pnl) >= p["cap"].num - 0.5;
            pe.classList.toggle("capped", capped);
            if (capped && !lv.capWarned)
            {
                lv.capWarned = true;
                V cp = posIn(Dom.byId("live-pnl"));
                SN.FX.floatText(pnl > 0 ? "¡TOPE DEL MERCADO!" : "TOPE: NO PIERDES MÁS", cp["x"].num + cp["w"].num / 2, cp["y"].num - 6, "gold small");
                SN.Audio.sfx("tick");
            }
            var close = Dom.byId("btn-close");
            if (close.classList.contains("done")) return;
            Dom.byId("close-lbl").textContent = pnl >= 0 ? "Cobrar" : "Salir";
            close.classList.toggle("losing", pnl < 0);
            close.classList.toggle("capped", capped && pnl > 0);
        }

        public void setLiveNote(string text, string cls = "")
        {
            var n = Dom.byId("live-note");
            n.textContent = text;
            n.className = cls;
        }

        public void onCandle(double i, V candle)
        {
            V pos = SN.State.run["position"];
            if (!pos.truthy) return;
            SN.Market.flush(candle);
            bool settled = pos["settled"].truthy;
            double pnl = settled ? pos["result"]["pnl"].num : SN.Trading.pnlAt(i == pos["candles"].num && pos["liquidated"].truthy ? pos["exit"].num : candle["c"].num);
            bool danger = i >= pos["total"].num - SN.Data["sim"]["dangerCandles"].num && i < pos["candles"].num;
            // La música sigue la operación: ganando, perdiendo y las últimas velas (js/systems/music.js)
            if (SN.Music != null) SN.Music.trade(V.Obj("pnl", pnl, "amount", pos["amount"], "settled", settled, "danger", danger));
            // Cada vela suena más aguda cuanto mejor te va
            V step = settled ? V.@null : (V)JsMath.round(pnl / JsMath.max(1, pos["amount"].num) * 25);
            SN.Audio.sfx("candle", V.Obj("up", candle["c"].num >= candle["o"].num, "step", step, "quiet", settled));
            var kids = Dom.byId("live-steps").childList();
            int si = (int)i - 1;
            DomElement stepEl = si >= 0 && si < kids.Count ? kids[si] : null;
            if (stepEl != null) stepEl.classList.add("done");
            if (settled)
            {
                if (stepEl != null) stepEl.classList.add("ghost");
                renderHead();
                return;
            }
            renderLive(pnl);
            // Zona de peligro: las últimas velas
            Dom.byId("chart-wrap").classList.toggle("danger", danger);
            Dom.byId("btn-close").classList.toggle("hot", danger && pnl > 0);
            if (danger && !live.warned)
            {
                live.warned = true;
                setLiveNote("¡Últimas velas!", "warn");
                SN.Audio.sfx("tick");
                tip("danger", "Últimas velas: aquí puede pasar de todo. ¿Cobras o aguantas?");
            }
            // Lo que acaba de ganar o perder esta vela, saltando junto a ella
            double delta = pnl - live.lastPnl;
            if (Math.Abs(delta) >= pos["amount"].num * 0.04)
            {
                V p = SN.Chart.lastCandlePos();
                SN.FX.floatText(Util.money(delta, true), p["x"].num, p["y"].num - 10, (delta >= 0 ? "gain" : "loss") + " small");
                if (delta > 0) SN.FX.sparkle(p["x"].num, p["y"].num - 4);
            }
            live.lastPnl = pnl;
            renderHead();
        }

        // Cobrado: el dinero entra ya; las velas que faltan se ven en gris (lo que habría pasado)
        public void onCashOut(V r)
        {
            var close = Dom.byId("btn-close");
            close.classList.remove("hot", "losing");
            close.classList.add("done");
            close.disabled = true;
            Dom.byId("close-lbl").textContent = r["pnl"].num >= 0 ? "¡Cobrado!" : "Fuera";
            var pe = Dom.byId("live-pnl");
            pe.textContent = Util.money(r["pnl"], true);
            pe.className = "pnl " + (r["pnl"].num >= 0 ? "up" : "down");
            Dom.byId("chart-wrap").classList.remove("danger");
            setLiveNote("...y el mercado sigue sin ti");
            if (SN.Music != null) SN.Music.trade(V.Obj("pnl", r["pnl"], "amount", r["amount"], "settled", true));
            SN.Audio.sfx("cash");
            SN.Hands.drumming = false;
        }

        public void onTradeClosed(V r)
        {
            V capBox = posIn(Dom.byId("hud-capital"));
            double cx = capBox["x"].num + 60, cy = capBox["y"].num + 14;
            bool big = r["ret"].num >= 0.5 || r["pnl"].num >= JsMath.max(100, SN.State.run["capital"].num * 0.4);
            if (SN.Music != null) SN.Music.tradeEnd(r["pnl"]);
            SN.Desk.flashGlow(r["pnl"].num >= 0 ? PAL.green : PAL.coral, big ? 1.4 : 0.9);
            if (r["pnl"].num >= 0)
            {
                SN.FX.win(r["pnl"].num, cx, cy, big);
                V cp = SN.Chart.lastCandlePos();
                SN.FX.burst(cp["x"].num, cp["y"].num, 14, new[] { PAL.green, PAL.yellow }, 70);
                SN.FX.floatText(Util.money(r["pnl"], true), cx + 10, cy + 10, "gain");
                SN.Audio.sfx("win", V.Obj("big", big));
                SN.Hands.celebrate(big);
                if (big) SN.Desk.windowEvent("fuegos");
            }
            else
            {
                SN.FX.loss(r["pnl"].num, cx, cy, big || r["liquidated"].truthy);
                SN.FX.floatText(Util.money(r["pnl"]), cx + 10, cy + 6, "loss");
                SN.Audio.sfx(r["liquidated"].truthy ? "liquidation" : "loss", V.Obj("big", big));
                SN.Hands.flinch(big || r["liquidated"].truthy);
                if (r["liquidated"].truthy) stamp("¡LIQUIDADO!", "coral", "El mercado fue " + Js.String(JsMath.round(100 / r["leverage"].num)) + "% en tu contra", 1.3);
            }
            SN.Hands.drumming = false;
            SN.Desk.led = "idle";
        }

        // Al terminar las velas: si cobraste antes, qué te ahorraste o qué te perdiste
        public void onTradeDone(V r)
        {
            Dom.byId("chart-wrap").classList.remove("danger");
            // El botón deja de ser COBRAR y pasa a SEGUIR: clic o ESPACIO y vuelves a operar
            var close = Dom.byId("btn-close");
            close.className = "btn btn-green next";
            close.disabled = false;
            Dom.byId("close-lbl").textContent = "Seguir ▶";
            if (!r.truthy || !r["cashed"].truthy) return;
            double diff = r["stayPnl"].num - r["pnl"].num;
            if (diff < -0.5) setLiveNote("¡Te ahorraste " + Util.money(-diff) + "!", "good");
            else if (diff > 0.5) setLiveNote("Te perdiste " + Util.money(diff) + " más", "bad");
            else setLiveNote("Justo a tiempo");
        }

        public void endTrade()
        {
            SN.Desk.glowTo(PAL.cyan, 0.5);
            Dom.byId("trade-form").classList.remove("hidden");
            Dom.byId("trade-live").classList.add("hidden");
            Dom.byId("btn-fast").classList.add("hidden");
            Dom.byId("chart-wrap").classList.remove("danger");
            live = null;
            if (SN.Music != null) SN.Music.trade(V.@null);
            renderAll();
        }

        // ---------- Consejos ----------
        // Consejos de una sola vez, justo cuando hacen falta (nunca durante el tutorial)
        public void tip(string id, string text)
        {
            V prof = SN.State.profile;
            if (!prof["tips"].truthy) prof["tips"] = V.Obj();
            // (con el escritorio abierto o durante un final no: se verían encima de otra cosa; ya saldrá luego)
            if (prof["tips"][id].truthy || SN.Tutorial.active || SN.Desktop.open || (SN.Finale != null && SN.Finale.active())) return;
            prof["tips"][id] = true;
            SN.Save.saveProfile();
            var el = Dom.el("div", "tip", text);
            V a = posIn(Dom.byId("chart-wrap"));
            el.style.left = Js.String(a["x"].num + 6) + "px";
            el.style.top = Js.String(a["y"].num + 6) + "px";
            Dom.byId("layer-float").appendChild(el);
            SN.after(4.5, () => { el.classList.add("out"); SN.after(0.3, () => el.remove()); });
        }

        public void afterTurnTips()
        {
            V run = SN.State.run;
            if (!run.truthy || run["position"].truthy) return;
            V h = SN.Market.hint(run["selected"]);
            if (h["power"].num == 0) tip("flat", "Sin pista clara (?). Puedes esperar: el mercado sigue solo.");
            else if (run["markets"][run["selected"]]["events"].length.num > 0) tip("news", "Las noticias mueven el precio: ▲ sube, ▼ baja, ? rumor.");
        }

        // ---------- Tutorial: resaltado ----------
        public V spot(string selector)
        {
            clearSpot();
            if (string.IsNullOrEmpty(selector)) return V.undefined;
            DomElement target = Dom.querySelector(selector);
            if (target == null) return V.undefined;
            V p = posIn(target);
            var layer = Dom.byId("layer-dialog");
            var s = Dom.el("div", "spot");
            s.style.left = Js.String(p["x"].num - 2) + "px";
            s.style.top = Js.String(p["y"].num - 2) + "px";
            s.style.width = Js.String(p["w"].num + 4) + "px";
            s.style.height = Js.String(p["h"].num + 4) + "px";
            DomNode first = layer.firstChild;
            layer.insertBefore(s, first);
            var a = Dom.el("div", "spot-arrow", p["y"].num > 40 ? "▼" : "▲");
            a.style.left = Js.String(JsMath.round(p["x"].num + p["w"].num / 2 - 6)) + "px";
            a.style.top = Js.String(p["y"].num > 40 ? p["y"].num - 18 : p["y"].num + p["h"].num + 3) + "px";
            // (la flecha va justo detrás del resaltado: lo que estaba después de él antes de insertarlo)
            layer.insertBefore(a, first);
            spotEl = s;
            arrowEl = a;
            spotSel = selector;
            return p;
        }

        public void clearSpot()
        {
            if (spotEl != null) spotEl.remove();
            if (arrowEl != null) arrowEl.remove();
            spotEl = null;
            arrowEl = null;
            spotSel = null;
        }

        // ---------- Tarjetas y sellos ----------
        public Promise card(string html, string cls, double time = 1.4)
        {
            return new Promise((resolve) =>
            {
                var el = Dom.el("div", cls, html);
                SN.KW.apply(el);
                Dom.byId("layer-top").appendChild(el);
                bool done = false;
                Action finish = null;
                finish = () =>
                {
                    if (done) return;
                    done = true;
                    el.classList.add("out");
                    SN.after(0.3, () => { el.remove(); resolve(); });
                };
                el.addEventListener("click", finish);
                SN.after(time, finish);
            });
        }

        // Resultado de la apuesta, sin prisa: se queda sobre la gráfica hasta 2.6 s (clic o tecla para seguir antes)
        public Promise resultCard(V r, Promise skipP)
        {
            bool win = r["pnl"].num > 0, even = r["pnl"].num == 0;
            string label = r["liquidated"].truthy ? "Liquidado" : even ? "Te quedas igual" : win ? "Ganaste" : "Perdiste";
            string extra = (r["capped"].truthy ? "<span class=\"rc-cap\">Tope del mercado</span>" : "") +
                (r["luckBonus"].truthy ? "<span class=\"rc-luck\">★ Suerte: +" + Util.money(r["luckBonus"]) + "</span>" : "") +
                (r["shielded"].truthy ? "<span class=\"rc-luck\">Seguro de la ruleta: no pierdes nada</span>" : "") +
                (r["academyBonus"].truthy ? "<span class=\"rc-luck\">Tiburón: +" + Util.money(r["academyBonus"]) + "</span>" : "") +
                (r["halved"].truthy ? "<span class=\"rc-luck\">Plan B: te ahorras " + Util.money(r["halved"]) + "</span>" : "");
            string html = "<span class=\"rc-l\">" + label + "</span><b class=\"rc-v\">" + Util.money(r["pnl"], win) + "</b>" + extra + "<span class=\"rc-t\">Ahora tienes " + Util.money(SN.State.run["capital"]) + "</span><kbd>clic</kbd>";
            V p = posIn(Dom.byId("chart-wrap"));
            return new Promise((resolve) =>
            {
                var el = Dom.el("button", "result-card " + (win ? "rc-win" : even ? "rc-even" : "rc-lose"), html);
                el.style.left = Js.String(p["x"].num + p["w"].num / 2) + "px";
                el.style.top = Js.String(p["y"].num + p["h"].num / 2) + "px";
                Dom.byId("layer-top").appendChild(el);
                bool done = false;
                Action<DomEvent> onKeyPress = null;
                Action finish = null;
                finish = () =>
                {
                    if (done) return;
                    done = true;
                    Dom.document.removeEventListener("keydown", onKeyPress);
                    el.classList.add("out");
                    SN.after(0.25, () => { el.remove(); resolve(); });
                };
                onKeyPress = (e) => { if (!e.repeat) finish(); };
                el.addEventListener("click", finish);
                if (skipP != null) skipP.then(finish);
                // TODO(infra): la web escucha esta tecla en fase de captura (addEventListener(..., true)); aquí es fase normal
                SN.after(0.5, () => { if (!done) Dom.document.addEventListener("keydown", onKeyPress); });
                SN.after(2.6, finish);
            });
        }

        // Día de la suerte: tarjeta dorada con sus sietes y lo que trae
        public Promise luckyCard(V l)
        {
            SN.Audio.sfx("lucky");
            V capBox = posIn(Dom.byId("hud-capital"));
            int k = (int)l["k"].num;
            SN.FX.coins(capBox["x"].num + 60, capBox["y"].num + 14, 7 * k, 1.6);
            // Las estrellas van en su propia fila, encima: a los lados del título no caben (32 px ocupa casi todo el ancho)
            var stars = new StringBuilder();
            int starCount = (int)(l["k"].num * 2 + 1);
            for (int i = 0; i < starCount; i++) stars.Append("<i style=\"animation-delay:" + Js.String((i % 2) * 0.4) + "s\">★</i>");
            V events = l["events"];
            var names = new List<string>();
            for (int j = 0; j < events.length.i; j++) names.Add(SN.Data["luck"]["specials"][events[j]]["name"].str);
            string evs = string.Join(" · ", names);
            return card("<div class=\"lk-stars\">" + stars + "</div><div class=\"d1\">¡DÍA DE LA SUERTE!</div><div class=\"d2\">" + evs + "</div><div class=\"d3\">Los mercados crecen · +" + Js.String((double)(7 * k)) + "% en cada ganancia</div>", "daycard lucky", 3.2);
        }

        public Promise dayCard(double day, string sub, bool warn)
        {
            return card("<div class=\"d1\">DÍA " + Js.String(day) + "</div><div class=\"d2" + (warn ? " warn" : "") + "\">" + sub + "</div>", "daycard", 1.3);
        }

        public Promise stamp(string text, string cls = "", string sub = "", double time = 1.6)
        {
            return card(text + (!string.IsNullOrEmpty(sub) ? "<small>" + sub + "</small>" : ""), "stamp " + cls, time);
        }

        // ---------- Frame ----------
        public void update(double dt)
        {
            SN.HeroSay.update(dt);
            var c = cap;
            if (c.t < 1)
            {
                c.t = JsMath.min(1, c.t + dt / 0.7);
                setCapitalText(Util.lerp(c.from, c.to, Util.ease.outCubic(c.t)));
                if (c.t >= 1) setCapitalText(c.to);
            }
            // Marcador en vivo: sigue al precio que se ve, también dentro de una vela
            V pos = SN.State.run.truthy ? SN.State.run["position"] : V.@null;
            if (pos.truthy && !pos["settled"].truthy && live != null && SN.Chart.anim.truthy) renderLive(SN.Trading.pnlAt(SN.Chart.livePrice));
            // El resaltado sigue al elemento (por si se mueve)
            if (spotSel != null && spotEl != null)
            {
                var t = Dom.querySelector(spotSel);
                if (t != null)
                {
                    V p = posIn(t);
                    spotEl.style.left = Js.String(p["x"].num - 2) + "px";
                    spotEl.style.top = Js.String(p["y"].num - 2) + "px";
                }
            }
        }

        // ---------- Auxiliares de la interfaz ----------
        // Nivel de "rareza" de las fotos de noticias extrañas
        public double darkLevel()
        {
            V run = SN.State.run;
            double d = run.truthy && run["darkness"].truthy ? run["darkness"].num : 1;
            return JsMath.max(1, JsMath.min(8, d));
        }

        // Flechas de impacto de un evento: ▲▲ sube, ▼▼ baja, ? rumor, ≈ volatilidad
        public string eventArrows(V e)
        {
            if (e["kind"] == "vol") return "≈";
            if (e["kind"] == "rumor") return "?" + (e["prob"].num * e["yes"].num + (1 - e["prob"].num) * e["no"].num >= 0 ? "▲" : "▼");
            double v = e["kind"] == "shock" ? (e["min"].num + e["max"].num) / 2 : e["trend"].num;
            int n = e["kind"] == "shock" && Math.Abs(v) >= 0.08 ? 3 : 2;
            return JsString.repeat(v >= 0 ? "▲" : "▼", n);
        }

        // Gráfica de 28x10 de la última tendencia del mercado (la de la tarjeta de mercado)
        private DomElement sparkline(JsArray hist)
        {
            var cv = Px.canvas(28, 10);
            var c = canvasEl(cv);
            var g = Px.ctx(cv);
            c.className = "spark";
            if (hist.length < 2) return c;
            double[] closes = new double[hist.length];
            for (int i = 0; i < closes.Length; i++) closes[i] = hist[i]["c"].num;
            double lo = JsMath.min(closes), hi = JsMath.max(closes);
            bool up = closes[closes.Length - 1] >= closes[0];
            double range = hi - lo;
            if (range == 0 || double.IsNaN(range)) range = 1;
            int[] prev = null;
            for (int i = 0; i < closes.Length; i++)
            {
                double v = closes[i];
                int x = (int)JsMath.round(i / (double)(closes.Length - 1) * 27);
                int y = (int)JsMath.round(9 - (v - lo) / range * 9);
                if (prev != null) Px.line(g, prev[0], prev[1], x, y, up ? PAL.greenD : PAL.coralD);
                prev = new[] { x, y };
            }
            return c;
        }

        private static string esc(string t)
        {
            return t.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
        }
    }
}
