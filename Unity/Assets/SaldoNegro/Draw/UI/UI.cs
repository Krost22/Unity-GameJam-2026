// UIManager (port de js/ui/ui.js, SN.UI): actualiza todo lo que se ve dentro del monitor (FUTURO.exe) y recoge la entrada del jugador.
// Todo se puede hacer con el ratón; el teclado es un atajo y cada botón muestra su tecla.
// Escucha eventos del juego (capital, turnos, mercados...) y nunca calcula economía por su cuenta.
// Este archivo: campos, arranque (init), entrada (botones, slider, teclado) y suscripciones a eventos.
// UI.Parte2.cs: render (reloj, HUD, mercados, formulario, navegación) y acciones del jugador.
// UI.Parte3.cs: operación en curso, consejos, tutorial (resaltado), tarjetas y sellos, update().
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class UI
    {
        // this.cap = { shown, from, to, t: 1 } (animación del número del capital)
        public sealed class CapState { public double shown, from, to, t = 1; }
        // this.live = { shown: null, lastPnl: 0, warned: false } (marcador de la operación en curso)
        public sealed class LiveState { public double? shown; public double lastPnl; public bool warned; public bool capWarned; }

        public bool busy;
        public V allow = V.@null;          // durante el tutorial: lista de acciones permitidas (null = todas)
        public CapState cap = new CapState();
        public DomElement spotEl, arrowEl;
        public string spotSel;
        public LiveState live;             // marcador de la operación en curso
        public string daysKey = "";
        public Action onContinue;          // lo pone otro módulo: ESPACIO / ENTER siguen con él
        public int skullHits;
        public V freshLetter = V.@null;
        public V eventsNews = V.@null;
        public string tabSel;

        public void init()
        {
            Dom.byId("screen").querySelector(".app-icon").style.backgroundImage = "url(" + SN.Sprites.url("app", 1) + ")";
            Dom.byId("screen").querySelector(".app-icon").addEventListener("click", () => { if (!busy && SN.Game.state == "GAMEPLAY" && !SN.State.run["position"].truthy) openWindow("about"); });
            renderTitle();
            Dom.querySelector("#hud-capital .coin").style.backgroundImage = "url(" + SN.Sprites.url("coin0", 1) + ")";
            // Iconos de los botones de navegación
            foreach (var pair in new[] { ("ico-up", "wrench"), ("ico-news", "news"), ("ico-shop", "cart") })
            {
                var icon = Dom.querySelector("." + pair.Item1);
                if (icon != null) icon.style.backgroundImage = "url(" + SN.Sprites.url(pair.Item2, 1) + ")";
            }
            SN.Chart.init(Dom.byId("chart"));
            SN.FX.init(Dom.byId("fx"), Dom.byId("layer-float"), Dom.byId("screen"));
            SN.Dialog.init();
            SN.HeroSay.init();
            buildSegments();
            bindInput();
            bindEvents();
            SN.Chart.onPop = (candle) => onPop(candle);
        }

        // Posición de un elemento en píxeles de la pantalla del monitor (para efectos): { x, y, w, h }
        public V posIn(DomElement el)
        {
            double x = 0, y = 0;
            DomElement e = el;
            var scr = Dom.byId("screen");
            while (e != null && e != scr) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
            return V.Obj("x", x, "y", y, "w", el.offsetWidth, "h", el.offsetHeight);
        }

        public bool allowed(string action) { return allow.isNullish || allow.arr.includes(action); }

        // Al cerrarse una vela fuerte: anillo, chispas y un golpecito a la gráfica (proporcional al tamaño)
        public void onPop(V candle)
        {
            V p = SN.Chart.lastCandlePos();
            bool up = candle["c"].num >= candle["o"].num;
            double k = Math.Abs(candle["c"].num - candle["o"].num) / candle["o"].num / SN.Market.def(SN.Chart.market)["volatility"].num; // en desviaciones típicas
            if (k < 1.6 || candle["tw"].truthy) return;
            SN.FX.ring(p["x"].num, p["y"].num, up ? PAL.green : PAL.coral, 12 + k * 5, 0.4);
            SN.FX.burst(p["x"].num, p["y"].num, (int)JsMath.round(3 + k * 2), new[] { up ? PAL.green : PAL.coral, PAL.creamL }, speed: 40 + k * 8, life: 0.45);
            SN.Chart.kick = (up ? -1 : 1) * JsMath.min(3, k - 0.5);
            if (k > 2.4) SN.FX.shake(1.5, 0.15);
        }

        // ---------- Construcción ----------
        private void buildSegments()
        {
            var lv = Dom.byId("leverages");
            V levs = SN.Data["sim"]["leverages"];
            for (int i = 0; i < levs.length.i; i++)
            {
                V l = levs[i];
                var b = Dom.el("button", l["value"].num >= 10 ? "max" : l["value"].num >= 5 ? "hot" : "", "×" + l["value"]);
                b.dataset["l"] = Js.String(l["value"]);
                b.title = "Multiplica el resultado ×" + l["value"] + " · tecla " + (i + 1);
                // Uno que todavía no tienes te lleva a la Tienda, al MULTIPLICADOR
                b.addEventListener("click", () =>
                {
                    if (SN.Trading.leverageAvailable(l["value"])) { setLeverage(l["value"].num); return; }
                    if (!canEditForm("leverage") || !allowed("window")) { SN.Audio.sfx("error"); return; }
                    SN.Audio.sfx("select");
                    openWindow("shop", V.Obj("cat", "mejoras", "sel", V.Obj("kind", "up", "id", "multiplicador")));
                });
                lv.appendChild(b);
            }
            Dom.byId("risk").innerHTML = JsString.repeat("<i></i>", 5);
        }

        private void bindInput()
        {
            Dom.byId("btn-buy").addEventListener("click", () => trade(1));
            Dom.byId("btn-sell").addEventListener("click", () => trade(-1));
            foreach (var b in Dom.querySelectorAll(".quick button"))
                b.addEventListener("click", () => setFraction(dnum(b.dataset["frac"])));
            var slider = Dom.byId("slider");
            bool drag = false;
            void fromSlider(DomEvent e)
            {
                var r = slider.getBoundingClientRect();
                setFraction(Util.clamp((e.clientX - r.left) / r.width, 0, 1), true);
            }
            slider.addEventListener("pointerdown", (e) =>
            {
                if (!canEditForm("amount")) return;
                drag = true;
                // TODO(infra): slider.setPointerCapture(e.pointerId) (DomElement no tiene captura de puntero)
                fromSlider(e);
            });
            slider.addEventListener("pointermove", (e) => { if (drag) fromSlider(e); });
            slider.addEventListener("pointerup", () => { drag = false; });
            Dom.byId("nav-news").addEventListener("click", () => openWindow("news"));
            Dom.byId("nav-shop").addEventListener("click", () => openWindow("shop"));
            Dom.byId("btn-item").addEventListener("click", () =>
            {
                V it = SN.Unlocks.pendingItem();
                if (it.truthy && !busy && !SN.State.run["position"].truthy) SN.Windows.offer(it["id"], "hud");
            });
            Dom.byId("events").addEventListener("click", () => openWindow("news", V.Obj("focus", eventsNews.truthy ? eventsNews : V.@null)));
            Dom.byId("btn-skip-turn").addEventListener("click", () => skip());
            Dom.byId("btn-pay").addEventListener("click", () => { if (!busy && allowed("pay")) SN.Game.payDebt(); });
            Dom.byId("btn-sound").addEventListener("click", () => toggleSound());
            Dom.byId("btn-settings").addEventListener("click", () => { if (allowed("settings")) openWindow("settings"); });
            Dom.byId("btn-fast").addEventListener("click", (e) => { e.stopPropagation(); fast(); });
            Dom.byId("chart-wrap").addEventListener("click", () => fast());
            Dom.byId("btn-close").addEventListener("click", () => cashOut());

            // Las manos del escritorio siguen al cursor y a los clics
            var stage = Dom.byId("stage");
            stage.addEventListener("pointermove", (e) =>
            {
                V p = SN.Game.toStage(e.clientX, e.clientY);
                SN.Hands.pointAt(p["x"].num, p["y"].num);
            });
            // Clic en la habitación (fuera del monitor): hay cosas escondidas (gato, cuervo, póster...)
            stage.addEventListener("click", (e) =>
            {
                if (e.target.closest("#monitor") != null || SN.Cine.running || SN.Bailout.active) return;
                V p = SN.Game.toStage(e.clientX, e.clientY);
                SN.Desk.hotspot(p["x"].num / 2, p["y"].num / 2);
            });
            Dom.byId("monitor").addEventListener("pointerdown", (e) =>
            {
                SN.Audio.unlock();
                SN.Hands.press();
                if (e.target.closest("button, .mcard, #slider, #events") != null) SN.Audio.sfx("click");
            });

            Dom.document.addEventListener("keydown", (e) => onKey(e));
        }

        public void onKey(DomEvent e)
        {
            SN.Audio.unlock();
            if (!e.repeat) { SN.Hands.tapKey(e.code); SN.Audio.sfx("key"); }
            if (SN.Desktop.onKey(e)) return;
            if (SN.Dialog.active && (e.code == "Space" || e.code == "Enter")) { e.preventDefault(); SN.Dialog.advance(); return; }
            if (SN.Cine != null && SN.Cine.onKey(e)) return;
            if (SN.Game.state != "GAMEPLAY" && SN.Game.state != "TUTORIAL") return;
            // (la oferta de FUTURO.exe no se cierra: es el siguiente paso de la historia)
            if (e.code == "Escape")
            {
                if (SN.Windows.current == "offer") return;
                if (SN.Windows.current != null) SN.Windows.close();
                else if (allowed("settings") && !busy) openWindow("settings");
                return;
            }
            if (SN.Windows.current != null || SN.Dialog.active) return;
            if (onContinue != null && (e.code == "Space" || e.code == "Enter")) { e.preventDefault(); onContinue(); return; }
            // Durante una operación: ESPACIO cobra, F acelera
            if (SN.State.run.truthy && SN.State.run["position"].truthy)
            {
                if (e.code == "Space" || e.code == "Enter") { e.preventDefault(); cashOut(); }
                else if (e.code == "KeyF") fast();
                return;
            }
            if (e.code == "Space") { e.preventDefault(); return; }
            void lev(int i) { V l = SN.Data["sim"]["leverages"][i]; if (l.truthy) setLeverage(l["value"].num); }
            var map = new Dictionary<string, Action>
            {
                ["ArrowUp"] = () => trade(1), ["KeyB"] = () => trade(1), ["KeyW"] = () => trade(1),
                ["ArrowDown"] = () => trade(-1), ["KeyV"] = () => trade(-1), ["KeyS"] = () => trade(-1),
                ["ArrowLeft"] = () => stepAmount(-1), ["ArrowRight"] = () => stepAmount(1),
                ["Digit1"] = () => lev(0), ["Digit2"] = () => lev(1), ["Digit3"] = () => lev(2), ["Digit4"] = () => lev(3),
                ["Tab"] = () => cycleMarket(e.shiftKey ? -1 : 1), ["KeyQ"] = () => cycleMarket(-1), ["KeyE"] = () => cycleMarket(1),
                ["KeyX"] = () => toggleTab(),
                ["KeyP"] = () => skip(),
                ["KeyN"] = () => openWindow("news"), ["KeyT"] = () => openWindow("shop"),
            };
            if (map.TryGetValue(e.code, out var fn)) { e.preventDefault(); fn(); }
        }

        private void bindEvents()
        {
            var E = SN.Events;
            E.on("capital:changed", (d) => onCapital(d));
            E.on("turn:advanced", (d) => renderAll());
            E.on("market:event", (d) =>
            {
                V market = d["market"];
                if (market == SN.State.run["selected"]) { renderEvents(true); SN.Audio.sfx("notify"); }
                renderMarkets();
            });
            E.on("market:event-resolved", (n) => { if (n["market"] == SN.State.run["selected"]) renderEvents(true); });
            E.on("market:unlocked", (d) =>
            {
                V market = d["market"];
                // Se enseña la pestaña donde está el mercado nuevo (el primer negro hace aparecer la pestaña Negro)
                tabSel = SN.Market.def(market)["black"].truthy ? "negro" : "legal";
                renderMarkets();
                var card = Dom.querySelector(".mcard[data-id=\"" + market.str + "\"]");
                if (card != null)
                {
                    card.classList.add("unlocking");
                    V p = posIn(card);
                    SN.FX.burst(p["x"].num + p["w"].num / 2, p["y"].num + p["h"].num / 2, 24, new[] { PAL.yellow, PAL.green, PAL.creamL });
                }
            });
            E.on("news:added", (d) => renderNav());
            E.on("news:read", (d) => renderNav());
            E.on("upgrade:bought", (d) => { renderForm(); renderHUD(); renderMarkets(); });
            E.on("debt:paid", (d) => renderAll());
            E.on("trade:opened", (d) => onTradeOpened(d));
            E.on("trade:closed", (r) => onTradeClosed(r));
            E.on("trade:rejected", (r) => note(r["reason"]));
            E.on("window:closed", (d) => renderAll());
            E.on("window:opened", (d) =>
            {
                renderHUD();
                var t = Dom.querySelector(".msg-toast.shop");
                if (t != null) t.remove();
            });
            // Cosas que ya se pueden comprar: número rojo y aviso; la oferta de un objeto clave salta sola
            E.on("shop:seen", (d) => renderNav());
            E.on("shop:new", (d) => onShopNew(d));
            E.on("offer:prompt", (d) => onOfferPrompt(d));
            // Academia: tus negocios pagan cada mañana; lo comprado cambia los números rojos
            E.on("academy:income", (d) =>
            {
                V p = posIn(Dom.byId("hud-capital"));
                SN.FX.floatText("+" + Util.money(d["amount"]) + " negocios", p["x"].num + p["w"].num / 2, p["y"].num + p["h"].num + 6, "gain small");
                SN.Audio.sfx("coin");
            });
            E.on("academy:bought", (d) => { renderNav(); renderHUD(); });
            E.on("academy:open", (d) => renderNav());
            E.on("cipher:found", (d) => onCipher(d));
            E.on("turn:ready", (d) => afterTurnTips());
        }

        private static double dnum(string s) { return s == null ? double.NaN : JsNumber.fromString(s); }
    }
}
