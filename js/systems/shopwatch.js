// ShopWatchManager: qué se puede comprar AHORA (mejoras, la Academia de Bravo Fines, la tienda y la oferta
// de FUTURO.exe) y qué es NUEVO desde la última vez que miraste. De aquí salen los números rojos de Mejoras
// y Tienda, los avisos de "ya puedes comprar..." y cuándo la oferta de un objeto clave salta sola.
// No toca la interfaz: avisa con 'shop:new' (cosas nuevas) y 'offer:prompt' (enseñar la oferta).
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  const W = SN.ShopWatch = {
    // Todo lo que se puede comprar ahora mismo. key identifica cada cosa (un nivel nuevo es una cosa nueva);
    // win es la ventana donde está (upgrades = Mejoras y Academia, shop = Tienda).
    list() {
      const run = S.run, out = [];
      if (!run) return out;
      const keep = D.sim.bankruptcyThreshold;
      for (const d of D.upgrades) {
        if (!SN.Upgrades.isUnlocked(d.id) || !SN.Upgrades.next(d.id)) continue;
        const lv = SN.Upgrades.level(d.id);
        if (run.capital - SN.Upgrades.next(d.id).cost >= keep) out.push({ key: `up:${d.id}:${lv}`, win: 'upgrades', kind: 'upgrade', label: `${d.name} NV.${lv + 1}` });
      }
      if (SN.Academy) for (const n of SN.Academy.buyable()) out.push({ key: `ac:${n.id}`, win: 'upgrades', kind: 'academy', label: n.name });
      const it = SN.Unlocks.pendingItem();
      if (it && run.capital >= SN.Unlocks.offer(it).need) out.push({ key: `offer:${it.id}`, win: 'shop', kind: 'offer', label: it.name });
      const off = SN.Luck.discount();
      for (const s of D.shop) {
        if (!run.owned[s.id] && run.capital - Math.round(s.price * (1 - off)) >= keep) out.push({ key: `shop:${s.id}`, win: 'shop', kind: 'shop', label: s.name });
      }
      for (const id of SN.Luck.goldenToday()) {
        const g = D.luck.golden.find((x) => x.id === id);
        if (g && !run.owned[id] && run.capital - g.price >= keep) out.push({ key: `gold:${id}:${run.day}`, win: 'shop', kind: 'gold', label: g.name });
      }
      return out;
    },

    seen() { const run = S.run; if (!run.seen) run.seen = {}; return run.seen; },
    // Número rojo de una ventana: lo comprable que todavía no has visto
    badge(win) {
      if (!S.run) return 0;
      const seen = this.seen();
      return this.list().filter((x) => x.win === win && !seen[x.key]).length;
    },
    // Al abrir la ventana, lo que hay se da por visto
    markSeen(win) {
      if (!S.run) return;
      const seen = this.seen();
      for (const x of this.list()) if (x.win === win) seen[x.key] = true;
    },

    // Al terminar cada turno: avisa de lo que acaba de volverse comprable (una vez cada cosa)
    // y decide si la oferta pendiente de FUTURO.exe tiene que saltar sola.
    afterTurn() {
      const run = S.run;
      if (!run || run.over) return;
      if (!run.notified) run.notified = {};
      const seen = this.seen();
      const fresh = this.list().filter((x) => x.kind !== 'offer' && !seen[x.key] && !run.notified[x.key]);
      for (const x of fresh) run.notified[x.key] = true;
      if (fresh.length) SN.Events.emit('shop:new', { items: fresh });
      this.offerCheck();
    },

    // La oferta de un objeto clave salta sola: al quedar pendiente (justo después de pagar la deuda anterior),
    // en cuanto te llega para la entrada si entonces no te llegaba, y cada mañana que siga pendiente.
    offerCheck() {
      const run = S.run, it = SN.Unlocks.pendingItem();
      if (!it) return null;
      const st = SN.Unlocks.step();
      if (!run.offer || run.offer.step !== st.id) run.offer = { step: st.id, shown: false, aff: false, day: 0 };
      const o = run.offer, can = run.capital >= SN.Unlocks.offer(it).need;
      let why = null;
      if (!o.shown) why = 'new';
      else if (!o.aff && can) why = 'afford';
      else if (run.day > o.day && run.turn === 0) why = 'insist';
      if (!why) return null;
      o.shown = true;
      o.day = run.day;
      if (can) o.aff = true;
      SN.Events.emit('offer:prompt', { item: it, why, can });
      return why;
    },
  };
  void W;
})(window.SN);
