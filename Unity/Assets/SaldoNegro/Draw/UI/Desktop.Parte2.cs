// Port de js/ui/desktop.js (SN.Desktop), segunda parte: la ventana de Mensajín (render, respuesta del protagonista),
// LOS DESFASADOS (escriben en el idioma secreto; no se les puede contestar), Bravo Fines (el gurú manda frases),
// Símbolos, NULL.EXE (LÉEME y terminal del final B), Notas y Papelera.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Desktop
    {
        void buildChat(DomElement w)
        {
            V f = CD["friend"];
            w.querySelector(".dt-body").innerHTML = @"
        <div class=""ch-tabs hidden""><button class=""ch-tab"" data-c=""kevo"">" + esc(f["name"]) + @"<b class=""badge hidden""></b></button><button class=""ch-tab ser"" data-c=""ser""></button><button class=""ch-tab bravo"" data-c=""bravo""></button></div>
        <div class=""ch-who""><i class=""ch-ava""></i><div><b class=""ch-nick""></b><span class=""ch-status""></span></div></div>
        <div class=""ch-log""></div>
        <div class=""ch-typing""></div>
        <div class=""ch-input""><div class=""ch-box""></div><button class=""ch-send btn btn-green"">Enviar<kbd>⏎</kbd></button></div>";
            w.querySelector(".ch-send").addEventListener("click", (e) => send());
            foreach (var b in w.querySelectorAll(".ch-tab"))
            {
                b.addEventListener("click", (e) =>
                {
                    if (contact == b.dataset["c"]) return;
                    contact = b.dataset["c"];
                    SN.Audio.sfx("select");
                    renderChat();
                    refresh();
                });
            }
            // La foto de LOS DESFASADOS: tres llamadas a su puerta
            w.querySelector(".ch-ava").addEventListener("click", (e) =>
            {
                if (contact != "ser") return;
                avaHits = avaHits + 1;
                SN.Audio.sfx("thud");
                if (avaHits >= 3) { avaHits = 0; SN.Cipher.discover("avatar"); }
            });
            if (contact == "ser" && ser()["log"].arr.length == 0) contact = "kevo";
            if (contact == "bravo" && bravo()["log"].arr.length == 0) contact = "kevo";
            renderChat();
        }

        public bool replyDone()
        {
            V c = convo();
            return c.truthy && chat()["typed"].num >= c["reply"].str.Length;
        }
        // ¿Está abierta la conversación con Kevo? (a los demás contactos no se les puede escribir)
        public bool onKevo() { return string.IsNullOrEmpty(contact) || contact == "kevo"; }

        // Cada tecla pone un trocito de la respuesta (de 1 a 3 letras, como quien escribe rápido)
        public void typeChunk()
        {
            V ch = chat(), c = convo();
            if (!c.truthy || !onKevo() || ch["phase"] != "reply" || replyDone()) return;
            ch["typed"] = Math.Min(c["reply"].str.Length, ch["typed"].num + 1 + Math.Floor(JsMath.rnd() * 3));
            renderInput();
        }

        public void send()
        {
            V ch = chat(), c = convo();
            if (!c.truthy || !onKevo() || ch["phase"] != "reply" || !replyDone()) return;
            Push(ch["log"], V.Obj("who", "m", "t", c["reply"]));
            ch["phase"] = "out"; ch["k"] = 0; ch["typed"] = 0;
            SN.Audio.sfx("select");
            SN.Save.saveRun();
            renderChat();
            pump();
        }

        public void renderInput()
        {
            var w = win("chat");
            if (w == null) return;
            V ch = chat(), c = convo();
            var box = w.querySelector(".ch-box");
            var btn = w.querySelector(".ch-send");
            if (ch["phase"] == "reply" && c.truthy)
            {
                string txt = JsString.slice(c["reply"].str, 0, ch["typed"].i);
                box.innerHTML = txt.Length > 0
                    ? esc(txt) + "<i class=\"caret\"></i>"
                    : "<span class=\"ph\">Pulsa cualquier tecla para escribir<kbd>⌨</kbd></span><i class=\"caret\"></i>";
                box.classList.add("live");
                btn.disabled = !replyDone();
                btn.classList.toggle("ready", replyDone());
            }
            else
            {
                box.innerHTML = kevoGone() && ch["offline"].truthy
                    ? "<span class=\"ph\">Kevo no está. Tus mensajes no se entregan.</span>"
                    : "<span class=\"ph\">…</span>";
                box.classList.remove("live");
                btn.disabled = true;
                btn.classList.remove("ready");
            }
        }

        public void renderChat()
        {
            var w = win("chat");
            if (w == null) return;
            V ch = chat(), f = CD["friend"], cs = ser(), cb = bravo();
            // Pestañas: Kevo y, cuando escriben, LOS DESFASADOS (hasta que se despiden, en el final B) y Bravo Fines
            var tabs = w.querySelector(".ch-tabs");
            bool serOn = cs["log"].arr.length > 0 && !cs["gone"].truthy;
            tabs.classList.toggle("hidden", !serOn && cb["log"].arr.length == 0);
            if (cs["gone"].truthy && contact == "ser") contact = "kevo";
            var stab = tabs.querySelector(".ser");
            stab.classList.toggle("hidden", !serOn);
            stab.innerHTML = cx(XD["contact"]["name"]) + "<b class=\"badge" + (cs["unread"].truthy ? "" : " hidden") + "\">" + S0(cs["unread"]) + "</b>";
            var bt = tabs.querySelector(".bravo");
            bt.classList.toggle("hidden", cb["log"].arr.length == 0);
            bt.innerHTML = esc(BD["guru"]["name"]) + "<b class=\"badge" + (cb["unread"].truthy ? "" : " hidden") + "\">" + S0(cb["unread"]) + "</b>";
            var kb = tabs.querySelector("[data-c=\"kevo\"] .badge");
            kb.textContent = S0(ch["unread"]);
            kb.classList.toggle("hidden", !ch["unread"].truthy || contact == "kevo");
            foreach (var b in tabs.querySelectorAll(".ch-tab"))
                b.classList.toggle("on", b.dataset["c"] == (string.IsNullOrEmpty(contact) ? "kevo" : contact));
            if (contact == "ser") { renderSer(w); return; }
            if (contact == "bravo") { renderBravo(w); return; }
            var ava = w.querySelector(".ch-ava");
            if (ava.dataset["who"] != "kevo")
            {
                ava.innerHTML = "";
                ava.appendChild(SN.Sprites.node("avaKevo", 2));
                ava.dataset["who"] = "kevo";
                ava.classList.remove("ser", "bravo");
            }
            if (topWin() == "chat") ch["unread"] = 0;
            w.querySelector(".ch-nick").textContent = ch["nick"].truthy ? ch["nick"].str : f["nick"].str;
            var st = w.querySelector(".ch-status");
            // Desde que desapareció: "desconectado desde hace N días"
            bool goneOn = !ch["goneDay"].isNullish && ch["offline"].truthy && ch["phase"] == "wait";
            double gone = goneOn ? Run["day"].num - ch["goneDay"].num : 0;
            st.textContent = ch["offline"].truthy
                ? (Truthy(gone) ? "Desconectado desde hace " + Js.String(gone) + " día" + (gone == 1 ? "" : "s") : "Desconectado")
                : "Conectado";
            st.className = "ch-status" + (ch["offline"].truthy ? " off" : "");
            var log = w.querySelector(".ch-log");
            log.innerHTML = ch["log"].arr.length > 0 ? "" : "<p class=\"ch-sys\">" + esc(f["name"]) + " todavía no ha escrito.</p>";
            // Varios mensajes seguidos de la misma persona van en un bloque con su nombre una sola vez
            string prev = null;
            foreach (var m in ch["log"].arr)
            {
                string who = m["who"].str;
                if (who == "s")
                {
                    log.insertAdjacentHTML("beforeend", "<p class=\"ch-sys\">" + esc(m["t"]) + "</p>");
                    prev = null;
                    continue;
                }
                string head = who != prev ? "<b>" + esc(who == "f" ? f["name"] : (V)"Tú") + "</b>" : "";
                log.insertAdjacentHTML("beforeend", "<p class=\"ch-msg " + who + (head.Length > 0 ? " first" : "") + "\">" + head + esc(m["t"]) + "</p>");
                prev = who;
            }
            SN.KW.apply(log);
            log.scrollTop = log.scrollHeight;
            w.querySelector(".ch-typing").textContent = typing ? f["name"].str + " está escribiendo…" : "";
            renderInput();
        }

        // ---------- LOS DESFASADOS: escriben en el idioma secreto; no se les puede contestar ----------
        public V ser()
        {
            if (!Run.truthy) return V.Obj();
            if (!Run["chatSer"].truthy) Run["chatSer"] = V.Obj("i", 0, "log", new JsArray(), "unread", 0, "offline", false);
            return Run["chatSer"];
        }
        // ¿Toca otro mensaje? (mismas condiciones que las conversaciones de Kevo)
        public void serCheck()
        {
            if (!Run.truthy || Run["over"].truthy || SN.Game.state != "GAMEPLAY" || serT != 0) return;
            V cs = ser(), ch = chat();
            if (SN.Cipher.count() > 0 && ch["flags"]["cipher"].isNullish) ch["flags"]["cipher"] = ch["clock"];
            V m = XD["messages"][cs["i"]];
            bool isReady = m.truthy && (ready(m) || (m["orWhen"].truthy && readyWhen(m["orWhen"], N0(m["orDelay"]))));
            if (!isReady) return;
            serT = Dom.setTimeout(() => { serT = 0; serDeliver(m); }, 1600);
        }
        public void serDeliver(V m)
        {
            if (!Run.truthy || SN.Game.state != "GAMEPLAY") return;
            V cs = ser();
            string name = XD["contact"]["name"].str;
            if (m["hood"].truthy)
            {
                // El encapuchado sabe de este idioma: entra en la conversación y les manda callar
                foreach (var l in m["hood"].arr)
                {
                    string ls = l.str;
                    Push(cs["log"], JsString.startsWith(ls, "*") ? V.Obj("who", "s", "t", ls.Substring(1)) : V.Obj("who", "h", "t", ls));
                }
                cs["offline"] = true;
                SN.FX.glitch(0.5, 1.2);
                SN.Audio.sfx("static", V.Obj("dur", 0.5));
            }
            else
            {
                if (cs["offline"].truthy || m["back"].truthy)
                {
                    if (cs["offline"].truthy) Push(cs["log"], V.Obj("who", "s", "t", name + " se ha conectado."));
                    cs["offline"] = false;
                }
                Push(cs["log"], V.Obj("who", "x", "t", m["text"]));
                SN.Audio.sfx("notify");
                SN.FX.glitch(0.2, 0.6);
                // Con algunos mensajes llega una parte de NULL.EXE
                if (m["null"].truthy)
                {
                    Run["nullParts"] = JsMath.max(N0(Run["nullParts"]), m["null"].num);
                    Push(cs["log"], V.Obj("who", "s", "t", "Archivo recibido: NULL.EXE (parte " + m["null"].str + " de 3)"));
                    renderIcons();
                }
            }
            cs["i"] = cs["i"].num + 1;
            bool reading = open && topWin() == "chat" && contact == "ser";
            if (!reading) cs["unread"] = N0(cs["unread"]) + 1;
            if (!open) toast("", m["hood"].truthy ? "<b>???</b> " + esc(S0(m["hood"][1])) : "<b>" + cx(name) + "</b> " + cx(m["text"]));
            SN.Save.saveRun();
            renderChat();
            refresh();
            serCheck();
        }
        // El final: lo que les quede por decir, ya (sin esperar turnos)
        public async Promise serFlush()
        {
            Dom.clearTimeout(serT); serT = 0;
            V cs = ser();
            while (XD["messages"][cs["i"]].truthy)
            {
                serDeliver(XD["messages"][cs["i"]]);
                Dom.clearTimeout(serT); serT = 0;
                await SN.wait(1.6);
            }
        }
        // Final B: LOS DESFASADOS se despiden (por primera vez en letras normales) y su contacto desaparece
        public async Promise serFarewell(V text)
        {
            V cs = ser();
            Push(cs["log"], V.Obj("who", "v", "t", text));
            cs["unread"] = N0(cs["unread"]) + 1;
            SN.Audio.sfx("notify");
            toast("", "<b>" + cx(XD["contact"]["name"]) + "</b> " + esc(text));
            renderChat();
            await SN.wait(5);
            Push(cs["log"], V.Obj("who", "s", "t", XD["contact"]["name"].str + " ya no existe."));
            cs["gone"] = true;
            SN.Save.saveRun();
            renderChat();
            refresh();
        }
        void renderSer(DomElement w)
        {
            V cs = ser();
            string name = XD["contact"]["name"].str;
            if (topWin() == "chat") cs["unread"] = 0;
            var ava = w.querySelector(".ch-ava");
            if (ava.dataset["who"] != "ser")
            {
                ava.innerHTML = "";
                ava.appendChild(SN.Sprites.node("avaSer", 2));
                ava.dataset["who"] = "ser";
                ava.classList.add("ser");
            }
            w.querySelector(".ch-nick").innerHTML = cx(name);
            var st = w.querySelector(".ch-status");
            st.textContent = cs["offline"].truthy ? "Desconectado" : "Conectado";
            st.className = "ch-status" + (cs["offline"].truthy ? " off" : "");
            var log = w.querySelector(".ch-log");
            log.innerHTML = "";
            string prev = null;
            foreach (var m in cs["log"].arr)
            {
                string who = m["who"].str;
                if (who == "s")
                {
                    log.insertAdjacentHTML("beforeend", "<p class=\"ch-sys\">" + ReplaceFirst(esc(m["t"]), name, cx(name)) + "</p>");
                    prev = null;
                    continue;
                }
                string head = who != prev ? "<b>" + (who == "h" ? "???" : cx(name)) + "</b>" : "";
                // 'v': su despedida, en letras normales (ya no hace falta el idioma secreto)
                string cls = (who == "h" ? "hood" : "ser") + (head.Length > 0 ? " first" : "");
                string body = who == "h" || who == "v" ? esc(m["t"]) : cx(m["t"]);
                log.insertAdjacentHTML("beforeend", "<p class=\"ch-msg " + cls + "\">" + head + body + "</p>");
                prev = who;
            }
            log.scrollTop = log.scrollHeight;
            w.querySelector(".ch-typing").textContent = "";
            var box = w.querySelector(".ch-box");
            var btn = w.querySelector(".ch-send");
            box.innerHTML = "<span class=\"ph\">No puedes responder a este contacto</span>";
            box.classList.remove("live");
            btn.disabled = true;
            btn.classList.remove("ready");
        }

        // ---------- Bravo Fines: el gurú manda frases (js/data/academy.js) y no lee lo que le contestan ----------
        public V bravo()
        {
            if (!Run.truthy) return V.Obj();
            if (!Run["chatBravo"].truthy) Run["chatBravo"] = V.Obj("i", 0, "log", new JsArray(), "unread", 0);
            return Run["chatBravo"];
        }
        public void bravoCheck()
        {
            if (!Run.truthy || Run["over"].truthy || SN.Game.state != "GAMEPLAY" || bravoT != 0 || !BD.truthy) return;
            V cb = bravo();
            V m = BD["messages"][cb["i"]];
            if (!m.truthy || !ready(m)) return;
            cb["i"] = cb["i"].num + 1;
            // Las frases llegan una a una, como si las escribiera (con mucha seguridad)
            var lines = new List<string>();
            foreach (var l in m["lines"].arr) lines.Add(l.str);
            void next()
            {
                bravoT = 0;
                if (!Run.truthy || lines.Count == 0) { SN.Save.saveRun(); bravoCheck(); return; }
                string line = lines[0];
                lines.RemoveAt(0);
                Push(cb["log"], V.Obj("who", "b", "t", line));
                bool reading = open && topWin() == "chat" && contact == "bravo";
                if (!reading) cb["unread"] = N0(cb["unread"]) + 1;
                SN.Audio.sfx("notify");
                if (!open) toast("", "<b>" + esc(BD["guru"]["name"]) + "</b> " + esc(line));
                SN.Events.emit("bravo:message", V.Obj("line", line));
                renderChat();
                refresh();
                bravoT = Dom.setTimeout(next, 900 + Math.Min(1200, (lines.Count > 0 ? lines[0].Length : 0) * 30));
            }
            bravoT = Dom.setTimeout(next, 1200);
        }
        void renderBravo(DomElement w)
        {
            V cb = bravo(), g = BD["guru"];
            if (topWin() == "chat") cb["unread"] = 0;
            var ava = w.querySelector(".ch-ava");
            if (ava.dataset["who"] != "bravo")
            {
                ava.innerHTML = "";
                var face = Dom.el("canvas");
                face.setCanvas(SN.Chars.bravoFace());
                ava.appendChild(face);
                ava.dataset["who"] = "bravo";
                ava.classList.remove("ser");
                ava.classList.add("bravo");
            }
            w.querySelector(".ch-nick").textContent = g["nick"].str;
            var st = w.querySelector(".ch-status");
            st.textContent = "Conectado · cerrando tratos";
            st.className = "ch-status";
            var log = w.querySelector(".ch-log");
            log.innerHTML = "";
            bool first = true;
            foreach (var m in cb["log"].arr)
            {
                log.insertAdjacentHTML("beforeend", "<p class=\"ch-msg bravo" + (first ? " first" : "") + "\">" + (first ? "<b>" + esc(g["name"]) + "</b>" : "") + esc(m["t"]) + "</p>");
                first = false;
            }
            log.scrollTop = log.scrollHeight;
            w.querySelector(".ch-typing").textContent = bravoT != 0 ? g["name"].str + " está escribiendo…" : "";
            var box = w.querySelector(".ch-box");
            var btn = w.querySelector(".ch-send");
            box.innerHTML = "<span class=\"ph\">Bravo Fines no lee mensajes. Solo los manda.</span>";
            box.classList.remove("live");
            btn.disabled = true;
            btn.classList.remove("ready");
            SN.KW.apply(log);
        }

        // ---------- Símbolos: la tabla del idioma secreto ----------
        public void renderIcons()
        {
            var root = Dom.byId("desktop");
            var b = root != null ? root.querySelector(".dt-icon[data-app=\"symbols\"]") : null;
            if (b != null) b.classList.toggle("hidden", SN.Cipher.count() == 0);
            // NULL.EXE: aparece con la primera parte; la insignia dice cuántas tienes
            var n = root != null ? root.querySelector(".dt-icon[data-app=\"null\"]") : null;
            if (n != null)
            {
                double parts = nullParts();
                bool done = Run.truthy && Run["finale"].truthy && Run["finale"]["phase"] == "done";
                n.classList.toggle("hidden", !Truthy(parts) || done);
                var badge = n.querySelector(".badge");
                badge.textContent = parts >= 3 ? "!" : Js.String(parts) + "/3";
                badge.classList.toggle("hidden", !Truthy(parts));
                n.classList.toggle("ready", parts >= 3);
            }
        }
        public double nullParts() { return Run.truthy ? N0(Run["nullParts"]) : 0; }
        public void renderSymbols()
        {
            var w = win("symbols");
            if (w == null) return;
            var cph = SN.Cipher;
            V fresh = SN.UI.freshLetter;
            var cells = new List<string>();
            foreach (var c in XD["clues"].arr)
            {
                bool known = cph.knows(c["letter"]);
                cells.Add("<div class=\"sy-cell" + (known ? " on" : "") + (c["letter"] == fresh ? " fresh" : "") +
                    "\" title=\"" + (known ? esc(c["where"]) : "") + "\"><b class=\"cx\">" + XD["alphabet"][c["letter"]].str +
                    "</b><i>=</i><b class=\"" + (known ? "cx-k" : "q") + "\">" + (known ? c["letter"].str : "?") + "</b></div>");
            }
            var missing = XD["clues"].arr.filter((x) => !cph.knows(x["letter"]));
            int hints = (int)N0(cph.state()["hints"]);
            var shown = missing.slice(0, Math.Min(missing.length, 1 + hints));
            var hintList = new List<string>();
            foreach (var c in shown) hintList.Add("<p>· " + esc(c["hint"]) + "</p>");
            string hintsHtml = missing.length > 0
                ? "<div class=\"sy-hints\"><b>Pistas</b>" + string.Concat(hintList) + "</div>"
                : "<div class=\"sy-hints\"><b>Ya puedes leerlo todo.</b></div>";
            w.querySelector(".dt-body").innerHTML = "<div class=\"sy-head\">" + cph.count() + "/" + cph.total() +
                " símbolos</div><div class=\"sy-grid\">" + string.Concat(cells) + "</div>" + hintsHtml;
        }
        // Un símbolo nuevo: aparece la app, se marca y todo lo que hay abierto se traduce un poco más
        public void onCipher()
        {
            renderIcons();
            var d = Dom.byId("desktop");
            var nm = d.querySelector(".dt-icon[data-app=\"futuro\"] .nm");
            if (nm != null) nm.innerHTML = SN.Cipher.brand();
            refresh();
            var badge = d.querySelector(".dt-icon[data-app=\"symbols\"] .badge");
            if (badge != null && !(open && topWin() == "symbols")) { badge.textContent = "+1"; badge.classList.remove("hidden"); }
            renderSymbols();
            renderChat();
            refreshNotes();
            refreshTrash();
        }

        // ---------- NULL.EXE: el LÉEME (roto hasta tener las tres partes) y la terminal del final B ----------
        void buildNull(DomElement w)
        {
            double parts = nullParts();
            V F = FD;
            var body = w.querySelector(".dt-body");
            bool choosing = SN.Finale.choosing();
            if (parts < 3)
            {
                // Incompleto: lo poco que se lee está en el idioma secreto
                var junk = new List<string>();
                foreach (var m in XD["messages"].arr)
                    if (m["null"].truthy && m["null"].num <= parts) junk.Add("<p>" + cx(m["text"]) + "</p>");
                body.innerHTML = "<div class=\"nu\"><div class=\"nu-err\">ARCHIVO INCOMPLETO · parte " + Js.String(parts) + " de 3</div>" +
                    string.Concat(junk) + "<p class=\"nu-junk\">" + JsString.repeat("▓▒░ ", 18) + "</p></div>";
                return;
            }
            // (en la web este map no lleva join(''): al meterlo en la plantilla sus textos van separados por comas)
            var paras = new List<string>();
            int i = 0;
            foreach (var p in F["readme"].arr)
            {
                paras.Add("<p" + (i > 0 ? "" : " class=\"nu-h\"") + ">" + esc(p) + "</p>");
                i++;
            }
            body.innerHTML = "<div class=\"nu\"><div class=\"nu-txt\">" + string.Join(",", paras) + "</div></div>";
            var run = Dom.el("button", "btn btn-coral nu-run", choosing ? "Ejecutar NULL.EXE" : "Todavía no");
            run.disabled = !choosing;
            run.addEventListener("click", (e) => { e.stopPropagation(); if (SN.Finale.choosing()) SN.Finale.choose("B"); });
            body.querySelector(".nu").appendChild(run);
        }
        // La terminal: lo que pinta js/systems/finale.js (líneas, el comando que se escribe y su cursor)
        public void renderTerm()
        {
            var w = win("term");
            V T = SN.Finale.term;
            if (w == null || !T.truthy) return;
            var body = w.querySelector(".dt-body");
            var lines = new List<string>();
            foreach (var l in T["lines"].arr)
                lines.Add("<p class=\"tm-" + (l["k"].truthy ? l["k"].str : "out") + "\">" + esc(l["t"]) + "</p>");
            string cur = "";
            if (T["typing"].truthy)
                cur = "<p class=\"tm-cmd\">" + esc(T["prompt"].str + JsString.slice(T["typing"]["text"].str, 0, T["typing"]["shown"].i)) + "<i class=\"caret\"></i></p>";
            string hint = T["typing"].truthy && !T["typing"]["shown"].truthy ? "<p class=\"tm-hint\">Pulsa cualquier tecla para escribir</p>" : "";
            string note = T["notice"].truthy ? "<p class=\"tm-lock\">" + esc(T["notice"]) + "</p>" : "";
            body.innerHTML = "<div class=\"tm\">" + string.Concat(lines) + cur + hint + note + "</div>";
            var box = body.querySelector(".tm");
            box.scrollTop = box.scrollHeight;
        }

        // ---------- Notas y Papelera ----------
        public void refreshNotes()
        {
            var w = win("notes");
            if (w == null || !Run.truthy) return;
            V run = Run;
            bool paid = run["flags"]["debtPaid"].truthy;
            V d = run["debt"];
            string Box(bool on) { return on ? "[x]" : "[ ]"; }
            // Las deudas que llegaron después también van a la lista (la última, sin tachar si no está pagada)
            var all = new List<V>();
            if (run["debts"].truthy) foreach (var x in run["debts"].arr) all.Add(x);
            all.Add(d);
            var fl = new List<V>();
            foreach (var x in all) if (x.truthy && !(x["id"] == "pleyzeta")) fl.Add(x);
            var later = new List<string>();
            for (int k = Math.Max(0, fl.Count - 3); k < fl.Count; k++)
            {
                V x = fl[k];
                later.Add(Box(x["paid"].truthy) + " Pagar " + esc(x["label"]) + ": " + Util.money(x["amount"]) + " · día " + x["deadlineDay"].str);
            }
            string laterText = string.Join("\n", later);
            w.querySelector(".dt-body").innerHTML = "<pre class=\"nt\">COSAS QUE HACER\n" +
                Box(paid) + " Pagar la Pleyzeta: " + Util.money(SN.Data["sim"]["startDebt"]) + " · día 7" + (later.Count > 0 ? "\n" + laterText : "") + "\n" +
                Box(false) + " Comprar ramen (otra vez)\n" +
                Box(chat()["i"].num > 0) + " Contestar a Kevo\n" +
                Box(false) + " NO apostarlo todo\n" +
                Box(false) + " Dormir" + (kevoGone() ? "\n" + Box(false) + " Encontrar a Kevo" : "") + ghostLine() + "</pre>";
            SN.KW.apply(w.querySelector(".nt"));
            var gh = w.querySelector(".nt-ghost");
            if (gh != null) gh.addEventListener("click", (e) => { SN.Audio.sfx("select"); SN.Cipher.discover("notas"); });
        }
        // De noche aparece una línea que nadie escribió (o que ya se lee, si la descifraste)
        public string ghostLine()
        {
            bool night = Run.truthy && Run["turn"].num == 2;
            if (!night && !SN.Cipher.found("notas")) return "";
            return "\n<span class=\"nt-ghost" + (SN.Cipher.found("notas") ? " read" : "") + "\">" + cx(XD["hidden"]["notas"]) + "</span>";
        }
        public void refreshTrash()
        {
            var w = win("trash");
            if (w != null) buildTrash(w);
        }
        void buildTrash(DomElement w)
        {
            var files = new List<(string name, string size, string joke)>
            {
                ("curriculum_FINAL_v3.doc", "12 KB", "Lo tiraste por algo."),
                ("ahorros.xls", "0 KB", "Está vacío. Como la cuenta."),
                ("dieta_lunes.txt", "1 KB", "Empezaba el lunes. ¿Qué lunes?"),
            };
            // Desde el día 3 aparece un archivo que tú no tiraste
            if (Run.truthy && (Run["day"].num >= 3 || SN.Cipher.found("papelera"))) files.Add(("no_abrir.txt", "1 KB", null));
            // Desde que Kevo desapareció: intentaste borrar FUTURO.exe... y volvió solo
            if (kevoGone()) files.Add(("FUTURO.exe", "6,66 MB", "Lo tiraste anoche. Ha vuelto solo al escritorio."));
            var body = w.querySelector(".dt-body");
            body.innerHTML = "<div class=\"tr-list\"></div><div class=\"tr-note\">Haz clic en un archivo</div>";
            foreach (var f in files)
            {
                string joke = f.joke;
                var b = Dom.el("button", "tr-file" + (string.IsNullOrEmpty(joke) ? " odd" : ""),
                    "<span>" + esc(f.name) + "</span><em>" + f.size + "</em>");
                b.addEventListener("click", (e) =>
                {
                    SN.Audio.sfx("select");
                    var note = body.querySelector(".tr-note");
                    if (!string.IsNullOrEmpty(joke)) { note.textContent = joke; return; }
                    note.innerHTML = cx(XD["hidden"]["papelera"]);
                    SN.Cipher.discover("papelera");
                });
                body.querySelector(".tr-list").appendChild(b);
            }
        }
    }
}
