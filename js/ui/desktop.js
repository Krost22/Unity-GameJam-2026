// Escritorio del PC: FUTURO.exe se minimiza (botón _ o tecla D) y debajo está el ordenador del
// protagonista, con sus programas: Mensajín (chat con Kevo, con LOS DESFASADOS y con Bravo Fines), Notas, Papelera,
// Símbolos (la tabla del idioma secreto, al descifrar el primero) y NULL.EXE (lo entregan LOS DESFASADOS por partes;
// completo, es el final B: js/systems/finale.js, que también usa aquí su terminal).
// En Mensajín no se escribe de verdad: cualquier tecla pone las letras de la
// respuesta que el protagonista tiene que dar; el jugador siente que escribe y la historia sigue su guion.
// El clic no escribe (a propósito): la gracia es teclear.
(function (SN) {
  'use strict';
  const S = SN.State, U = SN.Util;
  const $ = (id) => document.getElementById(id);
  const C = () => SN.Data.chat;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const ICONS = [
    { id: 'futuro', name: 'FUTURO.exe', sprite: 'appBig' },
    { id: 'chat', name: 'Mensajín', sprite: 'icoChat' },
    { id: 'notes', name: 'Notas', sprite: 'icoNotes' },
    { id: 'trash', name: 'Papelera', sprite: 'icoTrash' },
    { id: 'symbols', name: 'Símbolos', sprite: 'icoSymbols' },
    { id: 'null', name: 'NULL.EXE', sprite: 'icoNull' },
  ];
  const TITLES = { notes: 'Notas.txt', trash: 'Papelera', symbols: 'Símbolos.txt', null: 'NULL.EXE · LÉEME.txt', term: 'C:\\> NULL.EXE' };
  const TASKS = { notes: 'Notas', trash: 'Papelera', symbols: 'Símbolos', null: 'NULL.EXE', term: 'Terminal' };
  const X = () => SN.Data.cipher;
  const B = () => SN.Data.academy;
  const cx = (t) => SN.Cipher.html(t, SN.UI.freshLetter);

  const D = SN.Desktop = {
    open: false,
    wins: {},      // ventanas abiertas: id -> elemento
    timer: null,   // entrega de mensajes en curso

    init() {
      const root = $('desktop');
      root.innerHTML = `
        <div class="dt-wall"><span class="dt-logo">P6</span></div>
        <div class="dt-icons"></div>
        <div class="dt-wins"></div>
        <div class="dt-bar">
          <button class="dt-start"><i></i>Inicio</button>
          <div class="dt-tasks"></div>
          <span class="dt-clock"></span>
        </div>`;
      const icons = root.querySelector('.dt-icons');
      for (const ic of ICONS) {
        const b = U.el('button', 'dt-icon');
        b.dataset.app = ic.id;
        b.appendChild(SN.Sprites.node(ic.sprite, 1));
        b.insertAdjacentHTML('beforeend', `<span class="nm">${ic.id === 'futuro' ? SN.Cipher.brand() : ic.name}</span><b class="badge hidden"></b>`);
        b.addEventListener('click', () => { SN.Audio.sfx('click'); this.launch(ic.id); });
        icons.appendChild(b);
      }
      root.querySelector('.dt-start').addEventListener('click', () => { SN.Audio.sfx('click'); this.restore(); });
      $('btn-min').querySelector('.ico-min').style.backgroundImage = `url(${SN.Sprites.url('icoMin', 1)})`;
      $('btn-min').addEventListener('click', () => this.minimize());
      // El logo del fondo: siete clics (el número de la suerte) y enseña un símbolo
      const logo = root.querySelector('.dt-logo');
      logo.addEventListener('click', () => {
        this.logoHits = (this.logoHits || 0) + 1;
        SN.Audio.sfx('tick');
        logo.classList.remove('knock'); void logo.offsetWidth; logo.classList.add('knock');
        if (this.logoHits >= 7) {
          this.logoHits = 0;
          logo.textContent = X().alphabet.R;
          SN.Cipher.discover('logo');
          SN.after(2.5, () => { logo.textContent = 'P6'; });
        }
      });
      this.renderIcons();
      SN.Events.on('turn:ready', () => { if (S.run) this.chat().clock++; this.check(); this.serCheck(); this.bravoCheck(); this.refreshNotes(); this.refreshTrash(); });
      SN.Events.on('chat:flag', ({ flag }) => { this.flag(flag); this.serCheck(); this.bravoCheck(); });
      SN.Events.on('rescue:done', () => this.flag('rescue'));
      SN.Events.on('trade:closed', (r) => { if (r && (r.liquidated || r.pnl <= -Math.max(50, r.amount * 0.6))) this.flag('bigLoss'); });
      SN.Events.on('debt:paid', () => this.refreshNotes());
      SN.Events.on('debt:opened', () => this.refreshNotes());
    },

    // Partida nueva: todo cerrado y FUTURO.exe a la vista
    reset() {
      clearTimeout(this.timer); this.timer = null; this.typing = false;
      clearTimeout(this.serT); this.serT = null;
      clearTimeout(this.bravoT); this.bravoT = null;
      this.contact = 'kevo';
      this.renderIcons();
      const nm = $('desktop') && $('desktop').querySelector('.dt-icon[data-app="futuro"] .nm');
      if (nm) nm.innerHTML = SN.Cipher.brand();
      for (const id of Object.keys(this.wins)) { this.wins[id].remove(); delete this.wins[id]; }
      this.open = false;
      const d = $('desktop'); if (d) d.classList.add('hidden');
      const t = document.querySelector('.msg-toast'); if (t) t.remove();
    },

    // ---------- Minimizar / restaurar FUTURO.exe ----------
    canMinimize() {
      const UI = SN.UI;
      return SN.Game.state === 'GAMEPLAY' && S.run && !S.run.over && !S.run.position && !UI.busy &&
        !SN.Windows.current && !SN.Dialog.active && UI.allowed('window');
    },
    minimize(then) {
      if (this.open) { if (then) this.launch(then); return; }
      if (!this.canMinimize()) { SN.Audio.sfx('error'); return; }
      this.open = true;
      // El aviso de mensaje de Kevo sobra en el escritorio: el chat ya muestra lo que no has leído
      const tst = document.querySelector('.msg-toast:not(.shop)'); if (tst) tst.remove();
      SN.Audio.sfx('close');
      $('app').classList.add('minimizing');
      $('desktop').classList.remove('hidden');
      clearTimeout(this.animT);
      $('app').classList.remove('restoring');
      this.animT = setTimeout(() => { $('app').classList.add('hidden'); $('app').classList.remove('minimizing'); }, 220);
      this.refresh();
      if (then) this.launch(then);
    },
    restore() {
      if (!this.open || this.noApp) return;
      this.open = false;
      SN.Audio.sfx('open');
      clearTimeout(this.animT);
      $('app').classList.remove('hidden', 'minimizing');
      $('app').classList.add('restoring');
      this.animT = setTimeout(() => { $('app').classList.remove('restoring'); $('desktop').classList.add('hidden'); }, 220);
      SN.UI.renderAll && SN.UI.renderAll();
    },

    launch(id) {
      if (id === 'futuro') return this.restore();
      if (this.wins[id]) return this.focus(id);
      const w = U.el('div', 'dt-win dt-' + id);
      const title = id === 'chat' ? C().app : TITLES[id];
      w.innerHTML = `<div class="dt-head"><span>${title}</span><button class="dt-x" title="Cerrar (Esc)">×</button></div><div class="dt-body"></div>`;
      w.querySelector('.dt-x').addEventListener('click', (e) => { e.stopPropagation(); this.closeWin(id); });
      w.addEventListener('mousedown', () => this.focus(id));
      $('desktop').querySelector('.dt-wins').appendChild(w);
      this.wins[id] = w;
      SN.Audio.sfx('open');
      if (id === 'chat') this.buildChat(w);
      if (id === 'notes') this.refreshNotes();
      if (id === 'trash') this.buildTrash(w);
      if (id === 'symbols') {
        const badge = $('desktop').querySelector('.dt-icon[data-app="symbols"] .badge');
        if (badge) badge.classList.add('hidden');
        this.renderSymbols();
      }
      if (id === 'null') this.buildNull(w);
      if (id === 'term') this.renderTerm();
      this.focus(id);
      this.refresh();
    },
    closeWin(id) {
      const w = this.wins[id];
      if (!w) return;
      w.remove();
      delete this.wins[id];
      SN.Audio.sfx('close');
      this.refresh();
    },
    focus(id) {
      for (const [k, w] of Object.entries(this.wins)) w.classList.toggle('top', k === id);
      this.topId = id;
    },
    topWin() { return this.wins[this.topId] ? this.topId : Object.keys(this.wins).pop(); },

    // Barra de tareas, reloj e insignias de mensajes sin leer
    refresh() {
      const root = $('desktop');
      if (!root || !S.run) return;
      const tasks = root.querySelector('.dt-tasks');
      tasks.innerHTML = '';
      const add = (id, name) => {
        const b = U.el('button', 'dt-task' + (id === 'futuro' ? ' min' : '') + (this.topWin() === id ? ' on' : ''), id === 'futuro' ? SN.Cipher.brand() : esc(name));
        b.addEventListener('click', () => this.launch(id));
        tasks.appendChild(b);
      };
      if (!this.noApp) add('futuro', 'FUTURO.exe');
      for (const id of Object.keys(this.wins)) add(id, id === 'chat' ? C().app : TASKS[id]);
      const fi = root.querySelector('.dt-icon[data-app="futuro"]');
      if (fi) fi.classList.toggle('hidden', !!this.noApp);
      const names = SN.Data.sim.turnNames || ['Mañana', 'Tarde', 'Noche'];
      root.querySelector('.dt-clock').textContent = `Día ${S.run.day} · ${names[S.run.turn] || ''}`;
      const unread = (this.chat().unread || 0) + (this.ser().unread || 0) + (this.bravo().unread || 0);
      const badge = root.querySelector('.dt-icon[data-app="chat"] .badge');
      badge.textContent = unread; badge.classList.toggle('hidden', !unread);
      const mb = $('min-badge');
      if (mb) { mb.textContent = unread; mb.classList.toggle('hidden', !unread); }
    },

    // ---------- Teclado ----------
    // Devuelve true si el escritorio se queda con la tecla
    onKey(e) {
      if (!this.open) {
        if (e.code === 'KeyD' && !e.repeat && SN.Game.state === 'GAMEPLAY' && !SN.Windows.current && !SN.Dialog.active) {
          // En la elección del final, D hace lo mismo que «Ir al escritorio»: abre NULL.EXE
          if (this.canMinimize()) { e.preventDefault(); this.minimize(SN.Finale && SN.Finale.choosing() ? 'null' : undefined); return true; }
        }
        return false;
      }
      e.preventDefault();
      const top = this.topWin();
      if (e.code === 'Escape') { if (top) this.closeWin(top); else this.restore(); return true; }
      // La terminal de NULL.EXE: cualquier tecla escribe el comando (js/systems/finale.js)
      if (top === 'term' && SN.Finale && SN.Finale.termKey(e)) return true;
      if (top === 'chat' && this.onKevo() && this.chat().phase === 'reply') {
        if (e.code === 'Enter' && this.replyDone()) this.send();
        else if (!e.repeat || Math.random() < 0.35) {
          // (con la tecla mantenida, los dedos también se mueven: el primer toque ya lo hace ui.js)
          if (e.repeat) SN.Hands.tapKey(e.code);
          this.typeChunk();
        }
        return true;
      }
      if (e.code === 'KeyD' && !top) this.restore();
      return true;
    },

    // ---------- Mensajín ----------
    chat() {
      if (!S.run) return {};
      if (!S.run.chat) S.run.chat = { i: 0, phase: 'wait', k: 0, typed: 0, log: [], unread: 0, nick: null, offline: false };
      const ch = S.run.chat;
      if (!ch.flags) ch.flags = {};      // lo que ha pasado (y en qué momento del reloj del chat)
      if (!ch.sideDone) ch.sideDone = {};
      if (ch.clock == null) ch.clock = 0; // turnos jugados (no retrocede al volver a un punto de control)
      return ch;
    },
    // Conversación en curso: una secundaria (si la hay) o la siguiente de la historia
    convo() {
      const ch = this.chat();
      return ch.side != null ? C().side.find((c) => c.id === ch.side) : C().convos[ch.i];
    },
    // Algo ha pasado en la historia: Kevo podrá reaccionar
    flag(name) {
      const ch = this.chat();
      if (!S.run || ch.flags[name] != null) return;
      ch.flags[name] = ch.clock;
    },
    // ¿Ya pasó la conversación en la que Kevo desaparece? (desde ahí no reacciona a lo que te pasa)
    kevoGone() {
      const ch = this.chat(), at = C().convos.findIndex((c) => c.gone);
      return at >= 0 && ch.i > at;
    },
    ready(c) {
      const ch = this.chat(), r = S.run;
      if (c.when) return ch.flags[c.when] != null && ch.clock >= ch.flags[c.when] + (c.delay || 0);
      return r.day > c.day || (r.day === c.day && r.turn >= c.turn);
    },

    // ¿Toca que Kevo escriba? (al terminar cada turno)
    check() {
      const ch = this.chat();
      if (!S.run || S.run.over || SN.Game.state !== 'GAMEPLAY') return;
      if (ch.phase !== 'wait') { this.pump(); return; }
      // Primero las reacciones a lo que acaba de pasar (si Kevo no ha desaparecido); luego la historia principal
      const side = !this.kevoGone() && C().side.find((c) => !ch.sideDone[c.id] && this.ready(c));
      if (side) ch.side = side.id;
      else {
        ch.side = null;
        let c = C().convos[ch.i];
        while (c && c.skipIf && ch.flags[c.skipIf] != null) c = C().convos[++ch.i];
        if (!c || !this.ready(c)) return;
      }
      const c = this.convo();
      ch.phase = 'in'; ch.k = 0; ch.typed = 0;
      SN.Events.emit('kevo:writes', { id: c.id });
      if (c.nick) ch.nick = c.nick;
      ch.offline = false;
      this.pump();
    },

    // Entrega las líneas de Kevo una a una, con "está escribiendo..." entre medias
    pump() {
      const ch = this.chat(), c = this.convo();
      if (this.timer || !c) return;
      const lines = ch.phase === 'in' ? c.msgs : ch.phase === 'out' ? c.after : null;
      if (!lines) { this.renderChat(); return; }
      if (ch.k >= lines.length) {
        if (ch.phase === 'in') { ch.phase = 'reply'; ch.typed = 0; }
        else {
          ch.phase = 'wait'; ch.k = 0; ch.typed = 0;
          if (ch.side != null) { ch.sideDone[ch.side] = true; ch.side = null; } else ch.i++;
          if (c.offline) ch.offline = true;
          // Kevo desaparece aquí: desde este día está "desconectado"
          if (c.gone) ch.goneDay = S.run.day;
          SN.Events.emit('kevo:done', { id: c.id });
        }
        SN.Save.saveRun();
        this.renderChat();
        this.refresh();
        // Un respiro antes de que empiece otra conversación encadenada
        if (ch.phase === 'wait') this.timer = setTimeout(() => { this.timer = null; this.check(); }, 2600);
        return;
      }
      const line = lines[ch.k];
      // '>evento': pasa algo al otro lado de la ventana (sin mensaje en el chat)
      if (line.startsWith('>')) { ch.k++; SN.Desk.windowEvent(line.slice(1)); this.pump(); return; }
      // Tiempo de "escribir" cada línea: lo bastante largo para leer la anterior con calma
      const delay = line.startsWith('*') || line === '!zumbido' ? 900 : 900 + Math.min(2200, line.length * 45);
      this.typing = !line.startsWith('*') && line !== '!zumbido';
      this.renderChat();
      this.timer = setTimeout(() => {
        this.timer = null;
        this.typing = false;
        this.deliver(line);
        ch.k++;
        this.pump();
      }, delay);
    },

    deliver(line) {
      const ch = this.chat();
      if (line === '!zumbido') {
        ch.log.push({ who: 's', t: `¡${C().friend.name} te ha enviado un zumbido!` });
        this.nudge();
      } else if (line.startsWith('*')) {
        ch.log.push({ who: 's', t: line.slice(1) });
      } else if (line.startsWith('#')) {
        // '#pista': un símbolo del idioma secreto con su letra (y queda descubierto)
        const clue = SN.Cipher.clue(line.slice(1));
        if (clue) { ch.log.push({ who: 'f', t: `${X().alphabet[clue.letter]} = ${clue.letter}` }); SN.Cipher.discover(clue.id); }
      } else {
        ch.log.push({ who: 'f', t: line });
      }
      const reading = this.open && this.topWin() === 'chat';
      if (!reading && !line.startsWith('*')) ch.unread = (ch.unread || 0) + 1;
      if (line.startsWith('*')) SN.Audio.sfx('close'); else SN.Audio.sfx('notify');
      if (!this.open && line !== '!zumbido' && !line.startsWith('*') && !line.startsWith('#')) this.toast(line);
      this.renderChat();
      this.refresh();
    },

    nudge() {
      SN.Audio.sfx('thud');
      const el = this.open ? (this.wins.chat || $('desktop')) : $('screen');
      el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
      SN.FX.shake(3, 0.35);
    },

    // Aviso dentro de FUTURO.exe: clic para ir al chat. opts (otros avisos, como "ya puedes comprar..."):
    // { icon, kbd, onClick }
    // El final: la última conversación de Kevo, entera y sin esperar turnos (con avisos en FUTURO.exe).
    // La respuesta del protagonista se escribe sola.
    async playConvo(id) {
      const ch = this.chat(), at = C().convos.findIndex((c) => c.id === id);
      if (at < 0 || ch.i > at) return;
      clearTimeout(this.timer); this.timer = null;
      const c = C().convos[at];
      ch.i = at; ch.side = null; ch.phase = 'in'; ch.k = 0;
      if (c.nick) ch.nick = c.nick;
      ch.offline = false;
      const line = async (l) => {
        if (l.startsWith('>')) { SN.Desk.windowEvent(l.slice(1)); await SN.wait(1.2); return; }
        this.deliver(l);
        await SN.wait(l.startsWith('*') || l === '!zumbido' ? 0.7 : 1.1 + Math.min(1.6, l.length * 0.04));
      };
      for (const l of c.msgs) await line(l);
      ch.log.push({ who: 'm', t: c.reply });
      if (!this.open) this.toast('', `<b>Tú</b> ${esc(c.reply)}`);
      SN.Audio.sfx('select');
      await SN.wait(1.4);
      ch.phase = 'out';
      for (const l of c.after) await line(l);
      ch.phase = 'wait'; ch.k = 0; ch.typed = 0; ch.i = at + 1;
      if (c.offline) ch.offline = true;
      SN.Save.saveRun();
      this.renderChat();
      this.refresh();
    },

    toast(line, html, opts = {}) {
      const layer = $('layer-top');
      let t = layer.querySelector('.msg-toast');
      if (!t) {
        t = U.el('button', 'msg-toast');
        t.addEventListener('click', () => { const fn = t.onPick; t.remove(); if (fn) fn(); });
        layer.appendChild(t);
      }
      t.onPick = opts.onClick || (() => this.minimize('chat'));
      t.classList.toggle('shop', !!opts.icon);
      const kbd = opts.kbd || 'D';
      t.innerHTML = html ? `<i></i><span>${html}</span><kbd>${kbd}</kbd>` : `<i></i><span><b>${esc(C().friend.name)}</b> ${esc(line)}</span><kbd>${kbd}</kbd>`;
      t.querySelector('i').appendChild(SN.Sprites.node(opts.icon || 'icoChat', 1));
      SN.KW.apply(t.querySelector('span'));
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => t.remove(), 6000);
    },

    buildChat(w) {
      const f = C().friend;
      w.querySelector('.dt-body').innerHTML = `
        <div class="ch-tabs hidden"><button class="ch-tab" data-c="kevo">${esc(f.name)}<b class="badge hidden"></b></button><button class="ch-tab ser" data-c="ser"></button><button class="ch-tab bravo" data-c="bravo"></button></div>
        <div class="ch-who"><i class="ch-ava"></i><div><b class="ch-nick"></b><span class="ch-status"></span></div></div>
        <div class="ch-log"></div>
        <div class="ch-typing"></div>
        <div class="ch-input"><div class="ch-box"></div><button class="ch-send btn btn-green">Enviar<kbd>⏎</kbd></button></div>`;
      w.querySelector('.ch-send').addEventListener('click', () => this.send());
      w.querySelectorAll('.ch-tab').forEach((b) => b.addEventListener('click', () => {
        if (this.contact === b.dataset.c) return;
        this.contact = b.dataset.c;
        SN.Audio.sfx('select');
        this.renderChat();
        this.refresh();
      }));
      // La foto de LOS DESFASADOS: tres llamadas a su puerta
      w.querySelector('.ch-ava').addEventListener('click', () => {
        if (this.contact !== 'ser') return;
        this.avaHits = (this.avaHits || 0) + 1;
        SN.Audio.sfx('thud');
        if (this.avaHits >= 3) { this.avaHits = 0; SN.Cipher.discover('avatar'); }
      });
      if (this.contact === 'ser' && !this.ser().log.length) this.contact = 'kevo';
      if (this.contact === 'bravo' && !this.bravo().log.length) this.contact = 'kevo';
      this.renderChat();
    },

    replyDone() { const c = this.convo(); return !!c && this.chat().typed >= c.reply.length; },
    // ¿Está abierta la conversación con Kevo? (a los demás contactos no se les puede escribir)
    onKevo() { return (this.contact || 'kevo') === 'kevo'; },

    // Cada tecla pone un trocito de la respuesta (de 1 a 3 letras, como quien escribe rápido)
    typeChunk() {
      const ch = this.chat(), c = this.convo();
      if (!c || !this.onKevo() || ch.phase !== 'reply' || this.replyDone()) return;
      ch.typed = Math.min(c.reply.length, ch.typed + 1 + Math.floor(Math.random() * 3));
      this.renderInput();
    },

    send() {
      const ch = this.chat(), c = this.convo();
      if (!c || !this.onKevo() || ch.phase !== 'reply' || !this.replyDone()) return;
      ch.log.push({ who: 'm', t: c.reply });
      ch.phase = 'out'; ch.k = 0; ch.typed = 0;
      SN.Audio.sfx('select');
      SN.Save.saveRun();
      this.renderChat();
      this.pump();
    },

    renderInput() {
      const w = this.wins.chat;
      if (!w) return;
      const ch = this.chat(), c = this.convo();
      const box = w.querySelector('.ch-box'), btn = w.querySelector('.ch-send');
      if (ch.phase === 'reply' && c) {
        const txt = c.reply.slice(0, ch.typed);
        box.innerHTML = txt ? `${esc(txt)}<i class="caret"></i>` : '<span class="ph">Pulsa cualquier tecla para escribir<kbd>⌨</kbd></span><i class="caret"></i>';
        box.classList.add('live');
        btn.disabled = !this.replyDone();
        btn.classList.toggle('ready', this.replyDone());
      } else {
        box.innerHTML = this.kevoGone() && ch.offline ? '<span class="ph">Kevo no está. Tus mensajes no se entregan.</span>' : '<span class="ph">…</span>';
        box.classList.remove('live');
        btn.disabled = true;
        btn.classList.remove('ready');
      }
    },

    renderChat() {
      const w = this.wins.chat;
      if (!w) return;
      const ch = this.chat(), f = C().friend, cs = this.ser(), cb = this.bravo();
      // Pestañas: Kevo y, cuando escriben, LOS DESFASADOS (hasta que se despiden, en el final B) y Bravo Fines
      const tabs = w.querySelector('.ch-tabs');
      const serOn = cs.log.length && !cs.gone;
      tabs.classList.toggle('hidden', !serOn && !cb.log.length);
      if (cs.gone && this.contact === 'ser') this.contact = 'kevo';
      const stab = tabs.querySelector('.ser');
      stab.classList.toggle('hidden', !serOn);
      stab.innerHTML = `${cx(X().contact.name)}<b class="badge${cs.unread ? '' : ' hidden'}">${cs.unread || ''}</b>`;
      const bt = tabs.querySelector('.bravo');
      bt.classList.toggle('hidden', !cb.log.length);
      bt.innerHTML = `${esc(B().guru.name)}<b class="badge${cb.unread ? '' : ' hidden'}">${cb.unread || ''}</b>`;
      const kb = tabs.querySelector('[data-c="kevo"] .badge');
      kb.textContent = ch.unread || ''; kb.classList.toggle('hidden', !ch.unread || this.contact === 'kevo');
      tabs.querySelectorAll('.ch-tab').forEach((b) => b.classList.toggle('on', b.dataset.c === (this.contact || 'kevo')));
      if (this.contact === 'ser') { this.renderSer(w); return; }
      if (this.contact === 'bravo') { this.renderBravo(w); return; }
      const ava = w.querySelector('.ch-ava');
      if (ava.dataset.who !== 'kevo') { ava.innerHTML = ''; ava.appendChild(SN.Sprites.node('avaKevo', 2)); ava.dataset.who = 'kevo'; ava.classList.remove('ser', 'bravo'); }
      if (this.topWin() === 'chat') ch.unread = 0;
      w.querySelector('.ch-nick').textContent = ch.nick || f.nick;
      const st = w.querySelector('.ch-status');
      // Desde que desapareció: "desconectado desde hace N días"
      const gone = ch.goneDay != null && ch.offline && ch.phase === 'wait' ? S.run.day - ch.goneDay : null;
      st.textContent = ch.offline ? (gone ? `Desconectado desde hace ${gone} día${gone === 1 ? '' : 's'}` : 'Desconectado') : 'Conectado';
      st.className = 'ch-status' + (ch.offline ? ' off' : '');
      const log = w.querySelector('.ch-log');
      log.innerHTML = ch.log.length ? '' : `<p class="ch-sys">${esc(f.name)} todavía no ha escrito.</p>`;
      // Varios mensajes seguidos de la misma persona van en un bloque con su nombre una sola vez
      let prev = null;
      for (const m of ch.log) {
        if (m.who === 's') { log.insertAdjacentHTML('beforeend', `<p class="ch-sys">${esc(m.t)}</p>`); prev = null; continue; }
        const head = m.who !== prev ? `<b>${esc(m.who === 'f' ? f.name : 'Tú')}</b>` : '';
        log.insertAdjacentHTML('beforeend', `<p class="ch-msg ${m.who}${head ? ' first' : ''}">${head}${esc(m.t)}</p>`);
        prev = m.who;
      }
      SN.KW.apply(log);
      log.scrollTop = log.scrollHeight;
      w.querySelector('.ch-typing').textContent = this.typing ? `${f.name} está escribiendo…` : '';
      this.renderInput();
    },

    // ---------- LOS DESFASADOS: escriben en el idioma secreto; no se les puede contestar ----------
    ser() {
      if (!S.run) return {};
      if (!S.run.chatSer) S.run.chatSer = { i: 0, log: [], unread: 0, offline: false };
      return S.run.chatSer;
    },
    // ¿Toca otro mensaje? (mismas condiciones que las conversaciones de Kevo)
    serCheck() {
      if (!S.run || S.run.over || SN.Game.state !== 'GAMEPLAY' || this.serT) return;
      const cs = this.ser(), ch = this.chat();
      if (SN.Cipher.count() > 0 && ch.flags.cipher == null) ch.flags.cipher = ch.clock;
      const m = X().messages[cs.i];
      const ready = m && (this.ready(m) || (m.orWhen && this.ready({ when: m.orWhen, delay: m.orDelay || 0 })));
      if (!ready) return;
      this.serT = setTimeout(() => { this.serT = null; this.serDeliver(m); }, 1600);
    },
    serDeliver(m) {
      if (!S.run || SN.Game.state !== 'GAMEPLAY') return;
      const cs = this.ser(), name = X().contact.name;
      if (m.hood) {
        // El encapuchado sabe de este idioma: entra en la conversación y les manda callar
        for (const l of m.hood) cs.log.push(l.startsWith('*') ? { who: 's', t: l.slice(1) } : { who: 'h', t: l });
        cs.offline = true;
        SN.FX.glitch(0.5, 1.2);
        SN.Audio.sfx('static', { dur: 0.5 });
      } else {
        if (cs.offline || m.back) { if (cs.offline) cs.log.push({ who: 's', t: `${name} se ha conectado.` }); cs.offline = false; }
        cs.log.push({ who: 'x', t: m.text });
        SN.Audio.sfx('notify');
        SN.FX.glitch(0.2, 0.6);
        // Con algunos mensajes llega una parte de NULL.EXE
        if (m.null) {
          S.run.nullParts = Math.max(S.run.nullParts || 0, m.null);
          cs.log.push({ who: 's', t: `Archivo recibido: NULL.EXE (parte ${m.null} de 3)` });
          this.renderIcons();
        }
      }
      cs.i++;
      const reading = this.open && this.topWin() === 'chat' && this.contact === 'ser';
      if (!reading) cs.unread = (cs.unread || 0) + 1;
      if (!this.open) this.toast('', m.hood ? `<b>???</b> ${esc(m.hood[1] || '')}` : `<b>${cx(name)}</b> ${cx(m.text)}`);
      SN.Save.saveRun();
      this.renderChat();
      this.refresh();
      this.serCheck();
    },
    // El final: lo que les quede por decir, ya (sin esperar turnos)
    async serFlush() {
      clearTimeout(this.serT); this.serT = null;
      const cs = this.ser();
      while (X().messages[cs.i]) { this.serDeliver(X().messages[cs.i]); clearTimeout(this.serT); this.serT = null; await SN.wait(1.6); }
    },
    // Final B: LOS DESFASADOS se despiden (por primera vez en letras normales) y su contacto desaparece
    async serFarewell(text) {
      const cs = this.ser();
      cs.log.push({ who: 'v', t: text });
      cs.unread = (cs.unread || 0) + 1;
      SN.Audio.sfx('notify');
      this.toast('', `<b>${cx(X().contact.name)}</b> ${esc(text)}`);
      this.renderChat();
      await SN.wait(5);
      cs.log.push({ who: 's', t: `${X().contact.name} ya no existe.` });
      cs.gone = true;
      SN.Save.saveRun();
      this.renderChat();
      this.refresh();
    },
    renderSer(w) {
      const cs = this.ser(), name = X().contact.name;
      if (this.topWin() === 'chat') cs.unread = 0;
      const ava = w.querySelector('.ch-ava');
      if (ava.dataset.who !== 'ser') { ava.innerHTML = ''; ava.appendChild(SN.Sprites.node('avaSer', 2)); ava.dataset.who = 'ser'; ava.classList.add('ser'); }
      w.querySelector('.ch-nick').innerHTML = cx(name);
      const st = w.querySelector('.ch-status');
      st.textContent = cs.offline ? 'Desconectado' : 'Conectado';
      st.className = 'ch-status' + (cs.offline ? ' off' : '');
      const log = w.querySelector('.ch-log');
      log.innerHTML = '';
      let prev = null;
      for (const m of cs.log) {
        if (m.who === 's') { log.insertAdjacentHTML('beforeend', `<p class="ch-sys">${esc(m.t).replace(name, cx(name))}</p>`); prev = null; continue; }
        const head = m.who !== prev ? `<b>${m.who === 'h' ? '???' : cx(name)}</b>` : '';
        // 'v': su despedida, en letras normales (ya no hace falta el idioma secreto)
        log.insertAdjacentHTML('beforeend', `<p class="ch-msg ${m.who === 'h' ? 'hood' : 'ser'}${head ? ' first' : ''}">${head}${m.who === 'h' || m.who === 'v' ? esc(m.t) : cx(m.t)}</p>`);
        prev = m.who;
      }
      log.scrollTop = log.scrollHeight;
      w.querySelector('.ch-typing').textContent = '';
      const box = w.querySelector('.ch-box'), btn = w.querySelector('.ch-send');
      box.innerHTML = '<span class="ph">No puedes responder a este contacto</span>';
      box.classList.remove('live');
      btn.disabled = true;
      btn.classList.remove('ready');
    },

    // ---------- Bravo Fines: el gurú manda frases (js/data/academy.js) y no lee lo que le contestan ----------
    bravo() {
      if (!S.run) return {};
      if (!S.run.chatBravo) S.run.chatBravo = { i: 0, log: [], unread: 0 };
      return S.run.chatBravo;
    },
    bravoCheck() {
      if (!S.run || S.run.over || SN.Game.state !== 'GAMEPLAY' || this.bravoT || !SN.Data.academy) return;
      const cb = this.bravo(), m = B().messages[cb.i];
      if (!m || !this.ready(m)) return;
      cb.i++;
      // Las frases llegan una a una, como si las escribiera (con mucha seguridad)
      const lines = m.lines.slice();
      const next = () => {
        this.bravoT = null;
        if (!S.run || !lines.length) { SN.Save.saveRun(); this.bravoCheck(); return; }
        const line = lines.shift();
        cb.log.push({ who: 'b', t: line });
        const reading = this.open && this.topWin() === 'chat' && this.contact === 'bravo';
        if (!reading) cb.unread = (cb.unread || 0) + 1;
        SN.Audio.sfx('notify');
        if (!this.open) this.toast('', `<b>${esc(B().guru.name)}</b> ${esc(line)}`);
        SN.Events.emit('bravo:message', { line });
        this.renderChat();
        this.refresh();
        this.bravoT = setTimeout(next, 900 + Math.min(1200, (lines[0] || '').length * 30));
      };
      this.bravoT = setTimeout(next, 1200);
    },
    renderBravo(w) {
      const cb = this.bravo(), g = B().guru;
      if (this.topWin() === 'chat') cb.unread = 0;
      const ava = w.querySelector('.ch-ava');
      if (ava.dataset.who !== 'bravo') { ava.innerHTML = ''; ava.appendChild(SN.Chars.bravoFace()); ava.dataset.who = 'bravo'; ava.classList.remove('ser'); ava.classList.add('bravo'); }
      w.querySelector('.ch-nick').textContent = g.nick;
      const st = w.querySelector('.ch-status');
      st.textContent = 'Conectado · cerrando tratos';
      st.className = 'ch-status';
      const log = w.querySelector('.ch-log');
      log.innerHTML = '';
      let first = true;
      for (const m of cb.log) {
        log.insertAdjacentHTML('beforeend', `<p class="ch-msg bravo${first ? ' first' : ''}">${first ? `<b>${esc(g.name)}</b>` : ''}${esc(m.t)}</p>`);
        first = false;
      }
      log.scrollTop = log.scrollHeight;
      w.querySelector('.ch-typing').textContent = this.bravoT ? `${g.name} está escribiendo…` : '';
      const box = w.querySelector('.ch-box'), btn = w.querySelector('.ch-send');
      box.innerHTML = '<span class="ph">Bravo Fines no lee mensajes. Solo los manda.</span>';
      box.classList.remove('live');
      btn.disabled = true;
      btn.classList.remove('ready');
      if (SN.KW) SN.KW.apply(log);
    },

    // ---------- Símbolos: la tabla del idioma secreto ----------
    renderIcons() {
      const root = $('desktop');
      const b = root && root.querySelector('.dt-icon[data-app="symbols"]');
      if (b) b.classList.toggle('hidden', !SN.Cipher || SN.Cipher.count() === 0);
      // NULL.EXE: aparece con la primera parte; la insignia dice cuántas tienes
      const n = root && root.querySelector('.dt-icon[data-app="null"]');
      if (n) {
        const parts = this.nullParts();
        n.classList.toggle('hidden', !parts || !!(S.run && S.run.finale && S.run.finale.phase === 'done'));
        const badge = n.querySelector('.badge');
        badge.textContent = parts >= 3 ? '!' : `${parts}/3`;
        badge.classList.toggle('hidden', !parts);
        n.classList.toggle('ready', parts >= 3);
      }
    },
    nullParts() { return (S.run && S.run.nullParts) || 0; },
    renderSymbols() {
      const w = this.wins.symbols;
      if (!w) return;
      const C = SN.Cipher, fresh = SN.UI.freshLetter;
      const cells = X().clues.map((c) => {
        const known = C.knows(c.letter);
        return `<div class="sy-cell${known ? ' on' : ''}${c.letter === fresh ? ' fresh' : ''}" title="${known ? esc(c.where) : ''}"><b class="cx">${X().alphabet[c.letter]}</b><i>=</i><b class="${known ? 'cx-k' : 'q'}">${known ? c.letter : '?'}</b></div>`;
      }).join('');
      const missing = X().clues.filter((c) => !C.knows(c.letter));
      const shown = missing.slice(0, Math.min(missing.length, 1 + (C.state().hints || 0)));
      w.querySelector('.dt-body').innerHTML = `<div class="sy-head">${C.count()}/${C.total()} símbolos</div><div class="sy-grid">${cells}</div>` +
        (missing.length ? `<div class="sy-hints"><b>Pistas</b>${shown.map((c) => `<p>· ${esc(c.hint)}</p>`).join('')}</div>` : '<div class="sy-hints"><b>Ya puedes leerlo todo.</b></div>');
    },
    // Un símbolo nuevo: aparece la app, se marca y todo lo que hay abierto se traduce un poco más
    onCipher() {
      this.renderIcons();
      const nm = $('desktop').querySelector('.dt-icon[data-app="futuro"] .nm');
      if (nm) nm.innerHTML = SN.Cipher.brand();
      this.refresh();
      const badge = $('desktop').querySelector('.dt-icon[data-app="symbols"] .badge');
      if (badge && !(this.open && this.topWin() === 'symbols')) { badge.textContent = '+1'; badge.classList.remove('hidden'); }
      this.renderSymbols();
      this.renderChat();
      this.refreshNotes();
      this.refreshTrash();
    },

    // ---------- NULL.EXE: el LÉEME (roto hasta tener las tres partes) y la terminal del final B ----------
    buildNull(w) {
      const parts = this.nullParts(), F = SN.Data.finale, body = w.querySelector('.dt-body');
      const choosing = SN.Finale && SN.Finale.choosing();
      if (parts < 3) {
        // Incompleto: lo poco que se lee está en el idioma secreto
        const junk = X().messages.filter((m) => m.null && m.null <= parts).map((m) => `<p>${cx(m.text)}</p>`).join('');
        body.innerHTML = `<div class="nu"><div class="nu-err">ARCHIVO INCOMPLETO · parte ${parts} de 3</div>${junk}<p class="nu-junk">${'▓▒░ '.repeat(18)}</p></div>`;
        return;
      }
      body.innerHTML = `<div class="nu"><div class="nu-txt">${F.readme.map((p, i) => `<p${i ? '' : ' class="nu-h"'}>${esc(p)}</p>`).join('')}</div></div>`;
      const run = U.el('button', 'btn btn-coral nu-run', choosing ? 'Ejecutar NULL.EXE' : 'Todavía no');
      run.disabled = !choosing;
      run.addEventListener('click', (e) => { e.stopPropagation(); if (SN.Finale.choosing()) SN.Finale.choose('B'); });
      body.querySelector('.nu').appendChild(run);
    },
    // La terminal: lo que pinta js/systems/finale.js (líneas, el comando que se escribe y su cursor)
    renderTerm() {
      const w = this.wins.term, T = SN.Finale && SN.Finale.term;
      if (!w || !T) return;
      const body = w.querySelector('.dt-body');
      const lines = T.lines.map((l) => `<p class="tm-${l.k || 'out'}">${esc(l.t)}</p>`).join('');
      const cur = T.typing ? `<p class="tm-cmd">${esc(T.prompt + T.typing.text.slice(0, T.typing.shown))}<i class="caret"></i></p>` : '';
      const hint = T.typing && !T.typing.shown ? '<p class="tm-hint">Pulsa cualquier tecla para escribir</p>' : '';
      body.innerHTML = `<div class="tm">${lines}${cur}${hint}</div>`;
      const box = body.querySelector('.tm');
      box.scrollTop = box.scrollHeight;
    },

    // ---------- Notas y Papelera ----------
    refreshNotes() {
      const w = this.wins.notes;
      if (!w || !S.run) return;
      const run = S.run, paid = !!run.flags.debtPaid, d = run.debt;
      const box = (on) => (on ? '[x]' : '[ ]');
      // Las deudas que llegaron después también van a la lista (la última, sin tachar si no está pagada)
      const later = [...(run.debts || []), d].filter((x) => x && x.id !== 'pleyzeta').slice(-3)
        .map((x) => `${box(x.paid)} Pagar ${esc(x.label)}: ${U.money(x.amount)} · día ${x.deadlineDay}`).join('\n');
      w.querySelector('.dt-body').innerHTML = `<pre class="nt">COSAS QUE HACER
${box(paid)} Pagar la Pleyzeta: ${U.money(SN.Data.sim.startDebt)} · día 7${later ? '\n' + later : ''}
${box(false)} Comprar ramen (otra vez)
${box(this.chat().i > 0)} Contestar a Kevo
${box(false)} NO apostarlo todo
${box(false)} Dormir${this.kevoGone() ? `\n${box(false)} Encontrar a Kevo` : ''}${this.ghostLine()}</pre>`;
      SN.KW.apply(w.querySelector('.nt'));
      const gh = w.querySelector('.nt-ghost');
      if (gh) gh.addEventListener('click', () => { SN.Audio.sfx('select'); SN.Cipher.discover('notas'); });
    },
    // De noche aparece una línea que nadie escribió (o que ya se lee, si la descifraste)
    ghostLine() {
      const night = S.run && S.run.turn === 2;
      if (!night && !SN.Cipher.found('notas')) return '';
      return `\n<span class="nt-ghost${SN.Cipher.found('notas') ? ' read' : ''}">${cx(X().hidden.notas)}</span>`;
    },
    refreshTrash() { if (this.wins.trash) this.buildTrash(this.wins.trash); },
    buildTrash(w) {
      const files = [
        ['curriculum_FINAL_v3.doc', '12 KB', 'Lo tiraste por algo.'],
        ['ahorros.xls', '0 KB', 'Está vacío. Como la cuenta.'],
        ['dieta_lunes.txt', '1 KB', 'Empezaba el lunes. ¿Qué lunes?'],
      ];
      // Desde el día 3 aparece un archivo que tú no tiraste
      if (S.run && (S.run.day >= 3 || SN.Cipher.found('papelera'))) files.push(['no_abrir.txt', '1 KB', null]);
      // Desde que Kevo desapareció: intentaste borrar FUTURO.exe... y volvió solo
      if (this.kevoGone()) files.push(['FUTURO.exe', '6,66 MB', 'Lo tiraste anoche. Ha vuelto solo al escritorio.']);
      const body = w.querySelector('.dt-body');
      body.innerHTML = '<div class="tr-list"></div><div class="tr-note">Haz clic en un archivo</div>';
      for (const [n, size, joke] of files) {
        const b = U.el('button', 'tr-file' + (joke ? '' : ' odd'), `<span>${esc(n)}</span><em>${size}</em>`);
        b.addEventListener('click', () => {
          SN.Audio.sfx('select');
          const note = body.querySelector('.tr-note');
          if (joke) { note.textContent = joke; return; }
          note.innerHTML = cx(X().hidden.papelera);
          SN.Cipher.discover('papelera');
        });
        body.querySelector('.tr-list').appendChild(b);
      }
    },
  };
})(window.SN);
