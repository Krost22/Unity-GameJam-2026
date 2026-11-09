// TradingManager: SUBE (compra, apuesta a que el precio sube) y BAJA (venta en corto, apuesta a que baja).
//   marketChange = (exit - entry) / entry
//   tradeReturn  = marketChange * direction * leverage   (direction: 1 sube, -1 baja)
//   profitLoss   = investment * tradeReturn, nunca menor que -investment (pérdida máxima = lo comprometido)
//                  y siempre dentro del TOPE del mercado: entre -cap y +cap (el primero da poco, el último mucho)
// Las velas de la operación se simulan al abrirla y la interfaz las va mostrando. El jugador puede CERRAR
// en cualquier momento: cobra al precio que ve, y el mercado sigue su curso sin él.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  const round2 = (v) => Math.round(v); // dólares enteros

  SN.Trading = {
    get position() { return S.run.position; },

    limit() { return SN.Upgrades.value('limite') || D.sim.baseInvestLimit; },

    // Tope por apuesta de un mercado (lo máximo que se gana o se pierde en una operación)
    cap(id) { const d = SN.Market.def(id); return (d && d.cap) || Infinity; },
    // El mejor tope entre los mercados abiertos (para saber si todavía se llega a pagar)
    bestCap() {
      let best = 0;
      for (const d of D.markets) if (S.run.markets[d.id] && S.run.markets[d.id].unlocked) best = Math.max(best, this.cap(d.id));
      return best || Infinity;
    },
    // Resultado dentro de los límites: nunca más pérdida que lo apostado, y siempre dentro del tope.
    // La ESTRELLA DE LA SUERTE multiplica las ganancias (y el tope) de su mercado ese día.
    clampPnl(p, v) {
      const cap = p.cap || Infinity;
      if (v > 0 && p.star > 1) v *= p.star;
      return Math.max(-Math.min(p.amount, cap), Math.min(cap, v));
    },
    maxAmount() { return Math.max(0, Math.floor(Math.min(S.run.capital, this.limit()))); },

    leverageAvailable(v) {
      const l = D.sim.leverages.find((x) => x.value === v);
      return !!l && (!l.unlock || !!S.run.flags[l.unlock]);
    },

    // Ajusta la cantidad del formulario a los límites (capital y límite de inversión)
    clampForm() {
      const f = S.run.form;
      const max = this.maxAmount();
      f.amount = round2(Math.max(Math.min(D.sim.minInvestment, max), Math.min(f.amount, max)));
      if (!this.leverageAvailable(f.leverage)) f.leverage = 1;
    },

    validate() {
      const f = S.run.form;
      if (S.run.position) return { ok: false, reason: 'YA TIENES UNA OPERACIÓN ABIERTA' };
      if (!SN.Unlocks.isUnlocked(S.run.selected)) return { ok: false, reason: 'MERCADO BLOQUEADO' };
      if (f.amount < D.sim.minInvestment) return { ok: false, reason: `MÍNIMO ${SN.Util.money(D.sim.minInvestment)}` };
      if (f.amount > S.run.capital + 1e-9) return { ok: false, reason: 'NO TIENES TANTO DINERO' };
      if (f.amount > this.limit() + 1e-9) return { ok: false, reason: `LÍMITE: ${SN.Util.money(this.limit())}` };
      return { ok: true };
    },

    // Índice de la vela con giro inesperado de esta operación (o -1): solo en la zona de peligro
    planTwist(def, n, tutorial) {
      if (tutorial) return D.sim.tutorial.twistAt;
      // RESISTENCIA: menos giros en "las cosas que todavía no han pasado"
      const chance = def.twist.chance * Math.max(0, 1 - SN.Upgrades.level('resistencia') * D.sim.resistPerLevel);
      if (S.rng.next() >= chance) return -1;
      return n - 1 - S.rng.int(0, D.sim.dangerCandles - 1);
    },

    // Tamaño y sentido del giro. Si vas perdiendo es algo más fácil que te salve;
    // en conjunto es un riesgo casi neutro: ni regala ni roba, añade tensión.
    twistJump(def, m, entry, direction, tutorial) {
      if (tutorial) return D.sim.tutorial.twistJump;
      const losing = (m.price - entry) * direction < 0;
      const good = S.rng.next() < (losing ? D.sim.twistRescue : 0.5);
      return (good ? direction : -direction) * S.rng.range(def.twist.min, def.twist.max);
    },

    // La vela de la zona de peligro que merece cámara lenta (la más brusca), o -1 si ninguna destaca
    findClimax(candles, def, liquidated) {
      if (liquidated) return candles.length - 1;
      // Una vela de giro cuenta aunque el ruido la haya suavizado; las demás tienen que ser muy bruscas
      let best = -1, size = 0;
      const from = Math.max(0, candles.length - D.sim.dangerCandles);
      for (let i = from; i < candles.length; i++) {
        const c = candles[i], r = Math.abs(c.c - c.o) / c.o;
        const need = def.volatility * (c.tw ? 1.5 : D.sim.climaxSigma);
        if (r >= need && r > size) { size = r; best = i; }
      }
      return best;
    },

    open(direction, opts = {}) {
      const check = this.validate();
      if (!check.ok) { SN.Events.emit('trade:rejected', check); return null; }
      const run = S.run, f = run.form;
      const id = run.selected;
      const m = SN.Market.state(id), def = SN.Market.def(id);
      const lev = f.leverage;
      const amount = f.amount; // se copia ya: el formulario se recalcula cuando cambia el capital
      const entry = m.price;
      const tutorial = !!opts.tutorial;
      const n = tutorial ? D.sim.tutorial.candles : def.candles;
      // SUERTE (y la Bendición de la Fortuna, un nivel más ese día)
      const ctx = { direction, luck: SN.Upgrades.value('suerte') + (SN.Luck && !tutorial ? SN.Luck.luckBoost() : 0), tutorial };
      const twistAt = this.planTwist(def, n, tutorial);

      const candles = [];
      let exit = entry, liquidated = false;
      for (let i = 0; i < n; i++) {
        const step = i === twistAt ? Object.assign({}, ctx, { jump: this.twistJump(def, m, entry, direction, tutorial) }) : ctx;
        const c = SN.Market.step(id, step);
        candles.push(c);
        // Peor momento dentro de la vela: si la pérdida apalancada llega al 100%, se liquida
        const worst = direction > 0 ? (c.l - entry) / entry : (entry - c.h) / entry;
        if (worst * lev <= -1) {
          liquidated = true;
          exit = entry * (1 - direction / lev);
          break;
        }
        exit = c.c;
      }

      // Primero la posición y luego el dinero: así nadie recalcula la apuesta a mitad de camino
      run.position = {
        market: id, direction, amount, leverage: lev,
        star: SN.Luck && !tutorial ? SN.Luck.starMul(id) : 1,
        cap: this.cap(id) * (SN.Luck && !tutorial ? SN.Luck.starMul(id) : 1),
        entry, exit, liquidated, candles: candles.length, total: n, tutorial,
        climax: this.findClimax(candles, def, liquidated),
        day: run.day, turn: run.turn,
      };
      SN.Economy.commit(amount);
      SN.Save.saveRun(); // se guarda ya: recargar la página no deshace una operación
      SN.Events.emit('trade:opened', { position: run.position, candles });
      return run.position;
    },

    // Resultado si la operación se cerrara a este precio (para el marcador en vivo)
    pnlAt(price) {
      const p = S.run.position;
      if (!p) return 0;
      const ret = (price - p.entry) / p.entry * p.direction * p.leverage;
      return this.clampPnl(p, p.amount * ret);
    },

    // Lo que dejaría la operación si llegase hasta el final
    finalPnl(p) {
      if (p.liquidated) return this.clampPnl(p, -p.amount);
      return round2(this.clampPnl(p, p.amount * (p.exit - p.entry) / p.entry * p.direction * p.leverage));
    },

    // CERRAR: cobras al precio que ves. Las velas restantes se siguen mostrando: es lo que te ahorraste (o te perdiste)
    cashOut(price, candlesSeen) {
      const p = S.run.position;
      if (!p || p.settled) return null;
      p.stayPnl = this.finalPnl(p);
      p.exit = price;
      p.liquidated = false;
      p.cashed = true;
      p.cashedAt = candlesSeen;
      const r = this.settle();
      SN.Save.saveRun();
      return r;
    },

    // Cobra la operación: el dinero se mueve aquí; el turno termina en close()
    settle() {
      const run = S.run, p = run.position;
      if (!p || p.settled) return null;
      const marketChange = (p.exit - p.entry) / p.entry;
      let pnl = this.finalPnl(p), shielded = false;
      // SEGURO de la ruleta: la próxima pérdida no cuenta
      if (pnl < 0 && run.shield && !p.tutorial) { pnl = 0; shielded = true; run.shield = false; }
      SN.Economy.settle(p.amount, pnl);
      // Día de la suerte: bonificación por cada operación ganadora
      const luckBonus = SN.Luck && !p.tutorial ? SN.Luck.bonus(pnl) : 0;
      if (luckBonus) SN.Economy.add(luckBonus, 'luck');
      const st = run.stats;
      st.trades++;
      if (pnl >= 0) st.wins++; else st.losses++;
      st.best = Math.max(st.best, pnl);
      st.worst = Math.min(st.worst, pnl);
      if (pnl > 0) st.earned += pnl;
      p.settled = true;
      const capped = !!p.cap && p.cap !== Infinity && Math.abs(pnl) >= p.cap;
      p.result = Object.assign({}, p, { pnl, ret: pnl / p.amount, marketChange, capped, luckBonus, shielded });
      delete p.result.result;
      SN.Events.emit('trade:closed', p.result);
      return p.result;
    },

    close() {
      const run = S.run, p = run.position;
      if (!p) return null;
      const r = p.settled ? p.result : this.settle();
      run.position = null;
      SN.Time.advance(p.market);
      SN.Events.emit('turn:settled', r);
      return r;
    },

    // Esperar sin operar (los mercados siguen moviéndose)
    skipTurn() {
      if (S.run.position) return;
      SN.Time.advance(null);
      SN.Events.emit('turn:settled', null);
    },
  };
})(window.SN);
