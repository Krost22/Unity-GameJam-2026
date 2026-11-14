// Cinemáticas (2/2): el bucle (update), el dibujo de los planos (render, renderFace) y lo que se ve en el
// monitor durante la escena del encapuchado (renderScreen). Parte de js/render/cinematic.js (SN.Cine).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Cine
    {
        // Expresiones de las cinemáticas -> expresiones del protagonista
        static readonly Dictionary<string, string> HERO_EXPR = new Dictionary<string, string>
        {
            { "star", "star" }, { "happy", "happy" }, { "confused", "worried" }, { "worried", "nervous" },
            { "relieved", "relieved" }, { "shocked", "shock" }, { "neutral", "calm" }, { "sad", "sad" }, { "cry", "sad" },
        };

        static void R(Ctx2D g, double x, double y, double w, double h, string c) { Px.rect(g, x, y, w, h, c); }

        // ---------- Render ----------
        public void update(double dt)
        {
            t += dt;
            V s = say_;
            if (s.truthy)
            {
                if (s["shown"].num < s["full"].length.num)
                {
                    double before = Math.Floor(s["shown"].num);
                    s["shown"] = JsMath.min(s["full"].length.num, s["shown"].num + dt * 42);
                    if (Math.Floor(s["shown"].num) != before)
                    {
                        renderSubs();
                        if (before % 2 == 0) SN.Audio.sfx("type", V.Obj("voice", s["name"] == SN.Data["story"]["hoodedName"] ? "hood" : "me"));
                    }
                }
                else if (s["auto"].truthy)
                {
                    s["t"] = s["t"] + dt;
                    if (s["t"].num >= s["auto"].num) advance();
                }
            }
            if (shot.truthy)
            {
                V sh = shot;
                sh["t"] = sh["t"] + dt;
                if (sh["zoomTime"].num > 0)
                    sh["zoom"] = Util.lerp(1, sh["zoomTo"].num, Util.ease.inOutSine(JsMath.min(1, sh["t"].num / sh["zoomTime"].num)));
                if (sh["lines"].truthy)
                    foreach (V l in sh["lines"]) l["t"] = l["t"] + dt;
            }
            if (shopCanvas != null && !Dom.byId("webshop").classList.contains("hidden"))
            {
                var cg = shopCanvas.getContext();
                cg.clearRect(0, 0, 130, 120);
                SN.Chars.console(cg, 0, 0, t);
            }
        }

        public void render()
        {
            V sh = shot;
            if (!sh) return;
            var g = this.g;
            if (sh["type"] == "black")
            {
                R(g, 0, 0, 640, 360, "#171814");
                V lines = sh["lines"];
                for (int i = 0; i < lines.length.i; i++)
                {
                    V l = lines[i];
                    int n = (int)JsMath.min(l["text"].length.num, Math.Floor(l["t"].num * 30));
                    Px.text(g, l["text"].str.Substring(0, n), 320, 130 + i * 30, l["color"].str, 16, "center");
                }
                return;
            }
            if (sh["type"] == "face") renderFace(g, sh);
        }

        public void renderFace(Ctx2D g, V sh)
        {
            var b = Px.ctx(buf);
            // Fondo: la habitación vista desde el monitor (pared violeta y persianas con luz)
            R(b, 0, 0, 160, 90, PAL.wall);
            for (int x = 2; x < 160; x += 7) R(b, x, 0, 1, 90, PAL.wallM);
            R(b, 6, 4, 46, 50, PAL.coalD);
            bool night = sh["night"].truthy;
            for (int y = 6; y < 52; y += 4)
            {
                R(b, 8, y, 42, 2, night ? "#45367A" : "#FFA65A");
                R(b, 8, y + 2, 42, 2, night ? "#140E30" : "#9A3488");
            }
            R(b, 118, 30, 42, 3, PAL.woodM); R(b, 122, 18, 5, 12, PAL.coral); R(b, 128, 20, 5, 10, PAL.orange); R(b, 134, 16, 5, 14, PAL.green);
            // De noche la habitación se oscurece, pero la cara queda iluminada por la pantalla
            if (night) { b.globalAlpha = 0.55; R(b, 0, 0, 160, 90, PAL.coalDD); b.globalAlpha = 1; }
            // hoodIn: segundos que tarda la capucha en cubrir la cara (el final A)
            V o = sh["opts"] | V.Obj();
            string expr = HERO_EXPR.TryGetValue(sh["expr"].str, out var heroExpr) ? heroExpr : "worried";
            // (Hero.closeUp recibe las opciones sueltas: fist, hood, tears, question; hood = min(1, t / hoodIn) si hay hoodIn)
            double hood = o["hoodIn"].truthy
                ? JsMath.min(1, sh["t"].num / o["hoodIn"].num)
                : (o["hood"].isNullish ? 0 : o["hood"].num);
            SN.Hero.closeUp(b, expr, sh["t"].num, o["fist"].truthy, hood, o["tears"].truthy, o["question"].truthy);
            if (night) { b.globalAlpha = 0.14; R(b, 0, 0, 160, 90, PAL.coalDD); b.globalAlpha = 1; }
            if (sh["confetti"].truthy)
            {
                double tt = sh["t"].num;
                string[] cols = { PAL.green, PAL.yellow, PAL.coral, PAL.cyan, PAL.orange };
                for (int i = 0; i < 40; i++)
                {
                    double cx = JsMath.mod(i * 37 + tt * (20 + (i % 5) * 6), 160);
                    double cy = JsMath.mod(i * 23 + tt * (30 + (i % 7) * 5), 90);
                    R(b, JsMath.round(cx), JsMath.round(cy), 1, 2, cols[i % 5]);
                }
            }
            double z = (sh["zoom"] | 1).num;
            double sw = 160 / z, shh = 90 / z;
            double sx = 80 - sw / 2, sy = Util.clamp(44 - shh / 2, 0, 90 - shh);
            g.imageSmoothingEnabled = false;
            g.drawImage(buf, sx, sy, sw, shh, 0, 0, 640, 360);
        }

        // Lo que se ve en el monitor durante la escena del encapuchado
        public void renderScreen(Ctx2D g, double dt)
        {
            screenT += dt;
            double tS = screenT;
            R(g, 0, 0, 420, 236, PAL.coalDD);
            g.globalAlpha = screenMode == "static" ? 0.8 : 0.3;
            for (int i = 0; i < 700; i++)
                R(g, Util.randi(0, 419), Util.randi(0, 235), Util.randi(1, 3), 1, Util.pick(V.Arr(PAL.coalL, PAL.creamDD, PAL.creamL, PAL.coal)).str);
            g.globalAlpha = 1;
            if (screenMode != "static")
            {
                hoodA = JsMath.min(1, hoodA + dt * 0.7);
                SN.Chars.hoodBacklight(g, 210, 96, t, hoodA);
                g.globalAlpha = hoodA;
                Canvas img = SN.Chars.hoodedCanvas(t, V.Obj());
                double bob = JsMath.round(JsMath.sin(t * 1.5) * 2);
                g.drawImage(img, 0, 0, 40, 46, 170, 30 + bob, 80, 92);
                g.globalAlpha = 1;
            }
            if (screenMode == "desktop" || screenMode == "open")
            {
                double k = JsMath.min(1, tS / 0.5);
                double bounce = JsMath.round(Math.Abs(JsMath.sin(tS * 5)) * 4 * (1 - JsMath.min(1, tS / 2)));
                double ix = 336, iy = 150 - bounce;
                g.globalAlpha = k;
                g.drawImage(SN.Sprites.get("appBig"), ix, iy, 32, 32);
                R(g, ix - 10, iy + 35, 52, 10, PAL.coal);
                Px.text(g, SN.Cipher.brandText(true), ix + 16, iy + 43, PAL.yellow, 8, "center");
                g.globalAlpha = 1;
            }
            if (screenMode == "open")
            {
                // La ventana de la app se expande desde el icono
                double k2 = Util.ease.outBack(JsMath.min(1, tS / 0.9));
                double w = Util.lerp(32, 420, k2), h = Util.lerp(32, 236, k2);
                double x = Util.lerp(336, 0, k2), y = Util.lerp(150, 0, k2);
                R(g, x, y, w, h, PAL.cream);
                R(g, x, y, w, JsMath.min(h, 11), PAL.coal);
                if (k2 > 0.6) Px.text(g, SN.Cipher.brandText(true), x + 14, y + 9, PAL.yellow);
            }
            // Barrido
            g.globalAlpha = 0.1;
            for (double y2 = JsMath.mod(Math.Floor(tS * 30), 3); y2 < 236; y2 += 3) R(g, 0, y2, 420, 1, PAL.creamL);
            g.globalAlpha = 1;
        }
    }
}
