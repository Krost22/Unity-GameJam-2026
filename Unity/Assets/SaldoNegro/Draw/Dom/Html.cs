// Lector de HTML para el DOM mínimo (Dom.cs): etiquetas, atributos (con o sin comillas), texto, entidades
// (&amp; &lt; &gt; &quot; &#39; &nbsp; &#N;) y comentarios. Etiquetas vacías: br, img, input, hr. Es lo que
// escribe el juego en sus innerHTML y plantillas; no es un lector de HTML general.
// También el selector CSS que usan querySelector / matches / closest y el motor de reglas de Unity.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace SaldoNegro
{
    public static class Html
    {
        static readonly HashSet<string> VOID = new HashSet<string> { "br", "img", "input", "hr", "meta", "link" };

        public static List<DomNode> parse(string html)
        {
            var root = new DomElement("#fragment");
            var stack = new Stack<DomElement>();
            stack.Push(root);
            int i = 0, n = html.Length;
            var text = new StringBuilder();
            void flush() { if (text.Length > 0) { stack.Peek().appendChild(new DomText(decode(text.ToString()))); text.Clear(); } }
            while (i < n)
            {
                char c = html[i];
                if (c == '<')
                {
                    if (string.CompareOrdinal(html, i, "<!--", 0, 4) == 0) { int e = html.IndexOf("-->", i + 4, StringComparison.Ordinal); flush(); i = e < 0 ? n : e + 3; continue; }
                    if (i + 1 < n && html[i + 1] == '/')
                    {
                        int e = html.IndexOf('>', i);
                        string name = html.Substring(i + 2, (e < 0 ? n : e) - i - 2).Trim().ToLowerInvariant();
                        flush();
                        // cierra hasta la etiqueta con ese nombre (si está abierta)
                        bool open = false;
                        foreach (var s in stack) if (s.tagName == name) { open = true; break; }
                        if (open) while (stack.Count > 1) { var top = stack.Pop(); if (top.tagName == name) break; }
                        i = e < 0 ? n : e + 1;
                        continue;
                    }
                    if (i + 1 < n && (char.IsLetter(html[i + 1])))
                    {
                        flush();
                        int j = i + 1;
                        while (j < n && (char.IsLetterOrDigit(html[j]) || html[j] == '-')) j++;
                        var el = new DomElement(html.Substring(i + 1, j - i - 1));
                        bool selfClose = false;
                        // atributos
                        while (j < n)
                        {
                            while (j < n && char.IsWhiteSpace(html[j])) j++;
                            if (j >= n) break;
                            if (html[j] == '>') { j++; break; }
                            if (html[j] == '/' && j + 1 < n && html[j + 1] == '>') { selfClose = true; j += 2; break; }
                            int a = j;
                            while (j < n && !char.IsWhiteSpace(html[j]) && html[j] != '=' && html[j] != '>' && !(html[j] == '/' && j + 1 < n && html[j + 1] == '>')) j++;
                            string an = html.Substring(a, j - a);
                            string av = "";
                            while (j < n && char.IsWhiteSpace(html[j])) j++;
                            if (j < n && html[j] == '=')
                            {
                                j++;
                                while (j < n && char.IsWhiteSpace(html[j])) j++;
                                if (j < n && (html[j] == '"' || html[j] == '\''))
                                {
                                    char q = html[j];
                                    int e = html.IndexOf(q, j + 1);
                                    if (e < 0) e = n;
                                    av = decode(html.Substring(j + 1, e - j - 1));
                                    j = Math.Min(n, e + 1);
                                }
                                else
                                {
                                    int b = j;
                                    while (j < n && !char.IsWhiteSpace(html[j]) && html[j] != '>') j++;
                                    av = decode(html.Substring(b, j - b));
                                }
                            }
                            if (an.Length > 0) el.setAttribute(an, av);
                        }
                        stack.Peek().appendChild(el);
                        if (!selfClose && !VOID.Contains(el.tagName)) stack.Push(el);
                        i = j;
                        continue;
                    }
                }
                text.Append(c);
                i++;
            }
            flush();
            var list = new List<DomNode>(root.childNodes);
            foreach (var x in list) root.removeChild(x);
            return list;
        }

        public static string decode(string s)
        {
            if (s.IndexOf('&') < 0) return s;
            var sb = new StringBuilder(s.Length);
            for (int i = 0; i < s.Length; i++)
            {
                if (s[i] != '&') { sb.Append(s[i]); continue; }
                int e = s.IndexOf(';', i);
                if (e < 0 || e - i > 10) { sb.Append('&'); continue; }
                string ent = s.Substring(i + 1, e - i - 1);
                string r = null;
                switch (ent)
                {
                    case "amp": r = "&"; break;
                    case "lt": r = "<"; break;
                    case "gt": r = ">"; break;
                    case "quot": r = "\""; break;
                    case "apos": r = "'"; break;
                    case "nbsp": r = " "; break;
                    default:
                        if (ent.StartsWith("#x") && int.TryParse(ent.Substring(2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out int hx)) r = char.ConvertFromUtf32(hx);
                        else if (ent.StartsWith("#") && int.TryParse(ent.Substring(1), out int dec)) r = char.ConvertFromUtf32(dec);
                        break;
                }
                if (r == null) { sb.Append('&'); continue; }
                sb.Append(r); i = e;
            }
            return sb.ToString();
        }

        public static void serialize(DomNode n, StringBuilder sb)
        {
            if (n is DomText t) { foreach (char c in t.textContent) sb.Append(c == '&' ? "&amp;" : c == '<' ? "&lt;" : c == '>' ? "&gt;" : c.ToString()); return; }
            var e = (DomElement)n;
            sb.Append('<').Append(e.tagName);
            if (e.classNames.Count > 0) sb.Append(" class=\"").Append(e.className).Append('"');
            foreach (var kv in e.attributes) sb.Append(' ').Append(kv.Key).Append("=\"").Append(kv.Value.Replace("\"", "&quot;")).Append('"');
            string st = e.style.cssText;
            if (st.Length > 0) sb.Append(" style=\"").Append(st).Append('"');
            sb.Append('>');
            if (VOID.Contains(e.tagName)) return;
            foreach (var c in e.childNodes) serialize(c, sb);
            sb.Append("</").Append(e.tagName).Append('>');
        }
    }

    // Selector CSS (lista separada por comas). Admite: etiqueta, *, #id, .clase, [attr], [attr="v"], :not(...),
    // :first-child, :last-child, :hover, :focus, :disabled, :enabled, y los combinadores descendiente y '>'.
    public sealed class Selector
    {
        sealed class Simple
        {
            public string tag, id;
            public List<string> classes = new List<string>();
            public List<KeyValuePair<string, string>> attrs = new List<KeyValuePair<string, string>>();
            public List<Selector> nots = new List<Selector>();
            public List<string> pseudos = new List<string>();
            public bool matches(DomElement e, DomElement scope)
            {
                if (tag != null && tag != "*" && e.tagName != tag) return false;
                if (id != null && e.id != id) return false;
                foreach (var c in classes) if (!e.classList.contains(c)) return false;
                foreach (var a in attrs) { var v = e.getAttribute(a.Key); if (v == null || (a.Value != null && v != a.Value)) return false; }
                foreach (var nt in nots) if (nt.matches(e, scope)) return false;
                foreach (var p in pseudos)
                {
                    switch (p)
                    {
                        case "first-child": if (e.parentElement == null || e.parentElement.firstElementChild != e) return false; break;
                        case "last-child": if (e.parentElement == null || e.parentElement.lastElementChild != e) return false; break;
                        case "hover": if (!e.hovered) return false; break;
                        case "focus": case "focus-visible": if (!e.focused) return false; break;
                        case "disabled": if (!e.disabled) return false; break;
                        case "enabled": if (e.disabled) return false; break;
                        case "scope": if (e != scope) return false; break;
                        default: return false;
                    }
                }
                return true;
            }
        }
        // Un selector complejo: compuestos de derecha a izquierda con su combinador
        sealed class Complex { public List<Simple> parts = new List<Simple>(); public List<char> combs = new List<char>(); }
        readonly List<Complex> list = new List<Complex>();
        public readonly string source;
        static readonly Dictionary<string, Selector> cache = new Dictionary<string, Selector>();

        Selector(string src) { source = src; }

        public static Selector parse(string sel)
        {
            if (cache.TryGetValue(sel, out var s)) return s;
            s = new Selector(sel);
            foreach (var part in splitTop(sel, ',')) s.list.Add(complex(part.Trim()));
            cache[sel] = s;
            return s;
        }

        public bool matches(DomElement e, DomElement scope)
        {
            foreach (var c in list) if (matchComplex(c, c.parts.Count - 1, e, scope)) return true;
            return false;
        }
        static bool matchComplex(Complex c, int i, DomElement e, DomElement scope)
        {
            if (!c.parts[i].matches(e, scope)) return false;
            if (i == 0) return true;
            char comb = c.combs[i - 1];
            if (comb == '>') return e.parentElement != null && matchComplex(c, i - 1, e.parentElement, scope);
            for (var p = e.parentElement; p != null; p = p.parentElement) if (matchComplex(c, i - 1, p, scope)) return true;
            return false;
        }

        // Especificidad (a, b, c) empaquetada: a*10000 + b*100 + c
        public int specificity(int index = 0)
        {
            int a = 0, b = 0, cc = 0;
            foreach (var p in list[index].parts)
            {
                if (p.id != null) a++;
                b += p.classes.Count + p.attrs.Count + p.pseudos.Count;
                foreach (var nt in p.nots) { int ns = nt.specificity(); a += ns / 10000; b += ns / 100 % 100; cc += ns % 100; }
                if (p.tag != null && p.tag != "*") cc++;
            }
            return a * 10000 + b * 100 + cc;
        }
        public int count { get { return list.Count; } }

        static Complex complex(string s)
        {
            var c = new Complex();
            int i = 0;
            char pending = ' ';
            bool first = true;
            while (i < s.Length)
            {
                while (i < s.Length && s[i] == ' ') i++;
                if (i >= s.Length) break;
                if (s[i] == '>') { pending = '>'; i++; continue; }
                var sp = new Simple();
                int start = i;
                while (i < s.Length && s[i] != ' ' && s[i] != '>')
                {
                    char ch = s[i];
                    if (ch == '#') { i++; sp.id = ident(s, ref i); }
                    else if (ch == '.') { i++; sp.classes.Add(ident(s, ref i)); }
                    else if (ch == '[')
                    {
                        int e = s.IndexOf(']', i);
                        string inner = s.Substring(i + 1, e - i - 1);
                        int eq = inner.IndexOf('=');
                        if (eq < 0) sp.attrs.Add(new KeyValuePair<string, string>(inner.Trim(), null));
                        else sp.attrs.Add(new KeyValuePair<string, string>(inner.Substring(0, eq).Trim(), inner.Substring(eq + 1).Trim().Trim('"', '\'')));
                        i = e + 1;
                    }
                    else if (ch == ':')
                    {
                        i++;
                        if (i < s.Length && s[i] == ':') i++;
                        string p = ident(s, ref i);
                        if (i < s.Length && s[i] == '(')
                        {
                            int depth = 1, j = i + 1;
                            while (j < s.Length && depth > 0) { if (s[j] == '(') depth++; else if (s[j] == ')') depth--; j++; }
                            string arg = s.Substring(i + 1, j - i - 2);
                            if (p == "not") sp.nots.Add(parse(arg)); else sp.pseudos.Add(p + "(" + arg + ")");
                            i = j;
                        }
                        else sp.pseudos.Add(p);
                    }
                    else if (ch == '*') { sp.tag = "*"; i++; }
                    else sp.tag = ident(s, ref i).ToLowerInvariant();
                    if (i == start) throw new FormatException("Selector raro: " + s);
                    start = i;
                }
                if (!first) c.combs.Add(pending);
                c.parts.Add(sp);
                pending = ' ';
                first = false;
            }
            return c;
        }
        static string ident(string s, ref int i)
        {
            int a = i;
            while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] == '-' || s[i] == '_')) i++;
            return s.Substring(a, i - a);
        }
        static List<string> splitTop(string s, char sep)
        {
            var o = new List<string>(); int depth = 0; var cur = new StringBuilder();
            foreach (char ch in s)
            {
                if (ch == '(' || ch == '[') depth++;
                if (ch == ')' || ch == ']') depth--;
                if (ch == sep && depth == 0) { o.Add(cur.ToString()); cur.Clear(); } else cur.Append(ch);
            }
            if (cur.Length > 0) o.Add(cur.ToString());
            return o;
        }
    }
}
