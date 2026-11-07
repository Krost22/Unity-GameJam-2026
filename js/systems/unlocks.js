// MarketUnlockManager y objetivos económicos: qué mercados están abiertos, la meta actual
// (primero la deuda, después $1,000, $5,000...) y las recompensas al alcanzarla.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  SN.Unlocks = {
    isUnlocked(id) { return !!S.run.markets[id].unlocked; },

    unlock(id) {
      const m = S.run.markets[id];
      if (m.unlocked) return;
      m.unlocked = true;
      SN.Events.emit('market:unlocked', { market: id });
    },

    // Meta que se muestra en la interfaz
    currentGoal() {
      if (!S.run.debt.paid) return { type: 'debt', amount: S.run.debt.amount, title: 'PAGAR DEUDA' };
      const g = D.goals[S.run.goalIndex];
      return g ? Object.assign({ type: 'goal', title: `OBJETIVO ${SN.Util.short(g.amount)}` }, g) : null;
    },

    goalReached(id) {
      const i = D.goals.findIndex((g) => g.id === id);
      return S.run.debt.paid && i >= 0 && S.run.goalIndex > i;
    },

    // Comprueba si el capital alcanzó la meta (tras cada turno). Devuelve la meta alcanzada o null.
    check() {
      const run = S.run;
      if (!run.debt.paid || run.position) return null;
      const g = D.goals[run.goalIndex];
      if (!g || run.capital < g.amount) return null;
      run.goalIndex++;
      for (const id of g.markets) this.unlock(id);
      if (g.reward) SN.Economy.add(g.reward, 'reward');
      SN.Events.emit('goal:reached', { goal: g, next: D.goals[run.goalIndex] || null });
      return g;
    },
  };
})(window.SN);
