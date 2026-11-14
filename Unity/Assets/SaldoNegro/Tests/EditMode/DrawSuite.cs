// El dibujo del port contra el de Chrome (Refs/Draw-*.json, generados por Unity/Tools~/ref-draw.js): cada sonda es
// una llamada de dibujo de js/render con sus parámetros; el lienzo que sale tiene que tener los mismos bytes.
// Antes de cada sonda, Math.random se reinicia con la misma semilla que en Chrome (12345).
// TEXTO: Chrome en Windows pinta las letras con el halo de ClearType y el port las pinta nítidas, así que donde
// hay letras los bytes no coinciden. Las sondas con letras traen "notext": los píxeles que cambian en Chrome al
// pintar sin texto. Con eso se exige (1) que la imagen SIN texto sea idéntica entera, (2) que la imagen CON texto
// sea idéntica fuera de esos píxeles y (3) que el port no pinte letras fuera de donde las pinta Chrome.
// La forma de cada letra se comprueba aparte (TextTests.cs).
// No usa NUnit: lo llaman DrawTests.cs (EditMode) y el banco rápido de .NET.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro.Tests
{
    public sealed class DrawSuite
    {
        readonly V refs;
        readonly string dataJson;
        public DrawSuite(string refsJson, string dataJson) { refs = Json.parse(refsJson); this.dataJson = dataJson; }

        public int count { get { return refs["probes"].length.i; } }
        public string label(int i) { return Json.stringify(refs["probes"][i]["probe"]); }

        // Las fotos de las noticias (un módulo por carga, como los demás)
        NewsArt news { get { return newsArt ?? (newsArt = new NewsArt()); } }
        NewsArt newsArt;

        // Bytes de la última sonda que no coinciden y caen donde Chrome pinta letras (no cuentan como fallo)
        public int textBytes;

        // La sonda en C#: lo mismo que window.__probe de ref-draw.js
        Canvas probe(V k)
        {
            string kind = k["kind"].str;
            var rng = new RNG(12345);
            JsMath.rndOverride = rng.next;
            if (kind == "sprite") return SN.Sprites.get(k["name"].str);
            if (kind == "hooded") return SN.Chars.hoodedCanvas(k["t"], V.Obj("smile", k["smile"], "look", k["look"]));
            if (kind == "bravo") return SN.Chars.bravoCanvas(k["t"]);
            if (kind == "bravoFace") return SN.Chars.bravoFace();
            if (kind == "face") { var c = Px.canvas(48, 44); var g = Px.ctx(c); SN.Chars.face(g, 24, 4, k["expr"].str, k["t"]); return c; }
            if (kind == "console") { var c = Px.canvas(80, 60); var g = Px.ctx(c); SN.Chars.console(g, 8, 8, k["t"]); return c; }
            if (kind == "backlight") { var c = Px.canvas(80, 80); var g = Px.ctx(c); SN.Chars.hoodBacklight(g, 40, 40, k["t"]); return c; }
            if (kind == "newsColor") return news.color(k["id"].str);
            if (kind == "newsPhoto") return news.photo(k["id"].str, k["tone"].str, k["dark"].num);
            if (kind == "newsNode") return news.node(k["id"].str, k["tone"].str, k["dark"].num, k["crop"].isNullish ? null : k["crop"], V.Obj("color", k["color"], "sticker", k["sticker"].isNullish ? V.undefined : k["sticker"]));
            if (kind == "room")
            {
                // La habitación: partida con semilla, el estado de la sonda y unos fotogramas a 60 por segundo
                JsMath.rndOverride = new RNG(777).next;
                SN.State.newRun();
                V run = SN.State.run;
                if (k["run"]) run.obj.assign(k["run"]);
                if (k["paid"]) { run["debt"]["paid"] = true; run["flags"]["debtPaid"] = true; }
                var D = SN.Desk;
                D.phaseOverride = null; D.hideConsole = false;
                V d = k["desk"];
                if (d)
                {
                    if (d.has("noPC")) D.noPC = d["noPC"].truthy;
                    if (d.has("palaHere")) D.palaHere = d["palaHere"].truthy;
                    if (d.has("palaPos")) D.palaPos = d["palaPos"];
                }
                if (k["glow"]) D.glowTo(k["glow"][0].str, k["glow"][1]);
                if (k["flash"]) D.flashGlow(k["flash"][0].str, k["flash"][1]);
                JsMath.rndOverride = new RNG(12345).next;
                if (k["event"]) D.windowEvent(k["event"].str);
                var c = Px.canvas(320, 180); var g = Px.ctx(c);
                int frames = k["frames"].i;
                for (int f = 0; f < frames; f++) D.render(g, 1.0 / 60);
                return c;
            }
            throw new ArgumentException("sonda " + kind);
        }

        // Pinta la sonda (con o sin texto) en una carga nueva
        byte[] paint(V k, int w, int h, bool noText, out string err)
        {
            SN.LoadAll(dataJson);
            newsArt = null;
            Ctx2D.skipText = noText;
            err = null;
            try
            {
                var c = probe(k);
                if (c.width != w || c.height != h) { err = "tamaño " + c.width + "x" + c.height + " y en Chrome " + w + "x" + h; return null; }
                return c.getContext().getImageData(0, 0, w, h).data;
            }
            finally { JsMath.rndOverride = null; Ctx2D.skipText = false; }
        }

        static string diff(byte[] mine, byte[] chrome, int w, bool[] skip, out int skipped)
        {
            int bad = 0, fx = -1, fy = -1; skipped = 0;
            for (int k = 0; k < mine.Length; k++)
            {
                if (mine[k] == chrome[k]) continue;
                if (skip != null && skip[k / 4]) { skipped++; continue; }
                if (bad == 0) { fx = (k / 4) % w; fy = (k / 4) / w; }
                bad++;
            }
            if (bad == 0) return null;
            int o = (fy * w + fx) * 4;
            return bad + " bytes distintos; el primero en (" + fx + "," + fy + ") port " + mine[o] + "," + mine[o + 1] + "," + mine[o + 2] + "," + mine[o + 3] + " / Chrome " + chrome[o] + "," + chrome[o + 1] + "," + chrome[o + 2] + "," + chrome[o + 3];
        }

        // Medido: las diferencias de las fotos con letras quedan a 1 px (31 fotos), 2 px (5) y 3 px (1) de las letras
        public static int NEWS_REACH = 3;

        // La máscara, ensanchada n píxeles en todas las direcciones
        static bool[] grow(bool[] m, int w, int h, int n)
        {
            if (n <= 0) return m;
            var o = new bool[m.Length];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                if (!m[y * w + x]) continue;
                for (int j = Math.Max(0, y - n); j <= Math.Min(h - 1, y + n); j++)
                    for (int i = Math.Max(0, x - n); i <= Math.Min(w - 1, x + n); i++) o[j * w + i] = true;
            }
            return o;
        }
        // A cuántos píxeles de la máscara queda la diferencia más lejana
        static int reach(byte[] a, byte[] b, bool[] m, int w, int h)
        {
            int far = 0;
            for (int q = 0; q < w * h; q++)
            {
                int o = q * 4;
                if (m[q] || (a[o] == b[o] && a[o + 1] == b[o + 1] && a[o + 2] == b[o + 2] && a[o + 3] == b[o + 3])) continue;
                int x = q % w, y = q / w, best = 99;
                for (int r = 1; r < 12 && best == 99; r++)
                    for (int j = Math.Max(0, y - r); j <= Math.Min(h - 1, y + r) && best == 99; j++)
                        for (int i = Math.Max(0, x - r); i <= Math.Min(w - 1, x + r); i++) if (m[j * w + i]) { best = r; break; }
                far = Math.Max(far, best);
            }
            return far;
        }

        // Ejecuta la sonda i. null si sale igual; si no, un resumen de las diferencias.
        // mine / chrome: las imágenes que se compararon (para guardarlas y mirarlas).
        public string run(int i, out byte[] mine, out byte[] chrome, out int w, out int h)
        {
            V p = refs["probes"][i];
            chrome = Convert.FromBase64String(p["rgba"].str); w = p["w"].i; h = p["h"].i;
            textBytes = 0;
            mine = paint(p["probe"], w, h, false, out string err);
            if (err != null) return label(i) + ": " + err;
            V nt = p["notext"];
            if (!nt.truthy)
            {
                string r0 = diff(mine, chrome, w, null, out _);
                return r0 == null ? null : label(i) + ": " + r0;
            }
            // Dónde pinta letras Chrome, y su imagen sin ellas
            byte[] idx = Convert.FromBase64String(nt["idx"].str), px = Convert.FromBase64String(nt["rgba"].str);
            var text = new bool[w * h];
            var bare = (byte[])chrome.Clone();
            for (int k = 0; k < idx.Length; k += 4)
            {
                int q = BitConverter.ToInt32(idx, k);
                text[q] = true;
                Array.Copy(px, k, bare, q * 4, 4);
            }
            // (1) Sin texto: todo igual
            byte[] mineBare = paint(p["probe"], w, h, true, out err);
            if (err != null) return label(i) + " (sin texto): " + err;
            string r = diff(mineBare, bare, w, null, out _);
            if (r != null) { mine = mineBare; chrome = bare; return label(i) + " (sin texto): " + r; }
            // (2) Con texto: igual fuera de las letras
            // Las fotos de las noticias se retocan después de pintar (polish: contornos y trama, que miran a los
            // píxeles vecinos), así que una letra con halo y una letra nítida cambian también a sus vecinos: ahí
            // el margen son NEWS_REACH píxeles alrededor de donde Chrome nota el texto.
            bool news = p["probe"]["kind"].str.StartsWith("news");
            if (news) text = grow(text, w, h, NEWS_REACH);
            r = diff(mine, chrome, w, text, out textBytes);
            if (r != null) return label(i) + " (fuera de las letras): " + r + "; a " + reach(mine, chrome, text, w, h) + " px de ellas";
            // (3) Las letras del port, dentro de donde las pinta Chrome
            int stray = 0, sx = -1, sy = -1;
            for (int q = 0; q < w * h; q++)
            {
                if (text[q]) continue;
                int o = q * 4;
                if (mine[o] != mineBare[o] || mine[o + 1] != mineBare[o + 1] || mine[o + 2] != mineBare[o + 2] || mine[o + 3] != mineBare[o + 3]) { if (stray == 0) { sx = q % w; sy = q / w; } stray++; }
            }
            if (stray > 0) return label(i) + ": el port pinta letras en " + stray + " píxeles donde Chrome no (el primero en " + sx + "," + sy + ")";
            return null;
        }
    }
}
