// JSON como en JavaScript.
//   parse     -> V (JsObject, JsArray, texto, número, booleano o null); los números se leen como los lee JS.
//   stringify -> el mismo texto que JSON.stringify: claves en el orden de JS, números con las cifras de JS,
//                undefined y funciones fuera (o null dentro de un array), NaN e Infinity como null.
using System;
using System.Globalization;
using System.Text;

namespace SaldoNegro.Logic
{
    public static class Json
    {
        public static V parse(string text)
        {
            if (text == null) throw new FormatException("JSON: texto nulo");
            int i = 0;
            var v = value(text, ref i);
            ws(text, ref i);
            if (i != text.Length) throw err(text, i, "sobra texto");
            return v;
        }

        // Atajos para leer lo que devuelve parse
        public static JsObject obj(V v) { return v.obj; }
        public static JsArray arr(V v) { return v.arr; }
        public static string str(V v) { return v.isString ? (string)v.o : null; }
        public static double num(V v) { return v.num; }
        public static int integer(V v) { return (int)v.num; }

        // Copia profunda (JSON.parse(JSON.stringify(x)) sin pasar por texto, para objetos que ya son JSON)
        public static V clone(V v)
        {
            if (v.o is JsObject o)
            {
                var c = new JsObject();
                foreach (var kv in o) c[kv.Key] = clone(kv.Value);
                return c;
            }
            if (v.o is JsArray a)
            {
                var c = new JsArray(a.length);
                foreach (var x in a) c.Add(clone(x));
                return c;
            }
            return v;
        }

        // ---------- stringify ----------
        public static string stringify(V v, string indent = null)
        {
            var sb = new StringBuilder();
            if (!write(sb, v, indent, "")) return null; // JSON.stringify(undefined) -> undefined
            return sb.ToString();
        }
        public static string stringify(V v, int space) { return stringify(v, space > 0 ? new string(' ', Math.Min(10, space)) : null); }

        static bool write(StringBuilder sb, V v, string indent, string cur)
        {
            if (v.isUndefined || v.isFunction) return false;
            if (v.isNull) { sb.Append("null"); return true; }
            if (v.isBool) { sb.Append(v.truthy ? "true" : "false"); return true; }
            if (v.isNumber) { double d = v.n; sb.Append(double.IsNaN(d) || double.IsInfinity(d) ? "null" : JsNumber.toString(d)); return true; }
            if (v.o is string s) { quote(sb, s); return true; }
            string inner = indent == null ? null : cur + indent;
            if (v.o is JsArray a)
            {
                if (a.length == 0) { sb.Append("[]"); return true; }
                sb.Append('[');
                for (int i = 0; i < a.length; i++)
                {
                    if (i > 0) sb.Append(',');
                    if (inner != null) sb.Append('\n').Append(inner);
                    if (!write(sb, a[i], indent, inner ?? "")) sb.Append("null");
                }
                if (inner != null) sb.Append('\n').Append(cur);
                sb.Append(']');
                return true;
            }
            if (v.o is JsObject o)
            {
                sb.Append('{');
                bool first = true;
                foreach (var kv in o)
                {
                    if (kv.Value.isUndefined || kv.Value.isFunction) continue;
                    if (!first) sb.Append(',');
                    first = false;
                    if (inner != null) sb.Append('\n').Append(inner);
                    quote(sb, kv.Key);
                    sb.Append(inner != null ? ": " : ":");
                    write(sb, kv.Value, indent, inner ?? "");
                }
                if (!first && inner != null) sb.Append('\n').Append(cur);
                sb.Append('}');
                return true;
            }
            // Un objeto de C# que no es JSON: como {} (JS haría lo mismo con un objeto sin propiedades propias)
            sb.Append("{}");
            return true;
        }

        public static void quote(StringBuilder sb, string s)
        {
            sb.Append('"');
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else if (char.IsSurrogate(c))
                        {
                            // Pareja bien formada: tal cual. Sustituto suelto: \udxxx (JSON.stringify bien formado)
                            if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) { sb.Append(c).Append(s[i + 1]); i++; }
                            else sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        // ---------- parse ----------
        static V value(string s, ref int i)
        {
            ws(s, ref i);
            if (i >= s.Length) throw err(s, i, "fin inesperado");
            char c = s[i];
            if (c == '{') return obj(s, ref i);
            if (c == '[') return arr(s, ref i);
            if (c == '"') return str(s, ref i);
            if (c == 't') { lit(s, ref i, "true"); return true; }
            if (c == 'f') { lit(s, ref i, "false"); return false; }
            if (c == 'n') { lit(s, ref i, "null"); return V.@null; }
            if (c == '-' || (c >= '0' && c <= '9')) return num(s, ref i);
            throw err(s, i, "carácter inesperado '" + c + "'");
        }

        static JsObject obj(string s, ref int i)
        {
            var o = new JsObject();
            i++;
            ws(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return o; }
            while (true)
            {
                ws(s, ref i);
                if (i >= s.Length || s[i] != '"') throw err(s, i, "se esperaba una clave");
                string k = str(s, ref i);
                ws(s, ref i);
                if (i >= s.Length || s[i] != ':') throw err(s, i, "se esperaba ':'");
                i++;
                o[k] = value(s, ref i);
                ws(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == '}') { i++; return o; }
                throw err(s, i, "se esperaba ',' o '}'");
            }
        }

        static JsArray arr(string s, ref int i)
        {
            var a = new JsArray();
            i++;
            ws(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return a; }
            while (true)
            {
                a.Add(value(s, ref i));
                ws(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == ']') { i++; return a; }
                throw err(s, i, "se esperaba ',' o ']'");
            }
        }

        static string str(string s, ref int i)
        {
            i++; // comilla de apertura
            int start = i;
            // Camino rápido: sin barras invertidas
            while (i < s.Length && s[i] != '"' && s[i] != '\\') i++;
            if (i < s.Length && s[i] == '"') return s.Substring(start, i++ - start);
            var sb = new StringBuilder(s, start, i - start, Math.Max(16, (i - start) * 2));
            while (true)
            {
                if (i >= s.Length) throw err(s, i, "cadena sin cerrar");
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) throw err(s, i, "cadena sin cerrar");
                c = s[i++];
                switch (c)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw err(s, i, "\\u incompleto");
                        int cp = 0;
                        for (int k = 0; k < 4; k++)
                        {
                            char h = s[i++];
                            int d = h >= '0' && h <= '9' ? h - '0' : h >= 'a' && h <= 'f' ? h - 'a' + 10 : h >= 'A' && h <= 'F' ? h - 'A' + 10 : -1;
                            if (d < 0) throw err(s, i - 1, "\\u con un dígito que no es hexadecimal");
                            cp = cp * 16 + d;
                        }
                        sb.Append((char)cp);
                        break;
                    default: throw err(s, i - 1, "escape desconocido '\\" + c + "'");
                }
            }
        }

        static double num(string s, ref int i)
        {
            int start = i;
            if (s[i] == '-') i++;
            while (i < s.Length && s[i] >= '0' && s[i] <= '9') i++;
            if (i < s.Length && s[i] == '.') { i++; while (i < s.Length && s[i] >= '0' && s[i] <= '9') i++; }
            if (i < s.Length && (s[i] == 'e' || s[i] == 'E'))
            {
                i++;
                if (i < s.Length && (s[i] == '+' || s[i] == '-')) i++;
                while (i < s.Length && s[i] >= '0' && s[i] <= '9') i++;
            }
            if (!JsNumber.tryParse(s.Substring(start, i - start), out double r)) throw err(s, start, "número mal escrito");
            return r;
        }

        static void lit(string s, ref int i, string word)
        {
            if (string.CompareOrdinal(s, i, word, 0, word.Length) != 0) throw err(s, i, "se esperaba " + word);
            i += word.Length;
        }

        static void ws(string s, ref int i)
        {
            while (i < s.Length) { char c = s[i]; if (c == ' ' || c == '\n' || c == '\r' || c == '\t') i++; else break; }
        }

        static FormatException err(string s, int i, string what)
        {
            return new FormatException("JSON: " + what + " en la posición " + i);
        }
    }
}
