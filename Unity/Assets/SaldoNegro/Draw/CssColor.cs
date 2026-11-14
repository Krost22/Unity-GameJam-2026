// Colores escritos como en CSS / canvas ('#FFD34E', '#fff', 'rgba(0, 0, 0, .35)'...), que es como los usa el
// juego en fillStyle. El alfa se guarda con decimales: el navegador solo lo pasa a 8 bits al pintar.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace SaldoNegro
{
    public struct Rgba
    {
        public byte r, g, b;
        public double a; // 0..1
        public Rgba(byte r, byte g, byte b, double a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; }
    }

    public static class CssColor
    {
        static readonly Dictionary<string, Rgba> cache = new Dictionary<string, Rgba>();

        public static Rgba parse(string css)
        {
            if (css == null) throw new ArgumentNullException(nameof(css));
            if (cache.TryGetValue(css, out var hit)) return hit;
            var c = parseUncached(css.Trim());
            if (cache.Count < 4096) cache[css] = c;
            return c;
        }

        static Rgba parseUncached(string s)
        {
            if (s.Length > 0 && s[0] == '#')
            {
                int n = s.Length - 1;
                if (n == 3 || n == 4)
                {
                    int r = hex(s[1]), g = hex(s[2]), b = hex(s[3]), a = n == 4 ? hex(s[4]) : 15;
                    return new Rgba((byte)(r * 17), (byte)(g * 17), (byte)(b * 17), a * 17 / 255.0);
                }
                if (n == 6 || n == 8)
                {
                    int a = n == 8 ? hex(s[7]) * 16 + hex(s[8]) : 255;
                    return new Rgba((byte)(hex(s[1]) * 16 + hex(s[2])), (byte)(hex(s[3]) * 16 + hex(s[4])), (byte)(hex(s[5]) * 16 + hex(s[6])), a / 255.0);
                }
            }
            else if (s.StartsWith("rgb", StringComparison.OrdinalIgnoreCase))
            {
                int open = s.IndexOf('('), close = s.LastIndexOf(')');
                if (open > 0 && close > open)
                {
                    var parts = s.Substring(open + 1, close - open - 1).Split(new[] { ',', ' ', '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 3 || parts.Length == 4)
                    {
                        double a = parts.Length == 4 ? clamp01(number(parts[3])) : 1;
                        return new Rgba(channel(parts[0]), channel(parts[1]), channel(parts[2]), a);
                    }
                }
            }
            else if (s.StartsWith("hsl", StringComparison.OrdinalIgnoreCase))
            {
                int open = s.IndexOf('('), close = s.LastIndexOf(')');
                if (open > 0 && close > open)
                {
                    var parts = s.Substring(open + 1, close - open - 1).Split(new[] { ',', ' ', '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length == 3 || parts.Length == 4)
                    {
                        string hs = parts[0].EndsWith("deg", StringComparison.OrdinalIgnoreCase) ? parts[0].Substring(0, parts[0].Length - 3) : parts[0];
                        double h = double.Parse(hs, NumberStyles.Float, CultureInfo.InvariantCulture);
                        double a = parts.Length == 4 ? clamp01(number(parts[3])) : 1;
                        return hsl(h, clamp01(number(parts[1])), clamp01(number(parts[2])), a);
                    }
                }
            }
            else
            {
                switch (s.ToLowerInvariant())
                {
                    case "transparent": return new Rgba(0, 0, 0, 0);
                    case "black": return new Rgba(0, 0, 0);
                    case "white": return new Rgba(255, 255, 255);
                }
            }
            // Que falle a la vista: un color que el port no entiende no debe pintarse "más o menos"
            throw new FormatException("Color CSS que el port todavía no entiende: '" + s + "'");
        }

        // hsl() como Chrome: la fórmula de CSS Color 4 en float32 y cada canal a 8 bits con round(v * 255).
        // (Calibrado contra Chrome con 14 896 colores: los del teclado RGB de la mesa y un barrido al azar.)
        static double f32(double x) { return (float)x; }
        static Rgba hsl(double hue, double sat, double lig, double a)
        {
            hue %= 360; if (hue < 0) hue += 360;
            double h = f32(hue), s = f32(sat), l = f32(lig);
            double amp = f32(s * Math.Min(l, f32(1 - l)));
            byte ch(double n)
            {
                double k = f32(f32(n + f32(h / 30)) % 12);
                double v = f32(l - f32(amp * Math.Max(-1, Math.Min(Math.Min(f32(k - 3), f32(9 - k)), 1))));
                return (byte)Math.Max(0, Math.Min(255, Logic.JsMath.round(f32(v * 255))));
            }
            return new Rgba(ch(0), ch(8), ch(4), a);
        }

        static int hex(char c)
        {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            throw new FormatException("Dígito hexadecimal no válido: '" + c + "'");
        }
        static double number(string t)
        {
            bool pct = t.EndsWith("%");
            double v = double.Parse(pct ? t.Substring(0, t.Length - 1) : t, NumberStyles.Float, CultureInfo.InvariantCulture);
            return pct ? v / 100 : v;
        }
        static byte channel(string t)
        {
            double v = t.EndsWith("%") ? number(t) * 255 : number(t);
            return (byte)Math.Max(0, Math.Min(255, Logic.JsMath.round(v)));
        }
        static double clamp01(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    }
}
