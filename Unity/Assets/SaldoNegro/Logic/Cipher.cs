// Port de js/systems/cipher.js. CipherManager: el idioma secreto. Traduce los textos según las letras que ya
// conoces y registra las pistas encontradas. Lo descubierto es de la PARTIDA: una partida nueva empieza sin
// ninguna letra (volver a un punto de control no las quita: lo encontrado, encontrado está).
// No toca la interfaz: avisa con 'cipher:found' y la interfaz hace el ruido (js/ui/ui.js).
using System;
using System.Text;
using System.Text.RegularExpressions;

namespace SaldoNegro.Logic
{
    public sealed class Cipher
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }
        static V A { get { return D["cipher"]["alphabet"]; } }

        // Mayúsculas y sin tildes (la Ñ queda en N): así cuenta para el cifrado
        // (String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase())
        public static string norm(V t)
        {
            string s = t.str.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(s.Length);
            foreach (char c in s) if (c < '̀' || c > 'ͯ') sb.Append(c);
            return JsString.upper(sb.ToString());
        }
        static string esc(string c) { return c == "&" ? "&amp;" : c == "<" ? "&lt;" : c == ">" ? "&gt;" : c == "\"" ? "&quot;" : c; }

        public V state()
        {
            V run = S.run;
            if (!run) return V.Obj("known", new JsObject(), "found", new JsObject());
            if (!run["cipher"])
            {
                // Partidas guardadas cuando las letras iban en el perfil: pasan a la partida (y el perfil las olvida)
                run["cipher"] = S.profile["cipher"] || V.Obj("known", new JsObject(), "found", new JsObject());
                S.profile.delete("cipher");
            }
            return run["cipher"];
        }
        public bool knows(V letter) { return !!state()["known"][letter]; }
        public int count() { return state()["known"].obj.Count; }
        public int total() { return A.obj.Count; }
        public bool complete() { return count() >= total(); }
        public bool found(V clueId) { return !!state()["found"][clueId]; }
        public V clue(V id) { return D["cipher"]["clues"].arr.find((c) => c["id"] == id); }

        // Letras del texto que forman parte del cifrado (para comprobar que todas tienen pista)
        public JsArray letters(V text)
        {
            var a = new JsArray();
            foreach (var ch in JsString.codePoints(norm(text))) if (ch.Length == 1 && ch[0] >= 'A' && ch[0] <= 'Z') a.push(ch);
            return a;
        }

        // Texto como se ve ahora, sin HTML: lo conocido en latín, lo demás en cirílico
        public string text(V t)
        {
            var sb = new StringBuilder();
            foreach (var ch in JsString.codePoints(norm(t)))
            {
                V g = A[ch];
                sb.Append(g && !knows(ch) ? g.str : ch);
            }
            return sb.ToString();
        }

        // HTML: cada letra en su <span> (cx = sin descifrar, cx-k = descifrada; cx-new = la que acabas de encontrar)
        public string html(V t, V fresh = null)
        {
            fresh = fresh ?? V.undefined;
            var sb = new StringBuilder();
            foreach (var ch in JsString.codePoints(norm(t)))
            {
                V g = A[ch];
                if (!g) { sb.Append(esc(ch)); continue; }
                if (knows(ch)) sb.Append("<span class=\"cx-k" + (fresh == ch ? " cx-new" : "") + "\">" + ch + "</span>");
                else sb.Append("<span class=\"cx\">" + g.str + "</span>");
            }
            return sb.ToString();
        }

        // El nombre del programa en el idioma secreto: FUTURO.exe (lo que ya conoces, en latín).
        // brand() para HTML, brandText() para lienzos y textos que se escriben letra a letra.
        public string brand(bool upper = false) { return "<span class=\"cx-brand\">" + html("FUTURO") + "</span>" + (upper ? ".EXE" : ".exe"); }
        public string brandText(bool upper = false) { return text("FUTURO") + (upper ? ".EXE" : ".exe"); }
        // Cambia FUTURO.exe por su versión cifrada en un texto plano
        static readonly Regex BRAND = new Regex(@"FUTURO\.(exe|EXE)", RegexOptions.CultureInvariant);
        public string brandify(V t) { return BRAND.Replace(t.str, (m) => brandText(m.Groups[1].Value == "EXE")); }

        // Encuentra la pista: su letra queda descifrada para siempre. Devuelve la pista si es nueva.
        public V discover(V clueId)
        {
            if (!S.run) return V.@null;
            V st = state(), clue = this.clue(clueId);
            if (!clue || st["found"][clueId]) return V.@null;
            st["found"][clueId] = true;
            bool isNew = !st["known"][clue["letter"]];
            st["known"][clue["letter"]] = true;
            if (SN.Save != null) SN.Save.saveRun();
            SN.Events.emit("cipher:found", V.Obj("clue", clue, "letter", clue["letter"], "glyph", A[clue["letter"]], "isNew", isNew, "count", count(), "total", total()));
            return clue;
        }

        // Comodín (la ruleta de la suerte): una letra que todavía no conoces
        public V wildcard(RNG rng = null)
        {
            JsArray missing = D["cipher"]["clues"].arr.filter((c) => !knows(c["letter"]) && !found(c["id"]));
            if (missing.length == 0) return V.@null;
            double r = rng != null ? rng.next() : JsMath.rnd();
            return discover(missing[(int)Math.Floor(r * missing.length)]["id"]);
        }
    }
}
