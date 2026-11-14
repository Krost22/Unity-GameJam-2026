// Animaciones (@keyframes) y transiciones CSS de los elementos del reflejo. USS no las tiene: la hoja convertida
// (Unity/Tools~/css2uss.js) deja la abreviatura en --sn-animation (y los longhands --sn-animation-name/-duration/-delay)
// y --sn-transition, y los fotogramas clave en Resources/SaldoNegro/Keyframes.json. Aquí se hace lo que hace el
// navegador, con el reloj del juego (Dom.now(), que avanza con Dom.tick: determinista y igual en las pruebas):
//   · una animación empieza cuando el elemento recibe su nombre y vuelve a empezar si se quita y se pone;
//   · iteraciones, dirección, relleno (both / forwards / backwards) y retraso como en CSS; la temporización se aplica
//     dentro de cada intervalo entre fotogramas clave; a un fotograma que no fija una propiedad le sirve el valor base;
//   · lo animado REEMPLAZA al valor base mientras la animación lo controla (transform, opacity, color, background,
//     box-shadow, translate, y width/height/left/top en las transiciones);
//   · las transiciones van de un valor base al siguiente con la temporización de la regla.
// filter va por CssFilter (filtro propio de UI Toolkit). Lo que no se puede reproducir (clip-path, background-position) se
// deja fuera y se anota en Keyframes.json; ver Props sin soporte abajo.
using System;
using System.Collections.Generic;
using System.Globalization;
using SaldoNegro.Logic;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class CssAnimator
    {
        // Propiedades propias que llegan con el estilo resuelto (las escribe css2uss.js)
        static readonly CustomStyleProperty<string> P_ANIM = new CustomStyleProperty<string>("--sn-animation");
        static readonly CustomStyleProperty<string> P_ANIM_NAME = new CustomStyleProperty<string>("--sn-animation-name");
        static readonly CustomStyleProperty<string> P_ANIM_DUR = new CustomStyleProperty<string>("--sn-animation-duration");
        static readonly CustomStyleProperty<string> P_ANIM_DELAY = new CustomStyleProperty<string>("--sn-animation-delay");
        static readonly CustomStyleProperty<string> P_TRANS = new CustomStyleProperty<string>("--sn-transition");

        // Propiedades que se animan o hacen transición. El resto de @keyframes no tiene equivalente en UI Toolkit.
        static readonly HashSet<string> ANIMATABLE = new HashSet<string> { "transform", "translate", "opacity", "color", "background-color", "box-shadow", "filter" };
        static readonly HashSet<string> TRANSITIONABLE = new HashSet<string> { "opacity", "transform", "width", "height", "left", "top", "filter" };

        // ---------- Fotogramas clave (Keyframes.json, aplanados por propiedad) ----------
        sealed class RawKf { public double off; public string prop, val; }
        static Dictionary<string, List<RawKf>> keyframes;
        static Dictionary<string, List<RawKf>> Keyframes
        {
            get
            {
                if (keyframes != null) return keyframes;
                keyframes = new Dictionary<string, List<RawKf>>();
                var asset = Resources.Load<TextAsset>("SaldoNegro/Keyframes");
                if (asset == null) { Debug.LogError("SALDO NEGRO: falta Resources/SaldoNegro/Keyframes.json (Unity/Tools~/css2uss.js)"); return keyframes; }
                var root = Json.parse(asset.text);
                foreach (var name in root.obj.keys())
                {
                    var list = new List<RawKf>();
                    foreach (var frame in root[name])
                    {
                        var offs = new List<double>();
                        foreach (var at in frame["at"]) offs.Add(OffsetOf(at.str));
                        foreach (var d in frame["decls"])
                            foreach (var off in offs) list.Add(new RawKf { off = off, prop = d[0].str, val = d[1].str });
                    }
                    keyframes[name] = list;
                }
                return keyframes;
            }
        }
        static double OffsetOf(string at)
        {
            if (at == "from") return 0;
            if (at == "to") return 1;
            if (at.EndsWith("%") && double.TryParse(at.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out double p)) return p / 100.0;
            return 0;
        }

        // Un fotograma clave ya parseado (transform: Tf; opacidad: double; color: Color; sombras: lista)
        struct Kf { public double off; public object val; }

        // ---------- Estado por elemento ----------
        sealed class Inst
        {
            public AnimSpec spec;
            public double start;                       // ms del reloj del juego en que empezó
            public Dictionary<string, List<Kf>> tracks; // compilado al primer fotograma (con las variables del elemento)
        }
        sealed class Run
        {
            public object from, to;
            public double start, delay, duration;      // ms, s, s
            public Easing easing;
        }
        sealed class El
        {
            public DomElement e;
            public VisualElement v;
            public string animKey = "", transKey = "";
            public List<Inst> insts = new List<Inst>();
            public List<TransSpec> trans = new List<TransSpec>();
            public HashSet<string> driven = new HashSet<string>();   // lo que controla una animación o transición este fotograma
            public Dictionary<string, object> last = new Dictionary<string, object>();   // último valor base visto (transiciones)
            public Dictionary<string, Run> runs = new Dictionary<string, Run>();
            public double baseOpacity = 1;
            public Color baseColor = Color.black, baseBg = Color.clear;
        }
        readonly Dictionary<DomElement, El> els = new Dictionary<DomElement, El>();

        // Lo llama DomView cuando UI Toolkit resuelve el estilo del elemento
        public void noteStyle(DomElement e, VisualElement v)
        {
            string an = str(e, v, P_ANIM), nm = str(e, v, P_ANIM_NAME), du = str(e, v, P_ANIM_DUR), de = str(e, v, P_ANIM_DELAY), tr = str(e, v, P_TRANS);
            string key = an + "|" + nm + "|" + du + "|" + de;
            bool none = IsNone(an) && IsNone(nm) && IsNone(tr);
            if (!els.TryGetValue(e, out var el))
            {
                if (none) return;
                el = new El { e = e, v = v };
                els[e] = el;
            }
            el.v = v;
            if (key != el.animKey)
            {
                el.animKey = key;
                el.insts = build(e, v, el.insts, an, nm, du, de);
            }
            if (tr != el.transKey)
            {
                el.transKey = tr;
                el.trans = tr == "none" ? new List<TransSpec>() : TransSpec.ParseList(tr);
                el.last.Clear(); el.runs.Clear();
            }
        }

        // ¿Lo controla una animación o transición en este fotograma? (DomView no escribe esas propiedades)
        public bool drives(DomElement e, string prop)
        {
            return e != null && els.TryGetValue(e, out var el) && el.driven.Contains(prop);
        }

        // Crea las animaciones del elemento; las que siguen con el mismo nombre conservan su inicio
        List<Inst> build(DomElement e, VisualElement v, List<Inst> old, string an, string nm, string du, string de)
        {
            var specs = AnimSpec.ParseList(an);
            var names = longhand(nm, "none");
            var durs = longhand(du, "0s");
            var dels = longhand(de, "0s");
            if (specs.Count == 0 && names != null)
                foreach (var n in names) specs.Add(new AnimSpec { name = n, easing = Easing.Parse("ease"), iterations = 1 });
            var list = new List<Inst>();
            var seen = new Dictionary<string, int>();
            double now = Dom.now();
            for (int i = 0; i < specs.Count; i++)
            {
                var s = specs[i];
                if (names != null && names.Count > 0) s.name = names[i % names.Count];
                if (s.name == null || s.name == "none" || !Keyframes.ContainsKey(s.name)) continue;
                if (durs != null && durs.Count > 0 && CssLin.TryParse(durs[i % durs.Count], out Lin d)) s.duration = d.sec;
                if (dels != null && dels.Count > 0 && CssLin.TryParse(dels[i % dels.Count], out Lin dl)) s.delay = dl.sec;
                // mismo nombre y misma aparición que antes: sigue corriendo; si no, empieza ahora
                int occ = seen.TryGetValue(s.name, out int k0) ? k0 : 0;
                seen[s.name] = occ + 1;
                double start = now;
                int seenOld = 0;
                foreach (var o in old)
                    if (o.spec.name == s.name && seenOld++ == occ) { start = o.start; break; }
                list.Add(new Inst { spec = s, start = start });
            }
            return list;
        }

        // Valor de una longitud de lista (--sn-animation-*): null si es el valor por defecto de la hoja
        static List<string> longhand(string s, string def)
        {
            if (string.IsNullOrWhiteSpace(s) || s == def) return null;
            var l = new List<string>();
            foreach (var part in CssLin.SplitTop(s, ',')) l.Add(part.Trim());
            return l;
        }

        static bool IsNone(string s) { return s == "" || s == "none"; }

        // Valor de una propiedad propia con las variables del elemento (calc(var(--i) * -.2s)); "" si no la tiene
        static string str(DomElement e, VisualElement v, CustomStyleProperty<string> p)
        {
            if (!v.customStyle.TryGetValue(p, out var s) || s == null) return "";
            return (CssVars.resolve(s, e) ?? "").Trim();
        }

        // ---------- Un fotograma ----------
        // Avanza todo a `nowMs` (reloj del juego) y escribe lo que las animaciones y transiciones controlan.
        public void step(double nowMs)
        {
            if (els.Count == 0) return;
            List<DomElement> dead = null;
            foreach (var kv in els)
            {
                var el = kv.Value;
                if (el.v == null || el.v.panel == null)
                {
                    // el elemento salió del panel: no queda nada que animar (si vuelve, el estilo lo vuelve a anotar)
                    if (dead == null) dead = new List<DomElement>();
                    dead.Add(kv.Key);
                    continue;
                }
                if (el.insts.Count == 0 && el.trans.Count == 0 && el.driven.Count == 0 && el.runs.Count == 0)
                {
                    if (dead == null) dead = new List<DomElement>();
                    dead.Add(kv.Key);
                    continue;
                }
                // valores base del CSS (los que USS da al elemento sin animar)
                if (!el.driven.Contains("opacity")) el.baseOpacity = el.v.resolvedStyle.opacity;
                if (!el.driven.Contains("color")) el.baseColor = el.v.resolvedStyle.color;
                if (!el.driven.Contains("background-color")) el.baseBg = el.v.resolvedStyle.backgroundColor;

                var over = new Dictionary<string, object>();
                foreach (var it in el.insts)
                {
                    if (it.tracks == null) it.tracks = compile(el, it.spec.name);
                    if (!phase(it.spec, (nowMs - it.start) / 1000.0, out double p)) continue;
                    foreach (var tk in it.tracks)
                        over[tk.Key] = sample(el, tk.Key, tk.Value, p, it.spec.easing);
                }
                foreach (var t in el.trans)
                {
                    if (over.ContainsKey(t.prop)) continue;
                    transition(el, t, nowMs, over);
                }

                // Lo que dejó de controlarse vuelve a su valor base; después se escribe lo nuevo (translate y
                // transform se escriben juntos, así que el orden importa)
                var driven = new HashSet<string>(over.Keys);
                foreach (var prop in el.driven)
                    if (!driven.Contains(prop)) DomView.restoreBase(el.e, el.v, prop);
                foreach (var o in over) apply(el, o.Key, o.Value);
                el.driven = driven;
            }
            if (dead != null) foreach (var d in dead) els.Remove(d);
        }

        // Fase de una animación en el tiempo `elapsed` (s): devuelve el progreso de la iteración (0..1, con la
        // dirección ya aplicada), o false si la animación no pinta nada en ese momento
        static bool phase(AnimSpec s, double elapsed, out double p)
        {
            p = 0;
            double local = elapsed - s.delay;
            double dur = s.duration;
            int idx; double frac;
            if (local < 0)
            {
                if (!s.fillBackwards) return false;
                idx = 0; frac = 0;
            }
            else if (dur <= 0)
            {
                if (!s.fillForwards) return false;
                idx = 0; frac = 1;
            }
            else if (local >= s.iterations * dur)
            {
                if (!s.fillForwards) return false;
                idx = (int)Math.Ceiling(s.iterations) - 1; frac = 1;
            }
            else
            {
                idx = (int)Math.Floor(local / dur);
                frac = (local - idx * dur) / dur;
            }
            bool reverse = s.direction == "reverse"
                || (s.direction == "alternate" && idx % 2 == 1)
                || (s.direction == "alternate-reverse" && idx % 2 == 0);
            p = reverse ? 1 - frac : frac;
            return true;
        }

        // Valor animado de una propiedad en el progreso p: interpolación entre los fotogramas que la fijan
        object sample(El el, string prop, List<Kf> frames, double p, Easing easing)
        {
            var list = new List<Kf>(frames);
            object b = baseOf(el, prop);
            if (b != null)
            {
                if (list[0].off > 0) list.Insert(0, new Kf { off = 0, val = b });
                if (list[list.Count - 1].off < 1) list.Add(new Kf { off = 1, val = b });
            }
            if (p <= list[0].off) return list[0].val;
            if (p >= list[list.Count - 1].off) return list[list.Count - 1].val;
            for (int i = 0; i < list.Count - 1; i++)
            {
                var a = list[i]; var c = list[i + 1];
                if (p >= a.off && p <= c.off)
                {
                    double span = c.off - a.off;
                    double k = span > 0 ? (p - a.off) / span : 1;
                    return mix(a.val, c.val, easing.Apply(k));
                }
            }
            return list[list.Count - 1].val;
        }

        // Transiciones: cuando cambia el valor base de una propiedad, se va del valor que se veía al nuevo
        void transition(El el, TransSpec ts, double nowMs, Dictionary<string, object> over)
        {
            string prop = ts.prop;
            if (!TRANSITIONABLE.Contains(prop)) return;
            object target = transTarget(el, prop);
            if (target == null) { el.runs.Remove(prop); el.last.Remove(prop); return; }
            if (!el.last.TryGetValue(prop, out object last)) el.last[prop] = target;
            else if (!same(last, target))
            {
                object from = el.runs.TryGetValue(prop, out var r0) ? runValue(r0, nowMs, out _) : last;
                el.runs[prop] = new Run { from = from, to = target, start = nowMs, delay = ts.delay, duration = ts.duration, easing = ts.easing };
                el.last[prop] = target;
            }
            if (el.runs.TryGetValue(prop, out var r))
            {
                object val = runValue(r, nowMs, out bool done);
                if (done) el.runs.Remove(prop); else over[prop] = val;
            }
        }

        static object runValue(Run r, double nowMs, out bool done)
        {
            double t = (nowMs - r.start) / 1000.0 - r.delay;
            done = false;
            if (t < 0) return r.from;
            if (r.duration <= 0 || t >= r.duration) { done = true; return r.to; }
            return mix(r.from, r.to, r.easing.Apply(t / r.duration));
        }

        static object transTarget(El el, string prop)
        {
            switch (prop)
            {
                case "opacity":
                    {
                        string s = el.e.style["opacity"];
                        if (!string.IsNullOrEmpty(s) && float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out float f)) return (double)f;
                        return el.baseOpacity;
                    }
                case "transform": return DomView.baseXf(el.e, el.v);
                case "filter": return DomView.baseFilter(el.e, el.v);
                case "width": case "height": case "left": case "top":
                    {
                        string s = el.e.style[prop];
                        if (string.IsNullOrEmpty(s) || !CssLin.TryParse(s, out Lin l)) return null;
                        return l;
                    }
            }
            return null;
        }

        // Valor base de una propiedad (lo que tendría sin la animación) para completar los fotogramas
        static object baseOf(El el, string prop)
        {
            switch (prop)
            {
                case "transform": return DomView.baseXf(el.e, el.v);
                case "translate": { var t = DomView.baseXf(el.e, el.v); return new Tf { tx = t.tx, ty = t.ty, sx = 1, sy = 1 }; }
                case "opacity": return el.baseOpacity;
                case "color": return el.baseColor;
                case "background-color": return el.baseBg;
                case "box-shadow": return el.v is BoxElement b ? new List<BoxElement.Shadow>(b.baseShadows) : null;
                case "filter": return DomView.baseFilter(el.e, el.v);
            }
            return null;
        }

        // Escribe un valor animado en el VisualElement
        void apply(El el, string prop, object val)
        {
            var v = el.v;
            switch (prop)
            {
                case "transform":
                    DomView.applyTf(v, (Tf)val);
                    break;
                case "translate":
                    {
                        var t = (Tf)val;
                        v.style.translate = new StyleTranslate(new Translate(DomView.lenOf(t.tx, v.layout.width), DomView.lenOf(t.ty, v.layout.height)));
                        break;
                    }
                case "opacity": v.style.opacity = new StyleFloat((float)(double)val); break;
                case "color": v.style.color = new StyleColor((Color)val); break;
                case "background-color": v.style.backgroundColor = new StyleColor((Color)val); break;
                case "box-shadow": if (v is BoxElement b) b.setAnimShadows((List<BoxElement.Shadow>)val); break;
                case "filter": DomView.setFilter(v, (List<CssFilter.Fn>)val); break;
                case "width": v.style.width = new StyleLength(DomView.lenOf((Lin)val, v.parent != null ? v.parent.layout.width : 0)); break;
                case "height": v.style.height = new StyleLength(DomView.lenOf((Lin)val, v.parent != null ? v.parent.layout.height : 0)); break;
                case "left": v.style.left = new StyleLength(DomView.lenOf((Lin)val, v.parent != null ? v.parent.layout.width : 0)); break;
                case "top": v.style.top = new StyleLength(DomView.lenOf((Lin)val, v.parent != null ? v.parent.layout.height : 0)); break;
            }
        }

        // ---------- Compilado de fotogramas clave para un elemento ----------
        Dictionary<string, List<Kf>> compile(El el, string name)
        {
            var o = new Dictionary<string, List<Kf>>();
            if (!Keyframes.TryGetValue(name, out var raws)) return o;
            foreach (var r in raws)
            {
                string prop = r.prop == "background" ? "background-color" : r.prop;
                if (!ANIMATABLE.Contains(prop)) continue;
                string val = CssVars.resolve(r.val, el.e);
                object parsed = parseValue(prop, val, el.v.resolvedStyle.color);
                if (parsed == null) continue;
                if (!o.TryGetValue(prop, out var list)) o[prop] = list = new List<Kf>();
                list.Add(new Kf { off = r.off, val = parsed });
            }
            foreach (var l in o.Values) l.Sort((a, b) => a.off.CompareTo(b.off));
            return o;
        }

        static object parseValue(string prop, string val, Color current)
        {
            if (string.IsNullOrEmpty(val)) return null;
            switch (prop)
            {
                case "transform":
                    return CssXf.TryParse(val, out Tf t) ? (object)t : null;
                case "translate":
                    {
                        var parts = CssLin.SplitTop(val, ' ');
                        if (parts.Count < 1 || parts.Count > 2) return null;
                        if (!CssLin.TryParse(parts[0], out Lin x)) return null;
                        Lin y = default(Lin);
                        if (parts.Count == 2 && !CssLin.TryParse(parts[1], out y)) return null;
                        return new Tf { tx = x, ty = y, sx = 1, sy = 1 };
                    }
                case "opacity":
                    return double.TryParse(val, NumberStyles.Float, CultureInfo.InvariantCulture, out double op) ? (object)op : null;
                case "color":
                case "background-color":
                    {
                        if (val.Contains("gradient") || val.Contains("url(")) return null;
                        var c = parseColor(val);
                        return c.HasValue ? (object)c.Value : null;
                    }
                case "box-shadow":
                    return parseShadows(val, current);
                case "filter":
                    return CssFilter.Parse(val);
            }
            return null;
        }

        static Color? parseColor(string css)
        {
            try
            {
                var c = CssColor.parse(css.Trim());
                return new Color(c.r / 255f, c.g / 255f, c.b / 255f, (float)c.a);
            }
            catch (Exception) { return null; }
        }

        // "0 -2px 0 0 var(--orange), inset 0 0 0 1px #000": (var ya resuelto)
        static List<BoxElement.Shadow> parseShadows(string val, Color current)
        {
            var o = new List<BoxElement.Shadow>();
            if (val == "none") return o;
            foreach (var part in CssLin.SplitTop(val, ','))
            {
                var s = new BoxElement.Shadow { color = current };
                var nums = new List<double>();
                var colorTokens = new List<string>();
                foreach (var tok in CssLin.SplitTop(part.Trim(), ' '))
                {
                    if (tok == "inset") { s.inset = true; continue; }
                    if (CssLin.TryParse(tok, out Lin l) && l.pct == 0 && l.deg == 0 && l.sec == 0) { nums.Add(l.px + l.num); continue; }
                    colorTokens.Add(tok);
                }
                if (nums.Count < 2) continue;
                s.x = (float)nums[0]; s.y = (float)nums[1];
                s.blur = nums.Count > 2 ? (float)Math.Max(0, nums[2]) : 0;
                s.spread = nums.Count > 3 ? (float)nums[3] : 0;
                if (colorTokens.Count > 0)
                {
                    var c = parseColor(string.Join(" ", colorTokens));
                    if (c.HasValue) s.color = c.Value;
                }
                o.Add(s);
            }
            return o;
        }

        // Dos valores base o animados del mismo tipo: iguales (para no empezar una transición sin cambio)
        static bool same(object a, object b)
        {
            if (a is double da && b is double db) return da == db;
            if (a is Tf ta && b is Tf tb) return Tf.Same(ta, tb);
            if (a is Lin la && b is Lin lb) return Tf.Same(la, lb);
            if (a is List<CssFilter.Fn> fa && b is List<CssFilter.Fn> fb) return CssFilter.Same(fa, fb);
            return false;
        }

        // Mezcla de dos valores del mismo tipo con la fracción k (0..1)
        static object mix(object a, object b, double k)
        {
            if (a is Tf ta && b is Tf tb) return Tf.Lerp(ta, tb, k);
            if (a is Lin la && b is Lin lb) return la.Lerp(lb, k);
            if (a is double da && b is double db) return da + (db - da) * k;
            if (a is List<CssFilter.Fn> fa && b is List<CssFilter.Fn> fb) return CssFilter.Lerp(fa, fb, k);
            if (a is Color ca && b is Color cb) return new Color(ca.r + (cb.r - ca.r) * (float)k, ca.g + (cb.g - ca.g) * (float)k, ca.b + (cb.b - ca.b) * (float)k, ca.a + (cb.a - ca.a) * (float)k);
            if (a is List<BoxElement.Shadow> sa && b is List<BoxElement.Shadow> sb)
            {
                // (como CSS: la lista más corta se completa con sombras transparentes de tamaño 0)
                var none = new BoxElement.Shadow { color = new Color(0, 0, 0, 0) };
                int n = Math.Max(sa.Count, sb.Count);
                var o = new List<BoxElement.Shadow>();
                for (int i = 0; i < n; i++)
                {
                    var x = i < sa.Count ? sa[i] : none; var y = i < sb.Count ? sb[i] : none;
                    o.Add(new BoxElement.Shadow
                    {
                        inset = k < 0.5 ? x.inset : y.inset,
                        x = (float)(x.x + (y.x - x.x) * k), y = (float)(x.y + (y.y - x.y) * k),
                        blur = (float)(x.blur + (y.blur - x.blur) * k), spread = (float)(x.spread + (y.spread - x.spread) * k),
                        color = (Color)mix(x.color, y.color, k),
                    });
                }
                return o;
            }
            // (valores que no se interpolan: a mitad de camino cambian al nuevo)
            return k < 0.5 ? a : b;
        }
    }
}
