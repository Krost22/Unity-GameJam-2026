// Port de js/systems/drama.js (SN.Drama): la cámara lenta de los giros inesperados en las últimas velas.
// Tensión (arrastre) -> latigazo -> golpe (congelado, destello, palabra) -> vuelta. Si ya habías cobrado, versión corta.
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Drama
    {
        const double SNAP_P = 0.72;   // debe coincidir con el SNAP de chart.js
        const double SNAP = 0.16, FREEZE = 0.13, AFTER = 0.6;

        public bool active;
        public double p, t;
        public string stage;
        public bool light;

        double t0;
        double crawl;
        Chart chart;
        V candle;
        bool up;
        V dir;
        bool good;
        double nextBeat;

        public void begin(Chart chart, V anim)
        {
            V run = SN.State.run;
            V pos = run.truthy ? run["position"] : V.undefined;
            active = true;
            t = 0; p = 0; t0 = 0;
            stage = "crawl";
            light = !pos.truthy || pos["settled"].truthy;
            crawl = light ? 0.85 : 2.1;
            this.chart = chart;
            candle = chart.tradeCandle(anim["climax"]);
            up = candle["c"].num >= candle["o"].num;
            dir = pos.truthy ? pos["direction"] : (V)1;
            good = (up ? 1 : -1) == dir;
            nextBeat = 0;
            SN.Game?.slowTo(light ? 0.5 : 0.22, 0.25);
            SN.Game?.focusOn(light ? 1.25 : 1.75, light ? 0.5 : 1.3);
            SN.FX.cinema(light ? 0.5 : 1);
            if (!light)
            {
                SN.Audio.duck(true);
                SN.Audio.sfx("riser", V.Obj("dur", crawl + SNAP));
                SN.Hands.drumming = false;
            }
            SN.Events.emit("drama:start", V.Obj("light", light));
        }

        // Has cobrado en plena cámara lenta: ya estás fuera, se ve la versión corta
        public void cashed()
        {
            if (!active || light) return;
            light = true;
            SN.Audio.duck(false);
            SN.FX.cinema(0.5);
            SN.Game?.slowTo(0.5, 0.15);
            hurry();
        }

        // Acelerar durante el arrastre lo acorta (para quien no quiere esperar)
        public void hurry() { if (active && stage == "crawl") crawl = JsMath.min(crawl, t + 0.3); }

        public void update(double dt)
        {
            if (!active) return;
            t += dt;
            if (stage == "crawl")
            {
                p = Util.clamp(t / crawl, 0, 1) * SNAP_P;
                // Latidos cada vez más rápidos
                if (!light && t >= nextBeat)
                {
                    double k = t / crawl;
                    nextBeat = t + Util.lerp(0.62, 0.3, k);
                    SN.Audio.sfx("heart");
                    if (SN.Game != null) SN.Game.pulse = 0.035;
                    SN.FX.vignettePulse = 1;
                }
                if (t >= crawl) { stage = "snap"; t0 = t; SN.Game?.slowTo(1, 0); }
            }
            else if (stage == "snap")
            {
                double k = (t - t0) / SNAP;
                p = SNAP_P + (1 - SNAP_P) * System.Math.Min(1, k);
                if (k >= 1) { p = 1; stage = "freeze"; t0 = t; impact(); }
            }
            else if (stage == "freeze")
            {
                if (t - t0 >= FREEZE) { stage = "after"; t0 = t; SN.Game?.slowTo(0.35, 0); SN.Game?.slowTo(1, AFTER); }
            }
            else if (stage == "after")
            {
                if (t - t0 >= AFTER) end();
            }
        }

        // El golpe: congelado, destello, temblor y palabra. Verde si te favorece, coral si no.
        void impact()
        {
            V pp = chart.lastCandlePos();
            bool big = !light;
            string col = good ? PAL.green : PAL.coral;
            SN.Game?.slowTo(0, 0); // congelado (hit-stop)
            SN.Audio.duck(false);
            SN.Audio.sfx(up ? "boom" : "crash", V.Obj("big", big));
            SN.FX.flash(good ? PAL.yellowL : PAL.coral, big ? 0.28 : 0.16, big ? 0.6 : 0.35);
            SN.Desk.flashGlow(good ? PAL.yellow : PAL.coral, big ? 1.6 : 0.8);
            SN.FX.shake(big ? 6 : 3, big ? 0.5 : 0.25);
            SN.FX.speedLines(pp["x"].num, pp["y"].num, good ? PAL.yellow : PAL.coralL, big ? 0.7 : 0.4);
            SN.FX.ring(pp["x"].num, pp["y"].num, col, big ? 130 : 70, 0.8);
            SN.FX.burst(pp["x"].num, pp["y"].num, n: big ? 40 : 16, colors: new[] { col, good ? PAL.yellow : PAL.coalL, PAL.creamL }, speed: big ? 150 : 90, up: up ? 60 : -20);
            if (up) SN.FX.coins(pp["x"].num, pp["y"].num, big ? 8 : 3, 1.4);
            else SN.FX.cracks(pp["x"].num, pp["y"].num, big ? 7 : 4);
            chart.kick = up ? -5 : 5;
            string word = up ? "¡BOOM!" : "¡CRASH!";
            if (light) word = good ? "¡SE TE ESCAPÓ!" : "¡TE LIBRASTE!";
            SN.FX.word(word, pp["x"].num - (pp["x"].num > 300 ? 30 : 0), pp["y"].num - 18, good ? "gain" : "loss");
            if (big) { if (good) SN.Hands.celebrate(true); else SN.Hands.flinch(true); }
            SN.Events.emit("drama:impact", V.Obj("good", good, "up", up, "light", light));
        }

        void end()
        {
            active = false;
            stage = null;
            SN.Game?.slowTo(1, 0.2);
            SN.Game?.focusOn(0, 0.7);
            SN.FX.cinema(0);
            SN.Audio.duck(false);
            V run = SN.State.run;
            V pos = run.truthy ? run["position"] : V.undefined;
            if (pos.truthy && !pos["settled"].truthy) SN.Hands.drumming = true;
        }

        // Cancela todo de golpe (salir al menú, bancarrota...)
        public void reset()
        {
            if (!active) return;
            active = false;
            stage = null;
            SN.Game?.slowTo(1, 0);
            SN.Game?.focusOn(0, 0.01);
            SN.FX.cinema(0);
            SN.Audio.duck(false);
        }
    }
}
