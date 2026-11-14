// Un DOM mínimo en C# puro: lo justo que usa la interfaz de la web (js/ui, js/core/game.js...) para que su código
// se porte casi línea a línea: árbol de elementos, clases, atributos y data-*, textContent / innerHTML (con un
// lector de HTML), querySelector con los selectores que usa el juego, y eventos con burbujeo.
// No dibuja nada: la capa de Unity (SaldoNegro.App) refleja este árbol en VisualElements de UI Toolkit, con las
// mismas clases, y la hoja de estilos convertida de css/style.css (UI/Game.uss) les da su aspecto.
// Cada cambio sube `Dom.version` y marca el elemento (dirty): el reflejo solo toca lo que cambió.
using System;
using System.Collections.Generic;
using System.Text;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public abstract class DomNode
    {
        public DomElement parentElement { get; internal set; }
        public abstract string textContent { get; set; }
        public void remove() { parentElement?.removeChild(this); }
        public DomNode nextSibling { get { var p = parentElement; if (p == null) return null; int i = p.childNodes.IndexOf(this); return i + 1 < p.childNodes.Count ? p.childNodes[i + 1] : null; } }
        public DomNode previousSibling { get { var p = parentElement; if (p == null) return null; int i = p.childNodes.IndexOf(this); return i > 0 ? p.childNodes[i - 1] : null; } }
        public void replaceWith(params DomNode[] nodes)
        {
            var p = parentElement;
            if (p == null) return;
            int i = p.childNodes.IndexOf(this);
            p.removeChild(this);
            foreach (var n in nodes) p.insertAt(i++, n);
        }
        internal void touch() { Dom.version++; for (var e = this as DomElement ?? parentElement; e != null; e = e.parentElement) { if (e.dirty) break; e.dirty = true; } }
    }

    public sealed class DomText : DomNode
    {
        string data;
        public DomText(string t) { data = t ?? ""; }
        public override string textContent { get { return data; } set { data = value ?? ""; touch(); } }
        public string nodeValue { get { return data; } set { textContent = value; } }
    }

    public sealed partial class DomEvent
    {
        public readonly string type;
        public DomElement target, currentTarget;
        public bool defaultPrevented, propagationStopped;
        public string code = "", key = "";       // teclado
        public double clientX, clientY;          // puntero (píxeles del escenario)
        public int button;
        public bool repeat, shiftKey, ctrlKey, altKey, metaKey;
        public DomEvent(string type) { this.type = type; }
        public void preventDefault() { defaultPrevented = true; }
        public void stopPropagation() { propagationStopped = true; }
    }

    public sealed partial class DomElement : DomNode
    {
        public readonly string tagName;           // en minúsculas (JS da mayúsculas: no se usa)
        public readonly List<DomNode> childNodes = new List<DomNode>();
        readonly List<string> classes = new List<string>();
        readonly List<KeyValuePair<string, string>> attrs = new List<KeyValuePair<string, string>>();
        public readonly DomStyle style;
        public readonly DomClassList classList;
        public readonly DomDataset dataset;
        internal bool dirty = true;
        public object view;                       // lo que lo pinta (el VisualElement del reflejo)
        // Estado que pone el reflejo (para :hover y :focus en los selectores)
        public bool hovered, focused;
        public bool disabled { get { return hasAttribute("disabled"); } set { if (value) setAttribute("disabled", ""); else removeAttribute("disabled"); } }
        public bool hidden { get { return classList.contains("hidden"); } }

        public DomElement(string tag)
        {
            tagName = tag.ToLowerInvariant();
            style = new DomStyle(this);
            classList = new DomClassList(this);
            dataset = new DomDataset(this);
        }

        // ---------- Atributos ----------
        public string id { get { return getAttribute("id") ?? ""; } set { setAttribute("id", value); } }
        public string className
        {
            get { return string.Join(" ", classes); }
            set { classes.Clear(); foreach (var c in (value ?? "").Split(new[] { ' ', '\t', '\n' }, StringSplitOptions.RemoveEmptyEntries)) if (!classes.Contains(c)) classes.Add(c); touch(); }
        }
        public IReadOnlyList<string> classNames { get { return classes; } }
        public string title { get { return getAttribute("title") ?? ""; } set { setAttribute("title", value); } }
        public string getAttribute(string name)
        {
            if (name == "class") return classes.Count > 0 ? className : null;
            if (name == "style") return style.cssText;
            foreach (var kv in attrs) if (kv.Key == name) return kv.Value;
            return null;
        }
        public bool hasAttribute(string name) { return getAttribute(name) != null; }
        public void setAttribute(string name, string value)
        {
            name = name.ToLowerInvariant();
            if (name == "class") { className = value; return; }
            if (name == "style") { style.cssText = value; return; }
            for (int i = 0; i < attrs.Count; i++) if (attrs[i].Key == name) { attrs[i] = new KeyValuePair<string, string>(name, value ?? ""); touch(); return; }
            attrs.Add(new KeyValuePair<string, string>(name, value ?? ""));
            touch();
        }
        public void removeAttribute(string name)
        {
            for (int i = 0; i < attrs.Count; i++) if (attrs[i].Key == name) { attrs.RemoveAt(i); touch(); return; }
        }
        public IEnumerable<KeyValuePair<string, string>> attributes { get { return attrs; } }
        internal List<string> classStore { get { return classes; } }

        // ---------- Árbol ----------
        public IEnumerable<DomElement> children { get { foreach (var n in childNodes) if (n is DomElement e) yield return e; } }
        public List<DomElement> childList() { var l = new List<DomElement>(); foreach (var e in children) l.Add(e); return l; }
        public DomNode firstChild { get { return childNodes.Count > 0 ? childNodes[0] : null; } }
        public DomNode lastChild { get { return childNodes.Count > 0 ? childNodes[childNodes.Count - 1] : null; } }
        public DomElement nextElementSibling { get { var p = parentElement; if (p == null) return null; bool seen = false; foreach (var e in p.children) { if (seen) return e; if (e == this) seen = true; } return null; } }
        public DomElement previousElementSibling { get { var p = parentElement; if (p == null) return null; DomElement prev = null; foreach (var e in p.children) { if (e == this) return prev; prev = e; } return null; } }
        public DomElement firstElementChild { get { foreach (var e in children) return e; return null; } }
        public DomElement lastElementChild { get { DomElement r = null; foreach (var e in children) r = e; return r; } }
        public T appendChild<T>(T n) where T : DomNode { insertAt(childNodes.Count, n); return n; }
        public void append(params DomNode[] ns) { foreach (var n in ns) appendChild(n); }
        public void append(string text) { appendChild(new DomText(text)); }
        public void prepend(params DomNode[] ns) { for (int i = ns.Length - 1; i >= 0; i--) insertAt(0, ns[i]); }
        public DomNode insertBefore(DomNode n, DomNode before)
        {
            int i = before == null ? childNodes.Count : childNodes.IndexOf(before);
            if (i < 0) i = childNodes.Count;
            insertAt(i, n);
            return n;
        }
        internal void insertAt(int i, DomNode n)
        {
            if (n.parentElement != null) { var op = n.parentElement; int j = op.childNodes.IndexOf(n); if (op == this && j < i) i--; op.removeChild(n); }
            if (i > childNodes.Count) i = childNodes.Count;
            childNodes.Insert(i, n);
            n.parentElement = this;
            n.touch(); touch();
        }
        public void removeChild(DomNode n)
        {
            if (childNodes.Remove(n)) { n.parentElement = null; touch(); }
        }
        public bool contains(DomNode n) { for (var p = n; p != null; p = p.parentElement) if (p == this) return true; return false; }

        // ---------- Texto y HTML ----------
        public override string textContent
        {
            get { var sb = new StringBuilder(); collect(this, sb); return sb.ToString(); }
            set { clearChildren(); if (!string.IsNullOrEmpty(value)) appendChild(new DomText(value)); touch(); }
        }
        static void collect(DomNode n, StringBuilder sb)
        {
            if (n is DomText t) { sb.Append(t.textContent); return; }
            foreach (var c in ((DomElement)n).childNodes) collect(c, sb);
        }
        public string innerText { get { return textContent; } set { textContent = value; } }
        public string innerHTML
        {
            get { var sb = new StringBuilder(); foreach (var c in childNodes) Html.serialize(c, sb); return sb.ToString(); }
            set { clearChildren(); foreach (var n in Html.parse(value ?? "")) appendChild(n); touch(); }
        }
        public string outerHTML { get { var sb = new StringBuilder(); Html.serialize(this, sb); return sb.ToString(); } }
        // insertAdjacentHTML('beforeend' | 'afterbegin' | 'beforebegin' | 'afterend', html)
        public void insertAdjacentHTML(string where, string html)
        {
            var nodes = Html.parse(html ?? "");
            switch (where)
            {
                case "beforeend": foreach (var n in nodes) appendChild(n); break;
                case "afterbegin": prepend(nodes.ToArray()); break;
                case "beforebegin": { var p = parentElement; int i = p.childNodes.IndexOf(this); foreach (var n in nodes) p.insertAt(i++, n); break; }
                case "afterend": { var p = parentElement; int i = p.childNodes.IndexOf(this) + 1; foreach (var n in nodes) p.insertAt(i++, n); break; }
                default: throw new ArgumentException("insertAdjacentHTML: " + where);
            }
        }
        void clearChildren() { foreach (var c in childNodes) c.parentElement = null; childNodes.Clear(); }

        // ---------- Selectores ----------
        public DomElement querySelector(string sel) { var s = Selector.parse(sel); foreach (var e in descendants()) if (s.matches(e, this)) return e; return null; }
        public List<DomElement> querySelectorAll(string sel) { var s = Selector.parse(sel); var l = new List<DomElement>(); foreach (var e in descendants()) if (s.matches(e, this)) l.Add(e); return l; }
        public bool matches(string sel) { return Selector.parse(sel).matches(this, null); }
        public DomElement closest(string sel) { var s = Selector.parse(sel); for (var e = this; e != null; e = e.parentElement) if (s.matches(e, null)) return e; return null; }
        public IEnumerable<DomElement> descendants()
        {
            foreach (var c in children) { yield return c; foreach (var d in c.descendants()) yield return d; }
        }

        // ---------- Eventos ----------
        readonly Dictionary<string, List<Action<DomEvent>>> listeners = new Dictionary<string, List<Action<DomEvent>>>();
        public void addEventListener(string type, Action<DomEvent> fn)
        {
            if (!listeners.TryGetValue(type, out var l)) listeners[type] = l = new List<Action<DomEvent>>();
            l.Add(fn);
        }
        public void addEventListener(string type, Action fn) { addEventListener(type, (e) => fn()); }
        // addEventListener(type, fn, true): fase de CAPTURA (se llama antes que los oyentes del elemento pulsado,
        // bajando desde la raíz). El juego la usa para que una escena se quede con el teclado y el ratón.
        readonly Dictionary<string, List<Action<DomEvent>>> captures = new Dictionary<string, List<Action<DomEvent>>>();
        public void addEventListener(string type, Action<DomEvent> fn, bool capture)
        {
            if (!capture) { addEventListener(type, fn); return; }
            if (!captures.TryGetValue(type, out var l)) captures[type] = l = new List<Action<DomEvent>>();
            l.Add(fn);
        }
        public void removeEventListener(string type, Action<DomEvent> fn) { if (listeners.TryGetValue(type, out var l)) l.Remove(fn); }
        public void removeEventListener(string type, Action<DomEvent> fn, bool capture)
        {
            if (!capture) { removeEventListener(type, fn); return; }
            if (captures.TryGetValue(type, out var l)) l.Remove(fn);
        }
        public bool hasListener(string type) { return listeners.ContainsKey(type) && listeners[type].Count > 0; }
        // Lanza el evento en este elemento y sube por sus padres (como el DOM)
        public DomEvent dispatch(DomEvent ev)
        {
            ev.target = ev.target ?? this;
            // Captura: de la raíz hacia abajo
            var path = new List<DomElement>();
            for (var e = this; e != null; e = e.parentElement) path.Add(e);
            for (int i = path.Count - 1; i >= 0 && !ev.propagationStopped; i--)
            {
                if (!path[i].captures.TryGetValue(ev.type, out var cl)) continue;
                ev.currentTarget = path[i];
                foreach (var fn in cl.ToArray())
                {
                    try { fn(ev); } catch (Exception x) { SN.logError("[" + ev.type + " (captura) en " + path[i].describe() + "] " + x); }
                    if (ev.fromUser) Microtasks.drain();
                }
            }
            // Burbujeo: del elemento hacia arriba
            for (int i = 0; i < path.Count && !ev.propagationStopped; i++)
            {
                var e = path[i];
                if (!e.listeners.TryGetValue(ev.type, out var l)) continue;
                ev.currentTarget = e;
                foreach (var fn in l.ToArray())
                {
                    try { fn(ev); } catch (Exception x) { SN.logError("[" + ev.type + " en " + e.describe() + "] " + x); }
                    if (ev.fromUser) Microtasks.drain(); // tras cada manejador de un evento de usuario, como el navegador
                }
            }
            return ev;
        }
        public void click() { if (!disabled) dispatch(new DomEvent("click")); }
        public void focus() { Dom.focus(this); }
        public void blur() { if (Dom.focused == this) Dom.focus(null); }

        public string describe() { return tagName + (id.Length > 0 ? "#" + id : "") + (classes.Count > 0 ? "." + string.Join(".", classes) : ""); }
        public override string ToString() { return describe(); }
    }

    // el.classList
    public sealed class DomClassList
    {
        readonly DomElement el;
        internal DomClassList(DomElement el) { this.el = el; }
        public void add(params string[] cs) { bool ch = false; foreach (var c in cs) if (!el.classStore.Contains(c)) { el.classStore.Add(c); ch = true; } if (ch) el.touch(); }
        public void remove(params string[] cs) { bool ch = false; foreach (var c in cs) ch |= el.classStore.Remove(c); if (ch) el.touch(); }
        public bool toggle(string c) { if (contains(c)) { remove(c); return false; } add(c); return true; }
        public bool toggle(string c, bool force) { if (force) add(c); else remove(c); return force; }
        public bool contains(string c) { return el.classStore.Contains(c); }
        public int length { get { return el.classStore.Count; } }
    }

    // el.dataset: data-foo-bar <-> fooBar
    public sealed class DomDataset
    {
        readonly DomElement el;
        internal DomDataset(DomElement el) { this.el = el; }
        static string attr(string key)
        {
            var sb = new StringBuilder("data-");
            foreach (char c in key) { if (char.IsUpper(c)) sb.Append('-').Append(char.ToLowerInvariant(c)); else sb.Append(c); }
            return sb.ToString();
        }
        public string this[string key] { get { return el.getAttribute(attr(key)); } set { if (value == null) el.removeAttribute(attr(key)); else el.setAttribute(attr(key), value); } }
        public bool has(string key) { return el.hasAttribute(attr(key)); }
        public void delete(string key) { el.removeAttribute(attr(key)); }
    }

    // el.style: estilos en línea (los que pone el código: left, top, width, transform, --variables...)
    public sealed class DomStyle
    {
        readonly DomElement el;
        readonly List<KeyValuePair<string, string>> props = new List<KeyValuePair<string, string>>();
        internal DomStyle(DomElement el) { this.el = el; }
        static string kebab(string camel)
        {
            if (camel.StartsWith("--")) return camel;
            var sb = new StringBuilder();
            foreach (char c in camel) { if (char.IsUpper(c)) sb.Append('-').Append(char.ToLowerInvariant(c)); else sb.Append(c); }
            return sb.ToString();
        }
        public string this[string name]
        {
            get { name = kebab(name); foreach (var kv in props) if (kv.Key == name) return kv.Value; return ""; }
            set { setProperty(kebab(name), value); }
        }
        public void setProperty(string name, string value)
        {
            for (int i = 0; i < props.Count; i++) if (props[i].Key == name)
                {
                    if (string.IsNullOrEmpty(value)) props.RemoveAt(i); else props[i] = new KeyValuePair<string, string>(name, value);
                    el.touch(); return;
                }
            if (!string.IsNullOrEmpty(value)) { props.Add(new KeyValuePair<string, string>(name, value)); el.touch(); }
        }
        public void removeProperty(string name) { setProperty(name, null); }
        public IEnumerable<KeyValuePair<string, string>> all { get { return props; } }
        public string cssText
        {
            get { var sb = new StringBuilder(); foreach (var kv in props) sb.Append(kv.Key).Append(": ").Append(kv.Value).Append("; "); return sb.ToString().TrimEnd(); }
            set
            {
                props.Clear();
                foreach (var d in (value ?? "").Split(';'))
                {
                    int k = d.IndexOf(':');
                    if (k > 0) props.Add(new KeyValuePair<string, string>(d.Substring(0, k).Trim(), d.Substring(k + 1).Trim()));
                }
                el.touch();
            }
        }
        // Atajos con los nombres de JS
        public string left { get { return this["left"]; } set { this["left"] = value; } }
        public string top { get { return this["top"]; } set { this["top"] = value; } }
        public string width { get { return this["width"]; } set { this["width"] = value; } }
        public string height { get { return this["height"]; } set { this["height"] = value; } }
        public string transform { get { return this["transform"]; } set { this["transform"] = value; } }
        public string opacity { get { return this["opacity"]; } set { this["opacity"] = value; } }
        public string visibility { get { return this["visibility"]; } set { this["visibility"] = value; } }
        public string backgroundImage { get { return this["background-image"]; } set { this["background-image"] = value; } }
        public string transition { get { return this["transition"]; } set { this["transition"] = value; } }
        public string minHeight { get { return this["min-height"]; } set { this["min-height"] = value; } }
        public string cursor { get { return this["cursor"]; } set { this["cursor"] = value; } }
    }

    public static partial class Dom
    {
        public static int version;
        public static DomElement document;     // la raíz (el <body>)
        public static DomElement focused { get; private set; }
        static readonly Dictionary<string, DomElement> byIdCache = new Dictionary<string, DomElement>();

        public static DomElement createElement(string tag) { return new DomElement(tag); }
        public static DomText createTextNode(string t) { return new DomText(t); }
        // document.getElementById (SN.Util.$ con un id)
        public static DomElement byId(string id)
        {
            if (document == null) return null;
            if (byIdCache.TryGetValue(id, out var e) && e.id == id && document.contains(e)) return e;
            foreach (var d in document.descendants()) if (d.id == id) { byIdCache[id] = d; return d; }
            return null;
        }
        public static DomElement querySelector(string sel) { return document?.querySelector(sel); }
        public static List<DomElement> querySelectorAll(string sel) { return document != null ? document.querySelectorAll(sel) : new List<DomElement>(); }
        public static void focus(DomElement e) { if (focused != null) focused.focused = false; focused = e; if (e != null) e.focused = true; version++; }
        // SN.Util.el(tag, cls, html)
        public static DomElement el(string tag, string cls = null, string html = null)
        {
            var e = new DomElement(tag);
            if (!string.IsNullOrEmpty(cls)) e.className = cls;
            if (html != null) e.innerHTML = html;
            return e;
        }
    }
}
