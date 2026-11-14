// Port de js/ui/keywords.js (SN.KW). Palabras clave con color y movimiento. Censo de lo que se marca (y por qué):
//   dinero   (dorado, brillo)      cantidades como $250, ×-cantidades con signo, dinero / dólares / pavos
//   siete    (arcoíris)            cada 7 (también dentro de una cantidad) y la palabra "siete"
//   suerte   (verde, ola)          suerte, afortunado/a, fortuna
//   mejora   (cian, brillo)        lo que te hace más fuerte: Límite, Análisis, Resistencia, Plan B, multiplicador,
//                                  apalancamiento y los multiplicadores escritos (×10, x2...)
//   regalo   (magenta, destello)   lo que se abre o se regala: regalo(s), desbloquear, mercado nuevo, Mercado
//                                  Dorado / Negro, Academia, Tienda, Mejoras y los mercados (Salud, Tecnología,
//                                  Negocios, Minería)
//   peligro  (coral, tiembla)      lo que te puede hundir: deuda(s), plazo(s), embargo, liquidado, liquidación,
//                                  bancarrota, cobrador, intereses
//   acción   (amarillo, late)      los botones que nombra el texto, solo en MAYÚSCULAS: COBRAR, SUBIRÁ, BAJARÁ, ESPERAR
// De paso, el nombre del programa, FUTURO.exe, sale en el idioma secreto (SN.Cipher.brand) y las letras cirílicas
// sueltas se pintan como cifrado.
//   SN.KW.html(texto, opts) -> HTML (escapado) con las palabras envueltas. La interfaz de Unity lo lee igual que
//                              el navegador (SaldoNegro.Game: PxText) para pintar cada trozo con su estilo.
//   opts.terms = false      -> solo dinero, 7 y suerte (para listas como la tienda, donde todo sería clave)
// Las expresiones son las de la web, con las clases de JS escritas a mano: \w de JS es [A-Za-z0-9_] y \d es
// [0-9] (en .NET abarcan cualquier letra o cifra de Unicode).
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace SaldoNegro.Logic
{
    public sealed class KW
    {
        const string W = "A-Za-z0-9_";
        const string D = "0-9";
        const string S = " \\t\\n\\r\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
        static readonly string B = "(?<![" + W + "À-ÿ])", E = "(?![" + W + "À-ÿ])"; // bordes de palabra que entienden los acentos
        static string word(string alts) { return B + "(?:" + alts + ")" + E; }
        // El orden importa: lo más largo y lo más concreto, primero
        static readonly string[][] PARTS = {
            new[] { "brand", "FUTURO\\.exe" },
            new[] { "money", "(?:[+−-][" + S + "]?)?\\$[" + S + "]?[" + D + "](?:[" + D + ".,]*[" + D + "])?[" + S + "]?[KM]?" + E + "|" + word("dinero|dólares|dolares|pavos") },
            new[] { "gift", word("mercados? nuevos?|mercado dorado|mercado negro|regalos?|desbloque(?:a|as|an|ar|ado|ada|ados|adas)|academia|tienda|mejoras|salud|tecnología|tecnologia|negocios|minería|mineria") },
            new[] { "up", word("límite|limite|análisis|analisis|resistencia|plan b|multiplicador(?:es)?|apalancamiento") + "|" + B + "[×x][" + S + "]?[" + D + "]+" + E + "|" + B + "[" + D + "]+[" + S + "]?[×x]" + E },
            new[] { "risk", word("deudas?|plazos?|embargos?|embargad[oa]|liquidad[oa]s?|liquidación|liquidacion|bancarrota|cobrador(?:es)?|intereses") },
            new[] { "act", word("COBRAR|SUBIRÁ|BAJARÁ|ESPERAR") },
            new[] { "seven", word("siete") },
            new[] { "luck", word("suerte|afortunad[oa]s?|fortuna") },
            new[] { "seven1", "7" },
        };
        static readonly HashSet<string> TERMS = new HashSet<string> { "gift", "up", "risk", "act" };
        readonly Dictionary<string, Regex> cache = new Dictionary<string, Regex>();
        static readonly string[] NAMES = { "brand", "money", "gift", "up", "risk", "act", "seven", "luck", "seven1", "cyr" };

        static string GLYPHS()
        {
            var sb = new StringBuilder();
            V cipher = SN.Data != null ? SN.Data["cipher"] : V.undefined;
            if (cipher) foreach (var kv in cipher["alphabet"].obj) sb.Append(kv.Value.str);
            return sb.ToString();
        }

        Regex pattern(bool terms)
        {
            string g = GLYPHS(), key = (terms ? "t" : "b") + g;
            if (!cache.TryGetValue(key, out var re))
            {
                var parts = new List<string>();
                foreach (var p in PARTS) if (terms || !TERMS.Contains(p[0])) parts.Add("(?<" + p[0] + ">" + p[1] + ")");
                if (g.Length > 0) parts.Add("(?<cyr>[" + Regex.Escape(g).Replace("]", "\\]") + "]+)");
                cache[key] = re = new Regex(string.Join("|", parts), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            }
            return re;
        }

        static string esc(string t)
        {
            var sb = new StringBuilder(t.Length);
            foreach (char c in t)
            {
                if (c == '&') sb.Append("&amp;");
                else if (c == '<') sb.Append("&lt;");
                else if (c == '>') sb.Append("&gt;");
                else if (c == '"') sb.Append("&quot;");
                else sb.Append(c);
            }
            return sb.ToString();
        }
        // Cada letra en su <i> con su retraso: así el arcoíris y la ola van letra a letra
        static string letters(string t, int from = 0)
        {
            var sb = new StringBuilder();
            int i = 0;
            foreach (var ch in JsString.codePoints(t))
            {
                if (ch == " ") sb.Append(' ');
                else sb.Append("<i style=\"--i:").Append(from + i).Append("\">").Append(esc(ch)).Append("</i>");
                i++;
            }
            return sb.ToString();
        }
        static string sevens(string t) { return esc(t).Replace("7", "<span class=\"kw-7 in\"><i style=\"--i:0\">7</i></span>"); }

        static bool termsOf(V opts) { return opts is null || opts.isNullish || opts["terms"] != false; }

        public string html(V text, V opts = null)
        {
            Regex re = pattern(termsOf(opts));
            var @out = new StringBuilder();
            string s = text.str;
            int last = 0;
            foreach (Match m in re.Matches(s))
            {
                string t = m.Value;
                string k = null;
                foreach (var n in NAMES) { var grp = m.Groups[n]; if (grp.Success) { k = n; break; } }
                @out.Append(esc(s.Substring(last, m.Index - last)));
                if (k == "brand") @out.Append(SN.Cipher != null ? SN.Cipher.brand(t.EndsWith("EXE")) : esc(t));
                else if (k == "money") @out.Append("<span class=\"kw kw-gold\">").Append(sevens(t)).Append("</span>");
                else if (k == "gift") @out.Append("<span class=\"kw kw-gift\">").Append(letters(t)).Append("</span>");
                else if (k == "up") @out.Append("<span class=\"kw kw-up\">").Append(t.IndexOf('7') >= 0 ? sevens(t) : letters(t)).Append("</span>");
                else if (k == "risk") @out.Append("<span class=\"kw kw-risk\">").Append(letters(t)).Append("</span>");
                // Las acciones solo cuentan escritas como el botón (en mayúsculas)
                else if (k == "act") @out.Append(t == JsString.upper(t) ? "<span class=\"kw kw-act\">" + letters(t) + "</span>" : esc(t));
                else if (k == "seven" || k == "seven1") @out.Append("<span class=\"kw kw-7\">").Append(letters(t)).Append("</span>");
                else if (k == "luck") @out.Append("<span class=\"kw kw-luck\">").Append(letters(t)).Append("</span>");
                else if (k == "cyr") @out.Append("<span class=\"cx\">").Append(esc(t)).Append("</span>");
                last = m.Index + t.Length;
            }
            return @out.Append(esc(s.Substring(last))).ToString();
        }
        // ¿Hay algo que pintar en este texto?
        public bool has(V text, V opts = null) { return pattern(termsOf(opts)).IsMatch(text.str); }
    }
}
