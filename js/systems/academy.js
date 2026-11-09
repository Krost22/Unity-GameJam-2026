// AcademyManager: el árbol de habilidades de Bravo Fines (datos en js/data/academy.js). Se abre cuando Bravo
// se presenta (run.flags.academy). Lo comprado se guarda en run.academy. Efectos:
//   negocios  -> dinero cada mañana ('day:changed'), con su aviso ('academy:income')
//   tiburón   -> un extra en cada operación ganadora (SN.Trading.settle)
//   Plan B    -> la primera pérdida de cada día, a la mitad (SN.Trading.settle)
//   letra pequeña -> menos deuda en las ofertas de FUTURO.exe (SN.Unlocks.offer)
// No toca la interfaz.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;
  const A = () => D.academy;

  const Ac = SN.Academy = {
    open() { return !!(S.run && S.run.flags.academy); },
    nodes() { return A().branches.flatMap((b) => b.nodes.map((n) => Object.assign({ branch: b.id }, n))); },
    node(id) { return this.nodes().find((n) => n.id === id); },
    has(id) { return !!(S.run && S.run.academy && S.run.academy[id]); },
    owned() { return this.nodes().filter((n) => this.has(n.id)); },

    // ¿Se puede comprar? Abierta, que no sea "Próximamente", con el anterior de su rama y con dinero
    // (sin quedarte por debajo de la apuesta mínima)
    canBuy(id) {
      const run = S.run, n = this.node(id);
      if (!run || !n) return { ok: false };
      if (!this.open()) return { ok: false, reason: 'BRAVO TODAVÍA NO TE CONOCE', locked: true };
      if (this.has(id)) return { ok: false, reason: 'YA ES TUYO', owned: true };
      if (n.soon) return { ok: false, reason: 'PRÓXIMAMENTE', locked: true, soon: true };
      const br = A().branches.find((b) => b.id === n.branch), i = br.nodes.findIndex((x) => x.id === id);
      if (i > 0 && !this.has(br.nodes[i - 1].id)) return { ok: false, reason: `PRIMERO: ${br.nodes[i - 1].name.toUpperCase()}`, locked: true };
      if (run.position) return { ok: false, reason: 'HAY UNA OPERACIÓN EN CURSO' };
      if (run.capital - n.cost < D.sim.bankruptcyThreshold) return { ok: false, reason: run.capital < n.cost ? 'NO TE ALCANZA' : 'TE QUEDARÍAS SIN NADA' };
      return { ok: true, cost: n.cost };
    },
    // Lo que se puede comprar ahora mismo (para los números rojos)
    buyable() { return this.open() ? this.nodes().filter((n) => this.canBuy(n.id).ok) : []; },

    buy(id) {
      const can = this.canBuy(id);
      if (!can.ok) return false;
      const run = S.run;
      SN.Economy.spend(can.cost, 'academy');
      if (!run.academy) run.academy = {};
      run.academy[id] = true;
      SN.Events.emit('academy:bought', { node: this.node(id) });
      return true;
    },

    // ---------- Efectos ----------
    income() { return this.owned().reduce((s, n) => s + (n.income || 0), 0); },
    // Extra de la Mentalidad de tiburón en una operación ganadora
    bonus(pnl) { return pnl > 0 ? Math.round(pnl * this.owned().reduce((s, n) => s + (n.bonus || 0), 0)) : 0; },
    // Plan B: la primera pérdida del día, a la mitad (devuelve la pérdida que queda)
    halve(pnl) {
      const run = S.run;
      if (pnl >= 0 || !this.owned().some((n) => n.halve) || run.planBDay === run.day) return pnl;
      run.planBDay = run.day;
      return Math.round(pnl / 2);
    },
    offerMul() { return this.owned().reduce((k, n) => k * (n.offer || 1), 1); },
  };

  // Cada mañana, los negocios pagan
  SN.Events.on('day:changed', () => {
    const v = Ac.income();
    if (!v || !S.run) return;
    SN.Economy.add(v, 'academy');
    SN.Events.emit('academy:income', { amount: v, nodes: Ac.owned().filter((n) => n.income) });
  });
})(window.SN);
