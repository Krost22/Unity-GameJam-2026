// UpgradeManager: estadísticas mejorables (Suerte, Límite de inversión, Análisis, Resistencia futura).
// Precios y efectos vienen de data/simulation.js.
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

    canBuy(id) {
      const n = this.next(id);
      if (!n || !this.isUnlocked(id) || S.run.position) return { ok: false };
      if (S.run.capital < n.cost) return { ok: false, reason: 'NO TE ALCANZA' };
      if (S.run.capital - n.cost < D.sim.bankruptcyThreshold) return { ok: false, reason: 'TE QUEDARÍAS SIN NADA' };
      return { ok: true, cost: n.cost };
    },

    buy(id) {
      const can = this.canBuy(id);
      if (!can.ok) return false;
      SN.Economy.spend(can.cost, 'upgrade');
      S.run.upgrades[id] = this.level(id) + 1;
      SN.Events.emit('upgrade:bought', { id, level: S.run.upgrades[id] });
      return true;
    },
  };
})(window.SN);
