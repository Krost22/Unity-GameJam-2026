// Ventanas modales dentro del monitor: TIENDA (con las mejoras y la Academia), NOTICIAS (un periódico con fotos), AJUSTES,
// y la OFERTA de FUTURO.exe (que salta sola, sin pasar por la tienda).
(function (SN) {
  'use strict';
  const U = SN.Util, S = SN.State, D = SN.Data, T = SN.T;

  // 'upgrades' es ahora la Academia de Bravo Fines (se entra desde la Tienda: todo se compra allí)
  const TITLES = { upgrades: T('Tienda · Academia de Bravo Fines'), news: T('Noticias'), shop: T('Tienda · MEGATIENDA.COM'), settings: T('Ajustes'), offer: '', pact: '', about: T('Acerca de FUTURO.exe') };

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
      // Al entrar, Destacados enseña el objeto clave de la historia (o lo que se pida: { cat, sel })
      if (kind === 'shop') { this.shopSel = opts.sel || null; if (opts.cat) this.shopCat = opts.cat; }
      const layer = document.getElementById('layer-windows');
      this.back = U.el('div', 'win-back');
      // La oferta de FUTURO.exe es el siguiente paso de la historia: no se cierra pulsando fuera
      if (kind !== 'offer') this.back.addEventListener('click', () => this.close());
      this.win = U.el('div', 'win' + (kind === 'news' ? ' wide paper' : kind === 'offer' ? ' offer-win' : kind === 'pact' ? ' offer-win pact-win' : kind === 'shop' ? ' big sh-win' : ''));
      if (kind === 'offer' || kind === 'pact') this.win.innerHTML = '<div class="win-body"></div>';
      else {
        this.win.innerHTML = `<div class="win-head"><span>${TITLES[kind]}</span><button class="win-x">X<kbd>ESC</kbd></button></div><div class="win-body"></div>`;
        SN.KW.apply(this.win.querySelector('.win-head span'), { terms: false });
        this.win.querySelector('.win-x').addEventListener('click', () => this.close());
      }
      layer.appendChild(this.back);
      layer.appendChild(this.win);
      document.getElementById('screen').classList.toggle('paper-open', kind === 'news');
      SN.Audio.sfx(kind === 'offer' ? 'notify' : 'open');
      this.refresh();
      SN.Events.emit('window:opened', { kind });
      if (kind === 'news' && S.run) { S.run.newsSeen = S.run.news.length; SN.Events.emit('news:read'); }
      if ((kind === 'upgrades' || kind === 'shop') && S.run && SN.ShopWatch) { SN.ShopWatch.markSeen('shop'); SN.Events.emit('shop:seen', { kind: 'shop' }); }
    },
    // La oferta de FUTURO.exe de un objeto clave
    offer(id, why = 'shop') { this.open('offer', { item: id, why }); },

    close(silent) {
      if (!this.current) return;
      const win = this.win, back = this.back;
      this.current = null;
      this.win = this.back = null;
      if (!silent) SN.Audio.sfx('close');
      document.getElementById('screen').classList.remove('paper-open');
      back.remove();
      win.classList.add('closing');
      SN.after(0.16, () => win.remove());
      SN.Events.emit('window:closed');
    },

    refresh() {
      if (!this.win) return;
      const body = this.win.querySelector('.win-body');
      body.innerHTML = '';
      ({ upgrades: buildUpgrades, news: buildNews, shop: buildShop, settings: buildSettings, offer: buildOffer, pact: buildPact, about: buildAbout })[this.current](body);
      // Palabras clave con color y FUTURO.exe en el idioma secreto. En la tienda y las mejoras, solo dinero, 7 y
      // suerte: ahí cada nombre es una mejora o un regalo y, si todo se mueve, nada destaca
      SN.KW.apply(body, { terms: this.current !== 'shop' && this.current !== 'upgrades' });
    },
  };

  // La Academia de Bravo Fines, dentro de la Tienda (las mejoras se compran en la Tienda misma).
  // Un botón para volver a la Tienda y, debajo, el árbol de la Academia.
  function buildUpgrades(body) {
    if (!(SN.Academy && SN.Academy.open())) { SN.after(0, () => W.open('shop')); return; }
    W.win.classList.add('big', 'ac-win');
    const tabs = U.el('div', 'up-tabs');
    const back = U.el('button', 'up-tab', T('◀ Tienda'));
    back.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('select'); W.open('shop'); });
    tabs.appendChild(back);
    tabs.appendChild(U.el('button', 'up-tab on ac', T('Academia de Bravo Fines')));
    body.appendChild(tabs);
    buildAcademy(body);
  }

  // ---------- La Academia de Bravo Fines: árbol de habilidades (js/data/academy.js) ----------
  // Encabezado con Bravo, navegación por ramas, las tres ramas con sus nodos unidos por líneas, el detalle
  // del nodo elegido y, abajo, el progreso. Todo sale de SN.Academy: aquí solo se pinta.
  const AC_NAV = [['arbol', T('Árbol'), 'estrella'], ['negocios', T('Negocios'), 'tienda'], ['trading', T('Trading'), 'grafica'], ['contactos', T('Contactos'), 'contacto']];
  const AC_BRANCH = { negocios: ['tienda', T('Dinero cada día')], trading: ['grafica', T('Mejora tus apuestas')], contactos: ['contacto', T('Ayudas y amigos')] };
  const cap1 = (t) => t.charAt(0) + t.slice(1).toLowerCase();
  // El efecto de un nodo, en palabras (sale de sus datos: income, bonus, halve, offer)
  function acEffect(n) {
    if (n.soon) return T('Próximamente');
    if (n.income) return T('+{v} al día', { v: U.money(n.income) });
    if (n.bonus) return T('+{n}% en cada ganancia', { n: Math.round(n.bonus * 100) });
    if (n.halve) return T('1ª pérdida del día, a la mitad');
    if (n.offer) return T('Ofertas: −{n}% de deuda', { n: Math.round((1 - n.offer) * 100) });
    return '';
  }
  // Icono de pixel art grande (los sprites de 12x12, al doble o al triple)
  function big(name, scale = 2) { const c = SN.Sprites.node(name, scale); c.classList.add('px-ico'); return c; }

  function buildAcademy(body) {
    const A = SN.Academy, data = D.academy, run = S.run;
    const view = W.acView || 'arbol';
    const all = A.nodes(), real = all.filter((n) => !n.soon);
    if (!W.acSel || !A.node(W.acSel)) W.acSel = (all.find((n) => A.canBuy(n.id).ok) || all.find((n) => !A.has(n.id) && !n.soon) || all[0]).id;
    const box = U.el('div', 'ac');

    // Encabezado: Bravo, sus negocios y tu dinero
    const head = U.el('div', 'ac-top');
    const ava = U.el('i', 'ac-ava');
    ava.appendChild(SN.Chars.bravoFace());
    head.appendChild(ava);
    head.insertAdjacentHTML('beforeend', `<div class="ac-ttl"><b>${T('Academia de Bravo Fines')}</b><span>${T('"El dinero no se gana. Se manifiesta."')}</span></div>
      <div class="ac-inc"><span>${T('Negocios')}</span><b>${T('+{v}/día', { v: U.money(A.income()) })}</b></div>
      <div class="ac-cash"><i></i><div><span>${T('Tu dinero')}</span><b>${U.money(run.capital)}</b></div></div>`);
    head.querySelector('.ac-cash i').appendChild(big('estrella', 1));
    box.appendChild(head);

    // Navegación lateral: todo el árbol o una rama
    const nav = U.el('div', 'ac-nav');
    for (const [id, label, ic] of AC_NAV) {
      const b = U.el('button', 'ac-nb' + (view === id ? ' on' : ''));
      b.dataset.view = id;
      b.appendChild(big(ic, 1));
      b.insertAdjacentHTML('beforeend', `<span>${label}</span>`);
      b.addEventListener('click', (e) => { e.stopPropagation(); if (W.acView === id) return; W.acView = id; W.acAnim = true; SN.Audio.sfx('select'); W.refresh(); });
      nav.appendChild(b);
    }
    box.appendChild(nav);

    // Las ramas: una fila cada una, con los nodos unidos por líneas (se encienden al comprar el anterior)
    const tree = U.el('div', 'ac-tree' + (W.acAnim ? ' in' : ''));
    W.acAnim = false;
    for (const br of data.branches) {
      if (view !== 'arbol' && view !== br.id) continue;
      const row = U.el('div', 'ac-br ' + br.color);
      const [bic, bdesc] = AC_BRANCH[br.id] || ['estrella', ''];
      const lab = U.el('div', 'ac-bl');
      lab.appendChild(big(bic, 1));
      lab.insertAdjacentHTML('beforeend', `<b>${br.name}</b><span>${bdesc}</span>`);
      row.appendChild(lab);
      br.nodes.forEach((n, i) => {
        if (i) row.appendChild(U.el('i', 'ac-ln' + (A.has(br.nodes[i - 1].id) ? ' on' : '')));
        const can = A.canBuy(n.id), own = A.has(n.id);
        const st = own ? 'own' : n.soon ? 'soon' : can.ok ? 'can' : 'locked';
        const el = U.el('button', `ac-n ${st}${W.acSel === n.id ? ' sel' : ''}${W.acBump === n.id ? ' bump' : ''}${W.acDone === n.id ? ' done' : ''}`);
        el.dataset.node = n.id;
        el.title = n.name;
        el.appendChild(big(n.icon, 2));
        if (st === 'soon' || (st === 'locked' && can.locked)) { const l = SN.Sprites.node('lock', 1); l.className = 'ac-lock'; el.appendChild(l); }
        el.insertAdjacentHTML('beforeend', `<em>${n.soon ? '···' : own ? '1/1' : '0/1'}</em>`);
        el.addEventListener('click', (e) => { e.stopPropagation(); W.acSel = n.id; W.acBump = n.id; SN.Audio.sfx('select'); W.refresh(); });
        row.appendChild(el);
      });
      tree.appendChild(row);
    }
    // Con una sola rama a la vista, debajo, la lista de sus avances con su efecto y su precio
    if (view !== 'arbol') {
      const br = data.branches.find((b) => b.id === view);
      const list = U.el('div', 'ac-list');
      for (const n of br.nodes) {
        const p = U.el('p', A.has(n.id) ? 'own' : n.soon ? 'soon' : '', `<b>${n.name}</b> · ${acEffect(n)}${n.soon ? '' : ` · ${A.has(n.id) ? T('Tuyo') : U.money(n.cost)}`}`);
        p.addEventListener('click', (e) => { e.stopPropagation(); W.acSel = n.id; W.acBump = n.id; SN.Audio.sfx('select'); W.refresh(); });
        list.appendChild(p);
      }
      tree.appendChild(list);
    }
    box.appendChild(tree);

    // Detalle del nodo elegido
    const n = A.node(W.acSel), can = A.canBuy(n.id), own = A.has(n.id);
    const det = U.el('div', 'ac-dt' + (W.acBump === n.id ? ' bump' : ''));
    det.innerHTML = `<div class="ac-dh">${T('Detalle')}</div><div class="ac-dico"></div><b class="ac-dn">${n.name}</b>
      <span class="ac-dl">${n.soon ? T('Próximamente') : T('Nv. {a} / {b}', { a: own ? 1 : 0, b: 1 })}</span><p class="ac-dd">${n.desc}</p>
      ${own ? `<div class="ac-de"><span>${T('Efecto actual:')}</span><b>${acEffect(n)}</b></div>` : n.soon ? '' : `<div class="ac-de nx"><span>${T('Efecto actual: <i>ninguno</i>')}</span><span>${T('Al comprarlo:')}</span><b>${acEffect(n)}</b></div>`}`;
    det.querySelector('.ac-dico').appendChild(big(n.soon ? 'lock' : n.icon, 2));
    if (!own && !n.soon) {
      const b = U.el('button', 'btn btn-yellow ac-buy', T('Comprar {v}', { v: U.money(n.cost) }));
      b.disabled = !can.ok;
      if (!can.ok && can.reason) { b.title = can.reason; det.insertAdjacentHTML('beforeend', `<div class="ac-why">${cap1(can.reason)}</div>`); }
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!A.buy(n.id)) { SN.Audio.sfx('error'); return; }
        SN.Audio.sfx('unlock');
        const p = SN.UI.posIn(b);
        SN.FX.burst(p.x + p.w / 2, p.y, { n: 22, colors: [SN.PAL.yellow, SN.PAL.green, SN.PAL.creamL] });
        SN.FX.ring(p.x + p.w / 2, p.y + 5, SN.PAL.yellow, 46);
        SN.Save.saveRun();
        W.acDone = n.id;
        W.acSel = null;
        W.refresh();
      });
      det.appendChild(b);
    } else det.insertAdjacentHTML('beforeend', `<div class="ac-why${own ? ' ok' : ''}">${own ? T('Ya es tuyo.') : T('Llegará en una versión futura.')}</div>`);
    box.appendChild(det);

    // Abajo: el progreso de la Academia y lo siguiente que llegará a esa rama
    const done = real.filter((x) => A.has(x.id)).length;
    const pct = Math.round(done / Math.max(1, real.length) * 100);
    const br = data.branches.find((b) => b.id === (view !== 'arbol' ? view : n.branch)) || data.branches[0];
    const next = br.nodes.find((x) => x.soon);
    const bar = U.el('div', 'ac-bot');
    bar.innerHTML = `<div class="ac-prog"><i class="ac-pi"></i><div class="ac-pt"><b>${T('Progreso')}</b><div class="ac-bar"><i style="width:${pct}%"></i></div></div><em>${done} / ${real.length}</em></div>
      <div class="ac-rew"><div class="ac-rt"><b>${T('Siguiente en {name}', { name: br.name })}</b><span>${next ? T('{name} (pronto)', { name: next.name }) : T('Rama completa')}</span></div><i class="ac-ri"></i></div>`;
    bar.querySelector('.ac-pi').appendChild(big('estrella', 1));
    bar.querySelector('.ac-ri').appendChild(big('cofre', 1));
    if (W.acPct != null && W.acPct !== pct) bar.querySelector('.ac-bar i').classList.add('grow');
    W.acPct = pct;
    box.appendChild(bar);
    body.appendChild(box);
    W.acBump = null;
    W.acDone = null;
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
  function when(n) { return n.filler ? T('En la ciudad') : T('Día {d} · {t}', { d: n.day, t: D.sim.turnNames[n.turn] || '' }); }
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
    if (n.cipher) return { more: T('Está escrita con unas letras que nadie sabe leer. El periódico dice que es una errata.'), who: T('Nadie lo sabe.'), what: T('No se puede leer. Todavía.') };
    if (n.dark) return { more: T('Pasó justo después de tu operación. Seguro que es casualidad.'), who: mk ? T('La ciudad. Justo donde ganaste: {mk}.', { mk }) : T('La ciudad.'), what: T('Nadie sabe qué significa. Mejor no pensarlo.') };
    if (!ev) return { more: n.more || '', who: mk || T('A nadie: es una noticia de la ciudad.'), what: mk ? (n.tone === 'neg' ? T('Ya ha pasado: el precio ha bajado.') : n.tone === 'pos' ? T('Ya ha pasado: el precio ha subido.') : T('Ya ha pasado.')) : T('Nada. No mueve ningún mercado.') };
    if (n.kind === 'result') return { more: ev.more || '', who: mk, what: n.tone === 'neg' ? T('Ya se sabe: el precio ha bajado.') : T('Ya se sabe: el precio ha subido.') };
    const what = ev.kind === 'shock' ? (ev.tone === 'pos' ? T('Un salto hacia arriba en las próximas velas.') : T('Un golpe hacia abajo en las próximas velas.'))
      : ev.kind === 'trend' ? (ev.trend > 0 ? T('Empuja el precio hacia arriba durante un buen rato.') : T('Empuja el precio hacia abajo durante un buen rato.'))
        : ev.kind === 'vol' ? T('El precio se va a mover mucho, arriba y abajo. Cuidado con apostar fuerte.')
          : T('Se sabrá en unas velas.') + ' ' +
            (ev.yes >= 0 ? T('Si pasa ("{t}"), {mk} sube.', { t: ev.yesText, mk }) : T('Si pasa ("{t}"), {mk} baja.', { t: ev.yesText, mk })) + ' ' +
            (ev.no >= 0 ? T('Si no ("{t}"), sube.', { t: ev.noText }) : T('Si no ("{t}"), baja.', { t: ev.noText }));
    return { more: ev.more || '', who: mk, what };
  }
  function tag(n) {
    if (n.cipher) return { cls: 'dark', text: T('¿ERRATA?') };
    if (n.dark) return { cls: 'dark', text: T('SUCESOS') };
    const where = n.market ? D.marketLabel(n.market) : T('CIUDAD');
    return { cls: n.tone, text: `${n.tone === 'pos' ? '▲ ' : n.tone === 'neg' ? '▼ ' : ''}${where}` };
  }

  function buildNews(body) {
    const run = S.run;
    const news = run ? run.news.slice().reverse() : [];
    const today = run ? T('Día {d} · {t}', { d: run.day, t: D.sim.turnNames[run.turn] }) : '';
    body.insertAdjacentHTML('beforeend', `<div class="np-mast">${T('EL DIARIO DEL FUTURO')}</div>
      <div class="np-sub"><span>${today}</span><span>${T('Edición de la ciudad')}</span><span>$1</span></div>`);
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
    hero.title = T('Clic: leer la noticia entera');
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
      it.title = T('Clic: leer la noticia entera');
      it.addEventListener('click', pick(n));
      const photo = SN.NewsArt.node(artFor(n), n.tone || 'neu', n.dark || n.cipher ? dark : 0, [48, 30], { sticker: stickerOf(n) });
      it.appendChild(photo);
      errata(n, photo);
      it.insertAdjacentHTML('beforeend', `<div><div class="w">${when(n)}</div><div>${title(n)}</div></div>`);
      grid.appendChild(it);
    }
    body.appendChild(grid);
    body.insertAdjacentHTML('beforeend', `<div class="np-ad">${T('Publicidad · <b>Pleyzeta 6 Ultra</b> · ahora también a plazos. Muchos plazos.')}</div>`);
  }

  // PRIMERA PLANA de una noticia: la foto grande y a color, y lo que significa
  function buildFront(body, n, dark, title) {
    const info = newsInfo(n), tg = tag(n), def = n.market ? D.marketById(n.market) : null;
    const fr = U.el('div', 'np-front' + (n.dark ? ' dark' : '') + (n.cipher ? ' cipher' : ''));
    const ph = n.dark || n.cipher ? SN.NewsArt.node(artFor(n), n.tone || 'neu', dark) : SN.NewsArt.node(artFor(n), n.tone || 'neu', 0, null, { color: true, sticker: stickerOf(n) });
    fr.appendChild(ph);
    if (n.cipher === 'tuto') { ph.classList.add('clue'); ph.addEventListener('click', (e) => { e.stopPropagation(); if (!SN.Tutorial.active) SN.Cipher.discover('errata'); }); }
    const st = stickerOf(n);
    const arrow = st ? { up: `<b class="up">${T('▲ sube')}</b>`, down: `<b class="down">${T('▼ baja')}</b>`, rumor: `<b class="mid">${T('? puede subir o bajar')}</b>`, vol: `<b class="mid">${T('≈ se mueve mucho')}</b>` }[st.sym] : '';
    const who = def ? `<i class="np-ico"></i>${info.who} ${arrow}` : info.who;
    fr.insertAdjacentHTML('beforeend', `<div class="np-fcol"><span class="np-tag ${tg.cls}">${tg.text}</span> <span class="w">${when(n)}</span>
      <div class="h">${title(n)}</div><div class="t">${n.text || ''}</div>${info.more ? `<div class="more">${info.more}</div>` : ''}
      <div class="np-box"><b>${T('¿A quién afecta?')}</b>${who}</div><div class="np-box"><b>${T('¿Qué puede pasar?')}</b>${info.what}</div></div>`);
    const ico = fr.querySelector('.np-ico');
    if (ico && def) ico.appendChild(SN.Sprites.node(def.icon, 1));
    body.appendChild(fr);
    const back = U.el('button', 'btn btn-cream np-back', T('◀ Volver'));
    back.addEventListener('click', (e) => { e.stopPropagation(); W.newsFocus = null; SN.Audio.sfx('select'); W.refresh(); });
    body.appendChild(back);
  }

  // ---------- La tienda ----------
  // Una tienda de pixel art: cabecera con tu dinero, categorías a la izquierda, productos en el centro y el
  // detalle del producto elegido a la derecha. Todo sale de los sistemas de siempre (SN.Unlocks para los
  // objetos clave y su oferta, SN.Upgrades, SN.Luck, SN.ShopWatch): aquí solo cambia cómo se ve.
  // (los objetos clave, la historia, van antes que las mejoras)
  const SHOP_CATS = [['destacados', T('Destacados'), 'estrella'], ['clave', T('Objetos clave'), 'llave'], ['mejoras', T('Mejoras'), 'flecha'],
    ['estilo', T('Estilo de vida'), 'taza'], ['coleccion', T('Colección'), 'gema'], ['mercados', T('Mercados'), 'grafica'],
    ['academia', T('Academia'), 'tiburon']]; // la Academia de Bravo Fines (solo cuando se ha presentado)
  // Icono de cada producto (los de la tienda, los objetos clave y los dorados de Don Siete)
  const ITEM_ICON = { taza: 'taza', planta: 'planta', lampara: 'lampara', poster: 'poster', alfombrilla: 'alfombra', teclado: 'teclado',
    cascos: 'cascos', trofeo: 'toro', tele: 'tele', movil: 'movil', moto: 'moto', reloj: 'reloj', maneki: 'maneki', herradura: 'herradura',
    trebol4: 'trebol', billete7: 'billete' };

  // Un producto, con lo que se ve de él y lo que pasa al comprarlo. Devuelve null si no existe.
  function shopProduct(sel) {
    if (!sel) return null;
    const run = S.run, keep = D.sim.bankruptcyThreshold;
    if (sel.kind === 'life' || sel.kind === 'gold') {
      const it = (sel.kind === 'gold' ? D.luck.golden : D.shop).find((x) => x.id === sel.id);
      if (!it) return null;
      const off = sel.kind === 'life' ? SN.Luck.discount() : 0;
      const price = Math.round(it.price * (1 - off));
      const owned = !!run.owned[it.id];
      const today = sel.kind !== 'gold' || SN.Luck.goldenToday().includes(it.id);
      const poor = run.capital - price < keep;
      return { sel, icon: ITEM_ICON[it.id] || 'caja', name: it.name, desc: it.desc, price, old: off ? it.price : null,
        state: owned ? 'own' : !today ? 'locked' : poor ? 'poor' : 'can', note: owned ? T('En tu habitación') : !today ? T('Solo en días con 7') : poor ? T('No te alcanza') : '',
        action: owned || !today ? null : 'buy', gold: sel.kind === 'gold' };
    }
    if (sel.kind === 'up') {
      const d = SN.Upgrades.def(sel.id);
      if (!d) return null;
      const unlocked = SN.Upgrades.isUnlocked(d.id), lv = SN.Upgrades.level(d.id), next = SN.Upgrades.next(d.id), can = SN.Upgrades.canBuy(d.id);
      // A crédito: el precio que se ve es lo que se suma a tu deuda (con intereses); hoy no pagas nada
      const credit = next ? SN.Upgrades.creditCost(d.id) : null;
      return { sel, icon: d.icon, name: d.name, desc: unlocked ? d.desc : d.unlock.label || T('Bloqueado'), price: credit,
        level: T('Nv. {a} / {b}', { a: lv, b: d.levels.length }), effect: next ? d.effect(next.value) : unlocked ? T('{e} · máximo', { e: d.effect(SN.Upgrades.value(d.id)) }) : '',
        sub: unlocked && next ? T('A crédito: hoy $0 · {x}', { x: SN.Debt.active() ? T('se suma a tu deuda') : T('deuda nueva, {n} días', { n: D.credit.days }) }) : '',
        state: !unlocked ? 'locked' : !next ? 'own' : can.ok ? 'can' : 'poor', note: !unlocked ? T('Llega como "regalo"') : !next ? T('Al máximo') : can.ok ? '' : cap1(can.reason || T('TODAVÍA NO')),
        action: unlocked && next ? 'up' : null };
    }
    if (sel.kind === 'key') {
      const it = D.keyItemById(sel.id);
      if (!it) return null;
      const can = SN.Unlocks.canBuyItem(it.id), owned = !!run.owned[it.id], pend = SN.Unlocks.pendingItem();
      const o = SN.Unlocks.offer(it), mine = pend && pend.id === it.id;
      // Hoy no se paga nada: el precio que se ve es la deuda que deja
      return { sel, icon: ITEM_ICON[it.id], name: it.name, desc: it.desc, price: o.debt,
        state: owned ? 'own' : mine ? (can.ok ? 'can' : 'poor') : 'locked', note: owned ? T('En tu habitación') : can.reason ? cap1(can.reason) : '',
        action: mine ? 'offer' : null, sub: T('Hoy $0 · luego debes {v} en {n} días', { v: U.money(o.debt), n: o.days }) };
    }
    if (sel.kind === 'mkt') {
      const def = D.marketById(sel.id);
      if (!def) return null;
      const open = SN.Unlocks.isUnlocked(def.id);
      return { sel, icon: def.icon, name: def.name, desc: def.desc, info: T('Tope: ±{v} por apuesta', { v: U.money(def.cap) }),
        state: open ? 'own' : 'locked', note: open ? T('Abierto') : T('Se abre: {x}', { x: def.unlock.label || T('más adelante') }), action: null, short: D.marketLabel(def.id) };
    }
    return null;
  }

  // Lo que sale en cada categoría
  function shopList(cat) {
    const run = S.run;
    if (cat === 'mejoras') return D.upgrades.map((d) => ({ kind: 'up', id: d.id }));
    if (cat === 'clave') return D.keyItems.map((it) => ({ kind: 'key', id: it.id }));
    if (cat === 'estilo') return D.shop.map((it) => ({ kind: 'life', id: it.id }));
    if (cat === 'coleccion') return D.luck.golden.map((g) => ({ kind: 'gold', id: g.id }));
    if (cat === 'mercados') return D.markets.map((m) => ({ kind: 'mkt', id: m.id }));
    // Destacados: las ofertas del día (lo que ya se puede comprar; si no hay nada, lo más barato que falta)
    const out = [];
    for (const x of SN.ShopWatch.list()) {
      if (out.length >= 4) break;
      const [k, id] = x.key.split(':');
      if (k === 'shop') out.push({ kind: 'life', id });
      else if (k === 'gold') out.push({ kind: 'gold', id });
      else if (k === 'up') out.push({ kind: 'up', id });
    }
    for (const it of D.shop.filter((s) => !run.owned[s.id]).sort((a, b) => a.price - b.price)) {
      if (out.length >= 4) break;
      if (!out.some((o) => o.id === it.id)) out.push({ kind: 'life', id: it.id });
    }
    return out;
  }

  function buildShop(body) {
    const run = S.run;
    const cat = W.shopCat || 'destacados';
    const list = shopList(cat);
    const pend = SN.Unlocks.pendingItem();
    // El objeto clave por donde va la historia: el de la oferta pendiente o, si no, el siguiente que llegará
    const storyItem = pend || D.keyItems.find((it) => !run.owned[it.id]);
    // Lo elegido: en Destacados, al entrar, el objeto clave de la historia; si no, la primera tarjeta
    const inCat = (s) => s && (list.some((x) => x.kind === s.kind && x.id === s.id) || (cat === 'destacados' && s.kind === 'key'));
    if (!inCat(W.shopSel)) W.shopSel = cat === 'destacados' && storyItem ? { kind: 'key', id: storyItem.id } : list[0] || null;
    const box = U.el('div', 'sh');

    // Cabecera: carrito, título y tu dinero
    const head = U.el('div', 'sh-top');
    head.appendChild(big('cart', 2));
    head.insertAdjacentHTML('beforeend', `<div class="sh-ttl"><b>${T('Tienda')}</b><span>${T('Mejoras, objetos y caprichos que te acercan a la fortuna.')}</span></div>
      <div class="sh-cash${W.shopFlash ? ' flash' : ''}">${U.money(run.capital)}</div>`);
    W.shopFlash = false;
    box.appendChild(head);

    // Categorías
    const nav = U.el('div', 'sh-nav');
    for (const [id, label, ic] of SHOP_CATS) {
      if (id === 'academia' && !(SN.Academy && SN.Academy.open())) continue;
      const b = U.el('button', 'sh-nb' + (cat === id ? ' on' : ''));
      b.dataset.cat = id;
      b.appendChild(big(ic, 1));
      const n = id === 'academia' ? SN.Academy.buyable().length : 0;
      b.insertAdjacentHTML('beforeend', `<span>${label}</span>${n ? `<b class="badge">${n}</b>` : ''}`);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        SN.Audio.sfx('select');
        if (id === 'academia') { W.open('upgrades'); return; }
        if (W.shopCat === id) return;
        W.shopCat = id; W.shopSel = null; W.shopAnim = true; W.refresh();
      });
      nav.appendChild(b);
    }
    box.appendChild(nav);

    // Centro
    const main = U.el('div', 'sh-main' + (W.shopAnim ? ' in' : ''));
    W.shopAnim = false;
    const card = (sel) => {
      const p = shopProduct(sel);
      if (!p) return null;
      const on = W.shopSel && W.shopSel.kind === sel.kind && W.shopSel.id === sel.id;
      const c = U.el('button', `sh-card ${p.state}${on ? ' sel' : ''}${on && W.shopBump ? ' bump' : ''}${p.gold ? ' gold' : ''}`);
      c.dataset.kind = sel.kind; c.dataset.id = sel.id;
      c.title = p.name;
      c.appendChild(big(p.icon, 2));
      if (p.state === 'locked') { const l = SN.Sprites.node('lock', 1); l.className = 'sh-lock'; c.appendChild(l); }
      const tagTxt = sel.kind === 'mkt' ? (p.state === 'own' ? T('Abierto') : T('Cerrado')) : p.state === 'own' ? T('Tuyo') : p.price != null ? U.short(p.price) : '—';
      c.insertAdjacentHTML('beforeend', `<span class="nm">${p.short || p.name}</span><b class="pr">${tagTxt}</b>`);
      c.addEventListener('click', (e) => { e.stopPropagation(); W.shopSel = sel; W.shopBump = true; SN.Audio.sfx('select'); W.refresh(); });
      return c;
    };
    if (cat === 'destacados') {
      // Banner: el objeto clave que toca (su oferta de FUTURO.exe) o, si no, el siguiente que llegará
      const next = pend || D.keyItems.find((it) => !run.owned[it.id]);
      if (next) {
        const p = shopProduct({ kind: 'key', id: next.id });
        const ban = U.el('div', 'sh-ban' + (pend ? '' : ' wait'));
        const art = U.el('div', 'sh-bart');
        art.appendChild(big(p.icon, 3));
        ban.appendChild(art);
        ban.insertAdjacentHTML('beforeend', `<div class="sh-btxt"><b>${p.name}</b><span>${p.desc}</span>
          <div class="sh-bpr"><b>${T('Hoy $0')}</b><em>${T('Debes {v}', { v: U.money(p.price) })}</em></div>
          ${pend ? '' : `<small>${p.note}</small>`}</div>`);
        if (pend) {
          const b = U.el('button', 'btn btn-green sh-bbtn', T('Ver oferta'));
          b.disabled = !!run.position;
          b.addEventListener('click', (e) => { e.stopPropagation(); W.offer(pend.id, 'shop'); });
          ban.appendChild(b);
        }
        ban.addEventListener('click', (e) => { e.stopPropagation(); W.shopSel = { kind: 'key', id: next.id }; W.shopBump = true; SN.Audio.sfx('select'); W.refresh(); });
        main.appendChild(ban);
      } else main.appendChild(U.el('div', 'sh-ban done', `<div class="sh-btxt"><b>${T('Lo tienes todo')}</b><span>${T('Ya no quedan objetos clave. Por ahora.')}</span></div>`));
      const off = SN.Luck.discount();
      main.appendChild(U.el('div', 'sh-sec', off ? T('Ofertas del día <em>· Don Siete rebaja un {n}%</em>', { n: Math.round(off * 100) }) : T('Ofertas del día')));
    } else if (cat === 'estilo' && SN.Luck.discount()) {
      main.appendChild(U.el('div', 'sh-sec', T('Estilo de vida <em>· Don Siete rebaja un {n}%</em>', { n: Math.round(SN.Luck.discount() * 100) })));
    }
    if (cat === 'mejoras') {
      // Las mejoras van en filas: nivel y efecto a la vista
      const rows = U.el('div', 'sh-rows');
      for (const sel of list) {
        const p = shopProduct(sel);
        const on = W.shopSel && W.shopSel.kind === 'up' && W.shopSel.id === sel.id;
        const r = U.el('button', `sh-row ${p.state}${on ? ' sel' : ''}${on && W.shopBump ? ' bump' : ''}`);
        r.dataset.kind = 'up'; r.dataset.id = sel.id;
        r.appendChild(big(p.icon, 2));
        r.insertAdjacentHTML('beforeend', `<div class="sh-rt"><b>${p.name} <em>${p.state === 'locked' ? '' : p.level}</em></b><span>${p.state === 'locked' ? p.desc : p.effect}</span></div>
          <b class="pr">${p.state === 'locked' ? '' : p.price != null ? U.short(p.price) : T('Máx.')}</b>`);
        if (p.state === 'locked') { const l = SN.Sprites.node('lock', 1); l.className = 'sh-lock'; r.appendChild(l); }
        r.addEventListener('click', (e) => { e.stopPropagation(); W.shopSel = sel; W.shopBump = true; SN.Audio.sfx('select'); W.refresh(); });
        rows.appendChild(r);
      }
      main.appendChild(rows);
    } else {
      const grid = U.el('div', 'sh-grid');
      for (const sel of list) { const c = card(sel); if (c) grid.appendChild(c); }
      if (!grid.children.length) grid.appendChild(U.el('div', 'sh-empty', T('Nada por aquí. De momento.')));
      main.appendChild(grid);
    }
    box.appendChild(main);

    // Detalle del producto elegido
    const det = U.el('div', 'sh-dt' + (W.shopBump ? ' bump' : ''));
    W.shopBump = false;
    const p = shopProduct(W.shopSel);
    det.appendChild(U.el('div', 'sh-dh', T('Detalle')));
    if (p) {
      const ico = U.el('div', 'sh-dico');
      ico.appendChild(big(p.icon, 2));
      det.appendChild(ico);
      det.insertAdjacentHTML('beforeend', `<b class="sh-dn">${p.name}</b>${p.level ? `<span class="sh-dl">${p.level}</span>` : ''}
        <p class="sh-dd">${p.desc}</p>${p.effect ? `<div class="sh-de">${p.state === 'own' ? p.effect : T('Siguiente: {e}', { e: p.effect })}</div>` : ''}
        ${p.info ? `<div class="sh-de">${p.info}</div>` : ''}${p.sub ? `<div class="sh-de">${p.sub}</div>` : ''}
        ${p.price != null && p.state !== 'own' ? `<div class="sh-dp">${p.old ? `<s>${U.money(p.old)}</s>` : ''}<b class="${p.state === 'poor' ? 'poor' : ''}">${U.money(p.price)}</b></div>` : ''}
        ${p.note ? `<div class="sh-dnote ${p.state}">${p.note}</div>` : ''}`);
      if (p.action) {
        const label = { buy: T('Comprar'), up: T('Mejorar a crédito'), offer: T('Ver oferta') }[p.action];
        const b = U.el('button', `btn ${p.action === 'offer' ? 'btn-cyan' : 'btn-green'} sh-buy`, label);
        b.disabled = !!run.position || (p.action === 'buy' && p.state !== 'can') || (p.action === 'up' && p.state !== 'can');
        b.addEventListener('click', (e) => { e.stopPropagation(); shopAct(p, b); });
        det.appendChild(b);
      }
    }
    box.appendChild(det);
    body.appendChild(box);
  }

  // Comprar (o abrir la oferta) con la misma lógica de siempre
  function shopAct(p, btn) {
    const run = S.run, sel = p.sel;
    const cheer = (color) => {
      const q = SN.UI.posIn(btn);
      SN.FX.coins(q.x + q.w / 2, q.y, 10, 0.9);
      SN.FX.ring(q.x + q.w / 2, q.y + 5, color, 40);
      W.shopFlash = true;
      W.refresh();
    };
    if (p.action === 'offer') { W.offer(sel.id, 'shop'); return; }
    if (p.action === 'up') {
      if (!SN.Upgrades.buy(sel.id)) { SN.Audio.sfx('error'); return; }
      SN.Audio.sfx('unlock');
      SN.Save.saveRun();
      cheer(SN.PAL.green);
      SN.UI.renderHUD();
      return;
    }
    // Estilo de vida y objetos dorados: igual que siempre (precio con la rebaja de Don Siete, sin quedarte a cero)
    const price = p.price;
    if (run.position || run.capital - price < D.sim.bankruptcyThreshold || !SN.Economy.spend(price, 'shop')) { SN.Audio.sfx('error'); return; }
    run.owned[sel.id] = true;
    SN.Desk.dirty();
    SN.Audio.sfx(p.gold ? 'lucky' : 'pay');
    SN.FX.confetti(30);
    SN.Hands.celebrate();
    SN.Save.saveRun();
    cheer(SN.PAL.yellow);
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
    // Es el siguiente paso de la historia: un solo botón, nada que pagar hoy y la deuda en la letra pequeña
    const pop = U.el('div', 'offer');
    pop.innerHTML = `<div class="of-head"><i class="of-ico"></i>${SN.Cipher.brand(true)}<span>${W.opts.why === 'insist' ? st.insist : T('Oferta encontrada')}</span></div>
      <div class="of-title">${st.title}</div>
      <div class="of-line">${fill(st.line)}</div>
      <div class="of-price"><s>${U.money(it.price)}</s><b>${st.free}</b><em>${st.save}</em></div>
      <div class="of-later">${fill(st.later)}</div>
      <button class="of-small">${st.small} ▼</button>
      <div class="of-fine hidden">${fill(st.smallText)}${it.id === 'reloj' ? ` <b class="of-clause">${st.clause}</b>` : ''} <b class="cx of-clue" title="">${D.cipher.alphabet.D}</b></div>
      <div class="of-row"><button class="btn btn-yellow of-yes">${st.yes}</button></div>`;
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
    yes.addEventListener('click', () => { if (SN.Unlocks.canBuyItem(it.id).ok) SN.Game.buyKeyItem(it.id); else SN.Audio.sfx('error'); });
  }
  // ---------- La última oferta (el final A, js/systems/finale.js) ----------
  // El encapuchado ofrece tenerlo todo. «¡Lo quiero!» es el final A; «Ahora no» deja ir al escritorio (NULL.EXE).
  // Si no eliges, vuelve cada turno: a la tercera, la entidad elige por ti.
  function buildPact(body) {
    const st = D.finale.pact, f = S.run && S.run.finale, n = (f && f.insist) || 0;
    const pop = U.el('div', 'offer pact');
    pop.innerHTML = `<div class="of-head"><i class="of-ico"></i>${SN.Cipher.brand(true)}<span>${n ? st.insist[Math.min(n, st.insist.length) - 1] : st.title}</span></div>
      <div class="pa-face"></div>
      <div class="pa-lines">${st.lines.map((l) => `<p>«${l}»</p>`).join('')}</div>
      <div class="of-row"><button class="btn btn-cream pa-no">${st.no}</button><button class="btn btn-yellow of-yes">${st.yes}</button></div>`;
    pop.querySelector('.of-ico').style.backgroundImage = `url(${SN.Sprites.url('app', 1)})`;
    const face = SN.Px.canvas(40, 46);
    SN.Px.ctx(face).drawImage(SN.Chars.hoodedCanvas(0, { smile: true }), 0, 0);
    pop.querySelector('.pa-face').appendChild(face);
    body.appendChild(pop);
    SN.FX.glitch(0.3, 0.8);
    pop.addEventListener('click', (e) => e.stopPropagation());
    pop.querySelector('.of-yes').addEventListener('click', () => { if (SN.Finale.choosing()) SN.Finale.choose('A'); else SN.Audio.sfx('error'); });
    pop.querySelector('.pa-no').addEventListener('click', () => W.close());
  }

  // Compatibilidad: abrir la oferta de un objeto
  W.showOffer = (it) => W.offer(it.id || it, 'shop');

  // "Acerca de FUTURO.exe" (clic en el icono de la barra de título): créditos... y el sello con la F
  function buildAbout(body) {
    const found = SN.Cipher.found('acerca');
    body.innerHTML = `<div class="ab"><div class="ab-logo"></div><div class="ab-txt">
      <b>${SN.Cipher.brand(true)}</b> ${T('versión 6.6.6')}<br>
      ${T('Licencia: perpetua. No se puede cerrar.')}<br>
      ${T('© Futuro S.L. Todos los derechos reservados. También los tuyos.')}<br>
      ${T('Programa recomendado por: un amigo con capucha.')}</div>
      <button class="ab-seal${found ? ' read' : ''}" title="">${found ? '<b class="cx-k">F</b>' : `<b class="cx">${D.cipher.alphabet.F}</b>`}</button></div>`;
    body.querySelector('.ab-logo').appendChild(SN.Sprites.node('appBig', 2));
    body.querySelector('.ab-seal').addEventListener('click', (e) => { e.stopPropagation(); SN.Cipher.discover('acerca'); W.refresh(); });
  }

  function buildSettings(body) {
    const st = S.profile.settings, T = SN.T;
    W.win.classList.add('set-win');
    const row = (label, btnText, cls, fn) => {
      const r = U.el('div', 'set-row', `<span>${label}</span>`);
      const b = U.el('button', 'btn ' + cls, btnText);
      b.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('click'); fn(b); });
      r.appendChild(b);
      body.appendChild(r);
      return b;
    };
    // Idioma: el botón enseña la bandera y el nombre del actual y abre la lista de todos, cada uno con su bandera
    // (cambiarlo recarga el juego; la partida se guarda antes)
    const lr = U.el('div', 'set-row set-lang', `<span>${T('Idioma')}</span>`);
    const lock = !!(S.run && (S.run.position || (SN.Game.state === 'GAMEPLAY' && SN.UI.busy) || (S.run.finale && S.run.finale.lock)));
    const flagBtn = (l, cls) => {
      const b = U.el('button', 'btn ' + cls);
      b.append(SN.Sprites.flag(l.flag), U.el('span', 'set-lang-nm', l.name));
      return b;
    };
    const cur = SN.I18n.LANGS.find((l) => l.id === SN.I18n.lang) || SN.I18n.LANGS[0];
    const open = flagBtn(cur, 'btn-cream set-lang-cur');
    open.appendChild(U.el('i', 'set-lang-arrow', '▼'));
    const langs = U.el('div', 'set-langs hidden');
    const toggle = (show) => { langs.classList.toggle('hidden', !show); open.classList.toggle('on', show); };
    open.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('select'); toggle(langs.classList.contains('hidden')); });
    for (const l of SN.I18n.LANGS) {
      const on = l.id === SN.I18n.lang;
      const b = flagBtn(l, on ? 'btn-green' : 'btn-cream');
      b.dataset.lang = l.id;
      b.disabled = !on && lock;
      if (b.disabled) b.title = T('Termina lo que estás haciendo para cambiar de idioma');
      b.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('click'); if (on) toggle(false); else SN.I18n.set(l.id); });
      langs.appendChild(b);
    }
    langs.addEventListener('click', (e) => e.stopPropagation());
    body.addEventListener('click', () => toggle(false));
    lr.append(open, langs);
    body.appendChild(lr);
    // Volumen general: la barra (clic o arrastrar) y los botones - y +, de 10 en 10
    const vr = U.el('div', 'set-row set-vol', `<span>${T('Volumen')}</span>`);
    const ctl = U.el('div', 'vol');
    const minus = U.el('button', 'btn btn-cream vol-b', '-'), plus = U.el('button', 'btn btn-cream vol-b', '+');
    const bar = U.el('div', 'vol-bar', '<i></i>'), pct = U.el('b', 'vol-pct');
    minus.title = T('Bajar el volumen'); plus.title = T('Subir el volumen');
    ctl.append(minus, bar, plus, pct);
    vr.appendChild(ctl);
    body.appendChild(vr);
    let lastTick = 0;
    const show = () => {
      const v = SN.Audio.volume;
      bar.firstChild.style.width = Math.round(v * 100) + '%';
      pct.textContent = Math.round(v * 100) + '%';
      minus.disabled = v <= 0; plus.disabled = v >= 1;
    };
    const setVol = (v) => {
      v = U.clamp(Math.round(v * 10) / 10, 0, 1);
      if (v === SN.Audio.volume) return;
      st.volume = v;
      SN.Audio.setVolume(v);
      SN.Save.saveProfile();
      show();
      if (performance.now() - lastTick > 90) { lastTick = performance.now(); SN.Audio.sfx('tick'); }
    };
    minus.addEventListener('click', (e) => { e.stopPropagation(); setVol(SN.Audio.volume - 0.1); });
    plus.addEventListener('click', (e) => { e.stopPropagation(); setVol(SN.Audio.volume + 0.1); });
    const fromBar = (e) => { const r = bar.getBoundingClientRect(); setVol((e.clientX - r.left) / r.width); };
    let drag = false;
    bar.addEventListener('pointerdown', (e) => { e.stopPropagation(); drag = true; bar.setPointerCapture(e.pointerId); fromBar(e); });
    bar.addEventListener('pointermove', (e) => { if (drag) fromBar(e); });
    bar.addEventListener('pointerup', () => { drag = false; });
    bar.addEventListener('click', (e) => e.stopPropagation());
    show();
    row(T('Música'), st.music ? T('Sí') : T('No'), st.music ? 'btn-green' : 'btn-cream', () => { st.music = !st.music; SN.Audio.setMusic(st.music); SN.Save.saveProfile(); W.refresh(); });
    row(T('Efectos de sonido'), st.sfx ? T('Sí') : T('No'), st.sfx ? 'btn-green' : 'btn-cream', () => { st.sfx = !st.sfx; SN.Audio.setSfx(st.sfx); SN.Save.saveProfile(); SN.UI.renderSound(); W.refresh(); });
    row(T('Pantalla completa'), T('Cambiar'), 'btn-cyan', () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (_) { /* no disponible */ }
    });
    const inGame = SN.Game.state === 'GAMEPLAY' && S.run;
    if (inGame) {
      row(T('Repetir tutorial'), T('Repasar'), 'btn-yellow', () => { W.close(true); SN.Tutorial.replay(); });
      row(T('Guardar y salir al menú'), T('Salir'), 'btn-coral', () => { W.close(true); SN.Game.toMenu(); });
    }
    body.appendChild(U.el('div', 'set-keys', T('Todo se puede hacer con el ratón. Atajos de teclado:') + '<br>' +
      `<kbd>↑</kbd><kbd>B</kbd> ${T('sube')} · <kbd>↓</kbd><kbd>V</kbd> ${T('baja')} · <kbd>${T('ESPACIO')}</kbd> ${T('cobrar')} · <kbd>F</kbd> ${T('acelerar')}<br>` +
      `<kbd>← →</kbd> ${T('apuesta')} · <kbd>1-4</kbd> ${T('multiplicador')} · <kbd>P</kbd> ${T('esperar')} · <kbd>TAB</kbd> ${T('mercado')}<br>` +
      `<kbd>M</kbd> ${T('mejoras')} · <kbd>N</kbd> ${T('noticias')} · <kbd>T</kbd> ${T('tienda')} · <kbd>ESC</kbd> ${T('menú / cerrar')}`));
  }
})(window.SN);
