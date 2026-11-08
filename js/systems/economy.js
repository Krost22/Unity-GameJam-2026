// EconomyManager: capital disponible, dinero comprometido en operaciones, ganancias, pérdidas y pagos.
(function (SN) {
  'use strict';
  const S = SN.State;

  function changed(from, reason, extra) {
    const to = S.run.capital;
    SN.Events.emit('capital:changed', Object.assign({ from, to, delta: to - from, reason }, extra || {}));
    if (to > S.profile.bestCapital) S.profile.bestCapital = to;
  }

  SN.Economy = {
    get capital() { return S.run ? S.run.capital : 0; },
    get committed() { return S.run ? S.run.committed : 0; },

    canAfford(cost) { return S.run.capital >= cost; },

    add(amount, reason) {
      const from = S.run.capital;
      S.run.capital = Math.max(0, round2(from + amount));
      changed(from, reason);
    },

    spend(cost, reason) {
      if (!this.canAfford(cost)) return false;
      const from = S.run.capital;
      S.run.capital = round2(from - cost);
      changed(from, reason);
      return true;
    },

    // Reserva dinero para una operación abierta (no cuenta como bancarrota)
    commit(amount) {
      const from = S.run.capital;
      S.run.capital = round2(from - amount);
      S.run.committed = round2(S.run.committed + amount);
      changed(from, 'commit');
    },

    // Devuelve lo comprometido más el resultado (nunca deja capital negativo)
    settle(amount, pnl) {
      const from = S.run.capital;
      S.run.committed = Math.max(0, round2(S.run.committed - amount));
      S.run.capital = Math.max(0, round2(from + amount + pnl));
      changed(from, 'trade', { pnl });
    },

    // Capital disponible y liquidable (lo que realmente tienes si no hay operaciones abiertas)
    liquid() { return S.run.capital + S.run.committed; },
  };

  function round2(v) { return Math.round(v); } // dinero siempre en dólares enteros
})(window.SN);
