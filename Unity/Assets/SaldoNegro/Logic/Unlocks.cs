// Port de js/systems/unlocks.js. MarketUnlockManager y escalera de progresión: qué mercados están abiertos y
// en qué paso vas (la Pleyzeta, cada "regalo" del encapuchado, cada objeto clave de la tienda y la meta final).
// La escalera es una CADENA DE DEUDAS: solo el paso actual cuenta; mientras haya una deuda sin pagar
// nada avanza y, al pagarla, llega la siguiente.
// Este archivo no toca la interfaz: devuelve lo que ha pasado y la narrativa lo cuenta (game.js).
namespace SaldoNegro.Logic
{
    public sealed class Unlocks
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public bool isUnlocked(V id) { return !!S.run["markets"][id] && !!S.run["markets"][id]["unlocked"]; }

        public void unlock(V id)
        {
            V m = S.run["markets"][id];
            if (!m || m["unlocked"]) return;
            m["unlocked"] = true;
            SN.Events.emit("market:unlocked", V.Obj("market", id));
        }

        // ---------- La escalera ----------
        public V step() { return D["chain"][S.run["step"]] || V.@null; }
        public int index(V id) { return D["chain"].arr.findIndex((s) => s["id"] == id); }
        // ¿Ya se completó ese paso?
        public bool done(V id) { int i = index(id); return i >= 0 && i < S.run["step"]; }
        // Compatibilidad: ¿se alcanzó esa meta?
        public bool goalReached(V id) { return done(id); }
        // ¿Hay algún mercado negro abierto? (para enseñar la pestaña Negro)
        public bool anyBlack() { return D["markets"].arr.some((d) => d["black"].truthy && isUnlocked(d["id"])); }

        // Lo que se muestra en el HUD: la deuda activa o, si no hay, lo que pide el paso actual
        public V currentGoal()
        {
            V run = S.run, d = run["debt"];
            if (d && !d["paid"]) return V.Obj("type", "debt", "amount", d["amount"], "title", "PAGAR DEUDA", "label", d["label"], "debt", d);
            V st = step();
            if (!st) return V.@null;
            if (st["kind"] == "item")
            {
                // La oferta de FUTURO.exe está esperando (no pide dinero): la barra enseña lo que vas a deber
                V it = D.keyItemById(st["item"]), o = offer(it);
                return V.Obj("type", "item", "amount", o["debt"], "title", "OFERTA: " + it["name"], "label", it["short"], "item", it, "offer", o);
            }
            if (st["kind"] == "goal") return JsObject.Assign(V.Obj("type", "goal", "title", "OBJETIVO " + Util.@short(st["amount"])), st);
            return V.@null;
        }

        // Avanza la escalera todo lo que se pueda. Devuelve lo que acaba de pasar o null si toca esperar:
        //   { type: 'done', step }  -> se completó un paso (su deuda está pagada)
        //   { type: 'gift', step }  -> el encapuchado trae un regalo (mejora + deuda nueva)
        //   { type: 'goal', step }  -> meta alcanzada (solo la final)
        // Los objetos clave no avanzan solos: se aceptan con la oferta de FUTURO.exe (acceptOffer).
        public V check()
        {
            V run = S.run;
            if (!run || run["position"] || run["over"]) return V.@null;
            V st = step();
            if (!st) return V.@null;
            if (run["debt"] && !run["debt"]["paid"]) return V.@null; // primero paga lo que debes
            if (run["stepOpen"]) return complete(st);
            if (st["kind"] == "gift") return giveGift(st);
            if (st["kind"] == "goal" && run["capital"] >= st["amount"]) return reachGoal(st);
            return V.@null;
        }

        public V complete(V st)
        {
            V run = S.run;
            run["step"] = run["step"] + 1;
            run["stepOpen"] = false;
            SN.Events.emit("step:done", V.Obj("step", st, "next", step()));
            return V.Obj("type", "done", "step", st, "next", step());
        }

        // Regalo: la mejora se puede comprar a partir de ahora, se abren sus mercados... y te deja una deuda
        public V giveGift(V st)
        {
            V run = S.run, up = SN.Upgrades.def(st["upgrade"]);
            run["gifts"][st["upgrade"]] = true;
            foreach (var id in (st["markets"] || new JsArray())) unlock(id);
            SN.Debt.open(V.Obj("id", st["id"], "kind", "gift", "label", "el regalo (" + up["name"] + ")", "amount", st["debt"], "days", st["days"]));
            run["stepOpen"] = true;
            SN.Events.emit("gift:given", V.Obj("step", st, "upgrade", st["upgrade"]));
            return V.Obj("type", "gift", "step", st);
        }

        public V reachGoal(V st)
        {
            V run = S.run;
            foreach (var id in st["markets"]) unlock(id);
            if (st["reward"]) SN.Economy.add(st["reward"], "reward");
            run["step"] = run["step"] + 1;
            run["stepOpen"] = false;
            SN.Events.emit("goal:reached", V.Obj("goal", st, "next", step()));
            return V.Obj("type", "goal", "step", st, "next", step());
        }

        // ---------- Objetos clave (tienda) ----------
        // La oferta de FUTURO.exe: nada hoy y todo, con intereses, en unos días
        // (la Academia de Bravo Fines enseña a leer la letra pequeña: menos deuda)
        public V offer(V item)
        {
            V it = item.isString ? D.keyItemById(item) : item;
            double k = SN.Academy != null ? SN.Academy.offerMul() : 1;
            double now = JsMath.round(it["price"] * D["offer"]["upfront"]), debt = JsMath.round(it["price"] * D["offer"]["debt"] * k);
            // need: lo que tiene que haber en tu cuenta para que FUTURO.exe te lo financie (la entrada o, si es
            // más, el 25% de lo que vas a deber)
            return V.Obj("item", it, "now", now, "debt", debt, "days", it["days"], "need", JsMath.max(now, JsMath.round(debt * (D["offer"]["solvency"] || 0))));
        }
        // Lo que vas a deber en el siguiente paso de la escalera (para el bono de la app al saldar una deuda)
        public double nextDebtAmount()
        {
            V run = S.run, st = run["stepOpen"] ? D["chain"][run["step"] + 1] : D["chain"][run["step"]];
            if (!st) return 0;
            if (st["kind"] == "gift") return st["debt"];
            if (st["kind"] == "item") return offer(st["item"])["debt"];
            return 0;
        }
        // El objeto clave que está esperando su oferta (o null): el paso actual, sin deudas pendientes
        public V pendingItem()
        {
            V run = S.run, st = step();
            if (!run || !st || st["kind"] != "item" || run["owned"][st["item"]] || (run["debt"] && !run["debt"]["paid"])) return V.@null;
            return D.keyItemById(st["item"]);
        }

        // ¿Se puede comprar ya? Solo el del paso actual y sin deudas pendientes (no pide dinero: se paga después)
        public V canBuyItem(V id)
        {
            V run = S.run, st = step(), it = D.keyItemById(id);
            if (!it) return V.Obj("ok", false);
            if (run["owned"][id]) return V.Obj("ok", false, "reason", "YA ES TUYO", "owned", true);
            if (!st || st["kind"] != "item" || st["item"] != id)
            {
                int i = D["keyItems"].arr.indexOf(it);
                V prev = i > 0 && !run["owned"][D["keyItems"][i - 1]["id"]] ? D["keyItems"][i - 1] : V.@null;
                string reason = "TODAVÍA NO";
                if (prev) reason = "PRIMERO: " + JsString.upper(prev["short"].str);
                else if (run["debt"] && !run["debt"]["paid"]) reason = "PRIMERO PAGA LO QUE DEBES";
                else if (st && st["kind"] == "goal") reason = "PRIMERO: LA META DE " + Util.@short(st["amount"]);
                return V.Obj("ok", false, "reason", reason, "locked", true);
            }
            if (run["position"]) return V.Obj("ok", false, "reason", "HAY UNA OPERACIÓN EN CURSO");
            if (run["debt"] && !run["debt"]["paid"]) return V.Obj("ok", false, "reason", "PRIMERO PAGA LO QUE DEBES");
            return V.Obj("ok", true);
        }

        // Aceptar la oferta: el objeto es tuyo, lo debes todo (con intereses) y se abre su mercado negro
        public V acceptOffer(V id)
        {
            if (!canBuyItem(id)["ok"]) return V.@null;
            V run = S.run, st = step(), o = offer(id), it = o["item"];
            if (o["now"]) SN.Economy.spend(o["now"], "shop");
            run["owned"][id] = true;
            SN.Debt.open(V.Obj("id", st["id"], "kind", "item", "label", it["short"], "amount", o["debt"], "days", o["days"]));
            run["stepOpen"] = true;
            unlock(it["market"]);
            SN.Events.emit("item:bought", V.Obj("item", it, "offer", o, "step", st));
            return V.Obj("type", "item", "step", st, "item", it, "offer", o);
        }
    }
}
