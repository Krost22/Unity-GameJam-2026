// Ventanas modales dentro del monitor: TIENDA (con las mejoras y la Academia), NOTICIAS (un periódico con fotos), AJUSTES,
// la RULETA de los días de la suerte y la OFERTA de FUTURO.exe (que salta sola, sin pasar por la tienda).
(function (SN) {
  'use strict';
  const U = SN.Util, S = SN.State, D = SN.Data;

  // 'upgrades' es ahora la Academia de Bravo Fines (se entra desde la Tienda: todo se compra allí)
  const TITLES = { upgrades: 'Tienda · Academia de Bravo Fines', news: 'Noticias', shop: 'Tienda · MEGATIENDA.COM', settings: 'Ajustes', ruleta: 'Ruleta de la Fortuna', offer: '', about: 'Acerca de FUTURO.exe' };

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
      this.win = U.el('div', 'win' + (kind === 'news' ? ' wide paper' : kind === 'offer' ? ' offer-win' : kind === 'shop' ? ' big sh-win' : ''));
      if (kind === 'offer') this.win.innerHTML = '<div class="win-body"></div>';
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
      ({ upgrades: buildUpgrades, news: buildNews, shop: buildShop, settings: buildSettings, ruleta: buildWheel, offer: buildOffer, about: buildAbout })[this.current](body);
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
    const back = U.el('button', 'up-tab', '◀ Tienda');
    back.addEventListener('click', (e) => { e.stopPropagation(); SN.Audio.sfx('select'); W.open('shop'); });
    tabs.appendChild(back);
    tabs.appendChild(U.el('button', 'up-tab on ac', 'Academia de Bravo Fines'));
    body.appendChild(tabs);
    buildAcademy(body);
  }

  // ---------- La Academia de Bravo Fines: árbol de habilidades (js/data/academy.js) ----------
  // Encabezado con Bravo, navegación por ramas, las tres ramas con sus nodos unidos por líneas, el detalle
  // del nodo elegido y, abajo, el progreso. Todo sale de SN.Academy: aquí solo se pinta.
  const AC_NAV = [['arbol', 'Árbol', 'estrella'], ['negocios', 'Negocios', 'tienda'], ['trading', 'Trading', 'grafica'], ['contactos', 'Contactos', 'contacto']];
  const AC_BRANCH = { negocios: ['tienda', 'Dinero cada día'], trading: ['grafica', 'Mejora tus apuestas'], contactos: ['contacto', 'Ayudas y amigos'] };
  const cap1 = (t) => t.charAt(0) + t.slice(1).toLowerCase();
  // El efecto de un nodo, en palabras (sale de sus datos: income, bonus, halve, offer)
  function acEffect(n) {
    if (n.soon) return 'Próximamente';
    if (n.income) return `+${U.money(n.income)} al día`;
    if (n.bonus) return `+${Math.round(n.bonus * 100)}% en cada ganancia`;
    if (n.halve) return '1ª pérdida del día, a la mitad';
    if (n.offer) return `Ofertas: −${Math.round((1 - n.offer) * 100)}% de deuda`;
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
    head.insertAdjacentHTML('beforeend', `<div class="ac-ttl"><b>Academia de Bravo Fines</b><span>"El dinero no se gana. Se manifiesta."</span></div>
      <div class="ac-inc"><span>Negocios</span><b>+${U.money(A.income())}/día</b></div>
      <div class="ac-cash"><i></i><div><span>Tu dinero</span><b>${U.money(run.capital)}</b></div></div>`);
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
        const p = U.el('p', A.has(n.id) ? 'own' : n.soon ? 'soon' : '', `<b>${n.name}</b> · ${acEffect(n)}${n.soon ? '' : ` · ${A.has(n.id) ? 'Tuyo' : U.money(n.cost)}`}`);
        p.addEventListener('click', (e) => { e.stopPropagation(); W.acSel = n.id; W.acBump = n.id; SN.Audio.sfx('select'); W.refresh(); });
        list.appendChild(p);
      }
      tree.appendChild(list);
    }
    box.appendChild(tree);

    // Detalle del nodo elegido
    const n = A.node(W.acSel), can = A.canBuy(n.id), own = A.has(n.id);
    const det = U.el('div', 'ac-dt' + (W.acBump === n.id ? ' bump' : ''));
    det.innerHTML = `<div class="ac-dh">Detalle</div><div class="ac-dico"></div><b class="ac-dn">${n.name}</b>
      <span class="ac-dl">${n.soon ? 'Próximamente' : `Nv. ${own ? 1 : 0} / 1`}</span><p class="ac-dd">${n.desc}</p>
      ${own ? `<div class="ac-de"><span>Efecto actual:</span><b>${acEffect(n)}</b></div>` : n.soon ? '' : `<div class="ac-de nx"><span>Efecto actual: <i>ninguno</i></span><span>Al comprarlo:</span><b>${acEffect(n)}</b></div>`}`;
    det.querySelector('.ac-dico').appendChild(big(n.soon ? 'lock' : n.icon, 2));
    if (!own && !n.soon) {
      const b = U.el('button', 'btn btn-yellow ac-buy', `Comprar ${U.money(n.cost)}`);
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
    } else det.insertAdjacentHTML('beforeend', `<div class="ac-why${own ? ' ok' : ''}">${own ? 'Ya es tuyo.' : 'Llegará en una versión futura.'}</div>`);
    box.appendChild(det);

    // Abajo: el progreso de la Academia y lo siguiente que llegará a esa rama
    const done = real.filter((x) => A.has(x.id)).length;
    const pct = Math.round(done / Math.max(1, real.length) * 100);
    const br = data.branches.find((b) => b.id === (view !== 'arbol' ? view : n.branch)) || data.branches[0];
    const next = br.nodes.find((x) => x.soon);
    const bar = U.el('div', 'ac-bot');
    bar.innerHTML = `<div class="ac-prog"><i class="ac-pi"></i><div class="ac-pt"><b>Progreso</b><div class="ac-bar"><i style="width:${pct}%"></i></div></div><em>${done} / ${real.length}</em></div>
      <div class="ac-rew"><div class="ac-rt"><b>Siguiente en ${br.name}</b><span>${next ? `${next.name} (pronto)` : 'Rama completa'}</span></div><i class="ac-ri"></i></div>`;
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
  // Una tienda de pixel art: cabecera con tu dinero, categorías a la izquierda, productos en el centro y el
  // detalle del producto elegido a la derecha. Todo sale de los sistemas de siempre (SN.Unlocks para los
  // objetos clave y su oferta, SN.Upgrades, SN.Luck, SN.ShopWatch): aquí solo cambia cómo se ve.
  // (los objetos clave, la historia, van antes que las mejoras)
  const SHOP_CATS = [['destacados', 'Destacados', 'estrella'], ['clave', 'Objetos clave', 'llave'], ['mejoras', 'Mejoras', 'flecha'],
    ['estilo', 'Estilo de vida', 'taza'], ['coleccion', 'Colección', 'gema'], ['mercados', 'Mercados', 'grafica'],
    ['academia', 'Academia', 'tiburon']]; // la Academia de Bravo Fines (solo cuando se ha presentado)
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
        state: owned ? 'own' : !today ? 'locked' : poor ? 'poor' : 'can', note: owned ? 'En tu habitación' : !today ? 'Solo en días con 7' : poor ? 'No te alcanza' : '',
        action: owned || !today ? null : 'buy', gold: sel.kind === 'gold' };
    }
    if (sel.kind === 'up') {
      const d = SN.Upgrades.def(sel.id);
      if (!d) return null;
      const unlocked = SN.Upgrades.isUnlocked(d.id), lv = SN.Upgrades.level(d.id), next = SN.Upgrades.next(d.id), can = SN.Upgrades.canBuy(d.id);
      // A crédito: el precio que se ve es lo que se suma a tu deuda (con intereses); hoy no pagas nada
      const credit = next ? SN.Upgrades.creditCost(d.id) : null;
      return { sel, icon: d.icon, name: d.name, desc: unlocked ? d.desc : d.unlock.label || 'Bloqueado', price: credit,
        level: `Nv. ${lv} / ${d.levels.length}`, effect: next ? d.effect(next.value) : unlocked ? `${d.effect(SN.Upgrades.value(d.id))} · máximo` : '',
        sub: unlocked && next ? `A crédito: hoy $0 · ${SN.Debt.active() ? 'se suma a tu deuda' : `deuda nueva, ${D.credit.days} días`}` : '',
        state: !unlocked ? 'locked' : !next ? 'own' : can.ok ? 'can' : 'poor', note: !unlocked ? 'Llega como "regalo"' : !next ? 'Al máximo' : can.ok ? '' : cap1(can.reason || 'TODAVÍA NO'),
        action: unlocked && next ? 'up' : null };
    }
    if (sel.kind === 'key') {
      const it = D.keyItemById(sel.id);
      if (!it) return null;
      const can = SN.Unlocks.canBuyItem(it.id), owned = !!run.owned[it.id], pend = SN.Unlocks.pendingItem();
      const o = SN.Unlocks.offer(it), mine = pend && pend.id === it.id;
      // Hoy no se paga nada: el precio que se ve es la deuda que deja
      return { sel, icon: ITEM_ICON[it.id], name: it.name, desc: it.desc, price: o.debt,
        state: owned ? 'own' : mine ? (can.ok ? 'can' : 'poor') : 'locked', note: owned ? 'En tu habitación' : can.reason ? cap1(can.reason) : '',
        action: mine ? 'offer' : null, sub: `Hoy $0 · luego debes ${U.money(o.debt)} en ${o.days} días` };
    }
    if (sel.kind === 'ruleta') {
      const l = SN.Luck.today();
      if (!l || !l.events.includes('ruleta')) return null;
      return { sel, icon: 'coin0', name: 'Ruleta de la Fortuna', desc: 'Un giro gratis. Solo hoy, día de la suerte.', price: 0, free: true,
        state: l.spun ? 'own' : 'can', note: l.spun ? 'Ya has girado hoy' : '', action: l.spun ? null : 'ruleta' };
    }
    if (sel.kind === 'mkt') {
      const def = D.marketById(sel.id);
      if (!def) return null;
      const open = SN.Unlocks.isUnlocked(def.id);
      return { sel, icon: def.icon, name: def.name, desc: def.desc, info: `Tope: ±${U.money(def.cap)} por apuesta`,
        state: open ? 'own' : 'locked', note: open ? 'Abierto' : `Se abre: ${def.unlock.label || 'más adelante'}`, action: null, short: D.marketLabel(def.id) };
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
    const l = SN.Luck.today();
    if (l && l.events.includes('ruleta') && !l.spun) out.push({ kind: 'ruleta', id: 'ruleta' });
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
    head.insertAdjacentHTML('beforeend', `<div class="sh-ttl"><b>Tienda</b><span>Mejoras, objetos y caprichos que te acercan a la fortuna.</span></div>
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
      const tagTxt = sel.kind === 'mkt' ? (p.state === 'own' ? 'Abierto' : 'Cerrado') : p.state === 'own' ? 'Tuyo' : p.free ? 'Gratis' : p.price != null ? U.short(p.price) : '—';
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
          <div class="sh-bpr"><b>Hoy $0</b><em>Debes ${U.money(p.price)}</em></div>
          ${pend ? '' : `<small>${p.note}</small>`}</div>`);
        if (pend) {
          const b = U.el('button', 'btn btn-green sh-bbtn', 'Ver oferta');
          b.disabled = !!run.position;
          b.addEventListener('click', (e) => { e.stopPropagation(); W.offer(pend.id, 'shop'); });
          ban.appendChild(b);
        }
        ban.addEventListener('click', (e) => { e.stopPropagation(); W.shopSel = { kind: 'key', id: next.id }; W.shopBump = true; SN.Audio.sfx('select'); W.refresh(); });
        main.appendChild(ban);
      } else main.appendChild(U.el('div', 'sh-ban done', '<div class="sh-btxt"><b>Lo tienes todo</b><span>Ya no quedan objetos clave. Por ahora.</span></div>'));
      const off = SN.Luck.discount();
      main.appendChild(U.el('div', 'sh-sec', off ? `Ofertas del día <em>· Don Siete rebaja un ${Math.round(off * 100)}%</em>` : 'Ofertas del día'));
    } else if (cat === 'estilo' && SN.Luck.discount()) {
      main.appendChild(U.el('div', 'sh-sec', `Estilo de vida <em>· Don Siete rebaja un ${Math.round(SN.Luck.discount() * 100)}%</em>`));
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
          <b class="pr">${p.state === 'locked' ? '' : p.price != null ? U.short(p.price) : 'Máx.'}</b>`);
        if (p.state === 'locked') { const l = SN.Sprites.node('lock', 1); l.className = 'sh-lock'; r.appendChild(l); }
        r.addEventListener('click', (e) => { e.stopPropagation(); W.shopSel = sel; W.shopBump = true; SN.Audio.sfx('select'); W.refresh(); });
        rows.appendChild(r);
      }
      main.appendChild(rows);
    } else {
      const grid = U.el('div', 'sh-grid');
      for (const sel of list) { const c = card(sel); if (c) grid.appendChild(c); }
      if (!grid.children.length) grid.appendChild(U.el('div', 'sh-empty', 'Nada por aquí. De momento.'));
      main.appendChild(grid);
    }
    box.appendChild(main);

    // Detalle del producto elegido
    const det = U.el('div', 'sh-dt' + (W.shopBump ? ' bump' : ''));
    W.shopBump = false;
    const p = shopProduct(W.shopSel);
    det.appendChild(U.el('div', 'sh-dh', 'Detalle'));
    if (p) {
      const ico = U.el('div', 'sh-dico');
      ico.appendChild(big(p.icon, 2));
      det.appendChild(ico);
      det.insertAdjacentHTML('beforeend', `<b class="sh-dn">${p.name}</b>${p.level ? `<span class="sh-dl">${p.level}</span>` : ''}
        <p class="sh-dd">${p.desc}</p>${p.effect ? `<div class="sh-de">${p.state === 'own' ? '' : 'Siguiente: '}${p.effect}</div>` : ''}
        ${p.info ? `<div class="sh-de">${p.info}</div>` : ''}${p.sub ? `<div class="sh-de">${p.sub}</div>` : ''}
        ${p.price != null && p.state !== 'own' && !p.free ? `<div class="sh-dp">${p.old ? `<s>${U.money(p.old)}</s>` : ''}<b class="${p.state === 'poor' ? 'poor' : ''}">${U.money(p.price)}</b></div>` : ''}
        ${p.note ? `<div class="sh-dnote ${p.state}">${p.note}</div>` : ''}`);
      if (p.action) {
        const label = { buy: 'Comprar', up: 'Mejorar a crédito', offer: 'Ver oferta', ruleta: '¡Girar!' }[p.action];
        const b = U.el('button', `btn ${p.action === 'offer' ? 'btn-cyan' : 'btn-green'} sh-buy`, label);
        b.disabled = !!run.position || (p.action === 'buy' && p.state !== 'can') || (p.action === 'up' && p.state !== 'can');
        b.addEventListener('click', (e) => { e.stopPropagation(); shopAct(p, b); });
        det.appendChild(b);
      }
    }
    box.appendChild(det);
    body.appendChild(box);
  }

  // Comprar (o abrir la oferta, o girar la ruleta) con la misma lógica de siempre
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
    if (p.action === 'ruleta') { W.open('ruleta'); return; }
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
    // Es el siguiente paso de la historia: un solo botón, nada que pagar hoy y la deuda en la letra pequeña
    const pop = U.el('div', 'offer');
    pop.innerHTML = `<div class="of-head"><i class="of-ico"></i>${SN.Cipher.brand(true)}<span>${W.opts.why === 'insist' ? st.insist : 'Oferta encontrada'}</span></div>
      <div class="of-title">${st.title}</div>
      <div class="of-line">${fill(st.line)}</div>
      <div class="of-price"><s>${U.money(it.price)}</s><b>${st.free}</b><em>${st.save}</em></div>
      <div class="of-later">${fill(st.later)}</div>
      <button class="of-small">${st.small} ▼</button>
      <div class="of-fine hidden">${fill(st.smallText)} <b class="cx of-clue" title="">${D.cipher.alphabet.D}</b></div>
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
