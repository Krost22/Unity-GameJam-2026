// Port de js/ui/desktop.js (SN.Desktop). Escritorio del PC: FUTURO.exe se minimiza (botón _ o tecla D) y debajo está el
// ordenador del protagonista, con sus programas: Mensajín (chat con Kevo, con LOS DESFASADOS y con Bravo Fines), Notas,
// Papelera, Símbolos (la tabla del idioma secreto, al descifrar el primero) y NULL.EXE (lo entregan LOS DESFASADOS por
// partes; completo, es el final B: js/systems/finale.js, que también usa aquí su terminal).
// En Mensajín no se escribe de verdad: cualquier tecla pone las letras de la respuesta que el protagonista tiene que
// dar; el jugador siente que escribe y la historia sigue su guion. El clic no escribe (a propósito): la gracia es teclear.
// Este archivo: escritorio, ventanas, teclado, Mensajín (conversaciones de Kevo y entrega de mensajes) y avisos.
// Desktop.Parte2.cs: los chats (render, LOS DESFASADOS, Bravo Fines), Símbolos, NULL.EXE / terminal, Notas y Papelera.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Desktop
    {
        // Iconos del escritorio: id, nombre y sprite
        static readonly (string id, string name, string sprite)[] ICONS =
        {
            ("futuro", "FUTURO.exe", "appBig"),
            ("chat", "Mensajín", "icoChat"),
            ("notes", "Notas", "icoNotes"),
            ("trash", "Papelera", "icoTrash"),
            ("symbols", "Símbolos", "icoSymbols"),
            ("null", "NULL.EXE", "icoNull"),
        };
        static readonly Dictionary<string, string> TITLES = new Dictionary<string, string>
        {
            ["notes"] = "Notas.txt",
            ["trash"] = "Papelera",
            ["symbols"] = "Símbolos.txt",
            ["null"] = "NULL.EXE · LÉEME.txt",
            ["term"] = "C:\\> NULL.EXE",
        };
        static readonly Dictionary<string, string> TASKS = new Dictionary<string, string>
        {
            ["notes"] = "Notas",
            ["trash"] = "Papelera",
            ["symbols"] = "Símbolos",
            ["null"] = "NULL.EXE",
            ["term"] = "Terminal",
        };

        public bool open;                                                         // FUTURO.exe minimizado (se ve el escritorio)
        public readonly Dictionary<string, DomElement> wins = new Dictionary<string, DomElement>();   // ventanas abiertas: id -> elemento
        readonly List<string> winKeys = new List<string>();                       // su orden (Object.keys de JS)
        public int timer;                                                         // entrega de mensajes en curso (0 = ninguna)
        public string contact = "kevo";
        public bool noApp;
        public bool typing;
        public string topId;
        public int logoHits, avaHits;
        public int animT, toastT, noticeT, serT, bravoT;                          // temporizadores de tiempo real (0 = ninguno)
        Action toastPick;                                                         // lo que hace el clic en el aviso (onPick de JS)

        // Datos del juego (SN.State.run, SN.Data.chat...), que son V
        static V Run { get { return SN.State.run; } }
        static V CD { get { return SN.Data["chat"]; } }
        static V XD { get { return SN.Data["cipher"]; } }
        static V BD { get { return SN.Data["academy"]; } }
        static V FD { get { return SN.Data["finale"]; } }

        // ---------- Ayudas ----------
        // El nombre del programa y los textos cifrados (SN.Cipher.html con el ultimo símbolo descubierto resaltado)
        static string cx(V t) { return SN.Cipher.html(t, SN.UI.freshLetter); }
        // esc(t): String(t) con los caracteres de HTML escapados
        static string esc(V t) { return t.str.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;"); }
        // x || 0 (número) y x || '' (texto)
        static double N0(V v) { return v.truthy ? v.num : 0; }
        static string S0(V v) { return v.truthy ? v.str : ""; }
        // Verdad de JS para un número (0 y NaN son falsos)
        static bool Truthy(double d) { return d != 0 && !double.IsNaN(d); }
        // lista.push(item)
        static void Push(V list, V item) { list.arr.push(item); }
        // texto.replace(buscado, cambio): solo la primera aparición, como en JS
        static string ReplaceFirst(string s, string find, string with)
        {
            int i = s.IndexOf(find, StringComparison.Ordinal);
            if (i < 0) return s;
            return s.Substring(0, i) + with + s.Substring(i + find.Length);
        }

        DomElement win(string id) { return id != null && wins.TryGetValue(id, out var w) ? w : null; }
        void addWin(string id, DomElement w) { wins[id] = w; winKeys.Remove(id); winKeys.Add(id); }
        void delWin(string id) { wins.Remove(id); winKeys.Remove(id); }

        // ---------- Arranque ----------
        public void init()
        {
            var root = Dom.byId("desktop");
            root.innerHTML = @"
        <div class=""dt-wall""><span class=""dt-logo"">P6</span></div>
        <div class=""dt-icons""></div>
        <div class=""dt-wins""></div>
        <div class=""dt-bar"">
          <button class=""dt-start""><i></i>Inicio</button>
          <div class=""dt-tasks""></div>
          <span class=""dt-clock""></span>
        </div>";
            var icons = root.querySelector(".dt-icons");
            foreach (var ic in ICONS)
            {
                var b = Dom.el("button", "dt-icon");
                b.dataset["app"] = ic.id;
                b.appendChild(SN.Sprites.node(ic.sprite, 1));
                string nm = ic.id == "futuro" ? SN.Cipher.brand() : ic.name;
                b.insertAdjacentHTML("beforeend", "<span class=\"nm\">" + nm + "</span><b class=\"badge hidden\"></b>");
                b.addEventListener("click", (e) => { SN.Audio.sfx("click"); launch(ic.id); });
                icons.appendChild(b);
            }
            root.querySelector(".dt-start").addEventListener("click", (e) => { SN.Audio.sfx("click"); restore(); });
            Dom.byId("btn-min").querySelector(".ico-min").style.backgroundImage = "url(" + SN.Sprites.url("icoMin", 1) + ")";
            Dom.byId("btn-min").addEventListener("click", (e) => minimize());
            // El logo del fondo: siete clics (el número de la suerte) y enseña un símbolo
            var logo = root.querySelector(".dt-logo");
            logo.addEventListener("click", (e) =>
            {
                logoHits = logoHits + 1;
                SN.Audio.sfx("tick");
                logo.classList.remove("knock"); logo.reflow(); logo.classList.add("knock");
                if (logoHits >= 7)
                {
                    logoHits = 0;
                    logo.textContent = XD["alphabet"]["R"].str;
                    SN.Cipher.discover("logo");
                    SN.after(2.5, () => { logo.textContent = "P6"; });
                }
            });
            renderIcons();
            SN.Events.on("turn:ready", (d) =>
            {
                if (Run.truthy) chat()["clock"] = chat()["clock"].num + 1;
                check(); serCheck(); bravoCheck(); refreshNotes(); refreshTrash();
            });
            SN.Events.on("chat:flag", (d) => { flag(d["flag"].str); serCheck(); bravoCheck(); });
            SN.Events.on("rescue:done", (d) => flag("rescue"));
            SN.Events.on("trade:closed", (r) =>
            {
                if (r.truthy && (r["liquidated"].truthy || r["pnl"].num <= -JsMath.max(50, r["amount"].num * 0.6))) flag("bigLoss");
            });
            SN.Events.on("debt:paid", (d) => refreshNotes());
            SN.Events.on("debt:opened", (d) => refreshNotes());
        }

        // Partida nueva: todo cerrado y FUTURO.exe a la vista
        public void reset()
        {
            Dom.clearTimeout(timer); timer = 0; typing = false;
            Dom.clearTimeout(serT); serT = 0;
            Dom.clearTimeout(bravoT); bravoT = 0;
            contact = "kevo";
            renderIcons();
            var d = Dom.byId("desktop");
            var nm = d != null ? d.querySelector(".dt-icon[data-app=\"futuro\"] .nm") : null;
            if (nm != null) nm.innerHTML = SN.Cipher.brand();
            foreach (var id in winKeys.ToArray()) win(id).remove();
            wins.Clear(); winKeys.Clear();
            open = false;
            if (d != null) d.classList.add("hidden");
            var t = Dom.querySelector(".msg-toast");
            if (t != null) t.remove();
        }

        // ---------- Minimizar / restaurar FUTURO.exe ----------
        public bool canMinimize()
        {
            var UI = SN.UI;
            return SN.Game.state == "GAMEPLAY" && Run.truthy && !Run["over"].truthy && !Run["position"].truthy && !UI.busy &&
                SN.Windows.current == null && !SN.Dialog.active && UI.allowed("window");
        }
        public void minimize(string then = null)
        {
            if (open) { if (!string.IsNullOrEmpty(then)) launch(then); return; }
            if (!canMinimize()) { SN.Audio.sfx("error"); return; }
            open = true;
            // El aviso de mensaje de Kevo sobra en el escritorio: el chat ya muestra lo que no has leído
            var tst = Dom.querySelector(".msg-toast:not(.shop)");
            if (tst != null) tst.remove();
            foreach (var t in Dom.querySelectorAll("#layer-float .tip")) t.remove(); // (los consejos son de FUTURO.exe)
            SN.Audio.sfx("close");
            var app = Dom.byId("app");
            app.classList.add("minimizing");
            Dom.byId("desktop").classList.remove("hidden");
            Dom.clearTimeout(animT);
            app.classList.remove("restoring");
            animT = Dom.setTimeout(() => { app.classList.add("hidden"); app.classList.remove("minimizing"); }, 220);
            refresh();
            if (!string.IsNullOrEmpty(then)) launch(then);
        }
        public void restore()
        {
            if (!open || noApp) return;
            if (termLocked()) { refuse(); return; }
            open = false;
            SN.Audio.sfx("open");
            Dom.clearTimeout(animT);
            var app = Dom.byId("app");
            app.classList.remove("hidden", "minimizing");
            app.classList.add("restoring");
            animT = Dom.setTimeout(() => { app.classList.remove("restoring"); Dom.byId("desktop").classList.add("hidden"); }, 220);
            SN.UI.renderAll();
        }

        public void launch(string id)
        {
            // NULL.EXE ya se está ejecutando: su icono te lleva a la terminal (no al LÉEME)
            if (id == "null" && termLocked()) id = "term";
            if (id == "futuro") { restore(); return; }
            if (win(id) != null) { focus(id); return; }
            var w = Dom.el("div", "dt-win dt-" + id);
            string title = id == "chat" ? CD["app"].str : TITLES[id];
            w.innerHTML = "<div class=\"dt-head\"><span>" + title + "</span><button class=\"dt-x\" title=\"Cerrar (Esc)\">×</button></div><div class=\"dt-body\"></div>";
            w.querySelector(".dt-x").addEventListener("click", (e) => { e.stopPropagation(); userClose(id); });
            w.addEventListener("mousedown", (e) => focus(id));
            Dom.byId("desktop").querySelector(".dt-wins").appendChild(w);
            addWin(id, w);
            SN.Audio.sfx("open");
            if (id == "chat") buildChat(w);
            if (id == "notes") refreshNotes();
            if (id == "trash") buildTrash(w);
            if (id == "symbols")
            {
                var badge = Dom.byId("desktop").querySelector(".dt-icon[data-app=\"symbols\"] .badge");
                if (badge != null) badge.classList.add("hidden");
                renderSymbols();
            }
            if (id == "null") buildNull(w);
            if (id == "term") renderTerm();
            focus(id);
            refresh();
        }
        // Cerrar una ventana a petición del jugador (la X o Escape): la terminal de NULL.EXE no se cierra mientras corre
        public void userClose(string id)
        {
            if (id == "term" && termLocked()) { refuse(); return; }
            closeWin(id);
        }
        // ¿Se está ejecutando NULL.EXE? (la terminal del final B: js/systems/finale.js)
        public bool termLocked() { return SN.Finale != null && SN.Finale.termLock; }
        // No se puede: la terminal tiembla y lo dice (una vez por intento)
        public void refuse()
        {
            SN.Audio.sfx("error");
            var w = win("term");
            if (w != null) { focus("term"); w.classList.remove("nudge"); w.reflow(); w.classList.add("nudge"); }
            V T = SN.Finale.term;
            if (!T.truthy) return;
            T["notice"] = FD["term"]["locked"];
            renderTerm();
            Dom.clearTimeout(noticeT);
            noticeT = Dom.setTimeout(() =>
            {
                if (SN.Finale.term.truthy) { SN.Finale.term["notice"] = V.@null; renderTerm(); }
            }, 2200);
        }
        public void closeWin(string id)
        {
            var w = win(id);
            if (w == null) return;
            w.remove();
            delWin(id);
            SN.Audio.sfx("close");
            refresh();
        }
        public void focus(string id)
        {
            foreach (var kv in wins) kv.Value.classList.toggle("top", kv.Key == id);
            topId = id;
        }
        public string topWin()
        {
            if (topId != null && win(topId) != null) return topId;
            return winKeys.Count > 0 ? winKeys[winKeys.Count - 1] : null;
        }

        // Barra de tareas, reloj e insignias de mensajes sin leer
        public void refresh()
        {
            var root = Dom.byId("desktop");
            if (root == null || !Run.truthy) return;
            var tasks = root.querySelector(".dt-tasks");
            tasks.innerHTML = "";
            if (!noApp) addTask(tasks, "futuro", "FUTURO.exe");
            foreach (var id in winKeys.ToArray()) addTask(tasks, id, id == "chat" ? CD["app"].str : TASKS[id]);
            var fi = root.querySelector(".dt-icon[data-app=\"futuro\"]");
            if (fi != null) fi.classList.toggle("hidden", noApp);
            V names = SN.Data["sim"]["turnNames"];
            if (!names.truthy) names = V.Arr("Mañana", "Tarde", "Noche");
            root.querySelector(".dt-clock").textContent = "Día " + Run["day"].str + " · " + S0(names[Run["turn"]]);
            double unread = N0(chat()["unread"]) + N0(ser()["unread"]) + N0(bravo()["unread"]);
            var badge = root.querySelector(".dt-icon[data-app=\"chat\"] .badge");
            badge.textContent = Js.String(unread);
            badge.classList.toggle("hidden", !Truthy(unread));
            var mb = Dom.byId("min-badge");
            if (mb != null) { mb.textContent = Js.String(unread); mb.classList.toggle("hidden", !Truthy(unread)); }
        }
        void addTask(DomElement tasks, string id, string name)
        {
            string cls = "dt-task" + (id == "futuro" ? " min" : "") + (topWin() == id ? " on" : "");
            var b = Dom.el("button", cls, id == "futuro" ? SN.Cipher.brand() : esc(name));
            b.addEventListener("click", (e) => launch(id));
            tasks.appendChild(b);
        }

        // ---------- Teclado ----------
        // Devuelve true si el escritorio se queda con la tecla
        public bool onKey(DomEvent e)
        {
            if (!open)
            {
                if (e.code == "KeyD" && !e.repeat && SN.Game.state == "GAMEPLAY" && SN.Windows.current == null && !SN.Dialog.active)
                {
                    // En la elección del final, D hace lo mismo que «Ir al escritorio»: abre NULL.EXE
                    if (canMinimize()) { e.preventDefault(); minimize(SN.Finale != null && SN.Finale.choosing() ? "null" : null); return true; }
                }
                return false;
            }
            e.preventDefault();
            string top = topWin();
            if (e.code == "Escape") { if (top != null) userClose(top); else restore(); return true; }
            // La terminal de NULL.EXE: cualquier tecla escribe el comando (js/systems/finale.js)
            if (top == "term" && SN.Finale != null && SN.Finale.termKey(e)) return true;
            if (top == "chat" && onKevo() && chat()["phase"] == "reply")
            {
                if (e.code == "Enter" && replyDone()) send();
                else if (!e.repeat || JsMath.rnd() < 0.35)
                {
                    // (con la tecla mantenida, los dedos también se mueven: el primer toque ya lo hace ui.js)
                    if (e.repeat) SN.Hands.tapKey(e.code);
                    typeChunk();
                }
                return true;
            }
            if (e.code == "KeyD" && top == null) restore();
            return true;
        }

        // ---------- Mensajín ----------
        // Estado del chat de Kevo (en la partida; se crea la primera vez)
        public V chat()
        {
            if (!Run.truthy) return V.Obj();
            if (!Run["chat"].truthy)
                Run["chat"] = V.Obj("i", 0, "phase", "wait", "k", 0, "typed", 0, "log", new JsArray(), "unread", 0, "nick", V.@null, "offline", false);
            V ch = Run["chat"];
            if (!ch["flags"].truthy) ch["flags"] = V.Obj();          // lo que ha pasado (y en qué momento del reloj del chat)
            if (!ch["sideDone"].truthy) ch["sideDone"] = V.Obj();
            if (ch["clock"].isNullish) ch["clock"] = 0;              // turnos jugados (no retrocede al volver a un punto de control)
            return ch;
        }
        // Conversación en curso: una secundaria (si la hay) o la siguiente de la historia
        public V convo()
        {
            V ch = chat();
            if (!ch["side"].isNullish) return CD["side"].arr.find((x) => x["id"] == ch["side"]);
            return CD["convos"][ch["i"]];
        }
        // Algo ha pasado en la historia: Kevo podrá reaccionar
        public void flag(string name)
        {
            V ch = chat();
            if (!Run.truthy || !ch["flags"][name].isNullish) return;
            ch["flags"][name] = ch["clock"];
        }
        // ¿Ya pasó la conversación en la que Kevo desaparece? (desde ahí no reacciona a lo que te pasa)
        public bool kevoGone()
        {
            V ch = chat();
            int at = CD["convos"].arr.findIndex((x) => x["gone"].truthy);
            return at >= 0 && ch["i"].num > at;
        }
        public bool ready(V c)
        {
            if (c["when"].truthy) return readyWhen(c["when"], N0(c["delay"]));
            V r = Run;
            double rd = r["day"].num, cd = c["day"].num;
            return rd > cd || (rd == cd && r["turn"].num >= c["turn"].num);
        }
        // Cuando algo ya pasó (flag) hace `delay` turnos del chat
        public bool readyWhen(V when, double delay)
        {
            V ch = chat();
            return !ch["flags"][when].isNullish && ch["clock"].num >= ch["flags"][when].num + delay;
        }

        // ¿Toca que Kevo escriba? (al terminar cada turno)
        public void check()
        {
            V ch = chat();
            if (!Run.truthy || Run["over"].truthy || SN.Game.state != "GAMEPLAY") return;
            if (ch["phase"] != "wait") { pump(); return; }
            // Primero las reacciones a lo que acaba de pasar (si Kevo no ha desaparecido); luego la historia principal
            V side = kevoGone() ? V.@false : CD["side"].arr.find((x) => !ch["sideDone"][x["id"]].truthy && ready(x));
            if (side.truthy) ch["side"] = side["id"];
            else
            {
                ch["side"] = V.@null;
                V c0 = CD["convos"][ch["i"]];
                while (c0.truthy && c0["skipIf"].truthy && !ch["flags"][c0["skipIf"]].isNullish)
                {
                    ch["i"] = ch["i"].num + 1;
                    c0 = CD["convos"][ch["i"]];
                }
                if (!c0.truthy || !ready(c0)) return;
            }
            V c = convo();
            ch["phase"] = "in"; ch["k"] = 0; ch["typed"] = 0;
            SN.Events.emit("kevo:writes", V.Obj("id", c["id"]));
            if (c["nick"].truthy) ch["nick"] = c["nick"];
            ch["offline"] = false;
            pump();
        }

        // Entrega las líneas de Kevo una a una, con "está escribiendo..." entre medias
        public void pump()
        {
            V ch = chat(), c = convo();
            if (timer != 0 || !c.truthy) return;
            V lines = ch["phase"] == "in" ? c["msgs"] : (ch["phase"] == "out" ? c["after"] : V.@null);
            if (!lines.truthy) { renderChat(); return; }
            if (ch["k"].num >= lines.arr.length)
            {
                if (ch["phase"] == "in") { ch["phase"] = "reply"; ch["typed"] = 0; }
                else
                {
                    ch["phase"] = "wait"; ch["k"] = 0; ch["typed"] = 0;
                    if (!ch["side"].isNullish) { ch["sideDone"][ch["side"]] = true; ch["side"] = V.@null; }
                    else ch["i"] = ch["i"].num + 1;
                    if (c["offline"].truthy) ch["offline"] = true;
                    // Kevo desaparece aquí: desde este día está "desconectado"
                    if (c["gone"].truthy) ch["goneDay"] = Run["day"];
                    SN.Events.emit("kevo:done", V.Obj("id", c["id"]));
                }
                SN.Save.saveRun();
                renderChat();
                refresh();
                // Un respiro antes de que empiece otra conversación encadenada
                if (ch["phase"] == "wait") timer = Dom.setTimeout(() => { timer = 0; check(); }, 2600);
                return;
            }
            string line = lines[ch["k"].i].str;
            // '>evento': pasa algo al otro lado de la ventana (sin mensaje en el chat)
            if (JsString.startsWith(line, ">")) { ch["k"] = ch["k"].num + 1; SN.Desk.windowEvent(line.Substring(1)); pump(); return; }
            // Tiempo de "escribir" cada línea: lo bastante largo para leer la anterior con calma
            bool quick = JsString.startsWith(line, "*") || line == "!zumbido";
            double delay = quick ? 900 : 900 + Math.Min(2200, line.Length * 45);
            typing = !JsString.startsWith(line, "*") && line != "!zumbido";
            renderChat();
            timer = Dom.setTimeout(() =>
            {
                timer = 0;
                typing = false;
                deliver(line);
                ch["k"] = ch["k"].num + 1;
                pump();
            }, delay);
        }

        public void deliver(string line)
        {
            V ch = chat();
            if (line == "!zumbido")
            {
                Push(ch["log"], V.Obj("who", "s", "t", "¡" + CD["friend"]["name"].str + " te ha enviado un zumbido!"));
                nudge();
            }
            else if (JsString.startsWith(line, "*"))
            {
                Push(ch["log"], V.Obj("who", "s", "t", line.Substring(1)));
            }
            else if (JsString.startsWith(line, "#"))
            {
                // '#pista': un símbolo del idioma secreto con su letra (y queda descubierto)
                V clue = SN.Cipher.clue(line.Substring(1));
                if (clue.truthy)
                {
                    Push(ch["log"], V.Obj("who", "f", "t", XD["alphabet"][clue["letter"]].str + " = " + clue["letter"].str));
                    SN.Cipher.discover(clue["id"]);
                }
            }
            else
            {
                Push(ch["log"], V.Obj("who", "f", "t", line));
            }
            bool reading = open && topWin() == "chat";
            if (!reading && !JsString.startsWith(line, "*")) ch["unread"] = N0(ch["unread"]) + 1;
            if (JsString.startsWith(line, "*")) SN.Audio.sfx("close"); else SN.Audio.sfx("notify");
            if (!open && line != "!zumbido" && !JsString.startsWith(line, "*") && !JsString.startsWith(line, "#")) toast(line);
            renderChat();
            refresh();
        }

        public void nudge()
        {
            SN.Audio.sfx("thud");
            DomElement el = open ? (win("chat") ?? Dom.byId("desktop")) : Dom.byId("screen");
            el.classList.remove("nudge"); el.reflow(); el.classList.add("nudge");
            SN.FX.shake(3, 0.35);
        }

        // El final: la última conversación de Kevo, entera y sin esperar turnos (con avisos en FUTURO.exe).
        // La respuesta del protagonista se escribe sola.
        public async Promise playConvo(string id)
        {
            V ch = chat();
            int at = CD["convos"].arr.findIndex((x) => x["id"] == id);
            if (at < 0 || ch["i"].num > at) return;
            Dom.clearTimeout(timer); timer = 0;
            V c = CD["convos"][at];
            ch["i"] = at; ch["side"] = V.@null; ch["phase"] = "in"; ch["k"] = 0;
            if (c["nick"].truthy) ch["nick"] = c["nick"];
            ch["offline"] = false;
            foreach (var l in c["msgs"].arr) await playLine(l.str);
            Push(ch["log"], V.Obj("who", "m", "t", c["reply"]));
            if (!open) toast("", "<b>Tú</b> " + esc(c["reply"]));
            SN.Audio.sfx("select");
            await SN.wait(1.4);
            ch["phase"] = "out";
            foreach (var l in c["after"].arr) await playLine(l.str);
            ch["phase"] = "wait"; ch["k"] = 0; ch["typed"] = 0; ch["i"] = at + 1;
            if (c["offline"].truthy) ch["offline"] = true;
            SN.Save.saveRun();
            renderChat();
            refresh();
        }
        async Promise playLine(string l)
        {
            if (JsString.startsWith(l, ">")) { SN.Desk.windowEvent(l.Substring(1)); await SN.wait(1.2); return; }
            deliver(l);
            await SN.wait(JsString.startsWith(l, "*") || l == "!zumbido" ? 0.7 : 1.1 + Math.Min(1.6, l.Length * 0.04));
        }

        // Aviso dentro de FUTURO.exe: clic para ir al chat. opts (otros avisos, como "ya puedes comprar..."):
        // { icon, kbd, onClick }
        public void toast(V line, V html = null, V opts = null)
        {
            html = html ?? V.undefined;
            opts = opts ?? V.Obj();
            var layer = Dom.byId("layer-top");
            var t = layer.querySelector(".msg-toast");
            if (t == null)
            {
                t = Dom.el("button", "msg-toast");
                var self = t;
                t.addEventListener("click", (e) => { var fn = toastPick; self.remove(); if (fn != null) fn(); });
                layer.appendChild(t);
            }
            if (opts["onClick"].truthy)
            {
                var click = opts["onClick"];
                toastPick = () => click.call();
            }
            else toastPick = () => minimize("chat");
            t.classList.toggle("shop", opts["icon"].truthy);
            string kbd = opts["kbd"].truthy ? opts["kbd"].str : "D";
            if (html.truthy) t.innerHTML = "<i></i><span>" + html.str + "</span><kbd>" + kbd + "</kbd>";
            else t.innerHTML = "<i></i><span><b>" + esc(CD["friend"]["name"]) + "</b> " + esc(line) + "</span><kbd>" + kbd + "</kbd>";
            t.querySelector("i").appendChild(SN.Sprites.node(opts["icon"].truthy ? opts["icon"].str : "icoChat", 1));
            SN.KW.apply(t.querySelector("span"));
            t.classList.remove("show"); t.reflow(); t.classList.add("show");
            Dom.clearTimeout(toastT);
            toastT = Dom.setTimeout(() => t.remove(), 6000);
        }
    }
}
