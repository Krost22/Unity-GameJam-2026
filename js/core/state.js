// Estado del juego: la partida en curso (run) y el perfil persistente (intro vista, tutorial, ajustes).
// Los sistemas leen y escriben aquí; el SaveManager lo serializa tal cual.
(function (SN) {
  'use strict';
  const D = SN.Data;

  SN.State = {
    run: null,
    rng: null,
    profile: {
      introSeen: false,
      tutorialDone: false,
      runs: 0,
      bestCapital: 0,
      settings: { music: true, sfx: true },
    },

    newRun() {
      const seed = (Math.random() * 2 ** 31) >>> 0;
      this.rng = new SN.RNG(seed);
      const run = {
        v: 2,
        seed,
        rngState: 0,
        capital: D.sim.startCapital,
        committed: 0,
        debt: { amount: D.sim.startDebt, paid: false, deadlineDay: D.sim.deadlineDays, defaulted: false },
        day: 1,
        turn: 0,
        totalTurns: 0,
        stats: { trades: 0, wins: 0, losses: 0, best: 0, worst: 0, earned: 0 },
        markets: {},
        upgrades: { suerte: 0, limite: 0, analisis: 0, resistencia: 0 },
        goalIndex: 0,
        flags: { debtPaid: false, payHintShown: false, endDemo: false },
        news: [],
        darkness: 0,
        darkUsed: {},
        owned: {},
        storySeen: {},
        selected: 'salud',
        form: { amount: 50, frac: 0.5, leverage: 2 },
        position: null,
        uid: 1,
      };
      this.run = run;
      for (const def of D.markets) run.markets[def.id] = SN.Market.create(def, this.rng);
      run.rngState = this.rng.s;
      return run;
    },

    // Restaura una partida guardada
    adopt(run) {
      this.run = run;
      this.rng = new SN.RNG(run.seed);
      this.rng.s = run.rngState;
    },

    // Antes de guardar: copia el estado del generador aleatorio dentro de la partida
    sync() {
      if (this.run && this.rng) this.run.rngState = this.rng.s;
    },

    nextUid() { return this.run.uid++; },
  };
})(window.SN);
