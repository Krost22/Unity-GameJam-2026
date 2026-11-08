// Ventanas modales dentro del monitor: MEJORAS, NOTICIAS (un periódico con fotos), TIENDA y AJUSTES.
(function (SN) {
  'use strict';
  const U = SN.Util, S = SN.State, D = SN.Data;

  const TITLES = { upgrades: 'Mejoras', news: 'Noticias', shop: 'Tienda · estilo de vida', settings: 'Ajustes' };

  const W = SN.Windows = {
    current: null, back: null, win: null,

    open(kind) {
      if (this.current === kind) return;
      this.close(true);
      this.current = kind;
      const layer = document.getElementById('layer-windows');
      this.back = U.el('div', 'win-back');
      this.back.addEventListener('click', () => this.close());
      this.win = U.el('div', 'win' + (kind === 'news' ? ' wide paper' : ''));
      this.win.innerHTML = `<div class="win-head"><span>${TITLES[kind]}</span><button class="win-x">X<kbd>ESC</kbd></button></div><div class="win-body"></div>`;
      this.win.querySelector('.win-x').addEventListener('click', () => this.close());
      layer.appendChild(this.back);
      layer.appendChild(this.win);
      SN.Audio.sfx('open');
      this.refresh();
      if (kind === 'news' && S.run) { S.run.newsSeen = S.run.news.length; SN.Events.emit('news:read'); }
    },

    close(silent) {
      if (!this.current) return;
      const win = this.win, back = this.back;
      this.current = null;
      this.win = this.back = null;
      if (!silent) SN.Audio.sfx('close');
      back.remove();
      win.classList.add('closing');
      SN.after(0.16, () => win.remove());
      SN.Events.emit('window:closed');
    },

    refresh() {
      if (!this.win) return;
      const body = this.win.querySelector('.win-body');
      body.innerHTML = '';
      ({ upgrades: buildUpgrades, news: buildNews, shop: buildShop, settings: buildSettings })[this.current](body);
    },
  };

  function icon(name) {
    const c = SN.Sprites.node(name, 1);
    c.className = 'ico';
    c.style.width = '12px'; c.style.height = '12px';
    return c;
  }

  function buildUpgrades(body) {
    body.appendChild(U.el('div', 'win-note', 'Se pagan con tu capital. Ninguna garantiza nada.'));
    for (const d of D.upgrades) {
      const unlocked = SN.Upgrades.isUnlocked(d.id);
      const lv = SN.Upgrades.level(d.id);
      const next = SN.Upgrades.next(d.id);
      const row = U.el('div', 'up-row' + (unlocked ? '' : ' locked'));
      row.title = d.desc;
      row.appendChild(icon(d.icon));
      const pips = d.levels.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const eff = next ? `→ ${d.effect(next.value)}` : (unlocked && d.levels.length ? `${d.effect(SN.Upgrades.value(d.id))} · MÁXIMO` : '');
      row.insertAdjacentHTML('beforeend', `
        <div class="t">${d.name}<span class="lv">${unlocked && d.levels.length ? `NV.${lv}` : ''}</span></div>
        <div class="d">${unlocked ? d.desc : (d.unlock.label || 'Bloqueado')}</div>
        ${unlocked && d.levels.length ? `<div class="e">${eff}</div><div class="pips">${pips}</div>` : ''}`);
      if (unlocked && next) {
        const can = SN.Upgrades.canBuy(d.id);
        const b = U.el('button', 'btn btn-green', U.money(next.cost, { cents: false }));
        b.disabled = !can.ok;
        if (!can.ok && can.reason) b.title = can.reason;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (SN.Upgrades.buy(d.id)) {
            SN.Audio.sfx('unlock');
            const p = SN.UI.posIn(b);
            SN.FX.burst(p.x + p.w / 2, p.y, { n: 18, colors: [SN.PAL.green, SN.PAL.yellow, SN.PAL.creamL] });
            SN.FX.ring(p.x + p.w / 2, p.y + 5, SN.PAL.green, 40);
            W.refresh();
          } else SN.Audio.sfx('error');
        });
        row.appendChild(b);
      } else if (!unlocked) {
        const lock = SN.Sprites.node('lock', 1);
        lock.style.position = 'absolute'; lock.style.right = '6px'; lock.style.top = '6px';
        row.appendChild(lock);
      }
      body.appendChild(row);
    }
  }

  // ---------- El periódico ----------
  const MARKET_ART = { salud: 'hospital', tecno: 'chip', negocios: 'compras', mineria: 'mina' };
  function artFor(n) {
    if (n.art && SN.NewsArt.has(n.art)) return n.art;
    if (/DEUDA SALDADA/.test(n.title)) return 'sello';
    if (/OBJETIVO/.test(n.title)) return 'dinero';
    if (/EMBARGO/.test(n.title)) return 'documento';
    return MARKET_ART[n.market] || 'ciudad';
  }
  function when(n) { return n.filler ? 'En la ciudad' : `Día ${n.day} · ${D.sim.turnNames[n.turn] || ''}`; }
  function tag(n) {
    if (n.dark) return { cls: 'dark', text: 'SUCESOS' };
    const where = n.market ? D.marketById(n.market).short : 'CIUDAD';
    return { cls: n.tone, text: `${n.tone === 'pos' ? '▲ ' : n.tone === 'neg' ? '▼ ' : ''}${where}` };
  }

  function buildNews(body) {
    const run = S.run;
    const news = run ? run.news.slice().reverse() : [];
    const today = run ? `Día ${run.day} · ${D.sim.turnNames[run.turn]}` : '';
    body.insertAdjacentHTML('beforeend', `<div class="np-mast">EL DIARIO DEL FUTURO</div>
      <div class="np-sub"><span>${today}</span><span>Edición de la ciudad</span><span>$0.50</span></div>`);
    // Si hay pocas noticias del mercado, la ciudad rellena el periódico (nunca sale vacío)
    const filler = D.story.fillerNews.map((n) => Object.assign({ day: 1, turn: 0, filler: true }, n));
    const items = news.slice(0, 31);
    for (let i = 0; items.length < 5 && i < filler.length; i++) items.push(filler[i]);
    const dark = SN.UI.darkLevel();
    const [top, ...rest] = items;
    // Portada: la noticia más reciente, con foto grande
    const hero = U.el('div', 'np-hero' + (top.dark ? ' dark' : ''));
    hero.appendChild(SN.NewsArt.node(artFor(top), top.tone || 'neu', top.dark ? dark : 0));
    const tg = tag(top);
    hero.insertAdjacentHTML('beforeend', `<div><span class="np-tag ${tg.cls}">${tg.text}</span> <span class="w">${when(top)}</span>
      <div class="h">${top.title}</div><div class="t">${top.text || ''}</div></div>`);
    body.appendChild(hero);
    // El resto, en dos columnas con foto pequeña
    const grid = U.el('div', 'np-grid');
    for (const n of rest) {
      const it = U.el('div', 'np-item' + (n.dark ? ' dark' : ''));
      it.appendChild(SN.NewsArt.node(artFor(n), n.tone || 'neu', n.dark ? dark : 0, [48, 30]));
      it.insertAdjacentHTML('beforeend', `<div><div class="w">${when(n)}</div><div>${n.title}</div></div>`);
      grid.appendChild(it);
    }
    body.appendChild(grid);
    body.insertAdjacentHTML('beforeend', '<div class="np-ad">Publicidad · <b>Pleyzeta 6 Ultra</b> · ahora también a plazos. Muchos plazos.</div>');
  }

  function buildShop(body) {
    body.appendChild(U.el('div', 'win-note', 'Te lo has ganado. ¿O no? Cada compra aparece en tu habitación.'));
    for (const it of D.shop) {
      const owned = !!S.run.owned[it.id];
      const row = U.el('div', 'shop-row' + (owned ? ' owned' : ''));
      row.appendChild(icon(owned ? 'trebol' : 'caja'));
      row.insertAdjacentHTML('beforeend', `<div class="t">${it.name}</div><div class="d">${owned ? 'En tu habitación' : it.desc}</div>`);
      if (!owned) {
        const b = U.el('button', 'btn btn-yellow', U.short(it.price));
        b.disabled = S.run.capital - it.price < D.sim.bankruptcyThreshold || !!S.run.position;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (S.run.position || S.run.capital - it.price < D.sim.bankruptcyThreshold || !SN.Economy.spend(it.price, 'shop')) { SN.Audio.sfx('error'); return; }
          S.run.owned[it.id] = true;
          SN.Desk.dirty();
          SN.Audio.sfx('pay');
          SN.FX.confetti(30);
          SN.Hands.celebrate();
          SN.Save.saveRun();
          W.refresh();
        });
        row.appendChild(b);
      }
      body.appendChild(row);
    }
  }

  function buildSettings(body) {
    const st = S.profile.settings;
    const row = (label, btnText, cls, fn) => {
      const r = U.el('div', 'set-row', `<span>${label}</span>`);
      const b = U.el('button', 'btn ' + cls, btnText);
      b.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('click'); fn(b); });
      r.appendChild(b);
      body.appendChild(r);
      return b;
    };
    row('Música', st.music ? 'Sí' : 'No', st.music ? 'btn-green' : 'btn-cream', () => { st.music = !st.music; SN.Audio.setMusic(st.music); SN.Save.saveProfile(); W.refresh(); });
    row('Efectos de sonido', st.sfx ? 'Sí' : 'No', st.sfx ? 'btn-green' : 'btn-cream', () => { st.sfx = !st.sfx; SN.Audio.setSfx(st.sfx); SN.Save.saveProfile(); SN.UI.renderSound(); W.refresh(); });
    row('Pantalla completa', 'Cambiar', 'btn-cyan', () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (_) { /* no disponible */ }
    });
    const inGame = SN.Game.state === 'GAMEPLAY' && S.run;
    if (inGame) {
      row('Repetir tutorial', 'Repasar', 'btn-yellow', () => { W.close(true); SN.Tutorial.replay(); });
      row('Guardar y salir al menú', 'Salir', 'btn-coral', () => { W.close(true); SN.Game.toMenu(); });
    }
    body.appendChild(U.el('div', 'set-keys', 'Todo se puede hacer con el ratón. Atajos de teclado:<br>' +
      '<kbd>↑</kbd><kbd>B</kbd> sube · <kbd>↓</kbd><kbd>V</kbd> baja · <kbd>ESPACIO</kbd> cobrar · <kbd>F</kbd> acelerar<br>' +
      '<kbd>← →</kbd> apuesta · <kbd>1-4</kbd> multiplicador · <kbd>P</kbd> esperar · <kbd>TAB</kbd> mercado<br>' +
      '<kbd>M</kbd> mejoras · <kbd>N</kbd> noticias · <kbd>T</kbd> tienda · <kbd>ESC</kbd> menú / cerrar'));
  }
})(window.SN);
