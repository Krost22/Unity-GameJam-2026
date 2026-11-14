// Port de js/ui/windows.js (SN.Windows): las ventanas modales del monitor (tienda con la Academia, noticias,
// ajustes, la ruleta de la suerte y la oferta de FUTURO.exe). Esta mitad: el marco de la ventana (abrir, cerrar,
// repintar), la Academia de Bravo Fines y el periódico. La otra mitad (tienda, ruleta, oferta, final, acerca de
// y ajustes) está en Windows.Parte2.cs.
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Windows
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        static readonly Dictionary<string, string> TITLES = new Dictionary<string, string>
        {
            ["upgrades"] = "Tienda · Academia de Bravo Fines",
            ["news"] = "Noticias",
            ["shop"] = "Tienda · MEGATIENDA.COM",
            ["settings"] = "Ajustes",
            ["ruleta"] = "Ruleta de la Fortuna",
            ["offer"] = "",
            ["pact"] = "",
            ["about"] = "Acerca de FUTURO.exe",
        };

        public string current = null;
        public DomElement back = null, win = null;
        // opts: para la oferta, { item, why } (why: 'new' | 'afford' | 'insist' | 'shop')
        public V opts = V.Obj();

        public V newsFocus = V.@null;
        public string acView = null;
        public V acSel = V.@null;
        public V acBump = V.@null;
        public V acDone = V.@null;
        public bool acAnim = false;
        public double? acPct = null;

        public string shopCat = null;
        public V shopSel = V.@null;
        public bool shopBump = false;
        public bool shopFlash = false;
        public bool shopAnim = false;

        // ---------- Marco de la ventana ----------

        public void open(string kind, V opts = null)
        {
            opts = opts ?? V.Obj();
            if (current == kind && kind != "offer") return;
            close(true);
            current = kind;
            this.opts = opts;
            if (kind == "news") newsFocus = opts["focus"] | V.@null; // abrir una noticia directamente en primera plana
            // Al entrar, Destacados enseña el objeto clave de la historia (o lo que se pida: { cat, sel })
            if (kind == "shop")
            {
                shopSel = opts["sel"] | V.@null;
                if (opts["cat"].truthy) shopCat = opts["cat"].str;
            }
            var layer = Dom.byId("layer-windows");
            back = Dom.el("div", "win-back");
            // La oferta de FUTURO.exe es el siguiente paso de la historia: no se cierra pulsando fuera
            if (kind != "offer") back.addEventListener("click", () => close());
            win = Dom.el("div", "win" + (kind == "news" ? " wide paper" : kind == "offer" ? " offer-win" : kind == "pact" ? " offer-win pact-win" : kind == "shop" ? " big sh-win" : ""));
            if (kind == "offer" || kind == "pact") win.innerHTML = "<div class=\"win-body\"></div>";
            else
            {
                win.innerHTML = "<div class=\"win-head\"><span>" + TITLES[kind] + "</span><button class=\"win-x\">X<kbd>ESC</kbd></button></div><div class=\"win-body\"></div>";
                SN.KW.apply(win.querySelector(".win-head span"), V.Obj("terms", false));
                win.querySelector(".win-x").addEventListener("click", () => close());
            }
            layer.appendChild(back);
            layer.appendChild(win);
            Dom.byId("screen").classList.toggle("paper-open", kind == "news");
            SN.Audio.sfx(kind == "offer" ? "notify" : "open");
            refresh();
            SN.Events.emit("window:opened", V.Obj("kind", kind));
            if (kind == "news" && S.run.truthy) { S.run["newsSeen"] = S.run["news"].length; SN.Events.emit("news:read"); }
            if ((kind == "upgrades" || kind == "shop") && S.run.truthy && SN.ShopWatch != null) { SN.ShopWatch.markSeen("shop"); SN.Events.emit("shop:seen", V.Obj("kind", "shop")); }
        }

        // La oferta de FUTURO.exe de un objeto clave
        public void offer(V id, string why = "shop") { open("offer", V.Obj("item", id, "why", why)); }

        public void close(bool silent = false)
        {
            if (current == null) return;
            var w = win;
            var b = back;
            current = null;
            win = null;
            back = null;
            if (!silent) SN.Audio.sfx("close");
            Dom.byId("screen").classList.remove("paper-open");
            b.remove();
            w.classList.add("closing");
            SN.after(0.16, () => w.remove());
            SN.Events.emit("window:closed");
        }

        public void refresh()
        {
            if (win == null) return;
            var body = win.querySelector(".win-body");
            body.innerHTML = "";
            switch (current)
            {
                case "upgrades": buildUpgrades(body); break;
                case "news": buildNews(body); break;
                case "shop": buildShop(body); break;
                case "settings": buildSettings(body); break;
                case "ruleta": buildWheel(body); break;
                case "offer": buildOffer(body); break;
                case "pact": buildPact(body); break;
                case "about": buildAbout(body); break;
            }
            // Palabras clave con color y FUTURO.exe en el idioma secreto. En la tienda y las mejoras, solo dinero, 7 y
            // suerte: ahí cada nombre es una mejora o un regalo y, si todo se mueve, nada destaca
            SN.KW.apply(body, V.Obj("terms", current != "shop" && current != "upgrades"));
        }

        // ---------- Utilidades de pintura ----------

        // Un lienzo de píxeles dentro del DOM (el <canvas> de la web)
        static DomElement CanvasEl(Canvas c, string cls = null)
        {
            var e = Dom.el("canvas", cls);
            e.setCanvas(c);
            return e;
        }

        // Foto de noticia (SN.NewsArt.node en la web devuelve el elemento con la clase "photo")
        static DomElement Photo(Canvas c) { return CanvasEl(c, "photo"); }

        // Icono de pixel art grande (los sprites de 12x12, al doble o al triple)
        static DomElement Big(string name, int scale = 2)
        {
            var c = SN.Sprites.node(name, scale);
            c.classList.add("px-ico");
            return c;
        }

        // JS: (x || []) para una lista
        static JsArray ListOr(V v) { return v.arr ?? new JsArray(); }

        // JS: x.replace(texto, valor) (solo la primera aparición)
        static string ReplaceFirst(string t, string pat, string rep)
        {
            int i = t.IndexOf(pat, StringComparison.Ordinal);
            return i < 0 ? t : t.Substring(0, i) + rep + t.Substring(i + pat.Length);
        }

        static string Cap1(string t) { return t.Length == 0 ? t : t.Substring(0, 1) + t.Substring(1).ToLowerInvariant(); }

        // ---------- La Academia de Bravo Fines, dentro de la Tienda (las mejoras se compran en la Tienda misma).
        // Un botón para volver a la Tienda y, debajo, el árbol de la Academia.
        void buildUpgrades(DomElement body)
        {
            if (!(SN.Academy != null && SN.Academy.open())) { SN.after(0, () => open("shop")); return; }
            win.classList.add("big", "ac-win");
            var tabs = Dom.el("div", "up-tabs");
            var backBtn = Dom.el("button", "up-tab", "◀ Tienda");
            backBtn.addEventListener("click", (e) => { e.stopPropagation(); SN.Audio.sfx("select"); open("shop"); });
            tabs.appendChild(backBtn);
            tabs.appendChild(Dom.el("button", "up-tab on ac", "Academia de Bravo Fines"));
            body.appendChild(tabs);
            buildAcademy(body);
        }

        // ---------- La Academia de Bravo Fines: árbol de habilidades (js/data/academy.js) ----------
        // Encabezado con Bravo, navegación por ramas, las tres ramas con sus nodos unidos por líneas, el detalle
        // del nodo elegido y, abajo, el progreso. Todo sale de SN.Academy: aquí solo se pinta.
        static readonly (string id, string label, string ic)[] AC_NAV =
        {
            ("arbol", "Árbol", "estrella"), ("negocios", "Negocios", "tienda"), ("trading", "Trading", "grafica"), ("contactos", "Contactos", "contacto"),
        };
        static readonly Dictionary<string, (string ic, string desc)> AC_BRANCH = new Dictionary<string, (string ic, string desc)>
        {
            ["negocios"] = ("tienda", "Dinero cada día"),
            ["trading"] = ("grafica", "Mejora tus apuestas"),
            ["contactos"] = ("contacto", "Ayudas y amigos"),
        };

        // El efecto de un nodo, en palabras (sale de sus datos: income, bonus, halve, offer)
        static string AcEffect(V n)
        {
            if (n["soon"].truthy) return "Próximamente";
            if (n["income"].truthy) return "+" + Util.money(n["income"].num) + " al día";
            if (n["bonus"].truthy) return "+" + Js.String(JsMath.round(n["bonus"].num * 100)) + "% en cada ganancia";
            if (n["halve"].truthy) return "1ª pérdida del día, a la mitad";
            if (n["offer"].truthy) return "Ofertas: −" + Js.String(JsMath.round((1 - n["offer"].num) * 100)) + "% de deuda";
            return "";
        }

        void buildAcademy(DomElement body)
        {
            var A = SN.Academy;
            V data = D["academy"];
            V run = S.run;
            string view = acView ?? "arbol";
            JsArray all = A.nodes();
            JsArray real = all.filter((n) => !n["soon"].truthy);
            if (!acSel.truthy || !A.node(acSel).truthy)
                acSel = (all.find((n) => A.canBuy(n["id"])["ok"].truthy) | all.find((n) => !A.has(n["id"]) && !n["soon"].truthy) | all[0])["id"];
            var box = Dom.el("div", "ac");

            // Encabezado: Bravo, sus negocios y tu dinero
            var head = Dom.el("div", "ac-top");
            var ava = Dom.el("i", "ac-ava");
            ava.appendChild(CanvasEl(SN.Chars.bravoFace()));
            head.appendChild(ava);
            head.insertAdjacentHTML("beforeend", $@"<div class=""ac-ttl""><b>Academia de Bravo Fines</b><span>""El dinero no se gana. Se manifiesta.""</span></div>
      <div class=""ac-inc""><span>Negocios</span><b>+{Util.money(A.income())}/día</b></div>
      <div class=""ac-cash""><i></i><div><span>Tu dinero</span><b>{Util.money(run["capital"].num)}</b></div></div>");
            head.querySelector(".ac-cash i").appendChild(Big("estrella", 1));
            box.appendChild(head);

            // Navegación lateral: todo el árbol o una rama
            var nav = Dom.el("div", "ac-nav");
            foreach (var (id, label, ic) in AC_NAV)
            {
                var b = Dom.el("button", "ac-nb" + (view == id ? " on" : ""));
                b.dataset["view"] = id;
                b.appendChild(Big(ic, 1));
                b.insertAdjacentHTML("beforeend", "<span>" + label + "</span>");
                b.addEventListener("click", (e) => { e.stopPropagation(); if (acView == id) return; acView = id; acAnim = true; SN.Audio.sfx("select"); refresh(); });
                nav.appendChild(b);
            }
            box.appendChild(nav);

            // Las ramas: una fila cada una, con los nodos unidos por líneas (se encienden al comprar el anterior)
            var tree = Dom.el("div", "ac-tree" + (acAnim ? " in" : ""));
            acAnim = false;
            foreach (V br in data["branches"].arr)
            {
                if (view != "arbol" && br["id"] != view) continue;
                var row = Dom.el("div", "ac-br " + br["color"].str);
                var (bic, bdesc) = AC_BRANCH.TryGetValue(br["id"].str, out var ab) ? ab : ("estrella", "");
                var lab = Dom.el("div", "ac-bl");
                lab.appendChild(Big(bic, 1));
                lab.insertAdjacentHTML("beforeend", "<b>" + br["name"].str + "</b><span>" + bdesc + "</span>");
                row.appendChild(lab);
                JsArray brNodes = br["nodes"].arr;
                for (int i = 0; i < brNodes.length; i++)
                {
                    V node = brNodes[i];
                    if (i > 0) row.appendChild(Dom.el("i", "ac-ln" + (A.has(brNodes[i - 1]["id"]) ? " on" : "")));
                    V can = A.canBuy(node["id"]);
                    bool own = A.has(node["id"]);
                    string st = own ? "own" : node["soon"].truthy ? "soon" : can["ok"].truthy ? "can" : "locked";
                    string cls = "ac-n " + st + (acSel == node["id"] ? " sel" : "") + (acBump == node["id"] ? " bump" : "") + (acDone == node["id"] ? " done" : "");
                    var el = Dom.el("button", cls);
                    el.dataset["node"] = node["id"].str;
                    el.title = node["name"].str;
                    el.appendChild(Big(node["icon"].str, 2));
                    if (st == "soon" || (st == "locked" && can["locked"].truthy))
                    {
                        var l = SN.Sprites.node("lock", 1);
                        l.className = "ac-lock";
                        el.appendChild(l);
                    }
                    string em = node["soon"].truthy ? "···" : own ? "1/1" : "0/1";
                    el.insertAdjacentHTML("beforeend", "<em>" + em + "</em>");
                    el.addEventListener("click", (e) => { e.stopPropagation(); acSel = node["id"]; acBump = node["id"]; SN.Audio.sfx("select"); refresh(); });
                    row.appendChild(el);
                }
                tree.appendChild(row);
            }
            // Con una sola rama a la vista, debajo, la lista de sus avances con su efecto y su precio
            if (view != "arbol")
            {
                V br = data["branches"].arr.find((b) => b["id"] == view);
                var list = Dom.el("div", "ac-list");
                foreach (V node in br["nodes"].arr)
                {
                    string cls = A.has(node["id"]) ? "own" : node["soon"].truthy ? "soon" : "";
                    string tail = node["soon"].truthy ? "" : " · " + (A.has(node["id"]) ? "Tuyo" : Util.money(node["cost"].num));
                    var p = Dom.el("p", cls, "<b>" + node["name"].str + "</b> · " + AcEffect(node) + tail);
                    p.addEventListener("click", (e) => { e.stopPropagation(); acSel = node["id"]; acBump = node["id"]; SN.Audio.sfx("select"); refresh(); });
                    list.appendChild(p);
                }
                tree.appendChild(list);
            }
            box.appendChild(tree);

            // Detalle del nodo elegido
            V nd = A.node(acSel);
            V ndCan = A.canBuy(nd["id"]);
            bool ndOwn = A.has(nd["id"]);
            bool ndSoon = nd["soon"].truthy;
            var det = Dom.el("div", "ac-dt" + (acBump == nd["id"] ? " bump" : ""));
            string lvl = ndSoon ? "Próximamente" : "Nv. " + (ndOwn ? 1 : 0) + " / 1";
            string effectPart = ndOwn
                ? "<div class=\"ac-de\"><span>Efecto actual:</span><b>" + AcEffect(nd) + "</b></div>"
                : ndSoon ? "" : "<div class=\"ac-de nx\"><span>Efecto actual: <i>ninguno</i></span><span>Al comprarlo:</span><b>" + AcEffect(nd) + "</b></div>";
            det.innerHTML = $@"<div class=""ac-dh"">Detalle</div><div class=""ac-dico""></div><b class=""ac-dn"">{nd["name"].str}</b>
      <span class=""ac-dl"">{lvl}</span><p class=""ac-dd"">{nd["desc"].str}</p>
      {effectPart}";
            det.querySelector(".ac-dico").appendChild(Big(ndSoon ? "lock" : nd["icon"].str, 2));
            if (!ndOwn && !ndSoon)
            {
                var b = Dom.el("button", "btn btn-yellow ac-buy", "Comprar " + Util.money(nd["cost"].num));
                b.disabled = !ndCan["ok"].truthy;
                if (!ndCan["ok"].truthy && ndCan["reason"].truthy)
                {
                    b.title = ndCan["reason"].str;
                    det.insertAdjacentHTML("beforeend", "<div class=\"ac-why\">" + Cap1(ndCan["reason"].str) + "</div>");
                }
                b.addEventListener("click", (e) =>
                {
                    e.stopPropagation();
                    if (!A.buy(nd["id"])) { SN.Audio.sfx("error"); return; }
                    SN.Audio.sfx("unlock");
                    V pos = SN.UI.posIn(b);
                    double cx = pos["x"].num + pos["w"].num / 2, cy = pos["y"].num;
                    SN.FX.burst(cx, cy, 22, new[] { PAL.yellow, PAL.green, PAL.creamL });
                    SN.FX.ring(cx, cy + 5, PAL.yellow, 46);
                    SN.Save.saveRun();
                    acDone = nd["id"];
                    acSel = V.@null;
                    refresh();
                });
                det.appendChild(b);
            }
            else det.insertAdjacentHTML("beforeend", "<div class=\"ac-why" + (ndOwn ? " ok" : "") + "\">" + (ndOwn ? "Ya es tuyo." : "Llegará en una versión futura.") + "</div>");
            box.appendChild(det);

            // Abajo: el progreso de la Academia y lo siguiente que llegará a esa rama
            int done = 0;
            foreach (V x in real) if (A.has(x["id"])) done++;
            double pct = JsMath.round((double)done / Math.Max(1, real.length) * 100);
            V brNext = view != "arbol" ? (V)view : nd["branch"];
            V brFound = data["branches"].arr.find((b) => b["id"] == brNext) | data["branches"].arr[0];
            V next = brFound["nodes"].arr.find((x) => x["soon"].truthy);
            var bar = Dom.el("div", "ac-bot");
            string nextTxt = next.truthy ? next["name"].str + " (pronto)" : "Rama completa";
            bar.innerHTML = $@"<div class=""ac-prog""><i class=""ac-pi""></i><div class=""ac-pt""><b>Progreso</b><div class=""ac-bar""><i style=""width:{Js.String(pct)}%""></i></div></div><em>{done} / {real.length}</em></div>
      <div class=""ac-rew""><div class=""ac-rt""><b>Siguiente en {brFound["name"].str}</b><span>{nextTxt}</span></div><i class=""ac-ri""></i></div>";
            bar.querySelector(".ac-pi").appendChild(Big("estrella", 1));
            bar.querySelector(".ac-ri").appendChild(Big("cofre", 1));
            if (acPct != null && acPct != pct) bar.querySelector(".ac-bar i").classList.add("grow");
            acPct = pct;
            box.appendChild(bar);
            body.appendChild(box);
            acBump = V.@null;
            acDone = V.@null;
        }

        // ---------- El periódico ----------
        static readonly Dictionary<string, string> MARKET_ART = new Dictionary<string, string>
        {
            ["salud"] = "hospital",
            ["tecno"] = "chip",
            ["negocios"] = "compras",
            ["mineria"] = "mina",
            ["salud_negro"] = "pastillas",
            ["tecno_negro"] = "candado",
            ["negocios_negro"] = "persiana",
            ["mineria_negro"] = "mina",
        };

        static string ArtFor(V n)
        {
            if (n["art"].truthy && SN.NewsArt.has(n["art"].str)) return n["art"].str;
            string t = n["title"].str;
            if (t.Contains("DEUDA SALDADA")) return "sello";
            if (t.Contains("OBJETIVO")) return "dinero";
            if (t.Contains("EMBARGO")) return "documento";
            return MARKET_ART.TryGetValue(n["market"].str, out var art) ? art : "ciudad";
        }

        static string When(V n)
        {
            return n["filler"].truthy ? "En la ciudad" : "Día " + n["day"].str + " · " + (D["sim"]["turnNames"][n["turn"]] | (V)"").str;
        }

        // El evento de mercado de una noticia (si lo es)
        static V EventOf(V n)
        {
            if (!n.truthy || !n["ev"].truthy || !n["market"].truthy) return V.@null;
            return ListOr(D["marketEvents"][n["market"]]).find((e) => e["id"] == n["ev"])
                | ListOr(D["luck"]["events"]).find((e) => e["id"] == n["ev"])
                | V.@null;
        }

        // Qué dice la pegatina de la foto: el color del mercado y hacia dónde va
        static V StickerOf(V n)
        {
            if (!n.truthy || !n["market"].truthy || n["dark"].truthy || n["cipher"].truthy) return V.@null;
            V ev = EventOf(n);
            V def = D.marketById(n["market"]);
            if (!def.truthy) return V.@null;
            string sym = n["tone"] == "neg" ? "down" : n["tone"] == "pos" ? "up" : "vol";
            if (ev.truthy && n["kind"] != "result")
            {
                if (ev["kind"] == "rumor") sym = "rumor";
                else if (ev["kind"] == "vol") sym = "vol";
                else if (ev["kind"] == "trend") sym = ev["trend"].num > 0 ? "up" : "down";
                else sym = ev["tone"] == "pos" ? "up" : "down";
            }
            return V.Obj("color", def["colors"]["main"], "sym", sym);
        }

        static string Up(double v) { return v >= 0 ? "sube" : "baja"; }

        sealed class NewsInfo { public string more, who, what; }

        // PRIMERA PLANA: qué pasa, a quién afecta y qué puede pasar (en palabras de la calle)
        static NewsInfo NewsInfoOf(V n)
        {
            V ev = EventOf(n);
            V mk = n["market"].truthy ? D.marketLabel(n["market"]) : (V)"";
            if (n["cipher"].truthy)
                return new NewsInfo { more = "Está escrita con unas letras que nadie sabe leer. El periódico dice que es una errata.", who = "Nadie lo sabe.", what = "No se puede leer. Todavía." };
            if (n["dark"].truthy)
                return new NewsInfo { more = "Pasó justo después de tu operación. Seguro que es casualidad.", who = mk.truthy ? "La ciudad. Justo donde ganaste: " + mk.str + "." : "La ciudad.", what = "Nadie sabe qué significa. Mejor no pensarlo." };
            if (!ev.truthy)
                return new NewsInfo
                {
                    more = (n["more"] | (V)"").str,
                    who = mk.truthy ? mk.str : "A nadie: es una noticia de la ciudad.",
                    what = mk.truthy
                        ? (n["tone"] == "neg" ? "Ya ha pasado: el precio ha bajado." : n["tone"] == "pos" ? "Ya ha pasado: el precio ha subido." : "Ya ha pasado.")
                        : "Nada. No mueve ningún mercado.",
                };
            if (n["kind"] == "result")
                return new NewsInfo
                {
                    more = (ev["more"] | (V)"").str,
                    who = mk.str,
                    what = n["tone"] == "neg" ? "Ya se sabe: el precio ha bajado." : "Ya se sabe: el precio ha subido.",
                };
            string what;
            if (ev["kind"] == "shock") what = ev["tone"] == "pos" ? "Un salto hacia arriba en las próximas velas." : "Un golpe hacia abajo en las próximas velas.";
            else if (ev["kind"] == "trend") what = ev["trend"].num > 0 ? "Empuja el precio hacia arriba durante un buen rato." : "Empuja el precio hacia abajo durante un buen rato.";
            else if (ev["kind"] == "vol") what = "El precio se va a mover mucho, arriba y abajo. Cuidado con apostar fuerte.";
            else what = "Se sabrá en unas velas. Si pasa (\"" + ev["yesText"].str + "\"), " + mk.str + " " + Up(ev["yes"].num) + ". Si no (\"" + ev["noText"].str + "\"), " + Up(ev["no"].num) + ".";
            return new NewsInfo { more = (ev["more"] | (V)"").str, who = mk.str, what = what };
        }

        static (string cls, string text) Tag(V n)
        {
            if (n["cipher"].truthy) return ("dark", "¿ERRATA?");
            if (n["dark"].truthy) return ("dark", "SUCESOS");
            string where = n["market"].truthy ? D.marketLabel(n["market"]).str : "CIUDAD";
            string pre = n["tone"] == "pos" ? "▲ " : n["tone"] == "neg" ? "▼ " : "";
            return (n["tone"].str, pre + where);
        }

        static string Tone(V n) { return (n["tone"] | (V)"neu").str; }
        static string Txt(V n) { return (n["text"] | (V)"").str; }
        static double DarkFor(V n, double dark) { return (n["dark"].truthy || n["cipher"].truthy) ? dark : 0; }

        // El titular: las erratas están escritas en el idioma secreto y se leen según las letras que conoces
        string Title(V n)
        {
            if (!n["cipher"].truthy) return n["title"].str;
            V cn = D["cipher"]["news"].arr.find((c) => c["id"] == n["cipher"]);
            V txt = (cn.truthy ? cn["text"] : V.undefined) | (V)"";
            return SN.Cipher.html(txt, SN.UI.freshLetter);
        }

        // La errata del tutorial ("no es relevante"): su foto esconde la primera letra
        static void Errata(V n, DomElement photo)
        {
            if (n["cipher"] != "tuto") return;
            photo.classList.add("clue");
            photo.addEventListener("click", (e) => { e.stopPropagation(); if (!SN.Tutorial.active) SN.Cipher.discover("errata"); });
        }

        // Una noticia elegida (clic): PRIMERA PLANA
        Action<DomEvent> pick(V n) { return (e) => { e.stopPropagation(); newsFocus = n; SN.Audio.sfx("select"); refresh(); }; }

        void buildNews(DomElement body)
        {
            V run = S.run;
            JsArray news = run.truthy ? run["news"].arr.slice().reverse() : new JsArray();
            string today = run.truthy ? "Día " + run["day"].str + " · " + D["sim"]["turnNames"][run["turn"]].str : "";
            body.insertAdjacentHTML("beforeend", $@"<div class=""np-mast"">EL DIARIO DEL FUTURO</div>
      <div class=""np-sub""><span>{today}</span><span>Edición de la ciudad</span><span>$1</span></div>");
            // Si hay pocas noticias del mercado, la ciudad rellena el periódico (nunca sale vacío)
            JsArray filler = new JsArray();
            foreach (V x in D["story"]["fillerNews"].arr)
                if (!x["minDark"].truthy) filler.push(JsObject.Assign(V.Obj("day", 1, "turn", 0, "filler", true), x));
            JsArray items = news.slice(0, 31);
            for (int i = 0; items.length < 5 && i < filler.length; i++) items.push(filler[i]);
            double dark = SN.UI.darkLevel();
            // Una noticia elegida (clic): PRIMERA PLANA
            V focus = newsFocus.truthy
                ? items.find((x) => x == newsFocus || (x["filler"].truthy && newsFocus["filler"].truthy && x["title"] == newsFocus["title"]))
                : V.undefined;
            if (focus.truthy) { buildFront(body, focus, dark); return; }
            V top = items[0];

            // Portada: la noticia más reciente, con foto grande
            var hero = Dom.el("div", "np-hero" + (top["dark"].truthy ? " dark" : "") + (top["cipher"].truthy ? " cipher" : ""));
            hero.title = "Clic: leer la noticia entera";
            hero.addEventListener("click", pick(top));
            var heroPhoto = Photo(SN.NewsArt.node(ArtFor(top), Tone(top), DarkFor(top, dark), null, V.Obj("sticker", StickerOf(top))));
            hero.appendChild(heroPhoto);
            Errata(top, heroPhoto);
            var tg = Tag(top);
            hero.insertAdjacentHTML("beforeend", $@"<div><span class=""np-tag {tg.cls}"">{tg.text}</span> <span class=""w"">{When(top)}</span>
      <div class=""h"">{Title(top)}</div><div class=""t"">{Txt(top)}</div></div>");
            body.appendChild(hero);

            // El resto, en dos columnas con foto pequeña
            var grid = Dom.el("div", "np-grid");
            for (int i = 1; i < items.length; i++)
            {
                V n = items[i];
                var it = Dom.el("div", "np-item" + (n["dark"].truthy ? " dark" : "") + (n["cipher"].truthy ? " cipher" : ""));
                it.title = "Clic: leer la noticia entera";
                it.addEventListener("click", pick(n));
                var photo = Photo(SN.NewsArt.node(ArtFor(n), Tone(n), DarkFor(n, dark), V.Arr(48, 30), V.Obj("sticker", StickerOf(n))));
                it.appendChild(photo);
                Errata(n, photo);
                it.insertAdjacentHTML("beforeend", $@"<div><div class=""w"">{When(n)}</div><div>{Title(n)}</div></div>");
                grid.appendChild(it);
            }
            body.appendChild(grid);
            body.insertAdjacentHTML("beforeend", "<div class=\"np-ad\">Publicidad · <b>Pleyzeta 6 Ultra</b> · ahora también a plazos. Muchos plazos.</div>");
        }

        // PRIMERA PLANA de una noticia: la foto grande y a color, y lo que significa
        void buildFront(DomElement body, V n, double dark)
        {
            var info = NewsInfoOf(n);
            var tg = Tag(n);
            V def = n["market"].truthy ? D.marketById(n["market"]) : V.@null;
            var fr = Dom.el("div", "np-front" + (n["dark"].truthy ? " dark" : "") + (n["cipher"].truthy ? " cipher" : ""));
            DomElement ph = (n["dark"].truthy || n["cipher"].truthy)
                ? Photo(SN.NewsArt.node(ArtFor(n), Tone(n), dark, null, null))
                : Photo(SN.NewsArt.node(ArtFor(n), Tone(n), 0, null, V.Obj("color", true, "sticker", StickerOf(n))));
            fr.appendChild(ph);
            if (n["cipher"] == "tuto")
            {
                ph.classList.add("clue");
                ph.addEventListener("click", (e) => { e.stopPropagation(); if (!SN.Tutorial.active) SN.Cipher.discover("errata"); });
            }
            V st = StickerOf(n);
            string arrow = "";
            if (st.truthy)
            {
                switch (st["sym"].str)
                {
                    case "up": arrow = "<b class=\"up\">▲ sube</b>"; break;
                    case "down": arrow = "<b class=\"down\">▼ baja</b>"; break;
                    case "rumor": arrow = "<b class=\"mid\">? puede subir o bajar</b>"; break;
                    case "vol": arrow = "<b class=\"mid\">≈ se mueve mucho</b>"; break;
                }
            }
            string who = def.truthy ? "<i class=\"np-ico\"></i>" + info.who + " " + arrow : info.who;
            string moreHtml = string.IsNullOrEmpty(info.more) ? "" : "<div class=\"more\">" + info.more + "</div>";
            fr.insertAdjacentHTML("beforeend", $@"<div class=""np-fcol""><span class=""np-tag {tg.cls}"">{tg.text}</span> <span class=""w"">{When(n)}</span>
      <div class=""h"">{Title(n)}</div><div class=""t"">{Txt(n)}</div>{moreHtml}
      <div class=""np-box""><b>¿A quién afecta?</b>{who}</div><div class=""np-box""><b>¿Qué puede pasar?</b>{info.what}</div></div>");
            var ico = fr.querySelector(".np-ico");
            if (ico != null && def.truthy) ico.appendChild(SN.Sprites.node(def["icon"].str, 1));
            body.appendChild(fr);
            var backBtn = Dom.el("button", "btn btn-cream np-back", "◀ Volver");
            backBtn.addEventListener("click", (e) => { e.stopPropagation(); newsFocus = V.@null; SN.Audio.sfx("select"); refresh(); });
            body.appendChild(backBtn);
        }
    }
}
