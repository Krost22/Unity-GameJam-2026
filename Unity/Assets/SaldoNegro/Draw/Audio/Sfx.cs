// Los efectos de js/systems/audio.js (SFX y sus ayudantes tone, noise, pluck, bell, thump) sobre WaContext: cada
// efecto se programa en el grafo y se renderiza a muestras float a 48 000 Hz, mono ("dry": la mezcla antes del
// master y del compresor, que no se portan aquí). El orden de las llamadas a Math.random es el de la web.
// Lo que en la web es SN.Music.tonality() llega como la tonalidad (SfxKey); null = la de la partida (Re menor).
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    // La tonalidad de la pista que suena: { root, scale, rate }
    public sealed class SfxKey
    {
        public readonly double root;
        public readonly double[] scale;
        public readonly double rate;
        public SfxKey(double root, double[] scale, double rate) { this.root = root; this.scale = scale; this.rate = rate; }
    }

    public sealed class Sfx
    {
        // DEFAULT_KEY de audio.js: sin música, la tonalidad de la partida
        public static readonly SfxKey DefaultKey = new SfxKey(62, new double[] { 0, 3, 5, 7, 10 }, 1);

        const int SampleRate = 48000;

        // Estado de un render: un contexto nuevo por efecto (como un load de la web, con su búfer de ruido)
        WaContext ac;
        WaGain sfxGain;
        WaGain musicGain;
        WaBuffer noiseBuf;
        SfxKey K;

        // Efecto (la mezcla de voces "dry") como muestras; null si el nombre no existe.
        public float[] render(string name, V opts, SfxKey key = null) { return Run(name, opts, key, false, false); }
        // Camino real: master 0.7 y DynamicsCompressor (valores por defecto) antes del destino
        public float[] renderFull(string name, V opts, SfxKey key = null) { return Run(name, opts, key, false, true); }
        // Capa de la música (out = musicGain, la de audio.js layer()): pulso de las últimas velas y reloj
        public float[] renderLayer(string name, V opts, SfxKey key = null) { return Run(name, opts, key, true, false); }

        float[] Run(string name, V opts, SfxKey key, bool layer, bool full)
        {
            K = key ?? DefaultKey;
            ac = new WaContext(SampleRate);
            sfxGain = ac.createGain(); sfxGain.gain.value = 1;
            musicGain = ac.createGain(); musicGain.gain.value = 1;
            WaNode mix = ac.destination;
            if (full)
            {
                WaGain master = ac.createGain(); master.gain.value = 0.7;
                master.connect(new WaCompressor(ac)).connect(ac.destination);
                mix = master;
            }
            sfxGain.connect(mix);
            musicGain.connect(mix);
            noiseBuf = null;
            if (opts is null || opts.isNullish) opts = new JsObject();
            if (!Play(name, opts, layer)) return null;
            // La longitud es la del último stop() programado (no se guardan colas de silencio)
            int len = (int)Math.Ceiling(ac.maxStopTime * SampleRate) + 64;
            return ac.render(len);
        }

        // ---------- Afinación (audio.js) ----------
        static double note(double n) { return 440 * JsMath.pow(2, (n - 69) / 12); }
        static double semi(double f, double n) { return f * JsMath.pow(2, n / 12); }
        // Grado g de la escala (0 = tónica; los que se salen de la escala pasan de octava) y oct octavas más, en Hz.
        static double deg(SfxKey k, double g, double oct = 0)
        {
            var s = k.scale;
            int n = s.Length;
            double o = Math.Floor(g / n);
            int idx = (int)(((g % n) + n) % n);
            return note(k.root + 12 * (oct + o) + s[idx]) * k.rate;
        }

        // Tono: un oscilador con envolvente exponencial (ataque y caída)
        void Tone(string type, double f0, double dur, double? f1 = null, double vol = 0.2, double at = 0,
                  double attack = 0.005, WaNode outN = null, double detune = 0)
        {
            var a = ac;
            double t = a.currentTime + at;
            double f1v = f1 ?? f0;
            WaOscillator o = a.createOscillator();
            WaGain gn = a.createGain();
            o.type = type;
            o.detune.value = detune;
            o.frequency.setValueAtTime(f0, t);
            if (f1v != f0) o.frequency.exponentialRampToValueAtTime(Math.Max(1, f1v), t + dur);
            gn.gain.setValueAtTime(0.0001, t);
            gn.gain.exponentialRampToValueAtTime(vol, t + attack);
            gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(gn).connect(outN ?? sfxGain);
            o.start(t); o.stop(t + dur + 0.03);
        }

        // Ruido (búfer de 2 s de Math.random) filtrado, con envolvente
        void Noise(double dur, double vol = 0.2, string filter = "bandpass", double f0 = 1000, double? f1 = null,
                    double q = 1, double at = 0, double attack = 0.005, WaNode outN = null)
        {
            var a = ac;
            double t = a.currentTime + at;
            double f1v = f1 ?? f0;
            if (noiseBuf == null)
            {
                noiseBuf = a.createBuffer(1, (int)(a.sampleRate * 2), a.sampleRate);
                var d = noiseBuf.getChannelData(0);
                for (int i = 0; i < d.Length; i++) d[i] = (float)(JsMath.rnd() * 2 - 1);
            }
            WaBufferSource src = a.createBufferSource();
            WaBiquad bq = a.createBiquadFilter();
            WaGain gn = a.createGain();
            src.buffer = noiseBuf;
            bq.type = filter; bq.Q.value = q;
            bq.frequency.setValueAtTime(f0, t);
            if (f1v != f0) bq.frequency.exponentialRampToValueAtTime(f1v, t + dur);
            gn.gain.setValueAtTime(0.0001, t);
            gn.gain.exponentialRampToValueAtTime(vol, t + attack);
            gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(bq).connect(gn).connect(outN ?? sfxGain);
            src.start(t, JsMath.rnd() * Math.Max(0, 1.9 - dur));
            src.stop(t + dur + 0.03);
        }

        // Pulsación suave: triángulo con una octava de seno encima, un pelín desafinados (lo-fi)
        void Pluck(double f, double vol = 0.06, double dur = 0.12, double at = 0, WaNode outN = null)
        {
            Tone("triangle", f, dur, null, vol, at, 0.004, outN, 4);
            Tone("sine", f * 2, dur * 0.6, null, vol * 0.35, at, 0.003, outN, -5);
        }

        // Campanita (monedas, avisos): seno con un armónico de campana
        void Bell(double f, double vol = 0.05, double dur = 0.35, double at = 0, WaNode outN = null)
        {
            Tone("sine", f, dur, null, vol, at, 0.003, outN);
            Tone("sine", f * 2.76, dur * 0.4, null, vol * 0.22, at, 0.002, outN);
        }

        // Golpe sordo de los botones de operar
        void Thump(double at = 0)
        {
            Tone("sine", 160, 0.18, 60, 0.28, at);
            Noise(0.08, 0.1, "lowpass", 1400, null, 1, at);
        }

        // ---------- Efectos (SFX de audio.js, en su orden) ----------
        // Devuelve false si el efecto no existe (en la web: if (!SFX[name]) return)
        bool Play(string name, V o, bool layer)
        {
            WaNode lay = layer ? musicGain : null;
            switch (name)
            {
                case "click":
                    Noise(0.025, 0.1, "highpass", 3000);
                    Tone("sine", 1150, 0.03, 850, 0.035);
                    return true;
                case "key":
                    Noise(0.03, 0.09, "bandpass", 2200, null, 2);
                    Tone("triangle", 260, 0.04, 160, 0.06);
                    return true;
                case "select":
                    Pluck(deg(K, 4, 1), 0.045, 0.08);
                    return true;
                case "error":
                {
                    double r = deg(K, 0, -1);
                    Tone("triangle", semi(r, 1), 0.11, null, 0.08);
                    Tone("triangle", r, 0.16, semi(r, -1), 0.08, 0.09);
                    Tone("sine", semi(r, -12), 0.18, null, 0.12, 0.09);
                    return true;
                }
                case "buy":
                    for (int i = 0; i < 3; i++) Pluck(deg(K, i, 1), 0.06, 0.1, i * 0.045);
                    Thump(0.1);
                    return true;
                case "sell":
                    for (int i = 0; i < 3; i++) Pluck(deg(K, 2 - i, 1), 0.06, 0.1, i * 0.045);
                    Thump(0.1);
                    return true;
                case "candle":
                {
                    bool up = OptBool(o, "up", true), quiet = OptBool(o, "quiet", false);
                    V step = o["step"];
                    if (step.isUndefined) step = V.@null; // step = null por defecto
                    if (step.isNullish)
                    {
                        Pluck(deg(K, up ? 3 : 1, 1), quiet ? 0.022 : 0.04, 0.06);
                        return true;
                    }
                    double k = Math.Max(-10, Math.Min(10, step.num));
                    Pluck(deg(K, k, 1), quiet ? 0.028 : 0.045, 0.08);
                    return true;
                }
                case "heart":
                    Tone("sine", 74, 0.13, 46, 0.45);
                    Tone("sine", 64, 0.15, 40, 0.32, 0.16);
                    return true;
                case "riser":
                {
                    double dur = OptNum(o, "dur", 2);
                    Noise(dur, 0.07, "bandpass", 300, 3200, 1.4, 0, dur * 0.85);
                    Tone("sawtooth", deg(K, 0, -2), dur, deg(K, 0, 0), 0.02, 0, dur * 0.8);
                    return true;
                }
                case "boom":
                {
                    bool big = OptBool(o, "big", true);
                    Tone("sine", 130, 0.55, 38, big ? 0.5 : 0.3);
                    Noise(0.45, big ? 0.3 : 0.15, "lowpass", 1600, 120);
                    for (int i = 0; i < 5; i++) Pluck(deg(K, i, 1), 0.05, 0.22, 0.05 + i * 0.045);
                    int nc = big ? 5 : 2;
                    for (int i = 0; i < nc; i++) CoinAt(0.2 + i * 0.07);
                    return true;
                }
                case "crash":
                {
                    bool big = OptBool(o, "big", true);
                    double r = deg(K, 0, -1);
                    Noise(0.7, big ? 0.32 : 0.16, "highpass", 3200, 400);
                    Tone("sawtooth", semi(r, 12), 0.75, r / 2, big ? 0.11 : 0.06);
                    Tone("triangle", semi(r, 1), 0.22, null, 0.08, 0.12);
                    Tone("triangle", r, 0.3, null, 0.08, 0.32);
                    return true;
                }
                case "cash":
                    Noise(0.04, 0.14, "highpass", 3000);
                    Bell(deg(K, 2, 2), 0.07, 0.1, 0.03);
                    Bell(deg(K, 0, 3), 0.07, 0.32, 0.09);
                    for (int i = 0; i < 3; i++) CoinAt(0.15 + i * 0.06);
                    return true;
                case "tick":
                    Tone("square", deg(K, 0, 3), 0.02, null, 0.03);
                    return true;
                case "coin":
                    Bell(deg(K, 4, 2), 0.055, 0.1);
                    Bell(deg(K, 0, 3), 0.055, 0.18, 0.05);
                    return true;
                case "coinBounce":
                    Bell(deg(K, Math.Floor(JsMath.rnd() * 5), 3), 0.02, 0.05);
                    return true;
                case "win":
                {
                    bool big = OptBool(o, "big", false);
                    int n = big ? 6 : 4;
                    for (int i = 0; i < n; i++)
                    {
                        Pluck(deg(K, i, 1), 0.06, 0.14, i * 0.06);
                        Bell(deg(K, i, 2), 0.025, 0.12, i * 0.06);
                    }
                    int nc = big ? 6 : 3;
                    for (int i = 0; i < nc; i++) CoinAt(0.25 + i * 0.07);
                    if (big) Noise(1.2, 0.08, "bandpass", 900, 1400, 0.6, 0.1, 0.2);
                    return true;
                }
                case "coinAt":
                    CoinAt(OptNum(o, "at", 0));
                    return true;
                case "loss":
                {
                    bool big = OptBool(o, "big", false);
                    int[] seq = { 3, 2, 1, big ? -1 : 0 };
                    for (int i = 0; i < seq.Length; i++)
                    {
                        double f = deg(K, seq[i], 0);
                        Tone("triangle", f, 0.16, semi(f, -1), 0.07, i * 0.1);
                    }
                    Tone("sine", 120, big ? 0.6 : 0.3, 40, 0.35, 0.05);
                    if (big) Noise(0.4, 0.18, "lowpass", 800, 100);
                    return true;
                }
                case "liquidation":
                {
                    double r = deg(K, 0, -1);
                    Noise(0.6, 0.25, "lowpass", 1200, 80);
                    Tone("sawtooth", semi(r, 12), 0.8, r / 2, 0.1);
                    Tone("triangle", semi(r, 1), 0.12, null, 0.08, 0.3);
                    Tone("triangle", r, 0.12, null, 0.08, 0.45);
                    return true;
                }
                case "unlock":
                    for (int i = 0; i < 6; i++)
                    {
                        Pluck(deg(K, i, 1), 0.06, 0.18, i * 0.05);
                        Bell(deg(K, i, 2), 0.02, 0.15, i * 0.05);
                    }
                    Noise(0.4, 0.05, "highpass", 6000, null, 1, 0.1);
                    return true;
                case "cipher":
                {
                    Noise(0.5, 0.12, "bandpass", 2400, 300, 3);
                    int[] seq = { 4, 3, 2, 1 };
                    for (int i = 0; i < seq.Length; i++)
                    {
                        double f = deg(K, seq[i], 1);
                        Tone("triangle", f, 0.35, semi(f, -1), 0.07, 0.08 + i * 0.09, 0.005, null, i * 7);
                    }
                    double d0 = deg(K, 0, -2);
                    Tone("sine", d0, 0.9, semi(d0, -5), 0.3, 0.1);
                    return true;
                }
                case "lucky":
                    for (int i = 0; i < 7; i++)
                    {
                        Pluck(deg(K, i, 1), 0.05, 0.12, i * 0.07);
                        Bell(deg(K, i, 2), 0.025, 0.1, i * 0.07);
                    }
                    for (int i = 0; i < 7; i++) CoinAt(0.5 + i * 0.05);
                    return true;
                case "wheel":
                    Tone("square", 2100, 0.025, 1500, 0.04);
                    return true;
                case "pay":
                    Noise(0.05, 0.15, "highpass", 2500);
                    Bell(deg(K, 0, 2), 0.07, 0.12, 0.06);
                    Bell(deg(K, 2, 2), 0.07, 0.3, 0.12);
                    Pluck(deg(K, 0, 3), 0.05, 0.4, 0.16);
                    return true;
                case "debtPaid":
                {
                    double root = deg(K, 0, 1);
                    for (int i = 0; i < 5; i++) Bell(deg(K, i, 1), 0.05, 0.25, i * 0.07);
                    int[] ns = { 0, 7, 12 };
                    for (int i = 0; i < 3; i++) Tone("triangle", semi(root, ns[i]), 1.3, null, 0.045, 0.4, 0.08, null, i * 3);
                    Tone("sine", semi(root, 24), 1.1, semi(root, 23), 0.035, 0.55, 0.1);
                    return true;
                }
                case "broke":
                {
                    double at = OptNum(o, "at", 0);
                    double t = at;
                    int[] gs = { 4, 3, 2, 1, 0, -1 };
                    for (int i = 0; i < gs.Length; i++)
                    {
                        double f = deg(K, gs[i], 1) * JsMath.pow(2, (JsMath.rnd() - 0.5) * 40 / 1200);
                        Bell(f, 0.05, 0.9, t);
                        Tone("triangle", f / 2, 0.6, f / 2 * 0.98, 0.02, t);
                        t += 0.32 + i * 0.09;
                    }
                    Noise(t - at + 0.6, 0.015, "highpass", 5000, null, 1, at, 0.3);
                    return true;
                }
                case "pulseDanger":
                {
                    double at = OptNum(o, "at", 0);
                    int i = (int)OptNum(o, "i", 0);
                    WaNode outN = lay;
                    if (i % 4 == 0)
                    {
                        Tone("sine", 72, 0.12, 46, 0.3, at, 0.005, outN);
                        Tone("sine", 62, 0.14, 40, 0.2, at + 0.16, 0.005, outN);
                    }
                    Noise(0.02, i % 2 != 0 ? 0.035 : 0.055, "highpass", 6000, null, 1, at, 0.005, outN);
                    Tone("sine", deg(K, 0, 3), 0.025, null, i % 2 != 0 ? 0.012 : 0.02, at, 0.005, outN);
                    return true;
                }
                case "pulseClock":
                {
                    double at = OptNum(o, "at", 0);
                    int i = (int)OptNum(o, "i", 0);
                    WaNode outN = lay;
                    Noise(0.015, 0.03, "bandpass", i % 2 != 0 ? 2400 : 3400, null, 4, at, 0.005, outN);
                    Tone("sine", deg(K, i % 2 != 0 ? 4 : 0, 3), 0.02, null, 0.012, at, 0.005, outN);
                    if (i % 16 == 0) Bell(deg(K, 0, 1) * JsMath.pow(2, -18 / 1200.0), 0.03, 1.2, at, outN);
                    return true;
                }
                case "notify":
                    Bell(deg(K, 4, 2), 0.1, 0.15);
                    Bell(deg(K, 2, 2), 0.1, 0.3, 0.12);
                    return true;
                case "notifyBad":
                {
                    double a = deg(K, 4, 2), b = deg(K, 1, 2);
                    Tone("sine", a, 0.2, semi(a, -1), 0.11, 0, 0.005, null, -30);
                    Tone("sine", b, 0.5, semi(b, -3), 0.11, 0.14, 0.005, null, 20);
                    return true;
                }
                case "static":
                {
                    double dur = OptNum(o, "dur", 0.5);
                    Noise(dur, 0.14, "bandpass", 2600, null, 0.4, 0, 0.02);
                    Tone("sawtooth", 60, dur, null, 0.03);
                    return true;
                }
                case "whisper":
                {
                    double r = deg(K, 0, -2);
                    Tone("sine", r, 1.8, semi(r, -0.7), 0.12, 0, 0.4);
                    Tone("sine", semi(r, 7), 1.8, semi(r, 6.3), 0.06, 0, 0.5, null, 14);
                    Noise(1.4, 0.04, "bandpass", 500, null, 3, 0, 0.5);
                    return true;
                }
                case "type":
                {
                    string voice = o["voice"].isUndefined ? "hood" : (o["voice"].isString ? o["voice"].str : "");
                    double g = Math.Floor(JsMath.rnd() * 3);
                    if (voice == "bravo") { Tone("sawtooth", deg(K, g - 2, 0), 0.035, null, 0.028); return true; }
                    // Trompa: grave, nasal y cayendo al final de cada sílaba (habla como si todo fuera tremendo)
                    if (voice == "trompa") { Tone("square", deg(K, g - 1, -1), 0.05, deg(K, g - 3, -1), 0.026); return true; }
                    // El contestador de la Línea de Rescate: un robot que siempre dice la misma nota
                    if (voice == "robot") { Tone("sine", deg(K, 0, 1), 0.028, null, 0.035); return true; }
                    if (voice == "hood") { Tone("triangle", deg(K, g - 2, -1), 0.03, null, 0.06); return true; }
                    Tone("square", deg(K, g, 1), 0.03, null, 0.022);
                    return true;
                }
                case "crack":
                {
                    double n = OptNum(o, "n", 0);
                    Noise(0.08, 0.25, "bandpass", 1800 + n * 300, null, 2);
                    Tone("triangle", 240 + n * 40, 0.1, 120, 0.18);
                    return true;
                }
                case "shatter":
                    Noise(0.5, 0.3, "highpass", 1500, 400);
                    Tone("sine", 160, 0.4, 50, 0.35);
                    for (int i = 0; i < 8; i++) CoinAt(0.15 + JsMath.rnd() * 0.6);
                    return true;
                case "pop":
                    Tone("sine", 300, 0.08, 700, 0.1);
                    return true;
                case "siren":
                    for (int i = 0; i < 6; i++) Tone("triangle", i % 2 != 0 ? 660 : 880, 0.38, null, 0.035, i * 0.4, 0.05);
                    return true;
                case "day":
                {
                    int[] gs = { 0, 2, 4 };
                    for (int i = 0; i < 3; i++) Pluck(deg(K, gs[i], 1), 0.08, 0.28, i * 0.1);
                    return true;
                }
                case "open":
                    Tone("triangle", deg(K, 2, 1), 0.07, deg(K, 4, 1), 0.05);
                    return true;
                case "close":
                    Tone("triangle", deg(K, 4, 1), 0.07, deg(K, 2, 1), 0.05);
                    return true;
                case "boot":
                {
                    Tone("sine", 60, 0.4, 120, 0.2);
                    Noise(0.3, 0.06, "highpass", 4000);
                    int[] gs = { 0, 2, 4 };
                    for (int i = 0; i < 3; i++) Pluck(deg(K, gs[i], 2), 0.07, 0.22, 0.35 + i * 0.08);
                    return true;
                }
                case "whoosh":
                    Noise(0.3, 0.1, "bandpass", 400, 2400, 2, 0, 0.08);
                    return true;
                case "knock":
                    Tone("sine", 120, 0.12, 70, 0.4);
                    Noise(0.06, 0.18, "lowpass", 900);
                    return true;
                case "punch":
                    Noise(0.09, 0.28, "bandpass", 1200, null, 1.5);
                    Tone("square", deg(K, 0, 0), 0.12, deg(K, 0, -1), 0.05);
                    Tone("sine", 180, 0.15, 60, 0.32);
                    return true;
                case "collapse":
                    Tone("sawtooth", deg(K, 0, 1), 2.4, deg(K, 0, -3), 0.05, 0, 0.05);
                    Tone("triangle", deg(K, 2, 1), 2.6, deg(K, 2, -3), 0.05, 0, 0.05);
                    Noise(2.2, 0.12, "lowpass", 3000, 120, 1, 0, 0.1);
                    return true;
                case "powerOff":
                    Tone("sine", 900, 0.5, 40, 0.12);
                    Noise(0.25, 0.08, "highpass", 3000, 300);
                    return true;
                case "thud":
                    Tone("sine", 140, 0.25, 50, 0.35);
                    Noise(0.1, 0.1, "lowpass", 600);
                    return true;
                case "step":
                    Tone("sine", 92, 0.07, 58, 0.16);
                    Noise(0.03, 0.05, "lowpass", 500);
                    return true;
                case "drop":
                    Tone("triangle", 210, 0.08, 120, 0.12);
                    Noise(0.05, 0.08, "bandpass", 700, null, 1.2);
                    return true;
                case "drag":
                    Noise(0.22, 0.09, "bandpass", 260, 180, 3, 0, 0.04);
                    return true;
                case "dtmf":
                {
                    double[] row = { 697, 770, 852, 941 }, col = { 1209, 1336, 1477 };
                    double d = OptNum(o, "d", 1);
                    double dd = (d == 0 || double.IsNaN(d)) ? 11 : d;
                    int i = (int)Math.Max(0, Math.Min(11, dd - 1));
                    Tone("sine", row[i / 3], 0.09, null, 0.035);
                    Tone("sine", col[i % 3], 0.09, null, 0.035);
                    return true;
                }
                case "ringback":
                    Tone("sine", 440, 0.75, null, 0.035, 0, 0.02);
                    Tone("sine", 480, 0.75, null, 0.035, 0, 0.02);
                    return true;
                case "holdMusic":
                {
                    int[] mel = { 76, 79, 81, 79, 76, 74, 72, 74, 76, 76, 74, 72 };
                    for (int i = 0; i < mel.Length; i++)
                        Tone("square", note(mel[i]), 0.16, null, 0.016, i * 0.17, 0.005, null, (i % 3) * 7);
                    int[] bass = { 48, 55, 52, 55 };
                    for (int i = 0; i < bass.Length; i++) Tone("triangle", note(bass[i]), 0.5, null, 0.03, i * 0.51);
                    return true;
                }
                case "scribble":
                    Noise(0.07, 0.06, "bandpass", 2600 + JsMath.rnd() * 1600, null, 3);
                    return true;
                case "printer":
                {
                    double dur = OptNum(o, "dur", 1.6);
                    int n = (int)Math.Floor(dur / 0.055);
                    for (int i = 0; i < n; i++) Tone("square", 70 + (i % 2) * 8, 0.045, null, 0.05, i * 0.055);
                    Noise(dur, 0.05, "bandpass", 900, null, 0.8, 0, 0.05);
                    return true;
                }
                case "bigButton":
                    Tone("sine", 220, 0.18, 70, 0.32);
                    Noise(0.05, 0.14, "highpass", 2200, null, 1, 0.02);
                    return true;
                case "hangup":
                    for (int i = 0; i < 3; i++) Tone("sine", 620, 0.16, null, 0.04, i * 0.3);
                    return true;
                case "cheer":
                {
                    int[] gs = { 2, 3, 4 };
                    for (int i = 0; i < 3; i++) Pluck(deg(K, gs[i], 2), 0.055, 0.12, i * 0.07);
                    Noise(0.8, 0.08, "bandpass", 900, 1400, 0.6, 0, 0.15);
                    return true;
                }
            }
            return false;
        }

        void CoinAt(double at)
        {
            Bell(deg(K, 4, 2), 0.035, 0.06, at);
            Bell(deg(K, 0, 3), 0.035, 0.1, at + 0.04);
        }

        static bool OptBool(V o, string key, bool def)
        {
            V v = o[key];
            return v.isUndefined ? def : v.truthy;
        }
        static double OptNum(V o, string key, double def)
        {
            V v = o[key];
            return v.isUndefined ? def : v.num;
        }
    }
}
