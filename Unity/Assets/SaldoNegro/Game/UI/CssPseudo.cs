// ::before y ::after de css/style.css para el reflejo del DOM. USS las tiene como hijos generados (.sn-before /
// .sn-after, ver Unity/Tools~/css2uss.js); aquí se sabe qué elementos las llevan y con qué texto (content).
// Las reglas salen de Resources/SaldoNegro/CssRules.json y casan con el selector de Draw/Dom (sin el pseudo).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using UnityEngine;

namespace SaldoNegro
{
    public static class CssPseudo
    {
        struct Rule { public Selector sel; public bool before; public string content; }
        static List<Rule> rules;

        static List<Rule> Rules
        {
            get
            {
                if (rules != null) return rules;
                rules = new List<Rule>();
                var asset = Resources.Load<TextAsset>("SaldoNegro/CssRules");
                if (asset == null) return rules;
                foreach (var r in Json.parse(asset.text))
                {
                    if (!r["media"].isNullish) continue;
                    string sel = r["sel"].str;
                    bool bf = sel.Contains("::before") || sel.Contains(":before");
                    bool af = sel.Contains("::after") || sel.Contains(":after");
                    if (!bf && !af) continue;
                    string content = null;
                    foreach (var d in r["decls"]) if (d[0].str == "content") content = d[1].str;
                    if (content == null) continue;
                    string baseSel = sel.Replace("::before", "").Replace("::after", "").Replace(":before", "").Replace(":after", "").Trim();
                    try { rules.Add(new Rule { sel = Selector.parse(baseSel), before = bf, content = content }); }
                    catch (Exception) { /* selector que el juego no usa: se ignora */ }
                }
                return rules;
            }
        }

        // ¿Alguna regla de la hoja (sin @media) da a e esta propiedad? (para el tamaño propio de los <canvas>)
        static List<(Selector sel, HashSet<string> props)> sized;
        public static bool ruleSets(DomElement e, string prop)
        {
            if (sized == null)
            {
                sized = new List<(Selector, HashSet<string>)>();
                var asset = Resources.Load<TextAsset>("SaldoNegro/CssRules");
                if (asset != null)
                    foreach (var r in Json.parse(asset.text))
                    {
                        if (!r["media"].isNullish) continue;
                        string sel = r["sel"].str;
                        if (sel.Contains(":before") || sel.Contains(":after")) continue;
                        var props = new HashSet<string>();
                        foreach (var d in r["decls"]) props.Add(d[0].str);
                        if (!props.Contains("width") && !props.Contains("height") && !props.Contains("inset")) continue;
                        try { sized.Add((Selector.parse(sel), props)); }
                        catch (Exception) { /* selector que el juego no usa */ }
                    }
            }
            foreach (var r in sized) if ((r.props.Contains(prop) || r.props.Contains("inset")) && r.sel.matches(e, e)) return true;
            return false;
        }

        // Texto del pseudo-elemento de e ("before" o "after"), sin comillas; null si no lo tiene
        public static string content(DomElement e, string which)
        {
            bool before = which == "before";
            string found = null;
            foreach (var r in Rules)
            {
                if (r.before != before) continue;
                if (r.sel.matches(e, e)) found = r.content;
            }
            if (found == null) return null;
            found = found.Trim();
            if (found == "none" || found == "normal") return null;
            if (found.Length >= 2 && (found[0] == '\'' || found[0] == '"') && found[found.Length - 1] == found[0])
                found = found.Substring(1, found.Length - 2);
            return found;
        }
    }
}
