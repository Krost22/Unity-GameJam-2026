// Bailout (parte 5): el guion (el móvil, la videollamada con Trompa, la firma, los billetes), la mano que pulsa y
// el bucle de cada fotograma (update). Ver Bailout.cs.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using SaldoNegro.Logic;
using LV = SaldoNegro.Logic.V;

namespace SaldoNegro
{
    public sealed partial class Bailout
    {
        // ---------- El guion ----------
        public async Promise script()
        {
            if (from != "call") await phonePart();
            await callPart();
        }

        // La llamada a la Línea de Rescate (el móvil, en primera persona)
        public async Promise phonePart()
        {
            var X = TX(); var V = this.V;
            // 1) Llamando...
            V.ui = "dial"; V.ut = 0;
            SN.Audio.sfx("ringback"); await wait(1.1);
            SN.Audio.sfx("ringback"); await wait(1.1);
            V.ui = "welcome"; V.ut = 0;
            SN.Audio.sfx("select");
            await say(X["line"], X["welcome"], voice: "robot", auto: 1.1);
            // 2) El menú: hasta que eliges ser un banco enorme
            for (; ; )
            {
                V.ui = "menu"; V.sel = 0; V.ut = 0;
                say(X["line"], X["menu"], voice: "robot", hold: true);
                var dp = new Promise<double>((res, rej) =>
                {
                    pick = (n) => { pick = null; res(n); };
                    waiters.Add(new Waiter { test = () => false, resolve = () => { }, reject = rej });
                });
                double d = await dp;
                V.sel = (int)d;
                await tapAt((BTN((int)d - 1).x + 6, BTN((int)d - 1).y + 7), () => SN.Audio.sfx("dtmf", LV.Obj("d", d)));
                await wait(0.25);
                clearSay();
                if (d == 2) break;
                V.ui = "wrong"; V.ut = 0;
                SN.Audio.sfx("error");
                await say(X["line"], X["wrong"][(int)d - 1], voice: "robot", auto: 1.5);
            }
            // 3) El nombre del banco: lo escribes tú
            V.ui = "name"; V.ut = 0; V.typed = 0; V.sent = false;
            await say(X["line"], X["askName"], voice: "robot", auto: 0.4);
            // (lo que ya hayas tecleado mientras hablaba el contestador se conserva)
            say_ = new Say { name = X["you"], full = JsString.slice(X["bankName"].str, 0, V.typed), shown = V.typed, hold = true, caret = true, t = 0 };
            Dom.byId("subs").classList.remove("hidden", "click");
            renderSubs();
            await until(() => V.sent);
            await wait(0.3);
            clearSay();
            // 4) Comprobando... y el veredicto
            V.ui = "check"; V.ut = 0; V.finger = new Pt(REST_POS.x, REST_POS.y);
            await say(X["line"], X["checking"], voice: "robot", auto: 0.8);
            V.ui = "verdict"; V.ut = 0;
            await wait(0.18);
            SN.Audio.sfx("thud"); SN.FX.shake(3, 0.25);
            await say(X["line"], X["verdict"], voice: "robot", auto: 1.1);
            // 5) En espera (con su musiquita)
            V.ui = "hold"; V.ut = 0;
            SN.Audio.sfx("holdMusic");
            Dom.byId("subs").classList.remove("hidden", "click");
            Dom.byId("subs").innerHTML = "<i>" + X["holdLine"].str + "</i>";
            await wait(2.3);
            Dom.byId("subs").classList.add("hidden");
            // 6) Videollamada entrante: la coges
            V.ui = "incoming"; V.ut = 0;
            SN.Audio.sfx("ringback");
            await wait(1.0);
            await tapAt(ACCEPT, () => SN.Audio.sfx("select"));
            V.ui = "accept";
            await tween(0.55, (k) => { V.zoom = k; });
            V.flash = 0.8;
            SN.Audio.sfx("static", LV.Obj("dur", 0.25));
        }

        // La videollamada con el Presidente
        public async Promise callPart()
        {
            var X = TX(); var V = this.V;
            // 7) La llamada con el Presidente
            V.scene = "call"; V.t = 0; V.zoom = 0; V.finger = null; V.hero = "worried";
            Dom.byId("subs").classList.remove("top");
            await wait(0.5);
            foreach (var ln in X["call"]) await line(ln);
            // 8) Cuelga
            V.eyes = "wink"; V.mouth = "smirk"; V.gesture = "thumbs"; V.armK = 0;
            await wait(0.7);
            SN.Audio.sfx("hangup");
            V.ended = true;
            await tween(0.5, (k) => { V.fade = k * 0.85; });
            await wait(0.6);
            V.ended = false;
            await say(X["you"], X["heroLine"], voice: "me", auto: 1.6);
            await tween(0.3, (k) => { V.fade = 0.85 + k * 0.15; });
        }

        static string Nullish(LV v) { return v.isNullish ? null : v.str; }
        // String.prototype.replace con un texto: solo la primera aparición (como en JS)
        static string ReplaceFirst(string s, string find, string with)
        {
            int i = s.IndexOf(find, StringComparison.Ordinal);
            return i < 0 ? s : s.Substring(0, i) + with + s.Substring(i + find.Length);
        }

        // Una frase de Trompa con su gesto
        public async Promise line(LV ln)
        {
            var V = this.V; var X = TX();
            string gest = Nullish(ln["g"]);
            V.gesture = gest == "money" ? "money" : gest; V.gt = 0; V.armK = 0; V.flapT = 0.25;
            V.hero = ln["hero"].truthy ? ln["hero"].str : V.hero;
            string text = ReplaceFirst(ln["t"].str, "{coins}", Util.money(coins));
            if (gest == "show") { V.lift = 30; tween(0.35, (k) => { V.lift = JsMath.round(JsMath.pow(1 - k, 2) * 30); }); SN.Audio.sfx("whoosh"); }
            if (gest == "money") printMoney(2.6);
            await say(X["president"], text, voice: "trompa", auto: gest == "show" ? 0 : 2.4);
            if (gest == "sign")
            {
                // Plano detalle: la firma, trazo a trazo
                V.scene = "insert"; V.sig = 0;
                int lastSeg = -1;
                await tween(1.7, (k) =>
                {
                    V.sig = Util.ease.inOutSine(k);
                    int seg = (int)Math.Floor(V.sig * 26);
                    if (seg != lastSeg) { lastSeg = seg; SN.Audio.sfx("scribble"); }
                });
                await wait(0.5);
                V.scene = "call";
            }
            if (gest == "button")
            {
                V.armK = 1; SN.Audio.sfx("whoosh");
                await wait(0.35);
                V.armK = 2; V.press = 1; V.eyes = "wide"; V.mouth = "wide";
                SN.Audio.sfx("bigButton"); SN.FX.shake(5, 0.35); V.flash = 0.6; V.hero = "shocked";
                await wait(0.35);
                V.press = 0;
            }
        }

        // La mano derecha va al objetivo, pulsa y vuelve un poco
        public async Promise tapAt((double x, double y) to, Action onPress)
        {
            var V = this.V;
            var start = (x: V.finger.x, y: V.finger.y);
            await tween(0.16, (k) =>
            {
                double e = Util.ease.outCubic(k);
                V.finger = new Pt(Util.lerp(start.x, to.x, e), Util.lerp(start.y, to.y, e));
            });
            V.finger = new Pt(to.x, to.y) { down = true };
            if (SN.Hands != null) SN.Hands.press();
            if (onPress != null) onPress();
            await wait(0.12);
            V.finger = new Pt(to.x + 4, to.y + 6);
        }

        public Promise tween(double dur, Action<double> fn)
        {
            double t0 = V.clock;
            fn(0);
            return until(() => { double k = JsMath.min(1, (V.clock - t0) / dur); fn(k); return k >= 1; });
        }

        // La impresora: billetes que salen de detrás de la mesa y vuelan hacia la cámara
        public void printMoney(double dur)
        {
            V.printing = dur; V.brr = 0.01;
            SN.Audio.sfx("printer", LV.Obj("dur", dur));
            SN.Audio.sfx("cash");
            SN.Audio.sfx("coin");
        }

        // ---------- Cada fotograma ----------
        public void update(double dt)
        {
            var V = this.V;
            V.clock = V.clock + dt;
            V.t += dt; V.ut += dt; V.gt = V.gt + dt;
            V.flash = Math.Max(0, V.flash - dt * 3);
            V.keyFlash = Math.Max(0, V.keyFlash - dt);
            if (V.finger != null && V.finger.down && V.keyFlash <= 0 && V.ui == "name") V.finger = new Pt(V.finger.x + 2, V.finger.y + 5);
            // Subtítulo: máquina de escribir y voz
            var s = say_;
            if (s != null && !string.IsNullOrEmpty(s.full) && s.shown < s.full.Length)
            {
                int before = (int)Math.Floor(s.shown);
                s.shown = JsMath.min(s.full.Length, s.shown + dt * 40);
                if ((int)Math.Floor(s.shown) != before) { renderSubs(); if (before % 2 == 0) SN.Audio.sfx("type", LV.Obj("voice", s.voice)); }
            }
            else if (s != null && s.auto != 0 && !s.hold) { s.t += dt; if (s.t >= s.auto) s.done = true; }
            // Trompa: boca al hablar (abierta en las vocales), cabeceo, parpadeo, el tupé y su gesto
            if (V.scene == "call")
            {
                bool talking = s != null && s.voice == "trompa" && s.shown < s.full.Length;
                string ch = talking ? s.full[(int)Math.Floor(s.shown)].ToString() : "";
                string rest = V.gesture == "show" || V.gesture == "thumbs" || V.gesture == "money" ? "grin" : "o";
                if (V.armK != 2 || V.gesture != "button")
                {
                    V.mouth = talking ? (Regex.IsMatch(ch, "[aeiouáéíóúAEIOU]") ? (Regex.IsMatch(ch, "[AÁ!]") ? "wide" : "talk") : "o") : rest;
                    bool blink = (V.t % 3.4) > 3.27;
                    V.eyes = V.gesture == "sign" ? "down" : blink ? "blink" : V.gesture == "show" || V.gesture == "thumbs" ? "smug" : "open";
                }
                V.nod = talking && (((int)Math.Floor(s.shown / 7)) % 2 != 0) ? 1 : 0;
                V.flapT = Math.Max(0, V.flapT - dt);
                V.flap = V.flapT > 0 || JsMath.sin(V.t * 2.3) > 0.8;
                string G = V.gesture;
                if (G == "accordion") V.armK = JsMath.round((JsMath.sin(V.gt * 5) * 0.5 + 0.5) * 4);
                else if (G == "money") V.armK = 4;
                else if (G == "point") V.armK = talking && (((int)Math.Floor(s.shown / 5)) % 2 != 0) ? 1 : 0;
                else if (G == "thumbs") V.armK = Math.Floor(V.gt * 3) % 2;
                else if (G == "sign")
                {
                    double nk = Math.Floor(V.gt * 9) % 6 * 4 + Math.Floor(V.gt * 2) % 3;
                    if (nk != V.armK) SN.Audio.sfx("scribble");
                    V.armK = JsMath.min(22, nk);
                }
            }
            // Billetes
            if (V.printing > 0)
            {
                V.printing -= dt;
                V.brr = JsMath.min(1, V.brr + dt * 1.5);
                for (int i = 0; i < 2; i++)
                    if (JsMath.rnd() < dt * 22)
                    {
                        V.bills.Add(new Bill
                        {
                            x = Util.rand(46, 110), y = 62, vx = Util.rand(-40, 40), vy = Util.rand(-70, -40), z = 0, spin = Util.rand(0, 3), vs = Util.rand(6, 14),
                        });
                    }
                if (JsMath.rnd() < dt * 6) SN.Audio.sfx("coinBounce");
            }
            else if (V.brr > 0) V.brr = Math.Max(0, V.brr - dt * 2);
            foreach (var p in V.bills)
            {
                p.z += dt * 0.9; p.spin += dt * p.vs;
                p.vx += (p.x < 80 ? -1 : 1) * 30 * dt; p.vy += 55 * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
            }
            V.bills.RemoveAll((p) => !(p.y < 100 && p.x > -14 && p.x < W + 4));
            // Comprobar las esperas
            if (waiters.Count > 0)
            {
                var ws = waiters;
                waiters = new List<Waiter>();
                foreach (var w in ws)
                {
                    bool ok = false;
                    try { ok = w.test(); } catch (Exception) { ok = false; }
                    if (ok) w.resolve(); else waiters.Add(w);
                }
            }
        }
    }
}
