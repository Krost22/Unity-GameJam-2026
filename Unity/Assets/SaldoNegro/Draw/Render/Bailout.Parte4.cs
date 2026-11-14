// Bailout (parte 4): estado de la escena (la B del JS), tipos auxiliares, play / skip / abort / finish, las esperas,
// los subtítulos con máquina de escribir y la entrada (ratón, teclado). Ver Bailout.cs.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using LV = SaldoNegro.Logic.V;

namespace SaldoNegro
{
    public sealed partial class Bailout
    {
        // ---------- Tipos auxiliares ----------
        // Un punto (la mano; down = pulsa)
        public sealed class Pt
        {
            public double x, y;
            public bool down;
            public Pt(double x, double y, bool down = false) { this.x = x; this.y = y; this.down = down; }
        }
        // Un billete que sale volando
        public sealed class Bill { public double x, y, vx, vy, z, spin, vs; }
        // Lo que hay que enseñar en un fotograma (el V del JS: tiempos, poses, interfaz del móvil y de la llamada)
        public sealed class BailoutView
        {
            public string scene = "phone", ui = "dial";
            public double clock, t, ut, gt, flash, brr, fade, zoom, keyFlash, printing, lift, nod, armK, press, flapT, sig;
            public string eyes = "open", mouth = "o", gesture = "idle", hero;
            public bool flap, ended, sent;
            public int sel, hover, typed, lastKey;
            public Pt finger, tip;
            public List<Bill> bills = new List<Bill>();
        }
        // Subtítulo en curso (this.say_ del JS)
        public sealed class Say
        {
            public LV name;
            public string full;
            public double shown;
            public string voice;
            public double auto, t;
            public bool hold, caret, done;
        }
        // Una espera (until): test se comprueba en cada fotograma
        public sealed class Waiter
        {
            public Func<bool> test;
            public Action resolve;
            public Action<Exception> reject;
        }
        // Lo que lanza skip / abort a las esperas (la ABORT del JS)
        sealed class BailoutAbort : Exception { }

        // ---------- Estado ----------
        public bool active;
        public double speed = 1; // (las pruebas la reproducen más deprisa)
        public double coins;
        public string from;
        public BailoutView V = new BailoutView();
        public DomElement cv;
        public Ctx2D g;
        public List<Waiter> waiters = new List<Waiter>();
        public Action<double> pick;
        public Action<LV> resolve;
        public Action off;
        public Say say_;

        // from: 'phone' (toda la escena) o 'call' (directamente la videollamada)
        public Promise<LV> play(double coins = 0, string from = "phone")
        {
            active = true;
            this.coins = coins;
            this.from = from;
            V = new BailoutView { scene = "phone", ui = "dial", clock = 0, t = 0, ut = 0, eyes = "open", mouth = "o", gesture = "idle", finger = new Pt(REST_POS.x, REST_POS.y) };
            cv = Dom.byId("cine");
            g = Px.ctx(cv.getContext().canvas);
            cv.classList.remove("hidden");
            // En el móvil, el subtítulo va arriba (en la videollamada, abajo)
            if (from != "call") Dom.byId("subs").classList.add("top");
            else V.scene = "call";
            SN.Audio.setMood("silent");
            waiters = new List<Waiter>();
            Action<DomEvent> down = (e) =>
            {
                if (!(e.button == 0 || e.pointerType == "touch")) return;
                e.stopPropagation();
                onPointer(e);
            };
            Action<DomEvent> move = (e) => onMove(e);
            Action<DomEvent> kd = (e) =>
            {
                if (e.code == "Escape") return;
                e.preventDefault(); e.stopPropagation();
                onKey(e);
            };
            Dom.document.addEventListener("pointerdown", down);
            Dom.document.addEventListener("pointermove", move);
            Dom.document.addEventListener("keydown", kd);
            off = () =>
            {
                Dom.document.removeEventListener("pointerdown", down);
                Dom.document.removeEventListener("pointermove", move);
                Dom.document.removeEventListener("keydown", kd);
            };
            double last = Dom.now();
            Action<double> loop = null;
            loop = (now) =>
            {
                if (!active) return;
                double dt = JsMath.min(0.05, (now - last) / 1000.0);
                last = now;
                update(dt * speed);
                draw(g, V);
                Dom.requestAnimationFrame(loop);
            };
            Dom.requestAnimationFrame(loop);
            return new Promise<LV>((res, rej) =>
            {
                resolve = res;
                script().then(() => finish()).@catch((e) =>
                {
                    if (!(e is BailoutAbort)) { SN.logError("[bailout] " + e); finish(); }
                });
            });
        }

        // Terminar ya, como si hubiera acabado la llamada (pruebas que solo comprueban lo que pasa después)
        public void skip()
        {
            if (!active) return;
            var ws = waiters;
            waiters = new List<Waiter>();
            finish();
            foreach (var w in ws) w.reject(new BailoutAbort());
        }
        // Salir al menú (o empezar otra partida) en mitad de la escena
        public void abort()
        {
            if (!active) return;
            active = false;
            cleanup();
            resolve = null;
            foreach (var w in waiters.ToArray()) w.reject(new BailoutAbort());
            waiters = new List<Waiter>();
        }
        public void finish()
        {
            if (!active) return;
            active = false;
            cleanup();
            var r = resolve;
            resolve = null;
            if (r != null) r(LV.Obj("coins", coins));
        }
        public void cleanup()
        {
            if (off != null) off();
            off = null;
            cv.classList.add("hidden");
            Dom.byId("subs").classList.add("hidden");
            Dom.byId("subs").classList.remove("top");
            say_ = null;
        }

        // ---------- Esperas (se cancelan si se aborta la escena) ----------
        public Promise until(Func<bool> test)
        {
            var p = new Promise((res, rej) =>
            {
                waiters.Add(new Waiter { test = test, resolve = res, reject = rej });
            });
            // Algunas esperas no las espera nadie (el subtítulo que se queda en pantalla, la carpeta que sube):
            // si se corta la llamada, que su cancelación no salga como error
            p.@catch((e) => { });
            return p;
        }
        public Promise wait(double s) { double end = V.clock + s; return until(() => V.clock >= end); }

        // Subtítulo con máquina de escribir (el mismo cuadro que las cinemáticas). auto: segundos para seguir solo;
        // hold: no se cierra (sigue en pantalla mientras pasa otra cosa, como el menú del contestador)
        public Promise say(LV name, LV text, string voice = "me", double auto = 0, bool hold = false)
        {
            var el = Dom.byId("subs");
            el.classList.remove("hidden");
            el.classList.toggle("click", auto == 0 && !hold);
            var me = new Say { name = name, full = text.str, shown = 0, voice = voice, auto = auto, hold = hold, t = 0, done = false };
            say_ = me;
            renderSubs();
            // Un subtítulo también termina si otro ocupa su lugar (p. ej., empiezas a escribir el nombre del banco
            // antes de que el contestador acabe la frase): si no, el guion se quedaría esperándolo para siempre
            if (hold) return until(() => say_ != me || me.shown >= me.full.Length);
            return until(() => me.done || say_ != me).then(() => { if (say_ == me) clearSay(); });
        }
        public void clearSay() { say_ = null; Dom.byId("subs").classList.add("hidden"); }
        static string Esc(string t) { return t.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;"); }
        public void renderSubs()
        {
            var s = say_;
            if (s == null) return;
            string nm = s.name.truthy ? "<b>" + Esc(s.name.str) + ":</b> " : "";
            string body = Esc(JsString.slice(s.full, 0, (int)Math.Floor(s.shown)));
            Dom.byId("subs").innerHTML = nm + body + (s.caret ? "<i class=\"caret\"></i>" : "");
        }
        public void advance()
        {
            var s = say_;
            if (s == null || s.hold) return;
            if (s.shown < s.full.Length) { s.shown = s.full.Length; renderSubs(); return; }
            s.done = true;
        }

        // ---------- Entrada ----------
        // En el móvil, las coordenadas del dibujo (sin los 10 px que baja)
        public (double x, double y) toPhone(DomEvent e) { var p = toBuf(e); return (p.x, p.y - PDY); }
        public (double x, double y) toBuf(DomEvent e)
        {
            var p = SN.Game.toStage(e.clientX, e.clientY);
            return (p["x"].num / Z, p["y"].num / Z);
        }
        static bool inRect((double x, double y) p, (int x, int y, int w, int h) r)
        {
            return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
        }
        public void onMove(DomEvent e)
        {
            var v = V;
            if (!active || v.ui != "menu" || v.scene != "phone") return;
            var p = toPhone(e);
            v.hover = 0;
            for (int i = 0; i < 3; i++) if (inRect(p, BTN(i))) v.hover = i + 1;
        }
        public void onPointer(DomEvent e)
        {
            var v = V;
            var p = toBuf(e); var q = toPhone(e);
            if (v.scene == "phone" && v.ui == "menu" && pick != null)
            {
                for (int i = 0; i < 3; i++) if (inRect(q, BTN(i))) { pick(i + 1); return; }
                return;
            }
            if (v.scene == "phone" && v.ui == "name")
            {
                if (inRect(q, SEND)) sendName(); else typeKey(null);
                return;
            }
            // La firma de Trompa: un garabato... con una letra del idioma secreto
            if ((v.scene == "call" && v.gesture == "show" && p.x >= 58 && p.x < 102 && p.y >= 62 + v.lift && p.y < 74 + v.lift) ||
                (v.scene == "insert" && p.y > 42 && p.y < 72))
            {
                if (SN.Cipher != null && SN.Cipher.discover("firma").truthy) return;
            }
            advance();
        }
        public void onKey(DomEvent e)
        {
            var v = V;
            if (v.scene == "phone" && v.ui == "menu" && pick != null && DIGITS.TryGetValue(e.code, out int dg)) { pick(dg); return; }
            if (v.scene == "phone" && v.ui == "name")
            {
                if (e.code == "Enter" || e.code == "NumpadEnter") sendName();
                else if (!e.repeat || JsMath.rnd() < 0.35) typeKey(e.code);
                return;
            }
            if (e.code == "Space" || e.code == "Enter" || e.code == "NumpadEnter") advance();
        }
        // Cada tecla pone un trocito del nombre del banco (de 1 a 3 letras)
        public void typeKey(string code = null)
        {
            var v = V;
            string full = TX()["bankName"].str;
            if (v.typed >= full.Length) return;
            v.typed = Math.Min(full.Length, v.typed + 1 + (int)Math.Floor(JsMath.rnd() * 3));
            v.keyFlash = 0.12;
            int lk = !string.IsNullOrEmpty(code) ? code[code.Length - 1] : (int)Math.Floor(JsMath.rnd() * 25);
            v.lastKey = lk % 25;
            v.finger = new Pt(SCR_X + 6 + (v.lastKey % 9) * 5, SCR_Y + 41 + Math.Floor(v.lastKey / 9.0) * 6) { down = true };
            SN.Audio.sfx("key");
            if (SN.Hands != null) SN.Hands.tapKey(string.IsNullOrEmpty(code) ? "KeyJ" : code);
            say_ = new Say { name = TX()["you"], full = JsString.slice(full, 0, v.typed), shown = v.typed, voice = "me", hold = true, caret = true, t = 0 };
            Dom.byId("subs").classList.remove("hidden", "click");
            renderSubs();
        }
        public void sendName()
        {
            var v = V;
            if (v.typed < TX()["bankName"].str.Length || v.sent) return;
            v.sent = true;
            v.finger = new Pt(SEND.x + SEND.w / 2.0, SEND.y + 4) { down = true };
            SN.Audio.sfx("select");
        }

        static readonly Dictionary<string, int> DIGITS = new Dictionary<string, int>
        {
            ["Digit1"] = 1, ["Digit2"] = 2, ["Digit3"] = 3, ["Numpad1"] = 1, ["Numpad2"] = 2, ["Numpad3"] = 3,
        };
    }
}
