// Port de js/render/desk.js (SN.Desk): la habitación en pixel art lo-fi (320x180) en primera persona: el monitor
// (FUTURO.exe), las manos, la ventana con la ciudad y sus sucesos, la planta, el calendario, la consola, el ramen...
// Capas: fondo estático (caché) -> vista de la ventana (animada) -> persianas y planta -> gato, vapor, teclas ->
// manos -> luz (tinte por hora del día, brillo del monitor, motas de polvo).
// El estado de la habitación (state()) es un V como en JS: la clave de caché es Json.stringify de ese V.
// Dropped: drawBooksAndCalendar (en JS no se llamaba desde buildBack, código muerto).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public struct Box { public double x, y, w, h; }
    public struct HandSpots { public double kx, ky, mx, my; }
    public struct Spot { public double x, y; }

    // Un recorte de la habitación (Desk.cutout): la imagen y dónde va
    public sealed class Cutout { public Canvas img; public double x, y, w, h; }

    public sealed class Key
    {
        public double x, y, w, h;
        public string code;
        public int r, c;
        public double press;
    }

    public sealed class Desk
    {
        const int RW = 320, RH = 180;
        const int DESK_Y = 128;
        static readonly Box MON0 = new Box { x = 48, y = 1, w = 222, h = 130 };
        static readonly Box SCR0 = new Box { x = 54, y = 7, w = 210, h = 118 };
        static readonly Box WIN0 = new Box { x = 4, y = 16, w = 38, h = 72 };
        static readonly Box KB0 = new Box { x = 84, y = 150, w = 128, h = 22 };

        // Geometría (coordenadas de la habitación). La pantalla coincide con #monitor del HTML (x2).
        public readonly Box MON = MON0, SCR = SCR0, KB = KB0;
        public readonly HandSpots HANDS = new HandSpots { kx = 104, ky = 158, mx = 247, my = 154 };
        public readonly Spot PALA_DESK = new Spot { x = 160, y = 139 };
        static readonly Box WIN = WIN0;

        // Dígitos diminutos (3x5) para el pósit y el calendario
        static readonly Dictionary<char, string[]> MINI = new Dictionary<char, string[]>
        {
            ['0'] = new[] { "###", "#.#", "#.#", "#.#", "###" }, ['1'] = new[] { ".#.", "##.", ".#.", ".#.", "###" },
            ['2'] = new[] { "###", "..#", "###", "#..", "###" }, ['3'] = new[] { "###", "..#", ".##", "..#", "###" },
            ['4'] = new[] { "#.#", "#.#", "###", "..#", "..#" }, ['5'] = new[] { "###", "#..", "###", "..#", "###" },
            ['6'] = new[] { "###", "#..", "###", "#.#", "###" }, ['7'] = new[] { "###", "..#", ".#.", ".#.", ".#." },
            ['8'] = new[] { "###", "#.#", "###", "#.#", "###" }, ['9'] = new[] { "###", "#.#", "###", "..#", "###" },
            ['$'] = new[] { ".##", "##.", ".#.", ".##", "##." }, ['!'] = new[] { "#", "#", "#", ".", "#" },
            ['/'] = new[] { "..#", "..#", ".#.", "#..", "#.." }, ['P'] = new[] { "##.", "#.#", "##.", "#..", "#.." },
            ['K'] = new[] { "#.#", "##.", "#..", "##.", "#.#" },
        };

        static readonly Dictionary<string, double> WIN_DUR = new Dictionary<string, double>
        {
            ["ambulancia"] = 6, ["apagon"] = 7, ["fuegos"] = 4.5, ["encapuchado"] = 7, ["dron"] = 6, ["camion"] = 7,
            ["lluvia"] = 22, ["cuervo"] = 8, ["temblor"] = 2.5, ["oro"] = 14, ["farolas"] = 8,
        };
        static readonly (double a, double b)[] GARLAND = { (0, 47), (271, 320) };

        // ---------- Estado público ----------
        public readonly List<Key> KEYS = new List<Key>();
        public string led = "idle";
        public double camShift;
        public string phaseOverride;                 // null = la hora del día de la partida
        public sealed class Glow { public string color, flashColor; public double k, flash; }
        public readonly Glow glow = new Glow { color = PAL.cyan, k = 0.5, flash = 0, flashColor = PAL.white };
        public HashSet<string> stripped;             // lo que se ha llevado el embargo (null = nada)
        public bool noPC;
        public double crawl;
        public bool palaHere;
        public V palaPos = V.@null;                  // null = de pie en su rincón; "held" = en la mano; "desk" = tumbada
        public bool handsOff;
        public bool hideConsole;

        // Ciudad de la ventana (generada una vez, siempre igual)
        sealed class Win { public double x, y, seed; public int hue; }
        sealed class Building { public double x, w, h; public int tone; public List<Win> wins; public bool antenna; }
        readonly List<Building> city = new List<Building>();
        sealed class WinEvent { public string kind; public double t0, dur, seed; }
        readonly List<WinEvent> winEvents = new List<WinEvent>();
        sealed class Mote { public double x, y, s, ph; }
        readonly List<Mote> motes = new List<Mote>();

        Canvas bg, fg;
        string bgKey = "";
        double t;
        double blindLift;
        Canvas room;
        Ctx2D rg;

        public Desk()
        {
            // Teclas del teclado (para animar pulsaciones)
            var rows = new[]
            {
                new[] { "Escape", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace", "Backspace" },
                new[] { "Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Enter", "Enter" },
                new[] { "CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter", null, "ArrowUp" },
                new[] { "ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight", "ArrowLeft", "ArrowDown", "ArrowRight" },
            };
            for (int r = 0; r < rows.Length; r++)
                for (int i = 0; i < rows[r].Length; i++)
                    KEYS.Add(new Key { x = KB.x + 4 + i * 8 + (r % 2), y = KB.y + 2 + r * 4, w = 7, h = 3, code = rows[r][i], r = r, c = i, press = 0 });
            KEYS.Add(new Key { x = KB.x + 36, y = KB.y + 18, w = 52, h = 3, code = "Space", r = 4, c = 0, press = 0 });

            // Ciudad (RNG propio con semilla 7: siempre igual)
            var rng = new RNG(7);
            double x = -12;
            while (x < WIN.w + 12)
            {
                double w = rng.@int(6, 11), h = rng.@int(18, 56);
                var wins = new List<Win>();
                for (double wy = 3; wy < h - 2; wy += 4)
                    for (double wx = 2; wx < w - 2; wx += 3)
                        wins.Add(new Win { x = wx, y = wy, seed = rng.next(), hue = (int)rng.@int(0, 3) });
                var b = new Building { x = x, w = w, h = h };
                b.tone = (int)rng.@int(0, 2);
                b.wins = wins;
                b.antenna = rng.next() < 0.35;
                city.Add(b);
                x += w + rng.@int(0, 2);
            }

            for (int i = 0; i < 12; i++)
                motes.Add(new Mote { x = 4 + (i * 37) % 44, y = 30 + (i * 53) % 110, s = 0.3 + (i % 5) * 0.12, ph = i });
        }

        static bool inside(double x, double y, double[] r) { return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]; }

        static void R(Ctx2D g, double x, double y, double w, double h, string c) { Px.rect(g, x, y, w, h, c); }

        // Texto de dígitos y letras con la fuente diminuta (3x5), escalada s
        static void mini(Ctx2D g, string text, double x, double y, string c, double s = 1)
        {
            double cx = x;
            foreach (char ch in text)
            {
                if (!MINI.TryGetValue(ch, out var gl)) { cx += 2 * s; continue; }
                for (int j = 0; j < gl.Length; j++)
                    for (int i = 0; i < gl[j].Length; i++)
                        if (gl[j][i] == '#') R(g, cx + i * s, y + j * s, s, s, c);
                cx += (gl[0].Length + 1) * s;
            }
        }

        public void dirty() { bgKey = ""; }
        public Key keyFor(string code) { return KEYS.Find(k => k.code == code); }
        public Canvas palaSprite() { var c = Px.canvas(12, 42); var g = Px.ctx(c); g.translate(-308, -92); drawPala(g); return c; }

        // Brillo del monitor sobre la habitación: sigue al resultado de la operación (verde / rojo)
        public void glowTo(string color, double k = 0.5) { glow.color = color; glow.k = k; }
        public void flashGlow(string color, double power = 1) { glow.flash = power; glow.flashColor = color; }

        // Un suceso visible por la ventana
        public void windowEvent(string kind)
        {
            if (!WIN_DUR.ContainsKey(kind)) return;
            foreach (var e in winEvents) if (e.kind == kind) return;
            winEvents.Add(new WinEvent { kind = kind, t0 = t, dur = WIN_DUR[kind], seed = JsMath.rnd() * 1000 });
            var A = SN.Audio;
            if (kind == "ambulancia") A.sfx("siren");
            else if (kind == "fuegos") foreach (double d in new[] { 0, 0.6, 1.3, 2 }) SN.after(d, () => A.sfx("pop"));
            else if (kind == "encapuchado") { A.sfx("whisper"); SN.after(0.5, () => A.sfx("heart")); }
            else if (kind == "apagon") A.sfx("static", V.Obj("dur", 0.4));
            else if (kind == "temblor") { SN.FX.shake(3, 1.6); A.sfx("thud"); }
            else if (kind == "cuervo") A.sfx("tick");
            else if (kind == "farolas") for (int i = 1; i <= 5; i++) SN.after(1.1 * i, () => A.sfx("tick"));
            SN.Events.emit("window:event", V.Obj("kind", kind));
        }

        public List<string> windowEvents
        {
            get { var l = new List<string>(); foreach (var e in winEvents) l.Add(e.kind); return l; }
        }

        // Clic en la habitación (coordenadas de 320x180): hay símbolos del idioma secreto escondidos
        public V hotspot(double x, double y)
        {
            V run = SN.State.run;
            if (!run.truthy || SN.Cipher == null || SN.Game == null || SN.Game.state != "GAMEPLAY") return V.undefined;
            double[] win = { WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 8 };
            var ev = windowEvents;
            // El cuervo del alféizar y el encapuchado de la azotea: solo mientras se ven
            if (inside(x, y, win) && ev.Contains("cuervo")) { SN.Audio.sfx("tick"); return SN.Cipher.discover("cuervo"); }
            if (inside(x, y, win) && ev.Contains("encapuchado")) return SN.Cipher.discover("azotea");
            // El gato: solo despierto se le ve el collar
            if (inside(x, y, new double[] { 2, 142, 64, 34 }))
            {
                string st = SN.Hero.cat.state;
                SN.Hero.petCat();
                if (st != "awake" && st != "arch" && st != "alert") { SN.Audio.sfx("tick"); return V.@null; }
                return SN.Cipher.discover("gato");
            }
            // El póster, cuando la ciudad ya se ha apagado un poco
            if (inside(x, y, new double[] { 280, 52, 32, 30 }) && run["owned"]["poster"].truthy && run["darkness"].num >= 3)
                return SN.Cipher.discover("poster");
            return V.@null;
        }

        // El dibujo suelto de un objeto de la habitación: lo que cambia en las capas quietas al quitarlo.
        // id: un objeto de la tienda, 'pleyzeta' (la consola) o 'pc' (monitor, teclado y alfombrilla).
        public Cutout cutout(string id)
        {
            V st = state();
            JsObject off = JsObject.Assign(st);
            if (id == "pc") off.Add("noPC", true);
            else if (id == "pleyzeta") off.Add("console", false);
            else
            {
                V owned2 = JsObject.Assign(st["owned"]);
                owned2.delete(id);
                off.Add("owned", owned2);
            }
            Canvas Flat(V s) { var c = buildBack(s); Px.ctx(c).drawImage(buildFront(s), 0, 0); return c; }
            var full = Flat(st);
            var a = Px.ctx(full).getImageData(0, 0, RW, RH);
            var b = Px.ctx(Flat(off)).getImageData(0, 0, RW, RH);
            int x0 = RW, y0 = RH, x1 = -1, y1 = -1;
            for (int i = 0, p = 0; i < a.data.Length; i += 4, p++)
            {
                if (a.data[i] == b.data[i] && a.data[i + 1] == b.data[i + 1] && a.data[i + 2] == b.data[i + 2]) { a.data[i + 3] = 0; continue; }
                int x = p % RW, y = p / RW;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
            if (x1 < 0) return null;
            int w = x1 - x0 + 1, h = y1 - y0 + 1;
            var img = Px.canvas(w, h);
            var g = Px.ctx(img);
            Px.ctx(full).putImageData(a, 0, 0);
            g.drawImage(full, -x0, -y0);
            // El teclado de colores se pinta cada fotograma: en el recorte, con los colores de este instante
            if (id == "teclado")
                foreach (var k in KEYS)
                    R(g, k.x - x0, k.y - y0, k.w, k.h, "hsl(" + Js.String((k.c * 22 + k.r * 30 + t * 120) % 360) + ", 85%, 62%)");
            return new Cutout { img = img, x = x0, y = y0, w = w, h = h };
        }

        // El estado de la habitación (como el objeto de JS: mismas claves y en el mismo orden)
        public V state()
        {
            V run = SN.State.run;
            var strip = stripped;
            V owned = run.truthy ? run["owned"] : new JsObject();
            if (strip != null)
            {
                var filtered = new JsObject();
                foreach (var kv in owned.obj) if (!strip.Contains(kv.Key)) filtered.Add(kv.Key, kv.Value);
                owned = filtered;
            }
            V debt = run.truthy ? run["debt"] : V.undefined;
            bool hasDebt = run.truthy && debt.truthy;
            return V.Obj(
                "phase", phaseOverride ?? (run.truthy ? (V)SN.Time.phase() : "evening"),
                "day", run.truthy ? run["day"] : (V)1,
                // Sin deuda activa = "libre" (el calendario se tacha con un check)
                "paid", run.truthy ? (V)(!SN.Debt.active()) : (V)false,
                "owned", owned,
                "dark", run.truthy ? run["darkness"] : (V)0,
                "start", hasDebt ? (debt["start"] | (V)1) : (V)1,
                "deadline", hasDebt ? debt["deadlineDay"] : (V)7,
                "defaulted", hasDebt ? debt["defaulted"] : (V)false,
                "owe", run.truthy && SN.Debt.active() ? debt["amount"] : (V)0,
                // La consola: en la intro no aparece hasta que se compra
                "console", (V)(!hideConsole && !(strip != null && strip.Contains("pleyzeta"))),
                "noPC", (V)noPC,
                "pala", (V)(palaHere || (SN.State.profile.truthy && SN.State.profile["pala"].truthy)),
                "palaPos", palaPos);
        }

        public void render(Ctx2D g, double dt)
        {
            t += dt;
            if (room == null) { room = Px.canvas(RW, RH); rg = Px.ctx(room); }
            V st = state();
            string key = Json.stringify(st);
            if (key != bgKey) { bg = buildBack(st); fg = buildFront(st); bgKey = key; }
            rg.globalCompositeOperation = "source-over";
            rg.drawImage(bg, 0, 0);
            drawWindowView(rg, st);
            // Las persianas se suben solas cuando pasa algo fuera (para que se vea), y bajan después
            blindLift += ((winEvents.Count > 0 ? 1 : 0) - blindLift) * JsMath.min(1, dt * 2.5);
            drawBlinds(rg, st, blindLift);
            rg.drawImage(fg, 0, 0);
            drawLampGlowBehind(rg, st);
            SN.Hero.update(dt);
            // El agente del embargo (final B): el cuerpo, por detrás de la mesa y del monitor...
            SN.Officer.drawBack(rg, dt);
            string phase = st["phase"].str;
            SN.Hero.drawCat(rg, 2, 142, phase);
            drawAnimated(rg, st, dt);
            if (crawl > 0) { crawl += dt; drawCrawl(rg, crawl); }
            if (!st["noPC"].truthy) SN.Hero.drawHands(rg, phase, HANDS.kx, HANDS.ky, HANDS.mx, HANDS.my);
            // ...y el brazo con el que coge las cosas, por delante
            SN.Officer.drawFront(rg);
            drawLighting(rg, st, dt);
            g.drawImage(room, 0, 0);
        }

        // ---------------- Fondo estático ----------------
        Canvas buildBack(V st)
        {
            var c = Px.canvas(RW, RH);
            var g = Px.ctx(c);
            drawWall(g, st);
            drawWindowFrame(g);
            drawRightWall(g, st);
            if (st["pala"].truthy && !st["palaPos"].truthy) drawPala(g);
            if (!st["noPC"].truthy) drawMonitor(g);
            drawDesk(g);
            if (st["pala"].truthy && st["palaPos"] == "desk") drawPalaOnDesk(g);
            drawConsoleBox(g, st);
            if (!st["noPC"].truthy) drawPad(g, st);
            if (!st["noPC"].truthy) drawKeyboard(g, st);
            drawMug(g, st);
            drawRamen(g);
            if (!st["paid"].truthy) drawBills(g, st);
            if (st["owned"]["cascos"].truthy) drawHeadphones(g);
            drawKeyItems(g, st);
            return c;
        }

        // Capa delantera (fondo transparente): planta, pósit y lámpara, por delante de la ventana animada
        Canvas buildFront(V st)
        {
            var c = Px.canvas(RW, RH);
            var g = Px.ctx(c);
            drawPlant(g, st);
            drawPostit(g, st);
            if (st["owned"]["lampara"].truthy) drawLamp(g);
            return c;
        }

        // LA PALA (final B): de pie en la esquina de la derecha, entre la consola y la pared
        static void drawPala(Ctx2D g)
        {
            double x = 313;
            R(g, x - 2, 93, 6, 2, PAL.coalD); R(g, x - 1, 93, 4, 1, PAL.orange);
            R(g, x, 95, 2, 24, PAL.orangeD); R(g, x, 95, 1, 24, PAL.orange);
            R(g, x - 1, 118, 4, 2, PAL.coalD);
            R(g, x - 4, 120, 10, 11, PAL.coalL); R(g, x - 4, 120, 10, 1, PAL.creamD); R(g, x - 4, 121, 1, 10, PAL.creamDD); R(g, x + 5, 121, 1, 10, PAL.coal);
            R(g, x - 3, 131, 8, 1, PAL.coalL); R(g, x - 2, 132, 6, 1, PAL.coal);
        }

        // La misma pala, tumbada en el escritorio (final B), girada un cuarto de vuelta
        void drawPalaOnDesk(Ctx2D g)
        {
            double x = PALA_DESK.x, y = PALA_DESK.y;
            R(g, x - 19, y + 6, 38, 1, PAL.woodDD);
            g.save();
            g.transform(0, -1, 1, 0, x - 113, y + 314);
            drawPala(g);
            g.restore();
        }

        // Final A: las gráficas se salen del monitor y trepan por las paredes y la mesa
        void drawCrawl(Ctx2D g, double k)
        {
            var rays = new[] { (48.0, 30.0, -1), (48.0, 70.0, -1), (48.0, 108.0, -1), (270.0, 40.0, 1), (270.0, 78.0, 1), (270.0, 116.0, 1), (96.0, 131.0, 0), (176.0, 131.0, 0), (232.0, 131.0, 0) };
            foreach (var (x0, y0, dir) in rays)
            {
                double len = JsMath.min(dir != 0 ? 46 : 38, k * 13);
                for (double d = 4; d < len; d += 5)
                {
                    double x = JsMath.round(dir != 0 ? x0 + dir * d : x0 + JsMath.sin(d * 0.4 + x0) * 3);
                    double y = JsMath.round(dir != 0 ? y0 + JsMath.sin(d * 0.35 + x0) * 4 - d * 0.15 : y0 + d);
                    bool up = ((int)(d / 5)) % 2 == 0;
                    R(g, x, y - 3, 1, 7, up ? PAL.greenD : PAL.coralD);
                    R(g, x - 1, y - 2, 3, 4, up ? PAL.green : PAL.coral);
                }
            }
        }

        static bool own(V st, string key) { return st["owned"][key].truthy; }

        // Objetos clave de la tienda (los de la "oferta" de FUTURO.exe)
        void drawKeyItems(Ctx2D g, V st)
        {
            if (own(st, "tele"))
            {
                // La tele de 98" sin desembalar, apoyada bajo la ventana
                double x = 2, y = 94, w = 44, h = 34;
                R(g, x + 1, y + 1, w, h, PAL.coalD);
                R(g, x, y, w, h, PAL.creamD); R(g, x, y, w, 2, PAL.creamL); R(g, x, y, 2, h, PAL.creamL);
                R(g, x + 5, y + 6, 26, 15, PAL.coal); R(g, x + 6, y + 7, 24, 13, PAL.cyanDD); Px.line(g, x + 8, y + 18, x + 26, y + 9, PAL.cyanD);
                mini(g, "98", x + 33, y + 8, PAL.coralD); R(g, x + 41, y + 8, 1, 2, PAL.coralD);
                R(g, x + 5, y + 25, 30, 2, PAL.coralD); R(g, x + 5, y + 29, 20, 1, PAL.creamDD);
            }
            if (own(st, "movil"))
            {
                // El móvil nuevo sobre la mesa
                double x = 226, y = 133;
                R(g, x, y, 9, 13, PAL.coalD); R(g, x + 1, y + 1, 7, 11, PAL.navyM);
                R(g, x + 2, y + 2, 5, 2, PAL.cyan); R(g, x + 2, y + 5, 4, 1, PAL.creamD); R(g, x + 2, y + 7, 5, 1, PAL.creamD); R(g, x + 6, y + 1, 1, 1, PAL.coral);
            }
            // Objetos dorados de Don Siete (días de la suerte), en fila sobre la mesa
            if (own(st, "maneki"))
            {
                double x = 92, y = 134;
                R(g, x + 1, y + 4, 7, 7, PAL.creamL); R(g, x + 1, y, 6, 5, PAL.creamL); R(g, x + 1, y - 1, 1, 1, PAL.creamL); R(g, x + 6, y - 1, 1, 1, PAL.creamL);
                R(g, x + 2, y + 2, 1, 1, PAL.coal); R(g, x + 5, y + 2, 1, 1, PAL.coal); R(g, x + 1, y + 5, 6, 1, PAL.coral); R(g, x + 3, y + 6, 2, 1, PAL.yellow);
                R(g, x, y + 1, 1, 3, PAL.creamL); // la pata que saluda
            }
            if (own(st, "trebol4"))
            {
                double x = 106, y = 137;
                R(g, x, y, 9, 9, PAL.yellowD); R(g, x + 1, y + 1, 7, 7, PAL.creamL);
                foreach (var (dx, dy) in new[] { (2, 2), (5, 2), (2, 5), (5, 5) }) R(g, x + dx, y + dy, 2, 2, PAL.green);
            }
            if (own(st, "herradura"))
            {
                double x = 120, y = 138;
                R(g, x, y, 2, 7, PAL.yellow); R(g, x + 6, y, 2, 7, PAL.yellow); R(g, x + 1, y + 6, 6, 2, PAL.yellow); R(g, x, y, 1, 1, PAL.yellowL);
            }
            if (own(st, "billete7"))
            {
                double x = 184, y = 141;
                R(g, x, y, 13, 7, PAL.greenD); R(g, x + 1, y + 1, 11, 5, PAL.green); mini(g, "7", x + 5, y + 1, PAL.greenDD);
            }
            if (own(st, "moto"))
            {
                // El casco de la moto (la moto no cabe en el cuarto)
                var sp = new PK.Sprite(22, 16);
                sp.part(sp.mask().ellipse(11, 9, 10, 7.5), new[] { PAL.coralDD, PAL.coralD, PAL.coral, PAL.coralL }, light: new[] { 1, -1 });
                sp.rect(9, 6, 12, 4, PAL.navyDD).rect(10, 6, 9, 1, PAL.cyanD).rect(2, 14, 18, 2, PAL.coalD);
                g.drawImage(sp.canvas, 36, 114);
            }
        }

        // Capa de las partes quietas de la pared, la ventana y la planta
        static void drawWall(Ctx2D g, V st)
        {
            R(g, 0, 0, RW, RH, PAL.wall);
            // Paneles verticales y una trama muy suave
            for (int x = 2; x < RW; x += 9) R(g, x, 0, 1, DESK_Y, PAL.wallM);
            for (int y = 1; y < DESK_Y; y += 4) for (int x = (y * 3) % 7; x < RW; x += 7) R(g, x, y, 1, 1, PAL.wallD);
            // Rodapié de la pared tras la mesa
            R(g, 0, DESK_Y - 3, RW, 3, PAL.wallD);
        }

        static void drawWindowFrame(Ctx2D g)
        {
            double x = WIN.x, y = WIN.y, w = WIN.w, h = WIN.h;
            R(g, x - 2, y - 2, w + 4, h + 4, PAL.coalD);
            R(g, x - 1, y - 1, w + 2, h + 2, PAL.violetD);
            R(g, x, y, w, h, PAL.navyD); // hueco (lo tapa la vista animada)
            // Alféizar
            R(g, x - 4, y + h + 1, w + 8, 3, PAL.coalL); R(g, x - 4, y + h + 1, w + 8, 1, PAL.violetL); R(g, x - 4, y + h + 4, w + 8, 1, PAL.coalD);
        }

        // lift: 0 = bajadas, 1 = subidas casi del todo (las láminas se amontonan arriba)
        static void drawBlinds(Ctx2D g, V st, double lift = 0)
        {
            double x = WIN.x, y = WIN.y, w = WIN.w, h = WIN.h;
            string phase = st["phase"].str;
            string[] lit = phase == "morning" ? new[] { PAL.creamL, PAL.creamM, "#CFC4EE" }
                : phase == "evening" ? new[] { "#FFD49A", "#FFA65A", "#E0663F" } : new[] { "#5C4A96", "#45367A", "#2E2458" };
            // Láminas: entra luz por los huecos (se ve la ciudad)
            double bottom = JsMath.round(y + h - 1 - (h - 12) * lift);
            for (double sy = y + 2; sy < bottom; sy += 5)
            {
                R(g, x, sy, w, 1, lit[0]);
                R(g, x, sy + 1, w, 1, lit[1]);
                R(g, x, sy + 2, w, 1, lit[2]);
            }
            // Láminas recogidas: un bloque apretado en el borde de abajo de la persiana
            if (lift > 0.05) { R(g, x, bottom - 1, w, 3, lit[2]); R(g, x, bottom - 1, w, 1, lit[0]); }
            // Riel superior y cordón
            R(g, x - 2, y - 3, w + 4, 3, PAL.coalL); R(g, x - 2, y - 3, w + 4, 1, PAL.violetL);
            R(g, x + w - 6, y, 1, h - 8, PAL.creamDD); R(g, x + w - 7, y + h - 8, 3, 3, PAL.creamD);
            // Montante central
            R(g, x + Math.Floor(w / 2) - 1, y, 2, h, PAL.violetD);
        }

        // Planta colgante: lustrosa si la compraste, mustia si no
        void drawPlant(Ctx2D g, V st)
        {
            bool healthy = st["owned"]["planta"].truthy;
            var sp = new PK.Sprite(60, 110);
            // Maceta colgada del techo
            sp.line(16, 0, 12, 10, PAL.creamDD).line(16, 0, 22, 10, PAL.creamDD);
            var pot = sp.mask().poly(new (double x, double y)[] { (8, 10), (26, 10), (24, 20), (10, 20) });
            sp.part(pot, new[] { PAL.orangeDD, PAL.orangeD, PAL.orange, PAL.orangeL }, light: new[] { 1, -1 });
            int[][] vines = healthy
                ? new[] { new[] { 10, 20, 4, 60 }, new[] { 18, 20, 12, 92 }, new[] { 24, 20, 30, 70 }, new[] { 14, 20, 0, 40 } }
                : new[] { new[] { 12, 20, 9, 44 }, new[] { 19, 20, 21, 50 }, new[] { 23, 20, 27, 34 } };
            foreach (var v in vines)
            {
                int x0 = v[0], y0 = v[1], x1 = v[2], y1 = v[3];
                sp.line(x0, y0, x1, y1, healthy ? PAL.leafDD : "#4A3A22");
                int n = (int)Math.Floor((double)(y1 - y0) / (healthy ? 8 : 7));
                for (int i = 1; i <= n; i++)
                {
                    double k = (double)i / n;
                    int side = i % 2 != 0 ? 1 : -1;
                    double lx = JsMath.round(x0 + (x1 - x0) * k), ly = JsMath.round(y0 + (y1 - y0) * k);
                    if (healthy)
                    {
                        // Hojas de potos: corazones verdes hacia fuera
                        var leaf = sp.mask().ellipse(lx + side * 3, ly, 3.4, 2.4).ellipse(lx + side * 5, ly + 1, 1.6, 1.4);
                        sp.part(leaf, new[] { PAL.leafDD, PAL.leafD, PAL.leaf, PAL.leafL }, light: new[] { 1, -1 }, hi: 1, lit: 1, sh: 1);
                    }
                    else
                    {
                        // Hojas secas que cuelgan
                        var leaf = sp.mask().capsule(lx + side, ly, lx + side * 3, ly + 4, 1.05);
                        sp.part(leaf, new[] { "#3A2A18", "#6A4A22", "#A0782E", "#C8A048" }, light: new[] { 1, -1 }, hi: 1, lit: 1, sh: 1);
                    }
                }
            }
            g.drawImage(sp.canvas, -4, 0);
            if (!healthy)
            {
                // Hojas caídas en el alféizar
                R(g, 9, WIN.y + WIN.h + 1, 3, 1, "#A0782E"); R(g, 10, WIN.y + WIN.h, 2, 1, "#6A4A22");
                R(g, 30, WIN.y + WIN.h + 1, 3, 1, "#C8A048"); R(g, 31, WIN.y + WIN.h, 1, 1, "#6A4A22");
            }
        }

        // Pósit en la esquina del monitor: lo que debes ahora
        static void drawPostit(Ctx2D g, V st)
        {
            R(g, 41, 4, 13, 13, PAL.yellowD); R(g, 40, 3, 13, 13, PAL.yellow); R(g, 40, 3, 13, 3, PAL.yellowL);
            if (!st["owe"].truthy) { Px.line(g, 43, 9, 45, 11, PAL.greenD); Px.line(g, 45, 11, 50, 6, PAL.greenD); return; }
            double owe = st["owe"].num;
            string txt = owe >= 1000 ? Js.String(JsMath.round(owe / 1000)) + "K" : st["owe"].str;
            mini(g, txt, 40 + JsMath.max(0, Math.Floor((13 - (txt.Length * 4 - 1)) / 2.0)), 7, PAL.coralD);
            mini(g, "! !", 44, 11, PAL.coralD);
        }

        static void drawLamp(Ctx2D g)
        {
            // Farolillo de papel colgado (compra de la tienda): luz cálida
            R(g, 22, 0, 1, 6, PAL.creamDD);
            var sp = new PK.Sprite(30, 30);
            var m = sp.mask().ellipse(15, 14, 9, 8);
            sp.part(m, new[] { PAL.orangeD, PAL.orange, PAL.orangeL, PAL.yellowL }, light: new[] { 1, -1 });
            sp.line(7, 12, 23, 12, PAL.orangeD).line(7, 16, 23, 16, PAL.orangeD);
            g.drawImage(sp.canvas, 8, 0);
        }

        static double sagAt(double x) { return JsMath.round(JsMath.sin(x / 9) * 1.5) + 4; }

        // Pared derecha: calendario del plazo, póster, estantería con libros y peluche
        void drawRightWall(Ctx2D g, V st)
        {
            foreach (var (a, b) in GARLAND) for (int x = (int)a; x < b; x++) R(g, x, sagAt(x), 1, 1, PAL.coalD);
            drawCalendar(g, st, 277, 12);
            if (own(st, "poster"))
            {
                R(g, 280, 52, 32, 30, PAL.coalD); R(g, 281, 53, 30, 28, PAL.yellow);
                Px.line(g, 284, 76, 291, 68, PAL.greenD, 1); Px.line(g, 291, 68, 295, 71, PAL.greenD, 1); Px.line(g, 295, 71, 307, 58, PAL.greenD, 1);
                R(g, 304, 57, 4, 1, PAL.greenD); R(g, 307, 57, 1, 4, PAL.greenD);
                // Cuando la ciudad se apaga, alguien escribe en el póster (un símbolo del idioma secreto)
                if (st["dark"].num >= 3) { foreach (double cx in new double[] { 284, 286, 288 }) R(g, cx, 56, 1, 5, PAL.coralD); R(g, 284, 60, 5, 1, PAL.coralD); R(g, 288, 61, 1, 1, PAL.coralD); }
            }
            // Estantería
            R(g, 271, 88, 49, 3, PAL.woodM); R(g, 271, 88, 49, 1, PAL.wood); R(g, 271, 91, 49, 1, PAL.woodDD);
            var books = new (string c, int h)[] { (PAL.cyan, 14), (PAL.orange, 16), (PAL.violetL, 13), (PAL.coral, 15) };
            double bx = 274;
            foreach (var (c, h) in books) { R(g, bx, 88 - h, 4, h, PAL.coalD); R(g, bx + 1, 89 - h, 2, h - 1, c); R(g, bx + 1, 92 - h, 2, 1, PAL.creamL); bx += 5; }
            drawPlush(g, 293, 74);
        }

        // Calendario de pared: los días del plazo de la deuda activa (hasta 8), hoy en amarillo, el último marcado
        void drawCalendar(Ctx2D g, V st, double x, double y)
        {
            double w = 38, h = 36;
            R(g, x + 1, y + 1, w, h, PAL.coalD);
            R(g, x, y, w, h, PAL.creamL);
            R(g, x, y, w, 7, st["paid"].truthy ? PAL.green : (st["defaulted"].truthy ? PAL.coalL : PAL.coral));
            R(g, x + 8, y - 2, 2, 3, PAL.coalL); R(g, x + 28, y - 2, 2, 3, PAL.coalL);
            if (st["paid"].truthy)
            {
                Px.line(g, x + 12, y + 20, x + 17, y + 25, PAL.greenD, 2); Px.line(g, x + 17, y + 25, x + 27, y + 14, PAL.greenD, 2);
                return;
            }
            double day = st["day"].num, deadline = st["deadline"].num;
            double first = JsMath.max(st["start"].num, deadline - 7);
            for (double d = first; d <= deadline; d++)
            {
                double i = d - first, cx = x + 2 + (i % 4) * 9, cy = y + 9 + Math.Floor(i / 4) * 13;
                bool today = d == day, past = d < day;
                R(g, cx, cy, 8, 11, today ? PAL.yellow : PAL.cream);
                mini(g, Js.String(d), cx + (d >= 10 ? 1 : 3), cy + 3, today ? PAL.coal : PAL.creamDD);
                if (past) { Px.line(g, cx, cy + 1, cx + 7, cy + 10, PAL.coral); Px.line(g, cx + 7, cy + 1, cx, cy + 10, PAL.coral); }
                if (d == deadline) { R(g, cx, cy, 8, 1, PAL.coralD); R(g, cx, cy + 10, 8, 1, PAL.coralD); R(g, cx, cy, 1, 11, PAL.coralD); R(g, cx + 7, cy, 1, 11, PAL.coralD); }
            }
        }

        // La PLEYZETA 6 ULTRA: la misma consola de la tienda en pequeño
        static void drawConsoleBox(Ctx2D g, V st)
        {
            if (!st["console"].truthy) return;
            var sp = new PK.Sprite(40, 44);
            string[] WHITE = { PAL.creamDD, PAL.creamD, PAL.creamM, PAL.cream, PAL.creamL };
            string[] INK = { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL };
            // Núcleo negro entre las alas, con la luz azul a los dos lados
            sp.part(sp.mask().rect(13, 6, 6, 34), INK, light: new[] { -1, -1 }, lit: 1, sh: 1);
            sp.rect(13, 12, 1, 24, PAL.cyanD).rect(18, 12, 1, 24, PAL.cyanD).px(13, 20, PAL.cyan).px(18, 20, PAL.cyan);
            for (int i = 0; i < 3; i++) sp.rect(14, 8 + i * 2, 4, 1, PAL.coalM);
            // Alas blancas
            var wingL = sp.mask().poly(new (double x, double y)[] { (5, 5), (13, 3), (13, 41), (6, 42), (8, 30), (8, 17) });
            var wingR = sp.mask().poly(new (double x, double y)[] { (19, 3), (27, 5), (24, 17), (24, 30), (26, 42), (19, 41) });
            sp.part(wingL, WHITE, light: new[] { -1, -1 }, lit: 2, sh: 1, baseIdx: 3);
            sp.part(wingR, WHITE, light: new[] { -1, -1 }, lit: 1, sh: 2, baseIdx: 2);
            sp.rim(wingL, PAL.creamL, -1, 0);
            // Peana
            sp.rect(10, 41, 12, 2, PAL.coalD);
            // Mando blanco apoyado al lado
            var pad = sp.mask().ellipse(33, 38, 6, 2.6).capsule(29, 39, 28, 42, 1.8).capsule(37, 39, 38, 42, 1.8);
            sp.part(pad, WHITE, light: new[] { -1, -1 }, lit: 1, sh: 1, baseIdx: 3);
            sp.rect(31, 37, 4, 1, PAL.coal).px(29, 38, PAL.coalL).px(37, 37, PAL.cyan).px(38, 38, PAL.coral);
            g.drawImage(sp.canvas, 278, 98);
            if (own(st, "trofeo"))
            {
                var tp = new PK.Sprite(26, 14);
                var m = tp.mask().ellipse(12, 7, 8, 4).ellipse(19, 5, 4, 3).poly(new (double x, double y)[] { (17, 2), (16, -1), (19, 2) }).poly(new (double x, double y)[] { (21, 2), (23, -1), (23, 3) });
                tp.part(m, new[] { PAL.yellowDD, PAL.yellowD, PAL.yellow, PAL.yellowL }, light: new[] { 1, -1 });
                tp.rect(5, 10, 3, 3, PAL.yellowD).rect(15, 10, 3, 3, PAL.yellowD);
                g.drawImage(tp.canvas, 281, 89);
            }
        }

        static void drawPlush(Ctx2D g, double x, double y)
        {
            // Peluche redondo con cuernitos: el único que no se preocupa por el dinero
            var sp = new PK.Sprite(26, 16);
            var m = sp.mask().ellipse(13, 9, 10, 6.5).poly(new (double x, double y)[] { (5, 5), (4, 0), (9, 3) }).poly(new (double x, double y)[] { (17, 3), (22, 0), (21, 5) });
            sp.part(m, new[] { PAL.magentaDD, PAL.magentaD, PAL.coral, PAL.coralL, "#FFD0DA" }, light: new[] { 1, -1 });
            sp.rect(9, 8, 2, 2, PAL.coalDD).rect(16, 8, 2, 2, PAL.coalDD).px(9, 8, PAL.white).px(16, 8, PAL.white);
            sp.rect(12, 11, 3, 1, PAL.coalDD).rect(6, 11, 2, 1, PAL.coralL).rect(19, 11, 2, 1, PAL.coralL);
            g.drawImage(sp.canvas, x, y);
        }

        void drawMonitor(Ctx2D g)
        {
            double x = MON.x, y = MON.y, w = MON.w, h = MON.h;
            // Pie
            var stand = new PK.Sprite(40, 16);
            stand.part(stand.mask().poly(new (double x, double y)[] { (16, 0), (24, 0), (25, 8), (15, 8) }), new[] { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL }, light: new[] { 1, -1 });
            stand.part(stand.mask().ellipse(20, 10, 17, 3.5), new[] { PAL.coalDD, PAL.coalD, PAL.coal, PAL.coalL }, light: new[] { 1, -1 });
            g.drawImage(stand.canvas, x + w / 2 - 20, y + h - 1);
            // Marco con contraluz violeta en los bordes
            R(g, x, y, w, h, PAL.coalD);
            R(g, x + 1, y + 1, w - 2, h - 2, PAL.coal);
            R(g, x + 1, y + 1, w - 2, 1, PAL.violetL);
            R(g, x + 1, y + 1, 1, h - 2, PAL.violet);
            R(g, x + w - 2, y + 2, 1, h - 3, PAL.coalD);
            R(g, SCR.x - 1, SCR.y - 1, SCR.w + 2, SCR.h + 2, PAL.navyDD);
            R(g, SCR.x, SCR.y, SCR.w, SCR.h, PAL.navy);
            // Logo y botones del marco inferior
            R(g, x + w / 2 - 8, y + h - 4, 16, 1, PAL.coalL);
            R(g, x + w - 26, y + h - 5, 3, 2, PAL.coalL); R(g, x + w - 21, y + h - 5, 3, 2, PAL.coalL);
        }

        void drawDesk(Ctx2D g)
        {
            // Tablero: la luz de la ventana lo calienta por la izquierda
            R(g, 0, DESK_Y, RW, RH - DESK_Y, PAL.woodM);
            R(g, 0, DESK_Y, RW, 2, PAL.wood);
            for (int y = DESK_Y + 6; y < RH; y += 9) R(g, 0, y, RW, 1, PAL.woodD);
            var rng = new RNG(42);
            for (int i = 0; i < 70; i++)
            {
                double x = rng.@int(0, RW - 10), y = rng.@int(DESK_Y + 3, RH - 2), w = rng.@int(4, 14);
                R(g, x, y, w, 1, rng.next() < 0.5 ? PAL.woodD : "#8A4038");
            }
            for (int i = 0; i < 4; i++) R(g, 0, RH - 4 + i, RW, 1, i < 2 ? PAL.woodD : PAL.woodDD);
            // Sombra del monitor sobre la mesa
            R(g, MON.x + 8, DESK_Y + 3, MON.w - 16, 2, PAL.woodD);
        }

        static string[] keyColors(V st, Key k)
        {
            if (own(st, "teclado")) return null; // RGB animado (se pinta cada fotograma)
            if (k.code == "Escape") return new[] { PAL.coral, PAL.coralD };
            if (k.code == "Enter") return new[] { PAL.green, PAL.greenD };
            if (k.code == "Space") return new[] { PAL.yellow, PAL.yellowD };
            if (k.code == "KeyB" || k.code == "ArrowUp") return new[] { PAL.green, PAL.greenD };
            if (k.code == "KeyV" || k.code == "ArrowDown") return new[] { PAL.coral, PAL.coralD };
            if (k.code == "ArrowLeft" || k.code == "ArrowRight") return new[] { PAL.cyan, PAL.cyanD };
            return new[] { PAL.creamM, PAL.creamDD };
        }

        void drawKeyboard(Ctx2D g, V st)
        {
            R(g, KB.x + 2, KB.y + KB.h + 1, KB.w, 3, PAL.woodDD);
            R(g, KB.x, KB.y, KB.w, KB.h + 1, PAL.coalD);
            R(g, KB.x + 1, KB.y + 1, KB.w - 2, KB.h - 1, PAL.navyM);
            R(g, KB.x + 1, KB.y, KB.w - 2, 1, PAL.navyLL);
            foreach (var k in KEYS)
            {
                var cols = keyColors(st, k) ?? new[] { PAL.navyLL, PAL.navyL };
                R(g, k.x, k.y, k.w, k.h, cols[0]);
                R(g, k.x, k.y + k.h - 1, k.w, 1, cols[1]);
            }
            // Cable hacia el monitor
            Px.line(g, KB.x + 70, KB.y, KB.x + 74, DESK_Y + 4, PAL.coalD);
        }

        static void drawMug(Ctx2D g, V st)
        {
            double x = 62, y = 132;
            var sp = new PK.Sprite(20, 20);
            bool nice = own(st, "taza");
            var body = sp.mask().poly(new (double x, double y)[] { (2, 4), (14, 4), (13, 17), (3, 17) });
            sp.part(body, nice ? new[] { PAL.violetDD, PAL.violetD, PAL.violet, PAL.violetL } : new[] { PAL.creamDD, PAL.creamD, PAL.cream, PAL.creamL }, light: new[] { 1, -1 });
            sp.part(sp.mask().capsule(15, 8, 15, 13, 2.2).clear(sp.mask().capsule(15, 8, 15, 13, 0.8)),
                nice ? new[] { PAL.violetDD, PAL.violetD, PAL.violet } : new[] { PAL.creamDD, PAL.creamD, PAL.cream }, light: new[] { 1, -1 });
            sp.rect(3, 4, 11, 2, PAL.woodDD).rect(4, 5, 9, 1, "#5A2A20");
            if (nice) { sp.rect(5, 9, 6, 3, PAL.creamL).px(6, 10, PAL.coralD).px(9, 10, PAL.cyanD); } // mando de consola
            else { sp.px(12, 5, PAL.wall).px(13, 6, PAL.wall); } // desportillada
            g.drawImage(sp.canvas, x, y);
        }

        static void drawRamen(Ctx2D g)
        {
            double x = 276, y = 144;
            var sp = new PK.Sprite(34, 24);
            // Palillos
            sp.line(20, 0, 26, 12, PAL.woodD, 1).line(24, 0, 28, 12, PAL.wood, 1);
            var bowl = sp.mask().poly(new (double x, double y)[] { (2, 9), (30, 9), (27, 18), (21, 21), (11, 21), (5, 18) });
            sp.part(bowl, new[] { PAL.creamDD, PAL.creamD, PAL.cream, PAL.creamL }, light: new[] { 1, -1 }, lit: 2);
            for (int i = 4; i < 28; i += 4) sp.rect(i, 13, 2, 2, PAL.coral).px(i + 1, 14, PAL.coralD);
            sp.rect(4, 8, 24, 2, PAL.yellowD).rect(6, 7, 20, 1, PAL.yellow);
            foreach (int xx in new[] { 8, 13, 18, 23 }) sp.px(xx, 7, PAL.yellowL);
            sp.rect(10, 7, 4, 2, PAL.coralL).rect(18, 6, 3, 2, PAL.greenD);
            g.drawImage(sp.canvas, x, y);
        }

        void drawBills(Ctx2D g, V st)
        {
            int n = (int)JsMath.min(5, 1 + st["day"].num);
            for (int i = 0; i < n; i++)
            {
                double x = 276 + (i % 3) * 3 - i, y = 168 - i * 2;
                R(g, x, y, 16, 9, PAL.creamDD); R(g, x, y, 15, 8, PAL.creamL);
                Px.line(g, x, y, x + 7, y + 4, PAL.creamD); Px.line(g, x + 7, y + 4, x + 14, y, PAL.creamD);
                R(g, x + 11, y + 5, 3, 2, PAL.coral);
            }
        }

        static void drawPad(Ctx2D g, V st)
        {
            if (own(st, "alfombrilla"))
            {
                R(g, 214, 145, 104, 34, PAL.coalD); R(g, 215, 146, 102, 32, PAL.navyD);
                for (int i = 0; i < 102; i += 6) R(g, 215 + i, 176, 3, 1, i % 12 != 0 ? PAL.magenta : PAL.cyan);
                return;
            }
            R(g, 223, 147, 50, 28, PAL.coalD); R(g, 224, 148, 48, 26, PAL.violetD); R(g, 224, 148, 48, 1, PAL.violet);
        }

        // ---------------- Vista de la ventana (animada) ----------------
        static string[] skyColors(string phase)
        {
            if (phase == "morning") return new[] { "#9ED9F2", "#BFE7F2", "#E2F2EE", "#FDE8C8" };
            if (phase == "evening") return new[] { "#4A2370", "#9A3488", "#E0587A", "#FF9A4A", "#FFC773" };
            return new[] { "#0B0820", "#140E30", "#1E1442", "#2A1A54" };
        }

        void drawWindowView(Ctx2D g, V st)
        {
            double x = WIN.x, y = WIN.y, w = WIN.w, h = WIN.h;
            string phase = st["phase"].str;
            var sky = skyColors(phase);
            double band = Math.Ceiling(h / sky.Length);
            g.save();
            g.beginPath(); g.rect(x, y, w, h); g.clip();
            for (int i = 0; i < sky.Length; i++) R(g, x, y + i * band, w, band, sky[i]);
            if (phase == "night")
            {
                for (int i = 0; i < 18; i++)
                {
                    double sx = x + ((i * 37) % w), sy = y + ((i * 23) % 40);
                    if (JsMath.sin(t * 2 + i) > -0.3) R(g, sx, sy, 1, 1, PAL.cream);
                }
                Px.ellipse(g, x + 26, y + 12, 5, 5, PAL.creamL);
                Px.ellipse(g, x + 28, y + 11, 4, 4, "#140E30");
            }
            else if (phase == "morning")
            {
                Px.ellipse(g, x + 12, y + 14, 6, 6, PAL.yellowL);
                double cx = x + ((t * 3) % (w + 30)) - 20;
                R(g, cx, y + 24, 16, 4, PAL.creamL); R(g, cx + 4, y + 21, 8, 3, PAL.creamL);
            }
            else
            {
                Px.ellipse(g, x + 24, y + 50, 10, 10, PAL.yellowL);
                Px.ellipse(g, x + 24, y + 50, 7, 7, PAL.yellow);
            }
            g.restore();
            // Ciudad con parallax: se mueve menos que la cámara
            double par = JsMath.round(-camShift * 0.12);
            double baseY = y + h;
            g.save();
            g.beginPath(); g.rect(x, y, w, h); g.clip();
            double dark = st["dark"].num;
            bool night = phase == "night";
            foreach (var b in city)
            {
                double bx = x + b.x + par;
                string body = night ? new[] { "#1A1236", "#140E2C", "#22183F" }[b.tone]
                    : phase == "evening" ? new[] { "#6A2A5A", "#58204E", "#7A3060" }[b.tone]
                    : new[] { "#9AA8C8", "#8A98BA", "#B0BCD6" }[b.tone];
                R(g, bx, baseY - b.h, b.w, b.h, body);
                if (b.antenna)
                {
                    R(g, bx + 3, baseY - b.h - 5, 1, 5, body);
                    if (night && JsMath.sin(t * 3 + b.x) > 0.6) R(g, bx + 3, baseY - b.h - 6, 1, 1, PAL.coral);
                }
                foreach (var wv in b.wins)
                {
                    // Cuantas más noticias extrañas, menos ventanas encendidas
                    double litChance = night ? 0.55 - dark * 0.06 : phase == "evening" ? 0.25 - dark * 0.03 : 0;
                    bool on = wv.seed < litChance && !(wv.seed < 0.06 && JsMath.sin(t * 0.7 + wv.seed * 40) > 0.95);
                    if (!on) continue;
                    R(g, bx + wv.x, baseY - b.h + wv.y, 1, 1, new[] { PAL.yellow, PAL.yellowL, PAL.magentaL, PAL.cyanL }[wv.hue]);
                }
            }
            // Letrero de neón lejano (parpadea de forma irregular)
            if (night || phase == "evening")
            {
                bool flick = JsMath.sin(t * 13) + JsMath.sin(t * 3.1) > -0.4;
                if (flick) { R(g, x + 52 + par, y + 34, 12, 3, PAL.magenta); R(g, x + 53 + par, y + 35, 10, 1, PAL.magentaL); }
            }
            drawWindowEvents(g, x, y, w, h, baseY, par, night);
            g.restore();
        }

        // Sucesos al otro lado de la ventana (dentro del recorte de la ventana, detrás de las persianas)
        void drawWindowEvents(Ctx2D g, double x, double y, double w, double h, double baseY, double par, bool night)
        {
            for (int i = winEvents.Count - 1; i >= 0; i--)
            {
                var e = winEvents[i];
                double a = t - e.t0, k = a / e.dur;
                if (k >= 1) { winEvents.RemoveAt(i); continue; }
                double fade = Util.clamp(JsMath.min(a / 0.6, (e.dur - a) / 0.8), 0, 1);
                if (e.kind == "ambulancia")
                {
                    // Luces rojas y azules barriendo la calle, y la ambulancia cruzando
                    bool on = Math.Floor(a * 6) % 2 == 0;
                    g.globalAlpha = 0.22 * fade; R(g, x, y, w, h, on ? PAL.coral : PAL.cyan); g.globalAlpha = 1;
                    double vx = JsMath.round(x - 12 + k * (w + 24));
                    R(g, vx, baseY - 6, 10, 5, PAL.creamL); R(g, vx, baseY - 4, 10, 1, PAL.coral); R(g, vx + 7, baseY - 6, 3, 2, "#7FA8D8");
                    R(g, vx + 2, baseY - 7, 2, 1, on ? PAL.coral : PAL.cyan); R(g, vx + 5, baseY - 7, 2, 1, on ? PAL.cyan : PAL.coral);
                    R(g, vx + 1, baseY - 1, 2, 1, PAL.coalD); R(g, vx + 7, baseY - 1, 2, 1, PAL.coalD);
                }
                else if (e.kind == "apagon")
                {
                    // Las luces de la ciudad se apagan de golpe; al final parpadean y vuelven
                    bool flicker = k > 0.8 && JsMath.sin(a * 40) > 0;
                    if (!flicker) { g.globalAlpha = 0.85 * fade; R(g, x, y + 20, w, h - 20, "#07061A"); g.globalAlpha = 1; }
                }
                else if (e.kind == "farolas")
                {
                    // Las farolas de la calle se encienden una a una
                    const int lamps = 5;
                    int lit = (int)JsMath.min(lamps, Math.Floor(a / 1.1));
                    g.globalAlpha = 0.85 * (1 - (double)lit / lamps) * fade; R(g, x, y + 20, w, h - 20, "#07061A"); g.globalAlpha = 1;
                    for (int j = 0; j < lamps; j++)
                    {
                        double lx = x + 4 + JsMath.round(j * (w - 8) / (lamps - 1)), ly = baseY - 12;
                        R(g, lx, ly, 1, 12, PAL.coalD); R(g, lx - 1, ly - 1, 3, 1, PAL.coalD);
                        if (j < lit) { R(g, lx - 1, ly, 3, 1, PAL.yellowL); g.globalAlpha = 0.28 * fade; Px.ellipse(g, lx, ly + 7, 5, 7, PAL.yellow); g.globalAlpha = 1; }
                    }
                }
                else if (e.kind == "fuegos")
                {
                    for (int n = 0; n < 4; n++)
                    {
                        double ta = a - n * 0.65 - 0.2;
                        if (ta < 0 || ta > 1.4) continue;
                        double cx = x + 8 + ((e.seed + n * 53) % (w - 16)), cy = y + 10 + ((e.seed * 3 + n * 29) % 26);
                        double r = 2 + ta * 9;
                        string col = new[] { PAL.yellowL, PAL.magentaL, PAL.cyanL, PAL.greenL }[n % 4];
                        g.globalAlpha = Util.clamp(1.4 - ta, 0, 1);
                        for (int j = 0; j < 10; j++)
                        {
                            double an = j / 10.0 * JsMath.PI * 2;
                            R(g, JsMath.round(cx + JsMath.cos(an) * r), JsMath.round(cy + JsMath.sin(an) * r + ta * ta * 3), 1, 1, col);
                        }
                        g.globalAlpha = 1;
                    }
                }
                else if (e.kind == "encapuchado")
                {
                    // Una silueta encapuchada en una azotea, mirándote. Parpadea.
                    (double h, double x, double w) best = (0, 14, 8);
                    foreach (var c in city)
                        if (c.x + par > 4 && c.x + par < w - 8 && c.h > best.h) best = (c.h, c.x, c.w);
                    double sx = x + best.x + par + Math.Floor(best.w / 2) - 2, sy = baseY - best.h - 9;
                    g.globalAlpha = fade;
                    R(g, sx + 1, sy, 3, 1, "#05040A"); R(g, sx, sy + 1, 5, 4, "#05040A"); R(g, sx - 1, sy + 5, 7, 4, "#05040A");
                    if (JsMath.sin(a * 3) > -0.85) { R(g, sx + 1, sy + 2, 1, 1, PAL.yellowL); R(g, sx + 3, sy + 2, 1, 1, PAL.yellowL); }
                    g.globalAlpha = 1;
                }
                else if (e.kind == "dron")
                {
                    double dx = JsMath.round(x + w + 8 - k * (w + 20)), dy = JsMath.round(y + 30 + JsMath.sin(a * 4) * 2);
                    R(g, dx - 2, dy, 9, 1, PAL.coalD); R(g, dx, dy + 1, 5, 2, PAL.coal); R(g, dx + 1, dy + 3, 3, 3, PAL.coral); R(g, dx + 2, dy + 4, 1, 1, PAL.creamL);
                    if (Math.Floor(a * 4) % 2 != 0) R(g, dx + 2, dy - 1, 1, 1, PAL.greenL);
                }
                else if (e.kind == "camion")
                {
                    // Camión de embargos cruzando la calle
                    double vx = JsMath.round(x + w + 14 - k * (w + 30));
                    R(g, vx, baseY - 8, 12, 7, "#6A6A82"); R(g, vx - 4, baseY - 6, 4, 5, "#4E4E66"); R(g, vx - 3, baseY - 5, 2, 2, "#9FB6FF");
                    R(g, vx + 4, baseY - 6, 3, 3, PAL.coral); R(g, vx + 5, baseY - 5, 1, 1, PAL.creamL);
                    R(g, vx - 2, baseY - 1, 2, 1, PAL.coalD); R(g, vx + 8, baseY - 1, 2, 1, PAL.coalD);
                }
                else if (e.kind == "oro")
                {
                    // LLUVIA DE ORO (día de la suerte): monedas que caen y brillan
                    g.globalAlpha = 0.22 * fade; R(g, x, y, w, h, PAL.yellowD); g.globalAlpha = fade;
                    for (int n = 0; n < 14; n++)
                    {
                        double rx = x + ((n * 11 + e.seed) % (w - 2)), ry = y + ((n * 23 + a * 40) % h);
                        int flip = (int)Math.Floor(a * 8 + n) % 4;
                        R(g, JsMath.round(rx), JsMath.round(ry), flip == 1 ? 1 : 2, 2, flip == 3 ? PAL.yellowL : PAL.yellow);
                    }
                    g.globalAlpha = 1;
                }
                else if (e.kind == "lluvia")
                {
                    g.globalAlpha = 0.18 * fade; R(g, x, y, w, h, "#1A2050"); g.globalAlpha = 0.55 * fade;
                    for (int n = 0; n < 26; n++)
                    {
                        double rx = x + ((n * 13 + e.seed) % w), ry = y + ((n * 29 + a * 90) % h);
                        R(g, JsMath.round(rx), JsMath.round(ry), 1, 3, "#9FB6FF");
                    }
                    g.globalAlpha = 1;
                }
                else if (e.kind == "cuervo")
                {
                    // Llega volando, se posa en el alféizar, gira la cabeza y se va
                    double land = Util.clamp(a / 1.2, 0, 1), leave = Util.clamp((a - e.dur + 1.4) / 1.4, 0, 1);
                    double cx = JsMath.round(x + w - 10 + (1 - land) * 16 + leave * 18), cy = JsMath.round(baseY - 4 - (1 - land) * 14 - leave * 16);
                    R(g, cx, cy, 5, 3, "#0A0812"); R(g, cx + 4, cy - 2, 3, 3, "#0A0812");
                    double look = JsMath.sin(a * 1.5) > 0 ? 1 : -1;
                    R(g, look > 0 ? cx + 7 : cx + 3, cy - 1, 1, 1, PAL.yellow);
                    R(g, cx + (look > 0 ? 5 : 4), cy - 1, 1, 1, PAL.coral);
                    if (land < 1 || leave > 0) R(g, cx + 1, cy - 2 + (Math.Floor(a * 10) % 2) * 3, 3, 1, "#0A0812");
                }
                else if (e.kind == "temblor")
                {
                    g.globalAlpha = 0.4 * fade;
                    for (int n = 0; n < 14; n++) R(g, x + ((n * 11 + e.seed) % w), y + 20 + ((n * 17 + a * 40) % (h - 20)), 1, 1, PAL.creamD);
                    g.globalAlpha = 1;
                }
            }
        }

        // ---------------- Partes animadas ----------------
        void drawAnimated(Ctx2D g, V st, double dt)
        {
            // Vapor de la taza y del ramen
            foreach (var (sx, sy, n) in new[] { (68.0, 132.0, 3), (288.0, 146.0, 4) })
            {
                for (int i = 0; i < n; i++)
                {
                    double p = (t * 0.5 + (double)i / n) % 1;
                    double y = sy - p * 16, x = sx + i * 3 + JsMath.round(JsMath.sin(t * 2 + i * 2 + p * 6) * 1.5);
                    g.globalAlpha = 0.55 * (1 - p);
                    R(g, JsMath.round(x), JsMath.round(y), 1, 2, PAL.creamL);
                }
            }
            g.globalAlpha = 1;
            // Ondas de calor sobre la consola
            for (int i = 0; i < 4 && st["console"].truthy; i++)
            {
                double hx = 284 + i * 5;
                for (int yy = 0; yy < 12; yy += 2)
                {
                    double off = JsMath.round(JsMath.sin(t * 3 + yy * 0.5 + i) * 1.2);
                    g.globalAlpha = 0.32 - yy * 0.022;
                    R(g, hx + off, 104 - yy - Math.Floor((t * 8 + i * 5) % 5), 1, 2, PAL.orange);
                }
            }
            g.globalAlpha = 1;
            // Teclas pulsadas (y teclado RGB si lo compraste)
            foreach (var k in KEYS)
            {
                if (k.press > 0) k.press = JsMath.max(0, k.press - dt);
                if (own(st, "teclado"))
                {
                    double hue = (k.c * 22 + k.r * 30 + t * 120) % 360;
                    R(g, k.x, k.y, k.w, k.h, "hsl(" + Js.String(hue) + ", 85%, " + (k.press > 0 ? "80" : "62") + "%)");
                }
                else if (k.press > 0) R(g, k.x, k.y, k.w, k.h, PAL.white);
            }
            // Guirnalda: bombillos que titilan
            string[] bulbs = { PAL.yellow, PAL.magentaL, PAL.cyan, PAL.green };
            int idx = 0;
            foreach (var (a, b) in GARLAND)
                for (double x = a + 3; x < b - 2; x += 8, idx++)
                {
                    double sag = sagAt(x);
                    bool on = JsMath.sin(t * 2.2 + idx * 1.7) > -0.5;
                    R(g, x, sag + 1, 2, 2, on ? bulbs[idx % 4] : PAL.coalL);
                    if (on) { g.globalAlpha = 0.25; R(g, x - 1, sag, 4, 4, bulbs[idx % 4]); g.globalAlpha = 1; }
                }
            // LED del monitor
            bool ledOn = led == "busy" ? Math.Floor(t * 8) % 2 == 0 : led == "alert" ? Math.Floor(t * 4) % 2 == 0 : true;
            // (en el marco, a la altura de los dos botones y a su derecha)
            if (!st["noPC"].truthy) R(g, MON.x + MON.w - 16, MON.y + MON.h - 5, 2, 2, ledOn ? (led == "alert" ? PAL.coral : PAL.green) : PAL.greenDD);
        }

        static void drawHeadphones(Ctx2D g)
        {
            // Auriculares colgados de la esquina del monitor
            Px.line(g, 268, 92, 272, 84, PAL.coalD, 2); Px.line(g, 272, 84, 286, 86, PAL.coalD, 2); Px.line(g, 286, 86, 288, 96, PAL.coalD, 2);
            R(g, 265, 92, 6, 9, PAL.coal); R(g, 266, 93, 4, 7, PAL.coral);
            R(g, 285, 95, 6, 9, PAL.coal); R(g, 286, 96, 4, 7, PAL.coral);
        }

        void drawLampGlowBehind(Ctx2D g, V st)
        {
            if (!own(st, "lampara") || st["phase"] == "morning") return;
            g.globalCompositeOperation = "lighter";
            foreach (var (r, a) in new[] { (38.0, 0.05), (26.0, 0.07), (16.0, 0.1) }) { g.globalAlpha = a; Px.ellipse(g, 49, 14, r, r * 0.8, PAL.orange); }
            g.globalAlpha = 1;
            g.globalCompositeOperation = "source-over";
        }

        // ---------------- Luz ----------------
        static string tintFor(string phase)
        {
            if (phase == "morning") return "#F4F0FF";
            if (phase == "night") return "#8676C2";
            return "#F2DCEE"; // evening (y lo desconocido)
        }

        void drawLighting(Ctx2D g, V st, double dt)
        {
            // Tinte de la hora del día (y de lo raro que se está volviendo todo)
            string phase = st["phase"].str;
            double dark = st["dark"].num;
            g.globalCompositeOperation = "multiply";
            g.fillStyle = dark != 0 ? PK.mix(tintFor(phase), "#6A5A9A", JsMath.min(0.5, dark / 14)) : tintFor(phase);
            g.fillRect(0, 0, RW, RH);
            // Brillo cálido de la ventana (bandas, sin degradados borrosos)
            g.globalCompositeOperation = "lighter";
            string wc = phase == "morning" ? PAL.yellowL : phase == "evening" ? PAL.orange : PAL.magenta;
            double wa = phase == "night" ? 0.04 : 0.07;
            foreach (var (rx, ry, a) in new[] { (70.0, 56.0, wa), (52.0, 42.0, wa * 1.2), (36.0, 30.0, wa * 1.4) })
            {
                g.globalAlpha = a;
                Px.ellipse(g, WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, rx, ry, wc);
            }
            // Luz del monitor: más fuerte de noche, del color de la operación
            var gl = glow;
            gl.flash = JsMath.max(0, gl.flash - dt * 2.5);
            double baseK = phase == "night" ? 0.075 : 0.045;
            double k = baseK * (0.6 + gl.k * 0.8);
            foreach (var (rx, ry, a) in new[] { (170.0, 60.0, k * 0.5), (130.0, 44.0, k * 0.7), (96.0, 30.0, k) })
            {
                g.globalAlpha = a;
                Px.ellipse(g, SCR.x + SCR.w / 2, DESK_Y + 22, rx, ry, gl.color);
            }
            if (gl.flash > 0) { g.globalAlpha = gl.flash * 0.18; Px.ellipse(g, SCR.x + SCR.w / 2, DESK_Y + 20, 190, 90, gl.flashColor); }
            // Motas de polvo flotando en la luz de la ventana
            g.globalAlpha = phase == "night" ? 0.35 : 0.6;
            foreach (var m in motes)
            {
                m.y -= m.s * dt * 4; m.x += JsMath.sin(t * 0.7 + m.ph) * dt * 1.2;
                if (m.y < WIN.y) { m.y = WIN.y + WIN.h + 50; m.x = WIN.x + 2 + ((m.ph * 29 + t * 13) % (WIN.w + 6)); }
                R(g, JsMath.round(m.x), JsMath.round(m.y), 1, 1, wc);
            }
            g.globalAlpha = 1;
            g.globalCompositeOperation = "source-over";
        }
    }
}
