// Cinemáticas de la introducción (escenas 1-4 del documento): la compra innecesaria, la deuda,
// el encapuchado y la apertura de FUTURO.exe. Se escriben como guiones asíncronos con esperas en
// tiempo de juego; SALTAR (o ESC) aborta el guion y deja el juego en su estado final.
// (port de js/render/cinematic.js: SN.Cine. El render y la pantalla del monitor están en Cine.Parte2.cs.)
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Cine
    {
        // El SKIP de la web: check() lo lanza para abortar el guion (lo recoge playIntro)
        sealed class Skip : Exception { }

        public bool running, skipping;
        public V shot = V.@null;
        public double t;
        public Canvas buf;
        public V say_ = V.@null;
        public string screenMode;               // null, 'static', 'hood', 'desktop' u 'open'
        public double screenT, hoodA;
        public DomElement shopCanvas;
        public List<DomElement> notifs = new List<DomElement>();
        public bool canSkip, beat;
        public Promise skipSignal;
        public Action skipNow;
        public Action beatResolve;
        public DomElement cine;
        public Ctx2D g;
        public V cursor = V.@null;

        public void init()
        {
            buf = Px.canvas(160, 90);
            cine = Dom.byId("cine");
            g = cine.getContext();
            Dom.byId("btn-skip").addEventListener("click", (e) => skip());
            // Durante una cinemática, un clic en cualquier parte avanza el subtítulo
            Dom.document.addEventListener("pointerdown", (e) =>
            {
                if ((running && say_.truthy) || beatResolve != null)
                {
                    if (e.target != null && e.target.closest("#btn-skip") != null) return;
                    advance();
                }
            });
        }

        public void skip()
        {
            if (!running || !canSkip) return;
            skipping = true;
            if (skipNow != null) skipNow();
            advance();
        }

        public bool onKey(DomEvent e)
        {
            if (!running && !beat) return false;
            if (e.code == "Escape" && running) { skip(); return true; }
            if (e.code == "Space" || e.code == "Enter") { e.preventDefault(); advance(); return true; }
            return true;
        }

        // ---------- Primitivas del guion ----------
        void check() { if (skipping) throw new Skip(); }
        public async Promise wait(double s)
        {
            check();
            // (si no hay guion en marcha, skipSignal no existe: como race([p, undefined]) en la web, se cumple ya)
            await Promise.race(SN.wait(s), skipSignal != null ? skipSignal : Promise.resolved());
            check();
        }

        // Subtítulo con efecto máquina de escribir. auto = segundos hasta continuar solo
        public Promise say(V name, V text, double auto = 0)
        {
            check();
            var el = Dom.byId("subs");
            el.classList.remove("hidden");
            el.classList.toggle("click", auto == 0);
            return new Promise((resolve) =>
            {
                say_ = V.Obj("name", name, "full", text, "shown", 0, "auto", auto, "t", 0,
                    "resolve", (JsFn)((args) => { resolve(); return V.undefined; }));
                renderSubs();
            }).then(() => check());
        }

        public void renderSubs()
        {
            V s = say_;
            if (!s) return;
            Dom.byId("subs").innerHTML = (s["name"].truthy ? "<b>" + s["name"].str + ":</b> " : "")
                + JsString.slice(s["full"].str, 0, (int)Math.Floor(s["shown"].num));
        }

        public void advance()
        {
            V s = say_;
            if (beatResolve != null) { var r = beatResolve; beatResolve = null; r(); }
            if (!s) return;
            if (s["shown"].num < s["full"].length.num && !skipping)
            {
                s["shown"] = s["full"].length;
                renderSubs();
                return;
            }
            say_ = V.@null;
            Dom.byId("subs").classList.add("hidden");
            s["resolve"].call();
        }

        public void setShot(V sh)
        {
            V nueva = V.@null;
            if (sh.truthy) nueva = JsObject.Assign(V.Obj("t", 0, "zoom", 1, "zoomTo", 1, "zoomTime", 0), sh);
            shot = nueva;
            Dom.byId("cine").classList.toggle("hidden", !shot);
        }

        // ---------- Introducción ----------
        // canSkip: con partida guardada (o la intro ya vista) se puede SALTAR; la primera vez se ve entera
        public async Promise playIntro(bool canSkip = true)
        {
            var G = SN.Game;
            running = true;
            skipping = false;
            this.canSkip = canSkip;
            skipSignal = new Promise((r) => { skipNow = r; });
            G.setState("INTRO");
            Dom.byId("btn-skip").classList.toggle("hidden", !canSkip);
            // La Pleyzeta todavía no es tuya: no está en la habitación hasta que termina la intro
            SN.Desk.hideConsole = true;
            SN.Desk.dirty();
            SN.Audio.setMood("normal");
            SN.Audio.startMusic();
            try
            {
                await sceneShop();
                await sceneDebt();
                await sceneHooded();
            }
            catch (Skip) { }
            catch (Exception e)
            {
                SN.logError("" + e);
            }
            cleanup();
            SN.State.profile["introSeen"] = true;
            SN.Save.saveProfile();
        }

        void cleanup()
        {
            running = false;
            skipping = false;
            say_ = V.@null;
            setShot(V.@null);
            screenMode = null;
            SN.ScreenCanvas.release("cine");
            Dom.byId("subs").classList.add("hidden");
            Dom.byId("btn-skip").classList.add("hidden");
            Dom.byId("webshop").classList.add("hidden");
            Dom.byId("fake-cursor").classList.add("hidden");
            Dom.byId("screen").classList.remove("glitch", "off");
            foreach (var n in notifs) n.remove();
            notifs.Clear();
            SN.FX.clear();
            SN.Desk.phaseOverride = null;
            SN.Desk.hideConsole = false; // comprada (a plazos): ya está en el mueble
            SN.Desk.dirty();
            SN.Game.camTo(V.Obj("x", 320, "y", 180, "zoom", 1), 0.01);
            SN.Audio.setMood("normal");
        }

        // ESCENA 1 — Una compra innecesaria
        async Promise sceneShop()
        {
            var st = SN.Data["story"]["shop"];
            var sub = SN.Data["story"]["introSubs"];
            SN.Desk.phaseOverride = "evening";
            SN.Desk.dirty();
            buildShop();
            var screen = Dom.byId("screen");
            screen.classList.remove("off");
            Dom.byId("os").classList.add("hidden");
            Dom.byId("app").classList.add("hidden");
            Dom.byId("webshop").classList.remove("hidden");
            SN.Game.camTo(V.Obj("x", 320, "y", 180, "zoom", 1), 0.01);
            SN.Game.camTo(V.Obj("x", SN.SCREEN["x"].num + SN.SCREEN["w"].num / 2, "y", 150, "zoom", 1.14), 10);
            moveCursor(330, 200, 0.01);
            await wait(0.6);
            await say("", sub["browsing"], 2.4);
            var lis = Dom.byId("webshop").querySelectorAll("li");
            foreach (var li in lis)
            {
                li.classList.add("show");
                SN.Audio.sfx("pop");
                SN.Hands.tapKey("KeyJ");
                await wait(0.65);
            }
            Dom.byId("webshop").querySelector(".p-bal").classList.remove("hidden");
            SN.Audio.sfx("error");
            await say("", sub["noMoney"], 2.4);
            var btn = Dom.byId("webshop").querySelector(".buy-now");
            btn.classList.remove("hidden");
            btn.classList.add("wiggle");
            SN.Audio.sfx("notify");
            await wait(0.5);
            var bp = SN.UI.posIn(btn);
            await moveCursor(bp["x"].num + bp["w"].num / 2, bp["y"].num + bp["h"].num / 2, 1.1);
            await wait(0.3);
            SN.Hands.press();
            SN.Audio.sfx("click");
            btn.classList.remove("wiggle");
            btn.classList.add("pressed");
            await wait(0.15);
            var thanks = Dom.el("div", "thanks", st["thanks"].str + "<span style=\"font-size:8px;line-height:12px;color:" + PAL.coalL + "\">Pago aplazado: 7 días</span>");
            Dom.byId("webshop").appendChild(thanks);
            SN.FX.confetti(50);
            SN.Audio.sfx("cheer");
            Dom.byId("fake-cursor").classList.add("hidden");
            await say("", sub["click"], 1);
            // Cara de felicidad
            setShot(V.Obj("type", "face", "expr", "star", "opts", V.Obj("fist", true), "confetti", true));
            SN.Audio.sfx("win", V.Obj("big", true));
            await say("Tú", sub["happy"], 2.2);
        }

        // ESCENA 2 — La deuda
        async Promise sceneDebt()
        {
            var story = SN.Data["story"];
            var sub = story["introSubs"];
            setShot(V.Obj("type", "black", "lines", V.Arr(), "lineT", 0));
            SN.Audio.setMood("silent");
            Dom.byId("webshop").classList.add("hidden");
            await wait(0.9);
            SN.Audio.sfx("notify");
            foreach (var l in story["debtLines"])
            {
                shot["lines"].arr.push(V.Obj("text", l["text"], "color", PAL.byName[l["color"].str], "t", 0));
                SN.Audio.sfx(l["color"].str == "green" ? "notify" : "notifyBad");
                await wait(1.1);
            }
            await wait(0.8);
            setShot(V.Obj("type", "face", "expr", "confused", "opts", V.Obj("question", true), "night", true));
            shot["zoomTo"] = 1.45;
            shot["zoomTime"] = 7;
            SN.Audio.setMood("tense");
            double[][] spots = { new double[] { 40, 60 }, new double[] { 430, 80 }, new double[] { 60, 200 }, new double[] { 440, 220 } };
            V notificaciones = story["notifications"];
            for (int i = 0; i < notificaciones.length.i; i++)
            {
                V texto = notificaciones[i];
                int idx = i;
                SN.after(0.5 + i * 0.9, () =>
                {
                    if (!running || !shot || shot["type"] != "face") return;
                    var n = Dom.el("div", "notif", texto.str);
                    n.style.left = spots[idx][0] + "px";
                    n.style.top = spots[idx][1] + "px";
                    Dom.byId("stage").appendChild(n);
                    notifs.Add(n);
                    SN.Audio.sfx("notifyBad");
                });
            }
            await say("Tú", sub["confused"], 2.2);
            shot["expr"] = "worried";
            shot["opts"] = V.Obj();
            await say("Tú", sub["worried"], 3);
            foreach (var n in notifs) n.remove();
            notifs.Clear();
        }

        // ESCENA 3 — El encapuchado
        async Promise sceneHooded()
        {
            var story = SN.Data["story"];
            setShot(V.@null);
            SN.Desk.phaseOverride = "night";
            SN.Desk.dirty();
            var screen = Dom.byId("screen");
            screen.classList.add("off");
            SN.Game.camTo(V.Obj("x", 320, "y", 180, "zoom", 1), 0.01);
            SN.Game.camTo(V.Obj("x", SN.SCREEN["x"].num + SN.SCREEN["w"].num / 2, "y", 140, "zoom", 1.12), 8);
            SN.Audio.setMood("silent");
            await wait(1.4);
            // El monitor se enciende solo
            SN.Audio.sfx("static", V.Obj("dur", 0.9));
            screen.classList.remove("off");
            screen.classList.remove("poweron");
            screen.reflow();
            screen.classList.add("poweron");
            screenMode = "static";
            screenT = 0;
            hoodA = 0;
            SN.ScreenCanvas.take("cine");
            SN.FX.glitch(0.8, 1.5);
            SN.Desk.led = "alert";
            await wait(1.2);
            screenMode = "hood";
            if (SN.Music != null) SN.Music.sting("hood");
            SN.Audio.sfx("whisper");
            await wait(1.4);
            foreach (var line in story["hoodedIntro"]) await say(story["hoodedName"], line);
            screenMode = "desktop";
            screenT = 0;
            SN.Audio.sfx("unlock");
            await wait(1.2);
            await say(story["hoodedName"], story["hoodedApp"]);
            // La imagen se distorsiona y la aplicación se abre
            SN.Audio.sfx("static", V.Obj("dur", 1.2));
            SN.FX.glitch(1.3, 2.2);
            screen.classList.add("glitch");
            screenMode = "open";
            screenT = 0;
            await wait(1.2);
            screen.classList.remove("glitch");
            SN.Desk.led = "idle";
        }

        // Plano corto de la cara (también lo usa la narrativa: alivio al pagar la deuda)
        public async Promise faceBeat(string expr, V text, double dur)
        {
            beat = true;
            setShot(V.Obj("type", "face", "expr", expr, "opts", V.Obj()));
            Dom.byId("subs").classList.remove("hidden");
            Dom.byId("subs").innerHTML = "<b>Tú:</b> " + text.str;
            await new Promise((r) =>
            {
                beatResolve = r;
                SN.after(dur, () =>
                {
                    if (ReferenceEquals(beatResolve, r)) { beatResolve = null; r(); }
                });
            });
            Dom.byId("subs").classList.add("hidden");
            setShot(V.@null);
            beat = false;
        }

        void buildShop()
        {
            var st = SN.Data["story"]["shop"];
            var el = Dom.byId("webshop");
            var bullets = new System.Text.StringBuilder();
            foreach (var b in st["bullets"]) bullets.Append("<li>" + b.str + "</li>");
            el.innerHTML = "<div class=\"shop-bar\"><span class=\"shop-logo\">★</span><span class=\"url\">HTTPS://" + JsString.lower(st["store"].str) + "/OFERTAS/PLEYZETA-6-ULTRA</span><span>" + st["store"].str + "</span></div>\n"
                + "        <div class=\"shop-main\">\n"
                + "          <div class=\"prod-img\"><span class=\"tag\">¡OFERTA!</span></div>\n"
                + "          <div class=\"prod-info\">\n"
                + "            <div class=\"p-title\">" + st["product"].str + "</div>\n"
                + "            <div class=\"p-ed\">" + st["edition"].str + "</div>\n"
                + "            <div class=\"p-inc\">" + st["includes"].str + "</div>\n"
                + "            <ul>" + bullets.ToString() + "</ul>\n"
                + "            <div class=\"p-price\"><b>" + st["price"].str + "</b><s>" + st["oldPrice"].str + "</s></div>\n"
                + "            <div class=\"p-bal hidden\">" + st["balance"].str + " · <i>" + st["insufficient"].str + "</i></div>\n"
                + "            <button class=\"btn btn-yellow buy-now hidden\">" + st["buy"].str + "</button>\n"
                + "          </div>\n"
                + "        </div>";
            shopCanvas = Dom.createElement("canvas");
            shopCanvas.setCanvasSize(130, 120);
            el.querySelector(".prod-img").insertBefore(shopCanvas, el.querySelector(".tag"));
        }

        // Mueve el cursor falso (y el ratón físico con él)
        public Promise moveCursor(double x, double y, double dur)
        {
            var c = Dom.byId("fake-cursor");
            c.classList.remove("hidden");
            c.style.backgroundImage = "url(" + SN.Sprites.url("cursor", 1) + ")";
            V from = cursor.truthy ? cursor : V.Obj("x", x, "y", y);
            double fromX = from["x"].num, fromY = from["y"].num;
            cursor = V.Obj("x", fromX, "y", fromY);
            return new Promise((resolve) =>
            {
                double tt = 0;
                Action step = null;
                step = () =>
                {
                    tt = JsMath.min(1, tt + 1.0 / 60 / dur);
                    double k = Util.ease.inOutSine(tt);
                    cursor["x"] = Util.lerp(fromX, x, k);
                    cursor["y"] = Util.lerp(fromY, y, k);
                    c.style.left = Js.String(JsMath.round(cursor["x"].num)) + "px";
                    c.style.top = Js.String(JsMath.round(cursor["y"].num)) + "px";
                    SN.Hands.pointAt(SN.SCREEN["x"].num + cursor["x"].num, SN.SCREEN["y"].num + cursor["y"].num);
                    if (tt < 1 && !skipping) SN.after(1.0 / 60, step); else resolve();
                };
                step();
            });
        }
    }
}
