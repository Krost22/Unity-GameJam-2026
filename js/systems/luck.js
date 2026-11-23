// LuckManager: los DÍAS DE LA SUERTE (configuración en js/data/luck.js). Un día es de la suerte si su
// número lleva un 7; su intensidad es cuántos sietes tiene (1-3). Ese día los mercados abiertos crecen,
// las operaciones ganadoras dan un extra y pueden salir eventos especiales: Lluvia de Oro, Mercado Dorado,
// Estrella de la Suerte y Bendición de la Fortuna.
// El día se sortea al empezar con el generador de la partida (recargar no cambia nada) y se guarda en run.luck.
// No toca la interfaz: avisa con 'luck:day'.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;
  const cfg = () => D.luck;

  const L = SN.Luck = {
    sevens(day) { return (String(day).match(/7/g) || []).length; },
    intensity(day) { return Math.min(3, this.sevens(day)); },
    isLucky(day) { return this.sevens(day) > 0; },
    // El día de la suerte de hoy (o null)
    today() { const run = S.run; return run && run.luck && run.luck.day === run.day ? run.luck : null; },
    k() { const l = this.today(); return l ? l.k : 0; },
    has(ev) { const l = this.today(); return !!l && l.events.includes(ev); },

    // Sorteo del día: qué eventos especiales salen (según los sietes)
    roll(day) {
      const run = S.run, k = this.intensity(day), c = cfg();
      if (!k) { run.luck = null; return null; }
      const rng = S.rng;
      let events;
      if (k >= 3) events = [...c.big, ...c.light];
      else if (k === 2) events = [c.big[rng.int(0, c.big.length - 1)], ...shuffle(c.light, rng).slice(0, rng.int(1, 2))];
      else events = [c.light[rng.int(0, c.light.length - 1)]];
      const open = D.markets.filter((d) => run.markets[d.id] && run.markets[d.id].unlocked).map((d) => d.id);
      // Objetos dorados: todos con el MERCADO DORADO; si no, quizá alguno (más con la Bendición)
      let golden = [];
      if (events.includes('dorado')) golden = c.golden.map((g) => g.id);
      else {
        const p = c.goldenChance * k * (events.includes('bendicion') ? 2 : 1);
        if (rng.next() < p) golden = [c.golden[rng.int(0, c.golden.length - 1)].id];
      }
      run.luck = {
        day, k, events, golden,
        star: events.includes('estrella') && open.length ? open[rng.int(0, open.length - 1)] : null,
      };
      // Cada día de la suerte, la app Símbolos enseña una pista más del idioma secreto
      if (SN.Cipher) { const cs = SN.Cipher.state(); cs.hints = (cs.hints || 0) + 1; }
      SN.Events.emit('luck:day', run.luck);
      return run.luck;
    },

    // Tendencia extra (en unidades de fase: 1 = una fase alcista completa) para los mercados abiertos
    trend(marketId) {
      const l = this.today(), run = S.run;
      if (!l || !run.markets[marketId] || !run.markets[marketId].unlocked) return 0;
      let t = cfg().trend * l.k;
      if (l.events.includes('lluvia')) t += cfg().rainTrend;
      if (!run.flags.debtPaid) t *= cfg().firstDebtScale; // el día 7 es el plazo de la Pleyzeta
      return t;
    },
    // ESTRELLA DE LA SUERTE: las ganancias (y el tope) de ese mercado valen más hoy
    starMul(marketId) { const l = this.today(); return l && l.star === marketId ? cfg().starMul : 1; },
    // Bonificación por una operación ganadora
    bonus(pnl) { const l = this.today(); return l && pnl > 0 ? Math.round(pnl * cfg().bonus * l.k) : 0; },
    // BENDICIÓN: un nivel más de Suerte hoy
    luckBoost() { return this.has('bendicion') ? 1 : 0; },
    // Rebaja de Don Siete en el estilo de vida (día del MERCADO DORADO)
    discount() { return this.has('dorado') ? cfg().discount : 0; },
    goldenToday() { const l = this.today(); return l ? l.golden || [] : []; },
  };

  function shuffle(a, r) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = r.int(0, i); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  // Cada día nuevo se mira si lleva un 7
  SN.Events.on('day:changed', ({ day }) => L.roll(day));
})(window.SN);
