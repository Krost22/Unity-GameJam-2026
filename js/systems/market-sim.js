// MarketSimulator: genera las velas de cada mercado. El precio sigue fases de tendencia (alcistas, bajistas
// o planas) con su ruido, sus eventos y una leve atracción a un precio de referencia.
// Todo lo que se ve en la gráfica sale de aquí: el resultado de una operación depende de estas velas.
// La PISTA de la gráfica se calcula con este mismo estado real: predice de verdad, aunque nunca al 100%.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;
  const clamp = SN.Util.clamp;

  function newRegime(rng, def) {
    if (rng.next() < def.flatChance) return rng.range(-0.15, 0.15);
    return (rng.next() < 0.5 ? -1 : 1) * rng.range(0.5, 1);
  }
  const phaseLength = (rng, def) => rng.int(def.phase[0], def.phase[1]);

  SN.Market = {
    create(def, rng) {
      const m = {
        id: def.id,
        price: def.startPrice,
        anchor: def.startPrice,
        regime: newRegime(rng, def),
        nextRegime: newRegime(rng, def),
        phaseLeft: phaseLength(rng, def),
        hintNoise: rng.normal(),
        history: [],
        events: [],
        unlocked: def.unlock.type === 'start',
      };
      // Historial inicial para que la gráfica muestre el comportamiento anterior
      for (let i = 0; i < D.sim.initialHistory; i++) this.stepState(m, def, rng, { quiet: true });
      return m;
    },

    state(id) { return S.run.markets[id]; },
    def(id) { return D.marketById(id); },

    // Suma de los efectos activos de los eventos (tendencia y volatilidad)
    effects(m) {
      let trend = 0, vol = 1;
      for (const e of m.events) {
        if (e.kind === 'trend') trend += e.trend;
        if (e.kind === 'vol') vol *= e.vol;
      }
      return { trend, vol };
    },

    // Genera una vela. ctx: { direction, luck, tutorial, quiet, jump }
    stepState(m, def, rng, ctx = {}) {
      const sim = D.sim;
      if (ctx.tutorial) m.regime = sim.tutorial.regime;
      else if (--m.phaseLeft <= 0) {
        m.regime = m.nextRegime;
        m.nextRegime = newRegime(rng, def);
        m.phaseLeft = phaseLength(rng, def);
      }

      const eff = ctx.quiet ? { trend: 0, vol: 1 } : this.effects(m);
      const sigma = def.volatility * eff.vol * (ctx.tutorial ? sim.tutorial.volMul : 1);
      let mu = (m.regime + eff.trend) * def.drift - def.reversion * Math.log(m.price / m.anchor);
      // La suerte inclina ligeramente el ruido a favor de tu operación (no garantiza nada)
      if (ctx.direction && ctx.luck) mu += ctx.direction * ctx.luck * sim.luckBiasPerLevel * sigma;
      let ret = mu + sigma * rng.normal();
      if (ctx.tutorial) ret = Math.max(ret, -0.4 * sigma);

      const marks = [];
      const resolved = [];
      if (ctx.jump) { ret += ctx.jump; marks.push(ctx.jump >= 0 ? 'pos' : 'neg'); }
      if (!ctx.quiet) {
        for (const e of m.events.slice()) {
          if (e.kind === 'shock') {
            e.delay--;
            if (e.delay <= 0) {
              ret += e.jump;
              marks.push(e.jump >= 0 ? 'pos' : 'neg');
              resolved.push({ e, text: `${e.title}: ${SN.Util.pct(e.jump)}`, tone: e.jump >= 0 ? 'pos' : 'neg' });
              remove(m, e);
            }
          } else if (e.kind === 'rumor') {
            e.resolveIn--;
            if (e.resolveIn <= 0) {
              let p = e.prob;
              // Con suerte, el rumor tiende a salir a favor de tu operación
              if (ctx.direction && ctx.luck) {
                const yesHelps = Math.sign(e.yes) === ctx.direction;
                p += (yesHelps ? 1 : -1) * ctx.luck * sim.luckRumorPerLevel;
              }
              const yes = rng.next() < p;
              const jump = yes ? e.yes : e.no;
              ret += jump;
              marks.push(jump >= 0 ? 'pos' : 'neg');
              resolved.push({ e, text: `${yes ? e.yesText : e.noText}: ${SN.Util.pct(jump)}`, tone: jump >= 0 ? 'pos' : 'neg' });
              remove(m, e);
            }
          } else {
            e.left--;
            if (e.left <= 0) { resolved.push({ e, text: `${e.title}: TERMINA`, tone: 'neu', silent: true }); remove(m, e); }
          }
        }
      }

      const o = m.price;
      const c = Math.max(0.01, o * Math.exp(ret));
      let h = Math.max(o, c) * (1 + Math.abs(rng.normal()) * sigma * 0.55);
      let l = Math.min(o, c) * (1 - Math.abs(rng.normal()) * sigma * 0.55);
      // Un giro amaga primero hacia el lado contrario: ese amago queda como mecha de la vela
      if (ctx.jump > 0) l = Math.min(l, o * (1 - ctx.jump * 0.3));
      if (ctx.jump < 0) h = Math.max(h, o * (1 - ctx.jump * 0.3));
      const candle = { o: r4(o), h: r4(h), l: r4(l), c: r4(c) };
      if (marks.length) candle.m = marks[0];
      if (ctx.jump) candle.tw = 1;
      // Las noticias de esta vela se publican cuando la vela se muestra (flush), no antes
      const notes = resolved.filter((r) => !r.silent);
      if (notes.length) candle.ev = notes.map((r) => ({ market: m.id, text: r.text, tone: r.tone, title: r.e.title, art: r.e.art }));
      m.price = candle.c;
      m.anchor *= 1.0004; // inflación suave a largo plazo
      m.history.push(candle);
      if (m.history.length > D.sim.historyLength) m.history.shift();
      return candle;
    },

    // Publica las noticias pendientes de una vela ya visible
    flush(candle) {
      if (!candle.ev) return;
      for (const n of candle.ev) SN.Events.emit('market:event-resolved', n);
      delete candle.ev;
    },

    step(id, ctx) { return this.stepState(this.state(id), this.def(id), S.rng, ctx); },

    advance(id, n, ctx) {
      const out = [];
      for (let i = 0; i < n; i++) out.push(this.step(id, ctx));
      return out;
    },

    // Mercados que no has operado en este turno: también se mueven
    advanceIdle(exceptId) {
      for (const def of D.markets) {
        if (def.id === exceptId) continue;
        const m = this.state(def.id);
        const ctx = m.unlocked ? {} : { quiet: true };
        for (let i = 0; i < D.sim.idleCandles; i++) this.flush(this.stepState(m, def, S.rng, ctx));
      }
    },

    // Al empezar cada turno puede aparecer un evento nuevo en cada mercado desbloqueado
    spawnEvents(force) {
      for (const def of D.markets) {
        const m = this.state(def.id);
        if (!m.unlocked || m.events.length >= D.sim.maxEventsPerMarket) continue;
        const want = force && force.market === def.id;
        if (!want && S.rng.next() >= def.eventRate) continue;
        const pool = D.marketEvents[def.id].filter((e) => !m.events.some((x) => x.id === e.id));
        const evDef = want && force.id ? pool.find((e) => e.id === force.id) || S.rng.pick(pool) : S.rng.pick(pool);
        if (evDef) this.addEvent(m, evDef);
      }
    },

    addEvent(m, evDef) {
      const rng = S.rng;
      const e = Object.assign({}, evDef, { uid: S.nextUid(), market: m.id, day: S.run.day, turn: S.run.turn });
      if (e.kind === 'shock') {
        e.delay = rng.int(1, 2);
        // El impacto real varía: a veces el mercado ya lo había descontado
        e.jump = r4(rng.range(e.min, e.max) * rng.range(0.55, 1.2));
      } else if (e.kind === 'rumor') {
        e.resolveIn = rng.int(1, 3);
      } else {
        e.left = e.candles;
      }
      m.events.push(e);
      m.newEvents = true;
      SN.Events.emit('market:event', { market: m.id, event: e });
      return e;
    },

    // La lectura de la PISTA cambia una vez por turno, no en cada fotograma
    rollHints() {
      for (const def of D.markets) this.state(def.id).hintNoise = S.rng.normal();
    },

    // --- La PISTA: qué se espera de las próximas velas ---
    // Suma la tendencia real (incluida la fase siguiente si llega antes de acabar), los eventos conocidos
    // y la vuelta al precio de referencia. move = rendimiento esperado, sd = incertidumbre.
    forecast(id) {
      const m = this.state(id), def = this.def(id);
      const n = def.candles;
      const eff = this.effects(m);
      let trend = 0;
      for (let k = 1; k <= n; k++) trend += k < m.phaseLeft ? m.regime : m.nextRegime;
      for (const e of m.events) if (e.kind === 'trend') trend += e.trend * Math.min(e.left, n);
      let move = trend * def.drift - n * def.reversion * Math.log(m.price / m.anchor);
      let spread = Math.pow(def.volatility * eff.vol, 2) * n;
      for (const e of m.events) {
        if (e.kind === 'shock') move += e.jump;
        if (e.kind === 'rumor') {
          move += e.prob * e.yes + (1 - e.prob) * e.no;
          spread += e.prob * (1 - e.prob) * Math.pow(e.yes - e.no, 2);
        }
      }
      const sd = Math.sqrt(spread);
      return { move, sd, z: move / sd, n };
    },

    // Lo que ve el jugador: la previsión con el error de lectura de su nivel de ANÁLISIS.
    // power 0 = sin pista clara, 1-3 = fuerza de la señal. dir: 1 sube, -1 baja, 0 ni idea.
    hint(id) {
      const f = this.forecast(id);
      const cfg = D.sim.hint;
      const noise = cfg.noise[SN.Upgrades.level('analisis')] * (this.state(id).hintNoise || 0);
      const z = f.z + noise;
      const a = Math.abs(z);
      const power = a < cfg.powers[0] ? 0 : a < cfg.powers[1] ? 1 : a < cfg.powers[2] ? 2 : 3;
      return { dir: power ? Math.sign(z) : 0, power, z, move: z * f.sd, sd: f.sd, n: f.n };
    },

    // --- Lecturas para la interfaz ---
    sma(history, period) {
      const out = [];
      let sum = 0;
      for (let i = 0; i < history.length; i++) {
        sum += history[i].c;
        if (i >= period) sum -= history[i - period].c;
        out.push(i >= period - 1 ? sum / period : null);
      }
      return out;
    },

    stats(id) {
      const m = this.state(id), def = this.def(id);
      const eff = this.effects(m);
      return { price: m.price, sigma: def.volatility * eff.vol };
    },
  };

  void clamp;
  function remove(m, e) { const i = m.events.indexOf(e); if (i >= 0) m.events.splice(i, 1); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
})(window.SN);
