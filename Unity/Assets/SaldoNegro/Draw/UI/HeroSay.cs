// Port de js/ui/hero-say.js (SN.HeroSay). El protagonista habla: globos de texto encima del teclado (en la habitación,
// fuera del monitor) cuando pasa algo en la historia. Las frases están en D.story.heroSays (varias por suceso, sin
// repetir seguidas). No bloquean nada: hacen cola y, durante una cinemática o un diálogo, esperan a que termine.
//   SN.HeroSay.say("debtPaid")  -> una frase de ese suceso      SN.HeroSay.say("¡Hola!", V.Obj("raw", true))
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class HeroSay
    {
        const double GAP = 5;          // segundos mínimos entre globos
        const double REPEAT = 35;      // segundos antes de repetir el mismo suceso (salvo los importantes)
        static readonly string[] IMPORTANT = { "debtPaid", "gift", "offer", "black", "rescue", "bravo", "newMarket", "kevoGone" };

        public sealed class Cur { public string text; public double shown; public double t; }

        public DomElement el;
        public List<string> queue = new List<string>();
        public Cur cur;
        public double wait;
        public readonly Dictionary<string, double> last = new Dictionary<string, double>();
        public readonly Dictionary<string, List<int>> used = new Dictionary<string, List<int>>();

        public HeroSay()
        {
            // ---------- Qué le hace hablar ----------
            // (en la web se engancha al cargar el archivo: aquí la suscripción va en el constructor, como en Academy y Debt)
            SN.Events.on("debt:paid", (e) => say("debtPaid"));
            SN.Events.on("gift:given", (e) => say("gift"));
            SN.Events.on("offer:prompt", (e) => { if (e["why"] == "new") say("offer"); });
            SN.Events.on("market:unlocked", (e) =>
            {
                V d = SN.Data.marketById(e["market"]);
                if (SN.State.run.truthy && !(SN.Tutorial != null && SN.Tutorial.active)) say(d.truthy && d["black"].truthy ? "black" : "newMarket");
            });
            SN.Events.on("trade:closed", (r) =>
            {
                if (!r.truthy || r["tutorial"].truthy) return;
                double big = JsMath.max(40, (r["amount"] * 0.6).num);
                double pnl = r["pnl"].num;
                if (r["capped"].truthy && pnl > 0) say("cap", V.Obj("chance", 0.6));
                else if (r["liquidated"].truthy || pnl <= -big) say("bigLoss", V.Obj("chance", 0.75));
                else if (pnl >= big) say("bigWin", V.Obj("chance", 0.6));
                else if (pnl < 0) say("loss", V.Obj("chance", 0.15));
            });
            SN.Events.on("luck:day", (e) => say("lucky"));
            SN.Events.on("cipher:found", (e) => { if (e["isNew"].truthy) say("cipher"); });
            SN.Events.on("kevo:writes", (e) => say("kevo", V.Obj("chance", 0.5)));
            SN.Events.on("kevo:done", (e) => { if (e["id"] == "ventana") SN.after(2, () => say("kevoGone")); });
            SN.Events.on("bravo:message", (e) => say("bravo", V.Obj("chance", 0.35)));
            SN.Events.on("academy:open", (e) => say("bravo"));
            SN.Events.on("academy:bought", (e) => say("academy"));
            SN.Events.on("academy:income", (e) => say("income", V.Obj("chance", 0.4)));
            SN.Events.on("shop:new", (e) => say("shopNew", V.Obj("chance", 0.5)));
            SN.Events.on("rescue:done", (e) => SN.after(2.5, () => say("rescue")));
            SN.Events.on("turn:ready", (e) =>
            {
                V run = SN.State.run;
                if (!run.truthy) return;
                if (SN.Desktop != null && SN.Desktop.kevoGone() && !run["finale"].truthy && JsMath.rnd() < 0.06) say("kevoGone");
                else if (run["turn"] == 2 && JsMath.rnd() < 0.15) say("night");
                else if (SN.Debt.active() && SN.Debt.daysLeft() <= 1 && !SN.Debt.canPay() && JsMath.rnd() < 0.4) say("lastDay");
            });
        }

        public void init()
        {
            el = Dom.el("div", "px-font hidden");
            el.id = "hero-say";
            Dom.byId("stage").appendChild(el);
        }

        // Pide un globo. key: suceso de D.story.heroSays (o el texto con { raw: true }). chance: probabilidad.
        public void say(string key, V opts = null)
        {
            opts = opts ?? V.Obj();
            V chance = opts["chance"];
            if (el == null || (!chance.isNullish && JsMath.rnd() > chance.num)) return;
            double now = Dom.now() / 1000;
            if (!opts["raw"].truthy && !Array.Exists(IMPORTANT, (k) => k == key) && last.TryGetValue(key, out double lt) && lt != 0 && now - lt < REPEAT) return;
            string text = opts["raw"].truthy ? key : pick(key);
            if (string.IsNullOrEmpty(text)) return;
            last[key] = now;
            if (Array.Exists(IMPORTANT, (k) => k == key)) queue.Insert(0, text); else queue.Add(text);
            if (queue.Count > 2) queue.RemoveRange(2, queue.Count - 2);
        }

        // Una frase del suceso, sin repetir la última
        public string pick(string key)
        {
            V all = (SN.Data["story"]["heroSays"] || V.Obj())[key];
            if (!all.truthy || !all["length"].truthy) return null;
            JsArray arr = all.arr;
            if (!used.TryGetValue(key, out var usedList)) { usedList = new List<int>(); used[key] = usedList; }
            var pool = new List<int>();
            for (int i = 0; i < arr.length; i++) if (!usedList.Contains(i)) pool.Add(i);
            if (pool.Count == 0)
            {
                usedList = new List<int>();
                used[key] = usedList;
                for (int i = 0; i < arr.length; i++) pool.Add(i);
            }
            V t = arr[pool[(int)Math.Floor(JsMath.rnd() * pool.Count)]];
            usedList.Add(arr.indexOf(t));
            return t.str;
        }

        // ¿Se puede hablar ahora? (nada de globos en cinemáticas, diálogos ni fuera de la partida)
        public bool free()
        {
            return SN.Game.state == "GAMEPLAY" && !SN.Dialog.active && !SN.Cine.running && !SN.Bailout.active && SN.Narrative.hood == null && !SN.Bankruptcy.active;
        }

        public void clear() { queue.Clear(); hide(); }

        public void hide()
        {
            if (cur == null) return;
            cur = null;
            el.classList.add("out");
            SN.after(0.25, () => { if (cur == null) el.classList.add("hidden"); });
        }

        public void update(double dt)
        {
            if (el == null) return;
            wait = JsMath.max(0, wait - dt);
            Cur c = cur;
            if (c != null)
            {
                if (!free()) { hide(); return; }
                // Letra a letra (las palabras clave, con su color) y luego se queda un rato
                if (c.shown < c.text.Length)
                {
                    c.shown = Math.Min(c.text.Length, c.shown + dt * 40);
                    int fl = (int)Math.Floor(c.shown);
                    el.querySelector(".hs-t").innerHTML = SN.KW.html(c.text.Substring(0, fl));
                    if (fl % 3 == 0 && (fl - 1 < 0 || c.text[fl - 1] != ' ')) SN.Audio.sfx("type", V.Obj("voice", "hero"));
                }
                else if ((c.t -= dt) <= 0) { hide(); wait = GAP; }
                return;
            }
            if (queue.Count == 0 || wait > 0 || !free()) return;
            string text = queue[0];
            queue.RemoveAt(0);
            cur = new Cur { text = text, shown = 0, t = Util.clamp(1.8 + text.Length * 0.045, 2.5, 4) };
            el.innerHTML = "<span class=\"hs-t\"></span>";
            el.classList.remove("hidden", "out");
            el.reflow();
            el.classList.add("in");
        }
    }
}
