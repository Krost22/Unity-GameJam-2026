// Port de js/systems/shopwatch.js. ShopWatchManager: qué se puede comprar AHORA (mejoras, la Academia de Bravo
// Fines, la tienda y la oferta de FUTURO.exe) y qué es NUEVO desde la última vez que miraste. De aquí salen el
// número rojo de la Tienda (todo está en ella), los avisos de "ya puedes comprar..." y cuándo la oferta de un
// objeto clave salta sola.
// No toca la interfaz: avisa con 'shop:new' (cosas nuevas) y 'offer:prompt' (enseñar la oferta).
namespace SaldoNegro.Logic
{
    public sealed class ShopWatch
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        // Todo lo que se puede comprar ahora mismo. key identifica cada cosa (un nivel nuevo es una cosa nueva);
        // win es la ventana donde está (upgrades = Mejoras y Academia, shop = Tienda).
        public JsArray list()
        {
            V run = S.run;
            var @out = new JsArray();
            if (!run) return @out;
            V keep = D["sim"]["bankruptcyThreshold"];
            // Todo vive en la TIENDA (las mejoras se compran a crédito: cuentan si todavía se podrían pagar a tiempo)
            foreach (var d in D["upgrades"])
            {
                if (!SN.Upgrades.isUnlocked(d["id"]) || !SN.Upgrades.next(d["id"]) || !SN.Upgrades.canBuy(d["id"])["ok"]) continue;
                double lv = SN.Upgrades.level(d["id"]);
                @out.push(V.Obj("key", "up:" + d["id"] + ":" + Js.String(lv), "win", "shop", "kind", "upgrade", "label", d["name"] + " NV." + Js.String(lv + 1)));
            }
            if (SN.Academy != null) foreach (var n in SN.Academy.buyable()) @out.push(V.Obj("key", "ac:" + n["id"], "win", "shop", "kind", "academy", "label", n["name"]));
            V it = SN.Unlocks.pendingItem();
            if (it) @out.push(V.Obj("key", "offer:" + it["id"], "win", "shop", "kind", "offer", "label", it["name"]));
            double off = SN.Luck.discount();
            foreach (var s in D["shop"])
            {
                if (!run["owned"][s["id"]] && run["capital"] - JsMath.round(s["price"] * (1 - off)) >= keep) @out.push(V.Obj("key", "shop:" + s["id"], "win", "shop", "kind", "shop", "label", s["name"]));
            }
            foreach (var id in SN.Luck.goldenToday())
            {
                V g = D["luck"]["golden"].arr.find((x) => x["id"] == id);
                if (g && !run["owned"][id] && run["capital"] - g["price"] >= keep) @out.push(V.Obj("key", "gold:" + id + ":" + run["day"], "win", "shop", "kind", "gold", "label", g["name"]));
            }
            return @out;
        }

        public V seen() { V run = S.run; if (!run["seen"]) run["seen"] = new JsObject(); return run["seen"]; }
        // Número rojo de una ventana: lo comprable que todavía no has visto
        public int badge(V win)
        {
            if (!S.run) return 0;
            V seen = this.seen();
            return list().filter((x) => x["win"] == win && !seen[x["key"]]).length;
        }
        // Al abrir la ventana, lo que hay se da por visto
        public void markSeen(V win)
        {
            if (!S.run) return;
            V seen = this.seen();
            foreach (var x in list()) if (x["win"] == win) seen[x["key"]] = true;
        }

        // Al terminar cada turno: avisa de lo que acaba de volverse comprable (una vez cada cosa)
        // y decide si la oferta pendiente de FUTURO.exe tiene que saltar sola.
        public void afterTurn()
        {
            V run = S.run;
            if (!run || run["over"]) return;
            if (!run["notified"]) run["notified"] = new JsObject();
            V seen = this.seen();
            JsArray fresh = list().filter((x) => x["kind"] != "offer" && !seen[x["key"]] && !run["notified"][x["key"]]);
            foreach (var x in fresh) run["notified"][x["key"]] = true;
            if (fresh.length > 0) SN.Events.emit("shop:new", V.Obj("items", fresh));
            offerCheck();
        }

        // La oferta de un objeto clave es el siguiente paso de la historia: salta sola al quedar pendiente (justo
        // después de pagar la deuda anterior) y, mientras siga pendiente, vuelve al terminar cada turno.
        public V offerCheck()
        {
            V run = S.run, it = SN.Unlocks.pendingItem();
            if (!it) return V.@null;
            V st = SN.Unlocks.step();
            if (!run["offer"] || run["offer"]["step"] != st["id"]) run["offer"] = V.Obj("step", st["id"], "shown", false, "day", 0);
            V o = run["offer"];
            string why = o["shown"] ? "insist" : "new";
            o["shown"] = true;
            o["day"] = run["day"];
            SN.Events.emit("offer:prompt", V.Obj("item", it, "why", why, "can", true));
            return why;
        }
    }
}
