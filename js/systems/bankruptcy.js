// BankruptcyManager: qué pasa al perder. Se pierde sin dinero ni para la apuesta mínima (nunca por tener
// dinero comprometido en una operación), cuando vence el plazo sin pagar, o cuando ya es imposible pagar a tiempo.
// 1) VIDA EXTRA: el rescate bancario (js/render/bailout.js). Llamas a la Línea de Rescate Financiero, te haces
//    pasar por un banco "demasiado grande para caer" y Donald Trompa te transfiere el dinero de los
//    contribuyentes. La partida sigue (si el problema era el plazo: nadie embarga a un banco sistémico, 2 días
//    más). Uno por meta.
// 2) SIN RESCATE: pierdes de verdad y vuelves al inicio de la meta en la que ibas, con los fondos que
//    tenías al empezarla (punto de control de SN.State). Nunca se pierde toda la partida.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const B = SN.Bankruptcy = {
    active: false,
    ui: null,
    coins: 0,

    shouldTrigger() {
      const run = S.run;
      return !!run && !run.position && run.capital + run.committed + SN.Debt.pendingBonus() < D.sim.bankruptcyThreshold;
    },

    // Sin fondos para seguir apostando: aviso corto y directo a la vida extra
    async broke() {
      SN.Game.setState('BANKRUPTCY');
      SN.Game.resetTime();
      const [a, b] = D.story.broke;
      if (SN.Music) SN.Music.tapeStop(); // sin dinero: la cinta se para
      SN.Audio.sfx('notifyBad');
      SN.FX.shake(3, 0.4);
      await SN.UI.stamp(a, 'coral', b, 1.8);
      return this.lose('broke');
    },

    // Plazo vencido (o imposible de cumplir) sin dinero suficiente: el cobrador se lo lleva todo
    async embargo({ early = false } = {}) {
      SN.Game.setState('BANKRUPTCY');
      SN.Game.resetTime();
      if (SN.Music) SN.Music.tapeStop();
      SN.Audio.setMood('tense');
      SN.Desk.led = 'alert';
      const [a, b0, c] = early ? D.story.embargoEarly : D.story.embargo;
      const b = b0.replace('{amount}', U.money(S.run.debt ? S.run.debt.amount : D.sim.startDebt));
      SN.Audio.sfx('notifyBad');
      SN.FX.shake(4, 0.6);
      const last = S.run.rescue === 'ready' ? D.story.rescue.embargo : `${c}: ${U.money(S.run.capital)}`;
      await SN.UI.card(`<div class="overlay-panel"><div class="t1">${a}</div><div class="t2">${b}</div><div class="t2">${last}</div></div>`, 'daycard embargo', 2.6);
      await SN.wait(0.4);
      return this.lose(early ? 'hopeless' : 'deadline');
    },

    async lose(reason) {
      this.reason = reason;
      SN.Game.setState('BANKRUPTCY');
      SN.Windows.close(true);
      SN.Dialog.hide();
      SN.UI.clearSpot();
      SN.Hands.drumming = false;
      if (S.run.rescue === 'ready') return this.extraLife();
      return this.finalLoss();
    },

    // Vida extra: la llamada a la Línea de Rescate y la videollamada con el Presidente
    async extraLife() {
      const st = D.story.rescue.card;
      SN.Audio.setMood('tense');
      await SN.UI.card(`<div class="overlay-panel"><div class="t1">${st.title}</div><div class="t2">${st.lines[0]}</div><div class="t3">${st.lines[1]}</div></div>`, 'daycard', 3.2);
      this.coins = S.rescueAmount();
      this.active = true;
      const done = await SN.Bailout.play({ coins: this.coins });
      if (!done) return; // se salió al menú en mitad de la llamada
      return this.showRescue();
    },

    // De vuelta en FUTURO.exe: el justificante de la transferencia y el mensaje
    showRescue() {
      const R = D.story.rescue, rc = R.receipt, st = R.done;
      const late = this.reason === 'deadline' || this.reason === 'hopeless';
      SN.Audio.setMood('normal');
      SN.Audio.sfx('notify');
      SN.Audio.sfx('cash');
      const el = U.el('div', 'overlay-panel rescue-ui');
      el.innerHTML = `<div class="rc-receipt">
          <div class="rc-h"><span class="rc-seal"></span>${esc(rc.title)}</div>
          <div class="rc-row"><span>De</span><b>${esc(rc.from)}</b></div>
          <div class="rc-row"><span>Para</span><b>${esc(rc.to)}</b></div>
          <div class="rc-row"><span>Concepto</span><b>${esc(rc.concept)}</b></div>
          <div class="rc-amt">+${U.money(this.coins)}</div>
        </div>
        <div class="t1">${esc(st.title)}</div><div class="t2">${esc(st.message)}</div>
        <div class="t3">${esc(late ? st.extension : st.extra)}</div>
        <div class="row"><button class="btn btn-yellow" id="bk-continue">Seguir jugando</button></div>`;
      // El escudo del justificante: la moneda con el ojo
      const seal = U.el('canvas');
      seal.width = 9; seal.height = 9;
      const g = seal.getContext('2d');
      SN.Px.ellipse(g, 4, 4, 4, 4, SN.PAL.yellowD); SN.Px.ellipse(g, 4, 4, 3, 3, SN.PAL.yellow);
      SN.Px.rect(g, 2, 4, 5, 1, SN.PAL.coalD); SN.Px.rect(g, 4, 4, 1, 1, SN.PAL.coalDD);
      seal.style.width = '9px'; seal.style.height = '9px';
      el.querySelector('.rc-seal').replaceWith(seal);
      SN.KW.apply(el);
      document.getElementById('layer-top').appendChild(el);
      this.ui = el;
      el.querySelector('#bk-continue').addEventListener('click', () => this.finish('continue'));
      return new Promise((resolve) => { this.resolve = resolve; });
    },

    // Sin rescate: vuelves al inicio de la meta con lo que tenías entonces
    async finalLoss() {
      const run = S.run, cp = run.checkpoint, st = D.story.finalLoss;
      SN.Audio.setMood('silent');
      SN.Audio.sfx('liquidation');
      SN.Audio.sfx('broke', { at: 0.7 }); // y una caja de música rota
      SN.Desk.led = 'alert';
      S.profile.runs++;
      S.restoreCheckpoint();
      SN.Save.saveRun();
      SN.Save.saveProfile();
      const where = cp ? cp.label : 'la deuda de la Pleyzeta';
      const money = U.money(cp ? cp.capital : D.sim.startCapital);
      const el = U.el('div', 'overlay-panel final-loss');
      el.innerHTML = `<div class="t1">${st.title}</div><div class="t2">${st.message}</div>
        <div class="t3">${st.back.replace('{where}', where).replace('{money}', money)}</div>
        <div class="row"><button class="btn btn-yellow" id="bk-retry">Volver a intentarlo</button><button class="btn btn-cream" id="bk-menu">Volver al menú</button></div>`;
      SN.KW.apply(el);
      document.getElementById('layer-top').appendChild(el);
      this.ui = el;
      this.active = true;
      return new Promise((resolve) => {
        this.resolve = resolve;
        el.querySelector('#bk-retry').addEventListener('click', () => this.finish('retry'));
        el.querySelector('#bk-menu').addEventListener('click', () => this.finish('menu'));
      });
    },

    // Limpia la secuencia (también se usa al salir al menú)
    reset() {
      if (SN.Bailout) SN.Bailout.abort();
      if (this.ui) this.ui.remove();
      this.ui = null;
      this.active = false;
      SN.Desk.led = 'idle';
    },

    finish(choice) {
      SN.Audio.sfx('click');
      const coins = this.coins;
      this.reset();
      const r = this.resolve;
      this.resolve = null;
      if (choice === 'continue') this.resume(coins);
      else if (choice === 'retry') SN.Game.startRun({ loaded: true, greeting: 'rewind' });
      else SN.Game.toMenu();
      if (r) r(choice);
    },

    // Tras el rescate: el dinero entra y la partida sigue donde estaba
    resume(coins) {
      const run = S.run, R = D.story.rescue;
      run.rescue = 'used';
      run.rescues = (run.rescues || 0) + 1;
      if (this.reason === 'deadline' || this.reason === 'hopeless') {
        run.debt.deadlineDay = Math.max(run.debt.deadlineDay, run.day) + 2;
        run.debt.defaulted = false;
      }
      SN.Game.setState('GAMEPLAY');
      SN.Audio.setMood('normal');
      SN.Economy.add(coins, 'rescue');
      // El dinero llega a la cuenta: monedas sobre el capital
      const cap = SN.UI.posIn(document.getElementById('hud-capital'));
      SN.FX.coins(cap.x + 60, cap.y + 14, 14, 1.4);
      SN.FX.float(`+${U.money(coins)}`, cap.x + cap.w / 2, cap.y + cap.h + 6, 'gain');
      SN.Audio.sfx('coin');
      SN.Narrative.addNews(Object.assign({}, R.news));
      SN.UI.busy = false;
      SN.UI.allow = null;
      SN.UI.renderAll();
      SN.Events.emit('rescue:done', { coins });
      SN.Save.saveRun();
      SN.after(1, () => SN.Desktop.check());
    },
  };
  void B;
})(window.SN);
