// Port de js/render/fx.js (SN.FX): efectos arcade dentro del monitor: partículas, monedas que rebotan, confeti,
// ondas, vibración, destellos, interferencias, barras de cine, viñeta, líneas de velocidad, grietas y palabras.
// Lo que toca el DOM (números que saltan, palabras, transform de la pantalla) se hace con Dom igual que en JS.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class FX
    {
        const double FLOOR = 232;
        const double SW = 420, SH = 236;
        static readonly string[] CONFETTI = { PAL.green, PAL.yellow, PAL.coral, PAL.cyan, PAL.orange, PAL.creamL };

        // Una partícula de cualquier tipo (en JS, un objeto con type)
        public sealed class Part
        {
            public string type;
            public double x, y, vx, vy, g, life, max;
            public string color;
            public double size, spin, spinV, ph, w, h, scale, sx, sy, sw, sh;
            public int bounces;
            public Canvas img;
        }
        public sealed class Ring { public double x, y, maxR, life, max; public string color; }
        public sealed class Flash { public string color; public double life, max, alpha; }
        public sealed class Line { public double x, y, a, r, v, len, life, max; public string color; }
        public sealed class Crack { public List<List<(double x, double y)>> paths; public double life, max; }

        public DomElement canvas;
        public Ctx2D g;
        public DomElement floatLayer;
        public DomElement screen;

        public readonly List<Part> parts = new List<Part>();
        public readonly List<Ring> rings = new List<Ring>();
        public readonly List<Flash> flashes = new List<Flash>();
        public readonly List<Line> lines = new List<Line>();
        public readonly List<Crack> cracksList = new List<Crack>();
        public double shakeT, shakePow;
        public double glitchT, glitchPow;
        public double cine, cineTarget, vignettePulse;
        Canvas vignette;

        // Equivale a Math.random()-based pick de U.pick sobre una lista de n elementos
        static int pickI(int n) { return (int)Math.Floor(JsMath.rnd() * n); }

        public void init(DomElement canvas, DomElement floatLayer, DomElement screen)
        {
            this.canvas = canvas;
            this.floatLayer = floatLayer;
            this.screen = screen;
            // Px.ctx(canvas) de la web: getContext('2d') y sin suavizado
            g = canvas.getContext();
            g.imageSmoothingEnabled = false;
        }

        public void clear()
        {
            parts.Clear(); rings.Clear(); flashes.Clear(); lines.Clear(); cracksList.Clear();
            glitchT = 0; cine = cineTarget = 0;
        }

        // Viñeta tramada (se dibuja una vez y se reutiliza con transparencia)
        Canvas buildVignette()
        {
            var c = Px.canvas(SW, SH); var cg = Px.ctx(c);
            for (int y = 0; y < SH; y++)
            {
                for (int x = 0; x < SW; x++)
                {
                    double d = JsMath.min(JsMath.min(x, y), JsMath.min(SW - 1 - x, SH - 1 - y));
                    if (d > 34) continue;
                    double k = 1 - d / 34;
                    if ((x + y) % 2 == 0 && k > 0.15) Px.rect(cg, x, y, 1, 1, PAL.coalDD);
                    else if (k > 0.65) Px.rect(cg, x, y, 1, 1, PAL.coalDD);
                }
            }
            return c;
        }

        public void burst(double x, double y, int n = 12, string[] colors = null, double speed = 70, double up = 30,
            double gravity = 160, double life = 0.7, double size = 2)
        {
            colors = colors ?? new[] { PAL.green };
            for (int i = 0; i < n; i++)
            {
                double a = Util.rand(0, JsMath.PI * 2), s = Util.rand(speed * 0.3, speed);
                var p = new Part { type = "px", x = x, y = y, vx = JsMath.cos(a) * s, vy = JsMath.sin(a) * s - up, g = gravity };
                p.life = Util.rand(life * 0.6, life); p.max = life;
                p.color = colors[pickI(colors.Length)];
                p.size = pickI(2) == 0 ? 1 : size;
                parts.Add(p);
            }
        }

        public void coins(double x, double y, int n = 8, double spread = 1)
        {
            for (int i = 0; i < n; i++)
            {
                var p = new Part { type = "coin", g = 380, bounces = 0 };
                p.x = x + Util.rand(-4, 4); p.y = y;
                p.vx = Util.rand(-60, 60) * spread; p.vy = Util.rand(-150, -80);
                p.life = Util.rand(1.3, 1.9); p.max = 1.9;
                p.spin = Util.rand(0, 4); p.spinV = Util.rand(10, 18);
                parts.Add(p);
            }
        }

        public void confetti(int n = 40)
        {
            for (int i = 0; i < n; i++)
            {
                var p = new Part { type = "conf", g = 30 };
                p.x = Util.rand(10, 410); p.y = Util.rand(-30, -4);
                p.vx = Util.rand(-20, 20); p.vy = Util.rand(30, 80);
                p.life = Util.rand(1.8, 2.8); p.max = 2.8;
                p.color = CONFETTI[pickI(CONFETTI.Length)];
                p.ph = Util.rand(0, 6);
                p.w = pickI(2) == 0 ? 2 : 3;
                p.h = new double[] { 2, 3, 4 }[pickI(3)];
                parts.Add(p);
            }
        }

        public void sparkle(double x, double y, string color = PAL.yellowL)
        {
            var p = new Part { type = "star", x = x, y = y, g = 0, life = 0.5, max = 0.5, color = color };
            p.vx = Util.rand(-6, 6); p.vy = -14;
            parts.Add(p);
        }

        public void shard(Canvas img, double sx, double sy, double sw, double sh, double x, double y, double vx, double vy, double scale = 1)
        {
            parts.Add(new Part { type = "img", img = img, sx = sx, sy = sy, sw = sw, sh = sh, x = x, y = y, vx = vx, vy = vy, g = 420, life = 2.4, max = 2.4, bounces = 0, scale = scale });
        }

        public void ring(double x, double y, string color = PAL.yellow, double maxR = 60, double life = 0.6)
        {
            rings.Add(new Ring { x = x, y = y, color = color, maxR = maxR, life = life, max = life });
        }

        public void flash(string color = "#FFFFFF", double life = 0.18, double alpha = 0.6)
        {
            flashes.Add(new Flash { color = color, life = life, max = life, alpha = alpha });
        }

        public void shake(double power = 3, double time = 0.3)
        {
            shakePow = JsMath.max(shakePow, power);
            shakeT = JsMath.max(shakeT, time);
        }

        public void glitch(double time = 0.5, double power = 1)
        {
            glitchT = JsMath.max(glitchT, time);
            glitchPow = power;
        }

        // Cámara lenta: barras de cine y viñeta (0 = nada, 1 = a tope)
        public void cinema(double k) { cineTarget = k; }

        // Líneas de velocidad que salen del punto del golpe
        public void speedLines(double x, double y, string color = PAL.yellow, double life = 0.6)
        {
            for (int i = 0; i < 22; i++)
            {
                double a = ((double)i / 22) * JsMath.PI * 2 + Util.rand(-0.08, 0.08);
                var l = new Line { x = x, y = y, a = a, color = color, life = life, max = life };
                l.r = Util.rand(10, 30); l.v = Util.rand(260, 420); l.len = Util.rand(14, 34);
                lines.Add(l);
            }
        }

        // Grietas en el cristal del monitor (pérdidas brutales)
        public void cracks(double x, double y, int n = 6)
        {
            var paths = new List<List<(double x, double y)>>();
            for (int i = 0; i < n; i++)
            {
                double ang = ((double)i / n) * JsMath.PI * 2 + Util.rand(-0.3, 0.3);
                var pts = new List<(double x, double y)> { (x, y) };
                for (int s = 0; s < 5; s++)
                {
                    ang += Util.rand(-0.5, 0.5);
                    var last = pts[pts.Count - 1];
                    double px = last.x + JsMath.cos(ang) * Util.rand(10, 22);
                    double py = last.y + JsMath.sin(ang) * Util.rand(8, 18);
                    pts.Add((px, py));
                }
                paths.Add(pts);
            }
            cracksList.Add(new Crack { paths = paths, life = 1.6, max = 1.6 });
        }

        // Número que salta (DOM, fuente pixel). cls: gain | loss | gold, small
        public void floatText(string text, double x, double y, string cls = "gain")
        {
            var el = Dom.el("div", "float " + cls, text);
            el.style["left"] = Js.String(JsMath.round(x)) + "px";
            el.style["top"] = Js.String(JsMath.round(y)) + "px";
            floatLayer.appendChild(el);
            SN.after(1.5, () => el.remove());
        }

        // Palabra enorme de impacto (¡BOOM!, ¡CRASH!...)
        public void word(string text, double x, double y, string cls = "gain")
        {
            var el = Dom.el("div", "boom " + cls, text);
            el.style["left"] = Js.String(JsMath.round(Util.clamp(x, 70, 350))) + "px";
            el.style["top"] = Js.String(JsMath.round(Util.clamp(y, 26, 200))) + "px";
            floatLayer.appendChild(el);
            SN.after(1.4, () => el.remove());
        }

        // Reacciones compuestas a resultados de operaciones
        public void win(double pnl, double x, double y, bool big)
        {
            burst(x, y, n: big ? 30 : 16, colors: new[] { PAL.green, PAL.greenL, PAL.yellow }, speed: big ? 110 : 75);
            coins(x, y, big ? 14 : 6);
            ring(x, y, PAL.green, big ? 90 : 45);
            if (big) { confetti(50); ring(x, y, PAL.yellow, 140, 0.9); flash(PAL.yellowL, 0.2, 0.35); }
        }

        public void loss(double pnl, double x, double y, bool big)
        {
            burst(x, y, n: big ? 26 : 12, colors: new[] { PAL.coral, PAL.coralD, PAL.coalL }, speed: big ? 90 : 55, up: 0, gravity: 220);
            shake(big ? 5 : 2.5, big ? 0.5 : 0.3);
            if (big) { flash(PAL.coral, 0.25, 0.4); ring(x, y, PAL.coral, 70); }
        }

        public void update(double dt, double? realDtOpt = null)
        {
            double realDt = realDtOpt ?? dt;
            for (int i = parts.Count - 1; i >= 0; i--)
            {
                var p = parts[i];
                p.life -= dt;
                if (p.life <= 0) { parts.RemoveAt(i); continue; }
                p.vy += p.g * dt;
                if (p.type == "conf") { p.vx += JsMath.sin(p.ph + p.life * 6) * 60 * dt; p.vx *= 0.96; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                double ph = p.type == "img" ? p.sh * p.scale : 4;
                if ((p.type == "coin" || p.type == "img") && p.y > FLOOR - ph && p.vy > 0)
                {
                    p.y = FLOOR - ph;
                    p.vy *= -0.45; p.vx *= 0.7; p.bounces++;
                    if (p.type == "coin" && p.bounces <= 2) SN.Audio.sfx("coinBounce", V.Obj("quiet", true));
                }
                if (p.type == "coin") p.spin += p.spinV * dt;
            }
            for (int i = rings.Count - 1; i >= 0; i--) { var r = rings[i]; r.life -= dt; if (r.life <= 0) rings.RemoveAt(i); }
            for (int i = flashes.Count - 1; i >= 0; i--) { var f = flashes[i]; f.life -= dt; if (f.life <= 0) flashes.RemoveAt(i); }
            for (int i = lines.Count - 1; i >= 0; i--) { var l = lines[i]; l.life -= dt; l.r += l.v * dt; if (l.life <= 0) lines.RemoveAt(i); }
            for (int i = cracksList.Count - 1; i >= 0; i--) { var c = cracksList[i]; c.life -= dt; if (c.life <= 0) cracksList.RemoveAt(i); }
            // Barras de cine y viñeta: en tiempo real (no se ralentizan con la cámara lenta)
            cine += (cineTarget - cine) * JsMath.min(1, realDt * 5);
            if (Math.Abs(cine - cineTarget) < 0.01) cine = cineTarget;
            vignettePulse = JsMath.max(0, vignettePulse - realDt * 3);
            // Vibración de la pantalla (en píxeles enteros)
            if (shakeT > 0)
            {
                shakeT -= dt;
                double k = JsMath.max(0, shakeT) * 3;
                double s = shakePow * JsMath.min(1, k);
                double tx = JsMath.round(Util.rand(-s, s));
                double ty = JsMath.round(Util.rand(-s, s));
                screen.style["transform"] = "translate(" + Js.String(tx) + "px, " + Js.String(ty) + "px)";
                if (shakeT <= 0) { screen.style["transform"] = ""; shakePow = 0; }
            }
            if (glitchT > 0) glitchT -= dt;
        }

        public void render()
        {
            var cg = g;
            if (cg == null) return;
            cg.clearRect(0, 0, SW, SH);
            // Viñeta y barras de cine (debajo de todo lo demás)
            if (cine > 0.01)
            {
                if (vignette == null) vignette = buildVignette();
                cg.globalAlpha = JsMath.min(1, cine * (0.75 + vignettePulse * 0.25));
                cg.drawImage(vignette, 0, 0);
                cg.globalAlpha = 1;
                double bar = JsMath.round(13 * cine);
                Px.rect(cg, 0, 0, SW, bar, PAL.coalDD);
                Px.rect(cg, 0, SH - bar, SW, bar, PAL.coalDD);
            }
            foreach (var f in flashes)
            {
                cg.globalAlpha = f.alpha * (f.life / f.max);
                Px.rect(cg, 0, 0, SW, SH, f.color);
            }
            cg.globalAlpha = 1;
            foreach (var r in rings)
            {
                double k = 1 - r.life / r.max;
                double rad = JsMath.round(4 + r.maxR * Util.ease.outCubic(k));
                cg.globalAlpha = 1 - k;
                Px.circleOutline(cg, r.x, r.y, rad, r.color);
                if (rad > 6) Px.circleOutline(cg, r.x, r.y, rad - 2, r.color, 2);
            }
            foreach (var l in lines)
            {
                cg.globalAlpha = JsMath.min(1, l.life / l.max * 1.6);
                double x0 = l.x + JsMath.cos(l.a) * l.r, y0 = l.y + JsMath.sin(l.a) * l.r;
                Px.line(cg, x0, y0, x0 + JsMath.cos(l.a) * l.len, y0 + JsMath.sin(l.a) * l.len, l.color);
            }
            foreach (var c in cracksList)
            {
                cg.globalAlpha = JsMath.min(1, c.life / c.max * 2);
                foreach (var pts in c.paths)
                {
                    for (int i = 1; i < pts.Count; i++)
                    {
                        Px.line(cg, pts[i - 1].x, pts[i - 1].y + 1, pts[i].x, pts[i].y + 1, PAL.coalDD);
                        Px.line(cg, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, PAL.creamL);
                    }
                }
            }
            cg.globalAlpha = 1;
            foreach (var p in parts)
            {
                double fade = JsMath.min(1, p.life / (p.max * 0.3));
                cg.globalAlpha = fade;
                double x = JsMath.round(p.x), y = JsMath.round(p.y);
                if (p.type == "px") Px.rect(cg, x, y, p.size, p.size, p.color);
                else if (p.type == "coin") cg.drawImage(SN.Sprites.coinFrame(p.spin), x - 4, y - 4);
                else if (p.type == "conf")
                {
                    bool flip = JsMath.sin(p.ph + p.life * 9) > 0;
                    Px.rect(cg, x, y, flip ? p.w : 1, p.h, p.color);
                }
                else if (p.type == "star")
                {
                    Px.rect(cg, x - 2, y, 5, 1, p.color); Px.rect(cg, x, y - 2, 1, 5, p.color);
                }
                else if (p.type == "img") cg.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, x, y, p.sw * p.scale, p.sh * p.scale);
            }
            cg.globalAlpha = 1;
            // Interferencia: franjas desplazadas, ruido y barras de color de la paleta
            if (glitchT > 0)
            {
                double pow = glitchPow;
                for (int i = 0; i < 6 * pow; i++)
                {
                    double y = Util.randi(0, 230), h = Util.randi(1, 6);
                    cg.globalAlpha = Util.rand(0.25, 0.7);
                    string[] cols = { PAL.coal, PAL.coalDD, PAL.creamL, PAL.coral, PAL.cyan };
                    Px.rect(cg, 0, y, SW, h, cols[pickI(cols.Length)]);
                }
                cg.globalAlpha = 0.5;
                for (int i = 0; i < 160 * pow; i++)
                {
                    double x = Util.randi(0, 419), y = Util.randi(0, 235);
                    string[] cols = { PAL.creamL, PAL.coal };
                    Px.rect(cg, x, y, 1, 1, cols[pickI(cols.Length)]);
                }
                cg.globalAlpha = 1;
            }
        }
    }
}
