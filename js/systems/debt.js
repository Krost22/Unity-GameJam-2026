// DebtManager: la deuda activa (solo hay una a la vez), su plazo, el pago y el vencimiento.
// La primera es la Pleyzeta; después llegan los "regalos" del encapuchado y las ofertas de FUTURO.exe
// (ver js/data/progression.js). Todas funcionan igual: si vence el plazo y no te alcanza, embargo.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  SN.Debt = {
    get current() { return S.run.debt; },
    // ¿Hay una deuda sin pagar?
    active() { const d = S.run && S.run.debt; return !!d && !d.paid; },
    get amount() { return this.active() ? S.run.debt.amount : 0; },
    daysLeft() { return this.active() ? Math.max(0, S.run.debt.deadlineDay - S.run.day + 1) : 0; },
    canPay() { return this.active() && !S.run.position && S.run.capital >= S.run.debt.amount; },

    // Turnos que quedan para operar antes de que venza el plazo
    turnsLeft() {
      const run = S.run;
      if (!this.active()) return 0;
      return Math.max(0, (run.debt.deadlineDay - run.day) * D.sim.turnNames.length + D.sim.turnNames.length - run.turn);
    },

    // Ya no hay forma de llegar: ni multiplicando el capital al máximo en cada turno que queda se alcanza.
    // Cada mercado tiene un tope por apuesta: un turno no puede dar más que el mejor tope abierto.
    // extra: lo que se sumaría a la deuda (para no dejar comprar a crédito algo que ya no podrías pagar)
    hopeless(extra = 0) {
      const run = S.run, d = run.debt;
      if (!this.active() || d.defaulted || run.position) return false;
      const cap = SN.Trading.bestCap(), goal = d.amount + extra;
      let c = run.capital;
      for (let n = this.turnsLeft(); n > 0 && c < goal; n--) c += Math.min(c * (D.sim.maxTurnGrowth - 1), cap);
      return c < goal;
    },

    // Compra a crédito: suma a la deuda activa o, si no debes nada, abre una nueva (mismo plazo para todo)
    charge(amount, label) {
      const run = S.run;
      amount = Math.round(amount);
      if (this.active()) {
        run.debt.amount += amount;
        run.debt.extra = (run.debt.extra || 0) + amount;
        SN.Events.emit('debt:charged', { amount, debt: run.debt });
        return run.debt;
      }
      return this.open({ id: 'credito-' + run.day + '-' + run.turn, kind: 'credit', label, amount, days: D.credit.days });
    },

    // Abre una deuda nueva: { id, kind, label, amount, days }. "N días" cuenta el de hoy, como la Pleyzeta.
    open(o) {
      const run = S.run;
      if (run.debt) run.debts.push(run.debt);
      run.debt = {
        id: o.id, kind: o.kind, label: o.label, amount: Math.round(o.amount),
        start: run.day, deadlineDay: run.day + o.days - 1, paid: false, defaulted: false,
      };
      SN.Events.emit('debt:opened', { debt: run.debt });
      return run.debt;
    },

    pay(auto) {
      if (!this.canPay()) return false;
      const d = S.run.debt;
      SN.Economy.spend(d.amount, 'debt');
      d.paid = true;
      d.paidDay = S.run.day;
      if (d.id === 'pleyzeta') S.run.flags.debtPaid = true;
      // Bono por usar la app: nunca te quedas a cero al saldar una deuda
      d.bonus = D.payBonusFor(d.amount, SN.Unlocks.nextDebtAmount(), S.run.capital);
      SN.Economy.add(d.bonus, 'reward');
      SN.Events.emit('debt:paid', { auto: !!auto, amount: d.amount, debt: d, bonus: d.bonus });
      return true;
    },
  };

  // Al empezar un día después del plazo: si te alcanza se cobra sola; si no, embargo
  SN.Events.on('day:changed', ({ day }) => {
    const debt = S.run.debt;
    if (!debt || debt.paid || debt.defaulted || day <= debt.deadlineDay) return;
    if (S.run.capital >= debt.amount) SN.Debt.pay(true);
    else {
      debt.defaulted = true;
      SN.Events.emit('debt:defaulted', { amount: debt.amount, seized: S.run.capital, debt });
    }
  });
})(window.SN);
