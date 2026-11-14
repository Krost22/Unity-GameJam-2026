// Funciones matemáticas de JS (Math.sin, cos, exp, log, log10, pow, hypot) con los MISMOS bits que Chrome.
// Chrome (V8 con la libm de LLVM) da sin, cos, exp, log y log10 correctamente redondeados (el double más cercano
// al valor exacto), y pow es el de la librería de C (en Windows también correctamente redondeado en la práctica).
// Así que aquí se calcula el resultado correctamente redondeado, sin depender de System.Math:
//   · camino rápido en doble-double (~100 bits) con una cota de error; si la cota decide el redondeo, listo;
//   · si no (casi nunca), camino lento con enteros grandes (BigInteger) y cada vez más bits (Ziv).
// Las tablas y constantes se calculan al arrancar con el camino lento: no hay números mágicos que copiar mal.
// hypot copia el algoritmo de V8 (builtins/math.tq). Referencias y pruebas: Unity/Tools~/ref-math.js, MathLab.cs
// y Tests/EditMode/MathTests.cs.
using System;
using System.Numerics;
using System.Runtime.CompilerServices;

namespace SaldoNegro.Logic
{
    public static partial class JsMath
    {
        public static double sin(double x) { return Cr.SinCos(x, false); }
        public static double cos(double x) { return Cr.SinCos(x, true); }
        public static double exp(double x) { return Cr.Exp(x); }
        public static double log(double x) { return Cr.Log(x, false); }
        public static double log10(double x) { return Cr.Log(x, true); }
        public static double pow(double x, double y) { return Cr.Pow(x, y); }
        public static double sqrt(double x) { return Math.Sqrt(x); } // IEEE: exacta en todas partes

        // Math.hypot de V8 (math.tq): con 2 y 3 argumentos hay atajos; con más, suma de Kahan
        public static double hypot(double x, double y)
        {
            double a = Math.Abs(x), b = Math.Abs(y);
            if (a == double.PositiveInfinity || b == double.PositiveInfinity) return double.PositiveInfinity;
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            double max = a > b ? a : b;
            if (max == 0) return 0;
            return Math.Sqrt((a / max) * (a / max) + (b / max) * (b / max)) * max;
        }

        public static double hypot(params double[] v)
        {
            int n = v.Length;
            if (n == 0) return 0;
            if (n == 1) return Math.Abs(v[0]);
            if (n == 2) return hypot(v[0], v[1]);
            if (n == 3)
            {
                double a = Math.Abs(v[0]), b = Math.Abs(v[1]), c = Math.Abs(v[2]);
                if (a == double.PositiveInfinity || b == double.PositiveInfinity || c == double.PositiveInfinity) return double.PositiveInfinity;
                if (double.IsNaN(a) || double.IsNaN(b) || double.IsNaN(c)) return double.NaN;
                double max = a > b ? a : b;
                if (c > max) max = c;
                if (max == 0) return 0;
                double pa = (a / max) * (a / max), pb = (b / max) * (b / max);
                double comp = (pa + pb) - pa - pb;
                double pc = (c / max) * (c / max) - comp;
                return Math.Sqrt(pa + pb + pc) * max;
            }
            var abs = new double[n];
            bool nan = false;
            double m = 0;
            for (int i = 0; i < n; i++)
            {
                if (double.IsNaN(v[i])) { nan = true; continue; }
                abs[i] = Math.Abs(v[i]);
                if (abs[i] > m) m = abs[i];
            }
            if (m == double.PositiveInfinity) return double.PositiveInfinity;
            if (nan) return double.NaN;
            if (m == 0) return 0;
            double sum = 0, comp2 = 0;
            for (int i = 0; i < n; i++)
            {
                double k = abs[i] / m;
                double summand = k * k - comp2;
                double pre = sum + summand;
                comp2 = (pre - sum) - summand;
                sum = pre;
            }
            return Math.Sqrt(sum) * m;
        }

        // Funciones correctamente redondeadas (internal para que las pruebas del banco puedan comparar los dos caminos)
        internal static class Cr
        {
            static readonly double NEG_ZERO = BitConverter.Int64BitsToDouble(long.MinValue);
            const double E80 = 8.271806125530277e-25;   // 2^-80
            const double E84 = 5.169878828456423e-26;   // 2^-84
            const double E88 = 3.2311742677852644e-27;  // 2^-88
            const double E98 = 3.1554436208840472e-30;  // 2^-98
            const double E180 = 6.55360946e-55;          // < 2^-180 (2^-180 = 6.5e-55, redondeado hacia arriba)
            const double TWO20 = 1048576.0;

            // ================= Doble-double =================
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static void TwoSum(double a, double b, out double s, out double e) { s = a + b; double bb = s - a; e = (a - (s - bb)) + (b - bb); }
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static void Fast2Sum(double a, double b, out double s, out double e) { s = a + b; e = b - (s - a); }
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static void TwoProd(double a, double b, out double p, out double e)
            {
                p = a * b;
                double t = 134217729.0 * a, ah = t - (t - a), al = a - ah;
                t = 134217729.0 * b; double bh = t - (t - b), bl = b - bh;
                e = ((ah * bh - p) + ah * bl + al * bh) + al * bl;
            }
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static void Add(double ah, double al, double bh, double bl, out double h, out double l)
            {
                TwoSum(ah, bh, out double s, out double e);
                TwoSum(al, bl, out double t, out double f);
                e += t; Fast2Sum(s, e, out s, out e); e += f; Fast2Sum(s, e, out h, out l);
            }
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static void Mul(double ah, double al, double bh, double bl, out double h, out double l)
            {
                TwoProd(ah, bh, out double p, out double e);
                e += ah * bl + al * bh; Fast2Sum(p, e, out h, out l);
            }
            // Horner en doble-double: c[n] z^n + ... + c[0]
            static void Horner(double[] ch, double[] cl, double zh, double zl, out double h, out double l)
            {
                int n = ch.Length - 1;
                h = ch[n]; l = cl[n];
                for (int i = n - 1; i >= 0; i--) { Mul(h, l, zh, zl, out h, out l); Add(h, l, ch[i], cl[i], out h, out l); }
            }
            // ¿Decide la cota el redondeo? (h + l es el valor, err la cota de error absoluta)
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            static bool Decide(double h, double l, double err, out double r)
            {
                r = h + (l - err);
                return r == h + (l + err);
            }
            static double Pow2(int k) { return BitConverter.Int64BitsToDouble((long)(k + 1023) << 52); } // normal: -1022..1023

            // ================= Tablas (calculadas con el camino lento) =================
            static readonly double[] EXP_TH = new double[64], EXP_TL = new double[64]; // 2^(j/64)
            static readonly double[] EXPC_H = new double[11], EXPC_L = new double[11];   // 1/(i+1)!
            static readonly double[] LOG_TH = new double[183], LOG_TL = new double[183]; // log(j/128), j = 90..182
            static readonly double[] LOGC_H = new double[13], LOGC_L = new double[13];   // (-1)^i/(i+1)
            static readonly double[] SINC_H = new double[14], SINC_L = new double[14];   // (-1)^i/(2i+1)!
            static readonly double[] COSC_H = new double[15], COSC_L = new double[15];   // (-1)^i/(2i)!
            static readonly double LN2A, LN2B, LN2C;          // ln2 en trozos (LN2A con 42 bits: e*LN2A exacto)
            static readonly double L64A, L64B, L64C;          // ln2/64 (L64A con 36 bits)
            static readonly double INV64LN2;                  // 64/ln2
            static readonly double P1, P2, P3, P4, P5;        // pi/2 (P1..P3 con 33 bits: k*Pi exacto)
            static readonly double TWO_OVER_PI;
            static readonly double ILN10H, ILN10L;            // 1/ln10

            static Cr()
            {
                const int W = 256;
                BigInteger one = BigInteger.One << W;
                // Coeficientes
                BigInteger f = BigInteger.One;
                for (int i = 0; i < 11; i++) { f *= i + 1; ToDD(one / f, W, out EXPC_H[i], out EXPC_L[i]); }
                for (int i = 0; i < 13; i++) { ToDD(one / (i + 1) * ((i & 1) == 0 ? 1 : -1), W, out LOGC_H[i], out LOGC_L[i]); }
                f = BigInteger.One;
                for (int i = 0; i < 15; i++)
                {
                    if (i > 0) f *= (2 * i - 1) * (2 * i);
                    ToDD(one / f * ((i & 1) == 0 ? 1 : -1), W, out COSC_H[i], out COSC_L[i]);
                }
                f = BigInteger.One;
                for (int i = 0; i < 14; i++)
                {
                    if (i > 0) f *= (2 * i) * (2 * i + 1);
                    ToDD(one / f * ((i & 1) == 0 ? 1 : -1), W, out SINC_H[i], out SINC_L[i]);
                }
                // ln2 y ln2/64
                BigInteger ln2 = Ln2(W);
                BigInteger v = ln2;
                LN2A = Chunk(ref v, W, 42); LN2B = Chunk(ref v, W, 53); LN2C = Chunk(ref v, W, 53);
                v = ln2; // ln2/64: el mismo entero con 6 bits más de escala
                L64A = Chunk(ref v, W + 6, 36); L64B = Chunk(ref v, W + 6, 53); L64C = Chunk(ref v, W + 6, 53);
                INV64LN2 = RoundBig((one << (W + 6)) / ln2, -W);
                // pi/2
                BigInteger pio2 = Pi(W + 64) >> 1; // escala W + 64
                TWO_OVER_PI = RoundBig((BigInteger.One << (2 * (W + 64))) / pio2, -(W + 64));
                v = pio2;
                P1 = Chunk(ref v, W + 64, 33); P2 = Chunk(ref v, W + 64, 33); P3 = Chunk(ref v, W + 64, 33);
                P4 = Chunk(ref v, W + 64, 53); P5 = Chunk(ref v, W + 64, 53);
                // 1/ln10
                ToDD(InvLn10(W), W, out ILN10H, out ILN10L);
                // 2^(j/64)
                for (int j = 0; j < 64; j++) ToDD(ExpFix(j * ln2 >> 6, W), W, out EXP_TH[j], out EXP_TL[j]);
                // log(j/128)
                for (int j = 90; j <= 182; j++) ToDD(LogFix(j / 128.0, W), W, out LOG_TH[j], out LOG_TL[j]);
            }

            // ================= sin / cos =================
            internal static double SinCos(double x, bool isCos)
            {
                if (double.IsNaN(x) || double.IsInfinity(x)) return double.NaN;
                double ax = Math.Abs(x);
                if (isCos ? ax < 7.450580596923828e-9 : ax < 1.4901161193847656e-8) return isCos ? 1 : x; // |x| < 2^-27 / 2^-26
                if (FastSinCos(ax, isCos, out double r)) return x < 0 && !isCos ? -r : r;
                r = SlowSinCos(ax, isCos);
                return x < 0 && !isCos ? -r : r;
            }

            // Camino rápido (|x| <= 2^20): reducción con pi/2 en 5 trozos y Taylor en doble-double
            internal static bool FastSinCos(double ax, bool isCos, out double res)
            {
                res = 0;
                if (ax > TWO20) return false;
                double k = Math.Floor(ax * TWO_OVER_PI + 0.5);
                double rh, rl;
                if (k == 0) { rh = ax; rl = 0; }
                else
                {
                    double a = ax - k * P1; // exacto
                    TwoSum(a, -(k * P2), out rh, out rl);
                    Add(rh, rl, -(k * P3), 0, out rh, out rl);
                    TwoProd(k, P4, out double p, out double pe);
                    Add(rh, rl, -p, -pe, out rh, out rl);
                    Add(rh, rl, -(k * P5), 0, out rh, out rl);
                }
                double dr = Math.Abs(rh) * E98 + (k == 0 ? 0 : E180); // cota del error de r
                int q = (int)((long)k & 3);
                Mul(rh, rl, rh, rl, out double zh, out double zl);
                bool useCos = isCos ? (q & 1) == 0 : (q & 1) == 1;
                bool neg = isCos ? (q == 1 || q == 2) : (q >= 2);
                double h, l;
                if (useCos) Horner(COSC_H, COSC_L, zh, zl, out h, out l);
                else { Horner(SINC_H, SINC_L, zh, zl, out h, out l); Mul(h, l, rh, rl, out h, out l); }
                if (!Decide(h, l, Math.Abs(h) * E84 + dr * 1.01, out res)) return false;
                if (neg) res = -res;
                return true;
            }

            static double SlowSinCos(double ax, bool isCos)
            {
                double r = 0;
                for (int w = 192; w <= 3072; w *= 2) if (BigSinCos(ax, isCos, w, out r)) return r;
                return r;
            }

            static bool BigSinCos(double ax, bool isCos, int W, out double res)
            {
                Decompose(ax, out long M, out int E);
                int F = Math.Max(W + E + 85, W + 32);
                BigInteger Y = (M * TwoOverPi(F)) >> (F - E - W); // x*2/pi con W bits de fracción
                BigInteger q = (Y + (BigInteger.One << (W - 1))) >> W;
                BigInteger fr = Y - (q << W);
                int quad = (int)(q & 3);
                BigInteger r = (fr * (Pi(W) >> 1)) >> W;
                bool useCos = isCos ? (quad & 1) == 0 : (quad & 1) == 1;
                bool neg = isCos ? (quad == 1 || quad == 2) : (quad >= 2);
                BigInteger v = SinCosFix(r, W, useCos);
                if (v.Sign < 0) { v = -v; neg = !neg; }
                bool ok = DecideBig(v, 16, -W, out res);
                if (neg) res = -res;
                return ok;
            }

            // ================= exp =================
            internal static double Exp(double x)
            {
                if (double.IsNaN(x)) return x;
                if (x > 709.79) return double.PositiveInfinity;
                if (x < -745.14) return 0;
                if (Math.Abs(x) <= 5.551115123125783e-17) return 1; // |x| <= 2^-54
                if (FastExp(x, 0, 0, out double r)) return r;
                return SlowExp(x);
            }

            // e^(th+tl) = 2^k * (mh + ml)
            static void ExpCore(double th, double tl, out int k, out double mh, out double ml)
            {
                double n = Math.Floor(th * INV64LN2 + 0.5);
                int ni = (int)n;
                double a = th - n * L64A; // exacto
                TwoProd(n, L64B, out double p, out double pe);
                Add(a, 0, -p, -pe, out double rh, out double rl);
                Add(rh, rl, tl - n * L64C, 0, out rh, out rl);
                int j = ni & 63;
                k = ni >> 6;
                Horner(EXPC_H, EXPC_L, rh, rl, out double ph, out double pl);
                Mul(ph, pl, rh, rl, out ph, out pl);                          // e^r - 1
                Mul(EXP_TH[j], EXP_TL[j], ph, pl, out ph, out pl);
                Add(EXP_TH[j], EXP_TL[j], ph, pl, out mh, out ml);
            }

            // relErr: cota relativa extra que trae la entrada (para pow)
            internal static bool FastExp(double th, double tl, double relErr, out double res)
            {
                res = 0;
                ExpCore(th, tl, out int k, out double mh, out double ml);
                if (k < -1020 || k > 1020) return false;
                if (!Decide(mh, ml, mh * (E84 + relErr), out double m)) return false;
                res = m * Pow2(k);
                return true;
            }

            static double SlowExp(double x)
            {
                double r = 0;
                for (int w = 160; w <= 2560; w *= 2)
                {
                    int Wt = w + 16;
                    if (BigExp(ToFix(x, Wt), Wt, BigInteger.Zero, out r)) return r;
                }
                return r;
            }

            // e^(T/2^Wt), con T de error errT unidades
            static bool BigExp(BigInteger T, int Wt, BigInteger errT, out double res)
            {
                BigInteger ln2 = Ln2(Wt);
                BigInteger k = FloorDiv(2 * T + ln2, 2 * ln2);
                BigInteger r = T - k * ln2;
                BigInteger e = ExpFix(r, Wt);
                BigInteger err = 2 * (errT + BigInteger.Abs(k)) + 4;
                return DecideBig(e, err, (int)k - Wt, out res);
            }

            // ================= log / log10 =================
            internal static double Log(double x, bool ten)
            {
                if (double.IsNaN(x) || x < 0) return double.NaN;
                if (x == 0) return double.NegativeInfinity;
                if (double.IsInfinity(x)) return x;
                if (x == 1) return 0;
                if (FastLog(x, ten, out double r)) return r;
                for (int w = 160; w <= 2560; w *= 2) if (BigLog(x, ten, w, out r)) return r;
                return r;
            }

            // log(x) en doble-double, error relativo < 2^-90 (x > 0 finito, distinto de 1)
            static void LogCore(double x, out double h, out double l)
            {
                int e = 0;
                if (x < 2.2250738585072014e-308) { x *= 18014398509481984.0; e = -54; } // subnormal: * 2^54
                long bits = BitConverter.DoubleToInt64Bits(x);
                e += (int)(bits >> 52) - 1023;
                double m = BitConverter.Int64BitsToDouble((bits & 0xFFFFFFFFFFFFFL) | 0x3FF0000000000000L); // [1, 2)
                if (m > 1.4142135623730951) { m *= 0.5; e++; }
                int j = (int)Math.Floor(m * 128 + 0.5);
                double g = j / 128.0;
                double num = m - g; // exacto
                double q1 = num / g;
                TwoProd(q1, g, out double p, out double pe);
                double q2 = ((num - p) - pe) / g;
                Fast2Sum(q1, q2, out double rh, out double rl);
                Horner(LOGC_H, LOGC_L, rh, rl, out h, out l);
                Mul(h, l, rh, rl, out h, out l); // log1p(r)
                if (j != 128) Add(LOG_TH[j], LOG_TL[j], h, l, out h, out l);
                if (e != 0)
                {
                    TwoProd(e, LN2B, out double bh, out double bl);
                    Add(e * LN2A, 0, bh, bl + e * LN2C, out double ah, out double al);
                    Add(ah, al, h, l, out h, out l);
                }
            }

            internal static bool FastLog(double x, bool ten, out double res)
            {
                LogCore(x, out double h, out double l);
                if (ten) Mul(h, l, ILN10H, ILN10L, out h, out l);
                return Decide(h, l, Math.Abs(h) * E80, out res);
            }

            static bool BigLog(double x, bool ten, int W, out double res)
            {
                int Wt = W + 16;
                BigInteger v = LogFix(x, Wt);
                BigInteger err = 4;
                if (ten) { v = (v * InvLn10(Wt)) >> Wt; err = 1024 + 8; }
                bool neg = v.Sign < 0;
                bool ok = DecideBig(BigInteger.Abs(v), err, -Wt, out res);
                if (neg) res = -res;
                return ok;
            }

            // ================= pow =================
            internal static double Pow(double x, double y)
            {
                // Lo que V8 hace antes de llamar a la pow de C (src/numbers/ieee754.cc)
                if (double.IsNaN(y)) return double.NaN;
                if (double.IsInfinity(y) && (x == 1 || x == -1)) return double.NaN;
                if (y == 2) return x * x;
                if (y == 0.5) return double.IsInfinity(x) ? double.PositiveInfinity : Math.Sqrt(x + 0.0);
                // La pow de C (C99, anexo F)
                if (y == 0) return 1;
                if (double.IsNaN(x)) return double.NaN;
                if (x == 1) return 1;
                bool yInt = !double.IsInfinity(y) && Math.Floor(y) == y;
                bool yOdd = yInt && Math.Abs(y) < 9007199254740992.0 && (((long)y) & 1) != 0;
                if (x == 0)
                {
                    if (y < 0) return yOdd ? 1 / x : double.PositiveInfinity;
                    return yOdd ? x : 0;
                }
                if (double.IsInfinity(x))
                {
                    if (x > 0) return y < 0 ? 0 : double.PositiveInfinity;
                    if (y < 0) return yOdd ? NEG_ZERO : 0;
                    return yOdd ? double.NegativeInfinity : double.PositiveInfinity;
                }
                if (double.IsInfinity(y))
                {
                    bool big = Math.Abs(x) > 1;
                    return (y > 0) == big ? double.PositiveInfinity : 0;
                }
                bool neg = false;
                if (x < 0)
                {
                    if (!yInt) return double.NaN;
                    neg = yOdd; x = -x;
                }
                double r = PosPow(x, y);
                return neg ? -r : r;
            }

            // x > 0 finito y distinto de 1, y finito y distinto de 0
            static double PosPow(double x, double y)
            {
                if (FastPow(x, y, out double r, out bool done) || done) return r;
                if (ExactPow(x, y, out r)) return r;
                for (int w = 160; w <= 2560; w *= 2) if (BigPow(x, y, w, out r)) return r;
                return r;
            }

            internal static bool FastPow(double x, double y, out double res, out bool done)
            {
                done = false; res = 0;
                LogCore(x, out double lh, out double ll);
                TwoProd(y, lh, out double th, out double tl);
                tl += y * ll;
                Fast2Sum(th, tl, out th, out tl);
                if (th > 710) { res = double.PositiveInfinity; done = true; return true; }
                if (th < -746) { res = 0; done = true; return true; }
                return FastExp(th, tl, Math.Abs(th) * E84 + E88, out res);
            }

            // Resultados exactos o justo a mitad entre dos doubles: ahí el camino de Ziv no acabaría nunca
            internal static bool ExactPow(double x, double y, out double res)
            {
                res = 0;
                Decompose(x, out long mx, out int ex);
                while ((mx & 1) == 0) { mx >>= 1; ex++; }
                Decompose(Math.Abs(y), out long my, out int ey);
                while ((my & 1) == 0) { my >>= 1; ey++; }
                bool yneg = y < 0;
                if (mx == 1)
                {
                    // x = 2^ex: x^y = 2^(ex*y), exacto si ex*y es entero
                    BigInteger t;
                    if (ey >= 0) t = (BigInteger)ex * my << Math.Min(ey, 64);
                    else
                    {
                        int q = -ey;
                        if (q > 11 || ex % (1 << q) != 0) return false;
                        t = (BigInteger)(ex >> q) * my;
                    }
                    if (yneg) t = -t;
                    if (t > 2000) { res = double.PositiveInfinity; return true; }
                    if (t < -2000) { res = 0; return true; }
                    res = RoundBig(BigInteger.One, (int)t);
                    return true;
                }
                if (yneg) return false; // 1/impar no es diádico
                long s = mx;
                int n;
                if (ey >= 0)
                {
                    if (y > 64) return false;
                    n = (int)y;
                }
                else
                {
                    int q = -ey;
                    if (q > 6 || ex % (1 << q) != 0) return false;
                    for (int i = 0; i < q; i++)
                    {
                        long rt = (long)Math.Sqrt(s);
                        while (rt * rt > s) rt--;
                        while ((rt + 1) * (rt + 1) <= s) rt++;
                        if (rt * rt != s) return false;
                        s = rt;
                    }
                    ex >>= q;
                    if (my > 64) return false;
                    n = (int)my;
                }
                BigInteger v = BigInteger.Pow(s, n);
                if (BitLen(v) > 60) return false; // demasiados bits: ni exacto ni a mitad
                res = RoundBig(v, ex * n);
                return true;
            }

            static bool BigPow(double x, double y, int W, out double res)
            {
                Decompose(Math.Abs(y), out long my, out int ey);
                int Wt = W + 16;
                int Wl = Wt + 64 + Math.Max(0, ey + 53);
                BigInteger L = LogFix(x, Wl);
                BigInteger T = (my * L) >> (Wl - ey - Wt);
                if (y < 0) T = -T;
                if (T > (BigInteger)750 << Wt) { res = double.PositiveInfinity; return true; }
                if (T < -((BigInteger)750 << Wt)) { res = 0; return true; }
                return BigExp(T, Wt, 2, out res);
            }

            // ================= Enteros grandes =================
            static void Decompose(double ax, out long M, out int E)
            {
                long bits = BitConverter.DoubleToInt64Bits(ax) & long.MaxValue;
                int be = (int)(bits >> 52);
                M = bits & 0xFFFFFFFFFFFFFL;
                if (be == 0) E = -1074; else { M |= 1L << 52; E = be - 1075; }
            }

            static int BitLen(BigInteger n)
            {
                if (n.Sign == 0) return 0;
                byte[] b = BigInteger.Abs(n).ToByteArray();
                int i = b.Length - 1;
                while (i > 0 && b[i] == 0) i--;
                int top = b[i], bits = 0;
                while (top > 0) { bits++; top >>= 1; }
                return i * 8 + bits;
            }

            static BigInteger FloorDiv(BigInteger a, BigInteger b)
            {
                BigInteger q = BigInteger.DivRem(a, b, out BigInteger r);
                if (r.Sign != 0 && (r.Sign < 0) != (b.Sign < 0)) q -= 1;
                return q;
            }

            // El double más cercano a n * 2^e2 (empate al par), con subnormales y desbordamiento
            static double RoundBig(BigInteger n, int e2)
            {
                if (n.Sign == 0) return 0;
                if (n.Sign < 0) return -RoundBig(-n, e2);
                int L = BitLen(n);
                long top = (long)L - 1 + e2;
                if (top > 1023) return double.PositiveInfinity;
                int sh = top >= -1022 ? L - 53 : -1074 - e2;
                BigInteger q;
                if (sh <= 0) q = n << -sh;
                else
                {
                    if (sh > L + 1) return 0;
                    q = n >> sh;
                    BigInteger rem = n - (q << sh), half = BigInteger.One << (sh - 1);
                    if (rem > half || (rem == half && !q.IsEven)) q += 1;
                }
                return Scale((double)(long)q, e2 + sh);
            }

            static double Scale(double v, int k)
            {
                while (k > 1000) { v *= Pow2(1000); k -= 1000; }
                while (k < -1000) { v *= Pow2(-1000); k += 1000; }
                return v * Pow2(k);
            }

            static bool DecideBig(BigInteger v, BigInteger err, int e2, out double res)
            {
                double a = RoundBig(v - err, e2), b = RoundBig(v + err, e2);
                res = RoundBig(v, e2);
                return a == b;
            }

            // double -> entero con W bits de fracción (trunca si no cabe)
            static BigInteger ToFix(double d, int W)
            {
                Decompose(Math.Abs(d), out long M, out int E);
                BigInteger v = M;
                v = E + W >= 0 ? v << (E + W) : v >> -(E + W);
                return d < 0 ? -v : v;
            }

            static void ToDD(BigInteger v, int W, out double h, out double l)
            {
                h = RoundBig(v, -W);
                l = RoundBig(v - ToFix(h, W), -W);
            }

            // Saca los 'bits' bits más altos de v (escala W) como double exacto y los resta
            static double Chunk(ref BigInteger v, int W, int bits)
            {
                int L = BitLen(v);
                int drop = Math.Max(0, L - bits);
                BigInteger c = (v >> drop) << drop;
                v -= c;
                return RoundBig(c, -W);
            }

            static readonly object gate = new object();
            static BigInteger cLn2, cPi, cTop, cIln10;
            static int wLn2 = -1, wPi = -1, wTop = -1, wIln10 = -1;

            // ln2 = 2 atanh(1/3)
            static BigInteger Ln2(int W)
            {
                lock (gate)
                {
                    if (W > wLn2)
                    {
                        int G = W + 64;
                        BigInteger p = (BigInteger.One << G) / 3, sum = 0;
                        for (int k = 0; p.Sign != 0; k++) { sum += p / (2 * k + 1); p /= 9; }
                        cLn2 = (2 * sum) >> 32; wLn2 = G - 32;
                    }
                    return cLn2 >> (wLn2 - W);
                }
            }

            // pi = 16 atan(1/5) - 4 atan(1/239)
            static BigInteger Pi(int W)
            {
                lock (gate)
                {
                    if (W > wPi)
                    {
                        int G = W + 64;
                        cPi = (16 * AtanInv(5, G) - 4 * AtanInv(239, G)) >> 32; wPi = G - 32;
                    }
                    return cPi >> (wPi - W);
                }
            }
            static BigInteger AtanInv(int n, int G)
            {
                BigInteger x = (BigInteger.One << G) / n, sum = x, n2 = n * n;
                for (int k = 1; x.Sign != 0; k++) { x /= n2; sum += (k & 1) == 1 ? -(x / (2 * k + 1)) : x / (2 * k + 1); }
                return sum;
            }

            static BigInteger TwoOverPi(int W)
            {
                BigInteger pi = Pi(W + 64);
                lock (gate)
                {
                    if (W > wTop) { cTop = (BigInteger.One << (2 * (W + 64) + 1)) / pi >> 64; wTop = W; }
                    return cTop >> (wTop - W);
                }
            }

            static BigInteger InvLn10(int W)
            {
                lock (gate) { if (W <= wIln10) return cIln10 >> (wIln10 - W); }
                int G = W + 64;
                BigInteger v = (BigInteger.One << (2 * G)) / LogFix(10, G);
                lock (gate)
                {
                    if (W > wIln10) { cIln10 = v >> 64; wIln10 = W; }
                    return cIln10 >> (wIln10 - W);
                }
            }

            // e^r (|r| <= ~0.36, escala W); error < 2 unidades
            static BigInteger ExpFix(BigInteger r, int W)
            {
                int G = W + 40;
                BigInteger one = BigInteger.One << G, R = r << 32; // r / 2^8 en escala G
                BigInteger sum = one + R, term = R;
                for (int n = 2; ; n++)
                {
                    term = BigInteger.Divide(term * R, one) / n;
                    if (term.Sign == 0) break;
                    sum += term;
                }
                for (int i = 0; i < 8; i++) sum = (sum * sum) >> G;
                return sum >> 40;
            }

            // log(x), x > 0 finito (escala W); error < 2 unidades
            static BigInteger LogFix(double x, int W)
            {
                Decompose(x, out long M, out int E);
                int L = BitLen(M);
                int G = W + 40;
                BigInteger one = BigInteger.One << G;
                BigInteger m = (BigInteger)M << (G - (L - 1)); // [1, 2)
                int e = E + L - 1;
                if (m * m > 2 * one * one) { m >>= 1; e++; }
                BigInteger z = ((m - one) << G) / (m + one), z2 = (z * z) >> G;
                BigInteger sum = z, term = z;
                for (int k = 1; ; k++)
                {
                    term = BigInteger.Divide(term * z2, one); // (truncando: con >> un negativo no llegaría nunca a 0)
                    if (term.Sign == 0) break;
                    sum += term / (2 * k + 1);
                }
                BigInteger res = 2 * sum;
                if (e != 0) res += e * Ln2(G);
                return res >> 40;
            }

            // sin(r) o cos(r) (|r| <= ~0.8, escala W); error < 2 unidades
            static BigInteger SinCosFix(BigInteger r, int W, bool isCos)
            {
                int G = W + 40;
                BigInteger R = r << 40, R2 = (R * R) >> G;
                BigInteger term = isCos ? BigInteger.One << G : R, sum = term;
                for (int n = 1; ; n++)
                {
                    int d = isCos ? (2 * n - 1) * (2 * n) : (2 * n) * (2 * n + 1);
                    term = -BigInteger.Divide(term * R2, BigInteger.One << G) / d;
                    if (term.Sign == 0) break;
                    sum += term;
                }
                return sum >> 40;
            }
        }
    }
}
