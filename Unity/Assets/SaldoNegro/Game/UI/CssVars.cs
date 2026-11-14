// Variables CSS (var(--x)) en los valores que USS no resuelve por sí mismo: los de las propiedades propias
// (--sn-text-shadow, --sn-box-shadow...), que llegan como texto. Se buscan primero en los estilos en línea del
// elemento y sus padres (el juego pone --mk, --k... con style.setProperty) y luego en :root de css/style.css
// (Resources/SaldoNegro/CssRules.json, convertido por Unity/Tools~/css2uss.js).
using System;
using System.Collections.Generic;
using System.Text;
using SaldoNegro.Logic;
using UnityEngine;

namespace SaldoNegro
{
    public static class CssVars
    {
        static Dictionary<string, string> root;

        static Dictionary<string, string> Root
        {
            get
            {
                if (root != null) return root;
                root = new Dictionary<string, string>();
                var asset = Resources.Load<TextAsset>("SaldoNegro/CssRules");
                if (asset == null) { Debug.LogError("SALDO NEGRO: falta Resources/SaldoNegro/CssRules.json"); return root; }
                foreach (var r in Json.parse(asset.text))
                    if (r["sel"].str.Trim() == ":root" && r["media"].isNullish)
                        foreach (var d in r["decls"]) if (d[0].str.StartsWith("--")) root[d[0].str] = d[1].str;
                return root;
            }
        }

        static string lookup(string name, DomElement e)
        {
            for (var p = e; p != null; p = p.parentElement) { var v = p.style[name]; if (!string.IsNullOrEmpty(v)) return v; }
            return Root.TryGetValue(name, out var r) ? r : null;
        }

        // Sustituye cada var(--x, respaldo) (también anidadas) por su valor
        public static string resolve(string value, DomElement e)
        {
            if (value == null) return null;
            value = value.Trim().Trim('"', '\'');
            for (int guard = 0; guard < 16 && value.Contains("var("); guard++)
            {
                int i = value.IndexOf("var(", StringComparison.Ordinal);
                int depth = 0, j = i + 4;
                for (; j < value.Length; j++) { if (value[j] == '(') depth++; else if (value[j] == ')') { if (depth == 0) break; depth--; } }
                string inner = value.Substring(i + 4, j - i - 4);
                int comma = inner.IndexOf(',');
                string name = (comma >= 0 ? inner.Substring(0, comma) : inner).Trim();
                string fallback = comma >= 0 ? inner.Substring(comma + 1).Trim() : "";
                string v = lookup(name, e) ?? fallback;
                value = value.Substring(0, i) + v + value.Substring(Math.Min(value.Length, j + 1));
            }
            return value;
        }

        // Parte un valor por un separador que no esté dentro de paréntesis ("1px 0 rgba(0, 0, 0, .5), ...")
        public static List<string> splitTop(string s, char sep)
        {
            var o = new List<string>();
            int depth = 0;
            var cur = new StringBuilder();
            foreach (char ch in s)
            {
                if (ch == '(') depth++;
                if (ch == ')') depth--;
                if (ch == sep && depth == 0) { if (cur.Length > 0) o.Add(cur.ToString()); cur.Clear(); }
                else cur.Append(ch);
            }
            if (cur.Length > 0) o.Add(cur.ToString());
            return o;
        }
    }
}
