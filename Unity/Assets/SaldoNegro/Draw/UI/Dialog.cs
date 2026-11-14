// Port de js/ui/dialog.js (SN.Dialog). Ventanas de diálogo integradas en el monitor: retrato animado, texto a máquina y,
// en el tutorial, pequeños ejemplos animados.
// Se avanza con un clic EN CUALQUIER PARTE o con ESPACIO / ENTER (y se dice en pantalla).
// Un diálogo "sticky" es una indicación que no bloquea: se queda visible mientras haces lo que pide.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Dialog
    {
        public DomElement el, txt, portrait, demo, catcher;
        public List<string> lines = new List<string>();
        public int idx;
        public double shown;
        public string full = "";
        public Action resolve;
        public double t;
        public V opts;
        public bool active;   // esperando a que el jugador avance (bloquea el resto de la interfaz)
        public double shownAt;
        public double glyphT;

        public void init()
        {
            // Cualquier clic (dentro o fuera del monitor) avanza el diálogo abierto
            Dom.document.addEventListener("click", (e) =>
            {
                if (!active || Dom.now() - shownAt < 150) return;
                if (e.target != null && e.target.closest("#btn-skip") != null) return;
                advance();
            });
        }

        // Muestra una lista de frases; devuelve una promesa que se resuelve al cerrar la última.
        // opts: { pos, name, demo, glitchy, smile, voice, portrait ('bravo' | 'none'), sticky }
        public Promise show(V lines, V opts = null)
        {
            hide();
            this.opts = opts ?? V.Obj();
            this.lines = new List<string>();
            foreach (V l in lines) this.lines.Add(l.str);
            idx = 0;
            active = !this.opts["sticky"].truthy;
            shownAt = Dom.now();
            DomElement layer = Dom.byId("layer-dialog");
            V pos = this.opts["pos"] || V.Obj("v", "bottom", "h", "center");
            DomElement e = Dom.el("div", "dlg " + pos["v"].str + " " + pos["h"].str + (this.opts["demo"].truthy ? " has-demo" : "") + (this.opts["glitchy"].truthy ? " glitchy" : "") + (this.opts["sticky"].truthy ? " sticky" : ""));
            e.innerHTML = "<div class=\"portrait\"></div><div class=\"name\"></div><div class=\"txt\"></div><div class=\"next\">CLIC<kbd>ESPACIO</kbd>▶</div>";
            e.querySelector(".name").textContent = (this.opts["name"] || SN.Data["story"]["hoodedName"]).str;
            portrait = Dom.el("canvas");
            portrait.setCanvas(Px.canvas(40, 40));
            e.querySelector(".portrait").appendChild(portrait);
            // Entre la interferencia, a veces se ve un símbolo en su cara: un clic justo entonces lo descubre
            glyphT = 0;
            e.querySelector(".portrait").addEventListener("pointerdown", (ev) => { if (glyphT > 0 && SN.Cipher != null) SN.Cipher.discover("retrato"); });
            if (this.opts["demo"].truthy)
            {
                demo = Dom.el("canvas");
                demo.setCanvas(Px.canvas(56, 34));
                DomElement d = Dom.el("div", "demo");
                d.appendChild(demo);
                e.appendChild(d);
            }
            else demo = null;
            // Capa invisible: mientras hay que leer, ningún botón de debajo recibe el clic por error
            if (!this.opts["sticky"].truthy)
            {
                catcher = Dom.el("div", "dlg-catch");
                layer.appendChild(catcher);
            }
            layer.appendChild(e);
            el = e;
            txt = e.querySelector(".txt");
            startLine();
            return new Promise((r) => { resolve = r; });
        }

        public void startLine()
        {
            // FUTURO.exe se escribe en el idioma secreto (ya cifrado: así no se lee mientras va saliendo)
            string raw = idx < lines.Count ? lines[idx] : "";
            full = SN.Cipher != null ? SN.Cipher.brandify(raw) : raw;
            shown = 0;
            // Reserva ya el alto de la frase entera: la caja no crece a saltos mientras se escribe
            txt.style.minHeight = "";
            txt.innerHTML = SN.KW != null ? SN.KW.html(full) : full;
            txt.style.minHeight = Js.String(txt.offsetHeight) + "px";
            txt.textContent = "";
            el.querySelector(".next").style.visibility = "hidden";
            if (opts["onLine"].truthy) opts["onLine"].call(idx);
        }

        // Con el texto a medias, el primer clic lo completa; el siguiente pasa de frase
        public void advance()
        {
            if (!active) return;
            if (shown < full.Length) { shown = full.Length; renderText(); return; }
            SN.Audio.sfx("click");
            idx++;
            if (idx >= lines.Count)
            {
                var r = resolve;
                hide();
                if (r != null) r();
            }
            else startLine();
        }

        // Las palabras clave salen ya con su color mientras se escribe; se mueven cuando la frase termina
        public void renderText()
        {
            if (el == null) return;
            bool done = shown >= full.Length;
            txt.classList.toggle("typing", !done);
            string part = full.Substring(0, (int)Math.Floor(shown));
            txt.innerHTML = SN.KW != null ? SN.KW.html(part) : part;
            if (done) el.querySelector(".next").style.visibility = "visible";
        }

        public void hide()
        {
            active = false;
            resolve = null;
            if (el != null) el.remove();
            if (catcher != null) catcher.remove();
            el = null;
            catcher = null;
        }

        public void update(double dt)
        {
            if (el == null) return;
            t += dt;
            if (shown < full.Length)
            {
                double before = Math.Floor(shown);
                shown = Math.Min(full.Length, shown + dt * 48);
                double now = Math.Floor(shown);
                if (now != before)
                {
                    renderText();
                    int ni = (int)now;
                    if (ni % 2 == 0 && (ni - 1 < 0 || full[ni - 1] != ' ')) SN.Audio.sfx("type", V.Obj("voice", opts["voice"] || (V)"hood"));
                }
            }
            // Retrato
            Ctx2D g = Px.ctx(portrait.canvas);
            Px.rect(g, 0, 0, 40, 40, PAL.coalD);
            if (opts["portrait"] == "bravo") g.drawImage(SN.Chars.bravoCanvas(t), 0, 0);
            else if (opts["portrait"] != "none")
            {
                g.drawImage(SN.Chars.hoodedCanvas(t, V.Obj("look", JsMath.sin(t * 0.8) > 0.7 ? 1 : 0, "smile", opts["smile"])), 0, 0);
                if (opts["glitchy"].truthy && JsMath.rnd() < 0.08) Px.rect(g, 0, Util.randi(0, 38), 40, 2, Util.pick(V.Arr(PAL.coral, PAL.cyan, PAL.creamL)).str);
                if (opts["glitchy"].truthy && SN.Data["cipher"].truthy)
                {
                    glyphT = JsMath.max(0, glyphT - dt);
                    if (glyphT == 0 && JsMath.rnd() < dt * 0.22) glyphT = 0.45;
                    if (glyphT > 0) Px.text(g, SN.Data["cipher"]["alphabet"]["L"], 20, 30, PAL.coral, 16, "center");
                }
            }
            if (demo != null) drawDemo(opts["demo"].str, Px.ctx(demo.canvas), t);
        }

        // Ejemplos animados (se conservan por si se quieren usar en diálogos futuros)
        static void drawDemo(string kind, Ctx2D g, double t)
        {
            Px.rect(g, 0, 0, 56, 34, PAL.creamL);
            if (kind == "candles")
            {
                double k = JsMath.mod(t, 2) / 2;
                Px.rect(g, 11, 4, 1, 22, PAL.greenD);
                double gh = JsMath.round(14 * JsMath.min(1, k * 2));
                Px.rect(g, 9, 22 - gh, 5, gh + 1, PAL.green); Px.rect(g, 13, 22 - gh, 1, gh + 1, PAL.greenD);
                Px.text(g, "▲", 7, 33, PAL.greenD);
                Px.rect(g, 40, 6, 1, 22, PAL.coralD);
                double rh = JsMath.round(14 * JsMath.max(0, JsMath.min(1, k * 2 - 0.6)));
                Px.rect(g, 38, 9, 5, rh + 1, PAL.coral); Px.rect(g, 42, 9, 1, rh + 1, PAL.coralD);
                Px.text(g, "▼", 36, 33, PAL.coralD);
            }
        }
    }
}
