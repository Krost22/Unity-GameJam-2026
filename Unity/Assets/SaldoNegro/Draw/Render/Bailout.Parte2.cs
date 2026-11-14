// Bailout (parte 2): manos y brazos por gesto, la carpeta, la firma de Trompa, el plano detalle, los billetes,
// el cuarto y el móvil con su pantalla, y los textos de la pantalla. Ver Bailout.cs.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using LV = SaldoNegro.Logic.V;

namespace SaldoNegro
{
    public sealed partial class Bailout
    {
        // ---------- Brazos y manos (por gesto) ----------
        // Manos dibujadas a mano (son pequeñas: así se leen los dedos). Mano izquierda de la imagen (la derecha de
        // Trompa); la otra es la misma en espejo. La luz llega de la derecha. K contorno, D pliegue, m sombra,
        // s piel, L brillo.
        static readonly Dictionary<string, string[]> HANDS = new Dictionary<string, string[]>
        {
            // El "acordeón": los dedos juntos en pinza, apuntando arriba
            ["pinch"] = new[] { "....KK..", "...KLsK.", "...KsLK.", "..KsDsK.", "..KsDsLK", ".KmsDssK", ".KmsDssK", "KmmmsssK", "KmmmmmsK", ".KKmmKK." },
            // El índice en alto ("escúchame bien")
            ["point"] = new[] { "...KK...", "..KLsK..", "..KsLK..", "..KssK..", "..KmsK..", ".KKmsKK.", "KmsDsLsK", "KmsDssLK", "KmmDsssK", "KmmmmmsK", ".KmmmmK.", "..KmmK.." },
            // Pulgar arriba, con los dedos doblados hacia la cámara
            ["thumb"] = new[] { "...KK....", "..KLsK...", "..KsLK...", "..KssK...", ".KKmsKKK.", "KmsssLLsK", "KDDDDDDDK", "KmsssssLK", "KDDDDDDDK", "KmsssssK.", ".KmmmmK..", "..KmmK..." },
            // La palma abierta (antes del golpe)
            ["palm"] = new[] { ".K.K.K...", "KsKsKsK..", "KsKsKsKK.", "KsKsKsKsK", "KsssssKsK", "KsssssssK", "KmsssssLK", "KmssssLK.", ".KmmssK..", "..KmmK..." },
            // Puño cerrado (sujeta el rotulador; aplasta el botón)
            ["fist"] = new[] { ".KKKKKK.", "KsLsLsLK", "KDDDDDDK", "KmsssssK", "KDDDDDDK", ".KmmmmK." },
            // Apoyada en la mesa
            ["rest"] = new[] { ".KKKKKKK.", "KsLsLsLsK", "KmsDsDssK", ".KmmmmmK." },
            // Sujetando la carpeta por el borde
            ["grip"] = new[] { ".KK..", "KLsK.", "KssK.", "KDsK.", "KssK.", "KmsK.", "KmmK.", ".KK.." },
        };
        // Pone la mano con su muñeca (centro del borde de abajo) en (x, y); flip = la otra mano
        static void putHand(PK.Sprite sp, string kind, double x, double y, bool flip = false)
        {
            var rows = HANDS[kind]; int w = rows[0].Length;
            sp.stamp(rows, (int)JsMath.round(x - w / 2.0), (int)JsMath.round(y - rows.Length + 1), HANDPAL, flip);
        }
        // El antebrazo: sale del codo (apoyado en el borde de la mesa; el brazo, del hombro al codo, es parte del
        // cuerpo, en buildBody) hasta la muñeca, con el puño blanco de la camisa. side: 'L' (izquierda de la imagen) o 'R'
        static readonly (int x, int y) ELBOW_L = (46, 66), ELBOW_R = (114, 66);
        static void arm(PK.Sprite sp, char side, (double x, double y) wrist)
        {
            var e = side == 'L' ? ELBOW_L : ELBOW_R;
            double x = wrist.x, y = wrist.y;
            double len = JsMath.hypot(x - e.x, y - e.y);
            if (len == 0 || double.IsNaN(len)) len = 1; // JS: `|| 1`
            double ux = (x - e.x) / len, uy = (y - e.y) / len;
            var fore = sp.mask().taper(e.x, e.y, 4, x - ux * 1.5, y - uy * 1.5, 3.3);
            sp.part(fore, SUIT, light: LIGHT, lit: 2, sh: 2, baseIdx: 2, cast: 1);
            // El codo: un pliegue de la tela donde dobla el brazo
            sp.px(e.x + (side == 'L' ? 1 : -1), e.y - 1, SUIT[0]);
            sp.part(sp.mask().capsule(x - ux * 1.5, y - uy * 1.5, x, y, 2.9), SHIRT, light: LIGHT, baseIdx: 4, lit: 1);
        }
        static Canvas buildArms(string gesture, double k)
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            if (gesture == "accordion" || gesture == "money")
            {
                double s = k; // separación de las manos (0..4)
                arm(sp, 'L', (64 - s, 61));
                arm(sp, 'R', (96 + s, 61));
                putHand(sp, "pinch", 66 - s, 60);
                putHand(sp, "pinch", 94 + s, 60, true);
            }
            else if (gesture == "point")
            {
                double p = k; // el dedo se adelanta un píxel con cada palabra
                arm(sp, 'L', (57, 51 - p));
                arm(sp, 'R', (101, 66));
                putHand(sp, "point", 58, 50 - p);
                putHand(sp, "rest", 98, 67, true);
            }
            else if (gesture == "sign")
            {
                // La mano derecha (izquierda de la imagen) con el rotulador sobre el papel; la otra lo sujeta
                R(g, 62, 64, 36, 3, PAL.creamL); R(g, 62, 66, 36, 1, PAL.creamD);
                for (int i = 0; i < 4; i++) R(g, 65 + i * 7, 65, 5, 1, PAL.creamD);
                double hx = 68 + k, hy = 64;
                if (k > 0) for (int i = 0; i < k; i += 2) R(g, 66 + i, 65 - (i % 4 != 0 ? 1 : 0), 2, 1, PAL.coalDD);
                arm(sp, 'L', (hx - 4, hy));
                arm(sp, 'R', (100, 66));
                putHand(sp, "rest", 96, 66, true);
                sp.line(hx + 2, hy - 1, hx + 4, hy + 1, PAL.coalDD).line(hx - 1, hy - 5, hx + 2, hy - 2, PAL.coalD);
                putHand(sp, "fist", hx, hy);
            }
            else if (gesture == "button")
            {
                // 0: en reposo junto al botón · 1: la mano en alto · 2: ¡golpe!
                arm(sp, 'L', (61, 66));
                putHand(sp, "rest", 63, 67);
                if (k == 0) { arm(sp, 'R', (105, 66)); putHand(sp, "rest", 103, 67, true); }
                else if (k == 1) { arm(sp, 'R', (117, 50)); putHand(sp, "palm", 117, 49, true); }
                else { arm(sp, 'R', (119, 62)); putHand(sp, "fist", 120, 62, true); }
            }
            else if (gesture == "thumbs")
            {
                double b = k;
                arm(sp, 'L', (62, 59 - b));
                arm(sp, 'R', (98, 59 - b));
                putHand(sp, "thumb", 63, 58 - b);
                putHand(sp, "thumb", 97, 58 - b, true);
            }
            else
            {
                // Manos juntas sobre la mesa
                arm(sp, 'L', (71, 66));
                arm(sp, 'R', (89, 66));
                putHand(sp, "rest", 75, 67);
                putHand(sp, "rest", 85, 67, true);
            }
            return sp.canvas;
        }

        // La carpeta con la orden firmada, en alto delante del pecho. Las manos la sujetan por los lados.
        static Canvas buildFolder()
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            int y = 47; // por debajo de la barbilla: se le ve la sonrisa
            var cover = sp.mask().rect(55, y, 50, 30);
            sp.part(cover, LEATHER, light: LIGHT, lit: 2, sh: 2, baseIdx: 2, cast: 1);
            R(g, 57, y + 2, 46, 26, PAL.yellowD);              // ribete dorado
            sp.part(sp.mask().rect(58, y + 3, 44, 24), SHIRT, light: LIGHT, baseIdx: 4, lit: 1, outline: false);
            // Sello y renglones
            Px.ellipse(g, 80, y + 6, 2, 2, PAL.yellowD); R(g, 80, y + 6, 1, 1, PAL.coalD);
            for (int i = 0; i < 3; i++) R(g, 62, y + 11 + i * 2, i == 2 ? 22 : 36, 1, PAL.creamD);
            // La firma: un sismógrafo (con una Ш en medio, si te fijas)
            signature(g, 60, y + 18, 40, 6, 1, PAL.coalDD, 1);
            // Los codos en la mesa y las manos sujetando los lados
            foreach (var (x, side) in new[] { (55, 'L'), (105, 'R') })
            {
                arm(sp, side, (x + (side == 'L' ? -1 : 1), 65));
                putHand(sp, "grip", x, 64, side == 'R');
            }
            return sp.canvas;
        }

        // La firma de Trompa: picos como un sismógrafo, la Ш del idioma secreto en medio y un subrayado.
        // Puntos normalizados (0..1); se dibuja hasta la fracción p del trazo.
        static readonly (double x, double y)[] SIG = Pts(0, 0.7, 0.04, 0.05, 0.08, 0.95, 0.12, 0.1, 0.16, 0.9, 0.2, 0.2, 0.24, 0.85, 0.28, 0.15, 0.32, 0.92,
            0.38, 0.05, 0.38, 0.95, 0.47, 0.95, 0.47, 0.1, 0.47, 0.95, 0.56, 0.95, 0.56, 0.05,
            0.6, 0.85, 0.64, 0.2, 0.68, 0.9, 0.72, 0.1, 0.76, 0.88, 0.8, 0.25, 0.84, 0.9, 0.88, 0.3, 0.92, 0.8, 1, 0.6,
            0.95, 1.15, 0.02, 1.2);
        static readonly double SIG_LEN = SigLen();
        static double SigLen()
        {
            double L = 0;
            for (int i = 1; i < SIG.Length; i++) L += JsMath.hypot(SIG[i].x - SIG[i - 1].x, SIG[i].y - SIG[i - 1].y);
            return L;
        }
        // Devuelve la punta del rotulador (para la mano del plano detalle)
        static (double x, double y) signature(Ctx2D g, double x, double y, double w, double h, double p, string color, double width)
        {
            double left = p * SIG_LEN;
            var tip = (x + SIG[0].x * w, y + SIG[0].y * h);
            for (int i = 1; i < SIG.Length && left > 0; i++)
            {
                var a = SIG[i - 1]; var b = SIG[i];
                double seg = JsMath.hypot(b.x - a.x, b.y - a.y);
                double k = JsMath.min(1, left / seg);
                double ax = x + a.x * w, ay = y + a.y * h;
                double bx = x + (a.x + (b.x - a.x) * k) * w, by = y + (a.y + (b.y - a.y) * k) * h;
                Px.line(g, JsMath.round(ax), JsMath.round(ay), JsMath.round(bx), JsMath.round(by), color, width);
                tip = (bx, by);
                left -= seg;
            }
            return tip;
        }

        // Plano detalle: la orden sobre la mesa, vista desde arriba, y la mano con el rotulador
        static Canvas buildInsertBg()
        {
            var c = Px.canvas(W, H); var g = Px.ctx(c);
            R(g, 0, 0, W, H, PAL.woodM);
            for (int y = 0; y < H; y += 3) R(g, 0, y, W, 1, (y % 9) != 0 ? PAL.woodD : PAL.wood);
            // El papel (con sombra), el sello y el texto
            R(g, 25, 4, 112, 90, PAL.woodDD);
            R(g, 22, 2, 112, 92, PAL.creamL); R(g, 22, 2, 112, 1, PAL.white); R(g, 133, 2, 1, 92, PAL.creamD);
            Px.ellipse(g, 78, 12, 6, 6, PAL.yellowD); Px.ellipse(g, 78, 12, 4, 4, PAL.yellow); R(g, 77, 11, 3, 2, PAL.yellowD); R(g, 78, 11, 1, 1, PAL.coalD);
            for (int i = 0; i < 4; i++) R(g, 32, 30 + i * 4, i == 3 ? 50 : 92, 1, PAL.creamD);
            R(g, 34, 69, 88, 1, PAL.creamDD);
            return c;
        }
        // La mano (vista desde arriba): agarra el rotulador como un bolígrafo, el pulgar encima y los nudillos marcados.
        // La punta del rotulador está en (3, 3) del sprite.
        static Canvas buildInsertHand()
        {
            var sp = new PK.Sprite(72, 64);
            // El rotulador: negro, gordo, con la anilla gris
            sp.part(sp.mask().capsule(3, 3, 31, 27, 2.7), LEATHER, light: LIGHT, lit: 1, sh: 1, baseIdx: 1);
            sp.part(sp.mask().capsule(13, 11.5, 16, 14.5, 3), new[] { PAL.coalD, PAL.coalL, PAL.creamDD, PAL.creamD }, light: LIGHT, lit: 1, sh: 1, baseIdx: 2, outline: false);
            sp.px(4, 3, PAL.coalL).px(6, 5, PAL.coalL).px(8, 7, PAL.coalL);
            // Los dedos doblados por debajo del rotulador, el dorso y el antebrazo
            var hand = sp.mask().ellipse(31, 27, 10, 8.5).ellipse(23, 25, 4.5, 4).ellipse(25, 31, 4.2, 3.6).ellipse(30, 35, 4, 3.4)
                .taper(36, 33, 8.5, 52, 60, 10);
            sp.part(hand, TAN, light: LIGHT, lit: 3, sh: 3, baseIdx: 2, cast: 1);
            // El pulgar: por encima, apretando el rotulador
            var thumb = sp.mask().taper(31, 19, 3.6, 21, 17, 2.6);
            sp.part(thumb, TAN, light: LIGHT, lit: 2, sh: 2, baseIdx: 3, cast: 1);
            sp.px(21, 16, TAN[4]).px(22, 16, TAN[4]);
            // Nudillos y pliegues de los dedos
            foreach (var (x, y) in new[] { (33, 20), (37, 23), (39, 27) }) sp.px(x, y, TAN[4]).px(x - 1, y + 1, TAN[1]);
            sp.line(21, 27, 24, 28, TAN[1]).line(23, 33, 27, 33, TAN[1]).line(27, 37, 31, 37, TAN[1]);
            // Puño de la camisa y la manga del traje
            var cuff = sp.mask().taper(41, 45, 9.5, 49, 56, 10.5).keep(sp.mask().poly(Pts(28, 50, 56, 38, 64, 52, 36, 64)));
            sp.part(cuff, SHIRT, light: LIGHT, baseIdx: 3, lit: 2);
            sp.part(sp.mask().poly(Pts(38, 64, 62, 50, 72, 58, 72, 64)), SUIT, light: LIGHT, baseIdx: 2, lit: 2);
            return sp.canvas;
        }
        static (double x, double y) drawInsert(Ctx2D b, double p, double t)
        {
            var office = cached("insertBg", buildInsertBg);
            b.drawImage(office, 0, 0);
            var tip = signature(b, 36, 46, 86, 18, p, PAL.coalDD, 2);
            // La mano (grande, desde abajo a la derecha) y el rotulador negro
            var hm = cached("insertHand", buildInsertHand);
            double wob = JsMath.round(JsMath.sin(t * 40) * 0.6);
            b.drawImage(hm, JsMath.round(tip.x) - 4, JsMath.round(tip.y) - 4 + wob);
            return tip;
        }

        // Billetes que salen volando (vista: girando: de frente, de canto, de perfil)
        static void bill(Ctx2D b, int x, int y, bool big, int frame)
        {
            int w = big ? 11 : 7, h = big ? 6 : 4;
            if (frame == 2) { R(b, x, y + (h >> 1), w, 1, PAL.greenDD); return; }
            int hh = frame == 1 ? Math.Max(2, h >> 1) : h, yy = y + ((h - hh) >> 1);
            R(b, x, yy, w, hh, PAL.greenDD); R(b, x + 1, yy + (hh > 2 ? 1 : 0), w - 2, Math.Max(1, hh - 2), PAL.green);
            if (frame == 0) { R(b, x + (w >> 1), yy + 1, 1, hh - 2, PAL.greenL); if (big) { R(b, x + 2, yy + 2, 1, 2, PAL.greenD); R(b, x + w - 3, yy + 2, 1, 2, PAL.greenD); } }
        }

        // =====================================================================================================
        // EL TELÉFONO (primera persona, de noche en tu cuarto)
        // =====================================================================================================
        // Pantalla y botones del móvil (coordenadas del búfer, sin el PDY)
        static (int x, int y, int w, int h) SEND = (SCR_X + 3, SCR_Y + 62, SCR_W - 6, 8);
        static readonly (int x, int y) REST_POS = (129, 55); // donde espera el dedo (asoma por abajo a la derecha)

        static Canvas buildRoom()
        {
            var c = Px.canvas(W, H); var g = Px.ctx(c);
            R(g, 0, 0, W, H, PAL.wallD);
            for (int x = 2; x < W; x += 7) R(g, x, 0, 1, H, PAL.wallM);
            // Ventana con las persianas (de noche) a la izquierda y el póster a la derecha, desenfocados
            R(g, 6, 6, 40, 46, PAL.coalDD);
            for (int y = 8; y < 50; y += 4) { R(g, 8, y, 36, 2, "#45367A"); R(g, 8, y + 2, 36, 2, "#140E30"); }
            R(g, 122, 14, 24, 30, PAL.violetD); R(g, 124, 16, 20, 26, PAL.magentaD); Px.ellipse(g, 134, 26, 5, 5, PAL.magenta);
            // La mesa
            R(g, 0, 72, W, 18, PAL.woodDD); R(g, 0, 72, W, 1, PAL.woodD);
            // Penumbra
            g.globalAlpha = 0.45; R(g, 0, 0, W, H, PAL.coalDD); g.globalAlpha = 1;
            return c;
        }
        // Tu móvil: viejo, oscuro y con la pantalla rajada
        static Canvas buildPhone()
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            var body = sp.mask().rect(50, 4, 60, 90).rect(52, 2, 56, 2).rect(51, 3, 58, 1);
            sp.part(body, PHONE, light: new[] { 1, -1 }, lit: 2, sh: 2, baseIdx: 2);
            sp.rim(body, NIGHT, -1, 0);
            R(g, SCR_X - 1, SCR_Y - 1, SCR_W + 2, SCR_H + 2, PAL.coalDD);
            R(g, 74, 5, 12, 1, PAL.coalDD); R(g, 89, 5, 1, 1, PAL.cyanD);
            R(g, 76, 85, 8, 2, PAL.coalD);
            return sp.canvas;
        }
        // La mano izquierda sujeta el móvil por abajo: el pulgar por delante, los dedos asoman por el otro lado
        // Las yemas que agarran el móvil, dibujadas a mano (a este tamaño, las formas automáticas parecen salchichas).
        // La mano que pulsa es la del ratón de la partida (SN.Hero.pointHand) y el pulgar, de las mismas piezas.
        // K contorno, D pliegue, m sombra, s piel, L luz, n/N uña y su sombra. La luz llega de la pantalla y de la ventana
        // (izquierda); el contraluz de la noche, muy suave.
        static readonly Dictionary<char, string> MYPAL = new Dictionary<char, string>
        {
            ['K'] = "#5B2A3A", ['D'] = PAL.skinD, ['m'] = PAL.skinM, ['s'] = PAL.skin, ['L'] = PAL.skinL, ['n'] = "#FCE6EC", ['N'] = "#E9B9C9",
        };
        const string SOFT_RIM = "#D9A3CF";
        // Las yemas que asoman por el borde derecho: rodean el canto y apoyan la punta (con la uña) en el marco
        static readonly string[] TIP_MID = { "..KKKKK.", ".KnnLssK", "KnNnssmK", "KLsssmmK", ".KmmmDDK", "..KKKKK." };
        static readonly string[] TIP_BIG = { "..KKKKKK.", ".KnnLsssK", "KnNnsssmK", "KLssssmmK", ".KmmmmDDK", "..KKKKKK." };
        static readonly string[] TIP_SMALL = { "..KKKK.", ".KnLssK", "KnNsmmK", ".KmmDDK", "..KKKK." };
        static (Canvas back, Canvas front) buildHoldHand()
        {
            // Detrás del móvil: la palma (asoma abajo a la izquierda) y el antebrazo hacia la esquina
            var back = new PK.Sprite(W, H);
            var palm = back.mask().ellipse(53, 90, 9, 7).taper(46, 92, 7, 34, 104, 8);
            back.part(palm, SKIN, light: new[] { 0, -1 }, lit: 2, sh: 3);
            back.rim(palm, SOFT_RIM, -1, 0);
            // Delante: el pulgar y las cuatro yemas (índice, corazón, anular y meñique, de arriba abajo)
            var front = new PK.Sprite(W, H);
            // El pulgar: en diagonal sobre el marco izquierdo, con la punta apoyada en el borde de la pantalla
            var thumb = front.mask().ellipse(46, 86, 5.5, 7).taper(47, 82, 3.6, 56.5, 64, 2.5);
            front.part(thumb, SKIN, light: new[] { 1, -1 }, lit: 2, sh: 2, cast: 1);
            front.rim(thumb, NIGHT, -1, 0);
            front.stamp(new[] { "nn", "nN" }, 55, 63, MYPAL);      // la uña
            front.line(50, 72, 53, 74, PAL.skinD);                  // el pliegue del nudillo
            front.stamp(TIP_MID, 105, 49, MYPAL).stamp(TIP_BIG, 104, 56, MYPAL).stamp(TIP_MID, 105, 63, MYPAL).stamp(TIP_SMALL, 106, 70, MYPAL);
            // Sombra de las yemas sobre el marco del móvil
            foreach (var (x, y) in new[] { (104, 51), (103, 58), (104, 65), (105, 72) }) front.px(x, y, PAL.coalDD).px(x, y + 1, PAL.coalDD);
            return (back.canvas, front.canvas);
        }
        static (Canvas back, Canvas front) HoldHand() { return holdCache ?? (holdCache = buildHoldHand()).Value; }

        // Iconos de 10x10 para los botones: banco, banco enorme, persona
        static void icon(Ctx2D b, int kind, int x, int y, string col)
        {
            if (kind == 1)
            {
                R(b, x + 1, y + 2, 8, 1, col); R(b, x + 3, y + 1, 4, 1, col); R(b, x + 4, y, 2, 1, col);
                foreach (var cx in new[] { x + 1, x + 4, x + 7 }) R(b, cx, y + 4, 2, 4, col);
                R(b, x, y + 8, 10, 2, col);
            }
            else if (kind == 2)
            {
                R(b, x + 3, y, 4, 10, col); R(b, x, y + 4, 3, 6, col); R(b, x + 7, y + 2, 3, 8, col);
                for (int j = 1; j < 9; j += 2) R(b, x + 4, y + j, 2, 1, PAL.navyM);
                R(b, x + 4, y - 2, 1, 2, col);
            }
            else
            {
                // Una persona normal: cabeza, cuerpo, brazos y piernas
                R(b, x + 4, y, 3, 3, col); R(b, x + 3, y + 4, 5, 4, col); R(b, x + 1, y + 4, 1, 3, col); R(b, x + 9, y + 4, 1, 3, col);
                R(b, x + 2, y + 4, 1, 1, col); R(b, x + 8, y + 4, 1, 1, col); R(b, x + 4, y + 8, 1, 2, col); R(b, x + 6, y + 8, 1, 2, col);
            }
        }
        // La moneda con el ojo (el escudo del Gobierno... y el medallón del encapuchado)
        static void seal(Ctx2D b, double cx, double cy, double r, double t)
        {
            Px.ellipse(b, cx, cy, r, r, PAL.yellowD); Px.ellipse(b, cx, cy, r - 1, r - 1, PAL.yellow);
            R(b, cx - JsMath.round(r * 0.6), cy, JsMath.round(r * 1.2) + 1, 1, PAL.coalD);
            R(b, cx, cy, 1, 1, JsMath.sin(t * 3) > 0.92 ? PAL.coral : PAL.coalDD);
            R(b, cx - 1, cy - JsMath.round(r * 0.5), 2, 1, PAL.yellowL);
        }

        // Pantalla del móvil: botones del menú (0..2)
        static (int x, int y, int w, int h) BTN(int i) { return (SCR_X + 3, SCR_Y + 15 + i * 17, SCR_W - 6, 14); }
        static readonly (int x, int y) ACCEPT = (89, 72), DECLINE = (71, 72);

        // Lo que se ve en la pantalla del móvil (parte en el búfer: fondos e iconos)
        static void drawScreen(Ctx2D b, BailoutView V)
        {
            int sx = SCR_X, sy = SCR_Y, sw = SCR_W, sh = SCR_H;
            double t = V.ut;
            R(b, sx, sy, sw, sh, PAL.navy);
            for (int y = sy; y < sy + sh; y += 2) R(b, sx, y, sw, 1, PAL.navyD);
            // Cabecera: el escudo y "RESCATE"
            R(b, sx, sy, sw, 10, PAL.navyL); R(b, sx, sy + 10, sw, 1, PAL.yellowD);
            seal(b, sx + 6, sy + 5, 3, V.t);
            string ui = V.ui;
            if (ui == "dial" || ui == "welcome")
            {
                double r = 8 + JsMath.round((t * 6) % 6);
                if (ui == "dial") { b.globalAlpha = 0.5 * (1 - ((t * 6) % 6) / 6); Px.circleOutline(b, 80, 40, r, PAL.yellow); b.globalAlpha = 1; }
                seal(b, 80, 40, 8, V.t);
            }
            else if (ui == "menu" || ui == "wrong")
            {
                for (int i = 0; i < 3; i++)
                {
                    var r = BTN(i);
                    bool on = V.sel == i + 1, bad = ui == "wrong" && on;
                    bool hot = ui == "menu" && V.hover == i + 1;
                    R(b, r.x, r.y, r.w, r.h, bad ? PAL.coralD : on ? PAL.yellowD : hot ? PAL.navyLL : PAL.navyM);
                    R(b, r.x, r.y, r.w, 1, bad ? PAL.coral : on ? PAL.yellow : PAL.navyLL);
                    R(b, r.x, r.y + r.h - 1, r.w, 1, PAL.navyD);
                    Px.ellipse(b, r.x + 6, r.y + 7, 4, 4, bad ? PAL.coral : on ? PAL.yellow : PAL.navyL);
                    icon(b, i + 1, r.x + 13, r.y + 2, bad ? PAL.creamL : on ? PAL.coalD : PAL.creamM);
                    if (bad) { Px.line(b, r.x + 12, r.y + 1, r.x + 24, r.y + 12, PAL.creamL, 1); Px.line(b, r.x + 24, r.y + 1, r.x + 12, r.y + 12, PAL.creamL, 1); }
                }
            }
            else if (ui == "name")
            {
                R(b, sx + 3, sy + 19, sw - 6, 16, PAL.creamL); R(b, sx + 3, sy + 19, sw - 6, 1, PAL.white); R(b, sx + 3, sy + 34, sw - 6, 1, PAL.creamD);
                // Teclado: la tecla que acabas de pulsar se ilumina
                for (int j = 0; j < 3; j++)
                    for (int i = 0; i < 9 - (j == 2 ? 2 : 0); i++)
                    {
                        int kx = sx + 4 + i * 5 + (j == 2 ? 5 : 0), ky = sy + 39 + j * 6;
                        bool lit = V.keyFlash > 0 && V.lastKey == j * 9 + i;
                        R(b, kx, ky, 4, 4, lit ? PAL.yellow : PAL.navyL); R(b, kx, ky + 3, 4, 1, lit ? PAL.yellowD : PAL.navyM);
                    }
                R(b, sx + 12, sy + 57, 26, 3, PAL.navyL);
                bool ready = V.typed >= TX()["bankName"].str.Length;
                // Listo para enviar: el botón parpadea (se puede pulsar con el ratón o con Enter)
                bool blink = ready && Math.Floor(V.t * 3) % 2 == 0;
                R(b, SEND.x, SEND.y, SEND.w, SEND.h, ready ? (blink ? PAL.green : PAL.greenD) : PAL.navyM);
                R(b, SEND.x, SEND.y, SEND.w, 1, ready ? PAL.greenL : PAL.navyL);
            }
            else if (ui == "check")
            {
                for (int i = 0; i < 8; i++)
                {
                    double a = i / 8.0 * Math.PI * 2;
                    bool on = Math.Floor(t * 10) % 8 == i;
                    R(b, JsMath.round(80 + JsMath.cos(a) * 7), JsMath.round(38 + JsMath.sin(a) * 7), 2, 2, on ? PAL.yellow : PAL.navyL);
                }
            }
            else if (ui == "verdict")
            {
                // El sello cae sobre la pantalla (grande -> su tamaño)
                double k = JsMath.min(1, t / 0.18), grow = JsMath.round((1 - k) * 6);
                double x = sx + 3 - grow, y = sy + 22 - grow, w = sw - 6 + grow * 2, h = 26 + grow * 2;
                R(b, x, y, w, h, PAL.coral); R(b, x + 2, y + 2, w - 4, h - 4, PAL.navy); R(b, x + 3, y + 3, w - 6, h - 6, PAL.coralDD);
            }
            else if (ui == "hold")
            {
                for (int i = 0; i < 3; i++)
                {
                    double k = ((t * 0.8 + i / 3.0) % 1);
                    double x = 66 + i * 11 + JsMath.round(JsMath.sin(k * 6 + i) * 2), y = JsMath.round(54 - k * 26);
                    b.globalAlpha = JsMath.sin(k * Math.PI);
                    R(b, x, y, 1, 5, PAL.yellow); R(b, x - 2, y + 4, 3, 2, PAL.yellow); R(b, x + 1, y, 2, 1, PAL.yellow);
                    b.globalAlpha = 1;
                }
                for (int i = 0; i < 3; i++) R(b, 74 + i * 5, 66, 3, 3, (Math.Floor(t * 3) % 3) == i ? PAL.yellow : PAL.navyL);
            }
            else if (ui == "incoming" || ui == "accept")
            {
                double pulse = (t * 1.5) % 1;
                b.globalAlpha = 0.6 * (1 - pulse); Px.circleOutline(b, 80, 36, 11 + JsMath.round(pulse * 8), PAL.green); b.globalAlpha = 1;
                // Su foto: una bola naranja con un tupé amarillo
                Px.ellipse(b, 80, 36, 10, 10, PAL.navyL);
                Px.ellipse(b, 80, 39, 6, 6, TAN[3]); R(b, 74, 32, 12, 4, PAL.yellow); R(b, 73, 34, 3, 3, PAL.yellow); R(b, 78, 31, 6, 1, PAL.yellowL);
                R(b, 77, 39, 2, 1, PALE); R(b, 81, 39, 2, 1, PALE); R(b, 79, 42, 2, 1, "#7A2420");
                int ring = JsMath.sin(t * 18) > 0 ? 1 : 0;
                Px.ellipse(b, DECLINE.x, DECLINE.y, 5, 5, PAL.coralD); R(b, DECLINE.x - 3, DECLINE.y, 6, 1, PAL.creamL);
                Px.ellipse(b, ACCEPT.x, ACCEPT.y - (ui == "incoming" ? ring : 0), 5, 5, ui == "accept" ? PAL.greenL : PAL.green);
                R(b, ACCEPT.x - 2, ACCEPT.y - 1 - (ui == "incoming" ? ring : 0), 4, 2, PAL.greenDD);
            }
            // La raja de la pantalla
            b.globalAlpha = 0.7;
            Px.line(b, 104, 10, 97, 18, PAL.creamL); Px.line(b, 97, 18, 100, 24, PAL.creamL); Px.line(b, 97, 18, 91, 16, PAL.creamL);
            b.globalAlpha = 0.35; Px.line(b, 103, 11, 96, 19, PAL.coalDD);
            b.globalAlpha = 1;
        }

        // Los textos de la pantalla, a la resolución del escenario (g = lienzo de 640x360)
        static void screenText(Ctx2D g, BailoutView V)
        {
            int sx = SCR_X, sy = SCR_Y;
            var X = TX();
            double x0 = sx * Z, y0 = (sy + PDY) * Z;
            Px.text(g, X["header"], x0 + 48, y0 + 30, PAL.creamL, size: 16);
            string mm = JsString.padStart(Js.String(Math.Floor(V.t / 60)), 2, "0");
            string ss = JsString.padStart(Js.String(Math.Floor(V.t % 60)), 2, "0");
            if (V.ui != "dial") Px.text(g, mm + ":" + ss, x0 + 8, y0 + 57, PAL.creamDD); // (a la izquierda: a la derecha está la raja)
            double cx = (sx + SCR_W / 2.0) * Z;
            string ui = V.ui;
            if (ui == "dial") Px.text(g, X["dialing"], cx, y0 + 230, PAL.creamL, align: "center", size: 16);
            if (ui == "welcome") Px.text(g, X["connected"], cx, y0 + 230, PAL.green, align: "center", size: 16);
            if (ui == "menu" || ui == "wrong")
            {
                for (int i = 0; i < 3; i++)
                {
                    var r = BTN(i);
                    bool on = V.sel == i + 1, bad = ui == "wrong" && on;
                    Px.text(g, (i + 1).ToString(), (r.x + 6) * Z + 1, (r.y + PDY + 7) * Z + 8, bad || on ? PAL.coalD : PAL.creamL, align: "center", size: 16);
                    Px.text(g, X["options"][i], (r.x + 25) * Z, (r.y + PDY + 7) * Z + 4, bad ? PAL.creamL : on ? PAL.coalD : PAL.creamL);
                }
            }
            if (ui == "name")
            {
                Px.text(g, X["nameLabel"], x0 + 14, y0 + 70, PAL.creamD);
                string txt = JsString.upper(JsString.slice(X["bankName"].str, 0, V.typed));
                int half = X["bankNameBreak"].i;
                string l1 = JsString.slice(txt, 0, half), l2 = JsString.trim(JsString.slice(txt, half));
                Px.text(g, l1, x0 + 18, y0 + 98, PAL.coal);
                Px.text(g, l2, x0 + 18, y0 + 122, PAL.coal);
                if (Math.Floor(V.t * 3) % 2 == 0)
                {
                    double w = Px.textWidth(g, l2.Length > 0 ? l2 : l1);
                    R(g, x0 + 19 + w, l2.Length > 0 ? y0 + 113 : y0 + 89, 2, 11, PAL.coalL);
                }
                bool ready = V.typed >= X["bankName"].str.Length;
                Px.text(g, X["send"], cx, (SEND.y + PDY + 6) * Z + 1, ready ? PAL.creamL : PAL.creamDD, align: "center");
            }
            if (ui == "check") Px.text(g, X["checkingShort"], cx, y0 + 210, PAL.creamL, align: "center");
            if (ui == "verdict" && V.ut > 0.18)
            {
                var st = X["stamp"].arr;
                for (int i = 0; i < st.length; i++)
                    Px.text(g, st[i], cx, y0 + 116 + i * 24, PAL.coral, align: "center", size: i == 1 ? 16 : 8);
            }
            if (ui == "hold") Px.text(g, X["holdShort"], cx, y0 + 230, PAL.creamL, align: "center", size: 16);
            if (ui == "incoming" || ui == "accept")
            {
                Px.text(g, JsString.upper(X["president"].str), cx, y0 + 186, PAL.creamL, align: "center");
                Px.text(g, X["videoCall"], cx, y0 + 200, PAL.creamD, align: "center");
            }
        }
    }
}
