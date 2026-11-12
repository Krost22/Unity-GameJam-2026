// Estado del juego: la partida en curso (run) y el perfil persistente (intro vista, tutorial, ajustes).
// Los sistemas leen y escriben aquí; el SaveManager lo serializa tal cual.
(function (SN) {
  'use strict';
  const D = SN.Data, U = SN.Util;

  SN.State = {
    run: null,
    rng: null,
    profile: {
      introSeen: false,
      tutorialDone: false,
      runs: 0,
      bestCapital: 0,
      settings: { music: true, sfx: true },
      endings: {},   // finales vistos (A: el avatar perfecto, B: NULL.EXE)
      pala: false,   // LA PALA: se gana con el final B y se queda en el cuarto para siempre
    },

    newRun() {
      const seed = (Math.random() * 2 ** 31) >>> 0;
      this.rng = new SN.RNG(seed);
      const run = {
        v: 4,
        seed,
        rngState: 0,
        capital: D.sim.startCapital,
        committed: 0,
        // Deuda activa (solo hay una a la vez). Las pagadas pasan a `debts`.
        debt: { id: 'pleyzeta', kind: 'debt', label: 'la Pleyzeta', amount: D.sim.startDebt, start: 1, deadlineDay: D.sim.deadlineDays, paid: false, defaulted: false },
        debts: [],
        day: 1,
        turn: 0,
        totalTurns: 0,
        stats: { trades: 0, wins: 0, losses: 0, best: 0, worst: 0, earned: 0 },
        markets: {},
        upgrades: { multiplicador: 0, suerte: 0, limite: 0, analisis: 0, resistencia: 0 },
        gifts: {},       // mejoras que ya llegaron como "regalo" (se pueden comprar)
        step: 0,         // paso actual de la escalera de progresión (js/data/progression.js)
        stepOpen: true,  // el paso actual ya abrió su deuda (la Pleyzeta, desde el principio)
        flags: { debtPaid: false, payHintShown: false, endDemo: false },
        news: [],
        darkness: 0,
        darkUsed: {},
        owned: {},
        academy: {},     // nodos comprados en la Academia de Bravo Fines
        seen: {},        // lo que ya se vio en Mejoras y Tienda (para los números rojos)
        offer: null,     // cuándo se enseñó la oferta pendiente de FUTURO.exe ({ step, shown, aff, day })
        storySeen: {},
        cipher: { known: {}, found: {} }, // letras del idioma secreto encontradas en esta partida
        selected: 'salud',
        form: { amount: 50, frac: 0.5, leverage: 1 },
        position: null,
        uid: 1,
      };
      this.run = run;
      delete this.profile.cipher; // (antes las letras iban en el perfil y pasaban de una partida a otra)
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

    // Punto de control: al empezar cada paso de la escalera (la deuda, cada regalo, cada compra, cada meta)
    // se guarda la partida tal cual. Si pierdes del todo, vuelves aquí con los fondos que tenías entonces.
    // El rescate vuelve a estar disponible. Los chats y las letras del idioma secreto no se rebobinan.
    checkpoint(label) {
      const run = this.run;
      // Nunca se guarda un punto de control sin dinero para apostar (volver ahí sería perder otra vez):
      // si acabas de pagar y te has quedado sin nada, sigue valiendo el anterior.
      if (run.checkpoint && run.capital + run.committed < D.sim.bankruptcyThreshold) return false;
      this.sync();
      const copy = Object.assign({}, run, { checkpoint: null, chat: null, chatSer: null, chatBravo: null, cipher: null });
      run.checkpoint = { label, capital: run.capital, data: JSON.stringify(copy) };
      run.rescue = 'ready';
    },
    restoreCheckpoint() {
      const old = this.run, cp = old.checkpoint;
      if (!cp) return false;
      const run = JSON.parse(cp.data);
      run.checkpoint = cp;
      run.chat = old.chat;
      run.chatSer = old.chatSer;
      run.chatBravo = old.chatBravo;
      run.cipher = old.cipher;
      run.rescue = 'ready';
      run.retries = (old.retries || 0) + 1;
      run.chatFlags = Object.assign({}, run.chatFlags || {}, old.chatFlags || {});
      run.over = false;
      this.adopt(run);
      return true;
    },
    // Lo que da el rescate: para la Pleyzeta, $60; después, una parte de lo que tenías al empezar el paso
    rescueAmount() {
      const cp = this.run.checkpoint;
      const base = cp ? cp.capital : 100;
      return this.run.flags.debtPaid ? U.clamp(Math.round(base * 0.2), 60, 5000) : 60;
    },
  };
})(window.SN);
