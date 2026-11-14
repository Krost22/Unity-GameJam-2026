// Las fuentes pixel del juego (SaldoPixel y SaldoNum) como rejillas de píxeles.
// Los glifos salen de los TTF de la web con Unity/Tools~/export-fonts.js (Resources/SaldoNegro/Fonts.json):
// no se dibujan de nuevo ni se rasterizan con el motor de texto de Unity, que no da los mismos píxeles.
// Rejilla de 12 filas: la fila 0 es la más alta (10 px sobre la línea base) y las filas 10 y 11 quedan
// por debajo de la línea base. Con font-size 8px, un píxel de glifo es un píxel; con 16px, dos; etc.
using System.Collections.Generic;
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class PxFont
    {
        public const int ROWS = 12;      // filas de la rejilla
        public const int ASCENT = 10;    // filas sobre la línea base

        public struct Glyph
        {
            public int adv;      // avance, en píxeles de glifo
            public int[] rows;   // una máscara por fila: el bit c es la columna c
        }

        public readonly string name;
        Glyph[] glyphs;
        readonly Dictionary<int, int> cmap = new Dictionary<int, int>();

        // Caracteres pedidos que la fuente no tiene (para avisar en desarrollo)
        public static readonly HashSet<int> missing = new HashSet<int>();

        static PxFont pixel, num;
        public static PxFont SaldoPixel { get { if (pixel == null) loadFromResources(); return pixel; } }
        public static PxFont SaldoNum { get { if (num == null) loadFromResources(); return num; } }

        PxFont(string name, V f)
        {
            this.name = name;
            var gl = f["glyphs"].arr;
            glyphs = new Glyph[gl.length];
            for (int i = 0; i < gl.length; i++)
            {
                var g = gl[i];
                var rows = g["rows"];
                var r = new int[ROWS];
                for (int k = 0; k < ROWS; k++) r[k] = rows[k].i;
                glyphs[i] = new Glyph { adv = g["adv"].i, rows = r };
            }
            foreach (var kv in f["cmap"].obj) cmap[int.Parse(kv.Key)] = kv.Value.i;
            if (name == "SaldoPixel") glyphs = addExtra(glyphs, cmap);
        }

        // Los 13 caracteres que usa el juego y la fuente de la web no trae (« » − º ª © à ∞ ⏎ ⌨ ░ ▒ ▓). En el
        // navegador salen con una fuente del sistema, distinta en cada ordenador; aquí se dibujan en la rejilla
        // de SaldoPixel con su estilo (mayúsculas de la fila 3 a la 9, minúsculas de la 5 a la 9). Solo en Unity.
        static readonly (int cp, int adv, string[] rows)[] EXTRA =
        {
            (0x00AB, 6, new[] { "", "", "", "", "", "..#.#", ".#.#.", "#.#..", ".#.#.", "..#.#", "", "" }),            // «
            (0x00BB, 6, new[] { "", "", "", "", "", "#.#..", ".#.#.", "..#.#", ".#.#.", "#.#..", "", "" }),            // »
            (0x2212, 6, new[] { "", "", "", "", "", "", "#####", "", "", "", "", "" }),                                // −
            (0x00BA, 4, new[] { "", "", "", ".#.", "#.#", ".#.", "", "###", "", "", "", "" }),                          // º
            (0x00AA, 4, new[] { "", "", "", ".##", "#.#", ".##", "", "###", "", "", "", "" }),                          // ª
            (0x00A9, 8, new[] { "", "", "", ".#####.", "#.....#", "#..##.#", "#.#...#", "#..##.#", "#.....#", ".#####.", "", "" }), // ©
            (0x00E0, 6, new[] { "", "", "", ".#...", "..#..", ".###.", "....#", ".####", "#...#", ".####", "", "" }),   // à
            (0x221E, 8, new[] { "", "", "", "", "", "", ".##.##.", "#..#..#", ".##.##.", "", "", "" }),                // ∞
            (0x23CE, 7, new[] { "", "", "", ".....#", ".....#", "..#..#", ".##..#", "######", ".##...", "..#...", "", "" }), // ⏎
            (0x2328, 10, new[] { "", "", "", "", "#########", "#.#.#.#.#", "#########", "#.#####.#", "#########", "", "", "" }), // ⌨
            (0x2591, 6, new[] { "#...#.", "......", "..#...", "......", "#...#.", "......", "..#...", "......", "#...#.", "......", "..#...", "......" }), // ░
            (0x2592, 6, new[] { "#.#.#.", ".#.#.#", "#.#.#.", ".#.#.#", "#.#.#.", ".#.#.#", "#.#.#.", ".#.#.#", "#.#.#.", ".#.#.#", "#.#.#.", ".#.#.#" }), // ▒
            (0x2593, 6, new[] { ".###.#", "######", "##.###", "######", ".###.#", "######", "##.###", "######", ".###.#", "######", "##.###", "######" }), // ▓
        };

        static Glyph[] addExtra(Glyph[] gl, Dictionary<int, int> map)
        {
            var list = new List<Glyph>(gl);
            foreach (var (cp, adv, rows) in EXTRA)
            {
                if (map.ContainsKey(cp)) continue;
                var r = new int[ROWS];
                for (int k = 0; k < ROWS; k++) for (int c = 0; c < rows[k].Length; c++) if (rows[k][c] == '#') r[k] |= 1 << c;
                map[cp] = list.Count;
                list.Add(new Glyph { adv = adv, rows = r });
            }
            return list.ToArray();
        }

        public static void load(string json)
        {
            var fonts = Json.parse(json)["fonts"];
            pixel = new PxFont("SaldoPixel", fonts["SaldoPixel"]);
            num = new PxFont("SaldoNum", fonts["SaldoNum"]);
        }

        // De dónde sale Fonts.json (la capa del juego lo lee de Resources; las pruebas, del disco)
        public static Func<string> source;
        static void loadFromResources()
        {
            if (source == null) throw new InvalidOperationException("PxFont.source sin poner: nadie ha dicho de dónde leer Fonts.json");
            load(source());
        }

        public bool has(int codePoint) { return cmap.ContainsKey(codePoint); }

        // El glifo de un carácter. Si la fuente no lo tiene, el recuadro hueco (.notdef) y se apunta en `missing`.
        public Glyph glyph(int codePoint)
        {
            if (cmap.TryGetValue(codePoint, out int g)) return glyphs[g];
            missing.Add(codePoint);
            return glyphs[0];
        }

        // Ancho de un texto en píxeles de glifo (a tamaño 8)
        public int width(string text)
        {
            int w = 0;
            for (int i = 0; i < text.Length; i++) w += glyph(codePointAt(text, ref i)).adv;
            return w;
        }

        // El carácter (punto de código) en la posición i; salta el segundo medio de un par suplente
        public static int codePointAt(string s, ref int i)
        {
            char c = s[i];
            if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) return char.ConvertToUtf32(c, s[++i]);
            return c;
        }
    }
}
