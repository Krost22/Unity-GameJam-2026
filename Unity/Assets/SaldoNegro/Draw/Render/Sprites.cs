// Port de js/render/sprites.js (SN.Sprites): sprites pequeños (iconos, monedas, cursor) dibujados en texto.
// Las filas vienen de Resources/SaldoNegro/Sprites.json (generado desde sprites.js); cada una se cachea como lienzo.
// url() y node() son solo del DOM: van a la capa de interfaz.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Sprites
    {
        // De dónde sale Sprites.json (la capa del juego lo lee de Resources; las pruebas, del disco)
        public static Func<string> source;

        static Dictionary<string, string[]> defs;
        readonly Dictionary<string, Canvas> cache = new Dictionary<string, Canvas>();

        // Filas de cada sprite (DEFS en JS), leídas una sola vez
        static Dictionary<string, string[]> DEFS
        {
            get
            {
                if (defs == null) defs = load();
                return defs;
            }
        }

        static Dictionary<string, string[]> load()
        {
            if (source == null) throw new InvalidOperationException("Sprites.source sin poner: nadie ha dicho de dónde leer Sprites.json");
            V root = Json.parse(source());
            var d = new Dictionary<string, string[]>();
            foreach (var kv in root.obj)
            {
                V rows = kv.Value;
                int n = rows.length.i;
                var arr = new string[n];
                for (int i = 0; i < n; i++) arr[i] = rows[i].str;
                d[kv.Key] = arr;
            }
            return d;
        }

        public Canvas get(string name)
        {
            if (!cache.TryGetValue(name, out var c))
            {
                c = Px.fromRows(DEFS[name]);
                cache[name] = c;
            }
            return c;
        }

        // "Data URL" escalada (fondos CSS, cursores). En la web es el PNG del lienzo en base64; aquí es una dirección
        // propia, sprite:nombre@escala, que el reflejo del DOM resuelve con byUrl() cuando la ve en un url(...).
        readonly Dictionary<string, Canvas> urls = new Dictionary<string, Canvas>();
        public string url(string name, double scale = 1)
        {
            string k = "sprite:" + name + "@" + Js.String(scale);
            if (!urls.ContainsKey(k)) urls[k] = Px.scaled(get(name), (int)scale);
            return k;
        }
        public Canvas byUrl(string url) { return url != null && urls.TryGetValue(url, out var c) ? c : null; }

        // Canvas pequeño listo para insertar en el DOM
        public DomElement node(string name, double scale = 1)
        {
            var src = get(name);
            var c = Dom.canvasEl(Px.scaled(src, (int)scale));
            c.style.width = c.width + "px";
            c.style.height = c.height + "px";
            return c;
        }

        // Fotograma de la moneda girando (4 fotogramas)
        public Canvas coinFrame(double t) { return get("coin" + Js.String(Math.Floor(t) % 4)); }
    }
}
