// LuckManager: los DÍAS DE LA SUERTE (configuración en js/data/luck.js). Un día es de la suerte si su
// número lleva un 7; su intensidad es cuántos sietes tiene (1-3). Ese día los mercados abiertos crecen,
// las operaciones ganadoras dan un extra y pueden salir eventos especiales: Lluvia de Oro, Mercado Dorado,
// Ruleta de la Fortuna, Estrella de la Suerte y Bendición de la Fortuna.
// El día se sortea al empezar con el generador de la partida (recargar no cambia nada) y se guarda en run.luck.
// No toca la interfaz: avisa con 'luck:day' y 'luck:spin'.
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
        spun: false,
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

    // ---------- Ruleta de la Fortuna ----------
    canSpin() { const l = this.today(); return !!l && l.events.includes('ruleta') && !l.spun && !S.run.position; },
    // Elige casilla (las raras salen el doble con la Bendición) y gasta el giro del día. El premio, con apply()
    // (la interfaz primero hace girar la ruleta y luego lo entrega).
    pick() {
      if (!this.canSpin()) return null;
      const l = this.today(), rng = S.rng;
      const wheel = cfg().wheel, rare = this.has('bendicion') ? 2 : 1;
      const weights = wheel.map((w) => w.weight * (w.rare ? rare : 1));
      let r = rng.next() * weights.reduce((a, b) => a + b, 0), i = 0;
      while (r >= weights[i] && i < wheel.length - 1) { r -= weights[i]; i++; }
      l.spun = true;
      return { index: i, id: wheel[i].id, label: wheel[i].label };
    },
    spin() {
      const p = this.pick();
      if (!p) return null;
      const out = Object.assign(p, this.apply(p.id, this.k()));
      SN.Events.emit('luck:spin', out);
      return out;
    },
    apply(id, k) {
      const run = S.run, debt = SN.Debt.active() ? run.debt : null;
      const money = (v) => { v = Math.round(v); SN.Economy.add(v, 'luck'); return { money: v, text: `+${SN.Util.money(v)}` }; };
      if (id === 'poco') return money(Math.max(20, run.capital * 0.05 * k));
      if (id === 'mucho') return money(Math.max(100, run.capital * 0.2 * k));
      if (id === 'siete') return money(777 * k);
      if (id === 'plazo') {
        if (!debt) return money(Math.max(20, run.capital * 0.05 * k));
        debt.deadlineDay++;
        return { text: `+1 día para pagar ${debt.label}` };
      }
      if (id === 'seguro') { run.shield = true; return { text: 'Tu próxima pérdida será $0' }; }
      if (id === 'maldita') {
        if (!debt) return { text: 'Nada... esta vez' };
        debt.amount = Math.round(debt.amount * 1.07);
        return { text: `Tu deuda sube a ${SN.Util.money(debt.amount)}` };
      }
      if (id === 'simbolo') {
        const clue = SN.Cipher && SN.Cipher.wildcard(rng());
        if (clue) return { text: `Un símbolo: ${D.cipher.alphabet[clue.letter]} = ${clue.letter}`, clue };
        return money(777 * k);
      }
      return { text: 'La casa siempre gana.' };
    },
  };
  const rng = () => S.rng;

  function shuffle(a, r) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = r.int(0, i); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  // Cada día nuevo se mira si lleva un 7
  SN.Events.on('day:changed', ({ day }) => L.roll(day));
})(window.SN);
