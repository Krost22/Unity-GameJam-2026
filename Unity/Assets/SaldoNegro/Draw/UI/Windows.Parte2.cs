// Segunda mitad de js/ui/windows.js (SN.Windows): la tienda (Destacados, objetos clave, mejoras, estilo de vida,
// coleccionables, mercados), la RULETA de los días de la suerte, la OFERTA de FUTURO.exe, el último pacto, "Acerca
// de" y los ajustes. La primera mitad (marco, Academia, periódico) está en Windows.cs.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Windows
    {
        static readonly (string id, string label, string ic)[] SHOP_CATS =
        {
            ("destacados", "Destacados", "estrella"), ("clave", "Objetos clave", "llave"), ("mejoras", "Mejoras", "flecha"),
            ("estilo", "Estilo de vida", "taza"), ("coleccion", "Colección", "gema"), ("mercados", "Mercados", "grafica"),
            ("academia", "Academia", "tiburon"), // la Academia de Bravo Fines (solo cuando se ha presentado)
        };

        // Icono de cada producto (los de la tienda, los objetos clave y los dorados de Don Siete)
        static readonly Dictionary<string, string> ITEM_ICON = new Dictionary<string, string>
        {
            ["taza"] = "taza",
            ["planta"] = "planta",
            ["lampara"] = "lampara",
            ["poster"] = "poster",
            ["alfombrilla"] = "alfombra",
            ["teclado"] = "teclado",
            ["cascos"] = "cascos",
            ["trofeo"] = "toro",
            ["tele"] = "tele",
            ["movil"] = "movil",
            ["moto"] = "moto",
            ["reloj"] = "reloj",
            ["maneki"] = "maneki",
            ["herradura"] = "herradura",
            ["trebol4"] = "trebol",
            ["billete7"] = "billete",
        };

        static string ItemIcon(V id) { return ITEM_ICON.TryGetValue(id.str, out var s) ? s : null; }

        static V Sel(string kind, V id) { return V.Obj("kind", kind, "id", id); }

        // Un producto, con lo que se ve de él y lo que pasa al comprarlo
        sealed class Prod
        {
            public V sel;
            public string icon, name, desc, level, effect, sub, state, note, action, info, shortName;
            public double? price, old;
            public bool free, gold;
        }

        // Un producto, con lo que se ve de él y lo que pasa al comprarlo. Devuelve null si no existe.
        static Prod ShopProduct(V sel)
        {
            if (!sel.truthy) return null;
            V run = S.run;
            double keep = D["sim"]["bankruptcyThreshold"].num;
            string kind = sel["kind"].str;
            if (kind == "life" || kind == "gold")
            {
                V it = (kind == "gold" ? D["luck"]["golden"] : D["shop"]).arr.find((x) => x["id"] == sel["id"]);
                if (!it.truthy) return null;
                double off = kind == "life" ? SN.Luck.discount() : 0;
                double price = JsMath.round(it["price"].num * (1 - off));
                bool owned = run["owned"][it["id"]].truthy;
                bool today = kind != "gold" || SN.Luck.goldenToday().arr.includes(it["id"]);
                bool poor = run["capital"].num - price < keep;
                return new Prod
                {
                    sel = sel,
                    icon = ItemIcon(it["id"]) ?? "caja",
                    name = it["name"].str,
                    desc = it["desc"].str,
                    price = price,
                    old = off != 0 ? (double?)it["price"].num : null,
                    state = owned ? "own" : !today ? "locked" : poor ? "poor" : "can",
                    note = owned ? "En tu habitación" : !today ? "Solo en días con 7" : poor ? "No te alcanza" : "",
                    action = owned || !today ? null : "buy",
                    gold = kind == "gold",
                };
            }
            if (kind == "up")
            {
                V d = SN.Upgrades.def(sel["id"]);
                if (!d.truthy) return null;
                bool unlocked = SN.Upgrades.isUnlocked(d["id"]);
                double lv = SN.Upgrades.level(d["id"]);
                V next = SN.Upgrades.next(d["id"]);
                V can = SN.Upgrades.canBuy(d["id"]);
                // A crédito: el precio que se ve es lo que se suma a tu deuda (con intereses); hoy no pagas nada
                double? credit = next.truthy ? (double?)SN.Upgrades.creditCost(d["id"]) : null;
                string effectTxt = next.truthy
                    ? d["effect"].call(next["value"]).str
                    : unlocked ? d["effect"].call(SN.Upgrades.value(d["id"])).str + " · máximo" : "";
                return new Prod
                {
                    sel = sel,
                    icon = d["icon"].str,
                    name = d["name"].str,
                    desc = unlocked ? d["desc"].str : (d["unlock"]["label"] | (V)"Bloqueado").str,
                    price = credit,
                    level = "Nv. " + Js.String(lv) + " / " + d["levels"].length.str,
                    effect = effectTxt,
                    sub = unlocked && next.truthy
                        ? "A crédito: hoy $0 · " + (SN.Debt.active() ? "se suma a tu deuda" : "deuda nueva, " + D["credit"]["days"].str + " días")
                        : "",
                    state = !unlocked ? "locked" : !next.truthy ? "own" : can["ok"].truthy ? "can" : "poor",
                    note = !unlocked ? "Llega como \"regalo\"" : !next.truthy ? "Al máximo" : can["ok"].truthy ? "" : Cap1((can["reason"] | (V)"TODAVÍA NO").str),
                    action = unlocked && next.truthy ? "up" : null,
                };
            }
            if (kind == "key")
            {
                V it = D.keyItemById(sel["id"]);
                if (!it.truthy) return null;
                V can = SN.Unlocks.canBuyItem(it["id"]);
                bool owned = run["owned"][it["id"]].truthy;
                V pend = SN.Unlocks.pendingItem();
                V o = SN.Unlocks.offer(it);
                bool mine = pend.truthy && pend["id"] == it["id"];
                // Hoy no se paga nada: el precio que se ve es la deuda que deja
                return new Prod
                {
                    sel = sel,
                    icon = ItemIcon(it["id"]),
                    name = it["name"].str,
                    desc = it["desc"].str,
                    price = o["debt"].num,
                    state = owned ? "own" : mine ? (can["ok"].truthy ? "can" : "poor") : "locked",
                    note = owned ? "En tu habitación" : can["reason"].truthy ? Cap1(can["reason"].str) : "",
                    action = mine ? "offer" : null,
                    sub = "Hoy $0 · luego debes " + Util.money(o["debt"].num) + " en " + o["days"].str + " días",
                };
            }
            if (kind == "ruleta")
            {
                V l = SN.Luck.today();
                if (!l.truthy || !l["events"].arr.includes("ruleta")) return null;
                return new Prod
                {
                    sel = sel,
                    icon = "coin0",
                    name = "Ruleta de la Fortuna",
                    desc = "Un giro gratis. Solo hoy, día de la suerte.",
                    price = 0,
                    free = true,
                    state = l["spun"].truthy ? "own" : "can",
                    note = l["spun"].truthy ? "Ya has girado hoy" : "",
                    action = l["spun"].truthy ? null : "ruleta",
                };
            }
            if (kind == "mkt")
            {
                V def = D.marketById(sel["id"]);
                if (!def.truthy) return null;
                bool open = SN.Unlocks.isUnlocked(def["id"]);
                return new Prod
                {
                    sel = sel,
                    icon = def["icon"].str,
                    name = def["name"].str,
                    desc = def["desc"].str,
                    info = "Tope: ±" + Util.money(def["cap"].num) + " por apuesta",
                    state = open ? "own" : "locked",
                    note = open ? "Abierto" : "Se abre: " + (def["unlock"]["label"] | (V)"más adelante").str,
                    action = null,
                    shortName = D.marketLabel(def["id"]).str,
                };
            }
            return null;
        }

        static List<V> ShopList(string cat)
        {
            V run = S.run;
            var l = new List<V>();
            if (cat == "mejoras") { foreach (V d in D["upgrades"].arr) l.Add(Sel("up", d["id"])); return l; }
            if (cat == "clave") { foreach (V it in D["keyItems"].arr) l.Add(Sel("key", it["id"])); return l; }
            if (cat == "estilo") { foreach (V it in D["shop"].arr) l.Add(Sel("life", it["id"])); return l; }
            if (cat == "coleccion") { foreach (V g in D["luck"]["golden"].arr) l.Add(Sel("gold", g["id"])); return l; }
            if (cat == "mercados") { foreach (V m in D["markets"].arr) l.Add(Sel("mkt", m["id"])); return l; }
            // Destacados: las ofertas del día (lo que ya se puede comprar; si no hay nada, lo más barato que falta)
            var outList = new List<V>();
            V today = SN.Luck.today();
            if (today.truthy && today["events"].arr.includes("ruleta") && !today["spun"].truthy) outList.Add(Sel("ruleta", "ruleta"));
            foreach (V x in SN.ShopWatch.list())
            {
                if (outList.Count >= 4) break;
                string[] kp = x["key"].str.Split(':');
                string k = kp[0];
                V id = kp.Length > 1 ? (V)kp[1] : V.@null;
                if (k == "shop") outList.Add(Sel("life", id));
                else if (k == "gold") outList.Add(Sel("gold", id));
                else if (k == "up") outList.Add(Sel("up", id));
            }
            JsArray cheapest = D["shop"].arr.filter((s) => !run["owned"][s["id"]].truthy).sort((a, b) => a["price"].num - b["price"].num);
            foreach (V it in cheapest)
            {
                if (outList.Count >= 4) break;
                if (!outList.Exists((o) => o["id"] == it["id"])) outList.Add(Sel("life", it["id"]));
            }
            return outList;
        }

        void buildShop(DomElement body)
        {
            V run = S.run;
            string cat = string.IsNullOrEmpty(shopCat) ? "destacados" : shopCat;
            List<V> list = ShopList(cat);
            V pend = SN.Unlocks.pendingItem();
            // El objeto clave por donde va la historia: el de la oferta pendiente o, si no, el siguiente que llegará
            V storyItem = pend.truthy ? pend : D["keyItems"].arr.find((it) => !run["owned"][it["id"]].truthy);
            // Lo elegido: en Destacados, al entrar, el objeto clave de la historia; si no, la primera tarjeta
            bool InCat(V s) => s.truthy && (list.Exists((x) => x["kind"] == s["kind"] && x["id"] == s["id"]) || (cat == "destacados" && s["kind"] == "key"));
            if (!InCat(shopSel))
                shopSel = (cat == "destacados" && storyItem.truthy) ? Sel("key", storyItem["id"]) : (list.Count > 0 ? list[0] : V.@null);
            var box = Dom.el("div", "sh");

            // Cabecera: carrito, título y tu dinero
            var head = Dom.el("div", "sh-top");
            head.appendChild(Big("cart", 2));
            string flashCls = shopFlash ? " flash" : "";
            head.insertAdjacentHTML("beforeend", $@"<div class=""sh-ttl""><b>Tienda</b><span>Mejoras, objetos y caprichos que te acercan a la fortuna.</span></div>
      <div class=""sh-cash{flashCls}"">{Util.money(run["capital"].num)}</div>");
            shopFlash = false;
            box.appendChild(head);

            // Categorías
            var nav = Dom.el("div", "sh-nav");
            foreach (var (id, label, ic) in SHOP_CATS)
            {
                if (id == "academia" && !(SN.Academy != null && SN.Academy.open())) continue;
                var nb = Dom.el("button", "sh-nb" + (cat == id ? " on" : ""));
                nb.dataset["cat"] = id;
                nb.appendChild(Big(ic, 1));
                int nCount = id == "academia" ? SN.Academy.buyable().length : 0;
                string badge = nCount != 0 ? "<b class=\"badge\">" + nCount + "</b>" : "";
                nb.insertAdjacentHTML("beforeend", "<span>" + label + "</span>" + badge);
                nb.addEventListener("click", (e) =>
                {
                    e.stopPropagation();
                    SN.Audio.sfx("select");
                    if (id == "academia") { open("upgrades"); return; }
                    if (shopCat == id) return;
                    shopCat = id;
                    shopSel = V.@null;
                    shopAnim = true;
                    refresh();
                });
                nav.appendChild(nb);
            }
            box.appendChild(nav);

            // Centro
            var main = Dom.el("div", "sh-main" + (shopAnim ? " in" : ""));
            shopAnim = false;
            DomElement Card(V sel)
            {
                Prod p = ShopProduct(sel);
                if (p == null) return null;
                bool on = shopSel.truthy && shopSel["kind"] == sel["kind"] && shopSel["id"] == sel["id"];
                var c = Dom.el("button", "sh-card " + p.state + (on ? " sel" : "") + (on && shopBump ? " bump" : "") + (p.gold ? " gold" : ""));
                c.dataset["kind"] = sel["kind"].str;
                c.dataset["id"] = sel["id"].str;
                c.title = p.name;
                c.appendChild(Big(p.icon, 2));
                if (p.state == "locked")
                {
                    var l = SN.Sprites.node("lock", 1);
                    l.className = "sh-lock";
                    c.appendChild(l);
                }
                string tagTxt = sel["kind"] == "mkt"
                    ? (p.state == "own" ? "Abierto" : "Cerrado")
                    : p.state == "own" ? "Tuyo" : p.free ? "Gratis" : p.price.HasValue ? Util.@short(p.price.Value) : "—";
                string shownName = string.IsNullOrEmpty(p.shortName) ? p.name : p.shortName;
                c.insertAdjacentHTML("beforeend", "<span class=\"nm\">" + shownName + "</span><b class=\"pr\">" + tagTxt + "</b>");
                c.addEventListener("click", (e) => { e.stopPropagation(); shopSel = sel; shopBump = true; SN.Audio.sfx("select"); refresh(); });
                return c;
            }

            if (cat == "destacados")
            {
                // Banner: el objeto clave que toca (su oferta de FUTURO.exe) o, si no, el siguiente que llegará
                V next = pend.truthy ? pend : D["keyItems"].arr.find((it) => !run["owned"][it["id"]].truthy);
                if (next.truthy)
                {
                    Prod bp = ShopProduct(Sel("key", next["id"]));
                    var ban = Dom.el("div", "sh-ban" + (pend.truthy ? "" : " wait"));
                    var art = Dom.el("div", "sh-bart");
                    art.appendChild(Big(bp.icon, 3));
                    ban.appendChild(art);
                    string smallHtml = pend.truthy ? "" : "<small>" + bp.note + "</small>";
                    ban.insertAdjacentHTML("beforeend", $@"<div class=""sh-btxt""><b>{bp.name}</b><span>{bp.desc}</span>
          <div class=""sh-bpr""><b>Hoy $0</b><em>Debes {Util.money(bp.price.Value)}</em></div>
          {smallHtml}</div>");
                    if (pend.truthy)
                    {
                        var bb = Dom.el("button", "btn btn-green sh-bbtn", "Ver oferta");
                        bb.disabled = run["position"].truthy;
                        bb.addEventListener("click", (e) => { e.stopPropagation(); offer(pend["id"], "shop"); });
                        ban.appendChild(bb);
                    }
                    ban.addEventListener("click", (e) => { e.stopPropagation(); shopSel = Sel("key", next["id"]); shopBump = true; SN.Audio.sfx("select"); refresh(); });
                    main.appendChild(ban);
                }
                else main.appendChild(Dom.el("div", "sh-ban done", "<div class=\"sh-btxt\"><b>Lo tienes todo</b><span>Ya no quedan objetos clave. Por ahora.</span></div>"));
                double off = SN.Luck.discount();
                main.appendChild(Dom.el("div", "sh-sec", off != 0
                    ? "Ofertas del día <em>· Don Siete rebaja un " + Js.String(JsMath.round(off * 100)) + "%</em>"
                    : "Ofertas del día"));
            }
            else if (cat == "estilo" && SN.Luck.discount() != 0)
            {
                main.appendChild(Dom.el("div", "sh-sec", "Estilo de vida <em>· Don Siete rebaja un " + Js.String(JsMath.round(SN.Luck.discount() * 100)) + "%</em>"));
            }
            if (cat == "mejoras")
            {
                // Las mejoras van en filas: nivel y efecto a la vista
                var rows = Dom.el("div", "sh-rows");
                foreach (V sel in list)
                {
                    Prod rp = ShopProduct(sel);
                    bool on = shopSel.truthy && shopSel["kind"] == "up" && shopSel["id"] == sel["id"];
                    var r = Dom.el("button", "sh-row " + rp.state + (on ? " sel" : "") + (on && shopBump ? " bump" : ""));
                    r.dataset["kind"] = "up";
                    r.dataset["id"] = sel["id"].str;
                    r.appendChild(Big(rp.icon, 2));
                    string rLevel = rp.state == "locked" ? "" : rp.level;
                    string rEffect = rp.state == "locked" ? rp.desc : rp.effect;
                    string rPrice = rp.state == "locked" ? "" : rp.price.HasValue ? Util.@short(rp.price.Value) : "Máx.";
                    r.insertAdjacentHTML("beforeend", "<div class=\"sh-rt\"><b>" + rp.name + " <em>" + rLevel + "</em></b><span>" + rEffect + "</span></div>\n          <b class=\"pr\">" + rPrice + "</b>");
                    if (rp.state == "locked")
                    {
                        var l = SN.Sprites.node("lock", 1);
                        l.className = "sh-lock";
                        r.appendChild(l);
                    }
                    r.addEventListener("click", (e) => { e.stopPropagation(); shopSel = sel; shopBump = true; SN.Audio.sfx("select"); refresh(); });
                    rows.appendChild(r);
                }
                main.appendChild(rows);
            }
            else
            {
                var grid = Dom.el("div", "sh-grid");
                foreach (V sel in list)
                {
                    DomElement card = Card(sel);
                    if (card != null) grid.appendChild(card);
                }
                if (grid.childNodes.Count == 0) grid.appendChild(Dom.el("div", "sh-empty", "Nada por aquí. De momento."));
                main.appendChild(grid);
            }
            box.appendChild(main);

            // Detalle del producto elegido
            var det = Dom.el("div", "sh-dt" + (shopBump ? " bump" : ""));
            shopBump = false;
            Prod dp = ShopProduct(shopSel);
            det.appendChild(Dom.el("div", "sh-dh", "Detalle"));
            if (dp != null)
            {
                var ico = Dom.el("div", "sh-dico");
                ico.appendChild(Big(dp.icon, 2));
                det.appendChild(ico);
                string levelHtml = string.IsNullOrEmpty(dp.level) ? "" : "<span class=\"sh-dl\">" + dp.level + "</span>";
                string effHtml = string.IsNullOrEmpty(dp.effect) ? "" : "<div class=\"sh-de\">" + (dp.state == "own" ? "" : "Siguiente: ") + dp.effect + "</div>";
                string infoHtml = string.IsNullOrEmpty(dp.info) ? "" : "<div class=\"sh-de\">" + dp.info + "</div>";
                string subHtml = string.IsNullOrEmpty(dp.sub) ? "" : "<div class=\"sh-de\">" + dp.sub + "</div>";
                string priceHtml = dp.price.HasValue && dp.state != "own" && !dp.free
                    ? "<div class=\"sh-dp\">" + (dp.old.HasValue ? "<s>" + Util.money(dp.old.Value) + "</s>" : "") + "<b class=\"" + (dp.state == "poor" ? "poor" : "") + "\">" + Util.money(dp.price.Value) + "</b></div>"
                    : "";
                string noteHtml = string.IsNullOrEmpty(dp.note) ? "" : "<div class=\"sh-dnote " + dp.state + "\">" + dp.note + "</div>";
                det.insertAdjacentHTML("beforeend", "<b class=\"sh-dn\">" + dp.name + "</b>" + levelHtml + "\n        <p class=\"sh-dd\">" + dp.desc + "</p>" + effHtml + "\n        "
                    + infoHtml + subHtml + "\n        " + priceHtml + "\n        " + noteHtml);
                if (!string.IsNullOrEmpty(dp.action))
                {
                    string label = dp.action == "buy" ? "Comprar" : dp.action == "up" ? "Mejorar a crédito" : dp.action == "offer" ? "Ver oferta" : "¡Girar!";
                    var btn = Dom.el("button", "btn " + (dp.action == "offer" ? "btn-cyan" : "btn-green") + " sh-buy", label);
                    btn.disabled = run["position"].truthy || (dp.action == "buy" && dp.state != "can") || (dp.action == "up" && dp.state != "can");
                    btn.addEventListener("click", (e) => { e.stopPropagation(); shopAct(dp, btn); });
                    det.appendChild(btn);
                }
            }
            box.appendChild(det);
            body.appendChild(box);
        }

        // Comprar (o abrir la oferta, o girar la ruleta) con la misma lógica de siempre
        void shopAct(Prod p, DomElement btn)
        {
            V run = S.run;
            V sel = p.sel;
            void cheer(string color)
            {
                V q = SN.UI.posIn(btn);
                SN.FX.coins(q["x"].num + q["w"].num / 2, q["y"].num, 10, 0.9);
                SN.FX.ring(q["x"].num + q["w"].num / 2, q["y"].num + 5, color, 40);
                shopFlash = true;
                refresh();
            }
            if (p.action == "offer") { offer(sel["id"], "shop"); return; }
            if (p.action == "ruleta") { open("ruleta"); return; }
            if (p.action == "up")
            {
                if (!SN.Upgrades.buy(sel["id"])) { SN.Audio.sfx("error"); return; }
                SN.Audio.sfx("unlock");
                SN.Save.saveRun();
                cheer(PAL.green);
                SN.UI.renderHUD();
                return;
            }
            // Estilo de vida y objetos dorados: igual que siempre (precio con la rebaja de Don Siete, sin quedarte a cero)
            double price = p.price.Value;
            if (run["position"].truthy || run["capital"].num - price < D["sim"]["bankruptcyThreshold"].num || !SN.Economy.spend(price, "shop"))
            {
                SN.Audio.sfx("error");
                return;
            }
            run["owned"][sel["id"]] = true;
            SN.Desk.dirty();
            SN.Audio.sfx(p.gold ? "lucky" : "pay");
            SN.FX.confetti(30);
            SN.Hands.celebrate(false);
            SN.Save.saveRun();
            cheer(PAL.yellow);
        }

        // ---------- La Ruleta de la Fortuna (días de la suerte) ----------
        // Primero gira (la casilla ya está elegida) y al pararse entrega el premio.
        static readonly string[] WHEEL_COLORS = { "#FFD34E", "#3F2F60", "#45E3DA", "#3DDC84", "#FF4F6D", "#FF8F3F", "#A880FF", "#FFF0A3" };

        static void drawWheel(DomElement c, double angle)
        {
            Ctx2D g = c.getContext();
            int n = D["luck"]["wheel"].length.i;
            const double r = 44, cx = 48, cy = 48;
            g.clearRect(0, 0, 96, 96);
            for (int i = 0; i < n; i++)
            {
                g.beginPath();
                g.moveTo(cx, cy);
                g.arc(cx, cy, r, angle + i * Math.PI * 2 / n, angle + (i + 1) * Math.PI * 2 / n);
                g.closePath();
                g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.Length];
                g.fill();
                g.strokeStyle = "#0E0A1C";
                g.lineWidth = 2;
                g.stroke();
                double mid = angle + (i + 0.5) * Math.PI * 2 / n;
                Px.text(g, Js.String((double)(i + 1)), cx + JsMath.cos(mid) * 30, cy + JsMath.sin(mid) * 30 + 3, "#0E0A1C", 8, "center");
            }
            g.beginPath();
            g.arc(cx, cy, 8, 0, Math.PI * 2);
            g.fillStyle = "#0E0A1C";
            g.fill();
            g.beginPath();
            g.arc(cx, cy, 5, 0, Math.PI * 2);
            g.fillStyle = "#FFD34E";
            g.fill();
        }

        // La casilla que queda bajo la flecha (arriba) con la ruleta girada `angle`
        static int wedgeAt(double angle)
        {
            int n = D["luck"]["wheel"].length.i;
            double step = Math.PI * 2 / n;
            double a = ((-Math.PI / 2 - angle) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
            return (int)Math.Floor(a / step) % n;
        }

        void buildWheel(DomElement body)
        {
            V luck = SN.Luck.today();
            string items = "";
            foreach (V w in D["luck"]["wheel"].arr) items += "<li>" + w["label"].str + "</li>";
            body.innerHTML = "<div class=\"rl\"><div class=\"rl-wheel\"><b class=\"rl-arrow\">▼</b><canvas width=\"96\" height=\"96\"></canvas></div>\n"
                + "      <div class=\"rl-side\"><div class=\"rl-now\">Hoy es día de la suerte</div><ol class=\"rl-list\">" + items + "</ol>\n"
                + "      <button class=\"btn btn-yellow rl-go\">¡Girar!</button><div class=\"rl-res\"></div></div></div>";
            var c = body.querySelector("canvas");
            c.setCanvasSize(96, 96); // el <canvas width="96" height="96"> de la plantilla
            var now = body.querySelector(".rl-now");
            List<DomElement> lis = body.querySelectorAll(".rl-list li");
            double angle = 0;
            void show()
            {
                drawWheel(c, angle);
                int i = wedgeAt(angle);
                now.textContent = "▲ " + D["luck"]["wheel"][i]["label"].str;
                for (int k = 0; k < lis.Count; k++) lis[k].classList.toggle("on", k == i);
            }
            show();
            var go = body.querySelector(".rl-go");
            if (!luck.truthy || luck["spun"].truthy)
            {
                go.disabled = true;
                body.querySelector(".rl-res").textContent = "Ya has girado hoy.";
                return;
            }
            go.addEventListener("click", (e) =>
            {
                e.stopPropagation();
                V p = SN.Luck.pick();
                if (!p.truthy) { SN.Audio.sfx("error"); return; }
                go.disabled = true;
                SN.Save.saveRun();
                // Vueltas y frenada hasta dejar la casilla elegida bajo la flecha
                int n = D["luck"]["wheel"].length.i;
                double step = Math.PI * 2 / n;
                double target = -Math.PI / 2 - (p["index"].num + 0.2 + JsMath.rnd() * 0.6) * step - Math.PI * 2 * 5;
                double fromA = angle, dur = 3.2;
                double t = 0;
                int last = wedgeAt(angle);
                void finish()
                {
                    V res = p.obj.assign(SN.Luck.apply(p["id"], SN.Luck.k()));
                    SN.Events.emit("luck:spin", res);
                    SN.Save.saveRun();
                    bool bad = p["id"] == "maldita" || p["id"] == "nada";
                    SN.Audio.sfx(bad ? "error" : "lucky");
                    if (!bad) SN.FX.confetti(40);
                    var outEl = body.querySelector(".rl-res");
                    if (outEl != null) outEl.innerHTML = "<b>" + p["label"].str + "</b> " + (res["text"] | (V)"").str;
                    SN.UI.renderAll();
                }
                void tick(double _)
                {
                    // Si se cierra la ventana a mitad de giro, el premio se entrega igual
                    if (win == null || current != "ruleta") { finish(); return; }
                    t = JsMath.min(1, t + 1 / 60.0 / dur);
                    angle = Util.lerp(fromA, target, Util.ease.outCubic(t));
                    int i = wedgeAt(angle);
                    if (i != last) { last = i; SN.Audio.sfx("wheel"); }
                    show();
                    if (t < 1) { Dom.requestAnimationFrame(tick); return; }
                    finish();
                }
                Dom.requestAnimationFrame(tick);
            });
        }

        // ---------- La oferta de FUTURO.exe ----------
        // El mismo objeto por un 10% hoy... y la letra pequeña. Salta sola al pagar la deuda anterior (y cuando te
        // llega para la entrada, y cada mañana que siga pendiente); también se abre desde la tienda o el HUD.
        // "No, gracias" la cierra: el objeto sigue esperando en la tienda.
        void buildOffer(DomElement body)
        {
            V it = D.keyItemById(opts["item"]);
            if (!it.truthy) { close(true); return; }
            V o = SN.Unlocks.offer(it);
            V st = D["story"]["offer"];
            V run = S.run;
            string fill(V tv)
            {
                string t = tv.str;
                t = ReplaceFirst(t, "{item}", it["name"].str);
                t = t.Replace("{now}", Util.money(o["now"].num));
                t = ReplaceFirst(t, "{debt}", Util.money(o["debt"].num));
                t = ReplaceFirst(t, "{days}", o["days"].str);
                return t;
            }
            V can = SN.Unlocks.canBuyItem(it["id"]);
            // Es el siguiente paso de la historia: un solo botón, nada que pagar hoy y la deuda en la letra pequeña
            string whyTxt = opts["why"] == "insist" ? st["insist"].str : "Oferta encontrada";
            string clause = it["id"] == "reloj" ? " <b class=\"of-clause\">" + st["clause"].str + "</b>" : "";
            var pop = Dom.el("div", "offer");
            pop.innerHTML = $@"<div class=""of-head""><i class=""of-ico""></i>{SN.Cipher.brand(true)}<span>{whyTxt}</span></div>
      <div class=""of-title"">{st["title"].str}</div>
      <div class=""of-line"">{fill(st["line"])}</div>
      <div class=""of-price""><s>{Util.money(it["price"].num)}</s><b>{st["free"].str}</b><em>{st["save"].str}</em></div>
      <div class=""of-later"">{fill(st["later"])}</div>
      <button class=""of-small"">{st["small"].str} ▼</button>
      <div class=""of-fine hidden"">{fill(st["smallText"])}{clause} <b class=""cx of-clue"" title="""">{D["cipher"]["alphabet"]["D"].str}</b></div>
      <div class=""of-row""><button class=""btn btn-yellow of-yes"">{st["yes"].str}</button></div>";
            pop.querySelector(".of-ico").style.backgroundImage = "url(" + SN.Sprites.url("app", 1) + ")";
            var yes = pop.querySelector(".of-yes");
            yes.disabled = !can["ok"].truthy || run["position"].truthy;
            if (!can["ok"].truthy && can["reason"].truthy) yes.title = can["reason"].str;
            body.appendChild(pop);
            SN.FX.glitch(0.25, 0.8);
            pop.addEventListener("click", (e) => e.stopPropagation());
            pop.querySelector(".of-small").addEventListener("click", () =>
            {
                pop.querySelector(".of-fine").classList.toggle("hidden");
                SN.Audio.sfx("select");
                SN.Events.emit("offer:fineprint", V.Obj("item", it["id"], "el", V.wrap(pop.querySelector(".of-fine"))));
            });
            pop.querySelector(".of-clue").addEventListener("click", () => SN.Cipher.discover("letra"));
            yes.addEventListener("click", () =>
            {
                if (SN.Unlocks.canBuyItem(it["id"])["ok"].truthy) SN.Game.buyKeyItem(it["id"]);
                else SN.Audio.sfx("error");
            });
        }

        // ---------- La última oferta (el final A, js/systems/finale.js) ----------
        // El encapuchado ofrece tenerlo todo. «¡Lo quiero!» es el final A; «Ahora no» deja ir al escritorio (NULL.EXE).
        // Si no eliges, vuelve cada turno: a la tercera, la entidad elige por ti.
        void buildPact(DomElement body)
        {
            V st = D["finale"]["pact"];
            V f = S.run.truthy ? S.run["finale"] : V.@null;
            V nIns = f.truthy ? (f["insist"] | (V)0) : (V)0;
            double n = nIns.num;
            string headTxt = n != 0 ? st["insist"].arr[(int)JsMath.min(n, st["insist"].length.num) - 1].str : st["title"].str;
            string lines = "";
            foreach (V l in st["lines"].arr) lines += "<p>«" + l.str + "»</p>";
            var pop = Dom.el("div", "offer pact");
            pop.innerHTML = $@"<div class=""of-head""><i class=""of-ico""></i>{SN.Cipher.brand(true)}<span>{headTxt}</span></div>
      <div class=""pa-face""></div>
      <div class=""pa-lines"">{lines}</div>
      <div class=""of-row""><button class=""btn btn-cream pa-no"">{st["no"].str}</button><button class=""btn btn-yellow of-yes"">{st["yes"].str}</button></div>";
            pop.querySelector(".of-ico").style.backgroundImage = "url(" + SN.Sprites.url("app", 1) + ")";
            Canvas face = Px.canvas(40, 46);
            Px.ctx(face).drawImage(SN.Chars.hoodedCanvas(0, V.Obj("smile", true)), 0, 0);
            pop.querySelector(".pa-face").appendChild(CanvasEl(face));
            body.appendChild(pop);
            SN.FX.glitch(0.3, 0.8);
            pop.addEventListener("click", (e) => e.stopPropagation());
            pop.querySelector(".of-yes").addEventListener("click", () =>
            {
                if (SN.Finale.choosing()) SN.Finale.choose("A");
                else SN.Audio.sfx("error");
            });
            pop.querySelector(".pa-no").addEventListener("click", () => close());
        }

        // Compatibilidad: abrir la oferta de un objeto
        public void showOffer(V it) { offer(it["id"] | it, "shop"); }

        // "Acerca de FUTURO.exe" (clic en el icono de la barra de título): créditos... y el sello con la F
        void buildAbout(DomElement body)
        {
            bool found = SN.Cipher.found("acerca");
            string sealCls = found ? " read" : "";
            string sealHtml = found ? "<b class=\"cx-k\">F</b>" : "<b class=\"cx\">" + D["cipher"]["alphabet"]["F"].str + "</b>";
            body.innerHTML = $@"<div class=""ab""><div class=""ab-logo""></div><div class=""ab-txt"">
      <b>{SN.Cipher.brand(true)}</b> versión 6.6.6<br>
      Licencia: perpetua. No se puede cerrar.<br>
      © Futuro S.L. Todos los derechos reservados. También los tuyos.<br>
      Programa recomendado por: un amigo con capucha.</div>
      <button class=""ab-seal{sealCls}"" title="""">{sealHtml}</button></div>";
            body.querySelector(".ab-logo").appendChild(SN.Sprites.node("appBig", 2));
            body.querySelector(".ab-seal").addEventListener("click", (e) => { e.stopPropagation(); SN.Cipher.discover("acerca"); refresh(); });
        }

        void buildSettings(DomElement body)
        {
            V st = S.profile["settings"];
            void row(string label, string btnText, string cls, Action fn)
            {
                var r = Dom.el("div", "set-row", "<span>" + label + "</span>");
                var b = Dom.el("button", "btn " + cls, btnText);
                b.addEventListener("click", (e) => { e.stopPropagation(); SN.Audio.sfx("click"); fn(); });
                r.appendChild(b);
                body.appendChild(r);
            }
            row("Música", st["music"].truthy ? "Sí" : "No", st["music"].truthy ? "btn-green" : "btn-cream", () =>
            {
                st["music"] = !st["music"];
                SN.Audio.setMusic(st["music"].truthy);
                SN.Save.saveProfile();
                refresh();
            });
            row("Efectos de sonido", st["sfx"].truthy ? "Sí" : "No", st["sfx"].truthy ? "btn-green" : "btn-cream", () =>
            {
                st["sfx"] = !st["sfx"];
                SN.Audio.setSfx(st["sfx"].truthy);
                SN.Save.saveProfile();
                SN.UI.renderSound();
                refresh();
            });
            row("Pantalla completa", "Cambiar", "btn-cyan", () =>
            {
                try { if (Dom.fullscreenElement) Dom.exitFullscreen(); else Dom.requestFullscreen(); }
                catch (Exception) { /* no disponible */ }
            });
            bool inGame = SN.Game.state == "GAMEPLAY" && S.run.truthy;
            if (inGame)
            {
                row("Repetir tutorial", "Repasar", "btn-yellow", () => { close(true); SN.Tutorial.replay(); });
                row("Guardar y salir al menú", "Salir", "btn-coral", () => { close(true); SN.Game.toMenu(); });
            }
            body.appendChild(Dom.el("div", "set-keys",
                "Todo se puede hacer con el ratón. Atajos de teclado:<br>" +
                "<kbd>↑</kbd><kbd>B</kbd> sube · <kbd>↓</kbd><kbd>V</kbd> baja · <kbd>ESPACIO</kbd> cobrar · <kbd>F</kbd> acelerar<br>" +
                "<kbd>← →</kbd> apuesta · <kbd>1-4</kbd> multiplicador · <kbd>P</kbd> esperar · <kbd>TAB</kbd> mercado<br>" +
                "<kbd>M</kbd> mejoras · <kbd>N</kbd> noticias · <kbd>T</kbd> tienda · <kbd>ESC</kbd> menú / cerrar"));
        }
    }
}
