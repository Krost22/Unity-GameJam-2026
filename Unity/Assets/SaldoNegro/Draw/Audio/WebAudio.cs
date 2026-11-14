// Web Audio API mínima y "offline" en C# puro: solo lo que usa js/systems/audio.js. Un grafo de nodos (WaContext,
// WaOscillator, WaGain, WaBiquad, WaBufferSource) que se programa con su reloj (currentTime, en segundos) y se
// renderiza con render(frames), que devuelve float[] procesado en bloques de 128 muestras como el navegador.
// Los AudioParam (WaParam) son "a-rate": se calculan muestra a muestra con las automatizaciones exactas de la
// especificación (setValueAtTime, linearRampToValueAtTime, exponentialRampToValueAtTime).
// Osciladores: "sine" es una onda pura; "square", "sawtooth" y "triangle" son de banda limitada, como en Chrome:
// tablas de 4096 muestras con los armónicos hasta Nyquist, una tabla por cada tercio de octava (la tabla de cada
// tercio tiene la mitad de armónicos que la anterior), normalizadas por el pico de la tabla completa, leídas con
// interpolación lineal y mezcladas entre dos tablas vecinas. Los valores se han medido contra Chrome (ver
// AudioLab.cs); el detalle de cada aproximación está en los comentarios de WaWave.
using System;
using System.Collections.Generic;

namespace SaldoNegro
{
    public sealed class WaContext
    {
        public const int Quantum = 128; // muestras por bloque de render, como el navegador
        public readonly double sampleRate;
        public readonly WaDestination destination;
        internal long block = -1;   // número del bloque en curso
        internal long frame0;       // primera muestra del bloque en curso
        public double maxStopTime;  // el stop() más tardío programado (para dimensionar el render)

        public WaContext(double sampleRate = 48000)
        {
            this.sampleRate = sampleRate;
            destination = new WaDestination(this);
        }

        // Reloj del contexto: 0 antes del primer render, y luego el tiempo de la muestra en curso
        public double currentTime { get { return frame0 / sampleRate; } }

        public WaOscillator createOscillator() { return new WaOscillator(this); }
        public WaGain createGain() { return new WaGain(this); }
        public WaBiquad createBiquadFilter() { return new WaBiquad(this); }
        public WaBufferSource createBufferSource() { return new WaBufferSource(this); }
        public WaBuffer createBuffer(int channels, int length, double sampleRate) { return new WaBuffer(length, sampleRate); }

        // Tiempo (s) -> muestra. Chrome redondea a la muestra más cercana el stop y el inicio de búfer (el arranque
        // de un oscilador con automatización y los eventos de parámetro usan otra regla: ver WaOscillator y WaParam).
        internal long Frame(double t) { return (long)Math.Round(t * sampleRate, MidpointRounding.AwayFromZero); }

        // Renderiza `frames` muestras del destino (mono) y las devuelve.
        public float[] render(int frames)
        {
            var result = new float[frames];
            for (long f = 0; f < frames; f += Quantum)
            {
                block++;
                frame0 = f;
                float[] blk = destination.Pull();
                int n = (int)Math.Min(Quantum, frames - f);
                Array.Copy(blk, 0, result, f, n);
            }
            return result;
        }
    }

    // Un nodo del grafo. Se tira de él bloque a bloque: cada entrada se suma (como en Web Audio) y el resultado
    // se procesa en Process. Cada nodo calcula su bloque una sola vez aunque tenga varias salidas.
    public abstract class WaNode
    {
        protected readonly WaContext ctx;
        readonly List<WaNode> inputs = new List<WaNode>();
        long cachedBlock = -1;
        readonly float[] output = new float[WaContext.Quantum];
        readonly float[] mix = new float[WaContext.Quantum];

        protected WaNode(WaContext ctx) { this.ctx = ctx; }

        public WaNode connect(WaNode destination)
        {
            if (destination.ctx != ctx) throw new InvalidOperationException("otro contexto");
            destination.inputs.Add(this);
            return destination;
        }

        internal float[] Pull()
        {
            if (cachedBlock == ctx.block) return output;
            cachedBlock = ctx.block;
            bool any = false;
            foreach (var input in inputs)
            {
                float[] o = input.Pull();
                if (!any) { Array.Copy(o, mix, WaContext.Quantum); any = true; }
                else for (int i = 0; i < WaContext.Quantum; i++) mix[i] += o[i];
            }
            Process(any ? mix : null, output);
            return output;
        }

        // input: la suma de las entradas del bloque (null si no hay ninguna). Escribe 128 muestras en output.
        protected abstract void Process(float[] input, float[] output);
    }

    public sealed class WaDestination : WaNode
    {
        internal WaDestination(WaContext ctx) : base(ctx) { }
        protected override void Process(float[] input, float[] output)
        {
            if (input == null) Array.Clear(output, 0, output.Length);
            else Array.Copy(input, output, output.Length);
        }
    }

    public sealed class WaGain : WaNode
    {
        public readonly WaParam gain = new WaParam(1);
        readonly float[] g = new float[WaContext.Quantum];
        internal WaGain(WaContext ctx) : base(ctx) { }
        protected override void Process(float[] input, float[] output)
        {
            if (input == null) { Array.Clear(output, 0, output.Length); return; }
            gain.Values(ctx.frame0, ctx.sampleRate, g);
            for (int i = 0; i < output.Length; i++) output[i] = input[i] * g[i];
        }
    }

    // Filtro BiquadFilterNode: "lowpass", "highpass" y "bandpass" con las fórmulas de la especificación
    // (Audio EQ Cookbook). En lowpass y highpass, Q va en dB; en bandpass, es lineal. Coeficientes a-rate.
    public sealed class WaBiquad : WaNode
    {
        public string type = "lowpass";
        public readonly WaParam frequency = new WaParam(350);
        public readonly WaParam Q = new WaParam(1);
        double x1, x2, y1, y2;
        readonly float[] fa = new float[WaContext.Quantum], qa = new float[WaContext.Quantum];
        internal WaBiquad(WaContext ctx) : base(ctx) { }

        protected override void Process(float[] input, float[] output)
        {
            frequency.Values(ctx.frame0, ctx.sampleRate, fa);
            Q.Values(ctx.frame0, ctx.sampleRate, qa);
            double nyquist = ctx.sampleRate / 2;
            for (int i = 0; i < output.Length; i++)
            {
                double f = Math.Min(Math.Max(fa[i], 0), nyquist);
                double q = qa[i];
                double w0 = 2 * Math.PI * f / ctx.sampleRate;
                double cs = Math.Cos(w0), sn = Math.Sin(w0);
                double b0, b1, b2, alpha;
                if (type == "highpass")
                {
                    alpha = sn / (2 * Math.Pow(10, q / 20));
                    b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2;
                }
                else if (type == "bandpass")
                {
                    alpha = sn / (2 * q);
                    b0 = alpha; b1 = 0; b2 = -alpha;
                }
                else
                {
                    alpha = sn / (2 * Math.Pow(10, q / 20));
                    b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2;
                }
                double a0 = 1 + alpha, a1 = -2 * cs, a2 = 1 - alpha;
                double x = input == null ? 0 : input[i];
                double y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
                x2 = x1; x1 = x; y2 = y1; y1 = y;
                output[i] = (float)y;
            }
        }
    }

    // DynamicsCompressorNode con los valores por defecto (umbral -24 dB, rodilla 30, relación 12, ataque 3 ms,
    // liberación 250 ms). Detector de envolvente con ataque y liberación, curva en dB con rodilla blanda, ganancia
    // de maquillaje (1 / ganancia a 0 dB)^0.6 y 6 ms de pre-delay (la salida va retrasada; el detector ve delante).
    // Aproximación de la especificación: sin la liberación adaptativa de Chrome (ver AudioLab.Full).
    public sealed class WaCompressor : WaNode
    {
        const double Attack = 0.003, Release = 0.25;
        // Reducción de ganancia (dB) de Chrome con entrada continua (AudioLab): x = -40..6 dB en pasos de 1 dB
        static readonly double[] Reduction =
        {
            0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001,
            -0.006, -0.027, -0.062, -0.112, -0.176, -0.256, -0.352, -0.466, -0.598, -0.751, -0.924, -1.122, -1.344, -1.594,
            -1.873, -2.184, -2.529, -2.911, -3.332, -3.795, -4.302, -4.854, -5.453, -6.100, -6.795, -7.537, -8.324, -9.153,
            -10.021, -10.922,
        };
        // Ganancia de maquillaje (3.66 dB con señal baja)
        const double makeup = 1.52412;
        readonly double attCoef, relCoef;
        readonly float[] line;
        int pos;
        double env;
        long frames; // muestras desde el arranque: al empezar, Chrome reduce unos 14 dB que se recuperan (~55 ms)

        internal WaCompressor(WaContext ctx) : base(ctx)
        {
            double fs = ctx.sampleRate;
            attCoef = Math.Exp(-1 / (Attack * fs));
            relCoef = Math.Exp(-1 / (Release * fs));
            line = new float[(int)Math.Round(0.006 * fs)];
        }

        // Reducción en dB para una entrada en dB (tabla medida)
        static double Reduce(double x)
        {
            if (x <= -40) return 0;
            if (x >= 6) return Reduction[46] - 0.9 * (x - 6);
            double p = x + 40; int i = (int)Math.Floor(p); double f = p - i;
            return Reduction[i] + (Reduction[i + 1] - Reduction[i]) * f;
        }

        protected override void Process(float[] input, float[] output)
        {
            for (int i = 0; i < output.Length; i++)
            {
                double x = input == null ? 0 : input[i];
                double a = Math.Abs(x);
                env = a > env ? attCoef * env + (1 - attCoef) * a : relCoef * env + (1 - relCoef) * a;
                double dbIn = 20 * Math.Log10(Math.Max(env, 1e-12));
                double start = -16.5 * Math.Exp(-frames / 2600.0);
                frames++;
                double g = Math.Pow(10, (Reduce(dbIn) + start) / 20);
                float delayed = line[pos];
                line[pos] = (float)x;
                pos = (pos + 1) % line.Length;
                output[i] = (float)(delayed * g * makeup);
            }
        }
    }

    public sealed class WaBuffer
    {
        public readonly float[] data;
        public readonly double sampleRate;
        internal WaBuffer(int length, double sampleRate) { data = new float[length]; this.sampleRate = sampleRate; }
        public int length { get { return data.Length; } }
        public float[] getChannelData(int channel) { return data; }
    }

    // AudioBufferSourceNode sin bucle y a velocidad 1 (lo que usa el juego: ruido). Como Chrome, el inicio "offset"
    // se redondea a la muestra más cercana y no hay interpolación (medido en AudioLab).
    public sealed class WaBufferSource : WaNode
    {
        public WaBuffer buffer;
        public readonly WaParam playbackRate = new WaParam(1);
        bool started;
        long startFrame = long.MaxValue, stopFrame = long.MaxValue;
        double readIndex;
        readonly float[] ra = new float[WaContext.Quantum];
        internal WaBufferSource(WaContext ctx) : base(ctx) { }

        public void start(double when, double offset = 0)
        {
            started = true;
            startFrame = ctx.Frame(when);
            readIndex = Math.Round(offset * (buffer == null ? ctx.sampleRate : buffer.sampleRate), MidpointRounding.AwayFromZero);
        }
        public void stop(double when)
        {
            stopFrame = ctx.Frame(when);
            if (when > ctx.maxStopTime) ctx.maxStopTime = when;
        }

        protected override void Process(float[] input, float[] output)
        {
            playbackRate.Values(ctx.frame0, ctx.sampleRate, ra);
            for (int i = 0; i < output.Length; i++)
            {
                long F = ctx.frame0 + i;
                if (!started || F < startFrame || F >= stopFrame || buffer == null) { output[i] = 0; continue; }
                float[] d = buffer.data;
                if (readIndex < 0 || readIndex >= d.Length) { output[i] = 0; continue; }
                output[i] = d[(int)readIndex];
                readIndex += ra[i];
            }
        }
    }

    // OscillatorNode. Fase con incremento en float32 (como Chrome) y tablas de banda limitada (WaWave).
    public sealed class WaOscillator : WaNode
    {
        public string type = "sine";
        public readonly WaParam frequency = new WaParam(440);
        public readonly WaParam detune = new WaParam(0);
        bool started;
        double startWhen;
        long stopFrame = long.MaxValue;
        double phase;
        readonly float[] fa = new float[WaContext.Quantum], da = new float[WaContext.Quantum];
        internal WaOscillator(WaContext ctx) : base(ctx) { }

        public void start(double when)
        {
            started = true;
            startWhen = when;
        }
        public void stop(double when)
        {
            stopFrame = ctx.Frame(when);
            if (when > ctx.maxStopTime) ctx.maxStopTime = when;
        }

        protected override void Process(float[] input, float[] output)
        {
            // Arranque: con automatización de frecuencia, Chrome redondea hacia arriba (medido en AudioLab)
            long startFrame = frequency.HasEvents ? WaParam.Ceil(startWhen, ctx.sampleRate) : ctx.Frame(startWhen);
            // Chrome: en el bloque donde arranca, los parámetros se leen desde el principio del bloque, no desde la
            // muestra de arranque (medido en AudioLab): la muestra i usa el valor de la posición i - o, con o el
            // desplazamiento del arranque dentro del bloque.
            int o = started && startFrame > ctx.frame0 ? (int)Math.Min(WaContext.Quantum, startFrame - ctx.frame0) : 0;
            frequency.Values(ctx.frame0, ctx.sampleRate, fa);
            detune.Values(ctx.frame0, ctx.sampleRate, da);
            for (int i = 0; i < output.Length; i++)
            {
                long F = ctx.frame0 + i;
                if (!started || F < startFrame || F >= stopFrame) { output[i] = 0; continue; }
                int j = i - o;
                double freq = fa[j] * Math.Pow(2, da[j] / 1200); // detune en cents
                float inc = (float)(freq * WaWave.Size / ctx.sampleRate);
                output[i] = (float)WaWave.Read(type, freq, phase, ctx.sampleRate);
                phase += inc;
            }
        }
    }

    // AudioParam: valor por defecto más una lista de automatizaciones (ordenadas por tiempo, en segundos).
    // Cada muestra toma el valor del segmento en que cae: constante tras setValueAtTime, o una rampa
    // (lineal o exponencial) desde el evento anterior hasta el suyo.
    public sealed class WaParam
    {
        enum Kind { Set, Linear, Exp }
        struct Event { public Kind kind; public double time; public double value; }

        double defaultValue;
        readonly List<Event> events = new List<Event>();

        public WaParam(double value) { defaultValue = value; }

        public double value
        {
            get { return defaultValue; }
            set { defaultValue = value; }
        }

        public void setValueAtTime(double value, double time) { Add(Kind.Set, value, time); }
        public void linearRampToValueAtTime(double value, double time) { Add(Kind.Linear, value, time); }
        public void exponentialRampToValueAtTime(double value, double time) { Add(Kind.Exp, value, time); }

        void Add(Kind kind, double value, double time)
        {
            var e = new Event { kind = kind, time = time, value = value };
            int pos = events.Count;
            while (pos > 0 && events[pos - 1].time > time) pos--; // a igualdad de tiempo, detrás del último
            events.Insert(pos, e);
        }

        // Rellena dst[0..n) con el valor del parámetro en las muestras frame0.. (a-rate)
        internal void Values(long frame0, double sampleRate, float[] dst)
        {
            for (int i = 0; i < dst.Length; i++)
            {
                dst[i] = (float)ValueAt(frame0 + i, sampleRate);
            }
        }

        // Muestra de un evento (medido en AudioLab): un setValueAtTime cae en la muestra siguiente si el instante no es
        // exacto (1.2000000000000002 s -> 57601); el final de una rampa redondea (0.28000000000000003 s -> 13440)
        static long Fr(Event e, double sampleRate)
        {
            return e.kind == Kind.Set ? Ceil(e.time, sampleRate) : (long)Math.Round(e.time * sampleRate, MidpointRounding.AwayFromZero);
        }
        public static long Ceil(double time, double sampleRate) { return (long)Math.Ceiling(time * sampleRate); }
        public bool HasEvents { get { return events.Count > 0; } }

        // Valor en la muestra n: se evalúa con muestras enteras (como Chrome), no con instantes
        double ValueAt(long n, double sr)
        {
            // último evento con muestra <= n
            int k = -1;
            for (int i = 0; i < events.Count; i++) if (Fr(events[i], sr) <= n) k = i;
            if (k < 0)
            {
                // antes del primer evento: el valor por defecto; si el primer evento es una rampa, sale de ahí
                if (events.Count == 0 || events[0].kind == Kind.Set) return defaultValue;
                return Segment(defaultValue, 0, events[0], n, sr);
            }
            Event e = events[k];
            if (k + 1 < events.Count && events[k + 1].kind != Kind.Set)
                return Segment(e.value, Fr(e, sr), events[k + 1], n, sr);
            return e.value;
        }

        static double Segment(double from, long n0, Event next, long n, double sr)
        {
            long n1 = Fr(next, sr);
            if (!(n1 > n0)) return next.value;
            double f = (double)(n - n0) / (n1 - n0);
            if (next.kind == Kind.Linear) return from + (next.value - from) * f;
            if (from <= 0 || next.value <= 0) return from; // la exponencial no admite cero ni signos distintos
            return from * Math.Pow(next.value / from, f);
        }
    }

    // Tablas de banda limitada de los osciladores (como en Chrome; ver los medidos en AudioLab.cs).
    //   · Tabla de 4096 muestras: suma de armónicos b_k sin(2 pi k j / 4096) con los coeficientes de cada forma.
    //   · Tabla j (un tercio de octava por j): N_j = floor(2048 * 2^(-j/3)) armónicos, con tope 2047 y mínimo 1.
    //   · Para una frecuencia f: x = 3 log2(f / (nyquist/2048)) + 1; j = floor(x), a = x - j; la lectura es
    //     (1-a) * tabla_j + a * tabla_(j+1).
    //   · Todas las tablas de una forma se dividen por el pico de la tabla completa (2047 armónicos).
    //   · La fase avanza con el incremento en float32 f * 4096 / fs, y la lectura de la tabla es lineal.
    internal static class WaWave
    {
        public const int Size = 4096;
        const int MaxPartials = 2047;
        const int MinIndex = -3, MaxIndex = 60;
        static readonly object gate = new object();
        static readonly Dictionary<string, Dictionary<int, double[]>> tables = new Dictionary<string, Dictionary<int, double[]>>();
        static readonly Dictionary<string, double> peaks = new Dictionary<string, double>();

        static int Partials(int j)
        {
            double n = Math.Floor(2048 * Math.Pow(2, -j / 3.0));
            if (n > MaxPartials) n = MaxPartials;
            if (n < 1) n = 1;
            return (int)n;
        }

        // Coeficiente del armónico k (sin normalizar)
        static double Coef(string type, int k)
        {
            switch (type)
            {
                case "sawtooth": return (2 / Math.PI) * ((k % 2 == 1) ? 1 : -1) / k;
                case "square": return (k % 2 == 1) ? (4 / Math.PI) / k : 0;
                case "triangle": return (k % 2 == 1) ? (8 / (Math.PI * Math.PI)) * ((((k - 1) / 2) % 2 == 1) ? -1 : 1) / ((double)k * k) : 0;
                default: return k == 1 ? 1 : 0; // "sine"
            }
        }

        // Construye de una vez, por armónicos crecientes, todas las tablas de una forma que hacen falta
        static void Build(string type)
        {
            var needed = new HashSet<int>();
            for (int j = MinIndex; j <= MaxIndex; j++) needed.Add(Partials(j));
            var sums = new double[Size];
            var dict = new Dictionary<int, double[]>();
            for (int k = 1; k <= MaxPartials; k++)
            {
                double b = Coef(type, k);
                if (b != 0)
                    for (int j = 0; j < Size; j++) sums[j] += b * Math.Sin(2 * Math.PI * ((k * j) % Size) / Size);
                if (needed.Contains(k)) dict[k] = (double[])sums.Clone();
            }
            double peak = 0;
            foreach (double v in sums) peak = Math.Max(peak, Math.Abs(v));
            tables[type] = dict;
            peaks[type] = peak;
        }

        static double[] Table(string type, int j)
        {
            return tables[type][Partials(Math.Min(MaxIndex, Math.Max(MinIndex, j)))];
        }

        // Valor de la onda en la fase pos (muestras de tabla, creciente) para la frecuencia freq
        public static double Read(string type, double freq, double pos, double sampleRate)
        {
            lock (gate)
            {
                if (!tables.ContainsKey(type)) Build(type);
            }
            double x = freq > 0 ? 3 * Math.Log(freq / (sampleRate / 2 / 2048)) / Math.Log(2) + 1 : 3 * Math.Log(1.0 / 2048) / Math.Log(2) + 1;
            int j = (int)Math.Floor(x);
            double a = x - j;
            double[] t0 = Table(type, j), t1 = Table(type, j + 1);
            int i0 = (int)Math.Floor(pos);
            double fr = pos - i0;
            int m = ((i0 % Size) + Size) % Size, m1 = (m + 1) % Size;
            double v0 = t0[m] + (t0[m1] - t0[m]) * fr;
            double v1 = t1[m] + (t1[m1] - t1[m]) * fr;
            return ((1 - a) * v0 + a * v1) / peaks[type];
        }
    }
}
