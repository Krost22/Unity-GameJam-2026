// DebtManager: importe de la deuda, plazo, pago anticipado y vencimiento.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  SN.Debt = {
    get amount() { return S.run.debt.amount; },
    get paid() { return S.run.debt.paid; },
    daysLeft() { return Math.max(0, S.run.debt.deadlineDay - S.run.day + 1); },
    canPay() { return !this.paid && !S.run.position && S.run.capital >= this.amount; },

    // Turnos que quedan para operar antes de que venza el plazo
    turnsLeft() {
      const run = S.run;
      return Math.max(0, (run.debt.deadlineDay - run.day) * D.sim.turnNames.length + D.sim.turnNames.length - run.turn);
    },

    // Ya no hay forma de llegar: ni multiplicando el capital al máximo en cada turno que queda se alcanza la deuda
    hopeless() {
      const run = S.run;
      if (this.paid || run.debt.defaulted || run.position) return false;
      return run.capital * Math.pow(D.sim.maxTurnGrowth, this.turnsLeft()) < this.amount;
    },

    pay(auto) {
      if (!this.canPay()) return false;
      SN.Economy.spend(this.amount, 'debt');
      S.run.debt.paid = true;
      S.run.flags.debtPaid = true;
      SN.Events.emit('debt:paid', { auto: !!auto, amount: this.amount });
      return true;
    },
  };

  // Al empezar un día después del plazo: si te alcanza se cobra sola; si no, embargo
  SN.Events.on('day:changed', ({ day }) => {
    const debt = S.run.debt;
    if (debt.paid || debt.defaulted || day <= debt.deadlineDay) return;
    if (S.run.capital >= debt.amount) SN.Debt.pay(true);
    else {
      debt.defaulted = true;
      SN.Events.emit('debt:defaulted', { amount: debt.amount, seized: S.run.capital });
    }
  });
})(window.SN);
