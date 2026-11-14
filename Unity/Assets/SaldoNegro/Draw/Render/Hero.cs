// Port de js/render/hero.js (SN.Hero, incluido el gato): el protagonista en pixel art procedural con el kit PK.
// En la partida se ve en primera persona (las manos: una en el teclado, otra en el ratón) y en los primeros
// planos de las cinemáticas (cara, puño). Las piezas se cachean por pose/expresión/hora del día.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Hero
    {
        // Marco del personaje: coordenadas locales = habitación (320x180) desplazada 20 px hacia arriba
        const int FW = 150, FH = 160;
        static readonly string[] SKIN = { PAL.skinDD, PAL.skinD, PAL.skinM, PAL.skin, PAL.skinL };
        static readonly string[] HAIR = { PAL.hairDD, PAL.hairD, PAL.hair, PAL.hairM, PAL.hairL };
        static readonly string[] SHIRT = { PAL.shirtDD, PAL.shirtD, PAL.shirt, PAL.shirtM, PAL.shirtL };
        static readonly string[] TIE = { PAL.tieD, PAL.tieD, PAL.tie, PAL.tieL };
        static readonly string[] MOUSE = { PAL.navyDD, PAL.navyD, PAL.navyM, PAL.navyL, PAL.navyLL };
        static readonly string[] CAT = { PAL.catD, PAL.catD, PAL.cat, PAL.catL, "#56457E" };
        static readonly int[] LIGHT = { 1, -1 };     // la luz principal (monitor) llega desde la derecha y algo de arriba
        static readonly int[] HAND_LIGHT = { 0, -1 }; // la luz del monitor llega desde delante

        // Contraluz de la ventana según la hora (RIM[phase] || RIM.evening)
        static string RimFor(string phase)
        {
            if (phase == "morning") return "#FFEFB8";
            if (phase == "night") return "#FF6FC4";
            return "#FF9A4A";
        }

        static (double x, double y)[] Pts(params double[] v)
        {
            var r = new (double x, double y)[v.Length / 2];
            for (int i = 0; i < r.Length; i++) r[i] = (v[2 * i], v[2 * i + 1]);
            return r;
        }

        // ---------- Geometría (coordenadas locales) ----------
        static readonly (double x, double y)[] FACE = Pts(51, 52, 54, 47, 60, 45, 67, 46, 72, 50, 75, 56, 75, 62, 74, 67, 71, 72, 66, 76, 61, 77, 57, 75, 53, 71, 51, 65, 50, 58);
        // Volumen del pelo (detrás de la cara): elipses x, y, rx, ry
        static readonly double[][] HAIR_VOL = { new double[] { 60, 46, 22, 17 }, new double[] { 46, 56, 11, 14 }, new double[] { 72, 43, 12, 10 }, new double[] { 50, 40, 12, 9 } };
        static readonly (double x, double y)[][] TUFTS =
        {
            Pts(44, 36, 38, 31, 50, 33), Pts(52, 31, 54, 25, 59, 31), Pts(61, 30, 68, 26, 68, 33),
            Pts(71, 34, 79, 34, 76, 40), Pts(78, 42, 86, 46, 79, 48),
            Pts(37, 46, 29, 48, 37, 54), Pts(36, 58, 30, 64, 41, 62), Pts(41, 66, 37, 74, 47, 70), Pts(47, 70, 47, 78, 52, 72),
        };
        static readonly (double x, double y)[][] BANGS =
        {
            Pts(46, 43, 59, 39, 56, 50, 53, 59, 50, 50),
            Pts(55, 41, 70, 41, 66, 49, 62, 56, 59, 48),
            Pts(65, 43, 80, 47, 76, 52, 72, 57, 69, 50),
        };
        // Mechones sueltos (líneas finas)
        static readonly double[][] STRANDS = { new double[] { 52, 44, 55, 55 }, new double[] { 62, 43, 63, 52 }, new double[] { 71, 46, 73, 54 }, new double[] { 44, 50, 41, 60 }, new double[] { 58, 32, 66, 34 } };
        static readonly (double x, double y)[] TORSO = Pts(33, 92, 45, 86, 55, 83, 68, 83, 79, 86, 87, 93, 90, 106, 91, 128, 93, 160, 17, 160, 19, 128, 21, 108, 26, 97);

        // Detalles a mano: ojos, cejas y bocas (una letra = un color)
        static readonly Dictionary<char, string> FPAL = new Dictionary<char, string>
        {
            { 'K', PAL.hairDD }, { 'k', PAL.skinDD }, { 'W', PAL.creamL }, { 'S', "#D6C8E6" }, { 'I', "#3B1E45" }, { 'i', "#7B4D8C" }, { 'H', PAL.white },
            { 'B', PAL.hairD }, { 'm', "#6E2A3C" }, { 'p', PAL.coralL }, { 'r', "#F08A80" }, { 'y', PAL.yellow }, { 'c', PAL.cyanL }, { 'C', PAL.cyan }, { 't', PAL.white },
        };
        static readonly Dictionary<string, (string[] near, string[] far)> EYES = new Dictionary<string, (string[], string[])>
        {
            ["open"] = (new[] { "..KKKKK", ".KKKKKK", "KWWIIIK", ".WWIIHK", ".WWIiIk", "..SIik.", "...kk.." }, new[] { "KKKK.", "KKKKK", "WIIIK", "WIIHK", "WiIIk", ".Iik.", ".kk.." }),
            ["wide"] = (new[] { ".KKKKK.", "KWWWWWK", "KWWWIWK", "KWWWWWK", ".kkkkk." }, new[] { "KKKK.", "KWWWK", "KWIWK", "KWWWK", ".kkk." }),
            ["focus"] = (new[] { ".......", "KKKKKKK", ".WWIIIK", ".WWIIHk", "..SIik.", "...kk.." }, new[] { ".....", "KKKKK", "WIIIK", "WIIHk", ".Iik.", ".kk.." }),
            ["blink"] = (new[] { ".......", ".......", ".......", ".KKKKK.", "..kkk.." }, new[] { ".....", ".....", ".....", "KKKK.", ".kk.." }),
            ["happy"] = (new[] { ".......", ".......", "..KKK..", ".K...K.", "K.....K" }, new[] { ".....", ".....", ".KKK.", "K...K", "....." }),
            ["sad"] = (new[] { ".......", ".......", ".......", "KKKKKK.", "..kkk.." }, new[] { ".....", ".....", ".....", "KKKK.", ".kk.." }),
            ["star"] = (new[] { "..KKKKK", ".KKKKKK", "KWWyWWK", ".WyyyWK", ".WWyWWk", "..WWWk.", "...kk.." }, new[] { "KKKK.", "KKKKK", "WWyWK", "WyyyK", "WWyWk", ".WWk.", ".kk.." }),
        };
        static readonly Dictionary<string, (string[] near, string[] far)> BROWS = new Dictionary<string, (string[], string[])>
        {
            ["worried"] = (new[] { "....BBB", "..BB...", "BB....." }, new[] { "BB...", "..BB.", "....B" }),
            ["calm"] = (new[] { ".BBBBB.", "B.....B" }, new[] { "BBBB.", "....B" }),
            ["focus"] = (new[] { "BB.....", "..BB...", "....BBB" }, new[] { "...BB", ".BB..", "B...." }),
            ["up"] = (new[] { "..BBB..", ".B...B.", "B.....B" }, new[] { ".BBB.", "B...B" }),
        };
        static readonly Dictionary<string, string[]> MOUTHS = new Dictionary<string, string[]>
        {
            ["flat"] = new[] { "mmmm" }, ["worried"] = new[] { ".mmm", "m..." }, ["smile"] = new[] { "m...m", ".mmm." },
            ["grin"] = new[] { "mmmmm", "mtttm", ".mpm." }, ["frown"] = new[] { ".mmm.", "m...m" }, ["open"] = new[] { ".mm.", "mppm", ".mm." },
            ["small"] = new[] { ".mm." },
        };
        // Expresión = ojos + cejas + boca (+ rubor)
        struct Expr { public string eyes, brows, mouth; public bool blush; public Expr(string e, string b, string m, bool bl = false) { eyes = e; brows = b; mouth = m; blush = bl; } }
        static readonly Dictionary<string, Expr> EXPR = new Dictionary<string, Expr>
        {
            ["worried"] = new Expr("open", "worried", "worried"),
            ["calm"] = new Expr("open", "calm", "flat"),
            ["focus"] = new Expr("focus", "focus", "flat"),
            ["nervous"] = new Expr("wide", "worried", "worried"),
            ["happy"] = new Expr("happy", "up", "grin", true),
            ["star"] = new Expr("star", "up", "grin", true),
            ["sad"] = new Expr("sad", "worried", "frown"),
            ["shock"] = new Expr("wide", "up", "open"),
            ["relieved"] = new Expr("happy", "calm", "smile", true),
        };

        // Puño en alto (la intro): cuatro dedos doblados, nudillos arriba, pulgar cruzado
        static readonly string[] FIST =
        {
            ".....kkk.......", ".kkkKsLLkkk....", "KrsLDssLDsLk...", "KrssDsssDsskkk.",
            "KrsmDssmDsmDsLk", "KrmmDsmmDmmDsmk", "KmDDdmDDdmDdmDk", "KrsdddddddDmssk",
            "KrssssssLLdssmk", "KrssmmmmmDdsmDk", "KrmdddddddDmDDk", ".KrmmmDDDDDdK..",
        };
        static readonly (int x, int y) FIST_POS = (7, 52);
        static readonly (double x, double y) SHOULDER = (29, 94), ELBOW = (6, 96), WRIST = (13, 64);

        // Mano de ratón / teclado
        const double FOLLOW = 40; // rapidez con la que la mano alcanza al cursor

        // ---------- Construcción de piezas (con caché) ----------
        readonly Dictionary<string, Canvas> cache = new Dictionary<string, Canvas>();
        readonly Dictionary<string, (Canvas c, (int x, int y) tip)> pointCache = new Dictionary<string, (Canvas, (int, int))>();

        Canvas cached(string key, Func<Canvas> build)
        {
            if (!cache.TryGetValue(key, out var c)) cache[key] = c = build();
            return c;
        }

        static T Pick<T>(T[] a) { return a[(int)Math.Floor(JsMath.rnd() * a.Length)]; }

        // Dedo visto desde arriba: sale del nudillo con un ángulo (grados, 0 = hacia el monitor) y se estrecha.
        // Devuelve la punta redondeada.
        static (int x, int y) finger(PK.Mask m, double kx, double ky, double ang, double len, double r0, double r1)
        {
            double a = ang * Math.PI / 180;
            double tx = kx + JsMath.sin(a) * len, ty = ky - JsMath.cos(a) * len;
            m.taper(kx, ky, r0, tx, ty, r1);
            return ((int)JsMath.round(tx), (int)JsMath.round(ty - r1 + 0.5));
        }

        // Pliegue entre dos dedos: una línea de sombra que se pierde antes de llegar al nudillo
        static void crease((int x, int y) t0, (int x, int y) t1, (double x, double y) k0, (double x, double y) k1, string col, PK.Sprite sp)
        {
            var top = ((t0.x + t1.x) / 2.0, (t0.y + t1.y) / 2.0 + 2);
            var bot = ((k0.x + k1.x) / 2.0, (k0.y + k1.y) / 2.0 - 1);
            int n = (int)Math.Max(1, JsMath.round(JsMath.hypot(bot.Item1 - top.Item1, bot.Item2 - top.Item2) * 0.75));
            for (int i = 0; i <= n; i++)
                sp.px((int)JsMath.round(top.Item1 + (bot.Item1 - top.Item1) * i / n / 1.0), (int)JsMath.round(top.Item2 + (bot.Item2 - top.Item2) * i / n), col);
        }

        // Manga remangada: dos franjas de tela cruzadas al antebrazo, con pliegues
        static void sleeve(PK.Sprite sp, double cx, double cy, double ang, string phase, int rdx, int rdy)
        {
            double a = ang * Math.PI / 180, ux = JsMath.sin(a), uy = JsMath.cos(a); // a lo largo del brazo
            double px = uy, py = -ux;
            (double x, double y)[] P4(double d0, double d1, double w) => Pts(
                cx + ux * d0 - px * w, cy + uy * d0 - py * w, cx + ux * d0 + px * w, cy + uy * d0 + py * w,
                cx + ux * d1 + px * (w + 1), cy + uy * d1 + py * (w + 1), cx + ux * d1 - px * (w + 1), cy + uy * d1 - py * (w + 1));
            var roll = sp.mask().poly(P4(0, 5, 9.5));
            var rest = sp.mask().poly(P4(5, 26, 10.5));
            sp.part(rest, SHIRT, light: HAND_LIGHT, lit: 1, sh: 3);
            sp.part(roll, SHIRT, light: HAND_LIGHT, lit: 2, sh: 2, cast: 1);
            sp.rim(roll, RimFor(phase), rdx, rdy);
            foreach (var (d, w) in new[] { (2.5, 5.0), (8.0, 3.0), (11.0, -4.0) })
            {
                double x0 = cx + ux * d - px * w, y0 = cy + uy * d - py * w;
                sp.line(JsMath.round(x0), JsMath.round(y0), JsMath.round(x0 + px * 3), JsMath.round(y0 + py * 3), PAL.shirtD);
            }
        }

        // ---------- El cuerpo: camisa blanca remangada... (busto de 150x160; cuello, torso, corbata) ----------
        static Canvas buildBody(string phase)
        {
            var sp = new PK.Sprite(FW, FH);
            string rim = RimFor(phase);
            var hairM = sp.mask();
            foreach (var e in HAIR_VOL) hairM.ellipse(e[0], e[1], e[2], e[3]);
            foreach (var t in TUFTS) hairM.poly(t);
            sp.part(hairM, HAIR, light: LIGHT, lit: 4, sh: 4);
            sp.rim(hairM, rim, -1, -1);
            foreach (var l in new[] { new[] { 40, 42, 36, 52 }, new[] { 46, 36, 42, 44 }, new[] { 38, 60, 42, 68 }, new[] { 56, 34, 52, 40 }, new[] { 66, 33, 70, 38 } })
                sp.line(l[0], l[1], l[2], l[3], PAL.hairD);
            var neck = sp.mask().poly(Pts(55, 72, 66, 74, 67, 88, 55, 88));
            sp.part(neck, SKIN, light: LIGHT, baseIdx: 1, outline: false);
            var torso = sp.mask().poly(TORSO);
            sp.part(torso, SHIRT, light: LIGHT, lit: 5, sh: 6);
            // Sombra del lado contrario al monitor y bajo los brazos
            var shade = sp.mask().poly(Pts(19, 112, 32, 104, 40, 118, 42, 160, 17, 160)).keep(torso);
            sp.part(shade, new[] { PAL.shirtDD, PAL.shirtD, PAL.shirtD, PAL.shirt }, light: LIGHT, outline: false, baseIdx: 1, dither: false);
            sp.rim(torso, rim, -1, -1);
            // Pliegues de la camisa
            sp.line(36, 112, 39, 134, PAL.shirtD).line(46, 120, 47, 140, PAL.shirtD).line(82, 106, 80, 128, PAL.shirtD)
                .line(74, 98, 84, 100, PAL.shirtD).line(70, 132, 78, 146, PAL.shirtD);
            var v = sp.mask().poly(Pts(55, 83, 67, 83, 61, 93));
            sp.part(v, SKIN, light: LIGHT, baseIdx: 1, outline: false);
            var collar = sp.mask().poly(Pts(49, 81, 58, 85, 55, 94, 46, 88)).poly(Pts(65, 81, 76, 85, 70, 93, 63, 86));
            sp.part(collar, SHIRT, light: LIGHT, baseIdx: 3, cast: 1);
            // Corbata floja: nudo bajo y hoja algo torcida
            var tie = sp.mask().poly(Pts(58, 89, 65, 89, 64, 95, 59, 95)).poly(Pts(59, 95, 64, 95, 68, 124, 63, 131, 57, 123));
            sp.part(tie, TIE, light: LIGHT, cast: 1);
            sp.line(60, 104, 63, 104, PAL.tieL).line(61, 112, 65, 112, PAL.tieL).line(61, 120, 66, 120, PAL.tieL);
            return sp.canvas;
        }

        // Cara: ojos, cejas, boca y rubor según la expresión (blink: parpadeo)
        static Canvas buildHead(string exprName, bool blink, string phase)
        {
            var sp = new PK.Sprite(FW, FH);
            var ex = EXPR.TryGetValue(exprName, out var e0) ? e0 : EXPR["worried"];
            var face = sp.mask().poly(FACE).ellipse(50.5, 63, 2.6, 4.2);
            sp.part(face, SKIN, light: LIGHT, lit: 4, sh: 3, cast: 2);
            sp.rim(sp.mask().ellipse(50.5, 63, 2.6, 4.2), PAL.skinD, 1, 0);
            // Ojos, cejas y boca
            var eyes = EYES[blink ? "blink" : ex.eyes];
            sp.stamp(eyes.near, 54, 56, FPAL).stamp(eyes.far, 67, 56, FPAL);
            var brows = BROWS[ex.brows];
            sp.stamp(brows.near, 53, 52, FPAL).stamp(brows.far, 67, 52, FPAL);
            // Nariz, pecas y rubor
            sp.px(73, 65, PAL.skinD).px(72, 66, PAL.skinD);
            foreach (var (x, y) in new[] { (56, 67), (58, 68), (57, 69), (70, 67), (71, 68) }) sp.px(x, y, PAL.skinD);
            if (ex.blush) sp.rect(54, 67, 3, 1, FPAL['r']).rect(69, 67, 3, 1, FPAL['r']);
            var mouth = MOUTHS[ex.mouth];
            sp.stamp(mouth, 64 - mouth[0].Length / 2, 71, FPAL);
            return sp.canvas;
        }

        // Flequillo: va encima de la cara y de la mano (los dedos se meten bajo el pelo)
        static Canvas buildBangs(string phase)
        {
            var sp = new PK.Sprite(FW, FH);
            string rim = RimFor(phase);
            foreach (var b in BANGS)
            {
                var m = sp.mask().poly(b);
                sp.part(m, HAIR, light: LIGHT, lit: 3, sh: 2, cast: 2);
                sp.rim(m, rim, -1, -1);
            }
            foreach (var s in STRANDS) sp.line(s[0], s[1], s[2], s[3], PAL.hairD);
            sp.line(60, 42, 66, 42, PAL.hairL).line(70, 45, 74, 46, PAL.hairL);
            return sp.canvas;
        }

        // ---------- Puño en alto (la intro: "¡ES MÍA!") ----------
        static Canvas buildFistArm(double dx, double dy, string phase)
        {
            var sp = new PK.Sprite(FW, FH);
            string rim = RimFor(phase);
            var E = ELBOW;
            var W = (WRIST.x + dx, WRIST.y + dy);
            // Brazo (manga): del hombro al codo
            var upper = sp.mask().capsule(SHOULDER.x, SHOULDER.y, E.x, E.y, 7.2);
            sp.part(upper, SHIRT, light: LIGHT, lit: 4, sh: 3, cast: 1);
            sp.rim(upper, rim, -1, -1);
            sp.line(22, 90, 20, 95, PAL.shirtD).line(15, 91, 14, 96, PAL.shirtD).line(26, 97, 29, 100, PAL.shirtD);
            // Antebrazo: más ancho junto al codo, más fino en la muñeca
            double len = JsMath.hypot(W.Item1 - E.x, W.Item2 - E.y);
            double ux = (W.Item1 - E.x) / len, uy = (W.Item2 - E.y) / len;
            var fore = sp.mask().taper(E.x + ux * 5.5, E.y + uy * 5.5, 5, W.Item1, W.Item2, 3.9);
            sp.part(fore, SKIN, light: LIGHT, lit: 3, sh: 2, cast: 1);
            sp.rim(fore, rim, -1, 0);
            // La manga remangada: una franja de tela cruzada al antebrazo
            double px = -uy, py = ux;
            (double, double)[] at(double d, double w) => new[] { (E.x + ux * d - px * w, E.y + uy * d - py * w), (E.x + ux * d + px * w, E.y + uy * d + py * w) };
            var ab0 = at(0, 6.8); var ab6 = at(6, 6.2);
            var roll = sp.mask().poly(Pts(ab0[0].Item1, ab0[0].Item2, ab0[1].Item1, ab0[1].Item2, ab6[1].Item1, ab6[1].Item2, ab6[0].Item1, ab6[0].Item2));
            sp.part(roll, SHIRT, light: LIGHT, baseIdx: 3, lit: 2, sh: 2, cast: 1);
            sp.rim(roll, rim, -1, -1);
            var f3 = at(3, 4.5);
            sp.line(JsMath.round(f3[0].Item1), JsMath.round(f3[0].Item2), JsMath.round(f3[1].Item1), JsMath.round(f3[1].Item2), PAL.shirt);
            // El puño
            var palFist = new Dictionary<char, string> { { 'K', "#451D35" }, { 'k', "#904353" }, { 'd', PAL.skinDD }, { 'D', PAL.skinD }, { 'm', PAL.skinM }, { 's', PAL.skin }, { 'L', PAL.skinL }, { 'r', rim } };
            sp.stamp(FIST, FIST_POS.x + (int)dx, FIST_POS.y + (int)dy, palFist);
            return sp.canvas;
        }

        struct Pump { public int lift; public int dx, dy; public double snap; }

        // El gesto de "¡sí!" (t en segundos desde que empieza el plano)
        static Pump fistPump(double t)
        {
            const double ENTER = 0.26, SETTLE = 0.14, REST = 0.22, PERIOD = 0.6;
            if (t < ENTER) return new Pump { lift = (int)JsMath.round(JsMath.pow(1 - t / ENTER, 3) * 40) };
            double s = t - ENTER;
            if (s < SETTLE) return new Pump { dy = s < SETTLE / 2 ? -2 : -1, snap = 1 - s / SETTLE };
            if (s < SETTLE + REST) return new Pump();
            double p = (s - SETTLE - REST) % PERIOD;
            int dy = 0; double snap = 0;
            if (p < 0.14) dy = (int)JsMath.round(3 * (p / 0.14) * (p / 0.14));  // baja (cada vez más rápido)
            else if (p < 0.2) { dy = -1; snap = 1; }                             // ¡arriba!
            else if (p < 0.3) { dy = 0; snap = 1 - (p - 0.2) / 0.1; }
            return new Pump { dx = dy >= 2 ? -1 : 0, dy = dy, snap = snap };
        }

        // ---------- Manos en primera persona ----------
        // Mano derecha sobre el ratón (sprite 64x64; el centro del ratón en (24, 12)).
        static Canvas buildMouse()
        {
            var sp = new PK.Sprite(64, 64);
            sp.part(sp.mask().ellipse(24, 13, 8, 12), MOUSE, light: HAND_LIGHT, lit: 2);
            sp.line(24, 2, 24, 9, PAL.navyDD).rect(23, 4, 3, 3, PAL.navyLL).px(24, 5, PAL.cyan);
            return sp.canvas;
        }

        static Canvas buildMouseHand(int pressed, string phase)
        {
            var sp = new PK.Sprite(64, 64);
            string rim = RimFor(phase);
            int p = pressed;
            var mouse = sp.mask().ellipse(24, 13, 8, 12);
            sp.part(mouse, MOUSE, light: HAND_LIGHT, lit: 2);
            sp.line(24, 2, 24, 9, PAL.navyDD).rect(23, 4, 3, 3, PAL.navyLL).px(24, 5, PAL.cyan);
            // Antebrazo + dorso + dedos en una sola silueta
            var hand = sp.mask()
                .taper(26, 31, 6, 33, 46, 7)
                .poly(Pts(16, 19, 19, 16, 24, 15, 29, 16, 33, 19, 34, 24, 32, 30, 28, 34, 21, 34, 17, 29))
                .taper(18.5, 28, 3, 16, 23.5, 2.1); // pulgar
            var K = Pts(20, 17, 24.5, 16, 28.5, 17.5, 32, 20);
            var tips = new (int x, int y)[4];
            tips[0] = finger(hand, K[0].x, K[0].y, -5, 6.5 - p, 2.2, 1.9);
            tips[1] = finger(hand, K[1].x, K[1].y, 1, 7, 2.3, 1.9);
            tips[2] = finger(hand, K[2].x, K[2].y, 12, 5, 2.1, 1.8);
            tips[3] = finger(hand, K[3].x, K[3].y, 30, 3, 1.9, 1.6);
            sp.part(hand, SKIN, light: HAND_LIGHT, hi: 1, lit: 3, sh: 3, cast: 1);
            for (int i = 0; i < 3; i++) crease(tips[i], tips[i + 1], K[i], K[i + 1], PAL.skinD, sp);
            // Uñas
            sp.px(tips[0].x, tips[0].y + 1, PAL.skinL).px(tips[1].x, tips[1].y + 1, PAL.skinL);
            // Nudillos y tendones
            sp.px(20, 18, PAL.skinL).px(25, 17, PAL.skinL);
            sp.line(22, 22, 23, 27, PAL.skinM).line(26, 22, 26, 26, PAL.skinM);
            sleeve(sp, 33, 38, -28, phase, 1, 0);
            // Pliegue suave entre el pulgar y la palma, y la uña del pulgar
            sp.px(18, 25, PAL.skinM).px(19, 26, PAL.skinM);
            sp.px(15, 22, PAL.skinL);
            sp.rim(hand, rim, 1, 0);
            return sp.canvas;
        }

        // Mano derecha señalando con el índice (rescate, js/render/bailout.js). Devuelve el lienzo y la punta.
        static (Canvas c, (int x, int y) tip) buildPointHand(string phase)
        {
            var sp = new PK.Sprite(64, 64);
            string rim = RimFor(phase);
            var hand = sp.mask()
                .taper(26, 31, 6, 33, 46, 7)
                .poly(Pts(16, 19, 19, 16, 24, 15, 29, 16, 33, 19, 34, 24, 32, 30, 28, 34, 21, 34, 17, 29))
                .taper(18.5, 28, 3, 22, 22.5, 2.1); // pulgar: recogido hacia dentro
            var K = Pts(20, 17, 24.5, 16, 28.5, 17.5, 32, 20);
            var tips = new (int x, int y)[4];
            tips[0] = finger(hand, K[0].x, K[0].y, -3, 8, 2.2, 1.9); // índice estirado
            tips[1] = finger(hand, K[1].x, K[1].y, 4, 2.2, 2.3, 2.1);
            tips[2] = finger(hand, K[2].x, K[2].y, 14, 2, 2.1, 2);
            tips[3] = finger(hand, K[3].x, K[3].y, 30, 1.6, 1.9, 1.8);
            sp.part(hand, SKIN, light: HAND_LIGHT, hi: 1, lit: 3, sh: 3, cast: 1);
            for (int i = 1; i < 3; i++) sp.px((int)JsMath.round((K[i].x + K[i + 1].x) / 2), (int)JsMath.round((K[i].y + K[i + 1].y) / 2) - 1, PAL.skinD);
            sp.line(22, 19, 23, 21, PAL.skinD);
            sp.px(tips[0].x, tips[0].y + 1, PAL.skinL).px(tips[0].x, tips[0].y + 2, PAL.skinL);
            sp.px(25, 17, PAL.skinL).px(29, 18, PAL.skinL);
            sp.line(22, 24, 23, 28, PAL.skinM).line(26, 23, 26, 27, PAL.skinM);
            sleeve(sp, 33, 38, -28, phase, 1, 0);
            sp.px(21, 23, PAL.skinL);
            sp.rim(hand, rim, 1, 0);
            return (sp.canvas, tips[0]);
        }

        // Mano izquierda sobre el teclado (sprite 64x64). mask: bit i = dedo i pulsado (0 meñique ... 3 índice)
        static Canvas buildKeyHand(int mask, bool clench, string phase)
        {
            var sp = new PK.Sprite(64, 64);
            string rim = RimFor(phase);
            var hand = sp.mask()
                .taper(21, 27, 6, 13, 42, 7)
                .poly(Pts(8, 20, 12, 15, 19, 12, 26, 13, 30, 17, 30, 23, 27, 29, 16, 30, 10, 26))
                .taper(26.5, 25, 3, 31.5, 23.5, 2.1); // pulgar
            var K = Pts(10.5, 18, 15.5, 14.5, 21, 13, 26, 14);
            double[] ANG = { -16, -7, 0, 7 }, LEN = { 4.5, 6, 7, 6 }, R0 = { 1.9, 2.3, 2.4, 2.3 }, R1 = { 1.6, 1.9, 2, 1.9 };
            var tips = new (int x, int y)[4];
            for (int i = 0; i < 4; i++)
            {
                int down = (mask >> i) & 1;
                // El dedo que pulsa se dobla hacia la tecla (más corto)
                double len = clench ? 2 : LEN[i] - down * 3.2;
                tips[i] = finger(hand, K[i].x, K[i].y, ANG[i], len, R0[i], R1[i]);
            }
            sp.part(hand, SKIN, light: HAND_LIGHT, hi: 1, lit: 3, sh: 3, cast: 1);
            if (!clench) for (int i = 0; i < 3; i++) crease(tips[i], tips[i + 1], K[i], K[i + 1], PAL.skinD, sp);
            else for (int i = 0; i < 3; i++) sp.px((int)JsMath.round((K[i].x + K[i + 1].x) / 2), (int)JsMath.round((K[i].y + K[i + 1].y) / 2) - 2, PAL.skinD);
            // Las puntas que no pulsan reciben la luz del monitor
            for (int i = 0; i < 4; i++) if (!clench && ((mask >> i) & 1) == 0) sp.px(tips[i].x, tips[i].y + 1, PAL.skinL);
            sp.px(21, 15, PAL.skinL).px(26, 16, PAL.skinL);
            sp.line(19, 19, 18, 25, PAL.skinM).line(23, 19, 22, 24, PAL.skinM);
            sleeve(sp, 14, 37, 26, phase, -1, 0);
            // Pliegue suave entre el pulgar y el índice, y la uña del pulgar
            sp.px(27, 22, PAL.skinM).px(28, 22, PAL.skinM);
            sp.px(32, 22, PAL.skinL);
            sp.rim(hand, rim, -1, 0);
            return sp.canvas;
        }

        // ---------- El gato (64x34, sobre la mesa) ----------
        const int CW = 64, CH = 34;
        static Canvas buildCat(string state, int breath, double tail, string phase, int look = 0)
        {
            var sp = new PK.Sprite(CW, CH);
            string rim = RimFor(phase);
            if (state == "sit" || state == "arch" || state == "alert" || state == "stare") return buildCatUp(sp, state, breath, tail, rim, look);
            bool lying = state == "sleep" || state == "ear" || state == "purr" || state == "peek";
            int up = lying ? 0 : -2;
            bool st = state == "stretch";
            // Cola: rodeando el cuerpo (o tendida hacia atrás al desperezarse)
            var tailM = st
                ? sp.mask().capsule(12, 26, 6, 30, 2.5).capsule(6, 30, 2, 28 - (tail > 1 ? 1 : 0), 2.3)
                : sp.mask().capsule(10, 22, 7, 27, 2.6).capsule(7, 27, 16, 30, 2.6).capsule(16, 30, 32 + tail, 30 - (tail > 1 ? 1 : 0), 2.4);
            sp.part(tailM, CAT, light: LIGHT);
            // Cuerpo: al estirarse, más largo y bajo
            var body = st ? sp.mask().ellipse(30, 23, 21, 8).ellipse(21, 21, 11, 8.5) : sp.mask().ellipse(31, 21, 19, 10 + breath * 0.6);
            sp.part(body, CAT, light: LIGHT, lit: 3, sh: 3);
            sp.rim(body, rim, -1, -1);
            // Cabeza a la derecha
            int hx = st ? 50 : 49, hy = st ? 22 : 21 + up;
            var earL = state == "ear" || state == "groom"
                ? Pts(41, hy - 3, 41, hy - 9, 47, hy - 6)
                : Pts(hx - 8, hy - 4, hx - 6, hy - 13, hx - 1, hy - 6);
            var head = sp.mask().ellipse(hx, hy, 9, 7.5).poly(earL).poly(Pts(hx + 1, hy - 6, hx + 7, hy - 13, hx + 8, hy - 3));
            sp.part(head, CAT, light: LIGHT, lit: 2, cast: 1);
            sp.rim(head, rim, -1, -1);
            if (state != "ear" && state != "groom") sp.px(hx - 3, hy - 9, PAL.catPink);
            sp.px(hx + 5, hy - 9, PAL.catPink);
            // Patas
            var paws = st ? sp.mask().ellipse(57, 30, 5, 2.2).ellipse(59, 28, 4, 2)
                : state == "groom" ? sp.mask().ellipse(44, 28, 5, 2.4).ellipse(hx + 2, hy + 4, 3, 3.4)
                : sp.mask().ellipse(44, 28, 5, 2.4).ellipse(53, 28, 4, 2.2);
            sp.part(paws, CAT, light: LIGHT, baseIdx: 3);
            // Cara
            int eyeY = hy - 1, ex = hx - 4;
            void closed(int y) { sp.rect(ex, y, 3, 1, PAL.catL).rect(ex + 7, y, 3, 1, PAL.catL); }
            if (state == "sleep" || state == "ear" || state == "stretch") closed(eyeY);
            else if (state == "purr" || state == "yawn" || state == "groom")
            {
                // Ojos felices (^ ^)
                sp.px(ex, eyeY, PAL.catL).px(ex + 1, eyeY - 1, PAL.catL).px(ex + 2, eyeY, PAL.catL);
                sp.px(ex + 7, eyeY, PAL.catL).px(ex + 8, eyeY - 1, PAL.catL).px(ex + 9, eyeY, PAL.catL);
            }
            else if (state == "peek") { sp.rect(ex, eyeY, 3, 1, PAL.catL).rect(ex + 7, eyeY - 1, 3, 2, PAL.catEye).px(ex + 8, eyeY - 1, PAL.catD); }
            else
            {
                int lx = (int)Util.clamp(JsMath.round(look), -1, 1);
                sp.rect(ex, eyeY - 1, 3, 2, PAL.catEye).rect(ex + 7, eyeY - 1, 3, 2, PAL.catEye).px(ex + 1 + lx, eyeY - 1, PAL.catD).px(ex + 8 + lx, eyeY - 1, PAL.catD);
            }
            if (state == "yawn") { sp.rect(hx - 1, hy + 2, 4, 3, PAL.catD).rect(hx, hy + 3, 2, 2, PAL.catPink); }
            else sp.px(hx, eyeY + 3, PAL.catPink).px(hx + 1, eyeY + 3, PAL.catPink);
            return sp.canvas;
        }

        // El gato de pie: sentado mirando el ratón, erizado (lomo arqueado) o alerta mirando a la ventana
        static Canvas buildCatUp(PK.Sprite sp, string state, int breath, double tail, string rim, int look)
        {
            bool arch = state == "arch", alert = state == "alert";
            if (arch)
            {
                // Cola en alto y erizada
                var tailM = sp.mask().capsule(14, 20, 8, 8, 2.8).capsule(8, 8, 10, 2, 2.6);
                sp.part(tailM, CAT, light: LIGHT);
                for (int i = 0; i < 5; i++) sp.px(6 + (i % 2) * 5, 3 + i * 3, PAL.catD);
                // Lomo arqueado, patas rectas
                var body = sp.mask().ellipse(30, 17, 17, 9).rect(16, 20, 4, 12).rect(24, 21, 4, 11).rect(36, 21, 4, 11).rect(43, 20, 4, 12);
                sp.part(body, CAT, light: LIGHT, lit: 3, sh: 3);
                sp.rim(body, rim, -1, -1);
                for (int x = 18; x < 44; x += 3) sp.px(x, 7 + (int)JsMath.round(Math.Abs(x - 30) / 5.0), PAL.catD);
                int hx = 52, hy = 18;
                var head = sp.mask().ellipse(hx, hy, 8, 7).poly(Pts(hx - 7, hy - 3, hx - 9, hy - 10, hx - 2, hy - 6)).poly(Pts(hx + 2, hy - 6, hx + 8, hy - 11, hx + 8, hy - 2));
                sp.part(head, CAT, light: LIGHT, lit: 2, cast: 1);
                sp.rim(head, rim, -1, -1);
                sp.rect(hx - 5, hy - 2, 3, 3, PAL.catEye).rect(hx + 2, hy - 2, 3, 3, PAL.catEye).px(hx - 4, hy - 1, PAL.catD).px(hx + 3, hy - 1, PAL.catD);
                sp.rect(hx - 1, hy + 2, 4, 3, PAL.catD).px(hx, hy + 2, PAL.white).px(hx + 2, hy + 2, PAL.white);
                return sp.canvas;
            }
            // Sentado: cola enroscada en las patas
            var tailS = sp.mask().capsule(44, 31, 54, 31, 2.4).capsule(54, 31, 57 + tail, 25, 2.2);
            sp.part(tailS, CAT, light: LIGHT);
            var bodyS = sp.mask().ellipse(38, 23 - breath * 0.4, 11, 10).ellipse(38, 28, 12, 6);
            sp.part(bodyS, CAT, light: LIGHT, lit: 3, sh: 3);
            sp.rim(bodyS, rim, -1, -1);
            var paws = sp.mask().ellipse(34, 32, 3, 1.6).ellipse(42, 32, 3, 1.6);
            sp.part(paws, CAT, light: LIGHT, baseIdx: 3);
            // Cabeza (girada hacia la ventana si está alerta)
            int hxS = alert ? 34 : 38 + (int)JsMath.round(look), hyS = 10;
            bool earsBack = alert;
            var headS = sp.mask().ellipse(hxS, hyS, 8.5, 7)
                .poly(earsBack ? Pts(hxS - 8, hyS - 2, hxS - 12, hyS - 7, hxS - 4, hyS - 5) : Pts(hxS - 7, hyS - 3, hxS - 6, hyS - 11, hxS - 1, hyS - 6))
                .poly(earsBack ? Pts(hxS + 4, hyS - 5, hxS + 11, hyS - 8, hxS + 8, hyS - 1) : Pts(hxS + 1, hyS - 6, hxS + 6, hyS - 11, hxS + 7, hyS - 3));
            sp.part(headS, CAT, light: LIGHT, lit: 2, cast: 1);
            sp.rim(headS, rim, -1, -1);
            if (!earsBack) sp.px(hxS - 5, hyS - 8, PAL.catPink).px(hxS + 4, hyS - 8, PAL.catPink);
            int lxS = alert ? -1 : (int)Util.clamp(JsMath.round(look), -1, 1);
            // Mirando a cámara (el final): ojos muy abiertos con las pupilas en rendija
            if (state == "stare") sp.rect(hxS - 5, hyS - 2, 3, 3, PAL.catEye).rect(hxS + 2, hyS - 2, 3, 3, PAL.catEye).rect(hxS - 4, hyS - 2, 1, 3, PAL.catD).rect(hxS + 3, hyS - 2, 1, 3, PAL.catD);
            else sp.rect(hxS - 5, hyS - 1, 3, 2, PAL.catEye).rect(hxS + 2, hyS - 1, 3, 2, PAL.catEye).px(hxS - 4 + lxS, hyS - 1, PAL.catD).px(hxS + 3 + lxS, hyS - 1, PAL.catD);
            sp.px(hxS - 1, hyS + 2, PAL.catPink).px(hxS, hyS + 2, PAL.catPink);
            return sp.canvas;
        }

        // Corazón de 5x4 (el gato ronronea)
        static void heart(Ctx2D g, double x, double y, string c)
        {
            Px.rect(g, x, y, 2, 1, c); Px.rect(g, x + 3, y, 2, 1, c); Px.rect(g, x, y + 1, 5, 1, c);
            Px.rect(g, x + 1, y + 2, 3, 1, c); Px.rect(g, x + 2, y + 3, 1, 1, c);
        }

        // ---------- Estado y animación ----------
        public sealed class React { public string kind; public double t; }
        public sealed class CatState
        {
            public string state = "sleep", act, fx;
            public double t, tail, tailT = 3, wakeT, actT, idleT = 9, fxT, hoodT;
        }
        public sealed class Mouse { public double x, y, tx, ty; }
        public struct Mood { public string expr, pose; }

        public double t;
        public string expr = "worried", pose = "chin";
        public React react;                  // reacción temporal (celebrar, lamentarse...)
        public double blinkT = 2.5, blinking;
        public readonly Mouse mouse = new Mouse();
        public readonly double[] fingers = new double[4];
        public double idleT = 2, drumT, shake, click, sweat;
        public double bounceY, bounceV;
        public readonly CatState cat = new CatState();

        // El cursor sobre el monitor mueve un poco el ratón de la mesa
        public void pointAt(double sx, double sy)
        {
            V S = SN.SCREEN;
            double Sx = S["x"].num, Sy = S["y"].num, Sw = S["w"].num, Sh = S["h"].num;
            mouse.tx = Util.clamp((sx - (Sx + Sw / 2)) / (Sw / 2), -1.2, 1.2) * 11;
            mouse.ty = Util.clamp((sy - (Sy + Sh / 2)) / (Sh / 2), -1.2, 1.2) * 5;
        }
        public void press() { click = 0.14; }

        // Ganar mucho: el gato ronronea (corazones); perder mucho: se eriza y bufa
        public void celebrate(bool big)
        {
            react = new React { kind = big ? "bigwin" : "win", t = big ? 2.2 : 1.5 };
            bounceV = big ? -70 : -50;
            if (big) catDo("purr", 2.6, "heart");
        }
        public void flinch(bool big)
        {
            react = new React { kind = big ? "bigloss" : "loss", t = big ? 2.2 : 1.4 };
            bounceV = 34; shake = big ? 0.5 : 0.3;
            if (big) catDo("arch", 2, "hiss");
        }

        // Levanta un dedo un momento (i: cuál, 0-3; sin i, uno al azar)
        public void tapFinger(int? i)
        {
            int k = i ?? (int)Math.Floor(JsMath.rnd() * 4);
            fingers[k] = 0.12;
        }
        public void relief() { react = new React { kind = "relief", t = 2.4 }; }
        public void wakeCat(double sec) { catDo("awake", sec, null); }

        // El gato hace algo durante `sec` segundos (y luego vuelve a dormir)
        public void catDo(string state, double sec, string fx = null)
        {
            var c = cat;
            c.act = state; c.actT = sec; c.state = state;
            if (fx != null) { c.fx = fx; c.fxT = JsMath.min(sec, 2.4); }
            if (state == "awake" || state == "sit" || state == "groom" || state == "arch" || state == "alert" || state == "stare") c.wakeT = sec;
        }

        // Clic en el gato: dormido, mueve la oreja y ronronea; despierto, ronronea
        public void petCat()
        {
            var c = cat;
            if (c.state == "sleep" || c.state == "ear") catDo("ear", 0.6, "prr");
            else { c.fx = "heart"; c.fxT = 1.6; }
        }

        // Expresión y pose según lo que pasa en el juego
        public Mood mood()
        {
            V run = SN.State.run;
            var r = react;
            if (r != null)
            {
                if (r.kind == "bigwin") return new Mood { expr = "star", pose = "fist" };
                if (r.kind == "win") return new Mood { expr = "happy", pose = "fist" };
                if (r.kind == "bigloss") return new Mood { expr = "shock", pose = "head" };
                if (r.kind == "loss") return new Mood { expr = "sad", pose = "facepalm" };
                if (r.kind == "relief") return new Mood { expr = "relieved", pose = "desk" };
            }
            if (SN.Drama != null && SN.Drama.active && !SN.Drama.light) return new Mood { expr = "nervous", pose = "head" };
            V pos = run.truthy ? run["position"] : V.undefined;
            if (run.truthy && pos.truthy && !pos["settled"].truthy)
            {
                V anim = SN.Chart != null ? SN.Chart.anim : V.undefined;
                bool danger = anim.truthy && anim["revealed"].num >= pos["total"].num - SN.Data["sim"]["dangerCandles"].num;
                return danger ? new Mood { expr = "nervous", pose = "head" } : new Mood { expr = "focus", pose = "desk" };
            }
            if (run.truthy && !SN.Debt.active()) return new Mood { expr = "calm", pose = "chin" };
            return new Mood { expr = "worried", pose = "chin" };
        }

        // La mano del ratón sigue al cursor real con el tiempo real (no con el del mundo)
        public void follow(double dt)
        {
            double k = 1 - JsMath.exp(-dt * FOLLOW);
            mouse.x += (mouse.tx - mouse.x) * k;
            mouse.y += (mouse.ty - mouse.y) * k;
        }

        public void update(double dt)
        {
            t += dt;
            click = JsMath.max(0, click - dt);
            if (react != null) { react.t -= dt; if (react.t <= 0) react = null; }
            shake = JsMath.max(0, shake - dt);
            for (int i = 0; i < 4; i++) fingers[i] = JsMath.max(0, fingers[i] - dt);
            // Dedos: tamborilean durante una operación y, en reposo, se mueven de vez en cuando
            V run = SN.State.run;
            bool trading = run.truthy && run["position"].truthy && !run["position"]["settled"].truthy;
            if (trading)
            {
                if ((drumT -= dt) <= 0) { drumT = 0.11; fingers[(int)Math.Floor(t * 9) % 4] = 0.09; }
            }
            else if ((idleT -= dt) <= 0) { idleT = Util.rand(2.5, 6); tapFinger(null); }
            // Rebote (resorte)
            bounceV += (-bounceY * 220 - bounceV * 12) * dt;
            bounceY += bounceV * dt;
            // Parpadeo cada pocos segundos
            if (blinking > 0) blinking -= dt;
            else if ((blinkT -= dt) <= 0) { blinking = 0.13; blinkT = Util.rand(2.2, 5); }
            var md = mood();
            sweat = md.expr == "nervous" || md.expr == "shock" ? JsMath.min(1, sweat + dt * 2) : JsMath.max(0, sweat - dt);
            // Gato: duerme casi siempre, pero de vez en cuando hace algo
            var c = cat;
            c.t += dt;
            c.fxT = JsMath.max(0, c.fxT - dt);
            if (c.hoodT > 0) c.hoodT = JsMath.max(0, c.hoodT - dt);
            if (c.act != null && (c.actT -= dt) <= 0) { c.act = null; c.state = "sleep"; c.wakeT = 0; }
            if (c.wakeT > 0 && (c.wakeT -= dt) <= 0 && c.act == null) c.state = "sleep";
            bool drama = SN.Drama != null && SN.Drama.active;
            // Alguien en la azotea: lo mira con las orejas hacia atrás
            bool hooded = SN.Desk != null && SN.Desk.windowEvents.Contains("encapuchado");
            if (hooded && c.act != "alert" && c.act != "arch") catDo("alert", 2, null);
            if (c.act == null)
            {
                if (c.state == "sleep" && drama) c.state = "peek";
                if (c.state == "peek" && !drama && c.wakeT <= 0) c.state = "sleep";
                // Cosas de gato cuando nadie le hace caso
                if (c.state == "sleep" && !drama && (c.idleT -= dt) <= 0)
                {
                    c.idleT = Util.rand(8, 18);
                    bool lucky = run.truthy && SN.Luck.today().truthy;
                    string pick = Pick(new[] { "ear", "ear", "yawn", "peek", "sit", "purr" });
                    double dur = pick == "ear" ? 0.5 : pick == "yawn" ? 1.4 : pick == "peek" ? 2.5 : pick == "sit" ? 5 : 3;
                    catDo(pick, dur, lucky ? "gold" : pick == "purr" ? "prr" : null);
                }
            }
            if ((c.tailT -= dt) <= 0)
            {
                // Despierto mueve la cola más a menudo
                bool awake = c.state != "sleep" && c.state != "ear" && c.state != "purr";
                c.tail = c.tail != 0 ? 0 : 2;
                c.tailT = c.tail != 0 ? 0.35 : awake ? Util.rand(0.5, 1.5) : Util.rand(2, 6);
            }
        }

        // Manos en primera persona (g = lienzo de 320x180): teclado en (kx, ky), ratón en (mx, my)
        public void drawHands(Ctx2D g, string phase, double kx, double ky, double mx, double my)
        {
            if (SN.Desk.handsOff) { g.drawImage(mouseOnly(), mx - 24, my - 13); return; }
            var md = mood();
            int by = (int)JsMath.round(bounceY);
            bool nervous = md.expr == "nervous" || md.expr == "shock";
            int sx = shake > 0 ? (int)JsMath.round(JsMath.sin(t * 70) * 2) : nervous && JsMath.sin(t * 40) > 0.6 ? 1 : 0;
            bool clench = (SN.Drama != null && SN.Drama.active && !SN.Drama.light) || md.expr == "shock";
            int mask = 0;
            for (int i = 0; i < 4; i++) if (fingers[i] > 0) mask |= 1 << i;
            var keyHand = cached("khand|" + (clench ? "c" : mask.ToString()) + "|" + phase, () => buildKeyHand(mask, clench, phase));
            int pr = click > 0 ? 1 : 0;
            var mouseHand = cached("mhand|" + pr + "|" + phase, () => buildMouseHand(pr, phase));
            // Celebrar: la mano del teclado salta; perder: respingo; al pulsar, baja un píxel
            int lift = md.expr == "star" || md.expr == "happy" ? -2 : mask != 0 ? 1 : 0;
            g.drawImage(keyHand, kx - 21 + sx, ky - 14 + by + lift);
            // El reloj RÓLEZ (objeto clave): en la muñeca izquierda, brillando
            V run = SN.State.run;
            if (run.truthy && run["owned"]["reloj"].truthy && !(SN.Desk.stripped != null && SN.Desk.stripped.Contains("reloj")))
            {
                double wx = kx - 21 + sx + 17, wy = ky - 14 + by + lift + 31;
                Px.line(g, wx - 3, wy - 2, wx + 4, wy + 2, PAL.yellowD, 2);
                Px.rect(g, wx, wy - 1, 2, 2, PAL.yellowL);
                if (JsMath.sin(t * 3) > 0.7) Px.rect(g, wx + 1, wy - 2, 1, 1, PAL.white);
            }
            g.drawImage(mouseHand, JsMath.round(mx + mouse.x) - 24 + sx, JsMath.round(my + mouse.y) - 13 + by);
        }

        public void drawCat(Ctx2D g, double x, double y, string phase)
        {
            var c = cat;
            int breath = JsMath.sin(c.t * (c.state == "purr" ? 3.2 : 1.6)) > 0 ? 1 : 0;
            // Sentado o despierto, los ojos siguen al ratón
            double look = c.state == "sit" || c.state == "awake" ? Util.clamp(mouse.x / 8, -1, 1) : 0;
            int lk = (int)JsMath.round(look);
            var img = cached("cat|" + c.state + "|" + breath + "|" + Js.String(c.tail) + "|" + phase + "|" + lk, () => buildCat(c.state, breath, c.tail, phase, lk));
            g.drawImage(img, x, y);
            // Zzz mientras duerme
            if (c.state == "sleep" || c.state == "ear")
            {
                double k = (c.t * 0.5) % 1;
                g.globalAlpha = JsMath.sin(k * Math.PI);
                Px.text(g, "z", x + 56 + JsMath.round(k * 4), y + 8 - JsMath.round(k * 10), PAL.creamD);
                g.globalAlpha = 1;
            }
            // Efectos encima: corazones, "prr", bufido, destellos dorados
            if (c.fxT > 0 && c.fx != null)
            {
                double k = 1 - c.fxT / 2.4, a = JsMath.min(1, c.fxT * 2);
                g.globalAlpha = a;
                if (c.fx == "heart")
                {
                    for (int i = 0; i < 2; i++) { double hy = y + 8 - JsMath.round(((k + i * 0.5) % 1) * 14); heart(g, x + 30 + i * 7, hy, PAL.coralL); }
                }
                else if (c.fx == "prr") Px.text(g, "prr", x + 26, y + 10 - JsMath.round(k * 6), PAL.creamL);
                else if (c.fx == "hiss") Px.text(g, "¡fff!", x + 22 + (JsMath.sin(c.t * 40) > 0 ? 1 : 0), y + 4, PAL.coralL);
                else if (c.fx == "gold")
                {
                    for (int i = 0; i < 4; i++)
                    {
                        double sxg = x + 14 + ((i * 13 + Math.Floor(c.t * 6)) % 40), syg = y + 4 + ((i * 7) % 18);
                        Px.rect(g, sxg, syg, 1, 3, PAL.yellowL);
                        Px.rect(g, sxg - 1, syg + 1, 3, 1, PAL.yellowL);
                    }
                }
                g.globalAlpha = 1;
            }
            // Alerta: un "!" sobre la cabeza
            if (c.state == "alert") Px.text(g, "!", x + 30, y + 2 + (JsMath.sin(c.t * 8) > 0 ? 0 : 1), PAL.yellow);
            // El final: durante un instante, el gato tiene la cara del encapuchado
            if (c.hoodT > 0 && SN.Chars != null)
                g.drawImage(SN.Chars.hoodedCanvas(c.t, V.Obj("smile", true)), 0, 0, 40, 46, x + 28, y - 2, 20, 23);
        }

        // Primer plano para las cinemáticas (búfer de 160x90): cabeza y hombros centrados, a escala 1:1
        public void closeUp(Ctx2D g, string exprName, double t, bool fist = false, double hood = 0, bool tears = false, bool question = false)
        {
            string e = EXPR.ContainsKey(exprName) ? exprName : "worried";
            bool blink = (t % 4) > 3.86;
            var head = cached("head|" + e + "|" + (blink ? 1 : 0) + "|evening", () => buildHead(e, blink, "evening"));
            var body = cached("body|evening", () => buildBody("evening"));
            var bangs = cached("bangs|evening", () => buildBangs("evening"));
            int bob = (int)JsMath.round(JsMath.sin(t * 2) * 1);
            int ox = 18, oy = -12 + bob;
            g.imageSmoothingEnabled = false;
            g.drawImage(body, ox, oy);
            g.drawImage(head, ox, oy);
            if (fist)
            {
                var f = fistPump(t);
                var arm = cached("fist|" + f.dx + "|" + f.dy + "|evening", () => buildFistArm(f.dx, f.dy, "evening"));
                g.drawImage(arm, ox, oy + f.lift);
                // Líneas de impacto alrededor del puño cuando sube de golpe
                if (f.snap > 0)
                {
                    int fx = ox + FIST_POS.x + f.dx, fy = oy + FIST_POS.y + f.dy + f.lift;
                    int n = f.snap > 0.5 ? 3 : 2;
                    g.fillStyle = f.snap > 0.5 ? PAL.yellowL : PAL.yellow;
                    for (int i = 0; i < n; i++)
                    {
                        g.fillRect(fx - 3 - i, fy + 2 - i, 1, 1);   // arriba a la izquierda
                        g.fillRect(fx + 7, fy - 3 - i, 1, 1);        // arriba
                        g.fillRect(fx + 16 + i, fy + 2 - i, 1, 1);  // arriba a la derecha
                    }
                }
            }
            g.drawImage(bangs, ox, oy);
            // Final A: la capucha del encapuchado va cubriendo la cara
            if (hood > 0 && SN.Chars != null)
            {
                g.globalAlpha = hood * 0.55;
                g.fillStyle = "#05040A"; g.fillRect(0, 0, 160, 90);
                g.globalAlpha = JsMath.min(1, hood);
                g.drawImage(SN.Chars.hoodedCanvas(t, V.Obj("smile", hood > 0.7)), 0, 0, 40, 46, 39, -4, 80, 92);
                g.globalAlpha = 1;
            }
            // Final B: llora en la habitación vacía
            if (tears)
            {
                foreach (int ex in new[] { 74, 87 })
                {
                    double k = (t * 1.4 + ex * 0.13) % 1;
                    g.fillStyle = PAL.cyanL; g.fillRect(ex, 49, 1, 3 + JsMath.round(k * 9));
                    g.fillStyle = PAL.cyan; g.fillRect(ex, 52 + JsMath.round(k * 9), 2, 2);
                }
            }
            if (question)
            {
                double qx = 112, qy = 10 + JsMath.round(JsMath.sin(t * 4));
                Px.box(g, qx, qy, 11, 13, PAL.creamL, PAL.coal);
                Px.text(g, "?", qx + 3, qy + 11, PAL.coralD);
            }
            // Gota de sudor si está preocupado
            if (e == "nervous" || e == "shock")
            {
                double sy = 30 + ((t * 10) % 8);
                g.fillStyle = PAL.cyan; g.fillRect(96, JsMath.round(sy), 2, 3);
                g.fillStyle = PAL.cyanL; g.fillRect(96, JsMath.round(sy), 1, 1);
            }
        }

        // La mano que señala (la del ratón, sin ratón): lienzo y punta, para el rescate (js/render/bailout.js)
        public (Canvas c, (int x, int y) tip) pointHand(string phase = "night")
        {
            string key = "point|" + phase;
            if (!pointCache.TryGetValue(key, out var hit)) pointCache[key] = hit = buildPointHand(phase);
            return hit;
        }

        // El ratón de la mesa sin la mano (mismo lienzo y mismo sitio que la mano del ratón)
        public Canvas mouseOnly() { return cached("mouse", buildMouse); }

        public void clearCache() { cache.Clear(); pointCache.Clear(); }
    }
}
