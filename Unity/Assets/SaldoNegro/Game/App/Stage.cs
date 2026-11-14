// El escenario: el equivalente al #viewport y al #stage de index.html, dentro de un panel de UI Toolkit.
//   viewport   toda la ventana, con el degradado de fondo de css/style.css (#viewport)
//     stage    640x360 px de pixel art, colocado con translate + scale como en la web
//       desk   el lienzo de la habitación (320x180, se ve al doble)
//       ...    monitor, cinemáticas, fundido... (llegan en las fases siguientes, en el mismo orden que en el HTML)
//
// El escalado es el de la web (js/core/game.js: layout y applyCam), con decimales incluidos: la escala es
// min(ancho / 640, alto / 360) y, en ventanas pequeñas, la cámara se acerca al monitor. No se redondea a enteros.
// Las medidas van en píxeles CSS: los píxeles de pantalla divididos por `dpr` (devicePixelRatio).
// FASE 2: sin el enfoque de la cámara lenta ni los planos de cinemática, que llegan con Game (fases 5 y 7).
using System;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class Stage
    {
        public const int W = 640, H = 360;                 // SN.W, SN.H
        public const int ROOM_W = 320, ROOM_H = 180;       // el lienzo de la habitación (#desk)
        public static readonly RectInt SCREEN = new RectInt(108, 14, 420, 236); // SN.SCREEN: la pantalla del monitor

        public readonly VisualElement viewport, stage;
        public readonly CanvasElement desk, background;
        public readonly Canvas deskCanvas;

        // Estado del encuadre (los mismos nombres que en SN.Game)
        public double @base = 1, vw, vh, z = 1, dpr = 1;
        public string mode = "full";
        public int tx, ty;
        public double camX = 320, camY = 180, camZoom = 1, pulse = 0;
        string camKey = "";
        int screenW = -1, screenH = -1;

        public Stage(VisualElement root)
        {
            viewport = new VisualElement { name = "viewport", pickingMode = PickingMode.Ignore };
            viewport.style.position = Position.Absolute;
            viewport.style.left = 0; viewport.style.top = 0; viewport.style.right = 0; viewport.style.bottom = 0;
            viewport.style.overflow = Overflow.Hidden;
            root.Add(viewport);

            background = new CanvasElement(new Canvas(1, 1)) { name = "viewport-bg" };
            background.style.position = Position.Absolute;
            background.style.left = 0; background.style.top = 0;
            viewport.Add(background);

            stage = new VisualElement { name = "stage", pickingMode = PickingMode.Ignore };
            stage.style.position = Position.Absolute;
            stage.style.left = 0; stage.style.top = 0;
            stage.style.width = W; stage.style.height = H;
            stage.style.transformOrigin = new TransformOrigin(0, 0);
            viewport.Add(stage);

            deskCanvas = new Canvas(ROOM_W, ROOM_H);
            desk = new CanvasElement(deskCanvas) { name = "desk" };
            desk.style.position = Position.Absolute;
            desk.style.left = 0; desk.style.top = 0;
            desk.style.width = W; desk.style.height = H;
            stage.Add(desk);
        }

        // Una vez por fotograma: si la ventana cambió de tamaño, se recoloca; y se suben los lienzos que cambiaron
        public void update(int pixelW, int pixelH)
        {
            if (pixelW != screenW || pixelH != screenH)
            {
                screenW = pixelW; screenH = pixelH;
                layout(pixelW / dpr, pixelH / dpr);
                paintBackground(pixelW, pixelH);
            }
            desk.upload();
            background.upload();
        }

        // ---------- js/core/game.js: layout() ----------
        public void layout(double vw, double vh)
        {
            double b = Math.Min(vw / W, vh / H);
            mode = "full";
            // En pantallas pequeñas la cámara se acerca al monitor para que se pueda leer
            if (b < 1.55)
            {
                double mz = Math.Min(vw / 452, vh / 270);
                if (mz > b * 1.12) { b = mz; mode = "monitor"; }
            }
            @base = b; this.vw = vw; this.vh = vh;
            camKey = "";
            applyCam();
        }

        // ---------- js/core/game.js: applyCam() (sin enfoque ni planos de cinemática todavía) ----------
        public void applyCam()
        {
            double b = @base, fx = camX, fy = camY, zoom = camZoom;
            // En pantallas pequeñas la cámara se queda centrada en el monitor
            if (mode == "monitor") { fx = SCREEN.x + SCREEN.width / 2.0; fy = SCREEN.y + SCREEN.height / 2.0 - 4; }
            zoom *= 1 + pulse;
            double zz = b * zoom;
            double tX = JsMath.round(vw / 2 - fx * zz), tY = JsMath.round(vh / 2 - fy * zz);
            // Con zoom, la cámara nunca enseña lo que hay fuera del escenario
            double sw = W * zz, sh = H * zz;
            if (sw >= vw) tX = JsMath.round(clamp(tX, vw - sw, 0));
            if (sh >= vh) tY = JsMath.round(clamp(tY, vh - sh, 0));
            string key = tX + "," + tY + "," + zz.ToString("F4", System.Globalization.CultureInfo.InvariantCulture);
            if (key == camKey) return;
            camKey = key;
            tx = (int)tX; ty = (int)tY; z = zz;
            // transform: translate(tx px, ty px) scale(z), en píxeles de pantalla
            stage.style.translate = new Translate((float)(tx * dpr), (float)(ty * dpr));
            stage.style.scale = new Scale(new Vector2((float)(z * dpr), (float)(z * dpr)));
        }

        static double clamp(double v, double a, double b) { return Math.Max(a, Math.Min(b, v)); }

        // ---------- css/style.css: #viewport { background: radial-gradient(ellipse at center, ...) } ----------
        // Lo que se ve alrededor del escenario cuando la ventana no es 16:9.
        static readonly int[][] BG = { new[] { 0x2a, 0x1a, 0x44 }, new[] { 0x15, 0x0d, 0x26 }, new[] { 0x0b, 0x07, 0x16 } };
        static readonly double[] BG_AT = { 0, 0.7, 1 };
        void paintBackground(int w, int h)
        {
            if (w <= 0 || h <= 0) return;
            var c = new Canvas(w, h);
            // Elipse hasta la esquina más lejana, con la proporción de la ventana: radios = mitad x raíz de 2
            double cx = w / 2.0, cy = h / 2.0, rx = cx * Math.Sqrt(2), ry = cy * Math.Sqrt(2);
            for (int y = 0; y < h; y++)
            {
                double dy = (y + 0.5 - cy) / ry, dy2 = dy * dy;
                int o = y * w;
                for (int x = 0; x < w; x++)
                {
                    double dx = (x + 0.5 - cx) / rx, t = Math.Sqrt(dx * dx + dy2);
                    int i = t < BG_AT[1] ? 0 : 1;
                    double k = (t - BG_AT[i]) / (BG_AT[i + 1] - BG_AT[i]);
                    if (k < 0) k = 0; else if (k > 1) k = 1;
                    // Chrome (Skia) trama los degradados con una matriz ordenada de 8x8 antes de pasar a 8 bits:
                    // a cada píxel le suma entre -63/128 y +63/128 de nivel según su posición.
                    int Y = y ^ x;
                    int M = (Y & 1) << 5 | (x & 1) << 4 | (Y & 2) << 2 | (x & 2) << 1 | (Y & 4) >> 1 | (x & 4) >> 2;
                    double dither = M * (2 / 128.0) - 63 / 128.0;
                    c.set(o + x, level(BG[i][0] + (BG[i + 1][0] - BG[i][0]) * k + dither), level(BG[i][1] + (BG[i + 1][1] - BG[i][1]) * k + dither), level(BG[i][2] + (BG[i + 1][2] - BG[i][2]) * k + dither), 255);
                }
            }
            c.version++;
            background.setCanvas(c);
            background.style.width = w; background.style.height = h;
        }

        static byte level(double v) { return (byte)(v <= 0 ? 0 : v >= 255 ? 255 : Math.Floor(v + 0.5)); }

        // ---------- Solo para verificar la fase 2 ----------
        // Carta de ajuste en el lienzo de la habitación: la misma fórmula que pinta Unity/Tools~/ref-stage.js en la
        // web. Si el escalado es correcto, la captura de Unity y la de Chrome salen iguales píxel a píxel.
        public void showTestPattern()
        {
            testPattern(deskCanvas);
        }
        public static void testPattern(Canvas c)
        {
            int w = c.width, h = c.height;
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                byte r = (byte)((x * 7 + y * 13) & 255), g = (byte)(((x ^ y) * 3) & 255), b = (byte)((x * y) & 255);
                if (x == 0 || y == 0 || x == w - 1 || y == h - 1) { r = g = b = 255; }                    // marco blanco de 1 px
                else if (x >= 8 && x < 72 && y >= 8 && y < 40) { r = g = b = (byte)(((x + y) & 1) * 255); } // damero de 1 px
                else if (x == y || x == w - 1 - y) { r = 255; g = 211; b = 78; }                              // diagonales
                c.set(y * w + x, r, g, b, 255);
            }
            c.version++;
        }
    }
}
