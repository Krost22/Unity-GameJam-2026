// Ventanas de diálogo integradas en el monitor: retrato animado, texto a máquina y,
// en el tutorial, pequeños ejemplos animados.
// Se avanza con un clic EN CUALQUIER PARTE o con ESPACIO / ENTER (y se dice en pantalla).
// Un diálogo "sticky" es una indicación que no bloquea: se queda visible mientras haces lo que pide.
(function (SN) {
  'use strict';
  const P = SN.PAL, Px = SN.Px, U = SN.Util;

  const D = SN.Dialog = {
    el: null, txt: null, portrait: null, demo: null, catcher: null,
    lines: [], idx: 0, shown: 0, full: '', resolve: null, t: 0, opts: null,
    active: false,   // esperando a que el jugador avance (bloquea el resto de la interfaz)
    shownAt: 0,

    init() {
      // Cualquier clic (dentro o fuera del monitor) avanza el diálogo abierto
      document.addEventListener('click', (e) => {
        if (!this.active || performance.now() - this.shownAt < 150) return;
        if (e.target.closest && e.target.closest('#btn-skip')) return;
        this.advance();
      });
    },

    // Muestra una lista de frases; devuelve una promesa que se resuelve al cerrar la última.
    // opts: { pos, name, demo, glitchy, smile, voice, portrait, sticky }
    show(lines, opts = {}) {
      this.hide();
      this.opts = opts;
      this.lines = lines.slice();
      this.idx = 0;
      this.active = !opts.sticky;
      this.shownAt = performance.now();
      const layer = document.getElementById('layer-dialog');
      const pos = opts.pos || { v: 'bottom', h: 'center' };
      const el = U.el('div', `dlg ${pos.v} ${pos.h}${opts.demo ? ' has-demo' : ''}${opts.glitchy ? ' glitchy' : ''}${opts.sticky ? ' sticky' : ''}`);
      el.innerHTML = `<div class="portrait"></div><div class="name"></div><div class="txt"></div><div class="next">CLIC<kbd>ESPACIO</kbd>▶</div>`;
      el.querySelector('.name').textContent = opts.name || SN.Data.story.hoodedName;
      this.portrait = Px.canvas(40, 40);
      el.querySelector('.portrait').appendChild(this.portrait);
      if (opts.demo) {
        this.demo = Px.canvas(56, 34);
        const d = U.el('div', 'demo');
        d.appendChild(this.demo);
        el.appendChild(d);
      } else this.demo = null;
      // Capa invisible: mientras hay que leer, ningún botón de debajo recibe el clic por error
      if (!opts.sticky) {
        this.catcher = U.el('div', 'dlg-catch');
        layer.appendChild(this.catcher);
      }
      layer.appendChild(el);
      this.el = el;
      this.txt = el.querySelector('.txt');
      this.startLine();
      return new Promise((r) => { this.resolve = r; });
    },

    startLine() {
      this.full = (this.lines[this.idx] || '').toUpperCase();
      this.shown = 0;
      this.txt.textContent = '';
      this.el.querySelector('.next').style.visibility = 'hidden';
      if (this.opts.onLine) this.opts.onLine(this.idx);
    },

    // Con el texto a medias, el primer clic lo completa; el siguiente pasa de frase
    advance() {
      if (!this.active) return;
      if (this.shown < this.full.length) { this.shown = this.full.length; this.renderText(); return; }
      SN.Audio.sfx('click');
      this.idx++;
      if (this.idx >= this.lines.length) {
        const r = this.resolve;
        this.hide();
        if (r) r();
      } else this.startLine();
    },

    renderText() {
      if (!this.el) return;
      this.txt.textContent = this.full.slice(0, Math.floor(this.shown));
      if (this.shown >= this.full.length) this.el.querySelector('.next').style.visibility = 'visible';
    },

    hide() {
      this.active = false;
      this.resolve = null;
      if (this.el) this.el.remove();
      if (this.catcher) this.catcher.remove();
      this.el = this.catcher = null;
    },

    update(dt) {
      if (!this.el) return;
      this.t += dt;
      if (this.shown < this.full.length) {
        const before = Math.floor(this.shown);
        this.shown = Math.min(this.full.length, this.shown + dt * 48);
        const now = Math.floor(this.shown);
        if (now !== before) {
          this.renderText();
          if (now % 2 === 0 && this.full[now - 1] !== ' ') SN.Audio.sfx('type', { voice: this.opts.voice || 'hood' });
        }
      }
      // Retrato
      const g = Px.ctx(this.portrait);
      Px.rect(g, 0, 0, 40, 40, P.coalD);
      if (this.opts.portrait !== 'none') {
        g.drawImage(SN.Chars.hoodedCanvas(this.t, { look: Math.sin(this.t * 0.8) > 0.7 ? 1 : 0, smile: this.opts.smile }), 0, 0);
        if (this.opts.glitchy && Math.random() < 0.08) Px.rect(g, 0, U.randi(0, 38), 40, 2, U.pick([P.coral, P.cyan, P.creamL]));
      }
      if (this.demo) drawDemo(this.opts.demo, Px.ctx(this.demo), this.t);
    },
  };

  // Ejemplos animados (se conservan por si se quieren usar en diálogos futuros)
  function drawDemo(kind, g, t) {
    Px.rect(g, 0, 0, 56, 34, P.creamL);
    if (kind === 'candles') {
      const k = (t % 2) / 2;
      Px.rect(g, 11, 4, 1, 22, P.greenD);
      const gh = Math.round(14 * Math.min(1, k * 2));
      Px.rect(g, 9, 22 - gh, 5, gh + 1, P.green); Px.rect(g, 13, 22 - gh, 1, gh + 1, P.greenD);
      Px.text(g, '▲', 7, 33, P.greenD);
      Px.rect(g, 40, 6, 1, 22, P.coralD);
      const rh = Math.round(14 * Math.max(0, Math.min(1, k * 2 - 0.6)));
      Px.rect(g, 38, 9, 5, rh + 1, P.coral); Px.rect(g, 42, 9, 1, rh + 1, P.coralD);
      Px.text(g, '▼', 36, 33, P.coralD);
    }
  }
})(window.SN);
