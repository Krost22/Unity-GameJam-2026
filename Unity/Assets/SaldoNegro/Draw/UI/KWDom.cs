// La parte de js/ui/keywords.js que toca el DOM: SN.KW.apply(root, opts). (El resto, SN.KW.html y has, está en
// Logic/Keywords.cs, sin DOM.) Recorre los nodos de texto de `root` y envuelve las palabras clave.
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public static class KWDom
    {
        const string SKIP = "kbd,button,input,textarea,.cx,.cx-k,.cx-brand,[data-nokw],.kw";

        public static DomElement apply(this KW kw, DomElement root, V opts = null)
        {
            if (root == null) return root;
            var nodes = new List<DomText>();
            foreach (var n in root.textNodes())
            {
                if (string.IsNullOrEmpty(n.nodeValue) || !kw.has(n.nodeValue, opts)) continue;
                // Solo cuenta lo que hay DENTRO del elemento (un aviso puede ser un botón entero)
                var p = n.parentElement; bool bad = false;
                while (p != null && p != root) { if (p.matches(SKIP)) { bad = true; break; } p = p.parentElement; }
                if (!bad) nodes.Add(n);
            }
            foreach (var n in nodes)
            {
                var tmp = Dom.createElement("span");
                tmp.innerHTML = kw.html(n.nodeValue, opts);
                n.replaceWith(tmp.childNodes.ToArray());
            }
            return root;
        }
    }
}
