// MarketUnlockManager y escalera de progresión: qué mercados están abiertos y en qué paso vas
// (la Pleyzeta, cada "regalo" del encapuchado, cada objeto clave de la tienda y la meta final).
// La escalera es una CADENA DE DEUDAS: solo el paso actual cuenta; mientras haya una deuda sin pagar
// nada avanza y, al pagarla, llega la siguiente.
// Este archivo no toca la interfaz: devuelve lo que ha pasado y la narrativa lo cuenta (game.js).
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data, U = SN.Util;

  SN.Unlocks = {
    isUnlocked(id) { return !!S.run.markets[id] && !!S.run.markets[id].unlocked; },

    unlock(id) {
      const m = S.run.markets[id];
      if (!m || m.unlocked) return;
      m.unlocked = true;
      SN.Events.emit('market:unlocked', { market: id });
    },

    // ---------- La escalera ----------
    step() { return D.chain[S.run.step] || null; },
    index(id) { return D.chain.findIndex((s) => s.id === id); },
    // ¿Ya se completó ese paso?
    done(id) { const i = this.index(id); return i >= 0 && i < S.run.step; },
    // Compatibilidad: ¿se alcanzó esa meta?
    goalReached(id) { return this.done(id); },
    // ¿Hay algún mercado negro abierto? (para enseñar la pestaña Negro)
    anyBlack() { return D.markets.some((d) => d.black && this.isUnlocked(d.id)); },

    // Lo que se muestra en el HUD: la deuda activa o, si no hay, lo que pide el paso actual
    currentGoal() {
      const run = S.run, d = run.debt;
      if (d && !d.paid) return { type: 'debt', amount: d.amount, title: 'PAGAR DEUDA', label: d.label, debt: d };
      const st = this.step();
      if (!st) return null;
      if (st.kind === 'item') {
        // La oferta de FUTURO.exe está esperando: la barra mide lo que hace falta en la cuenta para aceptarla
        const it = D.keyItemById(st.item), o = this.offer(it);
        return { type: 'item', amount: o.need, title: `OFERTA: ${it.name}`, label: it.short, item: it, offer: o };
      }
      if (st.kind === 'goal') return Object.assign({ type: 'goal', title: `OBJETIVO ${U.short(st.amount)}` }, st);
      return null;
    },

    // Avanza la escalera todo lo que se pueda. Devuelve lo que acaba de pasar o null si toca esperar:
    //   { type: 'done', step }  -> se completó un paso (su deuda está pagada)
    //   { type: 'gift', step }  -> el encapuchado trae un regalo (mejora + deuda nueva)
    //   { type: 'goal', step }  -> meta alcanzada (solo la final)
    // Los objetos clave no avanzan solos: se aceptan con la oferta de FUTURO.exe (acceptOffer).
    check() {
      const run = S.run;
      if (!run || run.position || run.over) return null;
      const st = this.step();
      if (!st) return null;
      if (run.debt && !run.debt.paid) return null; // primero paga lo que debes
      if (run.stepOpen) return this.complete(st);
      if (st.kind === 'gift') return this.giveGift(st);
      if (st.kind === 'goal' && run.capital >= st.amount) return this.reachGoal(st);
      return null;
    },

    complete(st) {
      const run = S.run;
      run.step++;
      run.stepOpen = false;
      SN.Events.emit('step:done', { step: st, next: this.step() });
      return { type: 'done', step: st, next: this.step() };
    },

    // Regalo: la mejora se puede comprar a partir de ahora, se abren sus mercados... y te deja una deuda
    giveGift(st) {
      const run = S.run, up = SN.Upgrades.def(st.upgrade);
      run.gifts[st.upgrade] = true;
      for (const id of st.markets || []) this.unlock(id);
      SN.Debt.open({ id: st.id, kind: 'gift', label: `el regalo (${up.name})`, amount: st.debt, days: st.days });
      run.stepOpen = true;
      SN.Events.emit('gift:given', { step: st, upgrade: st.upgrade });
      return { type: 'gift', step: st };
    },

    reachGoal(st) {
      const run = S.run;
      for (const id of st.markets) this.unlock(id);
      if (st.reward) SN.Economy.add(st.reward, 'reward');
      run.step++;
      run.stepOpen = false;
      SN.Events.emit('goal:reached', { goal: st, next: this.step() });
      return { type: 'goal', step: st, next: this.step() };
    },

    // ---------- Objetos clave (tienda) ----------
    // La oferta de FUTURO.exe: un 10% hoy y el resto, con intereses, en unos días
    // (la Academia de Bravo Fines enseña a leer la letra pequeña: menos deuda)
    offer(item) {
      const it = typeof item === 'string' ? D.keyItemById(item) : item;
      const k = SN.Academy ? SN.Academy.offerMul() : 1;
      const now = Math.round(it.price * D.offer.upfront), debt = Math.round(it.price * D.offer.debt * k);
      // need: lo que tiene que haber en tu cuenta para que FUTURO.exe te lo financie (la entrada o, si es
      // más, el 25% de lo que vas a deber)
      return { item: it, now, debt, days: it.days, need: Math.max(now, Math.round(debt * (D.offer.solvency || 0))) };
    },
    // El objeto clave que está esperando su oferta (o null): el paso actual, sin deudas pendientes
    pendingItem() {
      const run = S.run, st = this.step();
      if (!run || !st || st.kind !== 'item' || run.owned[st.item] || (run.debt && !run.debt.paid)) return null;
      return D.keyItemById(st.item);
    },

    // ¿Se puede comprar ya? Solo el del paso actual, sin deudas pendientes y con dinero para la ENTRADA
    canBuyItem(id) {
      const run = S.run, st = this.step(), it = D.keyItemById(id);
      if (!it) return { ok: false };
      if (run.owned[id]) return { ok: false, reason: 'YA ES TUYO', owned: true };
      if (!st || st.kind !== 'item' || st.item !== id) {
        const i = D.keyItems.indexOf(it);
        const prev = i > 0 && !run.owned[D.keyItems[i - 1].id] ? D.keyItems[i - 1] : null;
        let reason = 'TODAVÍA NO';
        if (prev) reason = `PRIMERO: ${prev.short.toUpperCase()}`;
        else if (run.debt && !run.debt.paid) reason = 'PRIMERO PAGA LO QUE DEBES';
        else if (st && st.kind === 'goal') reason = `PRIMERO: LA META DE ${U.short(st.amount)}`;
        return { ok: false, reason, locked: true };
      }
      if (run.position) return { ok: false, reason: 'HAY UNA OPERACIÓN EN CURSO' };
      if (run.debt && !run.debt.paid) return { ok: false, reason: 'PRIMERO PAGA LO QUE DEBES' };
      const need = this.offer(it).need;
      if (run.capital < need) return { ok: false, reason: `TE FALTAN ${U.money(need - run.capital)}`, short: need - run.capital };
      return { ok: true };
    },

    // Aceptar la oferta: pagas la entrada, el objeto es tuyo, debes el resto y se abre su mercado negro
    acceptOffer(id) {
      if (!this.canBuyItem(id).ok) return null;
      const run = S.run, st = this.step(), o = this.offer(id), it = o.item;
      SN.Economy.spend(o.now, 'shop');
      run.owned[id] = true;
      SN.Debt.open({ id: st.id, kind: 'item', label: it.short, amount: o.debt, days: o.days });
      run.stepOpen = true;
      this.unlock(it.market);
      SN.Events.emit('item:bought', { item: it, offer: o, step: st });
      return { type: 'item', step: st, item: it, offer: o };
    },
  };
})(window.SN);
