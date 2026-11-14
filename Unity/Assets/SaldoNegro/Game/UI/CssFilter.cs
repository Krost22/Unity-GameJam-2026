// filter de CSS en UI Toolkit (Unity 6.3 tiene filter en los VisualElement). El juego usa brightness, grayscale,
// contrast y saturate (css/style.css: botones deshabilitados, iconos bloqueados, #desk.gray, y las animaciones
// poweron, pulse, flashy y donepop). Unity no trae brightness ni saturate, y para que las cuatro hagan lo mismo
// que el navegador van todas por un filtro propio (Resources/SaldoNegro/CssFilter.shader) con las matrices de
// Filter Effects 1. Como en CSS, la lista se aplica en orden y el filtro afecta al elemento con sus hijos.
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public static class CssFilter
    {
        // Una función de la lista: nombre y cantidad (los porcentajes ya pasados a número: 70% -> 0.7)
        public struct Fn
        {
            public string name;
            public double amount;
        }

        static readonly string[] KINDS = { "brightness", "saturate", "grayscale", "contrast" };

        // Valor con el que una función no cambia nada (el que se usa al interpolar con una que falta)
        static double identity(string name) { return name == "grayscale" ? 0 : 1; }

        // "grayscale(.7) brightness(.75)" -> lista; "none" o vacío -> lista vacía; null si trae algo que no sabemos hacer
        public static List<Fn> Parse(string css)
        {
            var o = new List<Fn>();
            if (string.IsNullOrWhiteSpace(css)) return o;
            css = css.Trim().Trim('"', '\'');
            if (css == "none") return o;
            int i = 0;
            while (i < css.Length)
            {
                while (i < css.Length && char.IsWhiteSpace(css[i])) i++;
                if (i >= css.Length) break;
                int open = css.IndexOf('(', i), close = open < 0 ? -1 : css.IndexOf(')', open);
                if (open < 0 || close < 0) return null;
                string name = css.Substring(i, open - i).Trim();
                string arg = css.Substring(open + 1, close - open - 1).Trim();
                if (Array.IndexOf(KINDS, name) < 0) return null;
                double amount;
                if (arg.Length == 0) amount = 1;
                else if (arg.EndsWith("%")) { if (!double.TryParse(arg.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out amount)) return null; amount /= 100; }
                else if (!double.TryParse(arg, NumberStyles.Float, CultureInfo.InvariantCulture, out amount)) return null;
                // como el navegador: grayscale no pasa de 1 y ninguna baja de 0
                amount = Math.Max(0, amount);
                if (name == "grayscale") amount = Math.Min(1, amount);
                o.Add(new Fn { name = name, amount = amount });
                i = close + 1;
            }
            return o;
        }

        public static bool Same(List<Fn> a, List<Fn> b)
        {
            if (a == null || b == null) return a == b;
            if (a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; i++) if (a[i].name != b[i].name || a[i].amount != b[i].amount) return false;
            return true;
        }

        // Interpolación de CSS: si una lista es el principio de la otra (o está vacía), las que faltan valen su
        // identidad y se interpolan función a función; si las funciones no casan, el navegador interpola las
        // matrices, que para estas cuatro (lineales en su cantidad cuando van solas) se acerca con el cambio a
        // mitad de camino.
        public static List<Fn> Lerp(List<Fn> a, List<Fn> b, double k)
        {
            int n = Math.Max(a.Count, b.Count);
            for (int i = 0; i < Math.Min(a.Count, b.Count); i++) if (a[i].name != b[i].name) return k < 0.5 ? a : b;
            var o = new List<Fn>(n);
            for (int i = 0; i < n; i++)
            {
                string name = i < a.Count ? a[i].name : b[i].name;
                double x = i < a.Count ? a[i].amount : identity(name), y = i < b.Count ? b[i].amount : identity(name);
                o.Add(new Fn { name = name, amount = x + (y - x) * k });
            }
            return o;
        }

        static FilterFunctionDefinition def;
        static bool defFailed;

        static FilterFunctionDefinition Definition()
        {
            if (def != null || defFailed) return def;
            var shader = Resources.Load<Shader>("SaldoNegro/CssFilter");
            if (shader == null || !shader.isSupported)
            {
                defFailed = true;
                Debug.LogError("SALDO NEGRO: no se puede usar Resources/SaldoNegro/CssFilter.shader; los filter de CSS no se verán");
                return null;
            }
            var mat = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
            def = ScriptableObject.CreateInstance<FilterFunctionDefinition>();
            def.hideFlags = HideFlags.HideAndDontSave;
            def.filterName = "css";
            def.parameters = new[]
            {
                new FilterParameterDeclaration { interpolationDefaultValue = new FilterParameter(0f) },
                new FilterParameterDeclaration { interpolationDefaultValue = new FilterParameter(1f) },
            };
            def.passes = new[]
            {
                new PostProcessingPass
                {
                    material = mat,
                    passIndex = 0,
                    parameterBindings = new[] { new ParameterBinding { index = 0, name = "_Kind" }, new ParameterBinding { index = 1, name = "_Amount" } },
                    writeMargins = new PostProcessingMargins(),
                },
            };
            return def;
        }

        // Pone la lista en el elemento (vacía: sin filtro)
        public static void Apply(VisualElement v, List<Fn> list)
        {
            if (list == null || list.Count == 0) { v.style.filter = new StyleList<FilterFunction>(StyleKeyword.Null); return; }
            var d = Definition();
            if (d == null) return;
            var fs = new List<FilterFunction>(list.Count);
            foreach (var f in list)
            {
                var ff = new FilterFunction(d);
                ff.AddParameter(new FilterParameter((float)Array.IndexOf(KINDS, f.name)));
                ff.AddParameter(new FilterParameter((float)f.amount));
                fs.Add(ff);
            }
            v.style.filter = new StyleList<FilterFunction>(fs);
        }
    }
}
