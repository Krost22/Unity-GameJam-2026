// El reflejo del DOM mínimo (Draw/Dom) en UI Toolkit: cada elemento es un VisualElement con las mismas clases
// (más .t-<etiqueta>) y su id como nombre, y la hoja convertida de css/style.css (Resources/SaldoNegro/Game.uss)
// le da el aspecto. Es el "navegador" del port:
//   · <canvas> -> CanvasElement (su lienzo se sube a una textura cuando cambia);
//   · texto -> PxText (la fuente pixel con el rasterizador comprobado contra Chrome); el texto y los elementos en
//     línea de un bloque van en una fila que salta de línea (.sn-line), como el contexto en línea del navegador;
//   · estilos en línea (left, top, width, height, transform, opacity...) -> estilos del VisualElement;
//   · lo que USS no tiene llega como propiedades --sn-* (line-height, text-shadow, z-index, pointer-events...).
// También contesta las medidas que pide el juego (IDomHost: getBoundingClientRect, offsetWidth...) y convierte el
// ratón y el teclado de Unity en eventos del DOM.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class DomView : IDomHost
    {
        public readonly VisualElement root;
        int seenVersion = -1;
        readonly Dictionary<DomElement, VisualElement> views = new Dictionary<DomElement, VisualElement>();
        readonly List<CanvasElement> canvases = new List<CanvasElement>();
        // Animaciones (@keyframes) y transiciones: avanzan en cada sincronización, con el reloj del juego
        public readonly CssAnimator anim = new CssAnimator();

        static readonly HashSet<string> INLINE = new HashSet<string> { "span", "b", "i", "kbd", "small", "em", "strong", "a", "button", "canvas", "img", "label", "br" };

        public DomView(VisualElement panelRoot)
        {
            root = panelRoot;
            var sheet = Resources.Load<StyleSheet>("SaldoNegro/Game");
            if (sheet == null) Debug.LogError("SALDO NEGRO: falta Resources/SaldoNegro/Game.uss (Unity/Tools~/css2uss.js)");
            else root.styleSheets.Add(sheet);
            root.AddToClassList("t-body");
            // Ratón: los eventos de UI Toolkit pasan a eventos del DOM en el elemento que hay debajo
            root.RegisterCallback<PointerDownEvent>((e) => pointer("pointerdown", e.target, e.position, e.button), TrickleDown.TrickleDown);
            root.RegisterCallback<PointerUpEvent>((e) => pointer("pointerup", e.target, e.position, e.button), TrickleDown.TrickleDown);
            root.RegisterCallback<PointerMoveEvent>((e) => pointer("pointermove", e.target, e.position, e.button), TrickleDown.TrickleDown);
            root.RegisterCallback<ClickEvent>((e) => pointer("click", e.target, e.position, e.button), TrickleDown.TrickleDown);
            root.RegisterCallback<WheelEvent>((e) => { var t = domOf(e.target as VisualElement); t?.dispatchUser(new DomEvent("wheel") { deltaY = e.delta.y * 100 }); }, TrickleDown.TrickleDown);
        }

        // ---------- Sincronizar ----------
        // Una vez por fotograma: si el DOM cambió, se rehace lo que esté marcado; y se suben los lienzos
        public void sync()
        {
            if (Dom.document == null) return;
            if (Dom.version != seenVersion)
            {
                seenVersion = Dom.version;
                reconcile(Dom.document, root, true);
            }
            // (tras reflejar el DOM: lo que anima el CSS se escribe al final, así que gana sobre los estilos del fotograma)
            anim.step(Dom.now());
            foreach (var c in canvases) c.upload();
            // estilo del texto (color, tamaño, interlineado, sombras): lo resuelve UI Toolkit; se copia a cada trozo
            foreach (var kv in texts) { var par = kv.Key.Item1.parentElement; if (par != null && par.view is VisualElement pv && kv.Value.panel != null) styleText(par, pv, pieceOf[kv.Value], kv.Value); }
            foreach (var kv in pseudos) if (kv.Value.text != null && kv.Value.box.panel != null) styleText(kv.Key.Item1, kv.Value.box, kv.Value.value, kv.Value.text);
        }

        VisualElement viewOf(DomElement e)
        {
            if (views.TryGetValue(e, out var v)) return v;
            if (e.tagName == "canvas")
            {
                var ce = new CanvasElement(e.canvas ?? new Canvas(1, 1));
                canvases.Add(ce);
                v = ce;
            }
            else v = new BoxElement(); // (sombras de caja y degradados: BoxElement.cs)
            v.userData = e;
            views[e] = v;
            e.view = v;
            // (al cambiar el puntero, lo que depende de :hover en las reglas que USS no tiene se vuelve a calcular)
            v.RegisterCallback<PointerEnterEvent>((_) => { e.hovered = true; e.needsSync = true; Dom.version++; });
            v.RegisterCallback<PointerLeaveEvent>((_) => { e.hovered = false; e.needsSync = true; Dom.version++; });
            v.RegisterCallback<CustomStyleResolvedEvent>((_) => onStyle(e, v));
            return v;
        }

        void reconcile(DomElement e, VisualElement v, bool isRoot)
        {
            // Se recorre todo el árbol: Dom.touch deja de marcar a los ancestros al topar con uno ya marcado, así que un
            // hijo nuevo puede estar debajo de un padre que no está marcado. Solo se aplica el estilo donde hay cambios.
            bool mine = e.needsSync;
            e.needsSync = false;
            if (mine && !isRoot) applyElement(e, v);
            if (e.tagName == "svg") { if (mine) svg(e, v); if (v.childCount > 0) v.Clear(); return; }
            // hijos: elementos y trozos de texto; lo que va en línea dentro de un bloque, en filas (.sn-line)
            var want = new List<VisualElement>();
            VisualElement line = null;
            bool block = !isRoot ? isBlockContainer(e, v) : true;
            int lineIdx = 0;
            var firstEl = e.firstElementChild;
            var pb = pseudoOf(e, "before");
            if (pb != null) want.Add(pb);
            // (un trozo de texto se parte en palabras y espacios: así la fila salta de línea entre palabras, como el navegador)
            void place(VisualElement cv, bool inline)
            {
                if (block && inline)
                {
                    if (line == null) { line = lineView(e, lineIdx++); want.Add(line); line.Clear(); }
                    line.Add(cv);
                }
                else { line = null; want.Add(cv); }
            }
            foreach (var n in e.childNodes)
            {
                if (n is DomText t)
                {
                    string s = collapse(t.textContent);
                    // Un espacio solo cuenta entre piezas en línea de un bloque (en flex y grid, y junto a bloques, no hace caja)
                    bool lead = block && line != null, trail = block && nextIsInline(e, n);
                    var ps = wordPieces(s, lead, trail);
                    for (int k = 0; k < ps.Count; k++) place(textView(t, k, ps[k]), true);
                    continue;
                }
                var c = (DomElement)n;
                if (c.tagName == "style" || c.tagName == "script" || c.tagName == "title") continue; // (no se pintan)
                var cv = viewOf(c);
                if (block && flatNow(c)) { flow(c, cv); continue; }
                setFlat(c, cv, false);
                reconcile(c, cv, false);
                if (c == firstEl) cv.AddToClassList("sn-first");
                place(cv, isInline(c, cv));
            }
            // Un elemento en línea sin caja propia que se vea (un <b class="y"> dentro de un párrafo): como en el
            // navegador, sus palabras van en la fila del párrafo y pueden saltar de línea por dentro. Su
            // VisualElement queda oculto (display none) pero sigue resolviendo el estilo, que copian sus palabras.
            void flow(DomElement c, VisualElement cv)
            {
                if (c.needsSync) { c.needsSync = false; applyElement(c, cv); }
                if (c == firstEl) cv.AddToClassList("sn-first");
                setFlat(c, cv, true);
                if (cv.childCount > 0) cv.Clear();
                place(cv, true);
                if (!flatPieces.TryGetValue(c, out var mine)) flatPieces[c] = mine = new List<VisualElement>();
                mine.Clear();
                foreach (var m in c.childNodes)
                {
                    if (m is DomText t)
                    {
                        var ps = wordPieces(collapse(t.textContent), line != null, m != c.lastChild ? nextIsInline(c, m) : c.parentElement != null && nextIsInline(c.parentElement, c));
                        for (int k = 0; k < ps.Count; k++)
                        {
                            var p = textView(t, k, ps[k]);
                            p.userData = c; p.pickingMode = PickingMode.Position; // (el clic en la palabra es del elemento)
                            place(p, true);
                            mine.Add(p);
                        }
                        continue;
                    }
                    var cc = (DomElement)m;
                    if (cc.tagName == "style" || cc.tagName == "script") continue;
                    var ccv = viewOf(cc);
                    if (flatNow(cc)) { flow(cc, ccv); continue; }
                    setFlat(cc, ccv, false);
                    reconcile(cc, ccv, false);
                    place(ccv, isInline(cc, ccv));
                    mine.Add(ccv);
                }
            }
            var pa = pseudoOf(e, "after");
            if (pa != null) want.Add(pa);
            // poner los hijos en orden sin recrearlos
            for (int i = 0; i < want.Count; i++)
            {
                if (i < v.childCount && v[i] == want[i]) continue;
                if (want[i].parent != null) want[i].RemoveFromHierarchy();
                v.Insert(Math.Min(i, v.childCount), want[i]);
            }
            while (v.childCount > want.Count) v.RemoveAt(v.childCount - 1);
            sortZ(v);
        }

        // ::before / ::after: un hijo generado (clase sn-before / sn-after) con su texto (content) si lo tiene
        sealed class PseudoView { public BoxElement box; public PxText text; public string value; }
        readonly Dictionary<(DomElement, string), PseudoView> pseudos = new Dictionary<(DomElement, string), PseudoView>();
        VisualElement pseudoOf(DomElement e, string which)
        {
            var key = (e, which);
            string content = CssPseudo.content(e, which);
            if (content == null)
            {
                if (pseudos.TryGetValue(key, out var old)) { old.box.RemoveFromHierarchy(); pseudos.Remove(key); }
                return null;
            }
            if (!pseudos.TryGetValue(key, out var p))
            {
                var box = new BoxElement { userData = e };
                box.AddToClassList("sn-" + which);
                box.RegisterCallback<CustomStyleResolvedEvent>((_) => BoxElement.readStyle(box, e));
                p = new PseudoView { box = box };
                pseudos[key] = p;
            }
            p.value = content;
            if (content.Length > 0 && p.text == null) { p.text = new PxText(); p.box.Add(p.text); }
            else if (content.Length == 0 && p.text != null) { p.text.RemoveFromHierarchy(); p.text = null; }
            return p.box;
        }

        readonly Dictionary<DomElement, string> lastDisplay = new Dictionary<DomElement, string>();

        // <svg> del juego: solo el sello de la jam (game.js), hecho de <rect> de 1x1 con fill y shape-rendering
        // crispEdges. Se pinta píxel a píxel en una textura del tamaño del viewBox, que se estira sin suavizar al
        // tamaño de width/height. Otra cosa dentro de un svg se avisa en la consola.
        static readonly Dictionary<string, Texture2D> svgCache = new Dictionary<string, Texture2D>();
        static void svg(DomElement e, VisualElement v)
        {
            float num(DomElement x, string a, float def) { var s = x.getAttribute(a); return s != null && float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out float f) ? f : def; }
            float w = num(e, "width", 0), h = num(e, "height", 0);
            var vb = (e.getAttribute("viewBox") ?? ("0 0 " + w + " " + h)).Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries);
            int vw = vb.Length == 4 ? (int)float.Parse(vb[2], CultureInfo.InvariantCulture) : (int)w, vh = vb.Length == 4 ? (int)float.Parse(vb[3], CultureInfo.InvariantCulture) : (int)h;
            if (string.IsNullOrEmpty(e.style["width"]) && w > 0) v.style.width = w;
            if (string.IsNullOrEmpty(e.style["height"]) && h > 0) v.style.height = h;
            if (vw <= 0 || vh <= 0) return;
            var key = new System.Text.StringBuilder().Append(vw).Append('x').Append(vh).Append(e.getAttribute("fill"));
            foreach (var c in e.children) { key.Append('|').Append(c.tagName); foreach (var a in c.attributes) key.Append(' ').Append(a.Key).Append('=').Append(a.Value); }
            string k = key.ToString();
            if (!svgCache.TryGetValue(k, out var tex))
            {
                var px = new Color32[vw * vh];
                foreach (var c in e.children)
                {
                    if (c.tagName != "rect") { Debug.LogWarning("SALDO NEGRO: <svg> con <" + c.tagName + ">, que el port no pinta"); continue; }
                    Rgba col;
                    try { col = CssColor.parse(c.getAttribute("fill") ?? e.getAttribute("fill") ?? "#000"); } catch (Exception) { continue; }
                    int x0 = (int)num(c, "x", 0), y0 = (int)num(c, "y", 0), x1 = x0 + (int)num(c, "width", 0), y1 = y0 + (int)num(c, "height", 0);
                    for (int y = Math.Max(0, y0); y < Math.Min(vh, y1); y++)
                        for (int x = Math.Max(0, x0); x < Math.Min(vw, x1); x++)
                            px[(vh - 1 - y) * vw + x] = new Color32(col.r, col.g, col.b, (byte)Math.Round(col.a * 255));
                }
                tex = new Texture2D(vw, vh, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.HideAndDontSave };
                tex.SetPixels32(px);
                tex.Apply();
                svgCache[k] = tex;
            }
            v.style.backgroundImage = new StyleBackground(tex);
        }

        // ---------- Elementos en línea sin caja (sus palabras van en la fila del padre) ----------
        static readonly HashSet<string> FLAT_TAGS = new HashSet<string> { "span", "b", "i", "em", "strong", "small", "a" };
        static readonly CustomStyleProperty<string> P_ANIM = new CustomStyleProperty<string>("--sn-animation");
        static readonly CustomStyleProperty<string> P_ANIM_NAME = new CustomStyleProperty<string>("--sn-animation-name");
        static readonly CustomStyleProperty<string> P_BOX = new CustomStyleProperty<string>("--sn-box-shadow");
        static readonly CustomStyleProperty<string> P_BGS = new CustomStyleProperty<string>("--sn-background");
        static readonly CustomStyleProperty<string> P_POS = new CustomStyleProperty<string>("--sn-position");
        readonly HashSet<VisualElement> flatSet = new HashSet<VisualElement>();
        readonly Dictionary<DomElement, bool> lastFlat = new Dictionary<DomElement, bool>();
        readonly Dictionary<DomElement, List<VisualElement>> flatPieces = new Dictionary<DomElement, List<VisualElement>>();
        static bool isNone(VisualElement v, CustomStyleProperty<string> p, string none)
        {
            if (!v.customStyle.TryGetValue(p, out var s)) return true;
            s = s.Trim().Trim('"', '\'');
            return s == none || s == "";
        }
        // Lo que se decidió la última vez que UI Toolkit resolvió su estilo (onStyle). Al colocar, el elemento puede
        // estar fuera del panel un momento (la fila se vacía y se rellena), así que no se mira en ese instante.
        bool flatNow(DomElement e) { return lastFlat.TryGetValue(e, out var f) && f && !e.classList.contains("hidden"); }
        // ¿Se ve su caja? Fondo, borde, relleno, margen, sombra, opacidad, transformación, animación, filtro o
        // ::before/::after hacen que sí (y entonces va como una pieza entera, como hasta ahora)
        bool isFlat(DomElement e, VisualElement v)
        {
            if (!FLAT_TAGS.Contains(e.tagName) || v.panel == null || e.classList.contains("hidden")) return false;
            if (displayOf(e, v) != "inline") return false;
            var r = v.resolvedStyle;
            if (r.backgroundColor.a > 0 || !isNone(v, P_BGS, "none") || r.backgroundImage.texture != null || r.backgroundImage.sprite != null) return false;
            if (r.borderLeftWidth > 0 || r.borderRightWidth > 0 || r.borderTopWidth > 0 || r.borderBottomWidth > 0) return false;
            if (r.paddingLeft != 0 || r.paddingRight != 0 || r.paddingTop != 0 || r.paddingBottom != 0) return false;
            if (r.marginLeft != 0 || r.marginRight != 0 || r.marginTop != 0 || r.marginBottom != 0) return false;
            if (r.opacity < 1 || !isNone(v, P_BOX, "none") || !isNone(v, P_ANIM, "none") || !isNone(v, P_ANIM_NAME, "none") || !isNone(v, P_FILTER, "none")) return false;
            if (!isNone(v, P_TR, "none") || !string.IsNullOrEmpty(e.style["transform"]) || !string.IsNullOrEmpty(e.style["position"])) return false;
            if (!isNone(v, P_POS, "static") || !string.IsNullOrEmpty(e.style["opacity"]) || !string.IsNullOrEmpty(e.style["display"])) return false;
            if (CssPseudo.content(e, "before") != null || CssPseudo.content(e, "after") != null) return false;
            return true;
        }
        void setFlat(DomElement e, VisualElement v, bool on)
        {
            if (on) { if (flatSet.Add(v)) v.style.display = DisplayStyle.None; return; }
            if (!flatSet.Remove(v)) return;
            flatPieces.Remove(e);
            if (e.classList.contains("hidden")) v.style.display = DisplayStyle.None;
            else v.style.display = new StyleEnum<DisplayStyle>(StyleKeyword.Null);
        }
        bool nextIsInline(DomElement parent, DomNode n)
        {
            int i = parent.childNodes.IndexOf(n);
            for (int k = i + 1; k < parent.childNodes.Count; k++)
            {
                var x = parent.childNodes[k];
                if (x is DomText tx) { if (collapse(tx.textContent).Trim().Length > 0) return true; continue; }
                var el = (DomElement)x;
                return views.TryGetValue(el, out var ev) ? isInline(el, ev) : INLINE.Contains(el.tagName);
            }
            return false;
        }
        readonly Dictionary<(DomText, int), PxText> texts = new Dictionary<(DomText, int), PxText>();
        readonly Dictionary<PxText, string> pieceOf = new Dictionary<PxText, string>();
        PxText textView(DomText t, int k, string s)
        {
            if (!texts.TryGetValue((t, k), out var p)) { p = new PxText(); texts[(t, k)] = p; }
            pieceOf[p] = s;
            p.value = s;
            return p;
        }
        // Palabras y espacios de un texto: el espacio del principio solo si ya hay algo en la fila (lead) y el del
        // final solo si detrás viene algo en línea (trail)
        static List<string> wordPieces(string s, bool lead, bool trail)
        {
            var o = new List<string>();
            if (s.Length == 0) return o;
            if (s.Trim().Length == 0) { if (lead && trail) o.Add(" "); return o; }
            var words = s.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (s[0] == ' ' && lead) o.Add(" ");
            for (int i = 0; i < words.Length; i++) { if (i > 0) o.Add(" "); o.Add(words[i]); }
            if (s[s.Length - 1] == ' ' && trail) o.Add(" ");
            return o;
        }
        readonly Dictionary<(DomElement, int), VisualElement> lines = new Dictionary<(DomElement, int), VisualElement>();
        VisualElement lineView(DomElement e, int i)
        {
            if (!lines.TryGetValue((e, i), out var l)) { l = new VisualElement { pickingMode = PickingMode.Ignore }; l.AddToClassList("sn-line"); lines[(e, i)] = l; }
            return l;
        }

        static string collapse(string s)
        {
            var sb = new System.Text.StringBuilder(s.Length);
            bool sp = false;
            foreach (char c in s)
            {
                if (c == ' ' || c == '\n' || c == '\r' || c == '\t') { if (!sp) sb.Append(' '); sp = true; }
                else { sb.Append(c); sp = false; }
            }
            return sb.ToString();
        }

        // display: el de la regla (--sn-display) o el de la etiqueta
        static readonly CustomStyleProperty<string> P_DISPLAY = new CustomStyleProperty<string>("--sn-display");
        static readonly CustomStyleProperty<string> P_LH = new CustomStyleProperty<string>("--sn-line-height");
        static readonly CustomStyleProperty<string> P_TS = new CustomStyleProperty<string>("--sn-text-shadow");
        static readonly CustomStyleProperty<string> P_Z = new CustomStyleProperty<string>("--sn-z-index");
        static readonly CustomStyleProperty<string> P_PE = new CustomStyleProperty<string>("--sn-pointer-events");
        static readonly CustomStyleProperty<string> P_TT = new CustomStyleProperty<string>("--sn-text-transform");
        static readonly CustomStyleProperty<string> P_FS = new CustomStyleProperty<string>("--sn-font-size");
        static readonly CustomStyleProperty<string> P_GAP = new CustomStyleProperty<string>("--sn-gap");
        static readonly CustomStyleProperty<string> P_TA = new CustomStyleProperty<string>("--sn-text-align");
        string displayOf(DomElement e, VisualElement v)
        {
            if (v.customStyle.TryGetValue(P_DISPLAY, out var d)) { d = d.Trim('"', '\x27'); if (d != "auto") return d; }
            return INLINE.Contains(e.tagName) ? (e.tagName == "button" ? "inline-block" : "inline") : "block";
        }
        bool isInline(DomElement e, VisualElement v) { var d = displayOf(e, v); return d.StartsWith("inline") || (d == "block" && false); }
        bool isBlockContainer(DomElement e, VisualElement v) { var d = displayOf(e, v); return d == "block" || d == "inline-block" || d == "list-item"; }

        // Cuando UI Toolkit resuelve el estilo: lo que USS no sabe hacer y el texto de dentro
        void onStyle(DomElement e, VisualElement v)
        {
            // si cambió el display (en línea / bloque), hay que volver a colocar a los hijos del padre
            string disp = displayOf(e, v);
            if (!lastDisplay.TryGetValue(e, out var old) || old != disp) { lastDisplay[e] = disp; if (e.parentElement != null) { e.parentElement.needsSync = true; Dom.version++; } }
            // (si pasa a ir sin caja o deja de hacerlo, el padre vuelve a colocar a sus hijos)
            if (FLAT_TAGS.Contains(e.tagName))
            {
                bool fl = isFlat(e, v);
                if (!lastFlat.TryGetValue(e, out var was) || was != fl) { lastFlat[e] = fl; if (e.parentElement != null) { e.parentElement.needsSync = true; Dom.version++; } }
            }
            BoxElement.readStyle(v, e);
            anim.noteStyle(e, v);
            if (!anim.drives(e, "transform") && !anim.drives(e, "translate")) applyBaseTransform(e, v);
            if (!anim.drives(e, "filter")) applyBaseFilter(e, v);
            if (v.customStyle.TryGetValue(P_PE, out var pe)) v.pickingMode = pe.Contains("none") ? PickingMode.Ignore : PickingMode.Position;
            if (v.customStyle.TryGetValue(P_Z, out var _)) v.parent?.MarkDirtyRepaint();
            layoutExtras(e, v);
        }

        // gap (USS no lo tiene: margen delante de cada hijo visible menos el primero) y text-align (las filas de
        // texto se alinean en su bloque; los botones centran el suyo, como el navegador)
        void layoutExtras(DomElement e, VisualElement v)
        {
            string gap = v.customStyle.TryGetValue(P_GAP, out var g) ? CssVars.resolve(g, e) : "normal";
            if (gap != "normal")
            {
                var parts = gap.Split(' ');
                float row = px(parts[0], 0), col = parts.Length > 1 ? px(parts[1], 0) : row;
                bool isRow = v.resolvedStyle.flexDirection == FlexDirection.Row || v.resolvedStyle.flexDirection == FlexDirection.RowReverse;
                bool first = true;
                foreach (var c in v.Children())
                {
                    if (c.resolvedStyle.display == DisplayStyle.None || c.resolvedStyle.position == Position.Absolute) continue;
                    if (isRow) c.style.marginLeft = first ? new StyleLength(StyleKeyword.Null) : new StyleLength(col);
                    else c.style.marginTop = first ? new StyleLength(StyleKeyword.Null) : new StyleLength(row);
                    first = false;
                }
            }
            string ta = v.customStyle.TryGetValue(P_TA, out var t) ? t.Trim('"') : (e.tagName == "button" ? "center" : null);
            if (ta != null)
            {
                var j = ta == "center" ? Justify.Center : (ta == "right" || ta == "end") ? Justify.FlexEnd : Justify.FlexStart;
                foreach (var c in v.Children()) if (c.ClassListContains("sn-line")) c.style.justifyContent = j;
                if (e.tagName == "button" || isInlineBlockText(e, v)) v.style.justifyContent = j;
            }
        }
        bool isInlineBlockText(DomElement e, VisualElement v) { foreach (var n in e.childNodes) if (n is DomText) return true; return false; }

        void styleText(DomElement e, VisualElement v, string raw, PxText p)
        {
            int size = v.customStyle.TryGetValue(P_FS, out var fs) ? px(CssVars.resolve(fs, e), 8) : Mathf.RoundToInt(v.resolvedStyle.fontSize);
            if (size <= 0) size = 8;
            int lh = v.customStyle.TryGetValue(P_LH, out var lhs) ? px(CssVars.resolve(lhs, e), size + 2) : (size * 10 / 8);
            string col = css(v.resolvedStyle.color);
            shadowsBuf.Clear();
            if (v.customStyle.TryGetValue(P_TS, out var ts)) parseShadows(CssVars.resolve(ts, e), col, shadowsBuf);
            p.setStyle(col, size % 8 == 0 ? size : Math.Max(8, (size / 8) * 8), lh, v.resolvedStyle.letterSpacing, shadowsBuf);
            string tt = v.customStyle.TryGetValue(P_TT, out var tts) ? tts.Trim('"') : "none";
            p.value = tt.Contains("uppercase") ? JsString.upper(collapse(raw)) : collapse(raw);
        }
        readonly List<PxText.Shadow> shadowsBuf = new List<PxText.Shadow>();

        static string css(Color c)
        {
            int r = Mathf.RoundToInt(c.r * 255), g = Mathf.RoundToInt(c.g * 255), b = Mathf.RoundToInt(c.b * 255);
            return "#" + r.ToString("X2") + g.ToString("X2") + b.ToString("X2");
        }
        static int px(string s, int def)
        {
            s = s.Trim('"', '\'', ' ');
            if (s.EndsWith("px")) s = s.Substring(0, s.Length - 2);
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out double d) ? (int)Math.Round(d) : def;
        }
        // "1px 0 0 currentColor, 0 1px 0 #000"
        static void parseShadows(string s, string current, List<PxText.Shadow> o)
        {
            s = s.Trim('"', '\'');
            if (s == "none" || s == "normal") return;
            foreach (var part in CssVars.splitTop(s, ','))
            {
                var bits = CssVars.splitTop(part.Trim(), ' ').ToArray();
                if (bits.Length < 2) continue;
                int dx = px(bits[0], 0), dy = px(bits[1], 0);
                string color = bits[bits.Length - 1];
                if (color == "currentColor" || color.EndsWith("px") || color == "0") color = current;
                o.Add(new PxText.Shadow { dx = dx, dy = dy, color = color });
            }
        }

        // ---------- Estilos en línea y estado ----------
        readonly Dictionary<VisualElement, HashSet<string>> inlineSet = new Dictionary<VisualElement, HashSet<string>>();
        void applyElement(DomElement e, VisualElement v)
        {
            v.ClearClassList();
            v.AddToClassList("t-" + e.tagName);
            foreach (var c in e.classNames) v.AddToClassList(c);
            v.name = e.id;
            v.SetEnabled(!e.disabled);
            if (v is CanvasElement ce && e.canvas != null)
            {
                ce.setCanvas(e.canvas);
                // (como en el navegador, sin ancho o alto en el CSS el <canvas> mide lo que su lienzo)
                v.style.width = string.IsNullOrEmpty(e.style["width"]) && !CssPseudo.ruleSets(e, "width") ? new StyleLength(e.canvas.width) : new StyleLength(StyleKeyword.Null);
                v.style.height = string.IsNullOrEmpty(e.style["height"]) && !CssPseudo.ruleSets(e, "height") ? new StyleLength(e.canvas.height) : new StyleLength(StyleKeyword.Null);
            }
            if (!inlineSet.TryGetValue(v, out var had)) inlineSet[v] = had = new HashSet<string>();
            var now = new HashSet<string>();
            foreach (var kv in e.style.all) { if (setInline(v, kv.Key, kv.Value)) now.Add(kv.Key); }
            foreach (var k in had) if (!now.Contains(k)) setInline(v, k, null);
            if (!anim.drives(e, "transform") && !anim.drives(e, "translate")) applyBaseTransform(e, v);
            // Reglas con !important de la web (USS no lo tiene: van en línea, que manda sobre la hoja)
            if (e.classList.contains("hidden") || flatSet.Contains(v)) v.style.display = DisplayStyle.None;
            else if (!now.Contains("display")) v.style.display = new StyleEnum<DisplayStyle>(StyleKeyword.Null);
            if (anim.drives(e, "opacity")) { }
            else if (isArming(e)) v.style.opacity = 0.55f;
            else if (!now.Contains("opacity")) v.style.opacity = new StyleFloat(StyleKeyword.Null);
            inlineSet[v] = now;
        }

        static StyleLength len(string s)
        {
            if (s == null) return new StyleLength(StyleKeyword.Null);
            s = s.Trim();
            if (s == "auto") return new StyleLength(StyleKeyword.Auto);
            if (s.EndsWith("%") && float.TryParse(s.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out float p)) return new StyleLength(Length.Percent(p));
            if (s.EndsWith("px")) s = s.Substring(0, s.Length - 2);
            return float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out float f) ? new StyleLength(f) : new StyleLength(StyleKeyword.Null);
        }
        static bool setInline(VisualElement v, string k, string val)
        {
            var st = v.style;
            switch (k)
            {
                case "left": st.left = len(val); return true;
                case "top": st.top = len(val); return true;
                case "right": st.right = len(val); return true;
                case "bottom": st.bottom = len(val); return true;
                case "width": st.width = len(val); return true;
                case "height": st.height = len(val); return true;
                case "min-height": st.minHeight = len(val); return true;
                case "opacity": st.opacity = val == null ? new StyleFloat(StyleKeyword.Null) : new StyleFloat(float.Parse(val, CultureInfo.InvariantCulture)); return true;
                case "visibility": st.visibility = val == null ? new StyleEnum<Visibility>(StyleKeyword.Null) : (val == "hidden" ? Visibility.Hidden : Visibility.Visible); return true;
                case "display": st.display = val == null ? new StyleEnum<DisplayStyle>(StyleKeyword.Null) : (val == "none" ? DisplayStyle.None : DisplayStyle.Flex); return true;
                case "transform": return true; // (lo escribe applyBaseTransform, con la hoja y las animaciones)
                case "background-image": backgroundImage(v, val); return true;
                default: return false; // variables (--k, --mk...) y el resto: los lee el código que los necesita
            }
        }

        // ---------- Transformaciones ----------
        // La transformación base es el estilo en línea o, si no lo hay, --sn-transform de la hoja (por clase, con las
        // variables resueltas). Mientras una animación o transición controla transform o translate, no se escribe.
        static readonly CustomStyleProperty<string> P_TR = new CustomStyleProperty<string>("--sn-transform");

        internal static Tf baseXf(DomElement e, VisualElement v)
        {
            string inl = e != null ? e.style["transform"] : "";
            string src = !string.IsNullOrEmpty(inl) ? inl : (v.customStyle.TryGetValue(P_TR, out var c) && c != null ? c : "none");
            return CssXf.TryParse(CssVars.resolve(src, e), out Tf t) ? t : Tf.Identity;
        }

        internal static void applyBaseTransform(DomElement e, VisualElement v) { applyTf(v, baseXf(e, v)); }

        // filter de las hojas de estilo (--sn-filter, con sus var() resueltas); el juego no lo pone en línea
        static readonly CustomStyleProperty<string> P_FILTER = new CustomStyleProperty<string>("--sn-filter");
        static readonly Dictionary<VisualElement, List<CssFilter.Fn>> shownFilter = new Dictionary<VisualElement, List<CssFilter.Fn>>();
        internal static List<CssFilter.Fn> baseFilter(DomElement e, VisualElement v)
        {
            if (!v.customStyle.TryGetValue(P_FILTER, out var s)) return new List<CssFilter.Fn>();
            return CssFilter.Parse(CssVars.resolve(s, e)) ?? new List<CssFilter.Fn>();
        }
        internal static void applyBaseFilter(DomElement e, VisualElement v) { setFilter(v, baseFilter(e, v)); }
        // (solo si cambia: poner el estilo vuelve a resolver el del elemento)
        internal static void setFilter(VisualElement v, List<CssFilter.Fn> f)
        {
            if (shownFilter.TryGetValue(v, out var old) && CssFilter.Same(old, f)) return;
            if (f.Count == 0) shownFilter.Remove(v); else shownFilter[v] = f;
            CssFilter.Apply(v, f);
        }

        // Escribe una transformación canónica (traslación, giro, escala: el orden de UI Toolkit)
        internal static void applyTf(VisualElement v, Tf t)
        {
            var st = v.style;
            if (t.IsIdentity) { st.translate = new StyleTranslate(StyleKeyword.Null); st.scale = new StyleScale(StyleKeyword.Null); st.rotate = new StyleRotate(StyleKeyword.Null); return; }
            st.translate = new StyleTranslate(new Translate(lenOf(t.tx, sizeOf(v.layout.width)), lenOf(t.ty, sizeOf(v.layout.height))));
            st.scale = new StyleScale(new Scale(new Vector2((float)t.sx, (float)t.sy)));
            st.rotate = new StyleRotate(new Rotate((float)t.rot));
        }

        // px + % (los % sobre el tamaño del elemento, como en CSS)
        internal static Length lenOf(Lin l, float size)
        {
            if (l.pct == 0) return new Length((float)l.px);
            if (l.px == 0) return Length.Percent((float)l.pct);
            return new Length((float)(l.px + l.pct * size / 100.0));
        }
        static float sizeOf(float s) { return float.IsNaN(s) ? 0 : s; }

        static bool isArming(DomElement e) { return e.id == "btn-close" && e.classList.contains("arming"); }

        // Vuelve una propiedad a lo que pone el estilo (en línea o la hoja) cuando una animación deja de controlarla
        internal static void restoreBase(DomElement e, VisualElement v, string prop)
        {
            switch (prop)
            {
                case "transform":
                case "translate":
                    applyBaseTransform(e, v); break;
                case "opacity":
                    if (isArming(e)) { v.style.opacity = 0.55f; break; }
                    if (!string.IsNullOrEmpty(e.style["opacity"]) && float.TryParse(e.style["opacity"], NumberStyles.Float, CultureInfo.InvariantCulture, out float f)) v.style.opacity = f;
                    else v.style.opacity = new StyleFloat(StyleKeyword.Null);
                    break;
                case "color": v.style.color = colorStyle(e.style["color"]); break;
                case "background-color": v.style.backgroundColor = colorStyle(e.style["background-color"]); break;
                case "box-shadow": if (v is BoxElement b) b.clearAnimShadows(); break;
                case "filter": applyBaseFilter(e, v); break;
                case "width": case "height": case "left": case "top": setInline(v, prop, e.style[prop]); break;
            }
        }

        static StyleColor colorStyle(string s)
        {
            if (!string.IsNullOrEmpty(s))
            {
                try { var c = CssColor.parse(s); return new StyleColor(new Color(c.r / 255f, c.g / 255f, c.b / 255f, (float)c.a)); }
                catch (Exception) { }
            }
            return new StyleColor(StyleKeyword.Null);
        }

        // url(sprite:nombre@escala): los sprites que el juego pone de fondo
        static readonly Dictionary<string, Texture2D> bgCache = new Dictionary<string, Texture2D>();
        static void backgroundImage(VisualElement v, string val)
        {
            if (string.IsNullOrEmpty(val)) { v.style.backgroundImage = new StyleBackground(StyleKeyword.Null); return; }
            string u = val.Trim();
            if (u.StartsWith("url(")) u = u.Substring(4, u.Length - 5).Trim('"', '\'');
            if (!bgCache.TryGetValue(u, out var tex))
            {
                var c = SN.Sprites != null ? SN.Sprites.byUrl(u) : null;
                if (c == null) return;
                tex = new Texture2D(c.width, c.height, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
                // (las filas del lienzo van de arriba abajo; las de la textura, de abajo arriba)
                var flipped = new byte[c.data.Length];
                int row = c.width * 4;
                for (int y = 0; y < c.height; y++) Array.Copy(c.data, y * row, flipped, (c.height - 1 - y) * row, row);
                tex.SetPixelData(flipped, 0);
                tex.Apply(false);
                bgCache[u] = tex;
            }
            v.style.backgroundImage = new StyleBackground(tex);
        }

        // z-index: los hijos con z-index se pintan por orden (UI Toolkit pinta por orden de hijos)
        void sortZ(VisualElement v)
        {
            bool any = false;
            foreach (var c in v.Children()) if (c.customStyle.TryGetValue(P_Z, out var _)) { any = true; break; }
            if (!any) return;
            var kids = new List<VisualElement>(v.Children());
            int z(VisualElement c) { return c.customStyle.TryGetValue(P_Z, out var s) && int.TryParse(s.Trim('"'), out int n) ? n : 0; }
            var sorted = new List<VisualElement>(kids);
            sorted.Sort((a, b) => { int d = z(a).CompareTo(z(b)); return d != 0 ? d : kids.IndexOf(a).CompareTo(kids.IndexOf(b)); });
            for (int i = 0; i < sorted.Count; i++) if (v[i] != sorted[i]) { sorted[i].RemoveFromHierarchy(); v.Insert(i, sorted[i]); }
        }

        // ---------- Entrada ----------
        static DomElement domOf(VisualElement ve)
        {
            for (var p = ve; p != null; p = p.parent) if (p.userData is DomElement d) return d;
            return null;
        }
        void pointer(string type, IEventHandler target, Vector2 pos, int button)
        {
            var d = Dom.pointerCapture ?? domOf(target as VisualElement);
            if (d == null) return;
            var ev = new DomEvent(type) { clientX = pos.x, clientY = pos.y, button = Math.Max(0, button) };
            d.dispatchUser(ev);
            if (type == "pointerdown" || type == "pointerup" || type == "pointermove") Dom.dispatchWindow(new DomEvent(type) { clientX = pos.x, clientY = pos.y, target = d });
        }

        // ---------- Medidas (IDomHost) ----------
        public DomRect clientRect(DomElement e)
        {
            if (!(e.view is VisualElement v)) return new DomRect();
            // (un elemento sin caja mide lo que ocupan sus palabras)
            if (flatSet.Contains(v) && flatPieces.TryGetValue(e, out var ps) && ps.Count > 0)
            {
                float x0 = float.MaxValue, y0 = float.MaxValue, x1 = float.MinValue, y1 = float.MinValue;
                foreach (var p in ps) { var b = p.worldBound; x0 = Math.Min(x0, b.xMin); y0 = Math.Min(y0, b.yMin); x1 = Math.Max(x1, b.xMax); y1 = Math.Max(y1, b.yMax); }
                return new DomRect { left = x0, top = y0, width = x1 - x0, height = y1 - y0 };
            }
            var r = v.worldBound;
            return new DomRect { left = r.x, top = r.y, width = r.width, height = r.height };
        }
        public void offset(DomElement e, out double left, out double top, out double width, out double height, out DomElement parent)
        {
            left = top = width = height = 0; parent = e.parentElement;
            if (!(e.view is VisualElement v)) return;
            var l = v.layout;
            left = l.x; top = l.y; width = l.width; height = l.height;
        }
        public void client(DomElement e, out double width, out double height)
        {
            width = height = 0;
            if (e.view is VisualElement v) { width = v.layout.width; height = v.layout.height; }
        }
        public void scroll(DomElement e, out double width, out double height) { client(e, out width, out height); }
        bool full;
        public void fullscreen(bool on) { full = on; Screen.fullScreen = on; }
        public bool isFullscreen { get { return Screen.fullScreen; } }
    }
}
