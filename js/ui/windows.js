// Ventanas modales dentro del monitor: MEJORAS, NOTICIAS (un periódico con fotos), TIENDA, AJUSTES,
// la RULETA de los días de la suerte y la OFERTA de FUTURO.exe (que salta sola, sin pasar por la tienda).
(function (SN) {
  'use strict';
  const U = SN.Util, S = SN.State, D = SN.Data;

  const TITLES = { upgrades: 'Mejoras', news: 'Noticias', shop: 'Tienda · MEGATIENDA.COM', settings: 'Ajustes', ruleta: 'Ruleta de la Fortuna', offer: '', about: 'Acerca de FUTURO.exe' };

  const W = SN.Windows = {
    current: null, back: null, win: null,
    opts: {},

    // opts: para la oferta, { item, why } (why: 'new' | 'afford' | 'insist' | 'shop')
    open(kind, opts = {}) {
      if (this.current === kind && kind !== 'offer') return;
      this.close(true);
      this.current = kind;
      this.opts = opts;
      if (kind === 'news') this.newsFocus = opts.focus || null; // abrir una noticia directamente en primera plana
      const layer = document.getElementById('layer-windows');
      this.back = U.el('div', 'win-back');
      this.back.addEventListener('click', () => this.close());
      this.win = U.el('div', 'win' + (kind === 'news' ? ' wide paper' : kind === 'offer' ? ' offer-win' : ''));
      if (kind === 'offer') this.win.innerHTML = '<div class="win-body"></div>';
      else {
        this.win.innerHTML = `<div class="win-head"><span>${TITLES[kind]}</span><button class="win-x">X<kbd>ESC</kbd></button></div><div class="win-body"></div>`;
        SN.KW.apply(this.win.querySelector('.win-head span'));
        this.win.querySelector('.win-x').addEventListener('click', () => this.close());
      }
      layer.appendChild(this.back);
      layer.appendChild(this.win);
      SN.Audio.sfx(kind === 'offer' ? 'notify' : 'open');
      this.refresh();
      SN.Events.emit('window:opened', { kind });
      if (kind === 'news' && S.run) { S.run.newsSeen = S.run.news.length; SN.Events.emit('news:read'); }
      if ((kind === 'upgrades' || kind === 'shop') && S.run && SN.ShopWatch) { SN.ShopWatch.markSeen(kind); SN.Events.emit('shop:seen', { kind }); }
    },
    // La oferta de FUTURO.exe de un objeto clave
    offer(id, why = 'shop') { this.open('offer', { item: id, why }); },

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
      ({ upgrades: buildUpgrades, news: buildNews, shop: buildShop, settings: buildSettings, ruleta: buildWheel, offer: buildOffer, about: buildAbout })[this.current](body);
      // Palabras clave con color (dinero, 7, suerte) y FUTURO.exe en el idioma secreto
      SN.KW.apply(body);
    },
  };

  function icon(name) {
    const c = SN.Sprites.node(name, 1);
    c.className = 'ico';
    c.style.width = '12px'; c.style.height = '12px';
    return c;
  }

  // Mejoras (los "regalos" del encapuchado) y, cuando Bravo Fines se presenta, la pestaña de su Academia
  function buildUpgrades(body) {
    const acOpen = SN.Academy && SN.Academy.open();
    if (!acOpen) W.tab = 'mejoras';
    const tab = W.tab || 'mejoras';
    W.win.classList.toggle('wide', tab === 'academia');
    if (acOpen) {
      const tabs = U.el('div', 'up-tabs');
      const n = SN.Academy.buyable().length;
      for (const [id, label] of [['mejoras', 'Mejoras'], ['academia', `Academia de Bravo Fines${n ? `<b class="badge">${n}</b>` : ''}`]]) {
        const b = U.el('button', 'up-tab' + (tab === id ? ' on' : '') + (id === 'academia' ? ' ac' : ''), label);
        b.dataset.tab = id;
        b.addEventListener('click', (e) => { e.stopPropagation(); if (W.tab === id) return; W.tab = id; SN.Audio.sfx('select'); W.refresh(); });
        tabs.appendChild(b);
      }
      body.appendChild(tabs);
    }
    if (tab === 'academia') { buildAcademy(body); return; }
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

  // ---------- La Academia de Bravo Fines: un árbol de habilidades (js/data/academy.js) ----------
  // Cada rama es una fila; cada nodo necesita el anterior. Clic en un nodo: sus detalles y el botón de comprar.
  function buildAcademy(body) {
    const A = SN.Academy, data = D.academy;
    const head = U.el('div', 'ac-head');
    const ava = U.el('i', 'ac-ava');
    ava.appendChild(SN.Sprites.node('avaBravo', 2));
    head.appendChild(ava);
    head.insertAdjacentHTML('beforeend', `<div class="ac-who"><b>${data.guru.name}</b><span>"El dinero no se gana. Se manifiesta."</span></div>
      <em class="ac-inc">Tus negocios: +${U.money(A.income())} al día</em>`);
    body.appendChild(head);
    const all = A.nodes();
    if (!W.acSel || !A.node(W.acSel)) W.acSel = (all.find((n) => A.canBuy(n.id).ok) || all.find((n) => !A.has(n.id) && !n.soon) || all[0]).id;
    for (const br of data.branches) {
      const row = U.el('div', 'ac-row ' + br.color);
      row.appendChild(U.el('div', 'ac-br', br.name));
      br.nodes.forEach((n, i) => {
        if (i) row.appendChild(U.el('i', 'ac-link' + (A.has(br.nodes[i - 1].id) ? ' on' : '')));
        const can = A.canBuy(n.id), own = A.has(n.id);
        const el = U.el('button', 'ac-node' + (own ? ' own' : n.soon ? ' soon' : can.ok ? ' can' : ' locked') + (W.acSel === n.id ? ' sel' : ''));
        el.dataset.node = n.id;
        el.title = n.name;
        el.appendChild(icon(n.soon ? 'lock' : n.icon));
        el.insertAdjacentHTML('beforeend', `<span class="nm">${n.short || n.name}</span><span class="pr">${own ? 'TUYO' : n.soon ? 'PRONTO' : U.short(n.cost)}</span>`);
        el.addEventListener('click', (e) => { e.stopPropagation(); W.acSel = n.id; SN.Audio.sfx('select'); W.refresh(); });
        row.appendChild(el);
      });
      body.appendChild(row);
    }
    // Detalle del nodo elegido
    const n = A.node(W.acSel), can = A.canBuy(n.id), own = A.has(n.id);
    const det = U.el('div', 'ac-det');
    det.innerHTML = `<div class="t">${n.name}${n.soon ? ' <em>· Próximamente</em>' : ''}</div><div class="d">${n.desc}</div>`;
    if (!own && !n.soon) {
      const b = U.el('button', 'btn btn-yellow', `Comprar ${U.money(n.cost)}`);
      b.disabled = !can.ok;
      if (!can.ok && can.reason) { b.title = can.reason; det.insertAdjacentHTML('beforeend', `<div class="r">${can.reason.charAt(0) + can.reason.slice(1).toLowerCase()}</div>`); }
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!A.buy(n.id)) { SN.Audio.sfx('error'); return; }
        SN.Audio.sfx('unlock');
        const p = SN.UI.posIn(b);
        SN.FX.burst(p.x + p.w / 2, p.y, { n: 18, colors: [SN.PAL.yellow, SN.PAL.green, SN.PAL.creamL] });
        SN.FX.ring(p.x + p.w / 2, p.y + 5, SN.PAL.yellow, 40);
        SN.Save.saveRun();
        W.acSel = null;
        W.refresh();
      });
      det.appendChild(b);
    } else if (own) det.insertAdjacentHTML('beforeend', '<div class="r ok">Ya es tuyo.</div>');
    body.appendChild(det);
  }

  // ---------- El periódico ----------
  const MARKET_ART = { salud: 'hospital', tecno: 'chip', negocios: 'compras', mineria: 'mina', salud_negro: 'pastillas', tecno_negro: 'candado', negocios_negro: 'persiana', mineria_negro: 'mina' };
  function artFor(n) {
    if (n.art && SN.NewsArt.has(n.art)) return n.art;
    if (/DEUDA SALDADA/.test(n.title)) return 'sello';
    if (/OBJETIVO/.test(n.title)) return 'dinero';
    if (/EMBARGO/.test(n.title)) return 'documento';
    return MARKET_ART[n.market] || 'ciudad';
  }
  function when(n) { return n.filler ? 'En la ciudad' : `Día ${n.day} · ${D.sim.turnNames[n.turn] || ''}`; }
  // El evento de mercado de una noticia (si lo es)
  function eventOf(n) {
    if (!n || !n.ev || !n.market) return null;
    return (D.marketEvents[n.market] || []).find((e) => e.id === n.ev) || ((D.luck && D.luck.events) || []).find((e) => e.id === n.ev) || null;
  }
  // Qué dice la pegatina de la foto: el color del mercado y hacia dónde va
  function stickerOf(n) {
    if (!n || !n.market || n.dark || n.cipher) return null;
    const ev = eventOf(n), def = D.marketById(n.market);
    if (!def) return null;
    let sym = n.tone === 'neg' ? 'down' : n.tone === 'pos' ? 'up' : 'vol';
    if (ev && n.kind !== 'result') sym = ev.kind === 'rumor' ? 'rumor' : ev.kind === 'vol' ? 'vol' : ev.kind === 'trend' ? (ev.trend > 0 ? 'up' : 'down') : (ev.tone === 'pos' ? 'up' : 'down');
    return { color: def.colors.main, sym };
  }
  // PRIMERA PLANA: qué pasa, a quién afecta y qué puede pasar (en palabras de la calle)
  function newsInfo(n) {
    const ev = eventOf(n), mk = n.market ? D.marketLabel(n.market) : '';
    const up = (v) => (v >= 0 ? 'sube' : 'baja');
    if (n.cipher) return { more: 'Está escrita con unas letras que nadie sabe leer. El periódico dice que es una errata.', who: 'Nadie lo sabe.', what: 'No se puede leer. Todavía.' };
    if (n.dark) return { more: 'Pasó justo después de tu operación. Seguro que es casualidad.', who: mk ? `La ciudad. Justo donde ganaste: ${mk}.` : 'La ciudad.', what: 'Nadie sabe qué significa. Mejor no pensarlo.' };
    if (!ev) return { more: n.more || '', who: mk || 'A nadie: es una noticia de la ciudad.', what: mk ? (n.tone === 'neg' ? 'Ya ha pasado: el precio ha bajado.' : n.tone === 'pos' ? 'Ya ha pasado: el precio ha subido.' : 'Ya ha pasado.') : 'Nada. No mueve ningún mercado.' };
    if (n.kind === 'result') return { more: ev.more || '', who: mk, what: n.tone === 'neg' ? 'Ya se sabe: el precio ha bajado.' : 'Ya se sabe: el precio ha subido.' };
    const what = ev.kind === 'shock' ? (ev.tone === 'pos' ? 'Un salto hacia arriba en las próximas velas.' : 'Un golpe hacia abajo en las próximas velas.')
      : ev.kind === 'trend' ? (ev.trend > 0 ? 'Empuja el precio hacia arriba durante un buen rato.' : 'Empuja el precio hacia abajo durante un buen rato.')
        : ev.kind === 'vol' ? 'El precio se va a mover mucho, arriba y abajo. Cuidado con apostar fuerte.'
          : `Se sabrá en unas velas. Si pasa ("${ev.yesText}"), ${mk} ${up(ev.yes)}. Si no ("${ev.noText}"), ${up(ev.no)}.`;
    return { more: ev.more || '', who: mk, what };
  }
  function tag(n) {
    if (n.cipher) return { cls: 'dark', text: '¿ERRATA?' };
    if (n.dark) return { cls: 'dark', text: 'SUCESOS' };
    const where = n.market ? D.marketLabel(n.market) : 'CIUDAD';
    return { cls: n.tone, text: `${n.tone === 'pos' ? '▲ ' : n.tone === 'neg' ? '▼ ' : ''}${where}` };
  }

  function buildNews(body) {
    const run = S.run;
    const news = run ? run.news.slice().reverse() : [];
    const today = run ? `Día ${run.day} · ${D.sim.turnNames[run.turn]}` : '';
    body.insertAdjacentHTML('beforeend', `<div class="np-mast">EL DIARIO DEL FUTURO</div>
      <div class="np-sub"><span>${today}</span><span>Edición de la ciudad</span><span>$1</span></div>`);
    // Si hay pocas noticias del mercado, la ciudad rellena el periódico (nunca sale vacío)
    const filler = D.story.fillerNews.filter((n) => !n.minDark).map((n) => Object.assign({ day: 1, turn: 0, filler: true }, n));
    const items = news.slice(0, 31);
    for (let i = 0; items.length < 5 && i < filler.length; i++) items.push(filler[i]);
    const dark = SN.UI.darkLevel();
    // Las "erratas" están escritas en el idioma secreto: se leen según las letras que conoces
    const title = (n) => (n.cipher ? SN.Cipher.html((D.cipher.news.find((c) => c.id === n.cipher) || {}).text || '', SN.UI.freshLetter) : n.title);
    // La errata del tutorial ("no es relevante"): su foto esconde la primera letra
    const errata = (n, photo) => {
      if (n.cipher !== 'tuto') return;
      photo.classList.add('clue');
      photo.addEventListener('click', (e) => { e.stopPropagation(); if (!SN.Tutorial.active) SN.Cipher.discover('errata'); });
    };
    // Una noticia elegida (clic): PRIMERA PLANA
    const focus = W.newsFocus && items.find((x) => x === W.newsFocus || (x.filler && W.newsFocus.filler && x.title === W.newsFocus.title));
    if (focus) { buildFront(body, focus, dark, title); return; }
    const pick = (n) => (e) => { e.stopPropagation(); W.newsFocus = n; SN.Audio.sfx('select'); W.refresh(); };
    const [top, ...rest] = items;
    // Portada: la noticia más reciente, con foto grande
    const hero = U.el('div', 'np-hero' + (top.dark ? ' dark' : '') + (top.cipher ? ' cipher' : ''));
    hero.title = 'Clic: leer la noticia entera';
    hero.addEventListener('click', pick(top));
    const heroPhoto = SN.NewsArt.node(artFor(top), top.tone || 'neu', top.dark || top.cipher ? dark : 0, null, { sticker: stickerOf(top) });
    hero.appendChild(heroPhoto);
    errata(top, heroPhoto);
    const tg = tag(top);
    hero.insertAdjacentHTML('beforeend', `<div><span class="np-tag ${tg.cls}">${tg.text}</span> <span class="w">${when(top)}</span>
      <div class="h">${title(top)}</div><div class="t">${top.text || ''}</div></div>`);
    body.appendChild(hero);
    // El resto, en dos columnas con foto pequeña
    const grid = U.el('div', 'np-grid');
    for (const n of rest) {
      const it = U.el('div', 'np-item' + (n.dark ? ' dark' : '') + (n.cipher ? ' cipher' : ''));
      it.title = 'Clic: leer la noticia entera';
      it.addEventListener('click', pick(n));
      const photo = SN.NewsArt.node(artFor(n), n.tone || 'neu', n.dark || n.cipher ? dark : 0, [48, 30], { sticker: stickerOf(n) });
      it.appendChild(photo);
      errata(n, photo);
      it.insertAdjacentHTML('beforeend', `<div><div class="w">${when(n)}</div><div>${title(n)}</div></div>`);
      grid.appendChild(it);
    }
    body.appendChild(grid);
    body.insertAdjacentHTML('beforeend', '<div class="np-ad">Publicidad · <b>Pleyzeta 6 Ultra</b> · ahora también a plazos. Muchos plazos.</div>');
  }

  // PRIMERA PLANA de una noticia: la foto grande y a color, y lo que significa
  function buildFront(body, n, dark, title) {
    const info = newsInfo(n), tg = tag(n), def = n.market ? D.marketById(n.market) : null;
    const fr = U.el('div', 'np-front' + (n.dark ? ' dark' : '') + (n.cipher ? ' cipher' : ''));
    const ph = n.dark || n.cipher ? SN.NewsArt.node(artFor(n), n.tone || 'neu', dark) : SN.NewsArt.node(artFor(n), n.tone || 'neu', 0, null, { color: true, sticker: stickerOf(n) });
    fr.appendChild(ph);
    if (n.cipher === 'tuto') { ph.classList.add('clue'); ph.addEventListener('click', (e) => { e.stopPropagation(); if (!SN.Tutorial.active) SN.Cipher.discover('errata'); }); }
    const st = stickerOf(n);
    const arrow = st ? { up: '<b class="up">▲ sube</b>', down: '<b class="down">▼ baja</b>', rumor: '<b class="mid">? puede subir o bajar</b>', vol: '<b class="mid">≈ se mueve mucho</b>' }[st.sym] : '';
    const who = def ? `<i class="np-ico"></i>${info.who} ${arrow}` : info.who;
    fr.insertAdjacentHTML('beforeend', `<div class="np-fcol"><span class="np-tag ${tg.cls}">${tg.text}</span> <span class="w">${when(n)}</span>
      <div class="h">${title(n)}</div><div class="t">${n.text || ''}</div>${info.more ? `<div class="more">${info.more}</div>` : ''}
      <div class="np-box"><b>¿A quién afecta?</b>${who}</div><div class="np-box"><b>¿Qué puede pasar?</b>${info.what}</div></div>`);
    const ico = fr.querySelector('.np-ico');
    if (ico && def) ico.appendChild(SN.Sprites.node(def.icon, 1));
    body.appendChild(fr);
    const back = U.el('button', 'btn btn-cream np-back', '◀ Volver');
    back.addEventListener('click', (e) => { e.stopPropagation(); W.newsFocus = null; SN.Audio.sfx('select'); W.refresh(); });
    body.appendChild(back);
  }

  // ---------- La tienda ----------
  // Se puede mirar siempre. Los objetos clave van en orden: el que toca tiene su oferta de FUTURO.exe
  // esperando (un poco hoy y el resto después), que también salta sola al pagar la deuda anterior.
  function buildShop(body) {
    const run = S.run;
    body.appendChild(U.el('div', 'win-note', 'Mira lo que quieras. Los objetos clave van en orden: FUTURO.exe te avisa cuando toca el siguiente.'));
    body.appendChild(U.el('div', 'sec-title', 'Objetos clave'));
    const pending = SN.Unlocks.pendingItem();
    for (const it of D.keyItems) {
      const can = SN.Unlocks.canBuyItem(it.id);
      const owned = !!run.owned[it.id];
      const row = U.el('div', 'shop-row key' + (owned ? ' owned' : can.locked ? ' locked' : ''));
      row.dataset.item = it.id;
      row.appendChild(icon(owned ? 'trebol' : 'caja'));
      const o = SN.Unlocks.offer(it);
      const desc = owned ? 'En tu habitación' : can.locked ? can.reason.charAt(0) + can.reason.slice(1).toLowerCase() : `${it.desc} Oferta: ${U.money(o.now)} hoy.`;
      row.insertAdjacentHTML('beforeend', `<div class="t">${it.name}</div><div class="d">${desc}</div>`);
      if (!owned && !can.locked && pending && pending.id === it.id) {
        const b = U.el('button', 'btn btn-cyan', 'Ver oferta');
        b.disabled = !!run.position;
        b.addEventListener('click', (e) => { e.stopPropagation(); W.offer(it.id, 'shop'); });
        row.appendChild(b);
      }
      body.appendChild(row);
    }
    // Día de la suerte: la Ruleta de la Fortuna y el Mercado Dorado de Don Siete
    const luck = SN.Luck.today();
    if (luck && luck.events.includes('ruleta')) {
      const row = U.el('div', 'shop-row gold');
      row.appendChild(icon('coin0'));
      row.insertAdjacentHTML('beforeend', `<div class="t">★ Ruleta de la Fortuna</div><div class="d">${luck.spun ? 'Ya has girado hoy. Vuelve el próximo día de la suerte.' : 'Un giro gratis. Solo hoy.'}</div>`);
      if (!luck.spun) {
        const b = U.el('button', 'btn btn-yellow', 'Girar');
        b.disabled = !!run.position;
        b.addEventListener('click', (e) => { e.stopPropagation(); W.open('ruleta'); });
        row.appendChild(b);
      }
      body.appendChild(row);
    }
    const golden = SN.Luck.goldenToday();
    if (golden.length) {
      body.appendChild(U.el('div', 'sec-title gold', '★ Mercado Dorado de Don Siete'));
      for (const id of golden) buyRow(body, D.luck.golden.find((g) => g.id === id), 'gold');
    }
    const off = SN.Luck.discount();
    body.appendChild(U.el('div', 'sec-title', off ? `Estilo de vida · Don Siete rebaja un ${Math.round(off * 100)}%` : 'Estilo de vida'));
    for (const it of D.shop) buyRow(body, it, '', off);
  }

  // Una fila de la tienda que se compra con dinero (estilo de vida y objetos dorados): aparece en tu cuarto
  function buyRow(body, it, cls, discount = 0) {
    const run = S.run, owned = !!run.owned[it.id];
    const price = Math.round(it.price * (1 - discount));
    const row = U.el('div', 'shop-row' + (owned ? ' owned' : '') + (cls ? ' ' + cls : ''));
    row.appendChild(icon(owned ? 'trebol' : cls === 'gold' ? 'coin0' : 'caja'));
    row.insertAdjacentHTML('beforeend', `<div class="t">${it.name}</div><div class="d">${owned ? 'En tu habitación' : it.desc}</div>`);
    if (!owned) {
      const b = U.el('button', 'btn btn-yellow', discount ? `<s>${U.short(it.price)}</s> ${U.short(price)}` : U.short(price));
      b.disabled = run.capital - price < D.sim.bankruptcyThreshold || !!run.position;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (run.position || run.capital - price < D.sim.bankruptcyThreshold || !SN.Economy.spend(price, 'shop')) { SN.Audio.sfx('error'); return; }
        run.owned[it.id] = true;
        SN.Desk.dirty();
        SN.Audio.sfx(cls === 'gold' ? 'lucky' : 'pay');
        SN.FX.confetti(30);
        SN.Hands.celebrate();
        SN.Save.saveRun();
        W.refresh();
      });
      row.appendChild(b);
    }
    body.appendChild(row);
  }

  // ---------- La Ruleta de la Fortuna (días de la suerte) ----------
  // Primero gira (la casilla ya está elegida) y al pararse entrega el premio.
  const WHEEL_COLORS = ['#FFD34E', '#3F2F60', '#45E3DA', '#3DDC84', '#FF4F6D', '#FF8F3F', '#A880FF', '#FFF0A3'];
  function drawWheel(c, angle) {
    const g = c.getContext('2d'), n = D.luck.wheel.length, r = 44, cx = 48, cy = 48;
    g.clearRect(0, 0, 96, 96);
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(cx, cy);
      g.arc(cx, cy, r, angle + i * Math.PI * 2 / n, angle + (i + 1) * Math.PI * 2 / n);
      g.closePath(); g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; g.fill();
      g.strokeStyle = '#0E0A1C'; g.lineWidth = 2; g.stroke();
      const mid = angle + (i + 0.5) * Math.PI * 2 / n;
      SN.Px.text(g, String(i + 1), cx + Math.cos(mid) * 30, cy + Math.sin(mid) * 30 + 3, '#0E0A1C', { align: 'center' });
    }
    g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fillStyle = '#0E0A1C'; g.fill();
    g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fillStyle = '#FFD34E'; g.fill();
  }
  // La casilla que queda bajo la flecha (arriba) con la ruleta girada `angle`
  function wedgeAt(angle) {
    const n = D.luck.wheel.length, step = Math.PI * 2 / n;
    const a = ((-Math.PI / 2 - angle) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
    return Math.floor(a / step) % n;
  }
  function buildWheel(body) {
    const luck = SN.Luck.today();
    body.innerHTML = `<div class="rl"><div class="rl-wheel"><b class="rl-arrow">▼</b><canvas width="96" height="96"></canvas></div>
      <div class="rl-side"><div class="rl-now">Hoy es día de la suerte</div><ol class="rl-list">${D.luck.wheel.map((w) => `<li>${w.label}</li>`).join('')}</ol>
      <button class="btn btn-yellow rl-go">¡Girar!</button><div class="rl-res"></div></div></div>`;
    const c = body.querySelector('canvas'), now = body.querySelector('.rl-now'), list = body.querySelectorAll('.rl-list li');
    let angle = 0;
    const show = () => { drawWheel(c, angle); const i = wedgeAt(angle); now.textContent = `▲ ${D.luck.wheel[i].label}`; list.forEach((li, k) => li.classList.toggle('on', k === i)); };
    show();
    const go = body.querySelector('.rl-go');
    if (!luck || luck.spun) { go.disabled = true; body.querySelector('.rl-res').textContent = 'Ya has girado hoy.'; return; }
    go.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = SN.Luck.pick();
      if (!p) { SN.Audio.sfx('error'); return; }
      go.disabled = true;
      SN.Save.saveRun();
      // Vueltas y frenada hasta dejar la casilla elegida bajo la flecha
      const n = D.luck.wheel.length, step = Math.PI * 2 / n;
      const target = -Math.PI / 2 - (p.index + 0.2 + Math.random() * 0.6) * step - Math.PI * 2 * 5;
      const from = angle, dur = 3.2;
      let t = 0, last = wedgeAt(angle);
      const finish = () => {
        const res = Object.assign(p, SN.Luck.apply(p.id, SN.Luck.k()));
        SN.Events.emit('luck:spin', res);
        SN.Save.saveRun();
        const bad = p.id === 'maldita' || p.id === 'nada';
        SN.Audio.sfx(bad ? 'error' : 'lucky');
        if (!bad) SN.FX.confetti(40);
        const out = body.querySelector('.rl-res');
        if (out) out.innerHTML = `<b>${p.label}</b> ${res.text || ''}`;
        SN.UI.renderAll();
      };
      const tick = () => {
        // Si se cierra la ventana a mitad de giro, el premio se entrega igual
        if (!W.win || W.current !== 'ruleta') { finish(); return; }
        t = Math.min(1, t + 1 / 60 / dur);
        angle = U.lerp(from, target, U.ease.outCubic(t));
        const i = wedgeAt(angle);
        if (i !== last) { last = i; SN.Audio.sfx('wheel'); }
        show();
        if (t < 1) { requestAnimationFrame(tick); return; }
        finish();
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- La oferta de FUTURO.exe ----------
  // El mismo objeto por un 10% hoy... y la letra pequeña. Salta sola al pagar la deuda anterior (y cuando te
  // llega para la entrada, y cada mañana que siga pendiente); también se abre desde la tienda o el HUD.
  // "No, gracias" la cierra: el objeto sigue esperando en la tienda.
  function buildOffer(body) {
    const it = D.keyItemById(W.opts.item);
    if (!it) { W.close(true); return; }
    const o = SN.Unlocks.offer(it), st = D.story.offer, run = S.run;
    const fill = (t) => t.replace('{item}', it.name).replace(/\{now\}/g, U.money(o.now)).replace('{debt}', U.money(o.debt)).replace('{days}', o.days);
    const can = SN.Unlocks.canBuyItem(it.id);
    const short = !can.ok && can.short ? `<div class="of-short">${st.short.replace('{need}', U.money(o.need)).replace('{left}', U.money(can.short))}</div>` : '';
    const pop = U.el('div', 'offer');
    pop.innerHTML = `<div class="of-head"><i class="of-ico"></i>${SN.Cipher.brand(true)}<span>${W.opts.why === 'insist' ? st.insist : 'Oferta encontrada'}</span></div>
      <div class="of-title">${st.title}</div>
      <div class="of-line">${fill(st.line)}</div>
      <div class="of-price"><s>${U.money(it.price)}</s><b>${U.money(o.now)}</b><em>${st.save}</em></div>
      <div class="of-later">${fill(st.later)}</div>
      <button class="of-small">${st.small} ▼</button>
      <div class="of-fine hidden">${fill(st.smallText)} <b class="cx of-clue" title="">${D.cipher.alphabet.D}</b></div>
      ${short}
      <div class="of-row"><button class="btn btn-yellow of-yes">${st.yes}</button><button class="btn btn-cream of-no">${st.no}</button></div>`;
    pop.querySelector('.of-ico').style.backgroundImage = `url(${SN.Sprites.url('app', 1)})`;
    const yes = pop.querySelector('.of-yes');
    yes.disabled = !can.ok || !!(run && run.position);
    if (!can.ok && can.reason) yes.title = can.reason;
    body.appendChild(pop);
    SN.FX.glitch(0.25, 0.8);
    pop.addEventListener('click', (e) => e.stopPropagation());
    pop.querySelector('.of-small').addEventListener('click', () => {
      pop.querySelector('.of-fine').classList.toggle('hidden');
      SN.Audio.sfx('select');
      SN.Events.emit('offer:fineprint', { item: it.id, el: pop.querySelector('.of-fine') });
    });
    pop.querySelector('.of-clue').addEventListener('click', () => SN.Cipher.discover('letra'));
    pop.querySelector('.of-no').addEventListener('click', () => { W.close(); SN.Events.emit('offer:declined', { item: it.id }); });
    yes.addEventListener('click', () => { if (SN.Unlocks.canBuyItem(it.id).ok) SN.Game.buyKeyItem(it.id); else SN.Audio.sfx('error'); });
  }
  // Compatibilidad: abrir la oferta de un objeto
  W.showOffer = (it) => W.offer(it.id || it, 'shop');

  // "Acerca de FUTURO.exe" (clic en el icono de la barra de título): créditos... y el sello con la F
  function buildAbout(body) {
    const found = SN.Cipher.found('acerca');
    body.innerHTML = `<div class="ab"><div class="ab-logo"></div><div class="ab-txt">
      <b>${SN.Cipher.brand(true)}</b> versión 6.6.6<br>
      Licencia: perpetua. No se puede cerrar.<br>
      © Futuro S.L. Todos los derechos reservados. También los tuyos.<br>
      Programa recomendado por: un amigo con capucha.</div>
      <button class="ab-seal${found ? ' read' : ''}" title="">${found ? '<b class="cx-k">F</b>' : `<b class="cx">${D.cipher.alphabet.F}</b>`}</button></div>`;
    body.querySelector('.ab-logo').appendChild(SN.Sprites.node('appBig', 2));
    body.querySelector('.ab-seal').addEventListener('click', (e) => { e.stopPropagation(); SN.Cipher.discover('acerca'); W.refresh(); });
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
