// Bailout (parte 3): dibujo de un fotograma (DRAW DE UN FOTOGRAMA: V = lo que hay que enseñar; también lo usan las
// pruebas para hacer capturas), el teléfono por capas, el despacho, la interfaz de la videollamada y "BRRRRR".
// Ver Bailout.cs.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using LV = SaldoNegro.Logic.V;

namespace SaldoNegro
{
    public sealed partial class Bailout
    {
        // =====================================================================================================
        // DIBUJO DE UN FOTOGRAMA (V = lo que hay que enseñar; también lo usan las pruebas para hacer capturas)
        // =====================================================================================================
        // layer: 'base' (la habitación, el móvil y su pantalla), 'hands' (las manos, que van por encima de los textos
        // de la pantalla: el dedo tapa el texto, no al revés) o nada (todo junto)
        static void drawPhone(Ctx2D b, BailoutView V, string layer = null)
        {
            var hold = HoldHand();
            double bob = JsMath.round(JsMath.sin(V.t * 1.3) * 0.6);
            if (layer != "hands")
            {
                b.drawImage(cached("room", buildRoom), 0, 0);
                b.save(); b.translate(0, bob + PDY);
                b.drawImage(hold.back, 0, 0);
                b.drawImage(cached("phone", buildPhone), 0, 0);
                drawScreen(b, V);
                b.restore();
            }
            if (layer != "base")
            {
                b.save(); b.translate(0, bob + PDY);
                b.drawImage(hold.front, 0, 0);
                // El dedo: la mano del ratón de la partida, señalando; va al objetivo y se hunde un píxel al pulsar
                var f = V.finger;
                if (f != null)
                {
                    var tap = SN.Hero.pointHand("night");
                    b.drawImage(tap.c, JsMath.round(f.x) - tap.tip.x, JsMath.round(f.y) - tap.tip.y + (f.down ? 1 : 0));
                    if (f.down) { b.globalAlpha = 0.5; Px.circleOutline(b, JsMath.round(f.x), JsMath.round(f.y), 3, PAL.creamL); b.globalAlpha = 1; }
                }
                b.restore();
            }
        }

        static void drawCall(Ctx2D b, BailoutView V)
        {
            b.drawImage(cached("office", buildOffice), 0, 0);
            string g = V.gesture;
            double nod = V.nod, breath = JsMath.round(JsMath.sin(V.t * 2) * 0.5 + 0.5);
            double lean = g == "sign" ? 1 : 0;
            b.drawImage(cached("body", buildBody), 0, breath);
            var head = cached("head|" + V.eyes + "|" + V.mouth, () => buildHead(V.eyes, V.mouth));
            b.drawImage(head, 0, nod + lean);
            b.drawImage(cached("hair|" + (V.flap ? 1 : 0), () => buildHair(V.flap)), 0, nod + lean);
            b.drawImage(cached("desk|" + (V.press > 0.5 ? 1 : 0), () => buildDesk(V.press)), 0, 0);
            if (g == "show")
            {
                b.drawImage(cached("folder", buildFolder), 0, V.lift);
            }
            else
            {
                double k = V.armK;
                b.drawImage(cached("arms|" + g + "|" + Js.String(k), () => buildArms(g, k)), 0, 0);
            }
            // Billetes volando hacia la cámara
            foreach (var p in V.bills) bill(b, (int)JsMath.round(p.x), (int)JsMath.round(p.y), p.z > 0.55, (int)Math.Floor(p.spin) % 3);
        }

        static void up(Ctx2D g, Ctx2D b) { g.drawImage(b.canvas, 0, 0, W, H, 0, 0, 640, 360); }

        // Dibuja el fotograma en el lienzo g (640x360) con el búfer 160x90 de drawBuf
        public void draw(Ctx2D g, BailoutView V)
        {
            var b = drawBuf ?? (drawBuf = Px.ctx(Px.canvas(W, H)));
            b.clearRect(0, 0, W, H);
            b.imageSmoothingEnabled = false;
            g.imageSmoothingEnabled = false;
            double z = V.zoom;
            if (V.scene == "phone" && z > 0)
            {
                // Zoom hacia la pantalla del móvil (al aceptar la videollamada): todo junto y sin textos
                drawPhone(b, V);
                double k = Util.ease.inOutSine(z);
                double sw = Util.lerp(W, SCR_W, k), sh = Util.lerp(H, SCR_W * H / (double)W, k);
                double sx = Util.lerp(0, SCR_X, k), sy = Util.lerp(0, SCR_Y + 16 + PDY, k);
                g.drawImage(b.canvas, sx, sy, sw, sh, 0, 0, 640, 360);
            }
            else if (V.scene == "phone")
            {
                // El móvil, los textos de su pantalla y, encima de todo, las manos
                drawPhone(b, V, "base"); up(g, b);
                screenText(g, V);
                b.clearRect(0, 0, W, H);
                drawPhone(b, V, "hands"); up(g, b);
            }
            else
            {
                if (V.scene == "call") drawCall(b, V);
                else if (V.scene == "insert") { var tip = drawInsert(b, V.sig, V.t); V.tip = new Pt(tip.x, tip.y); }
                else R(b, 0, 0, W, H, PAL.coalDD);
                up(g, b);
            }
            if (V.scene == "call") callUI(g, V);
            if (V.scene == "insert")
            {
                Px.text(g, TX()["order"][0], 312, 92, PAL.coalL, size: 16, align: "center");
                Px.text(g, TX()["order"][1], 312, 116, PAL.coalL, align: "center");
            }
            if (V.flash > 0) { g.globalAlpha = JsMath.min(1, V.flash); R(g, 0, 0, 640, 360, PAL.creamL); g.globalAlpha = 1; }
            if (V.brr > 0) brrr(g, V);
            if (V.fade > 0) { g.globalAlpha = JsMath.min(1, V.fade); R(g, 0, 0, 640, 360, PAL.coalDD); g.globalAlpha = 1; }
            if (V.ended) Px.text(g, TX()["ended"], 320, 172, PAL.coral, align: "center", size: 16);
        }

        // La interfaz de la videollamada: en directo, el lugar y tu cara en la ventanita
        static void callUI(Ctx2D g, BailoutView V)
        {
            var X = TX();
            R(g, 0, 0, 640, 22, "rgba(14,10,28,0.55)");
            if (Math.Floor(V.t * 2) % 2 == 0) Px.ellipse(g, 14, 11, 4, 4, PAL.coral);
            Px.text(g, X["live"], 24, 15, PAL.creamL);
            Px.text(g, X["place"], 92, 15, PAL.yellowL);
            for (int i = 0; i < 4; i++) R(g, 616 + i * 5, 16 - i * 3, 3, 3 + i * 3, i < 3 ? PAL.creamL : PAL.creamDD);
            // Tu cara (el primer plano del protagonista, a escala 1:1)
            if (SN.Cine != null)
            {
                var tmp = callTmp ?? (callTmp = Px.ctx(Px.canvas(640, 360)));
                SN.Cine.renderFace(tmp, LV.Obj("type", "face", "expr", V.hero ?? "worried", "opts", LV.Obj(), "t", V.t, "night", true));
                // Recorte de la cara al doble (cada píxel del primer plano = 2 del escenario: nítido)
                int x = 472, y = 30;
                R(g, x - 3, y - 3, 166, 96, PAL.coalDD); R(g, x - 2, y - 2, 164, 94, PAL.creamL);
                g.drawImage(SN.Cine.buf, 40, 23, 80, 45, x, y, 160, 90);
                Px.text(g, JsString.upper(X["you"].str), x + 5, y + 85, PAL.creamL, outline: PAL.coalDD);
            }
        }

        // "BRRRRR": la impresora de dinero
        static void brrr(Ctx2D g, BailoutView V)
        {
            int n = 2 + Math.Min(5, (int)Math.Floor(V.brr * 6));
            string word = "BR" + JsString.repeat("R", n) + "!";
            double sx = JsMath.round(JsMath.sin(V.t * 70) * 2), sy = JsMath.round(JsMath.cos(V.t * 63) * 2);
            Px.text(g, word, 320 + sx, 70 + sy, PAL.yellow, size: 32, align: "center", outline: PAL.coalDD);
        }
    }
}
