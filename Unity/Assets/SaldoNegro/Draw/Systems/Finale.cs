// Port de js/systems/finale.js (SN.Finale): la meta final y los dos finales (los textos, en js/data/finale.js).
//   start()    -> al llegar a la meta: Kevo escribe por última vez, LOS DESFASADOS entregan lo que falta de NULL.EXE
//                 y se abre el mercado TÚ (los demás se bloquean)
//   elección   -> la última oferta del encapuchado (FINAL A) o NULL.EXE en el escritorio (FINAL B). Si no eliges,
//                 la oferta vuelve cada turno y a la tercera la entidad elige por ti: no decidir también es decidir
//   endingA()  -> el avatar perfecto (sin pala: termina con el gato)
//   endingB()  -> NULL.EXE: la terminal, el colapso, la X, las farolas, la despedida... y el epílogo B (la carta
//                 con la pala, Hacienda y el periódico con Bravo Fines detenido)
// Al terminar: FIN, créditos, la partida se cierra y se vuelve al menú. LA PALA solo se gana con el final B.
// Mientras dura un final no se guarda la partida: si se recarga, se vuelve a la elección.
// (Parte 2 en Finale.Parte2.cs: la X, la terminal, el epílogo B, el embargo, los créditos y el cierre.)
//
// Las funciones async de JS son `async Promise` (ver Logic/Promise.cs). Lo que en JS se pinta con el DOM va con
// Dom.byId / Dom.el / innerHTML. Los oyentes de los turnos (turn:settled / turn:ready) se registran en init(),
// que el arranque debe llamar tras cada SN.LoadAll (el bus de eventos se crea de nuevo en cada carga).
using System;
using System.Collections.Generic;
using System.Linq;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Finale
    {
        // Una línea de un plano en negro: { text, color } (el color, opcional, por defecto el crema claro)
        public sealed class BlackLine
        {
            public readonly string text, color;
            public BlackLine(string text, string color = null) { this.text = text; this.color = color; }
        }

        // El embargo del final B: el orden en que el agente se lleva las cosas, según están en la habitación (de la
        // ventana a la consola), para que la cruce de un lado al otro en vez de ir dando saltos
        static readonly string[] RAID_ORDER = { "lampara", "planta", "tele", "moto", "taza", "maneki", "trebol4", "herradura", "reloj", "teclado", "billete7",
            "movil", "alfombrilla", "cascos", "poster", "trofeo", "pleyzeta" };

        public bool busy;     // un final en marcha
        public V term = V.@null;   // la terminal de NULL.EXE: { prompt, lines, typing } (la pinta js/ui/desktop.js)
        public V you = V.@null;    // la gráfica del mercado TÚ
        public double t;
        public bool termLock;      // (la terminal no se cierra mientras NULL.EXE se ejecuta: js/ui/desktop.js)

        // Parte un texto en líneas cortas (para los planos en negro)
        static List<string> wrap(string text, int max = 40)
        {
            var outp = new List<string>();
            string line = "";
            foreach (var w in text.Split(' '))
            {
                if (line != "" && (line + " " + w).Length > max) { outp.Add(line); line = w; }
                else line = line != "" ? line + " " + w : w;
            }
            if (line != "") outp.Add(line);
            return outp;
        }

        // String(t) con el escape de HTML (&, <, >, ")
        static string esc(V t)
        {
            return Js.String(t).Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
        }

        // replace() de JS con un texto: solo la primera aparición (y el texto de reemplazo tal cual)
        static string Replace1(string s, string find, string with)
        {
            int i = s.IndexOf(find, StringComparison.Ordinal);
            return i < 0 ? s : s.Substring(0, i) + with + s.Substring(i + find.Length);
        }

        // SN.Data.finale (los textos de js/data/finale.js)
        static V F() { return SN.Data["finale"]; }
        // Un objeto { x, y, zoom } de cámara
        static V Cam(double x, double y, double zoom) { return V.Obj("x", x, "y", y, "zoom", zoom); }
        // Lo que el JS hace con `black(texts.map(...))`: una línea por texto, con su color (o el de por defecto)
        static List<BlackLine> Lines(V arr, Func<int, string> color = null)
        {
            var list = new List<BlackLine>();
            int i = 0;
            foreach (V tx in arr) { list.Add(new BlackLine(tx.str, color == null ? null : color(i))); i++; }
            return list;
        }

        // El estado del final dentro de la partida (run.finale); una copia vacía si no hay partida
        public V st()
        {
            V run = SN.State.run;
            if (!run.truthy) return V.Obj();
            if (!run["finale"].truthy) run["finale"] = V.Obj("phase", V.@null, "insist", 0);
            return run["finale"];
        }
        // run.finale, o undefined si no hay partida
        static V RunFin()
        {
            V run = SN.State.run;
            return run.truthy ? run["finale"] : V.undefined;
        }
        public bool active() { V f = RunFin(); return f.truthy && f["phase"].truthy; }
        public bool choosing() { V f = RunFin(); return f.truthy && f["phase"] == "choice" && !busy; }

        // ---------- La meta final ----------
        public async Promise start()
        {
            V f = st();
            if (f["phase"].truthy) return;
            f["phase"] = "prelude";
            SN.Windows.close(true);
            // Kevo se conecta una última vez: "mira por la ventana"
            await SN.Desktop.playConvo("mira");
            await SN.wait(0.8);
            // LOS DESFASADOS: lo que les queda por decir, con la última parte de NULL.EXE
            await SN.Desktop.serFlush();
            SN.State.run["nullParts"] = 3;
            SN.Desktop.renderIcons();
            await SN.wait(0.6);
            // Se abre el mercado TÚ: los demás se bloquean y ya no se puede operar
            f["phase"] = "choice";
            f["insist"] = 0;
            showYou(true);
            SN.FX.glitch(0.9, 1.6);
            SN.Audio.sfx("notifyBad");
            // El aviso, en dos líneas y por encima del mercado TÚ (en una línea a 24 px no cabía en la pantalla y
            // además quedaba por debajo del panel del mercado)
            string warn = F()["you"]["warn"].str;
            string[] parts = warn.Split(new[] { ": " }, StringSplitOptions.None);
            string w1 = parts[0];
            string w2 = parts.Length > 1 ? parts[1] : null;
            await SN.UI.stamp(!string.IsNullOrEmpty(w2) ? esc(w1) + ":<br>" + esc(w2) : esc(warn), "coral fin-warn", "", 2.4);
            enterChoice();
            SN.Save.saveRun();
        }

        // Al cargar una partida que estaba en el final: de vuelta a la elección
        public void resume()
        {
            V f = st();
            f["phase"] = "choice";
            f["lock"] = false;
            SN.State.run["nullParts"] = 3;
            showYou(true);
            SN.Desktop.renderIcons();
            enterChoice();
        }

        public void enterChoice()
        {
            SN.UI.allow = V.Arr("skip", "settings", "window");
            SN.UI.renderAll();
            offerPact();
        }

        // La última oferta (salta sola; vuelve cada turno)
        public void offerPact()
        {
            if (!choosing() || SN.Desktop.open || SN.Dialog.active) return;
            if (!string.IsNullOrEmpty(SN.Windows.current) && SN.Windows.current != "pact") SN.Windows.close(true);
            SN.Windows.open("pact");
        }

        public async Promise choose(string which)
        {
            if (!choosing()) return;
            busy = true;
            V f = st();
            f["phase"] = which;
            f["lock"] = true; // mientras dura el final, no se guarda
            SN.UI.setBusy(true);
            SN.UI.allow = V.Arr();
            SN.Windows.close(true);
            SN.Dialog.hide();
            SN.HeroSay.clear();
            try
            {
                if (which == "A") await endingA();
                else await endingB();
            }
            catch (Exception e)
            {
                SN.logError(e.ToString());
                finish(which);
            }
        }

        // ---------- El mercado TÚ ----------
        public void showYou(bool on)
        {
            Dom.byId("app").classList.toggle("finale", on);
            Dom.byId("finale").classList.toggle("hidden", !on);
            Dom.byId("finale-trade").classList.toggle("hidden", !on);
            if (!on) return;
            if (!you.truthy)
            {
                // Velas que suben sin parar: lo que vales para la entidad
                var c = new JsArray();
                double v = 40;
                for (int i = 0; i < 26; i++)
                {
                    double o = v;
                    v = JsMath.max(8, v + Util.rand(-3, 6));
                    double h = JsMath.max(o, v) + Util.rand(0, 3);
                    double l = JsMath.min(o, v) - Util.rand(0, 3);
                    c.push(V.Obj("o", o, "c", v, "h", h, "l", l));
                }
                you = V.Obj("c", c, "t", 0, "fall", 0);
            }
            renderYou();
        }

        public void renderYou()
        {
            var box = Dom.byId("finale");
            V Y = F()["you"];
            V run = SN.State.run;
            bool zero = you.truthy && you["fall"].num > 0.5;
            string cards = "";
            foreach (V d in SN.Data["markets"])
            {
                cards += "<div class=\"fz-card off\"><i data-ico=\"" + d["icon"].str + "\"></i><span>" + esc(d["short"]) + "</span>"
                    + (zero ? "<b>$0</b>" : "<i data-ico=\"lock\"></i>") + "</div>";
            }
            box.innerHTML = "<div class=\"fz-side\">" + cards + "<div class=\"fz-card you\"><i data-ico=\"avaTu\"></i><span>" + esc(Y["name"])
                + "</span><b>" + esc(Y["tag"]) + "</b></div></div>\n        <div class=\"fz-main\"><div class=\"fz-head\"><i data-ico=\"avaTu\"></i><b>"
                + esc(Y["label"]) + "</b><span class=\"fz-price\">" + Util.money(run.truthy ? run["capital"].num : 0)
                + "</span></div>\n        <canvas id=\"fz-chart\" width=\"222\" height=\"140\"></canvas><div class=\"fz-warn\">" + esc(Y["warn"]) + "</div></div>";
            foreach (var i in box.querySelectorAll("[data-ico]")) i.appendChild(SN.Sprites.node(i.dataset["ico"], 1));
            var ft = Dom.byId("finale-trade");
            V C = F()["choice"];
            ft.innerHTML = "<p class=\"ft-t\">" + esc(C["title"]) + "</p><button id=\"btn-pact\" class=\"btn btn-yellow\">" + esc(C["offer"])
                + "</button><p class=\"ft-or\">" + esc(C["or"]) + "</p><button id=\"btn-fmin\" class=\"btn btn-cyan\">" + esc(C["min"]) + "<kbd>D</kbd></button>";
            ft.querySelector("#btn-pact").addEventListener("click", () => { SN.Audio.sfx("select"); offerPact(); });
            ft.querySelector("#btn-fmin").addEventListener("click", () =>
            {
                if (!choosing() || SN.UI.busy) return;
                SN.Windows.close(true);
                SN.Desktop.minimize("null");
            });
            drawYou();
        }

        public void drawYou()
        {
            var cv = Dom.byId("fz-chart");
            if (cv == null || !you.truthy) return;
            var g = Px.ctx(cv.canvas);
            int W = cv.width, H = cv.height;
            V Y = you;
            g.fillStyle = "#16123A"; g.fillRect(0, 0, W, H);
            g.fillStyle = "#221C4E";
            for (int y = 14; y < H; y += 18) g.fillRect(0, y, W, 1);
            for (int x = 20; x < W; x += 28) g.fillRect(x, 0, 1, H);
            double keep = 1 - Y["fall"].num; // al ejecutar NULL.EXE, todo cae a cero
            JsArray c = Y["c"].arr;
            var vals = new List<double>();
            foreach (V k in c) { vals.Add(k["h"].num); vals.Add(k["l"].num); }
            double lo = 0, hi = JsMath.max(vals.ToArray()) + 6;
            Func<double, double> yOf = (v) => JsMath.round(H - 8 - (v * keep - lo) / (hi - lo) * (H - 20));
            int n = c.length;
            double step = Math.Floor((W - 30) / (double)n);
            for (int i = 0; i < n; i++)
            {
                V k = c[i];
                double x = 6 + i * step;
                bool up = k["c"].num >= k["o"].num;
                string col = Y["fall"].num > 0 ? "#5A5070" : up ? PAL.green : PAL.coral;
                g.fillStyle = col;
                g.fillRect(x + 2, yOf(k["h"].num), 1, JsMath.max(1, yOf(k["l"].num) - yOf(k["h"].num)));
                double top = yOf(JsMath.max(k["o"].num, k["c"].num)), bot = yOf(JsMath.min(k["o"].num, k["c"].num));
                g.fillRect(x, top, 5, JsMath.max(1, bot - top));
            }
            // Precio: lo que tienes (y, al final, cero)
            V last = c[n - 1];
            double py = yOf(last["c"].num);
            g.fillStyle = Y["fall"].num > 0 ? PAL.coral : PAL.yellow;
            g.fillRect(0, py, W, 1);
            var price = Dom.byId("finale").querySelector(".fz-price");
            V run = SN.State.run;
            if (price != null && run.truthy)
                price.textContent = Util.money(Y["fall"].num > 0 ? JsMath.round(run["capital"].num * keep) : run["capital"].num);
        }

        public void update(double dt)
        {
            t += dt;
            V Y = you;
            if (!Y.truthy || Dom.byId("finale").classList.contains("hidden")) return;
            if (Y["fall"].num > 0 && Y["fall"].num < 1) Y["fall"] = JsMath.min(1, Y["fall"].num + dt / 2.6);
            if (Y["fall"].num == 0)
            {
                double yt = Y["t"].num + dt;
                Y["t"] = yt;
                if (yt > 0.45)
                {
                    // Cada medio segundo, otra vela que sube
                    Y["t"] = 0;
                    JsArray cs = Y["c"].arr;
                    double o = cs[cs.length - 1]["c"].num;
                    double c = o + Util.rand(-2, 5);
                    cs.push(V.Obj("o", o, "c", c, "h", JsMath.max(o, c) + Util.rand(0, 2), "l", JsMath.min(o, c) - Util.rand(0, 2)));
                    cs.shift();
                }
            }
            drawYou();
        }

        // ---------- Herramientas de las escenas ----------
        // Subtítulo (fuera del monitor). auto: segundos hasta seguir solo; si no, clic para seguir
        public async Promise say(string name, string text, double auto = 0)
        {
            var C = SN.Cine;
            bool was = C.running;
            C.running = true; C.canSkip = false; C.skipping = false;
            try { await C.say(name, text, V.Obj("auto", auto)); }
            finally { C.running = was; }
        }

        // Plano en negro con varias líneas (cada una partida para que quepa)
        public async Promise black(List<BlackLine> lines, double dur)
        {
            var rows = new List<V>();
            foreach (var l in lines)
                foreach (var text in wrap(l.text))
                    rows.Add(V.Obj("text", text, "color", !string.IsNullOrEmpty(l.color) ? l.color : PAL.creamL, "t", 0));
            var shown = rows.GetRange(0, Math.Min(6, rows.Count));
            SN.Cine.setShot(V.Obj("type", "black", "lines", V.Arr(shown.ToArray()), "lineT", 0));
            await SN.wait(dur);
        }

        // Panel en la pantalla del monitor o en todo el escenario, con un botón para seguir.
        // [data-ico]: un icono de pixel art; after(el): para meter lo que no es HTML (la foto del periódico)
        public Promise panel(string html, string cls, string where = "layer-top", string btn = "Seguir", Action<DomElement> after = null)
        {
            return new Promise((resolve) =>
            {
                var el = Dom.el("div", "fin-panel " + cls, html);
                foreach (var i in el.querySelectorAll("[data-ico]")) i.appendChild(SN.Sprites.node(i.dataset["ico"], 2));
                if (after != null) after(el);
                var b = Dom.el("button", "btn btn-yellow fin-next", esc(btn) + "<kbd>⏎</kbd>");
                el.appendChild(b);
                Dom.byId(where).appendChild(el);
                bool done = false;
                Action<DomEvent> onKey = null;
                Action close = () =>
                {
                    if (done) return;
                    done = true;
                    Dom.document.removeEventListener("keydown", onKey); // DUDA: en la web se quita con capture = true
                    el.classList.add("out");
                    SN.after(0.3, () => { el.remove(); resolve(); });
                };
                onKey = (e) => { if (e.code == "Enter" || e.code == "Space") { e.preventDefault(); e.stopPropagation(); close(); } };
                b.addEventListener("click", (e) => { e.stopPropagation(); SN.Audio.sfx("select"); close(); });
                SN.after(0.6, () => { if (!done) Dom.document.addEventListener("keydown", onKey); }); // DUDA: capture = true omitido (el DOM no lo tiene)
            });
        }

        // Onomatopeya de cómic sobre el escenario (coordenadas del escenario de 640x360)
        public void comic(string text, double x, double y)
        {
            var el = Dom.el("div", "fin-comic", esc(text));
            el.style.left = Js.String(x) + "px";
            el.style.top = Js.String(y) + "px";
            el.style.setProperty("--r", JsNumber.toFixed(Util.rand(-14, 14), 0) + "deg");
            Dom.byId("stage-top").appendChild(el);
            SN.after(1.1, () => el.remove());
        }

        // El gato mira a la cámara y, durante un instante, tiene la cara del encapuchado
        public async Promise catSting()
        {
            var H = SN.Hero;
            H.catDo("stare", 7);
            SN.Game.camTo(Cam(70, 316, 2.6), 1.6);
            await SN.wait(2.6);
            SN.Music.sting("hood");
            H.cat.hoodT = 0.5;
            SN.Audio.sfx("heart");
            await SN.wait(1.8);
            SN.Game.camTo(Cam(320, 180, 1), 1.4);
            await SN.wait(1.2);
        }

        // La pantalla se apaga (todo a negro)
        public async Promise powerOff()
        {
            SN.Audio.sfx("powerOff");
            var fade = Dom.byId("fade");
            fade.style.transition = "opacity .9s steps(6)";
            fade.style.opacity = "1";
            await SN.wait(1.4);
        }

        // ---------- FINAL A: el avatar perfecto ----------
        public async Promise endingA()
        {
            V A = F()["a"];
            if (SN.Desktop.open) SN.Desktop.restore();
            SN.Audio.setMood("tense");
            // FUTURO.EXE absorbe la interfaz
            SN.Audio.sfx("static", V.Obj("dur", 1.4));
            SN.FX.glitch(1.6, 2.6);
            Dom.byId("screen").classList.add("glitch");
            Dom.byId("app").classList.add("absorb");
            await SN.wait(2.4);
            Dom.byId("screen").classList.remove("glitch");
            // El encapuchado aparece frente al protagonista y se funde con él
            SN.Music.sting("hood");
            SN.Audio.sfx("whisper");
            SN.Cine.setShot(V.Obj("type", "face", "expr", "shocked", "night", true, "opts", V.Obj("hoodIn", 4.5)));
            await SN.wait(1.6); SN.Audio.sfx("heart");
            await SN.wait(1.6); SN.Audio.sfx("heart");
            await SN.wait(2.4);
            // La habitación pierde sus colores y las gráficas se salen del monitor
            SN.Cine.setShot(V.@null);
            SN.Audio.setMood("normal");
            SN.Music.force("black");
            Dom.byId("desk").classList.add("gray");
            SN.Desk.crawl = 0.01;
            SN.Game.camTo(Cam(320, 180, 1), 0.01);
            await SN.wait(4.5);
            await black(Lines(A["fusion"]), 6);
            // FUTURO.EXE vuelve a arrancar... para el siguiente usuario
            SN.Music.force("menu1");
            SN.Audio.sfx("boot");
            await black(Lines(A["admin"], (i) => PAL.yellow), 6.5);
            await black(new List<BlackLine> { new BlackLine(A["kevo"].str, PAL.creamD) }, 4.5);
            SN.Cine.setShot(V.@null);
            // Epílogo A: sin pala. Solo el gato
            await SN.wait(1.2);
            await catSting();
            await powerOff();
            await theEnd("A");
        }

        // ---------- FINAL B: NULL.EXE ----------
        public async Promise endingB()
        {
            V T = F()["term"];
            // 1) La terminal: primero se comprueba qué es el encapuchado; luego, la secuencia de NULL.EXE
            SN.Desktop.closeWin("null");
            term = V.Obj("prompt", T["prompt"], "lines", new JsArray(), "typing", V.@null);
            // Mientras dure la terminal, ni se cierra ni se vuelve a FUTURO.exe (js/ui/desktop.js): el final espera a que
            // escribas en ella, y si se cerraba se quedaba esperando para siempre
            termLock = true;
            SN.Desktop.launch("term");
            SN.Music.pulse("danger");
            string money = Util.money(SN.State.run["capital"].num);
            var steps = new List<V>();
            foreach (V s in T["intro"]) steps.Add(s);
            foreach (V s in T["steps"]) steps.Add(s);
            foreach (V s in steps)
            {
                await typeCmd(s["cmd"].str);
                foreach (V o in s["out"])
                {
                    termLine(Replace1(o.str, "{capital}", money));
                    SN.Audio.sfx("tick");
                    await SN.wait(0.35);
                }
                if (s["hood"].truthy)
                {
                    SN.FX.glitch(0.6, 1.1);
                    SN.Audio.sfx("static", V.Obj("dur", 0.4));
                    await say("???", s["hood"].str, 2.4);
                }
                await SN.wait(0.4);
            }
            SN.Music.pulse(null);
            // 2) EXECUTE: los mercados y el mercado TÚ caen a cero, y el dinero desaparece
            await SN.wait(0.6);
            termLock = false;
            SN.Desktop.closeWin("term");
            SN.Desktop.restore();
            await SN.wait(0.5);
            SN.Music.tapeStop(1.6);
            SN.Audio.sfx("collapse");
            SN.FX.shake(3, 1.2);
            you["fall"] = 0.001;
            Dom.byId("finale").classList.add("falling");
            SN.Economy.spend(SN.State.run["capital"].num, "null");
            await SN.wait(2.8);
            renderYou();
            // 3) El encapuchado, con miedo
            SN.FX.glitch(1, 2);
            foreach (V l in T["fear"]) await say("???", l.str, 2.2);
            // 4) Por primera vez, FUTURO.EXE tiene una X
            await waitX();
            // 5) SYSTEM RESET COMPLETE... y la aplicación desaparece
            SN.Audio.sfx("powerOff");
            var done = new List<BlackLine>();
            int di = 0;
            foreach (V tx in T["done"]) { done.Add(new BlackLine(tx.str, di == 2 ? PAL.coral : PAL.green)); di++; }
            await black(done, 5);
            Dom.byId("app").classList.add("hidden");
            Dom.byId("screen").classList.add("off");
            SN.State.run["nullParts"] = 0; // NULL.EXE ya se ha ejecutado: desaparece del escritorio
            SN.Desktop.renderIcons();
            SN.Cine.setShot(V.@null);
            // 6) La pantalla en negro... y, de noche, por la ventana, las farolas se encienden una a una
            SN.Desk.phaseOverride = "night";
            SN.Desk.dirty();
            SN.Music.force("final");
            SN.Game.camTo(Cam(100, 120, 2), 1.6);
            await SN.wait(1.2);
            SN.Desk.windowEvent("farolas");
            await SN.wait(7);
            SN.Game.camTo(Cam(320, 180, 1), 1.4);
            await SN.wait(1.2);
            // 7) LOS DESFASADOS se despiden (el escritorio, ya sin FUTURO.EXE)
            Dom.byId("screen").classList.remove("off");
            SN.Desktop.noApp = true;
            SN.Desktop.open = true;
            Dom.byId("desktop").classList.remove("hidden");
            SN.Desktop.renderIcons();
            SN.Desktop.contact = "ser";
            SN.Desktop.launch("chat");
            SN.Desktop.contact = "ser";
            SN.Desktop.renderChat();
            await SN.wait(1);
            await SN.Desktop.serFarewell(F()["farewell"].str);
            await SN.wait(1.2);
            foreach (V l in F()["b"]["alive"]) await say("", l.str, 2.6);
            await say("", F()["b"]["kevo"].str, 2.8);
            await epilogueB();
        }
    }
}
