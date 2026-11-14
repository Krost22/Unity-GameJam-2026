// Port de js/systems/music.js (SN.Music): el director de la música, con las pistas de Musics/ con fundidos, sin cortes
// y a compás (las pistas, en js/data/music.js: SN.Data["music"]).
//   · Cada momento tiene su pista: menú, partida, ganando, mercado negro, día de la suerte, Bravo Fines, el
//     encapuchado y el final. El director mira el estado del juego y decide cuál toca.
//   · Las pistas de la partida van a 90 BPM: un cambio espera al siguiente compás y la pista nueva entra por el
//     mismo compás en el que iba la anterior (no se pierde el ritmo).
//   · El bucle se cierra con un fundido muy corto entre dos copias del mismo archivo (el MP3 deja un hueco).
//   · Lo que no tiene pista propia se hace con la cinta y con un pulso a tempo: PERDIENDO frena la cinta (más
//     lenta y más grave, con vaivén); en las ÚLTIMAS VELAS y el ÚLTIMO DÍA de una deuda suena un tic-tac a
//     compás (js/systems/audio.js); al quedarte SIN DINERO la cinta se para.
//   · Con <audio> y no con Web Audio a propósito: así también funciona abriendo index.html con doble clic.
// Los efectos de sonido se afinan con la pista que suena: SN.Music.tonality().
//
// Port: los <audio> son IAudioEl (Dom.createAudio()). El setInterval de 40 ms es Dom.setInterval. Como no hay
// document, 'visibilitychange' se porta como onHidden() / onVisible(), que llama el anfitrión.
using System;
using System.Collections.Generic;
using System.Text;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Music
    {
        // Una pista: dos copias del archivo (o una, si es de una vez o del menú) para cerrar el bucle
        sealed class Voice
        {
            public string id;
            public V t;
            public readonly List<IAudioEl> els = new List<IAudioEl>();
            public int cur;
            public double env, target, fade, rate;
            public Xfade xf;
            public bool playing, failed;
        }
        // Solape al cerrar el bucle: de la copia que se acaba a la que empieza
        sealed class Xfade { public IAudioEl from, to; public double k; }
        // Operación en directo: r = resultado / apostado
        sealed class Trade { public double r; public bool danger, settled; }
        // La cinta frenándose: t segundos de dur
        sealed class Tape { public double t, dur; }

        sealed class St
        {
            public bool enabled;
            public int timer;        // 0 = sin reloj (null en la web)
            public double last;
            public bool unlocked;
            public string mood = "normal";
            public bool duck;
            public double dark;
            public string main;      // pista que suena
            public string want;      // pista que toca
            public double switchAt;  // cuándo se cambia (el siguiente compás)
            public string menu = "menu1"; // parte del tema del menú que toca
            public Trade trade;
            public double winUntil;  // GANANDO se queda un rato tras una operación ganada
            public bool ending;      // el final suena hasta la siguiente operación
            public bool stopped;     // cinta parada (sin dinero) hasta que vuelva el ambiente normal
            public string force;     // una pista fija durante una escena (los finales): manda sobre todo lo demás
            public string pulseKind; // pulso a tempo pedido a mano ('danger' | 'clock'), p. ej. en la terminal de NULL.EXE
            public Tape tape;
            public double mix;       // volumen general de la música ahora mismo
            public double pulseIdx = -1; // último golpe del pulso programado
        }

        readonly Dictionary<string, Voice> voices = new Dictionary<string, Voice>();
        readonly St st = new St();
        readonly List<IAudioEl> hidden = new List<IAudioEl>();      // <audio> parados al ocultar la pestaña
        readonly HashSet<IAudioEl> unlockedEls = new HashSet<IAudioEl>(); // a.dataset.unlocked
        readonly bool volOK;

        public Music()
        {
            // En iPhone y iPad el volumen de un <audio> no se puede cambiar: allí se cambia de pista sin fundido
            try { var t = Dom.createAudio(); t.volume = 0.5; volOK = Math.Abs(t.volume - 0.5) < 0.01; } catch (Exception) { volOK = false; }
        }

        // ---------- Datos y utilidades ----------
        static V C() { return SN.Data["music"]; }
        static V Track(string id) { return id == null ? V.undefined : C()["tracks"][id]; }
        static double Now() { return Dom.now() / 1000.0; }
        static double Bar() { return 60 / C()["bpm"].num * C()["beatsPerBar"].num; }
        static bool Ok(V v) { return !(v is null) && v.truthy; }
        static double OrOne(double x) { return x != 0 && !double.IsNaN(x) ? x : 1; } // x || 1
        static double Fx(double x, int digits) { return JsNumber.fromString(JsNumber.toFixed(x, digits)); } // +x.toFixed(n)
        static bool isFinite(double x) { return !double.IsNaN(x) && !double.IsInfinity(x); }
        static double clamp(double v, double a, double b) { return JsMath.max(a, JsMath.min(b, v)); }

        // encodeURI de JS: deja letras, cifras y ;,/?:@&=+$#-_.!~*'() tal cual; el resto en UTF-8 (el espacio, %20)
        static string encodeURI(string s)
        {
            var sb = new StringBuilder();
            foreach (byte b in Encoding.UTF8.GetBytes(s))
            {
                char c = (char)b;
                bool keep = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || "-_.!~*'();/?:@&=+$,#".IndexOf(c) >= 0;
                if (b < 128 && keep) sb.Append(c);
                else sb.Append('%').Append(b.ToString("X2"));
            }
            return sb.ToString();
        }

        // voices[id] (null si no existe)
        Voice Find(string id) { if (id == null) return null; Voice v; return voices.TryGetValue(id, out v) ? v : null; }

        // ---------- Voces: cada pista, con dos copias del archivo para cerrar el bucle ----------
        Voice VoiceOf(string id)
        {
            var found = Find(id);
            if (found != null) return found;
            V t = Track(id);
            if (!Ok(t)) return null;
            var v = new Voice { id = id, t = t, cur = 0, env = 0, target = 0, fade = C()["fadeIn"].num, rate = OrOne(t["rate"].num), xf = null, playing = false, failed = false };
            int count = Ok(t["once"]) || Ok(t["next"]) ? 1 : 2;
            for (int i = 0; i < count; i++)
            {
                var a = Dom.createAudio();
                // DUDA: a.preload = 'auto' (js/systems/music.js:73) no existe en IAudioEl: se omite.
                // Frenar la cinta también la vuelve más grave (como una cinta de verdad)
                // (js: preservesPitch, mozPreservesPitch y webkitPreservesPitch; aquí solo existe preservesPitch)
                a.preservesPitch = false;
                a.onError = () => { v.failed = true; };
                if (!volOK && !Ok(t["once"]) && !Ok(t["next"])) a.loop = true; // sin volumen no hay fundido: bucle del navegador
                a.src = encodeURI(C()["dir"].str + t["file"].str);
                try { a.volume = 0; } catch (Exception) { /* iOS */ }
                v.els.Add(a);
            }
            voices[id] = v;
            return v;
        }
        static IAudioEl El(Voice v) { return v != null ? v.els[v.cur] : null; }
        // v.els[1 - v.cur]: la otra copia (null si la pista tiene una sola)
        static IAudioEl Other(Voice v) { int i = 1 - v.cur; return i >= 0 && i < v.els.Count ? v.els[i] : null; }
        // (quitar el silencio también cancela el desbloqueo en curso de ese <audio>: ver unlockVoices)
        static void Play(IAudioEl a) { a.muted = false; try { a.play(); } catch (Exception) { /* sin audio */ } }
        static void Seek(IAudioEl a, double t) { try { a.currentTime = t; } catch (Exception) { /* todavía sin cargar */ } }
        static void stopVoice(Voice v)
        {
            foreach (var a in v.els) { try { a.pause(); } catch (Exception) { } }
            v.playing = false; v.xf = null; v.env = 0; v.target = 0;
        }
        void start(Voice v, double offset)
        {
            v.target = 1; v.fade = C()["fadeIn"].num;
            if (v.playing) return; // todavía sonaba (estaba saliendo): sigue por donde iba
            var a = El(v);
            offset = Ok(v.t["sync"]) && isFinite(a.duration) && a.duration > 0 ? offset % a.duration : 0;
            // Si la entrada cae justo al final, mejor desde el principio (el bucle ya se cerraría)
            if (isFinite(a.duration) && a.duration - offset < 0.5) offset = 0;
            Seek(a, offset);
            v.rate = rateFor(v, Now());
            foreach (var x in v.els) x.playbackRate = v.rate;
            Play(a);
            v.playing = true;
            var b = Other(v);
            if (b != null) Seek(b, 0); // la otra copia, lista en el principio para cerrar el bucle
        }

        // ---------- ¿Qué pista toca? ----------
        bool winning(double t)
        {
            var tr = st.trade; var w = C()["winning"];
            if (tr != null && !tr.settled) return tr.r >= (st.main == "win" ? w["stay"].num : w["enter"].num);
            return t < st.winUntil;
        }
        string resolve(double t)
        {
            if (st.tape != null) return st.main;
            if (st.enabled && st.force != null) return st.force;
            if (!st.enabled || st.stopped) return null;
            var G = SN.Game;
            string state = G != null ? G.state : null;
            if (state == "MENU" || state == "BOOT" || state == "INTRO") return st.menu;
            if (state != "GAMEPLAY" && state != "BANKRUPTCY") return st.main;
            if (st.ending) return "final";
            var Dg = SN.Dialog; var W = SN.Windows;
            bool bravo = (Dg != null && Dg.active && Ok(Dg.opts) && (Dg.opts["voice"] == "bravo" || Dg.opts["portrait"] == "bravo")) || (W != null && W.current == "upgrades");
            if (bravo) return "bravo";
            if (winning(t)) return "win";
            V run = SN.State.run;
            V def = run.truthy ? SN.Data.marketById(run["selected"]) : V.@null;
            if (Ok(def) && def["black"].truthy) return "black";
            if (SN.Luck != null && Ok(SN.Luck.today())) return "lucky";
            return "base";
        }
        // Entre pistas de la partida el cambio espera al siguiente compás; desde el menú o hacia el silencio, ya
        double planSwitch(string id, double t)
        {
            var v = Find(st.main); var a = El(v); V to = id != null ? Track(id) : V.@null;
            if (v == null || !v.playing || a == null || a.paused || !isFinite(a.duration) || st.mix < 0.05 || !Ok(v.t["sync"]) || !Ok(to) || !Ok(to["sync"])) return t;
            double p = a.currentTime, next = Math.Ceiling((p + 0.02) / Bar()) * Bar();
            return t + (next - p) / OrOne(a.playbackRate);
        }
        void doSwitch(string id)
        {
            var old = Find(st.main);
            var to = !string.IsNullOrEmpty(id) ? VoiceOf(id) : null;
            double offset = 0;
            // Mismo compás: la nueva pista entra por donde iba la anterior (todas a 90 BPM y de compases enteros)
            if (old != null && old.playing && to != null && Ok(old.t["sync"]) && Ok(to.t["sync"])) { var a = El(old); if (a != null && isFinite(a.currentTime)) offset = a.currentTime; }
            if (old != null && old != to) { old.target = 0; old.fade = C()["fadeOut"].num; }
            st.main = id;
            if (to != null) start(to, offset);
        }

        // ---------- Volumen general y velocidad de la cinta ----------
        double losingDepth()
        {
            var tr = st.trade; var L = C()["losing"];
            if (tr == null || tr.settled || tr.r >= -L["from"].num) return 0;
            return clamp((-tr.r - L["from"].num) / (L["full"].num - L["from"].num), 0, 1);
        }
        double mixTarget()
        {
            if (!st.enabled) return 0;
            var m = C()["mix"]; var tr = st.trade;
            double k = st.mood == "silent" ? 0 : st.mood == "tense" ? m["tense"].num : 1;
            if (st.duck) k *= m["duck"].num;
            if (SN.Desktop != null && SN.Desktop.open) k *= m["desktop"].num;
            if (tr != null && !tr.settled && tr.danger) k *= m["danger"].num;
            k *= 1 - (1 - m["losing"].num) * losingDepth();
            var h = Find("hood");
            if (h != null && h.playing && h.env > 0.5) k *= m["sting"].num;
            if (st.tape != null) k *= 1 - clamp(st.tape.t / st.tape.dur, 0, 1);
            return k;
        }
        double rateFor(Voice v, double t)
        {
            double r = OrOne(v.t["rate"].num);
            if (Ok(v.t["once"])) return r;
            if (st.mood == "tense") r *= C()["tenseRate"].num;
            if (Ok(v.t["sync"])) r *= 1 - st.dark * C()["darkRate"].num;
            // Perdiendo: la cinta se frena y se bambolea, más cuanto peor va
            var L = C()["losing"]; double k = v.id == st.main ? losingDepth() : 0;
            if (k > 0) r *= (1 - L["slow"].num * k) * (1 + L["wobble"].num * k * JsMath.sin(t * Math.PI * 2 * L["wobbleHz"].num));
            // Sin dinero: la cinta se para
            if (st.tape != null && v.id == st.main) r *= JsMath.max(0.25, 1 - 0.75 * JsMath.pow(clamp(st.tape.t / st.tape.dur, 0, 1), 0.8));
            return r;
        }

        // ---------- Cada voz: fundido, final de la pista, bucle, volumen y velocidad ----------
        void update(Voice v, double dt, double t)
        {
            if (!v.playing) return;
            double step = dt / Math.Max(0.05, v.fade);
            v.env = v.target > v.env ? Math.Min(v.target, v.env + step) : Math.Max(v.target, v.env - step);
            if (v.env <= 0 && v.target <= 0) { stopVoice(v); return; }
            IAudioEl a = El(v);
            // La de una vez se acaba sola
            if (Ok(v.t["once"])) { if (a.ended) { stopVoice(v); return; } }
            else if (Ok(v.t["next"]))
            {
                // Tema del menú: al acabar una parte entra la otra
                double left = (a.duration - a.currentTime) / OrOne(a.playbackRate);
                if (v.id == st.main && isFinite(left) && left <= C()["fadeOut"].num) st.menu = v.t["next"].str;
                if (a.ended) { stopVoice(v); return; }
            }
            else if (volOK)
            {
                // Bucle: la otra copia entra justo antes del final, con un fundido muy corto
                double left = (a.duration - a.currentTime) / OrOne(a.playbackRate);
                if (v.xf == null && isFinite(left) && !a.paused && left <= C()["loopFade"].num + 0.05)
                {
                    var b = Other(v);
                    Seek(b, 0);
                    b.playbackRate = a.playbackRate;
                    Play(b);
                    v.xf = new Xfade { from = a, to = b, k = 0 };
                    v.cur = 1 - v.cur;
                    a = b;
                }
            }
            if (v.xf != null)
            {
                v.xf.k += dt / C()["loopFade"].num;
                if (v.xf.k >= 1 || v.xf.from.ended) { try { v.xf.from.pause(); } catch (Exception) { } v.xf = null; }
            }
            // Velocidad de la cinta (cambia poco a poco, salvo al pararse)
            double want = rateFor(v, t);
            if (Math.Abs(want - v.rate) > 0.0015)
            {
                double max = (st.tape != null ? 3 : 0.25) * dt;
                v.rate += clamp(want - v.rate, -max, max);
                foreach (var x in v.els) { try { x.playbackRate = v.rate; } catch (Exception) { } }
            }
            // Volumen
            double vol = clamp(C()["volume"].num * v.t["gain"].num * v.env * (Ok(v.t["once"]) ? (st.enabled ? 1 : 0) : st.mix), 0, 1);
            if (!volOK)
            {
                // Sin volumen: suena o calla
                bool on = v.target > 0 && (Ok(v.t["once"]) || st.mix > 0.05);
                if (!on && !a.paused) a.pause(); else if (on && a.paused && !a.ended) Play(a);
                return;
            }
            if (v.xf != null)
            {
                double k = clamp(v.xf.k, 0, 1);
                v.xf.from.volume = vol * JsMath.cos(k * Math.PI / 2);
                v.xf.to.volume = vol * JsMath.sin(k * Math.PI / 2);
            }
            else a.volume = vol;
        }

        // ---------- Pulso a tempo: tic-tac y latido en las últimas velas; reloj el último día de una deuda ----------
        bool lastDay()
        {
            V run = SN.State.run;
            if (!run.truthy || SN.Game == null || SN.Game.state != "GAMEPLAY") return false;
            V debt = run["debt"];
            return Ok(debt) && !debt["paid"].truthy && !debt["defaulted"].truthy &&
                run["day"].num >= debt["deadlineDay"].num && !(SN.Tutorial != null && SN.Tutorial.active);
        }
        // (pulse() de la web: el SN.Music.pulse(kind) público lo fija a mano)
        void Pulse()
        {
            var tr = st.trade;
            string kind = st.pulseKind ?? (tr != null && !tr.settled && tr.danger ? "danger" : lastDay() ? "clock" : null);
            var v = Find(st.main); var a = El(v);
            if (kind == null || v == null || !v.playing || !Ok(v.t["sync"]) || a == null || a.paused || st.mix < 0.2 || !isFinite(a.currentTime)) { st.pulseIdx = -1; return; }
            double beat = 60 / C()["bpm"].num, step = kind == "danger" ? beat / 2 : beat;
            double p = a.currentTime, idx = Math.Floor(p / step) + 1;
            double wait = (idx * step - p) / OrOne(a.playbackRate);
            if (wait > 0.11 || idx == st.pulseIdx) return;
            st.pulseIdx = idx;
            if (SN.Audio != null) SN.Audio.layer(kind == "danger" ? "pulseDanger" : "pulseClock", V.Obj("at", wait, "i", idx));
        }

        void Tick()
        {
            double t = Now(), dt = clamp(t - (st.last != 0 ? st.last : t), 0, 0.25);
            st.last = t;
            if (st.tape != null)
            {
                st.tape.t += dt;
                if (st.tape.t >= st.tape.dur)
                {
                    // Cinta parada: silencio hasta que vuelva el ambiente normal
                    var v = Find(st.main);
                    if (v != null) stopVoice(v);
                    st.tape = null; st.stopped = true; st.main = null; st.want = null;
                }
            }
            string want = resolve(t);
            if (want != st.want) { st.want = want; st.switchAt = planSwitch(want, t); }
            if (st.want != st.main && t >= st.switchAt) doSwitch(st.want);
            double target = mixTarget(), tau = st.duck || st.tape != null ? 0.08 : 0.35;
            st.mix += (target - st.mix) * (1 - JsMath.exp(-dt / tau));
            foreach (var v in voices.Values) update(v, dt, t);
            Pulse();
            if (SN.Audio != null) SN.Audio.layerLevel(st.enabled ? st.mix : 0);
            // Música apagada y todo en silencio: se para el reloj
            bool anyPlaying = false;
            foreach (var v in voices.Values) if (v.playing) { anyPlaying = true; break; }
            if (!st.enabled && !anyPlaying) { Dom.clearInterval(st.timer); st.timer = 0; }
        }

        // Toca (sin sonido) cada <audio> que todavía no se ha tocado: dentro de un gesto, queda desbloqueado
        void unlockVoices()
        {
            foreach (var v in voices.Values) foreach (var a in v.els)
            {
                if (unlockedEls.Contains(a) || !a.paused) continue;
                unlockedEls.Add(a);
                a.muted = true;
                // DUDA: js/systems/music.js:248 espera la promesa de play() y luego llama done(). En el port no hay
                // promesa: done() se llama justo después de play(), como indica el encargo.
                try
                {
                    a.play();
                    if (a.muted) { try { a.pause(); } catch (Exception) { } a.muted = false; }
                }
                catch (Exception) { a.muted = false; }
            }
        }

        // ---------- Pestaña oculta (js: document 'visibilitychange'): lo llama el anfitrión ----------
        // Pestaña oculta: la música se para y vuelve donde estaba
        public void onHidden()
        {
            hidden.Clear();
            foreach (var v in voices.Values) foreach (var a in v.els)
                if (!a.paused) { try { a.pause(); } catch (Exception) { } hidden.Add(a); }
        }
        public void onVisible()
        {
            foreach (var a in hidden) Play(a);
            hidden.Clear();
        }

        // ---------- API pública (SN.Music) ----------
        // Encender o apagar la música (ajustes). La primera vez se preparan todas las pistas.
        public void enable(bool on)
        {
            st.enabled = on;
            if (!on) return;
            foreach (var id in C()["tracks"].obj.keys()) if (id != "final") VoiceOf(id);
            // Lo que debía sonar y el navegador no dejó (antes del primer clic), ahora sí
            foreach (var v in voices.Values) { var a = El(v); if (v.playing && a != null && a.paused && !a.ended) Play(a); }
            if (st.unlocked) unlockVoices();
            if (st.timer == 0) { st.last = Now(); st.timer = Dom.setInterval(Tick, 40); }
        }
        // Gesto del jugador (clic o tecla): Safari solo deja sonar después a los <audio> que ya se tocaron en un gesto
        public void unlock() { st.unlocked = true; unlockVoices(); }
        public void mood(string m) { st.mood = m; if (m == "normal") st.stopped = false; }
        public void duck(bool on) { st.duck = on; }
        public void darkness(double d) { st.dark = clamp(double.IsNaN(d) || d == 0 ? 0 : d, 0, 1); }
        // La operación en directo (la interfaz avisa en cada vela). info: { pnl, amount, danger, settled } o null
        public void trade(V info)
        {
            if (!Ok(info)) { st.trade = null; return; }
            st.ending = false;
            st.trade = new Trade
            {
                r = info["amount"].truthy ? info["pnl"].num / info["amount"].num : 0,
                danger = info["danger"].truthy,
                settled = info["settled"].truthy,
            };
        }
        // Operación terminada: si ganaste, GANANDO se queda un rato más
        public void tradeEnd(double pnl) { st.winUntil = pnl > 0 ? Now() + C()["winning"]["hold"].num : 0; }
        // Una pista corta por encima de todo (el encapuchado)
        public void sting(string id)
        {
            if (!st.enabled) return;
            var v = VoiceOf(id); var a = El(v);
            if (a == null) return;
            stopVoice(v);
            Seek(a, 0);
            v.env = 1; v.target = 1; v.fade = 0.05;
            Play(a);
            v.playing = true;
        }
        // Sin dinero: la cinta se frena hasta pararse
        public void tapeStop(double dur = 0.9) { if (st.enabled && st.main != null && st.tape == null) st.tape = new Tape { t = 0, dur = dur }; }
        // El final: el tema principal, lento, hasta la siguiente operación
        public void ending() { st.ending = true; }
        // Una pista fija durante una escena (null: vuelve a decidir el director). Quita la cinta parada.
        public void force(string id) { st.force = string.IsNullOrEmpty(id) ? null : id; if (!string.IsNullOrEmpty(id)) st.stopped = false; }
        // Pulso a tempo a mano ('danger' | 'clock' | null)
        public void pulse(string kind) { st.pulseKind = string.IsNullOrEmpty(kind) ? null : kind; }
        // Tonalidad de lo que suena (para afinar los efectos) o null si no suena nada
        public V tonality()
        {
            var h = Find("hood");
            var v = h != null && h.playing && h.env > 0.5 ? h : Find(st.main);
            if (v == null || !v.playing) return V.@null;
            return V.Obj("root", v.t["key"]["root"], "scale", v.t["key"]["scale"], "rate", v.rate);
        }
        // Para pruebas y depuración
        public string current { get { return st.main; } }
        public V state
        {
            get
            {
                var mv = Find(st.main);
                V trade = st.trade == null ? V.@null : V.Obj("r", st.trade.r, "danger", st.trade.danger, "settled", st.trade.settled);
                return V.Obj(
                    "main", st.main,
                    "want", st.want,
                    "mix", Fx(st.mix, 2),
                    "mood", st.mood,
                    "stopped", st.stopped,
                    "rate", mv != null ? Fx(mv.rate, 3) : 1,
                    "trade", trade);
            }
        }
        public bool loaded(string id) { var v = Find(id); return v != null && !v.failed && El(v).readyState >= 2; }
        // Para pruebas: lleva la pista a `left` segundos del final (para ver cómo se cierra el bucle)
        public bool seekEnd(string id, double left = 1)
        {
            var v = Find(id); var a = El(v);
            if (a == null || !isFinite(a.duration)) return false;
            Seek(a, a.duration - left);
            return true;
        }
        // Lo que suena ahora: por pista, si suena, su volumen, por dónde va y a qué velocidad
        public V debug()
        {
            var o = new JsObject();
            foreach (var kv in voices)
            {
                var v = kv.Value;
                if (!v.playing && !v.failed) continue;
                var a = El(v);
                o[kv.Key] = V.Obj(
                    "env", Fx(v.env, 2),
                    "vol", Fx(a.volume, 3),
                    "t", Fx(a.currentTime, 2),
                    "paused", a.paused,
                    "rate", Fx(a.playbackRate, 3),
                    "ready", a.readyState,
                    "failed", v.failed);
            }
            return o;
        }
    }
}
