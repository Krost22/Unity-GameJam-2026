// Port de js/render/chart.js (SN.Chart): gráfica de velas japonesas conectada al simulador: dibuja el historial real
// del mercado, la PISTA (un cono hacia el futuro calculado con el estado real del mercado), la operación abierta y
// sus efectos. Durante una operación revela las velas una a una, sin inventar nada: son las velas simuladas.
// La vela con giro inesperado la conduce SN.Drama (cámara lenta: amago, latigazo y golpe).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Chart
    {
        const int PITCH = 5;            // px por vela sin zoom
        const int TOP = 5, BOTTOM = 5;  // márgenes del área de trazado
        const int AXIS = 31;            // ancho de la escala de precios
        const int CONE = 9;             // huecos reservados a la PISTA (el futuro) a la derecha
        const double SNAP = 0.72;       // punto de la vela de giro en el que llega el latigazo

        public sealed class ViewRange { public double min, max; public bool ready; }
        public sealed class Flash { public double t; }
        sealed class Item { public V c; public int idx, slot; }
        struct Pt { public double x, y; }

        public DomElement canvas;
        public Ctx2D g;
        public int W, H;
        public V market = V.@null;
        public V anim = V.@null;
        public ViewRange view = new ViewRange { min = 0, max = 1, ready = false };
        public double t;
        public double zoom;             // 0..1 acercamiento de la cámara lenta
        public double kick;             // sacudida vertical tras una vela fuerte
        public Flash flash;             // destello de la vela recién cerrada
        public double livePrice;
        public double lastX, lastY, pitch = PITCH;
        public Action<V> onPop;         // (candle) efectos al completar una vela

        public void init(DomElement canvas)
        {
            this.canvas = canvas;
            g = canvas.getContext();
            g.imageSmoothingEnabled = false; // lo mismo que Px.ctx
            W = canvas.width;
            H = canvas.height;
        }

        public void setMarket(V id)
        {
            if (market != id) view.ready = false;
            market = id;
        }

        // Revela las últimas n velas del historial una a una.
        // opts: { speed, onCandle(i, candle), onDone, climax (índice 0..n-1, -1 = ninguno), holdAt, endHold }
        public void play(double n, V opts = null)
        {
            V o = (object)opts != null ? opts : V.undefined;
            anim = JsObject.Assign(
                V.Obj("speed", 0.38, "climax", -1, "holdAt", -1, "endHold", 0.15, "onCandle", V.@null, "onDone", V.@null),
                o,
                V.Obj("total", n, "revealed", 0, "p", 0, "fast", 1, "held", false, "ending", 0, "climaxDone", false));
        }

        public void fast(double k = 4)
        {
            V a = anim;
            if (!a || a["held"].truthy) return;
            a["fast"] = JsMath.max(a["fast"].num, k);
            SN.Drama.hurry();
        }

        public void release() { if (anim.truthy) anim["held"] = false; }

        public double hidden() { return anim.truthy ? anim["total"].num - anim["revealed"].num : 0; }

        public V tradeCandle(V k)
        {
            V h = SN.Market.state(market)["history"];
            return h[h.length - anim["total"] + k];
        }

        // Posición (en px de la pantalla del monitor) de la última vela visible
        public V lastCandlePos()
        {
            V pos = SN.UI.posIn(Dom.byId("chart-wrap"));
            return V.Obj("x", pos["x"].num + lastX + Math.Floor(pitch / 2), "y", pos["y"].num + lastY);
        }

        // Duración de cada vela: las de la zona de peligro van más despacio (anticipación)
        double candleDur(double i)
        {
            V a = anim;
            bool danger = i >= a["total"].num - SN.Data["sim"]["dangerCandles"].num;
            return a["speed"].num * (danger ? 1.35 : 1);
        }

        public void update(double dt) { update(dt, dt); }

        public void update(double dt, double realDt)
        {
            t += dt;
            kick *= JsMath.pow(0.002, realDt);
            if (Math.Abs(kick) < 0.3) kick = 0;
            if (flash != null && (flash.t -= dt) <= 0) flash = null;
            // El zoom de la cámara lenta entra y sale en tiempo real (no se ralentiza a sí mismo)
            double zt = SN.Drama.active ? 1 : 0;
            zoom += (zt - zoom) * JsMath.min(1, realDt * (zt != 0 ? 2.4 : 3.2));
            if (zoom < 0.01) zoom = 0;

            V a = anim;
            if (!a) return;
            if (a["revealed"].num >= a["total"].num)
            {
                a["ending"] = a["ending"].num - dt;
                if (a["ending"].num <= 0) { V done = a["onDone"]; anim = V.@null; if (done.truthy) done.call(); }
                return;
            }
            if (a["held"].truthy) return;
            double i = a["revealed"].num;
            if (i == a["climax"].num && !a["climaxDone"])
            {
                if (!SN.Drama.active) SN.Drama.begin(this, a);
                a["p"] = SN.Drama.p;
                if (a["p"].num < 1) return;
                a["climaxDone"] = true;
            }
            else
            {
                a["p"] = a["p"].num + dt * a["fast"].num / candleDur(i);
            }
            while (a["p"].num >= 1 && a["revealed"].num < a["total"].num)
            {
                a["p"] = a["p"].num - 1;
                a["revealed"] = a["revealed"].num + 1;
                V candle = tradeCandle(a["revealed"].num - 1);
                flash = new Flash { t = 0.14 };
                if (a["onCandle"].truthy) a["onCandle"].call(a["revealed"], candle);
                if (onPop != null) onPop(candle);
                if (!anim) return;
                if (a["revealed"].num >= a["total"].num)
                {
                    a["p"] = 0;
                    a["ending"] = a["climax"].num == a["total"].num - 1 ? JsMath.max(a["endHold"].num, 0.9) : a["endHold"].num;
                    break;
                }
                if (a["revealed"].num == a["holdAt"].num) { a["p"] = 0; a["held"] = true; SN.Events.emit("chart:held"); break; }
                if (a["revealed"].num == a["climax"].num) { a["p"] = 0; break; }
            }
        }

        public void render()
        {
            if (g == null || !market || !SN.State.run) return;
            V run = SN.State.run;
            V m = SN.Market.state(market);
            V a = anim;
            V rpos = run["position"];
            V pos = rpos.truthy && rpos["market"] == market ? rpos : V.@null;
            double z = zoom;
            double pitchD = JsMath.round(PITCH + z * 6), bw = pitchD - 2;
            pitch = pitchD;
            int plotW = W - AXIS - 2, plotH = H - TOP - BOTTOM;
            int slots = (int)Math.Floor((plotW - 2) / pitchD);
            V hint = !a && !pos && m["unlocked"].truthy ? SN.Market.hint(market) : V.@null;
            int margin = hint.truthy ? CONE : z > 0.05 ? 3 : 2;
            int hid = (int)hidden();
            V hist = m["history"];
            int histLen = (int)hist.length.num;
            int visibleEnd = histLen - hid;
            V forming = a.truthy && a["revealed"].num < a["total"].num ? hist[visibleEnd] : V.@null;
            int count = (int)JsMath.max(1, JsMath.min(visibleEnd + (forming.truthy ? 1 : 0), slots - margin));
            int start = visibleEnd + (forming.truthy ? 1 : 0) - count;
            var items = new List<Item>();
            for (int i = 0; i < count; i++)
            {
                int idx = start + i;
                V c = hist[idx];
                if (forming.truthy && idx == visibleEnd)
                    c = a["revealed"].num == a["climax"].num
                        ? ClimaxPartial(c, a["p"].num)
                        : PartialCandle(c, Util.ease.outCubic(JsMath.min(1, a["p"].num)));
                items.Add(new Item { c = c, idx = idx, slot = i });
            }
            Item last = items[items.Count - 1];
            double lastClose = last.c["c"].num;
            livePrice = lastClose;

            // ---------- Escala de precios ----------
            double lo = double.PositiveInfinity, hi = double.NegativeInfinity;
            int from = z > 0.05 ? (int)JsMath.max(0, items.Count - 9) : 0;
            for (int i = from; i < items.Count; i++) { lo = JsMath.min(lo, items[i].c["l"].num); hi = JsMath.max(hi, items[i].c["h"].num); }
            if (a.truthy && a["climax"].num >= 0 && z > 0.05)
            {
                // Durante la cámara lenta el encuadre es simétrico respecto al precio: no delata hacia dónde irá
                V cc = tradeCandle(a["climax"]);
                double span = JsMath.max(cc["h"].num - cc["l"].num, Math.Abs(cc["c"].num - cc["o"].num)) * 1.15;
                lo = JsMath.min(lo, lastClose - span); hi = JsMath.max(hi, lastClose + span);
            }
            if (pos.truthy && !(z > 0.05))
            {
                double entry = pos["entry"].num, lev = pos["leverage"].num, dirn = pos["direction"].num;
                lo = JsMath.min(lo, entry); hi = JsMath.max(hi, entry);
                double liq = entry * (1 - dirn / lev);
                if (lev > 1 && !pos["settled"] && Math.Abs(liq - entry) / entry < 0.25) { lo = JsMath.min(lo, liq); hi = JsMath.max(hi, liq); }
            }
            if (hint.truthy)
            {
                double spread = hint["sd"].num * 0.8;
                lo = JsMath.min(lo, lastClose * JsMath.exp(JsMath.min(0, hint["move"].num) - spread));
                hi = JsMath.max(hi, lastClose * JsMath.exp(JsMath.max(0, hint["move"].num) + spread));
            }
            double pad = (hi - lo) * 0.08;
            if (pad == 0 || double.IsNaN(pad)) pad = hi * 0.01;
            double tMin = lo - pad, tMax = hi + pad;
            ViewRange v = view;
            if (!v.ready) { v.min = tMin; v.max = tMax; v.ready = true; }
            double ez = z > 0.05 ? 0.12 : 0.2;
            v.min += (tMin - v.min) * ez;
            v.max += (tMax - v.max) * ez;
            double ky = JsMath.round(kick);
            Func<double, double> yOf = p => JsMath.round(TOP + (v.max - p) / (v.max - v.min) * plotH) + ky;
            Func<int, double> xOf = slot => 2 + slot * pitchD;

            // ---------- Fondo ----------
            double pnlNow = pos.truthy && !pos["settled"] ? (lastClose - pos["entry"].num) * pos["direction"].num : 0;
            R(g, 0, 0, W, H, PAL.navy);
            if (pos.truthy && !pos["settled"] && a.truthy)
                R(g, 0, 0, plotW + 1, H, pnlNow >= 0 ? "rgba(61,220,132,0.08)" : "rgba(255,79,109,0.09)");
            if (a.truthy && a["revealed"].num >= a["total"].num - SN.Data["sim"]["dangerCandles"].num
                && pos.truthy && !pos["settled"] && Math.Floor(t * 4) % 2 == 0)
            {
                for (int y = 0; y < H; y += 4) R(g, plotW - 2, y, 2, 2, PAL.orange);
            }

            // Cuadrícula y escala
            double step = JsMath.max(1, NiceStep((v.max - v.min) / 3.2));
            for (double p = Math.Ceiling(v.min / step) * step; p <= v.max; p += step)
            {
                double y = yOf(p);
                if (y < TOP - 2 || y > H - BOTTOM) continue;
                for (int x = 1; x < plotW; x += 3) R(g, x, y, 1, 1, PAL.navyL);
                Px.text(g, FmtPrice(p), W - AXIS + 2, y + 4, PAL.creamDD);
            }
            R(g, plotW + 1, 0, 1, H, PAL.navyLL);

            // ---------- Operación: sombreado entre la entrada y el precio ----------
            double firstIdx = pos.truthy ? histLen - pos["candles"].num : -1;
            int entrySlot = pos.truthy ? items.FindIndex(it => it.idx == firstIdx) : -1;
            if (pos.truthy && !pos["settled"])
            {
                double ys = yOf(pos["entry"].num), yc = yOf(lastClose);
                double x0 = entrySlot >= 0 ? xOf(entrySlot) - 1 : 1;
                R(g, x0, JsMath.min(ys, yc), plotW - x0, Math.Abs(yc - ys) + 1, pnlNow >= 0 ? "rgba(61,220,132,0.2)" : "rgba(255,79,109,0.2)");
            }

            // Media móvil (tendencia)
            V sma = SN.Market.sma(hist, 8);
            bool hasPrev = false;
            Pt prev = default(Pt);
            foreach (var it in items)
            {
                V s = forming.truthy && it.idx == visibleEnd ? V.@null : sma[it.idx];
                if (s.isNullish) { hasPrev = false; continue; }
                var pt = new Pt { x = xOf(it.slot) + Math.Floor(bw / 2), y = yOf(s.num) };
                if (hasPrev) Px.line(g, prev.x, prev.y, pt.x, pt.y, "rgba(168,128,255,0.6)");
                prev = pt;
                hasPrev = true;
            }

            // ---------- Velas ----------
            double exitIdx = pos.truthy && pos["cashed"].truthy ? firstIdx + pos["cashedAt"].num : double.PositiveInfinity;
            foreach (var it in items)
            {
                V c = it.c;
                double x = xOf(it.slot);
                bool ghost = it.idx > exitIdx; // lo que pasó cuando ya no estabas dentro
                if (ghost) g.globalAlpha = 0.38;
                DrawCandle(g, c, x, bw, yOf, flash != null && ReferenceEquals(it, last));
                if (c["m"].truthy)
                {
                    double yh = yOf(c["h"].num), yl = yOf(c["l"].num), cx = x + Math.Floor(bw / 2);
                    if (c["m"] == "pos") { R(g, cx, yh - 5, 1, 1, PAL.greenD); R(g, cx - 1, yh - 4, 3, 1, PAL.greenD); R(g, cx - 2, yh - 3, 5, 1, PAL.greenD); }
                    else { R(g, cx - 2, yl + 3, 5, 1, PAL.coralD); R(g, cx - 1, yl + 4, 3, 1, PAL.coralD); R(g, cx, yl + 5, 1, 1, PAL.coralD); }
                }
                g.globalAlpha = 1;
            }
            lastX = xOf(last.slot);
            lastY = yOf(lastClose);

            // ---------- Entrada, liquidación y cobro ----------
            if (pos.truthy)
            {
                double ys = yOf(pos["entry"].num);
                for (int x = 1; x < plotW; x += 4) R(g, x, ys, 2, 1, PAL.yellowDD);
                if (entrySlot >= 0)
                {
                    double ex = xOf(entrySlot) + Math.Floor(bw / 2);
                    string col = pos["direction"].num > 0 ? PAL.greenD : PAL.coralD;
                    if (pos["direction"].num > 0) { R(g, ex - 2, ys + 3, 5, 1, col); R(g, ex - 1, ys + 2, 3, 1, col); R(g, ex, ys + 1, 1, 1, col); }
                    else { R(g, ex - 2, ys - 3, 5, 1, col); R(g, ex - 1, ys - 2, 3, 1, col); R(g, ex, ys - 1, 1, 1, col); }
                }
                if (pos["leverage"].num > 1 && !pos["settled"])
                {
                    double yl = yOf(pos["entry"].num * (1 - pos["direction"].num / pos["leverage"].num));
                    if (yl > TOP && yl < H - BOTTOM)
                    {
                        for (int x = 1; x < plotW; x += 4) R(g, x, yl, 2, 1, PAL.coral);
                        g.drawImage(SN.Sprites.get("skull"), 2, yl - 3);
                    }
                }
                if (pos["cashed"].truthy)
                {
                    int slot = items.FindIndex(it => it.idx == exitIdx);
                    if (slot >= 0)
                    {
                        double x = xOf(slot) + Math.Floor(bw / 2), y = yOf(pos["exit"].num);
                        for (int yy = TOP; yy < H - BOTTOM; yy += 3) R(g, x, yy, 1, 2, PAL.navyLL);
                        g.drawImage(SN.Sprites.get("coin0"), x - 4, y - 4);
                    }
                }
            }

            // ---------- PISTA ----------
            if (hint.truthy) DrawCone(g, lastX + bw, lastY, lastClose, hint, yOf, pitchD, t, H);

            // Etiqueta del precio actual en la escala
            double ly = Util.clamp(lastY, TOP, H - BOTTOM - 1);
            for (int x = (int)(lastX + bw + 1); x < plotW; x += 2) if (!hint.truthy) R(g, x, ly, 1, 1, PAL.yellowD);
            R(g, W - AXIS, ly - 5, AXIS, 10, PAL.yellow);
            R(g, W - AXIS, ly - 5, 1, 10, PAL.navyDD);
            Px.text(g, FmtPrice(lastClose), W - AXIS + 2, ly + 4, PAL.navyD);
        }

        static void R(Ctx2D g, double x, double y, double w, double h, string c) { Px.rect(g, x, y, w, h, c); }

        static void DrawCandle(Ctx2D g, V c, double x, double bw, Func<double, double> yOf, bool flash)
        {
            double o = c["o"].num, cl = c["c"].num;
            bool up = cl >= o;
            string fill = up ? PAL.green : PAL.coral, dark = up ? PAL.greenD : PAL.coralD, light = up ? PAL.greenL : PAL.coralL;
            double yh = yOf(c["h"].num), yl = yOf(c["l"].num), mid = x + Math.Floor(bw / 2);
            R(g, mid, yh, 1, JsMath.max(1, yl - yh + 1), dark);
            double yt = yOf(JsMath.max(o, cl)), yb = yOf(JsMath.min(o, cl));
            double bh = JsMath.max(1, yb - yt + 1);
            R(g, x, yt, bw, bh, flash ? PAL.creamL : fill);
            R(g, x + bw - 1, yt, 1, bh, dark);
            if (bh > 2 && !flash) R(g, x, yt, bw - 1, 1, light);
            if (c["tw"].truthy && bh > 3) { R(g, x - 1, yt, 1, bh, PAL.yellow); R(g, x + bw, yt, 1, bh, PAL.yellow); }
        }

        // Cono de la PISTA: desde la última vela hacia la derecha. Ancho = incertidumbre, inclinación = dirección.
        static void DrawCone(Ctx2D g, double x0, double y0, double last, V hint, Func<double, double> yOf, double pitch, double t, int H)
        {
            double len = (CONE - 1) * pitch - 2;
            double dir = hint["dir"].num;
            string col = dir > 0 ? PAL.green : dir < 0 ? PAL.coral : PAL.orange;
            string dark = dir > 0 ? PAL.greenD : dir < 0 ? PAL.coralD : PAL.orangeD;
            // Separador AHORA | FUTURO
            for (int y = 2; y < H - 2; y += 3) R(g, x0 + 1, y, 1, 1, PAL.navyLL);
            double tipY = y0;
            for (double dx = 2; dx <= len; dx++)
            {
                double f = dx / len;
                double mid = last * JsMath.exp(hint["move"].num * f);
                double spread = hint["sd"].num * JsMath.sqrt(f) * 0.8;
                double yU = yOf(mid * JsMath.exp(spread)), yL = yOf(mid * JsMath.exp(-spread)), yM = yOf(mid);
                g.globalAlpha = 0.42;
                for (double y = yU + 1; y < yL; y++) if ((dx + y) % 2 == 0) R(g, x0 + dx, y, 1, 1, col);
                g.globalAlpha = 1;
                R(g, x0 + dx, yU, 1, 1, col); R(g, x0 + dx, yL, 1, 1, col);
                // La línea central avanza hacia el futuro
                if ((((dx - Math.Floor(t * 14)) % 6) + 6) % 6 < 3) R(g, x0 + dx, yM, 1, 1, dark);
                tipY = yM;
            }
            double tx = x0 + len + 1;
            double bob = JsMath.round(JsMath.sin(t * 5) * 1.5);
            if (dir == 0)
            {
                R(g, tx - 3, tipY - 13 + bob, 9, 11, PAL.orange);
                Px.text(g, "?", tx - 1, tipY - 4 + bob, PAL.creamL);
                return;
            }
            // Flechas: una por cada nivel de fuerza
            double power = hint["power"].num;
            for (int i = 0; i < power; i++)
            {
                double cy = dir > 0 ? tipY - 6 - i * 5 + bob : tipY + 6 + i * 5 - bob;
                Chevron(g, tx, cy, dir, i == power - 1 ? (dir > 0 ? PAL.greenL : PAL.coralL) : col);
            }
        }

        static void Chevron(Ctx2D g, double x, double y, double dir, string c)
        {
            for (int r = 0; r < 4; r++)
            {
                double w = 1 + r * 2, yy = dir > 0 ? y + r : y - r;
                R(g, x - r, yy, w, 1, c);
            }
        }

        // Vela a medio formar: el cierre avanza desde la apertura, las mechas crecen con él
        static V PartialCandle(V c, double p)
        {
            double o = c["o"].num, h = c["h"].num, l = c["l"].num, cl = c["c"].num;
            double close = o + (cl - o) * p;
            return V.Obj(
                "o", c["o"],
                "c", close,
                "h", JsMath.max(o, close) + (h - JsMath.max(o, cl)) * p,
                "l", JsMath.min(o, close) - (JsMath.min(o, cl) - l) * p,
                "m", p > 0.6 ? c["m"] : V.undefined);
        }

        // Vela de giro: primero se arrastra (a veces amagando hacia el lado contrario) y en SNAP pega el latigazo
        static V ClimaxPartial(V c, double p)
        {
            double o = c["o"].num, h = c["h"].num, l = c["l"].num, cl = c["c"].num;
            bool up = cl >= o;
            double fake = up ? l : h, far = up ? h : l;
            bool feint = Math.Abs(fake - o) > Math.Abs(cl - o) * 0.2;
            double target = feint ? o + (fake - o) * 0.85 : o + (cl - o) * 0.22;
            double price, a, b;
            if (p < SNAP)
            {
                price = o + (target - o) * Util.ease.inOutSine(p / SNAP);
                a = price; b = price;
            }
            else
            {
                double q = Util.ease.outCubic(JsMath.min(1, (p - SNAP) / (1 - SNAP)));
                price = target + (cl - target) * q;
                a = feint ? target + (fake - target) * q : price;
                b = cl + (far - cl) * q;
            }
            return V.Obj(
                "o", c["o"],
                "c", price,
                "h", JsMath.max(o, price, a, b),
                "l", JsMath.min(o, price, a, b),
                "m", p >= 1 ? c["m"] : V.undefined,
                "tw", p >= SNAP ? 1 : 0);
        }

        static double NiceStep(double raw)
        {
            double exp = JsMath.pow(10, Math.Floor(JsMath.log10(raw)));
            double f = raw / exp;
            return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * exp;
        }

        static string FmtPrice(double p)
        {
            return Js.String(JsMath.round(p)); // precios enteros
        }
    }
}
