// UIManager: actualiza todo lo que se ve dentro del monitor (FUTURO.exe) y recoge la entrada del jugador.
// Todo se puede hacer con el ratón; el teclado es un atajo y cada botón muestra su tecla.
// Escucha eventos del juego (capital, turnos, mercados...) y nunca calcula economía por su cuenta.
(function (SN) {
  'use strict';
  const U = SN.Util, S = SN.State, D = SN.Data, P = SN.PAL;
  const $ = (id) => document.getElementById(id);

  const UI = SN.UI = {
    busy: false,
    allow: null,       // durante el tutorial: lista de acciones permitidas
    cap: { shown: 0, from: 0, to: 0, t: 1 },
    spotEl: null, arrowEl: null, spotSel: null,
    live: null,        // marcador de la operación en curso
    daysKey: '',

    init() {
      $('screen').querySelector('.app-icon').style.backgroundImage = `url(${SN.Sprites.url('app', 1)})`;
      document.querySelector('#hud-capital .coin').style.backgroundImage = `url(${SN.Sprites.url('coin0', 1)})`;
      // Iconos de los botones de navegación
      for (const [cls, name] of [['ico-up', 'wrench'], ['ico-news', 'news'], ['ico-shop', 'cart']]) { const el = document.querySelector('.' + cls); if (el) el.style.backgroundImage = `url(${SN.Sprites.url(name, 1)})`; }
      SN.Chart.init($('chart'));
      SN.FX.init($('fx'), $('layer-float'), $('screen'));
      SN.Dialog.init();
      this.buildSegments();
      this.bindInput();
      this.bindEvents();
      SN.Chart.onPop = (candle) => this.onPop(candle);
    },

    // Posición de un elemento en píxeles de la pantalla del monitor (para efectos)
    posIn(el) {
      let x = 0, y = 0, e = el;
      const scr = $('screen');
      while (e && e !== scr) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    },

    allowed(action) { return !this.allow || this.allow.includes(action); },

    // Al cerrarse una vela fuerte: anillo, chispas y un golpecito a la gráfica (proporcional al tamaño)
    onPop(candle) {
      const p = SN.Chart.lastCandlePos();
      const up = candle.c >= candle.o;
      const k = Math.abs(candle.c - candle.o) / candle.o / SN.Market.def(SN.Chart.market).volatility; // en desviaciones típicas
      if (k < 1.6 || candle.tw) return;
      SN.FX.ring(p.x, p.y, up ? P.green : P.coral, 12 + k * 5, 0.4);
      SN.FX.burst(p.x, p.y, { n: Math.round(3 + k * 2), colors: [up ? P.green : P.coral, P.creamL], speed: 40 + k * 8, life: 0.45 });
      SN.Chart.kick = (up ? -1 : 1) * Math.min(3, k - 0.5);
      if (k > 2.4) SN.FX.shake(1.5, 0.15);
    },

    // ---------- Construcción ----------
    buildSegments() {
      const lv = $('leverages');
      D.sim.leverages.forEach((l, i) => {
        const b = U.el('button', l.value >= 10 ? 'max' : l.value >= 5 ? 'hot' : '', '×' + l.value);
        b.dataset.l = l.value;
        b.title = `Multiplica el resultado ×${l.value} · tecla ${i + 1}`;
        b.addEventListener('click', () => this.setLeverage(l.value));
        lv.appendChild(b);
      });
      $('risk').innerHTML = '<i></i>'.repeat(5);
    },

    bindInput() {
      $('btn-buy').addEventListener('click', () => this.trade(1));
      $('btn-sell').addEventListener('click', () => this.trade(-1));
      document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => this.setFraction(+b.dataset.frac)));
      const slider = $('slider');
      let drag = false;
      const fromSlider = (e) => {
        const r = slider.getBoundingClientRect();
        this.setFraction(U.clamp((e.clientX - r.left) / r.width, 0, 1), true);
      };
      slider.addEventListener('pointerdown', (e) => { if (!this.canEditForm('amount')) return; drag = true; slider.setPointerCapture(e.pointerId); fromSlider(e); });
      slider.addEventListener('pointermove', (e) => { if (drag) fromSlider(e); });
      slider.addEventListener('pointerup', () => { drag = false; });
      $('nav-upgrades').addEventListener('click', () => this.openWindow('upgrades'));
      $('nav-news').addEventListener('click', () => this.openWindow('news'));
      $('nav-shop').addEventListener('click', () => this.openWindow('shop'));
      $('events').addEventListener('click', () => this.openWindow('news'));
      $('btn-skip-turn').addEventListener('click', () => this.skip());
      $('btn-pay').addEventListener('click', () => { if (!this.busy && this.allowed('pay')) SN.Game.payDebt(); });
      $('btn-sound').addEventListener('click', () => this.toggleSound());
      $('btn-settings').addEventListener('click', () => { if (this.allowed('settings')) this.openWindow('settings'); });
      $('btn-fast').addEventListener('click', (e) => { e.stopPropagation(); this.fast(); });
      $('chart-wrap').addEventListener('click', () => this.fast());
      $('btn-close').addEventListener('click', () => this.cashOut());

      // Las manos del escritorio siguen al cursor y a los clics
      const stage = $('stage');
      stage.addEventListener('pointermove', (e) => {
        const p = SN.Game.toStage(e.clientX, e.clientY);
        SN.Hands.pointAt(p.x, p.y);
      });
      $('monitor').addEventListener('pointerdown', (e) => {
        SN.Audio.unlock();
        SN.Hands.press();
        if (e.target.closest('button, .mcard, #slider, #events')) SN.Audio.sfx('click');
      });

      document.addEventListener('keydown', (e) => this.onKey(e));
    },

    onKey(e) {
      SN.Audio.unlock();
      if (!e.repeat) { SN.Hands.tapKey(e.code); SN.Audio.sfx('key'); }
      if (SN.Desktop.onKey(e)) return;
      if (SN.Dialog.active && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); SN.Dialog.advance(); return; }
      if (SN.Cine && SN.Cine.onKey(e)) return;
      if (SN.Game.state !== 'GAMEPLAY' && SN.Game.state !== 'TUTORIAL') return;
      if (e.code === 'Escape') { if (SN.Windows.current) SN.Windows.close(); else if (this.allowed('settings') && !this.busy) this.openWindow('settings'); return; }
      if (SN.Windows.current || SN.Dialog.active) return;
      // Durante una operación: ESPACIO cobra, F acelera
      if (S.run && S.run.position) {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.cashOut(); }
        else if (e.code === 'KeyF') this.fast();
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); return; }
      const lev = (i) => () => { const l = D.sim.leverages[i]; if (l) this.setLeverage(l.value); };
      const map = {
        ArrowUp: () => this.trade(1), KeyB: () => this.trade(1), KeyW: () => this.trade(1),
        ArrowDown: () => this.trade(-1), KeyV: () => this.trade(-1), KeyS: () => this.trade(-1),
        ArrowLeft: () => this.stepAmount(-1), ArrowRight: () => this.stepAmount(1),
        Digit1: lev(0), Digit2: lev(1), Digit3: lev(2), Digit4: lev(3),
        Tab: () => this.cycleMarket(e.shiftKey ? -1 : 1), KeyQ: () => this.cycleMarket(-1), KeyE: () => this.cycleMarket(1),
        KeyP: () => this.skip(),
        KeyM: () => this.openWindow('upgrades'), KeyN: () => this.openWindow('news'), KeyT: () => this.openWindow('shop'),
      };
      if (map[e.code]) { e.preventDefault(); map[e.code](); }
    },

    bindEvents() {
      const E = SN.Events;
      E.on('capital:changed', (d) => this.onCapital(d));
      E.on('turn:advanced', () => this.renderAll());
      E.on('market:event', ({ market }) => {
        if (market === S.run.selected) { this.renderEvents(true); SN.Audio.sfx('notify'); }
        this.renderMarkets();
      });
      E.on('market:event-resolved', (n) => { if (n.market === S.run.selected) this.renderEvents(true); });
      E.on('market:unlocked', ({ market }) => {
        this.renderMarkets();
        const card = document.querySelector(`.mcard[data-id="${market}"]`);
        if (card) { card.classList.add('unlocking'); const p = this.posIn(card); SN.FX.burst(p.x + p.w / 2, p.y + p.h / 2, { n: 24, colors: [P.yellow, P.green, P.creamL] }); }
      });
      E.on('news:added', () => this.renderNav());
      E.on('news:read', () => this.renderNav());
      E.on('upgrade:bought', () => { this.renderForm(); this.renderHUD(); this.renderMarkets(); });
      E.on('debt:paid', () => this.renderAll());
      E.on('trade:opened', (d) => this.onTradeOpened(d));
      E.on('trade:closed', (r) => this.onTradeClosed(r));
      E.on('trade:rejected', (r) => this.note(r.reason));
      E.on('window:closed', () => this.renderAll());
      E.on('turn:ready', () => this.afterTurnTips());
    },

    // ---------- Render ----------
    renderAll() {
      if (!S.run) return;
      this.renderClock();
      this.renderHUD();
      this.renderMarkets();
      this.renderHead();
      this.renderEvents();
      this.renderForm();
      this.renderNav();
    },

    renderClock() {
      const run = S.run;
      let pips = '';
      for (let i = 0; i < D.sim.turnNames.length; i++) pips += `<i class="pip ${i < run.turn ? 'on' : i === run.turn ? 'now' : ''}"></i>`;
      $('clock').innerHTML = `${SN.Time.turnName()} ${pips}`;
      $('clock').title = 'Cada apuesta gasta un turno · 3 turnos = 1 día';
    },

    renderHUD() {
      const run = S.run;
      if (this.cap.t >= 1) this.setCapitalText(run.capital);
      const goal = SN.Unlocks.currentGoal();
      const fill = $('goal-fill');
      if (goal) {
        $('goal-title').textContent = goal.type === 'debt' ? 'Deuda' : `Meta ${U.short(goal.amount)}`;
        fill.style.width = (U.clamp(run.capital / goal.amount, 0, 1) * 100).toFixed(1) + '%';
        fill.classList.toggle('debt', goal.type === 'debt');
        $('goal-text').textContent = `${U.short(run.capital)} / ${U.short(goal.amount)}`;
      } else {
        $('goal-title').textContent = 'Sin límites';
        fill.style.width = '100%';
        $('goal-text').textContent = '';
      }
      const canPay = SN.Debt.canPay() && !this.busy;
      $('btn-pay').classList.toggle('hidden', !canPay);
      $('btn-pay').classList.toggle('pulse', canPay);
      this.renderDays();
    },

    // Calendario del plazo: 7 casillas, la de hoy parpadea y la última es roja
    renderDays() {
      const run = S.run, box = $('hud-days');
      const key = `${run.day}|${run.debt.paid}|${run.debt.deadlineDay}`;
      if (key === this.daysKey) return;
      this.daysKey = key;
      if (run.debt.paid) { box.innerHTML = `<span class="free">Libre · día<b>${run.day}</b></span>`; return; }
      let html = '';
      for (let d = 1; d <= run.debt.deadlineDay; d++) {
        const cls = [d < run.day ? 'past' : '', d === run.day ? 'now' : '', d === run.debt.deadlineDay ? 'last' : ''].join(' ');
        html += `<i class="${cls}">${d}</i>`;
      }
      box.innerHTML = html;
    },

    setCapitalText(v) {
      const el = $('capital');
      const txt = U.money(v);
      el.textContent = txt;
      el.classList.toggle('small', txt.length > 10);
      this.cap.shown = v;
    },

    onCapital(d) {
      const c = this.cap;
      c.from = c.shown;
      c.to = d.to;
      c.t = 0;
      const el = $('capital');
      el.classList.remove('bump', 'shrink');
      void el.offsetWidth;
      el.classList.add(d.reason !== 'commit' && d.delta >= 0 ? 'bump' : 'shrink');
      this.renderHUD();
      if (!S.run.position) this.renderForm();
    },

    renderMarkets() {
      const box = $('markets');
      box.innerHTML = '';
      for (const def of D.markets) {
        const m = S.run.markets[def.id];
        const card = U.el('div', 'mcard');
        card.dataset.id = def.id;
        card.title = `${def.name}: ${def.desc}`;
        const ico = SN.Sprites.node(def.icon, 1);
        ico.className = 'ico';
        card.appendChild(ico);
        if (!m.unlocked) {
          card.classList.add('locked');
          card.title = `Se abre al llegar a ${def.unlock.label}`;
          card.insertAdjacentHTML('beforeend', `<span class="nm">${def.short}</span><span class="hint">${def.unlock.label || ''}</span>`);
          const lock = SN.Sprites.node('lock', 1);
          lock.className = 'lock';
          card.appendChild(lock);
        } else {
          const live = S.run.position && S.run.position.market === def.id;
          let hint = '<span class="hint live">En juego</span>';
          if (!live) {
            const h = SN.Market.hint(def.id);
            hint = `<span class="hint ${h.dir > 0 ? 'up' : h.dir < 0 ? 'down' : 'flat'}">${h.dir ? (h.dir > 0 ? '▲' : '▼').repeat(h.power) : '?'}</span>`;
          }
          card.insertAdjacentHTML('beforeend', `<span class="nm">${def.short}</span>${hint}`);
          if (!live) card.appendChild(sparkline(m.history.slice(-20)));
          if (def.id === S.run.selected) card.classList.add('sel');
          if (m.newEvents && def.id !== S.run.selected) card.insertAdjacentHTML('beforeend', '<b class="alert">!</b>');
          card.addEventListener('click', () => this.selectMarket(def.id));
        }
        box.appendChild(card);
      }
    },

    renderHead() {
      const def = SN.Market.def(S.run.selected);
      const app = $('app');
      app.style.setProperty('--mk', def.colors.main);
      app.style.setProperty('--mk2', def.colors.alt === P.coal ? P.creamM : def.colors.alt);
      app.style.setProperty('--mkD', def.colors.dark);
      app.style.setProperty('--mkInk', def.colors.ink);
      const price = SN.Chart.anim && SN.Chart.market === def.id ? SN.Chart.livePrice : SN.Market.state(def.id).price;
      const head = $('mkt-head');
      head.title = `${def.name} · ${def.tag}`;
      head.innerHTML = `<div class="ico-box"></div><span class="nm">${def.short}</span><span class="px-price">${fmt(price)}</span>`;
      head.querySelector('.ico-box').appendChild(SN.Sprites.node(def.icon, 1));
    },

    // Bajo la gráfica: la noticia activa del mercado (o la última que hubo), con su foto
    renderEvents(animateNew) {
      const box = $('events');
      const run = S.run, id = run.selected;
      const m = run.markets[id];
      const ev = m.events[m.events.length - 1];
      let item = null, kicker = '', arrows = '';
      if (ev) {
        item = { title: ev.title, tone: ev.tone, art: ev.art };
        kicker = '¡Última hora!';
        arrows = eventArrows(ev);
      } else {
        for (let i = run.news.length - 1; i >= 0; i--) if (run.news[i].market === id) { item = run.news[i]; break; }
        if (item) kicker = `Día ${item.day} · ${D.sim.turnNames[item.turn] || ''}`;
      }
      box.className = item ? `${item.dark ? 'neg' : item.tone}${ev ? '' : ' old'}${animateNew ? ' new' : ''}` : 'empty';
      box.title = item ? 'Ver todas las noticias (N)' : '';
      box.innerHTML = '';
      if (!item) { box.innerHTML = '<div class="tk" style="left:6px"><span class="tk-k">Sin noticias</span><span class="tk-t">La calma antes de la tormenta.</span></div>'; return; }
      box.appendChild(SN.NewsArt.node(item.art || 'ciudad', item.tone || 'neu', item.dark ? darkLevel() : 0, [52, 32]));
      box.insertAdjacentHTML('beforeend', `<div class="tk"><span class="tk-k">${kicker}</span><span class="tk-a">${arrows}</span><span class="tk-t">${item.title}</span></div>`);
    },

    renderForm() {
      const run = S.run;
      if (!run || run.position) return;
      const f = run.form;
      const max = SN.Trading.maxAmount();
      if (f.frac != null) f.amount = Math.floor(max * f.frac);
      SN.Trading.clampForm();
      const amt = $('amount');
      amt.textContent = U.money(f.amount);
      amt.classList.toggle('small', U.money(f.amount).length > 9);
      const lim = SN.Trading.limit();
      $('bet-box').title = `Máximo por apuesta: ${U.money(lim, { cents: false })} · mínimo: ${U.money(D.sim.minInvestment, { cents: false })}`;
      const k = max > 0 ? U.clamp(f.amount / max, 0, 1) : 0;
      $('slider-fill').style.width = (k * 100) + '%';
      $('slider-knob').style.left = (k * 100) + '%';
      document.querySelectorAll('.quick button').forEach((b) => b.classList.toggle('on', f.frac != null && Math.abs(f.frac - +b.dataset.frac) < 0.001));
      document.querySelectorAll('#leverages button').forEach((b) => {
        const v = +b.dataset.l;
        const ok = SN.Trading.leverageAvailable(v);
        b.disabled = !ok;
        if (!ok) b.title = 'Se desbloquea al pagar la deuda';
        b.classList.toggle('on', v === f.leverage);
      });
      // Riesgo de un vistazo: cuánto de tu dinero apuestas, multiplicado
      const r = f.amount / Math.max(1, run.capital) * f.leverage;
      const lvl = r <= 0.3 ? 1 : r <= 0.75 ? 2 : r <= 1.5 ? 3 : r <= 3 ? 4 : 5;
      const risk = $('risk');
      risk.className = 'r' + lvl;
      [...risk.children].forEach((i, n) => i.classList.toggle('on', n < lvl));
      const v = SN.Trading.validate();
      $('btn-buy').disabled = !v.ok || this.busy || !this.allowed('buy');
      $('btn-sell').disabled = !v.ok || this.busy || !this.allowed('sell');
    },

    renderNav() {
      const run = S.run;
      if (!run) return;
      const unread = run.news.length - (run.newsSeen || 0);
      const badge = $('news-badge');
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.classList.toggle('hidden', unread <= 0);
      const shop = $('nav-shop');
      shop.disabled = !run.debt.paid;
      shop.title = run.debt.paid ? 'Tienda de estilo de vida' : 'Se abre al pagar la deuda';
      $('btn-skip-turn').disabled = this.busy || !!run.position || !this.allowed('skip');
      $('btn-skip-turn').title = 'No apostar: pasa el turno y el mercado sigue';
    },

    renderSound() {
      const st = S.profile.settings;
      $('btn-sound').classList.toggle('off', !st.sfx && !st.music);
    },

    // ---------- Acciones ----------
    canEditForm(action) { return S.run && !S.run.position && !this.busy && this.allowed(action || 'form'); },

    note(text) {
      SN.Audio.sfx('error');
      const btns = $('trade-buttons');
      btns.classList.remove('shake'); void btns.offsetWidth; btns.classList.add('shake');
      const p = this.posIn(btns);
      SN.FX.float(text, p.x + p.w / 2, p.y - 10, 'loss small');
    },

    setFraction(frac, fromSlider) {
      if (!this.canEditForm('amount')) return;
      const f = S.run.form;
      f.frac = fromSlider ? Math.round(frac * 20) / 20 : frac;
      if (f.frac <= 0) f.frac = 0.05;
      if (!fromSlider) SN.Audio.sfx('select');
      this.renderForm();
      SN.Events.emit('form:changed', f);
    },

    stepAmount(dir) {
      if (!this.canEditForm('amount')) return;
      const f = S.run.form;
      const max = SN.Trading.maxAmount();
      const cur = f.frac != null ? f.frac : (max > 0 ? f.amount / max : 0);
      f.frac = U.clamp(Math.round(cur * 20 + dir) / 20, 0.05, 1);
      SN.Audio.sfx('select');
      this.renderForm();
      SN.Events.emit('form:changed', f);
    },

    setLeverage(v) {
      if (!this.canEditForm('leverage') || !SN.Trading.leverageAvailable(v)) { SN.Audio.sfx('error'); return; }
      S.run.form.leverage = v;
      SN.Audio.sfx('select');
      this.renderForm();
    },

    selectMarket(id) {
      if (this.busy || S.run.position || !this.allowed('market')) return;
      if (!SN.Unlocks.isUnlocked(id)) { SN.Audio.sfx('error'); return; }
      if (S.run.selected === id) return;
      S.run.selected = id;
      S.run.markets[id].newEvents = false;
      SN.Chart.setMarket(id);
      SN.Audio.sfx('whoosh');
      for (const sel of ['mkt-head', 'chart-wrap']) { const el = $(sel); el.classList.remove('switch'); void el.offsetWidth; el.classList.add('switch'); }
      this.renderAll();
    },

    cycleMarket(dir) {
      const ids = D.markets.filter((d) => SN.Unlocks.isUnlocked(d.id)).map((d) => d.id);
      const i = ids.indexOf(S.run.selected);
      this.selectMarket(ids[(i + dir + ids.length) % ids.length]);
    },

    openWindow(kind) {
      if (this.busy || !this.allowed('window')) return;
      if (kind === 'shop' && !S.run.debt.paid) { SN.Audio.sfx('error'); return; }
      SN.Windows.open(kind);
    },

    toggleSound() {
      const st = S.profile.settings;
      const on = !(st.sfx || st.music);
      st.sfx = on; st.music = on;
      SN.Audio.setSfx(on); SN.Audio.setMusic(on);
      SN.Save.saveProfile();
      this.renderSound();
    },

    trade(dir) {
      if (this.busy || SN.Windows.current || SN.Dialog.active) return;
      if (!this.allowed(dir > 0 ? 'buy' : 'sell')) { SN.Audio.sfx('error'); return; }
      const v = SN.Trading.validate();
      if (!v.ok) { this.note(v.reason); return; }
      SN.Game.trade(dir);
    },

    skip() {
      if (this.busy || !S.run || S.run.position || !this.allowed('skip') || SN.Windows.current || SN.Dialog.active) return;
      SN.Game.skipTurn();
    },

    fast() { if (SN.Chart.anim && this.allowed('fast')) SN.Chart.fast(); },

    cashOut() {
      const pos = S.run && S.run.position;
      if (!pos || pos.settled || !SN.Chart.anim || SN.Chart.anim.revealed >= SN.Chart.anim.total || $('btn-close').disabled) return;
      if (!this.allowed('cashout')) { SN.Audio.sfx('error'); return; }
      SN.Game.cashOut();
    },

    setBusy(b) {
      this.busy = b;
      this.renderForm();
      this.renderNav();
      this.renderHUD();
    },

    // ---------- Operación en curso ----------
    onTradeOpened({ position }) {
      const btn = $(position.direction > 0 ? 'btn-buy' : 'btn-sell');
      btn.classList.remove('squash'); void btn.offsetWidth; btn.classList.add('squash');
      const bp = this.posIn(btn);
      SN.FX.ring(bp.x + bp.w / 2, bp.y + bp.h / 2, position.direction > 0 ? P.green : P.coral, 50, 0.5);
      SN.FX.burst(bp.x + bp.w / 2, bp.y + bp.h / 2, { n: 14, colors: [P.cyan, P.creamL, position.direction > 0 ? P.green : P.coral], speed: 80 });
      SN.Audio.sfx(position.direction > 0 ? 'buy' : 'sell');
      SN.Hands.drumming = true;
      SN.Desk.led = 'busy';
      SN.Desk.glowTo(P.cyan, 0.9);
      $('trade-form').classList.add('hidden');
      $('trade-live').classList.remove('hidden');
      const dir = $('live-dir');
      dir.textContent = position.direction > 0 ? '▲ Subirá' : '▼ Bajará';
      dir.className = 'dir ' + (position.direction > 0 ? 'long' : 'short');
      $('live-bet').textContent = `${U.short(position.amount)} ×${position.leverage}`;
      const steps = $('live-steps');
      steps.innerHTML = '';
      for (let i = 0; i < position.total; i++) steps.appendChild(U.el('i', i >= position.total - D.sim.dangerCandles ? 'danger' : ''));
      steps.title = 'Las rayadas son las últimas velas: ahí puede haber giros';
      const close = $('btn-close');
      close.className = 'btn btn-yellow arming';
      close.disabled = true;
      // Medio segundo de margen: un doble clic en SUBE/BAJA no cobra sin querer al precio de entrada
      SN.after(0.5, () => { if (S.run && S.run.position === position && !position.settled) { close.disabled = false; close.classList.remove('arming'); } });
      $('close-lbl').textContent = 'Cobrar';
      $('close-amt').textContent = '+$0';
      this.setLiveNote('');
      $('btn-fast').classList.remove('hidden');
      this.live = { shown: null, lastPnl: 0, warned: false };
      this.renderLive(0);
      this.renderHUD();
      this.renderMarkets();
      this.renderNav();
    },

    // Marcador grande y botón COBRAR / SALIR con el resultado si cerraras ahora
    renderLive(pnl) {
      const lv = this.live;
      if (!lv || (lv.shown != null && Math.abs(pnl - lv.shown) < 0.005)) return;
      lv.shown = pnl;
      // La habitación se tiñe del color de la operación (verde si ganas, rojo si pierdes)
      SN.Desk.glowTo(pnl >= 0 ? P.green : P.coral, Math.min(1.4, 0.7 + Math.abs(pnl) / Math.max(1, S.run.position ? S.run.position.amount : 1)));
      const pe = $('live-pnl');
      pe.textContent = U.money(pnl, { sign: true });
      pe.className = 'pnl ' + (pnl >= 0 ? 'up' : 'down');
      const close = $('btn-close');
      if (close.classList.contains('done')) return;
      $('close-lbl').textContent = pnl >= 0 ? 'Cobrar' : 'Salir';
      $('close-amt').textContent = U.money(pnl, { sign: true });
      close.classList.toggle('losing', pnl < 0);
    },

    setLiveNote(text, cls = '') {
      const n = $('live-note');
      n.textContent = text;
      n.className = cls;
    },

    onCandle(i, candle) {
      const pos = S.run.position;
      if (!pos) return;
      SN.Market.flush(candle);
      const settled = !!pos.settled;
      const pnl = settled ? pos.result.pnl : SN.Trading.pnlAt(i === pos.candles && pos.liquidated ? pos.exit : candle.c);
      // Cada vela suena más aguda cuanto mejor te va
      SN.Audio.sfx('candle', { up: candle.c >= candle.o, step: settled ? null : Math.round(pnl / Math.max(1, pos.amount) * 25), quiet: settled });
      const step = $('live-steps').children[i - 1];
      if (step) step.classList.add('done');
      if (settled) { if (step) step.classList.add('ghost'); this.renderHead(); return; }
      this.renderLive(pnl);
      // Zona de peligro: las últimas velas
      const danger = i >= pos.total - D.sim.dangerCandles && i < pos.candles;
      $('chart-wrap').classList.toggle('danger', danger);
      $('btn-close').classList.toggle('hot', danger && pnl > 0);
      if (danger && !this.live.warned) {
        this.live.warned = true;
        this.setLiveNote('¡Últimas velas!', 'warn');
        SN.Audio.sfx('tick');
        this.tip('danger', 'Últimas velas: aquí puede pasar de todo. ¿Cobras o aguantas?');
      }
      // Lo que acaba de ganar o perder esta vela, saltando junto a ella
      const d = pnl - this.live.lastPnl;
      if (Math.abs(d) >= pos.amount * 0.04) {
        const p = SN.Chart.lastCandlePos();
        SN.FX.float(U.money(d, { sign: true }), p.x, p.y - 10, (d >= 0 ? 'gain' : 'loss') + ' small');
        if (d > 0) SN.FX.sparkle(p.x, p.y - 4);
      }
      this.live.lastPnl = pnl;
      this.renderHead();
    },

    // Cobrado: el dinero entra ya; las velas que faltan se ven en gris (lo que habría pasado)
    onCashOut(r) {
      const close = $('btn-close');
      close.classList.remove('hot', 'losing');
      close.classList.add('done');
      close.disabled = true;
      $('close-lbl').textContent = r.pnl >= 0 ? '¡Cobrado!' : 'Fuera';
      $('close-amt').textContent = U.money(r.pnl, { sign: true });
      const pe = $('live-pnl');
      pe.textContent = U.money(r.pnl, { sign: true });
      pe.className = 'pnl ' + (r.pnl >= 0 ? 'up' : 'down');
      $('chart-wrap').classList.remove('danger');
      this.setLiveNote('...y el mercado sigue sin ti');
      SN.Audio.sfx('cash');
      SN.Hands.drumming = false;
    },

    onTradeClosed(r) {
      const cap = this.posIn($('hud-capital'));
      const cx = cap.x + 60, cy = cap.y + 14;
      const big = r.ret >= 0.5 || r.pnl >= Math.max(100, S.run.capital * 0.4);
      SN.Desk.flashGlow(r.pnl >= 0 ? P.green : P.coral, big ? 1.4 : 0.9);
      if (r.pnl >= 0) {
        SN.FX.win(r.pnl, cx, cy, big);
        const cp = SN.Chart.lastCandlePos();
        SN.FX.burst(cp.x, cp.y, { n: 14, colors: [P.green, P.yellow], speed: 70 });
        SN.FX.float(U.money(r.pnl, { sign: true }), cx + 10, cy + 10, 'gain');
        SN.Audio.sfx('win', { big });
        SN.Hands.celebrate(big);
      } else {
        SN.FX.loss(r.pnl, cx, cy, big || r.liquidated);
        SN.FX.float(U.money(r.pnl), cx + 10, cy + 6, 'loss');
        SN.Audio.sfx(r.liquidated ? 'liquidation' : 'loss', { big });
        SN.Hands.flinch(big || r.liquidated);
        if (r.liquidated) this.stamp('¡LIQUIDADO!', 'coral', `El mercado fue ${Math.round(100 / r.leverage)}% en tu contra`, 1.3);
      }
      SN.Hands.drumming = false;
      SN.Desk.led = 'idle';
    },

    // Al terminar las velas: si cobraste antes, qué te ahorraste o qué te perdiste
    onTradeDone(r) {
      $('chart-wrap').classList.remove('danger');
      if (!r || !r.cashed) return;
      const diff = r.stayPnl - r.pnl;
      if (diff < -0.5) this.setLiveNote(`¡Te ahorraste ${U.money(-diff)}!`, 'good');
      else if (diff > 0.5) this.setLiveNote(`Te perdiste ${U.money(diff)} más`, 'bad');
      else this.setLiveNote('Justo a tiempo');
    },

    endTrade() {
      SN.Desk.glowTo(P.cyan, 0.5);
      $('trade-form').classList.remove('hidden');
      $('trade-live').classList.add('hidden');
      $('btn-fast').classList.add('hidden');
      $('chart-wrap').classList.remove('danger');
      this.live = null;
      this.renderAll();
    },

    // Consejos de una sola vez, justo cuando hacen falta (nunca durante el tutorial)
    tip(id, text) {
      const prof = S.profile;
      prof.tips = prof.tips || {};
      if (prof.tips[id] || SN.Tutorial.active) return;
      prof.tips[id] = true;
      SN.Save.saveProfile();
      const el = U.el('div', 'tip', text);
      const a = this.posIn($('chart-wrap'));
      el.style.left = (a.x + 6) + 'px';
      el.style.top = (a.y + 6) + 'px';
      $('layer-float').appendChild(el);
      SN.after(4.5, () => { el.classList.add('out'); SN.after(0.3, () => el.remove()); });
    },

    afterTurnTips() {
      const run = S.run;
      if (!run || run.position) return;
      const h = SN.Market.hint(run.selected);
      if (h.power === 0) this.tip('flat', 'Sin pista clara (?). Puedes esperar: el mercado sigue solo.');
      else if (run.markets[run.selected].events.length) this.tip('news', 'Las noticias mueven el precio: ▲ sube, ▼ baja, ? rumor.');
    },

    // ---------- Tutorial: resaltado ----------
    spot(selector) {
      this.clearSpot();
      if (!selector) return;
      const target = document.querySelector(selector);
      if (!target) return;
      const p = this.posIn(target);
      const layer = $('layer-dialog');
      const s = U.el('div', 'spot');
      Object.assign(s.style, { left: (p.x - 2) + 'px', top: (p.y - 2) + 'px', width: (p.w + 4) + 'px', height: (p.h + 4) + 'px' });
      layer.insertBefore(s, layer.firstChild);
      const a = U.el('div', 'spot-arrow', p.y > 40 ? '▼' : '▲');
      a.style.left = Math.round(p.x + p.w / 2 - 6) + 'px';
      a.style.top = (p.y > 40 ? p.y - 18 : p.y + p.h + 3) + 'px';
      layer.insertBefore(a, s.nextSibling);
      this.spotEl = s; this.arrowEl = a; this.spotSel = selector;
      return p;
    },
    clearSpot() {
      if (this.spotEl) this.spotEl.remove();
      if (this.arrowEl) this.arrowEl.remove();
      this.spotEl = this.arrowEl = this.spotSel = null;
    },

    // ---------- Tarjetas y sellos ----------
    card(html, cls, time = 1.4) {
      return new Promise((resolve) => {
        const el = U.el('div', cls, html);
        $('layer-top').appendChild(el);
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          el.classList.add('out');
          SN.after(0.3, () => { el.remove(); resolve(); });
        };
        el.addEventListener('click', finish);
        SN.after(time, finish);
      });
    },
    dayCard(day, sub, warn) { return this.card(`<div class="d1">DÍA ${day}</div><div class="d2${warn ? ' warn' : ''}">${sub}</div>`, 'daycard', 1.3); },
    stamp(text, cls = '', sub = '', time = 1.6) { return this.card(`${text}${sub ? `<small>${sub}</small>` : ''}`, 'stamp ' + cls, time); },

    update(dt) {
      const c = this.cap;
      if (c.t < 1) {
        c.t = Math.min(1, c.t + dt / 0.7);
        this.setCapitalText(U.lerp(c.from, c.to, U.ease.outCubic(c.t)));
        if (c.t >= 1) this.setCapitalText(c.to);
      }
      // Marcador en vivo: sigue al precio que se ve, también dentro de una vela
      const pos = S.run && S.run.position;
      if (pos && !pos.settled && this.live && SN.Chart.anim) this.renderLive(SN.Trading.pnlAt(SN.Chart.livePrice));
      // El resaltado sigue al elemento (por si se mueve)
      if (this.spotSel && this.spotEl) {
        const t = document.querySelector(this.spotSel);
        if (t) { const p = this.posIn(t); this.spotEl.style.left = (p.x - 2) + 'px'; this.spotEl.style.top = (p.y - 2) + 'px'; }
      }
    },
  };

  function fmt(p) { return String(Math.round(p)); }

  // Nivel de "rareza" de las fotos de noticias extrañas
  function darkLevel() { return Math.max(1, Math.min(8, (S.run && S.run.darkness) || 1)); }
  SN.UI.darkLevel = darkLevel;

  // Flechas de impacto de un evento: ▲▲ sube, ▼▼ baja, ? rumor, ≈ volatilidad
  function eventArrows(e) {
    if (e.kind === 'vol') return '≈';
    if (e.kind === 'rumor') return '?' + (e.prob * e.yes + (1 - e.prob) * e.no >= 0 ? '▲' : '▼');
    const v = e.kind === 'shock' ? (e.min + e.max) / 2 : e.trend;
    const n = e.kind === 'shock' && Math.abs(v) >= 0.08 ? 3 : 2;
    return (v >= 0 ? '▲' : '▼').repeat(n);
  }
  SN.UI.eventArrows = eventArrows;

  function sparkline(hist) {
    const c = SN.Px.canvas(28, 10), g = SN.Px.ctx(c);
    c.className = 'spark';
    if (hist.length < 2) return c;
    const closes = hist.map((h) => h.c);
    const lo = Math.min(...closes), hi = Math.max(...closes);
    const up = closes[closes.length - 1] >= closes[0];
    let prev = null;
    closes.forEach((v, i) => {
      const x = Math.round(i / (closes.length - 1) * 27), y = Math.round(9 - (v - lo) / ((hi - lo) || 1) * 9);
      if (prev) SN.Px.line(g, prev[0], prev[1], x, y, up ? P.greenD : P.coralD);
      prev = [x, y];
    });
    return c;
  }
})(window.SN);
