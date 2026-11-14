// Números como los escribe y los lee JavaScript, calculados con aritmética exacta (no con el formato de .NET,
// que en Mono redondea a 15 cifras y daría otros textos):
//   · toString: las cifras justas para volver a leer el mismo número (0.1 + 0.2 -> "0.30000000000000004");
//   · fromString / parse: el double más cercano al texto (redondeo al par, como JS);
//   · toFixed: n decimales redondeando el valor exacto del double (1.005.toFixed(2) -> "1.00");
//   · locale: toLocaleString('en-US') de un entero (1234567 -> "1,234,567").
using System;
using System.Globalization;
using System.Numerics;
using System.Text;

namespace SaldoNegro.Logic
{
    public static class JsNumber
    {
        // ---------- Piezas de un double ----------
        // x > 0 finito -> x = m * 2^e (m entero)
        static void decompose(double x, out long m, out int e)
        {
            long bits = BitConverter.DoubleToInt64Bits(x);
            int be = (int)((bits >> 52) & 0x7FF);
            long frac = bits & 0xFFFFFFFFFFFFFL;
            if (be == 0) { m = frac; e = -1074; }
            else { m = frac | (1L << 52); e = be - 1075; }
        }

        static readonly BigInteger[] POW10 = makePow10(400);
        static BigInteger[] makePow10(int n) { var a = new BigInteger[n]; a[0] = 1; for (int i = 1; i < n; i++) a[i] = a[i - 1] * 10; return a; }
        static BigInteger pow10(int k) { return k < POW10.Length ? POW10[k] : BigInteger.Pow(10, k); }

        public static int bitLength(BigInteger v)
        {
            if (v.Sign == 0) return 0;
            if (v.Sign < 0) v = -v;
            byte[] b = v.ToByteArray(); // little endian, con un byte de signo si hace falta
            int top = b.Length - 1;
            while (top > 0 && b[top] == 0) top--;
            int bits = top * 8, t = b[top];
            while (t != 0) { bits++; t >>= 1; }
            return bits;
        }

        // ---------- Number.prototype.toString() ----------
        public static string toString(double x)
        {
            if (double.IsNaN(x)) return "NaN";
            if (x == 0) return "0";
            if (double.IsPositiveInfinity(x)) return "Infinity";
            if (double.IsNegativeInfinity(x)) return "-Infinity";
            if (x < 0) return "-" + toString(-x);
            if (x < 9007199254740992.0 && x == Math.Floor(x)) return ((long)x).ToString(CultureInfo.InvariantCulture);
            shortest(x, out string digits, out int n);
            int k = digits.Length; // valor = 0.digits x 10^n
            if (k <= n && n <= 21) return digits + new string('0', n - k);
            if (0 < n && n <= 21) return digits.Substring(0, n) + "." + digits.Substring(n);
            if (-6 < n && n <= 0) return "0." + new string('0', -n) + digits;
            string mant = k == 1 ? digits : digits.Substring(0, 1) + "." + digits.Substring(1);
            int ex = n - 1;
            return mant + "e" + (ex < 0 ? "-" : "+") + Math.Abs(ex).ToString(CultureInfo.InvariantCulture);
        }

        // Las cifras más cortas que vuelven a dar x (x > 0 finito): x ≈ 0.digits * 10^n
        public static void shortest(double x, out string digits, out int n)
        {
            decompose(x, out long m, out int e);
            // x = X / XD (fracción exacta) y los dos medios huecos hasta los doubles vecinos: HL / HD por abajo, HU / HD por arriba
            BigInteger X, XD;
            if (e >= 0) { X = new BigInteger(m) << e; XD = 1; } else { X = m; XD = BigInteger.One << -e; }
            bool lowerNarrow = m == (1L << 52) && e > -1074;
            // Medio hueco de arriba = 2^(e-1); de abajo = 2^(e-2) si el de abajo es más estrecho
            // Todo con denominador común D = XD * 4: x = 4X/D, arriba = 2^(e-1) -> 2*2^e/D...
            BigInteger D = XD << 2, N = X << 2;
            BigInteger ulp = e >= 0 ? (BigInteger.One << e) << 2 : 4; // 2^e con el denominador D
            BigInteger hu = ulp >> 1, hl = lowerNarrow ? ulp >> 2 : ulp >> 1;
            bool even = (m & 1) == 0;
            // k = floor(log10 x)
            int k10 = (int)Math.Floor(Math.Log10(x));
            // Ajuste exacto: 10^k10 <= x < 10^(k10+1)
            while (cmpPow10(N, D, k10) < 0) k10--;
            while (cmpPow10(N, D, k10 + 1) >= 0) k10++;
            for (int p = 1; p <= 17; p++)
            {
                int t = k10 - p + 1; // escala 10^t
                // q = floor(x / 10^t)
                BigInteger num = N, den = D;
                if (t >= 0) den *= pow10(t); else num *= pow10(-t);
                BigInteger q = BigInteger.DivRem(num, den, out BigInteger rem);
                // c1 = q * 10^t, c2 = (q+1) * 10^t; distancias a x en unidades de 1/den... comparar con los medios huecos
                // dist1 = rem / den * 10^t... trabajamos en la escala "num/den" con los huecos escalados igual
                BigInteger huS = hu, hlS = hl;
                if (t < 0) { huS *= pow10(-t); hlS *= pow10(-t); }
                // En la escala num/den: x - c1 = rem/den * 10^t => comparar rem (escala num) con hl (escala N)*...
                // Para no liarse: pasamos todo a la escala de num/den, donde x = num/den y 10^t = 1 (si t>=0 den ya lleva 10^t)
                // d1 = rem/den, d2 = (den - rem)/den, en unidades de 10^t. Medios huecos en esas unidades: h/D / 10^t.
                // h/D/10^t = h * (den / D / 10^t) / den -> si t>=0: den = D*10^t => h/den ; si t<0: den = D => h*10^-t/den
                bool ok1 = rem < hlS || (even && rem == hlS);
                BigInteger d2 = den - rem;
                bool ok2 = d2 < huS || (even && d2 == huS);
                if (!ok1 && !ok2) continue;
                BigInteger pick;
                if (ok1 && ok2) { int c = rem.CompareTo(d2); pick = c < 0 ? q : c > 0 ? q + 1 : (q.IsEven ? q : q + 1); }
                else pick = ok1 ? q : q + 1;
                string s = pick.ToString(CultureInfo.InvariantCulture);
                int len = s.Length;
                n = t + len;
                digits = s.TrimEnd('0');
                if (digits.Length == 0) digits = "0";
                return;
            }
            throw new InvalidOperationException("shortest: imposible para " + x.ToString("R", CultureInfo.InvariantCulture));
        }
        // compara N/D con 10^k
        static int cmpPow10(BigInteger N, BigInteger D, int k)
        {
            if (k >= 0) return N.CompareTo(D * pow10(k));
            return (N * pow10(-k)).CompareTo(D);
        }

        // ---------- Leer un número ----------
        // Number(texto): espacios alrededor, "" -> 0, hexadecimal 0x, Infinity; lo demás NaN
        public static double fromString(string s)
        {
            s = s.Trim();
            if (s.Length == 0) return 0;
            if (s == "Infinity" || s == "+Infinity") return double.PositiveInfinity;
            if (s == "-Infinity") return double.NegativeInfinity;
            if (s.Length > 2 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X'))
            {
                double v = 0;
                for (int i = 2; i < s.Length; i++) { int d = hex(s[i]); if (d < 0) return double.NaN; v = v * 16 + d; }
                return v;
            }
            return tryParse(s, out double r) ? r : double.NaN;
        }
        static int hex(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1; }

        // Decimal -> el double más cercano (redondeo al par). Acepta [-+]dígitos[.dígitos][e[-+]dígitos] y ".5"
        public static bool tryParse(string s, out double result)
        {
            result = double.NaN;
            int i = 0, len = s.Length;
            bool neg = false;
            if (i < len && (s[i] == '-' || s[i] == '+')) { neg = s[i] == '-'; i++; }
            var digits = new StringBuilder();
            int dot = -1, intDigits = 0;
            bool any = false;
            while (i < len && s[i] >= '0' && s[i] <= '9') { digits.Append(s[i]); i++; intDigits++; any = true; }
            if (i < len && s[i] == '.') { i++; dot = intDigits; while (i < len && s[i] >= '0' && s[i] <= '9') { digits.Append(s[i]); i++; any = true; } }
            if (!any) return false;
            int exp = 0;
            if (i < len && (s[i] == 'e' || s[i] == 'E'))
            {
                i++;
                bool eneg = false;
                if (i < len && (s[i] == '-' || s[i] == '+')) { eneg = s[i] == '-'; i++; }
                if (i >= len || s[i] < '0' || s[i] > '9') return false;
                long ev = 0;
                while (i < len && s[i] >= '0' && s[i] <= '9') { if (ev < 100000) ev = ev * 10 + (s[i] - '0'); i++; }
                exp = (int)(eneg ? -ev : ev);
            }
            if (i != len) return false;
            int fracDigits = dot < 0 ? 0 : digits.Length - dot;
            // Quitar ceros: a la izquierda (no cambian nada) y a la derecha (suben el exponente)
            string d = digits.ToString().TrimStart('0');
            int e10 = exp - fracDigits;
            int trail = 0;
            while (trail < d.Length && d[d.Length - 1 - trail] == '0') trail++;
            d = d.Substring(0, d.Length - trail);
            e10 += trail;
            double r = fromDigits(d, e10);
            result = neg ? -r : r;
            return true;
        }

        static readonly double[] EXACT10 = { 1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22 };

        // valor = d * 10^e10 (d sin ceros a los lados, puede estar vacío = 0)
        static double fromDigits(string d, int e10)
        {
            if (d.Length == 0) return 0;
            // Camino rápido exacto (Clinger): hasta 15 cifras y 10^|e| exacto -> una sola operación, bien redondeada
            if (d.Length <= 15 && e10 >= -22 && e10 <= 22)
            {
                double v = (double)long.Parse(d, CultureInfo.InvariantCulture);
                return e10 >= 0 ? v * EXACT10[e10] : v / EXACT10[-e10];
            }
            if (d.Length + e10 > 310) return double.PositiveInfinity;
            if (d.Length + e10 < -330) return 0;
            BigInteger M = BigInteger.Parse(d, CultureInfo.InvariantCulture);
            BigInteger N, Dn;
            if (e10 >= 0) { N = M * pow10(e10); Dn = 1; } else { N = M; Dn = pow10(-e10); }
            return ratioToDouble(N, Dn);
        }

        // N / Dn (positivos) -> el double más cercano, redondeo al par
        public static double ratioToDouble(BigInteger N, BigInteger Dn)
        {
            // Buscamos e2 tal que q = floor(N / (Dn * 2^e2)) tenga 53 bits (o menos si es subnormal)
            int sh = bitLength(N) - bitLength(Dn) - 53;
            BigInteger q, rem;
            while (true)
            {
                BigInteger num = N, den = Dn;
                if (sh >= 0) den <<= sh; else num <<= -sh;
                q = BigInteger.DivRem(num, den, out rem);
                int bl = bitLength(q);
                if (bl > 53) { sh++; continue; }
                if (bl < 53 && sh > -1074) { sh--; continue; }
                if (sh < -1074) { sh = -1074; continue; }
                // Redondeo: comparar 2*rem con den
                BigInteger twice = rem << 1;
                int c = twice.CompareTo(den);
                if (c > 0 || (c == 0 && !q.IsEven)) q += 1;
                break;
            }
            long mant = (long)q;
            int e2 = sh;
            if (mant == (1L << 53)) { mant >>= 1; e2++; }
            if (mant < (1L << 52)) return BitConverter.Int64BitsToDouble(mant); // subnormal (e2 = -1074)
            int be = e2 + 1075;
            if (be >= 2047) return double.PositiveInfinity;
            return BitConverter.Int64BitsToDouble(((long)be << 52) | (mant & 0xFFFFFFFFFFFFFL));
        }

        // ---------- toFixed ----------
        public static string toFixed(double x, int f)
        {
            if (double.IsNaN(x)) return "NaN";
            if (Math.Abs(x) >= 1e21 || double.IsInfinity(x)) return toString(x);
            string sign = "";
            if (x < 0) { sign = "-"; x = -x; }
            BigInteger nInt;
            if (x == 0) nInt = 0;
            else
            {
                decompose(x, out long m, out int e);
                // n = el entero más cercano a x * 10^f; si hay empate, el mayor
                BigInteger num = new BigInteger(m) * pow10(f), den = 1;
                if (e >= 0) num <<= e; else den <<= -e;
                nInt = BigInteger.Divide((num << 1) + den, den << 1);
            }
            string s = nInt.ToString(CultureInfo.InvariantCulture);
            if (f == 0) return sign + s;
            if (s.Length <= f) s = new string('0', f + 1 - s.Length) + s;
            return sign + s.Substring(0, s.Length - f) + "." + s.Substring(s.Length - f);
        }

        // ---------- toLocaleString('en-US') ----------
        // Con maximumFractionDigits 0 (lo que usa Util.money): redondea al entero (medios lejos del cero, como ICU)
        // y agrupa de tres en tres.
        public static string locale(double x)
        {
            if (double.IsNaN(x)) return "NaN";
            if (double.IsInfinity(x)) return x > 0 ? "∞" : "-∞";
            bool neg = x < 0;
            double a = Math.Abs(x);
            // ICU: medio -> lejos del cero sobre el valor decimal más corto (halfExpand)
            string intDigits;
            if (a < 9007199254740992.0)
            {
                double fl = Math.Floor(a);
                double fr = a - fl;
                // a - fl es exacto. Medio exacto -> hacia arriba
                double r = fr >= 0.5 ? fl + 1 : fl;
                if (fr != 0 && fr != 0.5)
                {
                    // ICU redondea las cifras cortas: comprobar con ellas si queda justo en .5
                    shortest(a, out string dg, out int nn);
                    if (nn >= 0 && nn < dg.Length)
                    {
                        string fracPart = dg.Substring(nn);
                        r = fracPart[0] >= '5' ? fl + 1 : fl;
                    }
                }
                intDigits = ((long)r).ToString(CultureInfo.InvariantCulture);
                if (r == 0) neg = false;
            }
            else
            {
                shortest(a, out string dg, out int nn);
                intDigits = dg + new string('0', Math.Max(0, nn - dg.Length));
            }
            var sb = new StringBuilder();
            int len = intDigits.Length;
            for (int i = 0; i < len; i++)
            {
                if (i > 0 && (len - i) % 3 == 0) sb.Append(',');
                sb.Append(intDigits[i]);
            }
            return (neg ? "-" : "") + sb.ToString();
        }
    }
}
