// UI (parte 2 de js/ui/ui.js): render del reloj, HUD, mercados, formulario y navegación; y las acciones del jugador.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class UI
    {
        // ---------- Render ----------
        // El nombre del programa, en el idioma secreto (se va leyendo según descubres letras)
        public void renderTitle()
        {
            var el = Dom.byId("screen").querySelector(".app-name");
            if (el != null && SN.Cipher != null) el.innerHTML = SN.Cipher.brand(true);
        }

        public void renderAll()
        {
            if (!SN.State.run.truthy) return;
            renderTitle();
            renderClock();
            renderHUD();
            renderMarkets();
            renderHead();
            renderEvents();
            renderForm();
            renderNav();
        }

        public void renderClock()
        {
            V run = SN.State.run;
            string pips = "";
            V turnNames = SN.Data["sim"]["turnNames"];
            for (int i = 0; i < turnNames.length.i; i++)
                pips += "<i class=\"pip " + (i < run["turn"].num ? "on" : i == run["turn"].num ? "now" : "") + "\"></i>";
            // Día de la suerte: estrellas en el reloj y FUTURO.exe se pone dorado
            V luck = SN.Luck.today();
            Dom.byId("clock").innerHTML = (luck.truthy ? "<b class=\"lk\">" + JsString.repeat("★", (int)luck["k"].num) + "</b>" : "") + SN.Time.turnName().str + " " + pips;
            Dom.byId("app").classList.toggle("lucky", luck.truthy);
            Dom.byId("clock").title = "Cada apuesta gasta un turno · 3 turnos = 1 día";
        }

        // La meta de arriba: la deuda activa (amarilla), el objeto clave que toca comprar (cian) o la meta (verde)
        public void renderHUD()
        {
            V run = SN.State.run;
            if (cap.t >= 1) setCapitalText(run["capital"].num);
            V goal = SN.Unlocks.currentGoal();
            var fill = Dom.byId("goal-fill");
            if (goal.truthy)
            {
                Dom.byId("goal-title").textContent = goal["type"] == "debt" ? "Deuda: " + goal["label"].str : goal["type"] == "item" ? "Oferta: " + goal["label"].str : "Meta";
                fill.style.width = JsNumber.toFixed(Util.clamp(run["capital"].num / goal["amount"].num, 0, 1) * 100, 1) + "%";
                fill.classList.toggle("debt", goal["type"] == "debt");
                fill.classList.toggle("item", goal["type"] == "item");
                // A la derecha, solo lo que debes (o la meta): tu dinero ya sale a la izquierda, en grande.
                // La oferta no pide dinero: se enseña lo que dejará a deber.
                double goalAmount = goal["amount"].num;
                string amt = goalAmount >= 100000 ? Util.@short(goalAmount) : Util.money(goalAmount);
                Dom.byId("goal-text").textContent = goal["type"] == "item" ? "Hoy $0 · debes " + Util.@short(goalAmount) : amt;
                if (goal["type"] == "item") fill.style.width = "100%";
            }
            else
            {
                Dom.byId("goal-title").textContent = "Sin límites";
                fill.style.width = "100%";
                fill.classList.remove("debt", "item");
                Dom.byId("goal-text").textContent = "";
            }
            Dom.byId("hud-goal").title = goal.truthy && goal["type"] == "item" ? "Siguiente paso: la oferta de " + goal["item"]["name"].str + " (hoy $0; después debes " + Util.money(goal["amount"]) + ")" : goal.truthy && goal["type"] == "debt" ? "Debes " + Util.money(goal["amount"]) + " por " + goal["label"].str : "";
            // (con una ventana abierta no se enseñan: quedarían por encima de ella)
            bool canPay = SN.Debt.canPay() && !busy && SN.Windows.current == null;
            Dom.byId("btn-pay").classList.toggle("hidden", !canPay);
            Dom.byId("btn-pay").classList.toggle("pulse", canPay);
            // La oferta de FUTURO.exe está esperando: un botón para verla (parpadea si ya te llega la entrada)
            bool showItem = !canPay && goal.truthy && goal["type"] == "item" && !busy && SN.Windows.current == null;
            bool canItem = showItem && SN.Unlocks.canBuyItem(goal["item"]["id"])["ok"].truthy;
            Dom.byId("btn-item").classList.toggle("hidden", !showItem);
            Dom.byId("btn-item").classList.toggle("pulse", canItem);
            renderDays();
        }

        // Calendario del plazo de la deuda activa (del día que empezó al último, como mucho 7 casillas):
        // la de hoy parpadea y la última es roja. Sin deudas: "Libre".
        public void renderDays()
        {
            V run = SN.State.run;
            var box = Dom.byId("hud-days");
            V d = run["debt"];
            bool owing = SN.Debt.active();
            string key = run["day"].str + "|" + (owing ? "true" : "false") + "|" + (d.truthy ? d["id"] : d).str + "|" + (d.truthy ? d["deadlineDay"] : d).str;
            if (key == daysKey) return;
            daysKey = key;
            if (!owing)
            {
                box.innerHTML = SN.Luck.isLucky(run["day"]) ? "<span class=\"free lucky\" title=\"Día de la suerte\">★ Suerte<b>" + run["day"].str + "</b></span>" : "<span class=\"free\">Libre · día<b>" + run["day"].str + "</b></span>";
                return;
            }
            string html = "";
            double runDay = run["day"].num;
            double deadline = d["deadlineDay"].num;
            double start = (d["start"] | 1).num;
            for (double day = JsMath.max(start, deadline - 6); day <= deadline; day++)
            {
                string cls = string.Join(" ", new[]
                {
                    day < runDay ? "past" : "",
                    day == runDay ? "now" : "",
                    day == deadline ? "last" : "",
                    SN.Luck.isLucky(day) ? "lucky" : "",
                });
                html += "<i class=\"" + cls + "\">" + Js.String(day) + "</i>";
            }
            box.innerHTML = html;
            box.classList.toggle("wide", deadline >= 10);
        }

        public void setCapitalText(double v)
        {
            var el = Dom.byId("capital");
            string txt = Util.money(v);
            el.textContent = txt;
            el.classList.remove("small");
            // Si la cifra no cabe en su casilla, se abrevia ($119,902 -> $120K); la exacta, al pasar el ratón
            double room = el.parentElement.clientWidth - 18;
            if (room > 0 && el.scrollWidth > room)
            {
                el.textContent = Util.@short(v);
                if (el.scrollWidth > room) el.classList.add("small");
            }
            el.title = txt;
            cap.shown = v;
        }

        public void onCapital(V d)
        {
            var c = cap;
            c.from = c.shown;
            c.to = d["to"].num;
            c.t = 0;
            var el = Dom.byId("capital");
            el.classList.remove("bump", "shrink");
            el.reflow();
            el.classList.add(d["reason"] != "commit" && d["delta"].num >= 0 ? "bump" : "shrink");
            renderHUD();
            if (!SN.State.run["position"].truthy) renderForm();
        }

        // Pestaña de la barra lateral: 'legal' o 'negro' (la de Negro aparece con el primer mercado negro)
        public string tab()
        {
            if (!SN.Unlocks.anyBlack()) return "legal";
            if (string.IsNullOrEmpty(tabSel)) tabSel = SN.Market.def(SN.State.run["selected"])["black"].truthy ? "negro" : "legal";
            return tabSel;
        }

        public void toggleTab(string to = null)
        {
            if (!SN.Unlocks.anyBlack() || !allowed("market")) { SN.Audio.sfx("error"); return; }
            string t = !string.IsNullOrEmpty(to) ? to : (tab() == "negro" ? "legal" : "negro");
            if (t == tab()) return;
            tabSel = t;
            SN.Audio.sfx("whoosh");
            renderMarkets();
        }

        public void renderMarkets()
        {
            var box = Dom.byId("markets");
            box.innerHTML = "";
            string curTab = tab();
            bool hasBlack = SN.Unlocks.anyBlack();
            Dom.byId("sidebar").classList.toggle("tabbed", hasBlack);
            if (hasBlack)
            {
                var tabs = Dom.el("div", "mtabs");
                foreach (var pair in new[] { ("legal", "Legal"), ("negro", "Negro") })
                {
                    string t = pair.Item1;
                    var b = Dom.el("button", "mtab mtab-" + t + (t == curTab ? " on" : ""), pair.Item2);
                    b.title = t == "negro" ? "Mercado negro (X)" : "Mercados legales (X)";
                    bool alert = SN.Data["markets"].arr.some((d) => d["black"].truthy == (t == "negro") && d["id"] != SN.State.run["selected"] && SN.State.run["markets"][d["id"]]["unlocked"].truthy && SN.State.run["markets"][d["id"]]["newEvents"].truthy);
                    if (alert && t != curTab) b.insertAdjacentHTML("beforeend", "<b class=\"alert\">!</b>");
                    b.addEventListener("click", () => toggleTab(t));
                    tabs.appendChild(b);
                }
                tabs.insertAdjacentHTML("beforeend", "<kbd>X</kbd>");
                box.appendChild(tabs);
            }
            foreach (V def in SN.Data["markets"])
            {
                if (def["black"].truthy != (curTab == "negro")) continue;
                V m = SN.State.run["markets"][def["id"]];
                var card = Dom.el("div", "mcard" + (def["black"].truthy ? " black" : ""));
                card.dataset["id"] = def["id"].str;
                card.title = def["name"].str + ": " + def["desc"].str + " · Tope por apuesta: ±" + Util.money(def["cap"]);
                var ico = SN.Sprites.node(def["icon"].str, 1);
                ico.className = "ico";
                card.appendChild(ico);
                if (!m["unlocked"].truthy)
                {
                    card.classList.add("locked");
                    card.title = def["black"].truthy ? def["unlock"]["label"].str + " en la TIENDA para abrirlo" : "Se abre al llegar a " + def["unlock"]["label"].str;
                    card.insertAdjacentHTML("beforeend", "<span class=\"nm\">" + def["short"].str + "</span><span class=\"hint\">" + (def["black"].truthy ? "Tienda" : def["unlock"]["label"].truthy ? def["unlock"]["label"].str : "") + "</span>");
                    var lockEl = SN.Sprites.node("lock", 1);
                    lockEl.className = "lock";
                    card.appendChild(lockEl);
                }
                else
                {
                    bool live = SN.State.run["position"].truthy && SN.State.run["position"]["market"] == def["id"];
                    string hint = "<span class=\"hint live\">En juego</span>";
                    if (!live)
                    {
                        V h = SN.Market.hint(def["id"]);
                        double dir = h["dir"].num, power = h["power"].num;
                        string dirCls = dir > 0 ? "up" : dir < 0 ? "down" : "flat";
                        string txt = dir != 0 && !double.IsNaN(dir) ? JsString.repeat(dir > 0 ? "▲" : "▼", (int)power) : "?";
                        hint = "<span class=\"hint " + dirCls + "\">" + txt + "</span>";
                    }
                    card.insertAdjacentHTML("beforeend", "<span class=\"nm\">" + def["short"].str + "</span>" + hint);
                    if (!live) card.appendChild(sparkline(m["history"].arr.slice(-20)));
                    if (def["id"] == SN.State.run["selected"]) card.classList.add("sel");
                    // ESTRELLA DE LA SUERTE: hoy este mercado vale más (y la estrella esconde un símbolo)
                    V luck = SN.Luck.today();
                    if (luck.truthy && luck["star"] == def["id"])
                    {
                        var star = Dom.el("b", "star", "★");
                        star.title = "Estrella de la Suerte: hoy sus ganancias valen ×" + SN.Data["luck"]["starMul"].str;
                        star.addEventListener("click", (e) => { e.stopPropagation(); SN.Cipher.discover("estrella"); });
                        card.appendChild(star);
                    }
                    if (m["newEvents"].truthy && def["id"] != SN.State.run["selected"]) card.insertAdjacentHTML("beforeend", "<b class=\"alert\">!</b>");
                    card.addEventListener("click", () => selectMarket(def["id"]));
                }
                box.appendChild(card);
            }
        }

        public void renderHead()
        {
            V def = SN.Market.def(SN.State.run["selected"]);
            var app = Dom.byId("app");
            V colors = def["colors"];
            app.style.setProperty("--mk", colors["main"].str);
            app.style.setProperty("--mk2", colors["alt"] == PAL.coal ? PAL.creamM : colors["alt"].str);
            app.style.setProperty("--mkD", colors["dark"].str);
            app.style.setProperty("--mkInk", colors["ink"].str);
            // En el mercado negro, toda la app se oscurece
            app.classList.toggle("black", def["black"].truthy);
            V price = SN.Chart.anim.truthy && SN.Chart.market == def["id"] ? SN.Chart.livePrice : SN.Market.state(def["id"])["price"];
            var head = Dom.byId("mkt-head");
            head.title = def["name"].str + " · " + def["tag"].str + " · Tope por apuesta: ±" + Util.money(def["cap"]);
            head.innerHTML = "<div class=\"ico-box\"></div><span class=\"nm\">" + def["short"].str + (def["black"].truthy ? "<em class=\"blk\">· NEGRO</em>" : "") + "<em class=\"cap\">±" + Util.@short(def["cap"]) + "</em></span><span class=\"px-price\">" + fmt(price) + "</span>";
            var box = head.querySelector(".ico-box");
            box.appendChild(SN.Sprites.node(def["icon"].str, 1));
            // La calavera del mercado negro: tres golpes y habla
            if (def["black"].truthy)
            {
                box.classList.add("skull");
                box.addEventListener("click", () =>
                {
                    skullHits = skullHits + 1;
                    SN.Audio.sfx("tick");
                    box.classList.remove("knock");
                    box.reflow();
                    box.classList.add("knock");
                    if (skullHits >= 3) { skullHits = 0; SN.Cipher.discover("calavera"); }
                });
            }
        }

        // Una letra del idioma secreto: mucho ruido, y todo lo que hay en pantalla se traduce un poco más
        public Promise onCipher(V d)
        {
            SN.Audio.sfx("cipher");
            SN.FX.glitch(0.6, 1.4);
            SN.FX.flash(PAL.cyan, 0.25, 0.35);
            SN.Desk.led = "alert";
            SN.after(1.2, () => { if (SN.Desk.led == "alert") SN.Desk.led = "idle"; });
            freshLetter = d["letter"];
            SN.after(1.6, () => { freshLetter = V.@null; });
            if (SN.Windows.current != null) SN.Windows.refresh();
            renderTitle();
            SN.Desktop.onCipher(); // (la web le pasa d, pero Desktop.onCipher no recibe nada)
            string html = "<small>Símbolo descifrado · " + d["count"].str + "/" + d["total"].str + "</small><span class=\"cx-pair\"><b class=\"cx\">" + d["glyph"].str + "</b> = <b class=\"cx-k\">" + d["letter"].str + "</b></span><small>" + d["clue"]["where"].str + "</small>";
            return card(html, "stamp cx-stamp", 2.6);
        }

        // Bajo la gráfica: la noticia activa del mercado (o la última que hubo), con su foto
        public void renderEvents(bool animateNew = false)
        {
            var box = Dom.byId("events");
            V run = SN.State.run;
            V id = run["selected"];
            V m = run["markets"][id];
            V evs = m["events"];
            V ev = evs.length.num > 0 ? evs[evs.length.i - 1] : V.undefined;
            V news = run["news"];
            V item = V.@null;
            string kicker = "", arrows = "";
            if (ev.truthy)
            {
                item = V.Obj("title", ev["title"], "tone", ev["tone"], "art", ev["art"]);
                kicker = "¡Última hora!";
                arrows = eventArrows(ev);
            }
            else
            {
                for (int i = news.length.i - 1; i >= 0; i--)
                    if (news[i]["market"] == id) { item = news[i]; break; }
                if (item.truthy)
                {
                    V tn = SN.Data["sim"]["turnNames"][item["turn"]];
                    kicker = "Día " + item["day"].str + " · " + (tn.truthy ? tn.str : "");
                }
            }
            // La noticia que se abrirá en primera plana al hacer clic (la última de este mercado)
            eventsNews = V.@null;
            for (int i = news.length.i - 1; i >= 0; i--)
                if (news[i]["market"] == id && !news[i]["dark"].truthy) { eventsNews = news[i]; break; }
            box.className = item.truthy ? (item["dark"].truthy ? "neg" : item["tone"].str) + (ev.truthy ? "" : " old") + (animateNew ? " new" : "") : "empty";
            box.title = item.truthy ? "Ver todas las noticias (N)" : "";
            box.innerHTML = "";
            if (!item.truthy)
            {
                box.innerHTML = "<div class=\"tk\" style=\"left:6px\"><span class=\"tk-k\">Sin noticias</span><span class=\"tk-t\">La calma antes de la tormenta.</span></div>";
                return;
            }
            string art = item["art"].truthy ? item["art"].str : "ciudad";
            string tone = item["tone"].truthy ? item["tone"].str : "neu";
            double dark = item["dark"].truthy ? darkLevel() : 0;
            box.appendChild(canvasEl(SN.NewsArt.node(art, tone, dark, V.Arr(52, 32))));
            box.insertAdjacentHTML("beforeend", "<div class=\"tk\"><span class=\"tk-k\">" + kicker + "</span><span class=\"tk-a\">" + arrows + "</span><span class=\"tk-t\">" + item["title"].str + "</span></div>");
            SN.KW.apply(box.querySelector(".tk-t"));
        }

        public void renderForm()
        {
            V run = SN.State.run;
            if (!run.truthy || run["position"].truthy) return;
            V f = run["form"];
            double max = SN.Trading.maxAmount();
            if (!f["frac"].isNullish) f["amount"] = Math.Floor(max * f["frac"].num);
            SN.Trading.clampForm();
            var amt = Dom.byId("amount");
            amt.textContent = Util.money(f["amount"]);
            amt.classList.toggle("small", Util.money(f["amount"]).Length > 9);
            double lim = SN.Trading.limit();
            Dom.byId("bet-box").title = "Máximo por apuesta: " + Util.money(lim) + " · mínimo: " + Util.money(SN.Data["sim"]["minInvestment"]) + " · este mercado gana o pierde como mucho " + Util.money(SN.Trading.cap(run["selected"]));
            double k = max > 0 ? Util.clamp(f["amount"].num / max, 0, 1) : 0;
            Dom.byId("slider-fill").style.width = Js.String(k * 100) + "%";
            Dom.byId("slider-knob").style.left = Js.String(k * 100) + "%";
            foreach (var qb in Dom.querySelectorAll(".quick button"))
                qb.classList.toggle("on", !f["frac"].isNullish && Math.Abs(f["frac"].num - dnum(qb.dataset["frac"])) < 0.001);
            foreach (var lb in Dom.querySelectorAll("#leverages button"))
            {
                double lv = dnum(lb.dataset["l"]);
                bool ok = SN.Trading.leverageAvailable(lv);
                lb.classList.toggle("locked", !ok);
                lb.title = ok ? "Multiplica el resultado ×" + Js.String(lv) + " · tecla " + (levIndex(lv) + 1) : "×" + Js.String(lv) + ": cómpralo en la Tienda (Multiplicador)";
                lb.classList.toggle("on", lv == f["leverage"].num);
            }
            // Riesgo de un vistazo: cuánto de tu dinero apuestas, multiplicado
            double r = f["amount"].num / JsMath.max(1, run["capital"].num) * f["leverage"].num;
            int lvl = r <= 0.3 ? 1 : r <= 0.75 ? 2 : r <= 1.5 ? 3 : r <= 3 ? 4 : 5;
            var risk = Dom.byId("risk");
            risk.className = "r" + lvl;
            var pips = risk.childList();
            for (int n = 0; n < pips.Count; n++) pips[n].classList.toggle("on", n < lvl);
            V check = SN.Trading.validate();
            Dom.byId("btn-buy").disabled = !check["ok"].truthy || busy || !allowed("buy");
            Dom.byId("btn-sell").disabled = !check["ok"].truthy || busy || !allowed("sell");
        }

        public void renderNav()
        {
            V run = SN.State.run;
            if (!run.truthy) return;
            double unread = run["news"].length.num - (run["newsSeen"] | 0).num;
            var badge = Dom.byId("news-badge");
            badge.textContent = unread > 9 ? "9+" : Js.String(unread);
            badge.classList.toggle("hidden", unread <= 0);
            // Lo que ya se puede comprar y todavía no has visto: número rojo en la Tienda (todo está en ella)
            int n = SN.ShopWatch.badge("shop");
            var sb = Dom.byId("shop-badge");
            sb.textContent = n > 9 ? "9+" : Js.String((double)n);
            sb.classList.toggle("hidden", n <= 0);
            // La tienda se puede mirar siempre (los objetos clave solo se compran cuando toca)
            var shop = Dom.byId("nav-shop");
            shop.disabled = false;
            shop.title = "Tienda: mejoras, objetos clave, estilo de vida y la Academia";
            Dom.byId("btn-skip-turn").disabled = busy || run["position"].truthy || !allowed("skip");
            Dom.byId("btn-skip-turn").title = "No apostar: pasa el turno y el mercado sigue";
        }

        public void renderSound()
        {
            V st = SN.State.profile["settings"];
            Dom.byId("btn-sound").classList.toggle("off", !st["sfx"].truthy && !st["music"].truthy);
        }

        // Algo nuevo que ya se puede comprar: aviso dentro de FUTURO.exe (clic: abre la ventana)
        public void onShopNew(V d)
        {
            renderNav();
            if (SN.Tutorial.active || SN.Game.state != "GAMEPLAY" || SN.Windows.current != null || (SN.Finale != null && SN.Finale.active())) return;
            // Todo está en la Tienda: primero se avisa de las mejoras y la Academia, luego del resto
            JsArray items = d["items"].arr;
            JsArray up = items.filter((x) => x["kind"] == "upgrade" || x["kind"] == "academy");
            V first = (up.length > 0 ? up : items)[0];
            string what = first["kind"] == "upgrade" ? "Mejora disponible" : first["kind"] == "academy" ? "Academia de Bravo Fines" : first["kind"] == "gold" ? "Mercado Dorado" : "Ya puedes comprar";
            string more = items.length > 1 ? " (y " + (items.length - 1) + " más)" : "";
            var opts = V.Obj(
                "icon", up.length > 0 ? "wrench" : "cart",
                "kbd", "T",
                "onClick", new JsFn((args) => { openWindow(first["kind"] == "academy" ? "upgrades" : "shop"); return V.undefined; }));
            SN.Desktop.toast("", "<b>" + what + ":</b> " + esc(first["label"].str) + more, opts);
            SN.Audio.sfx("select");
        }

        // La oferta de un objeto clave salta sola (si no hay otra ventana o un diálogo delante)
        public void onOfferPrompt(V d)
        {
            if (SN.Tutorial.active || SN.Game.state != "GAMEPLAY" || SN.Dialog.active || SN.Desktop.open) return;
            if (SN.Windows.current != null && SN.Windows.current != "offer") return;
            SN.Windows.offer(d["item"]["id"], d["why"].str);
            renderHUD();
        }

        // ---------- Acciones ----------
        public bool canEditForm(string action = null)
        {
            return SN.State.run.truthy && !SN.State.run["position"].truthy && !busy && allowed(action ?? "form");
        }

        public void note(V text)
        {
            SN.Audio.sfx("error");
            var btns = Dom.byId("trade-buttons");
            btns.classList.remove("shake");
            btns.reflow();
            btns.classList.add("shake");
            V p = posIn(btns);
            SN.FX.floatText(text.str, p["x"].num + p["w"].num / 2, p["y"].num - 10, "loss small");
        }

        public void setFraction(double frac, bool fromSlider = false)
        {
            if (!canEditForm("amount")) return;
            V f = SN.State.run["form"];
            f["frac"] = fromSlider ? JsMath.round(frac * 20) / 20 : frac;
            if (f["frac"].num <= 0) f["frac"] = 0.05;
            if (!fromSlider) SN.Audio.sfx("select");
            renderForm();
            SN.Events.emit("form:changed", f);
        }

        public void stepAmount(int dir)
        {
            if (!canEditForm("amount")) return;
            V f = SN.State.run["form"];
            double max = SN.Trading.maxAmount();
            double cur = !f["frac"].isNullish ? f["frac"].num : (max > 0 ? f["amount"].num / max : 0);
            f["frac"] = Util.clamp(JsMath.round(cur * 20 + dir) / 20, 0.05, 1);
            SN.Audio.sfx("select");
            renderForm();
            SN.Events.emit("form:changed", f);
        }

        public void setLeverage(double v)
        {
            if (!canEditForm("leverage")) { SN.Audio.sfx("error"); return; }
            if (!SN.Trading.leverageAvailable(v)) { note("×" + Js.String(v) + ": CÓMPRALO EN LA TIENDA"); return; }
            SN.State.run["form"]["leverage"] = v;
            SN.Audio.sfx("select");
            renderForm();
        }

        public void selectMarket(V id)
        {
            if (busy || SN.State.run["position"].truthy || !allowed("market")) return;
            if (!SN.Unlocks.isUnlocked(id)) { SN.Audio.sfx("error"); return; }
            if (SN.State.run["selected"] == id) return;
            SN.State.run["selected"] = id;
            tabSel = SN.Market.def(id)["black"].truthy ? "negro" : "legal";
            SN.State.run["markets"][id]["newEvents"] = false;
            SN.Chart.setMarket(id);
            SN.Audio.sfx("whoosh");
            foreach (var sel in new[] { "mkt-head", "chart-wrap" })
            {
                var el = Dom.byId(sel);
                el.classList.remove("switch");
                el.reflow();
                el.classList.add("switch");
            }
            renderAll();
        }

        // TAB: siguiente mercado abierto de la pestaña que se ve (Legal o Negro)
        public void cycleMarket(int dir)
        {
            bool black = tab() == "negro";
            var ids = new JsArray();
            foreach (V d in SN.Data["markets"])
                if (d["black"].truthy == black && SN.Unlocks.isUnlocked(d["id"])) ids.push(d["id"]);
            if (ids.length == 0) return;
            int i = ids.indexOf(SN.State.run["selected"]);
            selectMarket(ids[i < 0 ? 0 : (i + dir + ids.length) % ids.length]);
        }

        public void openWindow(string kind, V opts = null)
        {
            if (busy || !allowed("window")) return;
            if (SN.Finale != null && SN.Finale.active() && kind != "settings") { SN.Audio.sfx("error"); return; }
            SN.Windows.open(kind, opts ?? V.undefined);
        }

        public void toggleSound()
        {
            V st = SN.State.profile["settings"];
            bool on = !(st["sfx"].truthy || st["music"].truthy);
            st["sfx"] = on;
            st["music"] = on;
            SN.Audio.setSfx(on);
            SN.Audio.setMusic(on);
            SN.Save.saveProfile();
            renderSound();
        }

        public void trade(int dir)
        {
            if (busy || SN.Windows.current != null || SN.Dialog.active) return;
            if (!allowed(dir > 0 ? "buy" : "sell")) { SN.Audio.sfx("error"); return; }
            V check = SN.Trading.validate();
            if (!check["ok"].truthy) { note(check["reason"]); return; }
            SN.Game.trade(dir);
        }

        public void skip()
        {
            if (busy || !SN.State.run.truthy || SN.State.run["position"].truthy || !allowed("skip") || SN.Windows.current != null || SN.Dialog.active) return;
            SN.Game.skipTurn();
        }

        public void fast()
        {
            if (SN.Chart.anim.truthy && allowed("fast")) SN.Chart.fast();
        }

        public void cashOut()
        {
            // Velas terminadas: el mismo botón (o ESPACIO) sirve para seguir sin esperar al resultado
            if (onContinue != null) { onContinue(); return; }
            V pos = SN.State.run.truthy ? SN.State.run["position"] : V.@null;
            if (!pos.truthy || pos["settled"].truthy || !SN.Chart.anim.truthy || SN.Chart.anim["revealed"].num >= SN.Chart.anim["total"].num || Dom.byId("btn-close").disabled) return;
            if (!allowed("cashout")) { SN.Audio.sfx("error"); return; }
            SN.Game.cashOut();
        }

        public void setBusy(bool b)
        {
            busy = b;
            renderForm();
            renderNav();
            renderHUD();
        }

        private static string fmt(double p) { return Js.String(JsMath.round(p)); }

        private static int levIndex(double v)
        {
            V levs = SN.Data["sim"]["leverages"];
            for (int j = 0; j < levs.length.i; j++) if (levs[j]["value"].num == v) return j;
            return -1;
        }

        private static DomElement canvasEl(Canvas c)
        {
            var el = Dom.el("canvas");
            el.setCanvas(c);
            return el;
        }
    }
}
