// Escritorio del PC: FUTURO.exe se minimiza (botón _ o tecla D) y debajo está el ordenador del
// protagonista, con sus programas: Mensajín (chat con Kevo), Notas y Papelera.
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
  ];

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
        b.insertAdjacentHTML('beforeend', `<span>${ic.name}</span><b class="badge hidden"></b>`);
        b.addEventListener('click', () => { SN.Audio.sfx('click'); this.launch(ic.id); });
        icons.appendChild(b);
      }
      root.querySelector('.dt-start').addEventListener('click', () => { SN.Audio.sfx('click'); this.restore(); });
      $('btn-min').querySelector('.ico-min').style.backgroundImage = `url(${SN.Sprites.url('icoMin', 1)})`;
      $('btn-min').addEventListener('click', () => this.minimize());
      SN.Events.on('turn:ready', () => { if (S.run) this.chat().clock++; this.check(); });
      SN.Events.on('chat:flag', ({ flag }) => this.flag(flag));
      SN.Events.on('piggy:broken', () => this.flag('piggy'));
      SN.Events.on('trade:closed', (r) => { if (r && (r.liquidated || r.pnl <= -Math.max(50, r.amount * 0.6))) this.flag('bigLoss'); });
      SN.Events.on('debt:paid', () => this.refreshNotes());
    },

    // Partida nueva: todo cerrado y FUTURO.exe a la vista
    reset() {
      clearTimeout(this.timer); this.timer = null; this.typing = false;
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
      if (!this.open) return;
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
      const title = { chat: C().app, notes: 'Notas.txt', trash: 'Papelera' }[id];
      w.innerHTML = `<div class="dt-head"><span>${title}</span><button class="dt-x" title="Cerrar (Esc)">×</button></div><div class="dt-body"></div>`;
      w.querySelector('.dt-x').addEventListener('click', (e) => { e.stopPropagation(); this.closeWin(id); });
      w.addEventListener('mousedown', () => this.focus(id));
      $('desktop').querySelector('.dt-wins').appendChild(w);
      this.wins[id] = w;
      SN.Audio.sfx('open');
      if (id === 'chat') this.buildChat(w);
      if (id === 'notes') this.refreshNotes();
      if (id === 'trash') this.buildTrash(w);
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
        const b = U.el('button', 'dt-task' + (id === 'futuro' ? ' min' : '') + (this.topWin() === id ? ' on' : ''), esc(name));
        b.addEventListener('click', () => this.launch(id));
        tasks.appendChild(b);
      };
      add('futuro', 'FUTURO.exe');
      for (const id of Object.keys(this.wins)) add(id, { chat: C().app, notes: 'Notas', trash: 'Papelera' }[id]);
      const names = SN.Data.sim.turnNames || ['Mañana', 'Tarde', 'Noche'];
      root.querySelector('.dt-clock').textContent = `Día ${S.run.day} · ${names[S.run.turn] || ''}`;
      const unread = this.chat().unread || 0;
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
          if (this.canMinimize()) { e.preventDefault(); this.minimize(); return true; }
        }
        return false;
      }
      e.preventDefault();
      const top = this.topWin();
      if (e.code === 'Escape') { if (top) this.closeWin(top); else this.restore(); return true; }
      if (top === 'chat' && this.chat().phase === 'reply') {
        if (e.code === 'Enter' && this.replyDone()) this.send();
        else if (!e.repeat || Math.random() < 0.35) this.typeChunk();
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
      // Primero las reacciones a lo que acaba de pasar; luego la historia principal
      const side = C().side.find((c) => !ch.sideDone[c.id] && this.ready(c));
      if (side) ch.side = side.id;
      else {
        ch.side = null;
        let c = C().convos[ch.i];
        while (c && c.skipIf && ch.flags[c.skipIf] != null) c = C().convos[++ch.i];
        if (!c || !this.ready(c)) return;
      }
      const c = this.convo();
      ch.phase = 'in'; ch.k = 0; ch.typed = 0;
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
        }
        SN.Save.saveRun();
        this.renderChat();
        this.refresh();
        if (ch.phase === 'wait') this.check();
        return;
      }
      const line = lines[ch.k];
      // '>evento': pasa algo al otro lado de la ventana (sin mensaje en el chat)
      if (line.startsWith('>')) { ch.k++; SN.Desk.windowEvent(line.slice(1)); this.pump(); return; }
      const delay = line.startsWith('*') || line === '!zumbido' ? 500 : 450 + Math.min(1400, line.length * 38);
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
      } else {
        ch.log.push({ who: 'f', t: line });
      }
      const reading = this.open && this.topWin() === 'chat';
      if (!reading && !line.startsWith('*')) ch.unread = (ch.unread || 0) + 1;
      if (line.startsWith('*')) SN.Audio.sfx('close'); else SN.Audio.sfx('notify');
      if (!this.open && line !== '!zumbido' && !line.startsWith('*')) this.toast(line);
      this.renderChat();
      this.refresh();
    },

    nudge() {
      SN.Audio.sfx('thud');
      const el = this.open ? (this.wins.chat || $('desktop')) : $('screen');
      el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
      SN.FX.shake(3, 0.35);
    },

    // Aviso dentro de FUTURO.exe: clic para ir al chat
    toast(line) {
      const layer = $('layer-top');
      let t = layer.querySelector('.msg-toast');
      if (!t) {
        t = U.el('button', 'msg-toast');
        t.addEventListener('click', () => { t.remove(); this.minimize('chat'); });
        layer.appendChild(t);
      }
      t.innerHTML = `<i></i><span><b>${esc(C().friend.name)}</b> ${esc(line)}</span><kbd>D</kbd>`;
      t.querySelector('i').appendChild(SN.Sprites.node('icoChat', 1));
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => t.remove(), 6000);
    },

    buildChat(w) {
      const f = C().friend;
      w.querySelector('.dt-body').innerHTML = `
        <div class="ch-who"><i class="ch-ava"></i><div><b class="ch-nick"></b><span class="ch-status"></span></div></div>
        <div class="ch-log"></div>
        <div class="ch-typing"></div>
        <div class="ch-input"><div class="ch-box"></div><button class="ch-send btn btn-green">Enviar<kbd>⏎</kbd></button></div>`;
      w.querySelector('.ch-ava').appendChild(SN.Sprites.node('avaKevo', 2));
      w.querySelector('.ch-send').addEventListener('click', () => this.send());
      void f;
      const ch = this.chat();
      ch.unread = 0;
      this.renderChat();
    },

    replyDone() { const c = this.convo(); return !!c && this.chat().typed >= c.reply.length; },

    // Cada tecla pone un trocito de la respuesta (de 1 a 3 letras, como quien escribe rápido)
    typeChunk() {
      const ch = this.chat(), c = this.convo();
      if (!c || ch.phase !== 'reply' || this.replyDone()) return;
      ch.typed = Math.min(c.reply.length, ch.typed + 1 + Math.floor(Math.random() * 3));
      this.renderInput();
    },

    send() {
      const ch = this.chat(), c = this.convo();
      if (!c || ch.phase !== 'reply' || !this.replyDone()) return;
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
        box.innerHTML = '<span class="ph">…</span>';
        box.classList.remove('live');
        btn.disabled = true;
        btn.classList.remove('ready');
      }
    },

    renderChat() {
      const w = this.wins.chat;
      if (!w) return;
      const ch = this.chat(), f = C().friend;
      if (this.topWin() === 'chat') ch.unread = 0;
      w.querySelector('.ch-nick').textContent = ch.nick || f.nick;
      const st = w.querySelector('.ch-status');
      st.textContent = ch.offline ? 'Desconectado' : 'Conectado';
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
      log.scrollTop = log.scrollHeight;
      w.querySelector('.ch-typing').textContent = this.typing ? `${f.name} está escribiendo…` : '';
      this.renderInput();
    },

    // ---------- Notas y Papelera ----------
    refreshNotes() {
      const w = this.wins.notes;
      if (!w || !S.run) return;
      const paid = SN.Debt && SN.Debt.paid;
      const box = (on) => (on ? '[x]' : '[ ]');
      w.querySelector('.dt-body').innerHTML = `<pre class="nt">COSAS QUE HACER
${box(paid)} Pagar la Pleyzeta: ${U.money(SN.Debt ? SN.Debt.amount : 250)} antes del día 7
${box(false)} Comprar ramen (otra vez)
${box(this.chat().i > 0)} Contestar a Kevo
${box(false)} NO apostarlo todo
${box(false)} Dormir</pre>`;
    },
    buildTrash(w) {
      const files = [
        ['curriculum_FINAL_v3.doc', '12 KB', 'Lo tiraste por algo.'],
        ['ahorros.xls', '0 KB', 'Está vacío. Como la cuenta.'],
        ['dieta_lunes.txt', '1 KB', 'Empezaba el lunes. ¿Qué lunes?'],
      ];
      const body = w.querySelector('.dt-body');
      body.innerHTML = '<div class="tr-list"></div><div class="tr-note">Haz clic en un archivo</div>';
      for (const [n, size, joke] of files) {
        const b = U.el('button', 'tr-file', `<span>${esc(n)}</span><em>${size}</em>`);
        b.addEventListener('click', () => { SN.Audio.sfx('select'); body.querySelector('.tr-note').textContent = joke; });
        body.querySelector('.tr-list').appendChild(b);
      }
    },
  };
})(window.SN);
