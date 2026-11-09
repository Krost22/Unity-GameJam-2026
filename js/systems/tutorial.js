// TutorialManager: se aprende haciendo, con frases cortas. Obligatorio en la primera partida y
// repetible desde AJUSTES (al repetirlo, la partida se restaura tal y como estaba).
// 1. La PISTA de la gráfica.  2. SUBE.  3. COBRAR a tiempo.  4. Ver el susto de las últimas velas
// desde fuera.  5. Apuesta y multiplicador.  6. Las noticias (y una "errata" que "no es relevante").  7. La meta.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util;

  // Espera a que un evento cumpla una condición
  const until = (type, test = () => true) => new Promise((resolve) => {
    const off = SN.Events.on(type, (d) => { if (test(d)) { off(); resolve(d); } });
  });

  // Coloca el diálogo donde no tape el elemento resaltado
  function dialogPos(rect) {
    if (!rect) return { v: 'bottom', h: 'center' };
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const v = cy > 128 ? 'top' : 'bottom';
    const h = rect.w > 250 ? 'center' : cx < 150 ? 'right' : cx > 270 ? 'left' : 'center';
    return { v, h };
  }

  const T = SN.Tutorial = {
    VERSION: 3, // si cambia, los jugadores que hicieron el tutorial antiguo ven el nuevo (3: las noticias y la "errata")
    active: false,
    controlledTrade: false,

    async run({ replay = false } = {}) {
      const UI = SN.UI;
      const snapshot = replay ? U.copy(S.run) : null;
      if (replay) {
        // El repaso se juega en una partida de práctica idéntica a la primera ($100, día 1, solo Salud).
        // Mientras dura no se guarda nada: la partida real queda intacta en el guardado.
        this.replaying = true;
        S.newRun();
        SN.Chart.setMarket(S.run.selected);
        SN.Desk.dirty();
      }
      this.setup();
      this.active = true;
      SN.Game.setState('TUTORIAL');
      UI.allow = [];
      UI.renderAll();
      try {
        for (const step of D.story.tutorial) await this.step(step);
      } finally {
        SN.Dialog.hide();
        UI.clearSpot();
        UI.allow = null;
        this.active = false;
        this.controlledTrade = false;
        S.profile.tutorialDone = true;
        S.profile.tutorialV = this.VERSION;
        if (snapshot) {
          // Repaso terminado: todo vuelve a como estaba
          this.replaying = false;
          S.adopt(snapshot);
          SN.Chart.setMarket(S.run.selected);
          SN.Desk.dirty();
          await SN.Dialog.show(['Fin del repaso. Tu partida sigue exactamente como estaba.'], { pos: { v: 'bottom', h: 'center' } });
        }
        SN.Save.saveRun();
        SN.Game.setState('GAMEPLAY');
        UI.renderAll();
      }
    },

    // Mercado de la Salud preparado para la clase: subiendo, sin noticias y con una PISTA clarísima
    setup() {
      const run = S.run, m = run.markets.salud, tp = D.sim.tutorial;
      m.events = [];
      m.regime = tp.regime;
      m.phaseLeft = 14;
      m.hintNoise = 0;
      SN.Market.advance('salud', 10, { tutorial: true, quiet: true });
      run.form.frac = tp.frac;
      run.form.leverage = tp.leverage;
    },

    replay() {
      if (this.active || SN.UI.busy || S.run.position) return;
      this.run({ replay: true });
    },

    async step(st) {
      const UI = SN.UI;
      const run = S.run;
      if (st.wait === 'buy') {
        // Indicación que no bloquea: se queda a la vista mientras pulsas SUBE (o la flecha ↑)
        Object.assign(run.form, { frac: D.sim.tutorial.frac, leverage: D.sim.tutorial.leverage });
        this.controlledTrade = true;
        UI.allow = ['buy'];
        UI.renderForm();
        const rect = UI.spot(st.target);
        SN.Dialog.show(st.lines, { pos: dialogPos(rect), sticky: true });
        await until('trade:opened');
        SN.Dialog.hide();
        UI.allow = [];
        UI.clearSpot();
        return;
      }
      if (st.wait === 'cashout') {
        // La gráfica se detiene con la operación en verde: hay que COBRAR (clic o ESPACIO)
        if (!(SN.Chart.anim && SN.Chart.anim.held)) await until('chart:held');
        UI.allow = ['cashout'];
        const rect = UI.spot(st.target);
        SN.Dialog.show(st.lines, { pos: dialogPos(rect), sticky: true });
        await until('trade:cashed');
        SN.Dialog.hide();
        UI.allow = [];
        UI.clearSpot();
        return;
      }
      if (st.wait === 'trade') {
        await until('turn:ready');
        this.controlledTrade = false;
        return;
      }
      if (st.news) {
        // El periódico, con una noticia normal y otra que nadie sabe leer: la "errata" (el idioma secreto)
        SN.Narrative.addNews({ title: 'Vacuna en fase final', text: 'Las autoridades deciden si aprueban la nueva vacuna.', tone: 'pos', market: 'salud', art: 'vacuna' });
        SN.Narrative.cipherNews('tuto');
        SN.Windows.open('news');
        await SN.wait(0.35);
        const spots = st.spots || [];
        await SN.Dialog.show(st.lines, { pos: { v: 'bottom', h: 'center' }, onLine: (i) => { if (spots[i]) UI.spot(spots[i]); } });
        UI.clearSpot();
        SN.Windows.close();
        return;
      }
      const rect = st.target ? UI.spot(st.target) : null;
      if (st.lines.length) await SN.Dialog.show(st.lines, { pos: dialogPos(rect) });
      UI.clearSpot();
    },
  };
})(window.SN);
