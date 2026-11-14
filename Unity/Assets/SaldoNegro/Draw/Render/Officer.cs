// Port de js/render/officer.js (SN.Officer): el agente de la Policía Fiscal del embargo (final B). Entra por la
// ventana, se mueve por detrás de la mesa y del monitor, coge cada objeto y lo mete en su caja.
// Las secuencias async de JS son promesas (Promise, async / await) igual que en la web: cada `await` cede el turno
// y lo que va detrás de él corre como microtarea (Microtasks.drain).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Officer
    {
        const int RW = 320, RH = 180;
        const int DESK_Y = 128;               // el borde de la mesa: por debajo, el agente queda tapado
        const int BW = 48, BH = 100, AX = 24; // lienzo del cuerpo (mirando a la derecha) y su eje
        const int TOP = 42;                   // y de la habitación donde empieza (la gorra)
        const int AW = 200, AH = 230, AO = 100, AY = 30; // lienzo de los brazos: eje y margen de arriba
        const double SHOULDER_BACK = -14, SHOULDER_FRONT = 14, SHOULDER_Y = 36;
        const int BOXW = 30;                  // la caja del embargo
        static readonly int[] LIGHT = { 1, -1 };
        const string RIM = "#FF6FC4";         // contraluz de la ventana, de noche (como las manos del protagonista)

        static readonly string[] SHIRT = { "#2A3A7A", "#4A64B0", "#7C9BE0", "#AFC6F5", "#DDE8FF" };
        static readonly string[] NAVY = { "#0B0F2A", "#1F2A66", "#33439A", "#5266C8" };
        static readonly string[] VEST = { PAL.yellowDD, PAL.yellowD, PAL.yellow, PAL.yellowL };
        static readonly string[] SKIN = { PAL.skinDD, PAL.skinD, PAL.skinM, PAL.skin, PAL.skinL };
        static readonly string[] HAIR = { PAL.hairDD, PAL.hairD, PAL.hair };
        static readonly string[] CARD = { "#4A3320", "#7A5A2C", "#A0782E", "#C8A048", "#E3C374" };
        static readonly Dictionary<char, string> FPAL = new Dictionary<char, string> { { 'B', PAL.hairDD }, { 'W', PAL.creamL }, { 'I', PAL.coalDD }, { 'M', PAL.hairD } };

        // Un punto y un trozo de habitación recortado (Desk.cutout)
        public struct Pt { public double x, y; public Pt(double x, double y) { this.x = x; this.y = y; } }

        // ---------- Animaciones: valores que cambian con el tiempo del juego (como SN.wait) ----------
        sealed class Tween { public double t, dur; public Action<double> step; public Func<double, double> ease; public Action res; }
        readonly List<Tween> tweens = new List<Tween>();

        static double lin(double k) { return k; }
        static double orOne(double v) { return v == 0 || double.IsNaN(v) ? 1 : v; }

        Promise tween(double dur, Action<double> step, Func<double, double> ease = null)
        {
            return new Promise((res) =>
            {
                step(0);
                tweens.Add(new Tween { t = 0, dur = Math.Max(0.01, dur), step = step, ease = ease ?? new Func<double, double>(Util.ease.inOutSine), res = res });
            });
        }
        static bool overlap(Cutout a, Cutout b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

        // ---------- Piezas quietas (con caché; la versión en espejo se saca de la original) ----------
        readonly Dictionary<string, Canvas> cache = new Dictionary<string, Canvas>();
        static Canvas flipCanvas(Canvas src)
        {
            var c = Px.canvas(src.width, src.height);
            var g = Px.ctx(c);
            g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
            return c;
        }
        Canvas piece(string key, int dir, Func<Canvas> build)
        {
            if (!cache.ContainsKey(key)) cache[key] = build();
            if (dir > 0) return cache[key];
            if (!cache.ContainsKey(key + "|flip")) cache[key + "|flip"] = flipCanvas(cache[key]);
            return cache[key + "|flip"];
        }

        // Cuello, camisa celeste de hombros anchos, chaleco reflectante con sus bandas, corbata, placa y cinturón
        static Canvas buildBody()
        {
            var sp = new PK.Sprite(BW, BH);
            sp.part(sp.mask().poly(Pts(21, 22, 28, 22, 29, 30, 20, 30)), SKIN, light: LIGHT, baseIdx: 1, outline: false);
            var torso = sp.mask().poly(Pts(5, BH, 5, 41, 7, 35, 12, 31, 19, 28, 30, 28, 36, 31, 41, 35, 43, 41, 43, BH));
            sp.part(torso, SHIRT, light: LIGHT, lit: 2, sh: 3);
            sp.rim(torso, RIM, -1, -1);
            // Hombreras
            sp.rect(7, 33, 6, 2, NAVY[1]).rect(36, 33, 6, 2, NAVY[2]);
            // Chaleco: abierto en pico sobre la camisa y la corbata
            // (por abajo cubre todo el torso: de la camisa solo se ven los hombros y las mangas)
            var vest = sp.mask().poly(Pts(6, 80, 6, 44, 9, 36, 13, 32, 18, 29, 24, 38, 30, 29, 35, 32, 39, 36, 42, 44, 42, 80));
            sp.part(vest, VEST, light: LIGHT, lit: 2, sh: 2);
            sp.line(24, 39, 24, 79, PAL.yellowD);
            foreach (int x in new[] { 13, 33 }) sp.rect(x, 33, 2, 47, PAL.creamD).rect(x, 33, 1, 47, PAL.creamL);
            foreach (int y in new[] { 47, 70 }) sp.rect(7, y, 35, 1, PAL.creamL).rect(7, y + 1, 35, 1, PAL.creamD);
            // Cuello de la camisa y corbata
            sp.part(sp.mask().poly(Pts(19, 28, 23, 30, 22, 34)).poly(Pts(30, 28, 26, 30, 27, 34)), SHIRT, light: LIGHT, baseIdx: 3, outline: false);
            sp.part(sp.mask().poly(Pts(23, 30, 26, 30, 26, 33, 24.5, 37, 23, 33)), NAVY, light: LIGHT, outline: false);
            // La placa: un escudo dorado sobre un parche oscuro
            sp.rect(27, 40, 5, 5, NAVY[0]).rect(28, 41, 3, 3, PAL.yellowD).rect(28, 41, 3, 1, PAL.yellowL).px(28 + 1, 42, PAL.coalD);
            // Cinturón con hebilla
            sp.rect(8, 80, 33, 3, PAL.coalD).rect(8, 80, 33, 1, PAL.coalL).rect(22, 80, 4, 3, PAL.creamD).px(23, 81, PAL.coalD).px(24, 81, PAL.coalD);
            sp.part(sp.mask().rect(6, 83, 37, BH - 83), NAVY, light: LIGHT, baseIdx: 1, outline: false);
            return sp.canvas;
        }

        // Cabeza de tres cuartos: gorra de plato con la banda de cuadros y la placa, cejas en uve, ojos entornados
        // bajo la visera y un bigote enorme. talk: la boca abierta; blink: parpadeo
        static Canvas buildHead(bool talk, bool blink)
        {
            var sp = new PK.Sprite(BW, 32);
            // Pelo corto en la nuca, por debajo de la gorra
            sp.part(sp.mask().ellipse(19, 13.5, 2.6, 4.5), HAIR, light: LIGHT, baseIdx: 1);
            var face = sp.mask().poly(Pts(18, 9, 31, 9, 33, 13, 33, 19, 31, 23, 27, 25, 22, 24, 19, 21, 18, 15)).ellipse(34, 17, 1.4, 1.8);
            sp.part(face, SKIN, light: LIGHT, lit: 2, sh: 2);
            sp.part(sp.mask().ellipse(19.5, 17, 1.4, 2.2), SKIN, light: LIGHT, baseIdx: 2, outline: false);
            sp.px(19, 17, PAL.skinD);
            // Cejas y ojos
            sp.stamp(new[] { "BB..", "..BB" }, 24, 12, FPAL).stamp(new[] { ".BB", "B.." }, 30, 12, FPAL);
            if (!blink) sp.stamp(new[] { "WI" }, 25, 14, FPAL).stamp(new[] { "WI" }, 30, 14, FPAL);
            else sp.rect(25, 14, 2, 1, PAL.skinD).rect(30, 14, 2, 1, PAL.skinD);
            // Boca y bigote
            if (talk) sp.rect(28, 21, 2, 2, "#3A1420");
            else sp.rect(28, 21, 2, 1, PAL.skinDD);
            sp.stamp(new[] { ".MMMMMM.", "MM....MM" }, 25, 19, FPAL);
            // Gorra: copa, banda de cuadros y visera (que da sombra a la frente)
            var crown = sp.mask().poly(Pts(15, 9, 16, 4, 20, 1, 27, 0, 32, 2, 35, 6, 35, 9));
            sp.part(crown, NAVY, light: LIGHT, lit: 1, sh: 1, baseIdx: 1);
            sp.rim(crown, RIM, -1, -1);
            for (int x = 16; x < 35; x++) { int a = ((x - 16) >> 1) % 2; sp.px(x, 7, a != 0 ? PAL.creamL : NAVY[0]).px(x, 8, a != 0 ? NAVY[0] : PAL.creamL); }
            sp.part(sp.mask().poly(Pts(25, 9, 36, 9, 38, 11, 26, 11)), new[] { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL }, light: LIGHT, cast: 1);
            sp.rect(27, 2, 3, 4, PAL.yellowD).rect(28, 3, 1, 2, PAL.yellowL);
            return sp.canvas;
        }

        // La caja del embargo, en dos capas (lo que se lleva asoma entre las dos): el fondo con la solapa de detrás,
        // y el frente con su precinto
        static Canvas buildBox(bool front)
        {
            var sp = new PK.Sprite(BOXW + 4, 28);
            if (!front)
            {
                sp.part(sp.mask().poly(Pts(5, 9, BOXW - 1, 9, BOXW - 3, 4, 7, 4)), CARD, light: LIGHT, baseIdx: 1, lit: 1, sh: 1);
                sp.rect(3, 8, BOXW - 2, 3, CARD[0]);
                return sp.canvas;
            }
            sp.part(sp.mask().rect(2, 9, BOXW, 16), CARD, light: LIGHT, lit: 1, sh: 2, baseIdx: 2);
            sp.rect(2, 9, BOXW, 1, CARD[4]);
            // Precinto rojo y etiqueta
            sp.rect(2, 19, BOXW, 2, PAL.coralD);
            for (int x = 3; x < BOXW + 1; x += 4) sp.rect(x, 19, 2, 2, PAL.creamL);
            sp.rect(10, 11, 14, 7, PAL.coralD).rect(11, 12, 12, 5, PAL.creamL).rect(13, 13, 8, 1, PAL.coralD).rect(13, 15, 5, 1, PAL.creamDD);
            return sp.canvas;
        }

        // Lo que no está en las capas de la habitación: el reloj (va en tu muñeca) y la lista del embargo
        static Canvas watch()
        {
            return Px.fromRows(new[] { ".YYYYYYY.", "YyyWWWyyY", "YyyWkWyyY", "YyyWWWyyY", ".YYYYYYY." },
                new Dictionary<char, string> { { 'Y', PAL.yellowD }, { 'y', PAL.yellow }, { 'W', PAL.creamL }, { 'k', PAL.coalD } });
        }
        static void drawList(Ctx2D g, double x, double y)
        {
            Px.rect(g, x, y, 10, 13, PAL.creamDD); Px.rect(g, x + 1, y, 9, 12, PAL.creamL);
            Px.rect(g, x + 2, y + 2, 7, 1, PAL.coralD);
            for (int i = 0; i < 4; i++) Px.rect(g, x + 2, y + 4 + i * 2, i % 2 != 0 ? 5 : 7, 1, PAL.creamDD);
        }

        static (double x, double y)[] Pts(params double[] v)
        {
            var r = new (double x, double y)[v.Length / 2];
            for (int i = 0; i < r.Length; i++) r[i] = (v[2 * i], v[2 * i + 1]);
            return r;
        }

        // ---------- Brazos: del hombro a la mano (coordenadas del lienzo de los brazos) ----------
        // Casi rectos: el codo se dobla muy poco (bend: hacia qué lado), para que no se retuerzan. Si la mano queda
        // más lejos que el brazo, se estira.
        PK.Sprite armSp;
        static void drawArm(PK.Sprite sp, double sx, double sy, double hx, double hy, double bend, bool finger)
        {
            const double L = 14;
            double dx = hx - sx, dy = hy - sy, d = orOne(JsMath.hypot(dx, dy));
            double h = d < L * 2 ? JsMath.min(2.5, JsMath.sqrt(L * L - d * d / 4)) * bend : 0;
            double ex = sx + dx / 2 - dy / d * h, ey = sy + dy / 2 + dx / d * h;
            double fl = orOne(JsMath.hypot(hx - ex, hy - ey)), ux = (hx - ex) / fl, uy = (hy - ey) / fl;
            sp.part(sp.mask().taper(sx, sy, 3.6, ex, ey, 3.2).taper(ex, ey, 3.2, hx - ux * 3, hy - uy * 3, 2.7), SHIRT, light: LIGHT, lit: 1, sh: 2);
            sp.part(sp.mask().capsule(hx - ux * 4, hy - uy * 4, hx - ux * 3, hy - uy * 3, 2.9), NAVY, light: LIGHT, lit: 1, sh: 1, baseIdx: 2);
            var hand = sp.mask().ellipse(hx, hy, 2.7, 2.7).ellipse(hx + ux * 1.5, hy + uy * 1.5, 2.2, 2.2);
            if (finger) hand.capsule(hx + ux * 2, hy + uy * 2 - 1, hx + ux * 7, hy + uy * 7 - 1, 1.2); // el índice, estirado
            sp.part(hand, SKIN, light: LIGHT, lit: 1, sh: 1, baseIdx: 3);
        }

        // ---------- Estado ----------
        public sealed class Loot { public Canvas img; public double w, h; }
        public sealed class Near { public string id; public Cutout cut; }
        public sealed class Reach { public double ax, ay, bx, by, k; }
        public sealed class Held { public Canvas img; public double w, h, s; }
        public sealed class Carry { public Canvas img; public double rot; }
        public sealed class Drag { public Canvas img; public double x, y, x0; }

        public bool on;
        public double x = -40;
        public int dir = 1;
        public bool walking;
        public double walkT, t;
        public double rise;        // un saltito, para lo que está alto (px)
        public bool box;
        public double dip;
        public List<Loot> loot = new List<Loot>();         // lo que ya va en la caja: { img, w, h }
        public List<string> taken = new List<string>();    // los ids de lo que se ha llevado
        public List<Near> near = new List<Near>();         // lo que está en la mesa por delante de él y lo tapa: { id, cut }
        public Reach reach;       // la mano de delante, de camino: { ax, ay, bx, by, k }
        public Held held;         // lo que lleva en esa mano: { img, w, h, s }
        public Carry carry;       // lo que lleva de pie en la mano, sin guardarlo (la pala): { img, rot }
        public Drag drag;         // el PC, empujado: { img, x, y, x0 }
        public bool grip;         // la mano de delante, en el borde del monitor (lo empuja)
        public bool point;        // señala con el brazo estirado
        public string prop;       // 'list': la lista del embargo en la mano
        public bool talk;         // mueve la boca mientras sale su subtítulo

        public void reset()
        {
            tweens.Clear();
            on = false; x = -40; dir = 1; walking = false; rise = 0; box = false; dip = 0;
            loot = new List<Loot>(); taken = new List<string>(); near = new List<Near>();
            reach = null; held = null; carry = null; drag = null; grip = false; point = false; prop = null; talk = false;
        }

        // ---------- Lo que sabe hacer (cada cosa devuelve una promesa que se cumple al acabar) ----------
        public Promise walkTo(double x, double speed = 80)
        {
            double x0 = this.x, d = Math.Abs(x - x0);
            if (d < 1) return Promise.resolved();
            dir = x > x0 ? 1 : -1;
            walking = true;
            return tween(d / speed, (k) => { this.x = x0 + (x - x0) * k; }, lin).then(() => { walking = false; });
        }

        // Entra por la izquierda (el lado de la ventana) y va hasta x
        public async Promise enter(double x, double speed = 80)
        {
            on = true;
            this.x = -26; dir = 1; rise = 0; box = false; loot = new List<Loot>();
            await walkTo(x, speed);
        }

        // Se va por donde ha venido
        public async Promise leave(double speed = 80)
        {
            await walkTo(-30, speed);
            on = false;
        }

        // Lo que hay en la mesa por delante de él (la consola, los auriculares del monitor...): se pinta encima
        public void occlude(IEnumerable<string> ids)
        {
            near = new List<Near>();
            foreach (var id in ids)
            {
                var cut = SN.Desk.cutout(id);
                if (cut != null) near.Add(new Near { id = id, cut = cut });
            }
        }

        // Va hasta un objeto de la habitación, lo coge y lo mete en la caja. pace: < 1, cada vez con más prisa
        public async Promise take(string id, double pace = 1)
        {
            var Dk = SN.Desk;
            // (el reloj no está en la habitación: está en tu muñeca, por debajo del plano)
            Cutout cut = id == "reloj" ? new Cutout { img = watch(), x = 100, y = 172, w = 9, h = 5 } : Dk.cutout(id);
            taken.Add(id);
            if (cut == null) { Dk.stripped.Add(id); Dk.dirty(); return; }
            // (lo que está en la mesa lo agarra por abajo: así, cuando él va por detrás del monitor, se ve bajar el brazo)
            double cx = cut.x + cut.w / 2, cy0 = cut.y + cut.h / 2;
            bool onDesk = cut.y + cut.h / 2 > DESK_Y;
            double cy = JsMath.min(174, onDesk ? JsMath.max(cut.y + cut.h * 0.7, DESK_Y + 14) : cut.y + cut.h / 2);
            // Se pone a su altura (por detrás del monitor, si hace falta), con el objeto un poco por delante
            double s = Math.Abs(cx - x) < 2 ? dir : JsMath.sign(cx - x);
            await walkTo(Util.clamp(cx - s * 11, 18, 302), 95 / pace);
            dir = cx >= x ? 1 : -1;
            // Lo que está alto, de un saltito
            double up = Util.clamp(TOP + SHOULDER_Y - 30 - cy, 0, 22);
            var a = frontRest();
            reach = new Reach { ax = a.x, ay = a.y, bx = cx, by = cy, k = 0 };
            await tween(0.32 * pace, (k) => { reach.k = k; rise = up * k; }, Util.ease.outCubic);
            // Lo coge: desaparece de la habitación y va en su mano
            SN.Audio.sfx("whoosh");
            Dk.stripped.Add(id);
            Dk.dirty();
            var kept = new List<Near>();
            foreach (var n in near)
            {
                if (n.id == id) continue;
                if (overlap(n.cut, cut)) { var nc = Dk.cutout(n.id); if (nc != null) kept.Add(new Near { id = n.id, cut = nc }); }
                else kept.Add(n);
            }
            near = kept;
            held = new Held { img = cut.img, w = cut.w, h = cut.h, s = 1 };
            await SN.wait(0.12 * pace);
            // A la caja (encogiéndose: dentro cabe todo)
            double s1 = JsMath.min(1, 10 / JsMath.max(cut.w, cut.h));
            var m = boxMouth();
            reach = new Reach { ax = cx, ay = cy, bx = m.x, by = m.y - 3, k = 0 };
            await tween(0.4 * pace, (k) => { reach.k = k; rise = up * (1 - k); held.s = Util.lerp(1, s1, k); });
            loot.Add(new Loot { img = cut.img, w = JsMath.max(3, JsMath.round(cut.w * s1)), h = JsMath.max(3, JsMath.round(cut.h * s1)) });
            held = null;
            reach = null;
            dip = 1;
            SN.Audio.sfx("drop");
            await SN.wait(0.12 * pace);
        }

        // La pala: la coge de su rincón y se la queda en la mano, de pie
        public async Promise takePala()
        {
            var Dk = SN.Desk;
            const double cx = 314, cy = 110;
            await walkTo(cx - 20, 110);
            dir = 1;
            var a = frontRest();
            reach = new Reach { ax = a.x, ay = a.y, bx = cx, by = cy, k = 0 };
            await tween(0.3, (k) => { reach.k = k; }, Util.ease.outCubic);
            SN.Audio.sfx("whoosh");
            carry = new Carry { img = Dk.palaSprite(), rot = 0 };
            Dk.palaPos = "held";
            Dk.dirty();
            var r = frontRest();
            reach = new Reach { ax = cx, ay = cy, bx = r.x, by = r.y, k = 0 };
            await tween(0.3, (k) => { reach.k = k; });
            reach = null;
        }

        // ...y te la deja en el escritorio: te la tiende por encima de la mesa, se inclina y la tumba delante de ti
        public async Promise givePala()
        {
            var Dk = SN.Desk;
            var to = Dk.PALA_DESK;
            const double lean = 16;
            // Te la tiende: el brazo estirado hacia ti, la pala todavía casi de pie
            var a = frontRest();
            var mid = new Pt(to.x - 2, DESK_Y - 12);
            reach = new Reach { ax = a.x, ay = a.y, bx = mid.x, by = mid.y, k = 0 };
            await tween(0.4, (k) => { reach.k = k; carry.rot = 0.3 * k; }, Util.ease.outCubic);
            await SN.wait(0.35);
            // La baja hasta la madera, tumbándola, mientras se inclina sobre la mesa
            reach = new Reach { ax = mid.x, ay = mid.y, bx = to.x - 2, by = to.y, k = 0 };
            await tween(0.6, (k) => { reach.k = k; rise = -lean * k; carry.rot = 0.3 + 0.7 * k; });
            SN.Audio.sfx("thud");
            SN.FX.shake(2, 0.15);
            carry = null;
            Dk.palaPos = "desk";
            Dk.dirty();
            // La mano se queda un momento encima: es tuya
            await SN.wait(0.5);
            // Se incorpora
            rise = 0;
            var r = frontRest();
            rise = -lean;
            reach = new Reach { ax = to.x - 2, ay = to.y, bx = r.x, by = r.y, k = 0 };
            await tween(0.35, (k) => { reach.k = k; rise = -lean * (1 - k); });
            reach = null;
        }

        // El PC: lo apaga y lo empuja por la mesa hasta la puerta. Él va detrás, así se le ve todo el camino
        // (hay que llamarlo con el agente a la derecha del monitor)
        public async Promise takePC()
        {
            var Dk = SN.Desk;
            var cut = Dk.cutout("pc");
            dir = -1;
            grip = true;
            await SN.wait(0.4);
            SN.Audio.sfx("powerOff");
            Dom.byId("monitor").classList.add("hidden");
            if (cut != null) drag = new Drag { img = cut.img, x = cut.x, y = cut.y, x0 = x };
            Dk.noPC = true;
            Dk.dirty();
            taken.Add("pc");
            await SN.wait(0.5);
            SN.Hero.catDo("arch", 2.6, "hiss"); // la mesa entera se le viene encima al gato
            await walkTo(x - 340, 105);
            drag = null;
            grip = false;
            on = false;
        }

        // ---------- Dónde tiene las manos (coordenadas de la habitación) ----------
        double bodyY() { return TOP - JsMath.round(rise) + (walking ? JsMath.round(Math.Abs(JsMath.sin(walkT * 11)) * 1.6) : 0); }
        Pt boxMouth() { return new Pt(JsMath.round(x) + dir * 2, bodyY() + 52 + JsMath.round(dip * 2)); }
        Pt frontRest()
        {
            double X = JsMath.round(x), by = bodyY(); int d = dir;
            if (grip) return new Pt(X + d * 21, by + 42);
            if (carry != null) return new Pt(X + d * 23, by + 42); // a un lado y en alto: que se vea entera
            if (point) return new Pt(X + d * 30, by + 44);
            if (prop == "list") return new Pt(X + d * 13, by + 54);
            if (box) { var m = boxMouth(); return new Pt(m.x + d * (BOXW / 2.0 + 1), m.y + 10); }
            return new Pt(X + d * 17, by + 64 + (walking ? JsMath.round(JsMath.sin(walkT * 11) * 2) : 0));
        }
        Pt backRest()
        {
            double X = JsMath.round(x), by = bodyY(); int d = dir;
            if (box) { var m = boxMouth(); return new Pt(m.x - d * (BOXW / 2.0 + 1), m.y + 10); }
            return new Pt(X - d * 17, by + 64 - (walking ? JsMath.round(JsMath.sin(walkT * 11) * 2) : 0));
        }
        // La mano de delante está ocupada por delante de la mesa (cogiendo algo o empujando el PC)
        bool busy() { return reach != null || grip; }

        // ---------- Cada fotograma (lo llama js/render/desk.js) ----------
        public void update(double dt)
        {
            t += dt;
            if (walking)
            {
                double s0 = Math.Floor(walkT * 11 / Math.PI);
                walkT += dt;
                if (Math.Floor(walkT * 11 / Math.PI) != s0 && on) SN.Audio.sfx(drag != null ? "drag" : "step");
            }
            dip = JsMath.max(0, dip - dt * 6);
            for (int i = tweens.Count - 1; i >= 0; i--)
            {
                var tw = tweens[i];
                tw.t = JsMath.min(1, tw.t + dt / tw.dur);
                tw.step(tw.ease(tw.t));
                if (tw.t >= 1) { tweens.RemoveAt(i); tw.res(); }
            }
        }

        // Brazos en su lienzo y de ahí a la habitación (en espejo si mira a la izquierda)
        void arms(Ctx2D g, bool back, bool front)
        {
            double X = JsMath.round(x); int d = dir; double by = bodyY();
            if (armSp == null) armSp = new PK.Sprite(AW, AH);
            armSp.g.clearRect(0, 0, AW, AH);
            double sy = by + SHOULDER_Y + AY;
            double lx(double rx) { return AO + (rx - X) * d; }
            if (back) { var b = backRest(); drawArm(armSp, AO + SHOULDER_BACK, sy, lx(b.x), b.y + AY, 1, false); }
            if (front)
            {
                var f = frontHand();
                double fx = lx(f.x), fy = f.y + AY;
                bool across = Math.Abs(fx - AO - SHOULDER_FRONT) > Math.Abs(fy - sy);
                drawArm(armSp, AO + SHOULDER_FRONT, sy, fx, fy, across ? 1 : -1, point && reach == null);
            }
            if (d > 0) g.drawImage(armSp.canvas, X - AO, -AY);
            else { g.save(); g.translate(X + AO, -AY); g.scale(-1, 1); g.drawImage(armSp.canvas, 0, 0); g.restore(); }
        }

        Pt frontHand()
        {
            var r = reach;
            return r != null ? new Pt(Util.lerp(r.ax, r.bx, r.k), Util.lerp(r.ay, r.by, r.k)) : frontRest();
        }

        // Lo que lleva de pie en la mano (la pala), agarrado por el mango; al dejarlo en la mesa, se va tumbando
        void drawCarry(Ctx2D g)
        {
            var c = carry; var f = frontHand();
            g.save();
            g.translate(JsMath.round(f.x), JsMath.round(f.y));
            g.rotate(-Math.PI / 2 * c.rot);
            g.drawImage(c.img, -JsMath.round(c.img.width / 2.0), -JsMath.round(c.img.height * 0.45));
            g.restore();
        }

        // Capa de atrás: el cuerpo, la caja y los brazos en reposo, por detrás de la mesa y del monitor (solo se ve a
        // los lados de la pantalla y por encima del borde de la mesa; sin PC, a todo lo ancho)
        public void drawBack(Ctx2D g, double dt)
        {
            update(dt);
            if (!on) return;
            bool noPC = SN.Desk.noPC; var M = SN.Desk.MON;
            double X = JsMath.round(x); int d = dir; double by = bodyY();
            g.save();
            g.beginPath();
            if (noPC) g.rect(0, 0, RW, DESK_Y);
            else { g.rect(0, 0, M.x, DESK_Y); g.rect(M.x + M.w, 0, RW - M.x - M.w, DESK_Y); }
            g.clip();
            // Cuerpo y cabeza (la cabeza se mueve un píxel al andar y al hablar)
            V say = SN.Cine != null ? SN.Cine.say_ : V.undefined;
            bool mouth = talk && say.truthy && say["shown"].num < say["full"]["length"].num && Math.Floor(t * 9) % 2 == 0;
            bool blink = (t % 3.4) > 3.27;
            int nod = walking ? (JsMath.sin(walkT * 11 + 0.9) > 0 ? 1 : 0) : (mouth ? 1 : 0);
            g.drawImage(piece("body", d, buildBody), X - AX, by);
            g.drawImage(piece("head|" + (mouth ? 1 : 0) + "|" + (blink ? 1 : 0), d, () => buildHead(mouth, blink)), X - AX, by + nod);
            // La caja, con lo que ya lleva dentro asomando
            if (box)
            {
                var m = boxMouth();
                double bx = m.x - BOXW / 2.0 - 2, top = m.y - 9;
                g.drawImage(piece("box0", 1, () => buildBox(false)), bx, top);
                for (int i = 0; i < loot.Count; i++)
                {
                    var it = loot[i];
                    g.drawImage(it.img, bx + 4 + ((i * 7) % (BOXW - 10)), m.y + 3 - it.h - Math.Min(5, (i >> 2) * 2), it.w, it.h);
                }
                g.drawImage(piece("box1", 1, () => buildBox(true)), bx, top);
            }
            if (carry != null && !busy()) drawCarry(g);
            arms(g, true, !busy());
            if (prop == "list" && reach == null) { var f = frontRest(); drawList(g, f.x - 5, f.y - 13); }
            g.restore();
            // Lo que tiene por delante en la mesa lo tapa
            foreach (var n in near) g.drawImage(n.cut.img, n.cut.x, n.cut.y);
        }

        // Capa de delante: el PC que empuja y el brazo que alarga por encima de la mesa (con lo que acaba de coger).
        // Detrás del monitor no se ve: la mano asoma por debajo de la pantalla
        public void drawFront(Ctx2D g)
        {
            if (drag != null)
            {
                // El PC, de camino a la puerta (con el ratón encima de la alfombrilla), dando tumbos
                double dx = JsMath.round(x - drag.x0), wob = walking && JsMath.sin(walkT * 22) > 0 ? 1 : 0;
                g.drawImage(drag.img, drag.x + dx, drag.y + wob);
                var H = SN.Desk.HANDS;
                g.drawImage(SN.Hero.mouseOnly(), H.mx - 24 + dx, H.my - 13 + wob);
            }
            if (!on || !busy()) return;
            var M = SN.Desk.MON;
            g.save();
            if (!SN.Desk.noPC)
            {
                g.beginPath();
                g.rect(0, 0, RW, RH);
                g.rect(M.x, 0, M.w, M.y + M.h);
                g.clip("evenodd");
            }
            if (held != null)
            {
                var h = held; var f = frontHand();
                double w = JsMath.max(2, JsMath.round(h.w * h.s)), hh = JsMath.max(2, JsMath.round(h.h * h.s));
                g.drawImage(h.img, JsMath.round(f.x - w / 2), JsMath.round(f.y - hh / 2), w, hh);
            }
            if (carry != null) drawCarry(g);
            arms(g, false, true);
            g.restore();
        }
    }
}
