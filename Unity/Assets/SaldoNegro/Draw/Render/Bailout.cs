// Port de js/render/bailout.js (SN.Bailout): el rescate bancario de Trompa, la vida extra antes de perder del todo
// (una por meta, js/systems/bankruptcy.js).
// 1) EL TELÉFONO, en primera persona (como todo el juego: solo se ven tus manos). Llamas a la Línea de Rescate
//    Financiero del Gobierno: las personas no se rescatan y los bancos pequeños tampoco; hay que ser un banco
//    MUY grande. Escribes el nombre de tu banco (cualquier tecla pone las letras, como en Mensajín), te ponen en
//    espera... y entra una videollamada.
// 2) LA VIDEOLLAMADA con Donald Trompa (la parodia de las noticias) en su despacho dorado: gesticula, firma la
//    orden con su rotulador (plano detalle de la firma), la enseña a cámara y aplasta el botón rojo, que imprime
//    el dinero. Tu cara sale en la ventanita de la llamada. Su firma esconde una letra del idioma secreto.
// Pixel art por código con el kit SN.PK (mismas rampas, contornos y contraluz que el protagonista), en un búfer
// de 160x90 ampliado 4x como los primeros planos; los textos de las pantallas van a la resolución del
// escenario. Las piezas se cachean por pose: cada fotograma solo compone imágenes.
// Partido en archivos partial: Bailout.cs (datos, despacho, mesa, cuerpo, cabeza, pelo), Bailout.Parte2.cs (manos,
// carpeta, firma, plano detalle, móvil y su pantalla), Bailout.Parte3.cs (dibujo de fotogramas y videollamada),
// Bailout.Parte4.cs (estado, entrada, subtítulos, play / finish), Bailout.Parte5.cs (guion y bucle).
// Los datos estáticos están todos aquí (el orden de inicialización entre archivos partial no está definido).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using LV = SaldoNegro.Logic.V;

namespace SaldoNegro
{
    public sealed partial class Bailout
    {
        const int W = 160, H = 90, Z = 4;
        const int SCR_X = 55, SCR_Y = 9, SCR_W = 50, SCR_H = 73; // la pantalla del móvil (búfer)
        const int PDY = 10; // El móvil va 10 px más abajo de como está dibujado (lo sujetas desde abajo; el pie queda
                            // fuera del encuadre): así el subtítulo cabe arriba, sobre la pared, sin taparlo.

        static LV TX() { return SN.Data["story"]["rescue"]; }
        static void R(Ctx2D g, double x, double y, double w, double h, string c) { Px.rect(g, x, y, w, h, c); }
        // Lista de puntos [x0, y0, x1, y1, ...] (los polígonos del JS, tal cual)
        static (double x, double y)[] Pts(params double[] v)
        {
            var r = new (double x, double y)[v.Length / 2];
            for (int i = 0; i < r.Length; i++) r[i] = (v[2 * i], v[2 * i + 1]);
            return r;
        }
        static string[] Pick(Dictionary<string, string[]> d, string k, string fallback)
        {
            return k != null && d.TryGetValue(k, out var r) ? r : d[fallback];
        }

        // ---------- Rampas (de oscuro a claro) ----------
        static readonly string[] TAN = { "#6A2A22", "#A4472D", "#D46C3A", "#EF8F4E", "#FFBE7C" }; // el bronceado naranja
        const string PALE = "#FFD5A1";                                                             // la marca blanca de las gafas de sol
        static readonly string[] HAIR = { PAL.yellowDD, PAL.yellowD, PAL.yellow, PAL.yellowL, PAL.creamL };
        static readonly string[] SUIT = { "#0B0F2A", PAL.navyM, PAL.navyL, PAL.navyLL, "#5563B0" };
        static readonly string[] SHIRT = { PAL.creamDD, PAL.creamD, PAL.creamM, PAL.cream, PAL.creamL };
        static readonly string[] TIE = { PAL.coralDD, PAL.coralD, PAL.coral, PAL.coralL };
        static readonly string[] GOLD = { PAL.yellowDD, PAL.yellowD, PAL.yellow, PAL.yellowL };
        static readonly string[] WOOD = { PAL.woodDD, PAL.woodD, PAL.woodM, PAL.wood };
        static readonly string[] LEATHER = { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL };
        static readonly string[] SKIN = { PAL.skinDD, PAL.skinD, PAL.skinM, PAL.skin, PAL.skinL }; // las manos del protagonista
        static readonly string[] SLEEVE = { PAL.shirtDD, PAL.shirtD, PAL.shirt, PAL.shirtM, PAL.shirtL };
        static readonly string[] PHONE = { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL, "#5B4888" };
        static readonly int[] LIGHT = { 1, -1 };        // el foco de la cámara: delante, arriba a la derecha
        const string BACK = PAL.orangeL;                 // contraluz: el atardecer de la ventana del despacho
        const string NIGHT = "#FF6FC4";                  // contraluz de tu cuarto, de noche (como las manos de la partida)

        // Las piezas en caché (por pose)
        static readonly Dictionary<string, Canvas> cache = new Dictionary<string, Canvas>();
        static Canvas cached(string k, Func<Canvas> f)
        {
            if (!cache.TryGetValue(k, out var c)) { c = f(); cache[k] = c; }
            return c;
        }
        static (Canvas back, Canvas front)? holdCache;
        static Ctx2D drawBuf;   // draw.buf del JS
        static Ctx2D callTmp;   // callUI.tmp del JS

        // =====================================================================================================
        // EL DESPACHO
        // =====================================================================================================
        // Pared, ventana con el atardecer (y la ciudad), cortinas doradas y banderas. Trompa tapa el centro.
        static Canvas buildOffice()
        {
            var c = Px.canvas(W, H); var g = Px.ctx(c);
            R(g, 0, 0, W, H, "#8F82BC");
            for (int x = 2; x < W; x += 10) { R(g, x, 0, 1, H, "#8174AE"); R(g, x + 1, 0, 1, H, "#A194CC"); }
            // Ventana: cielo por franjas, el sol y la ciudad
            int wx = 48, wy = 9, ww = 64, wh = 50;
            string[] sky = { PAL.violetD, PAL.violet, PAL.magentaD, PAL.magenta, PAL.coralD, PAL.coral, PAL.orange };
            for (int i = 0; i < sky.Length; i++) R(g, wx, wy + i * 7, ww, 7, sky[i]);
            R(g, wx, wy + 49, ww, 1, PAL.orangeL);
            Px.ellipse(g, wx + 51, wy + 38, 6, 6, PAL.yellow); Px.ellipse(g, wx + 51, wy + 38, 4, 4, PAL.yellowL);
            int[,] city = { { 0, 11 }, { 6, 18 }, { 12, 8 }, { 17, 22 }, { 25, 13 }, { 31, 26 }, { 39, 10 }, { 45, 19 }, { 51, 14 }, { 57, 24 } };
            for (int ci = 0; ci < city.GetLength(0); ci++)
            {
                int cx = city[ci, 0], ch = city[ci, 1];
                R(g, wx + cx, wy + wh - ch, 6, ch, PAL.violetDD);
                R(g, wx + cx, wy + wh - ch, 6, 1, PAL.violetD);
                for (int yy = wy + wh - ch + 2; yy < wy + wh - 1; yy += 3)
                    for (int xx = wx + cx + 1; xx < wx + cx + 5; xx += 2)
                        if ((xx * 7 + yy * 3) % 5 == 0) R(g, xx, yy, 1, 1, PAL.yellow);
            }
            // En la azotea de la derecha, alguien con capucha. Nadie más lo ve.
            int hx = wx + 59, hy = wy + wh - 24 - 6;
            R(g, hx - 1, hy + 1, 3, 5, PAL.coalDD); Px.ellipse(g, hx, hy + 1, 1.5, 1.5, PAL.coalDD); R(g, hx, hy + 1, 1, 1, PAL.yellow);
            // Marco y parteluces
            R(g, wx - 3, wy - 3, ww + 6, 3, PAL.creamL); R(g, wx - 3, wy + wh, ww + 6, 3, PAL.creamL);
            R(g, wx - 3, wy, 3, wh, PAL.creamL); R(g, wx + ww, wy, 3, wh, PAL.creamL);
            R(g, wx + 31, wy, 2, wh, PAL.creamM); R(g, wx, wy + 24, ww, 2, PAL.creamM);
            R(g, wx - 3, wy + wh + 3, ww + 6, 1, "#7A6EA8");
            // Banderas: rayas y estrellas a la izquierda; azul con el sello dorado a la derecha
            flag(g, 32, 13, true);
            flag(g, 127, 13, false);
            // Cortinas doradas a los lados, recogidas con un cordón, y la galería de arriba
            curtain(g, 0, 27, 1);
            curtain(g, 133, 27, -1);
            for (int x = 0; x < W; x++)
            {
                int k = x % 10;
                R(g, x, 0, 1, 6, k < 2 ? PAL.yellowD : k < 7 ? PAL.yellow : PAL.yellowD);
                double drop = JsMath.round(JsMath.sin((k / 10.0) * Math.PI) * 2);
                R(g, x, 6, 1, drop, PAL.yellowD); R(g, x, 6 + drop, 1, 1, PAL.yellowDD);
            }
            R(g, 0, 1, W, 1, PAL.yellowL);
            // Alfombra azul con estrellas (asoma a los lados de la mesa)
            R(g, 0, 82, W, 8, PAL.navyM);
            for (int x = 3; x < W; x += 9) R(g, x, 85 + (x % 2), 1, 1, PAL.yellowD);
            return c;
        }
        static void flag(Ctx2D g, int x, int y, bool stripes)
        {
            R(g, x, y - 2, 1, 62, PAL.yellowD);
            Px.ellipse(g, x, y - 3, 1.5, 1.5, PAL.yellow);
            int fx = stripes ? x + 1 : x - 14, fw = 14, fh = 30;
            for (int j = 0; j < fh; j++)
            {
                double sag = JsMath.round(JsMath.sin((j / (double)fh) * Math.PI) * 1);
                for (int i = 0; i < fw; i++)
                {
                    string c = stripes ? (((j >> 1) % 2) != 0 ? PAL.creamL : PAL.coralD) : PAL.navyL;
                    if (stripes && i < 7 && j < 10) c = PAL.navyL;
                    // Pliegues: franjas más oscuras
                    if ((i + 1) % 5 == 0) c = stripes ? (((j >> 1) % 2) != 0 ? PAL.creamD : PAL.coralDD) : PAL.navyM;
                    R(g, fx + i, y + j + (i % 5 == 2 ? sag : 0), 1, 1, c);
                }
            }
            if (stripes) foreach (var (sx, sy) in new[] { (2, 2), (5, 2), (3, 5), (6, 6), (2, 8) }) R(g, fx + sx, y + sy, 1, 1, PAL.creamL);
            else { Px.ellipse(g, fx + 7, y + 12, 4, 4, PAL.yellowD); Px.ellipse(g, fx + 7, y + 12, 3, 3, PAL.yellow); R(g, fx + 6, y + 11, 3, 2, PAL.yellowD); }
        }
        // Cortina de 27 px de ancho; dir: hacia dónde se recoge (1 = hacia la izquierda, -1 = hacia la derecha)
        static void curtain(Ctx2D g, int x, int w, int dir)
        {
            int tie = 46;
            for (int y = 6; y < H; y++)
            {
                // Encima del cordón la tela cae recta; debajo se abre un poco
                int pinch = y < tie ? (int)JsMath.round((y - 6) / (double)(tie - 6) * 7) : (int)JsMath.round(JsMath.max(0, 7 - (y - tie) * 0.5));
                int cw = w - pinch;
                for (int i = 0; i < cw; i++)
                {
                    int xx = dir > 0 ? x + i : x + w - 1 - i;
                    double fold = (i * 7.0 / cw + y * 0.02) % 2.4;
                    string c = fold < 0.5 ? PAL.yellowDD : fold < 1.1 ? PAL.yellowD : fold < 1.9 ? PAL.yellow : PAL.yellowL;
                    if (i == cw - 1) c = PAL.yellowDD;
                    R(g, xx, y, 1, 1, c);
                }
            }
            // El lazo que la recoge (rojo) y su borla dorada
            int tw = w - 7, x0 = dir > 0 ? x : x + w - tw;
            R(g, x0, tie, tw, 2, PAL.coralD); R(g, x0, tie, tw, 1, PAL.coral);
            int bx = dir > 0 ? x0 + tw - 1 : x0;
            R(g, bx - 1, tie - 1, 3, 3, PAL.yellow); R(g, bx, tie - 1, 1, 1, PAL.yellowL);
            R(g, bx - 1, tie + 2, 3, 4, PAL.coralD); R(g, bx, tie + 2, 1, 4, PAL.coral);
        }

        // La mesa (por delante de Trompa): tablero, frente con paneles y el sello; encima, su foto (de él mismo)
        // y el botón rojo. press: 0..1, el botón aplastado.
        static Canvas buildDesk(double press)
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            var top = sp.mask().poly(Pts(14, 66, 146, 66, 150, 71, 10, 71));
            sp.part(top, WOOD, light: new[] { 0, -1 }, lit: 1, sh: 1, baseIdx: 3, flat: true);
            R(g, 12, 66, 136, 1, PAL.wood); R(g, 13, 67, 134, 1, "#B85C4C");
            var front = sp.mask().rect(14, 71, 132, 19);
            sp.part(front, WOOD, light: new[] { 0, -1 }, baseIdx: 2, lit: 1, sh: 1, dither: false);
            foreach (var (px, pw) in new[] { (20, 36), (104, 36) }) { R(g, px, 74, pw, 12, PAL.woodD); R(g, px, 74, pw, 1, PAL.woodDD); R(g, px, 85, pw, 1, PAL.wood); }
            // Sello presidencial
            sp.part(sp.mask().ellipse(80, 80, 7, 7), GOLD, light: LIGHT, lit: 2, sh: 2);
            Px.ellipse(g, 80, 80, 4, 4, PAL.navyL); R(g, 79, 78, 3, 3, PAL.yellow); R(g, 77, 79, 7, 1, PAL.yellowD);
            // Placa con su nombre
            R(g, 44, 63, 18, 3, PAL.yellowD); R(g, 44, 63, 18, 1, PAL.yellowL); R(g, 46, 64, 14, 1, PAL.yellowDD);
            // Su foto en un marco dorado (de él mismo, claro)
            R(g, 27, 54, 12, 12, PAL.yellowDD); R(g, 28, 55, 10, 10, PAL.yellow); R(g, 29, 56, 8, 8, "#8F82BC");
            Px.ellipse(g, 33, 61, 2.5, 3, TAN[3]); R(g, 30, 57, 6, 2, PAL.yellow); R(g, 35, 57, 2, 1, PAL.yellowL); R(g, 29, 63, 8, 1, PAL.navyL);
            // El botón rojo (antes, para pedir refrescos)
            int p = press > 0.5 ? 1 : 0;
            sp.part(sp.mask().rect(113, 61, 14, 5), WOOD, light: LIGHT, lit: 1, sh: 1, baseIdx: 2);
            sp.part(sp.mask().ellipse(120, 61 + p, 4.5, 3 - p), new[] { PAL.coralDD, PAL.coralD, PAL.coral, PAL.coralL }, light: LIGHT, lit: 2, sh: 1);
            if (p == 0) R(g, 121, 59, 2, 1, PAL.white);
            return sp.canvas;
        }

        // ---------- Trompa ----------
        // El cuerpo: traje azul cuadrado, camisa blanca, la corbata roja larguísima y, en la solapa, una insignia
        // dorada con un ojo (la misma moneda que lleva el encapuchado)
        static Canvas buildBody()
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            var neck = sp.mask().poly(Pts(70, 40, 90, 40, 89, 49, 71, 49));
            sp.part(neck, TAN, light: LIGHT, baseIdx: 1, outline: false);
            // El torso y, en la misma silueta, los brazos del hombro al codo (apoyados en la mesa): así son parte de él
            var torso = sp.mask().poly(Pts(40, 90, 42, 66, 47, 57, 56, 51, 69, 47, 91, 47, 104, 51, 113, 57, 118, 66, 120, 90))
                .taper(51, 56, 5.4, 45.5, 66, 4.4).taper(109, 56, 5.4, 114.5, 66, 4.4);
            sp.part(torso, SUIT, light: LIGHT, lit: 3, sh: 4, baseIdx: 2);
            sp.rim(torso, BACK, 0, -1);
            // Pliegue de la axila: separa el brazo del cuerpo
            sp.line(55, 60, 51, 66, SUIT[1]).line(105, 60, 109, 66, SUIT[1]);
            // Solapas
            foreach (var s in new[] { -1, 1 })
            {
                int x0 = 80 + s * 9;
                sp.line(x0, 48, x0 + s * 3, 57, SUIT[0]).line(x0 + s * 3, 57, x0 - s * 1, 66, SUIT[0]);
                sp.line(x0 + s * 1, 49, x0 + s * 3, 55, SUIT[3]);
            }
            var shirt = sp.mask().poly(Pts(71, 47, 89, 47, 80, 63));
            sp.part(shirt, SHIRT, light: LIGHT, baseIdx: 3, lit: 2, outline: false);
            var collar = sp.mask().poly(Pts(70, 45, 77, 47, 74, 52)).poly(Pts(90, 45, 83, 47, 86, 52));
            sp.part(collar, SHIRT, light: LIGHT, baseIdx: 4, cast: 1);
            // La corbata: nudo y una hoja que no se acaba nunca (llega por debajo de la mesa)
            var tie = sp.mask().poly(Pts(77, 48, 83, 48, 82, 52, 78, 52)).poly(Pts(78, 52, 82, 52, 85, 90, 75, 90));
            sp.part(tie, TIE, light: LIGHT, lit: 2, sh: 2, cast: 1);
            sp.line(79, 54, 80, 66, PAL.coralL);
            // Insignia de la solapa: moneda con un ojo
            R(g, 94, 55, 3, 3, PAL.yellowD); R(g, 95, 55, 1, 1, PAL.yellowL); R(g, 95, 56, 1, 1, PAL.coalD);
            return sp.canvas;
        }

        // La cabeza: cara ancha y naranja con la marca blanca de las gafas, ojos entornados y boca de pato.
        // eyes: open | blink | down | wide | smug | wink · mouth: o | talk | wide | grin | smirk
        static readonly (double x, double y)[] FACE = Pts(67, 24, 70, 19, 76, 17, 84, 17, 90, 19, 93, 24, 94, 31, 93, 38, 90, 43, 85, 46, 80, 47, 75, 46, 70, 43, 67, 38, 66, 31);
        static readonly Dictionary<char, string> HPAL = new Dictionary<char, string>
        {
            ['K'] = "#3A1A14", ['w'] = "#F8F4FF", ['b'] = "#4F78C8", ['k'] = TAN[1], ['y'] = PAL.yellowD, ['Y'] = PAL.yellow,
            ['l'] = "#B5452F", ['m'] = "#7A2420", ['D'] = "#2A0C14", ['t'] = PAL.coral, ['T'] = PAL.white,
        };
        // Manos (en este archivo porque usan TAN: el orden de inicialización entre archivos partial no está definido)
        static readonly Dictionary<char, string> HANDPAL = new Dictionary<char, string>
        {
            ['K'] = "#4A1A16", ['D'] = TAN[1], ['m'] = TAN[2], ['s'] = TAN[3], ['L'] = TAN[4],
        };
        static readonly Dictionary<string, string[]> EYES = new Dictionary<string, string[]>
        {
            ["open"] = new[] { "KKKKK", "kwbwk" },
            ["blink"] = new[] { ".....", "KKKKK" },
            ["down"] = new[] { ".....", "KKKKK", ".kkk." },
            ["wide"] = new[] { ".KKK.", "KwbwK", ".kkk." },
            ["smug"] = new[] { "KKKKK", "kKbKk" },
        };
        static readonly Dictionary<string, string[]> MOUTHS = new Dictionary<string, string[]>
        {
            ["o"] = new[] { ".lll.", "lmDml", ".lll." },
            ["talk"] = new[] { ".lll.", "lmDml", "lDtDl", ".lll." },
            ["wide"] = new[] { ".lllll.", "lTTTTTl", "lDDtDDl", ".lllll." },
            ["grin"] = new[] { "ll...ll", ".lTTTl.", "..lll.." },
            ["smirk"] = new[] { ".....ll", ".llll.." },
        };
        static Canvas buildHead(string eyes, string mouth)
        {
            var sp = new PK.Sprite(W, H); var g = sp.g;
            var ears = sp.mask().ellipse(65.5, 31, 2.2, 3.6).ellipse(94.5, 31, 2.2, 3.6);
            sp.part(ears, TAN, light: LIGHT, baseIdx: 2);
            var face = sp.mask().poly(FACE);
            sp.part(face, TAN, light: LIGHT, lit: 3, sh: 3, baseIdx: 2, cast: 1);
            sp.rim(face, BACK, -1, 0);
            // La marca de las gafas de sol (piel sin broncear)
            Px.ellipse(g, 74, 30, 4, 2, PALE); Px.ellipse(g, 86, 30, 4, 2, PALE);
            R(g, 70, 32, 1, 1, TAN[3]); R(g, 90, 32, 1, 1, TAN[3]);
            // Ojos y cejas
            var L = eyes == "wink" ? EYES["open"] : Pick(EYES, eyes, "open");
            var Rr = eyes == "wink" ? EYES["blink"] : L;
            sp.stamp(L, 72, 29, HPAL).stamp(Rr, 84, 29, HPAL);
            int up = eyes == "wide" ? -1 : 0;
            sp.stamp(new[] { "yYYY." }, 71, 27 + up, HPAL).stamp(new[] { ".YYYy" }, 84, 27 + up, HPAL);
            if (eyes == "down") { R(g, 72, 28, 4, 1, PAL.yellowD); R(g, 85, 28, 4, 1, PAL.yellowD); }
            // Nariz, mofletes y papada
            R(g, 81, 31, 1, 3, TAN[4]); R(g, 78, 35, 5, 1, TAN[1]); R(g, 78, 34, 1, 1, TAN[1]); R(g, 82, 34, 1, 1, TAN[1]);
            R(g, 69, 37, 2, 1, PAL.orangeD); R(g, 90, 37, 2, 1, PAL.orangeD);
            R(g, 76, 45, 8, 1, TAN[1]); R(g, 70, 41, 1, 2, TAN[1]); R(g, 89, 41, 1, 2, TAN[1]);
            var M = Pick(MOUTHS, mouth, "o");
            sp.stamp(M, 80 - M[0].Length / 2, 39, HPAL);
            return sp.canvas;
        }

        // El tupé: volumen enorme peinado hacia un lado y un mechón delantero que se levanta (flap = 1)
        static Canvas buildHair(bool flap)
        {
            var sp = new PK.Sprite(W, H);
            int f = flap ? 1 : 0;
            // Detrás: el volumen, más alto del lado de la raya (izquierda) y peinado hacia atrás por los lados
            var back = sp.mask().poly(Pts(63, 28, 62, 19, 63, 13, 69, 8, 80, 6, 91, 7, 97, 11, 100, 17, 99, 25, 97, 30, 94, 28, 93, 22, 67, 22, 66, 29));
            sp.part(back, HAIR, light: LIGHT, lit: 2, sh: 3, baseIdx: 1);
            sp.rim(back, BACK, 0, -1);
            // Delante: la ola. Nace en la raya, cruza la frente y cae sobre la sien derecha (con el aire, se levanta)
            var wave = sp.mask().poly(Pts(64, 18 - f, 69, 11 - f, 80, 8 - f, 91, 10 - f, 98, 15 - f, 100, 22, 97, 26, 94, 21, 87, 18, 78, 18, 71, 20, 66, 24));
            sp.part(wave, HAIR, light: LIGHT, lit: 3, sh: 2, baseIdx: 2, cast: 1);
            sp.rim(wave, BACK, 0, -1);
            // La raya, los surcos del peine (siguen la ola) y el brillo de la laca
            sp.line(64, 15, 65, 21, PAL.yellowDD);
            sp.line(68, 15 - f, 78, 11 - f, PAL.yellowD).line(78, 11 - f, 90, 12 - f, PAL.yellowD);
            sp.line(68, 19, 79, 15 - f, PAL.yellowD).line(79, 15 - f, 93, 17 - f, PAL.yellowD);
            sp.line(72, 12 - f, 82, 10 - f, PAL.creamL).line(84, 12 - f, 91, 13 - f, PAL.yellowL).line(94, 16 - f, 97, 19 - f, PAL.yellowL);
            sp.line(95, 23, 97, 28, PAL.yellowD);
            return sp.canvas;
        }
    }
}
