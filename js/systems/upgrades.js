// UpgradeManager: estadísticas mejorables (Suerte, Límite de inversión, Análisis, Resistencia futura).
// Precios y efectos vienen de data/simulation.js. Se compran A CRÉDITO: cada mejora es también una deuda
// (precio + intereses de D.credit, que se suman a la deuda activa).
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  SN.Upgrades = {
    def(id) { return D.upgrades.find((u) => u.id === id); },
    level(id) { return (S.run && S.run.upgrades[id]) || 0; },

    // Valor actual del efecto (0 / base si no se ha comprado)
    value(id) {
      const d = this.def(id), lv = this.level(id);
      if (!lv) return d.base || 0;
      return d.levels[lv - 1].value;
    },
    next(id) { const d = this.def(id); return d.levels[this.level(id)] || null; },

    isUnlocked(id) {
      const u = this.def(id).unlock;
      if (u.type === 'start') return true;
      if (u.type === 'gift') return !!(S.run.gifts && S.run.gifts[id]); // llegó como "regalo" del encapuchado
      if (u.type === 'flag') return !!S.run.flags[u.flag];
      if (u.type === 'goal') return SN.Unlocks.goalReached(u.goal);
      return false; // 'future': preparado para próximas versiones
    },

    // A crédito: hoy no pagas nada. Lo que se suma a la deuda (precio + intereses)
    creditCost(id) { const n = this.next(id); return n ? Math.round(n.cost * (1 + D.credit.interest)) : 0; },

    // Se puede comprar si está desbloqueada, no hay una operación en curso y, con lo que se suma a la deuda,
    // todavía se podría pagar a tiempo (si no, sería perder seguro)
    canBuy(id) {
      const n = this.next(id);
      if (!n || !this.isUnlocked(id) || S.run.position) return { ok: false };
      const debt = this.creditCost(id);
      if (SN.Debt.active() && SN.Debt.hopeless(debt)) return { ok: false, reason: 'YA NO PODRÍAS PAGAR A TIEMPO', debt };
      return { ok: true, cost: n.cost, debt };
    },

    buy(id) {
      const can = this.canBuy(id);
      if (!can.ok) return false;
      SN.Debt.charge(can.debt, `la mejora (${this.def(id).name})`);
      S.run.upgrades[id] = this.level(id) + 1;
      SN.Events.emit('upgrade:bought', { id, level: S.run.upgrades[id], debt: can.debt });
      return true;
    },
  };
})(window.SN);
