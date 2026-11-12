// =====================================================================================================
// PANEL DE DEPURACIÓN · QUITAR ANTES DE LA VERSIÓN FINAL
// Botones siempre visibles (arriba a la izquierda) para lanzar las animaciones y probarlas sin tener que
// llegar a ellas jugando. Solo funcionan con una partida en marcha y nada más pasando.
// Para quitarlo: borrar este archivo, su <script> en index.html y el bloque "Panel de depuración" de
// css/style.css. (Anotado también en el README, en "Pendiente antes de publicar".)
// =====================================================================================================
(function (SN) {
  'use strict';
  const S = SN.State;

  // Un evento especial cualquiera del día de la suerte
  const special = () => SN.Util.pick(Object.keys(SN.Data.luck.specials));

  // El rescate suelto: la escena y nada más (no cambia el dinero ni gasta la vida extra)
  async function rescue(from) {
    await SN.Bailout.play({ coins: S.rescueAmount(), from });
    SN.Audio.setMood('normal');
  }
  // El plano del puño en alto de la intro ("¡ES MÍA!")
  async function fist() {
    SN.Cine.setShot({ type: 'face', expr: 'star', opts: { fist: true }, confetti: true });
    SN.Audio.sfx('win', { big: true });
    await SN.wait(3.2);
    SN.Cine.setShot(null);
  }

  // El final: lleva la partida a la meta (como F11 con ?debug: todo desbloqueado y el dinero de la meta) y, si se
  // pide uno, lo elige en cuanto se puede. Acaba la partida, igual que el de verdad.
  async function finale(which) {
    SN.Game.debugFinale();
    if (!which) return; // (la elección la haces tú: la oferta del encapuchado o NULL.EXE en el escritorio)
    for (let i = 0; i < 600 && !(SN.Finale.choosing() && !SN.UI.busy); i++) await SN.wait(0.1);
    if (!SN.Finale.choosing()) return;
    // El final B empieza en el escritorio del PC (NULL.EXE abre allí su terminal, donde escribes los comandos):
    // el mismo camino que «Ir al escritorio» y «Ejecutar NULL.EXE». Elegirlo desde FUTURO.exe dejaba la terminal
    // escondida detrás de la aplicación y todo bloqueado.
    if (which === 'B') {
      for (let i = 0; i < 100 && !SN.Desktop.open; i++) {
        SN.Windows.close(true);
        if (SN.Desktop.canMinimize()) SN.Desktop.minimize('null');
        else await SN.wait(0.1);
      }
      await SN.wait(0.6);
    }
    await SN.Finale.choose(which);
  }

  // El embargo del final B, suelto: el agente entra, se lo lleva todo en la caja y arrastra el PC. Con todo
  // comprado, para verlo entero; al acabar, la habitación y la partida vuelven a como estaban
  async function raid() {
    const run = S.run, D = SN.Data, Dk = SN.Desk, had = Object.assign({}, run.owned);
    for (const id of [...D.keyItems.map((k) => k.id), ...D.shop.map((s) => s.id), ...D.luck.golden.map((g) => g.id)]) run.owned[id] = true;
    SN.UI.setBusy(true);
    Dk.phaseOverride = 'night';
    Dk.dirty();
    try {
      await SN.Finale.raid();
      await SN.wait(1.5);
    } finally {
      run.owned = had;
      Object.assign(Dk, { stripped: null, noPC: false, palaHere: false, palaPos: null, handsOff: false, phaseOverride: null });
      Dk.dirty();
      SN.Officer.reset();
      document.getElementById('monitor').classList.remove('hidden');
      SN.Game.camTo({ x: 320, y: 180, zoom: 1 }, 0.3);
      SN.UI.setBusy(false);
    }
  }

  const ACTIONS = [
    { label: 'Rescate: llamada', run: () => rescue('phone') },
    { label: 'Rescate: videollamada', run: () => rescue('call') },
    // La de verdad: SIN FONDOS, la llamada, el justificante y el dinero (sí suma el dinero del rescate)
    { label: 'Vida extra completa', run: () => { S.run.rescue = 'ready'; SN.UI.setBusy(true); return SN.Bankruptcy.broke(); } },
    { label: 'Puño de la intro', run: fist },
    { label: 'Día de la suerte', run: () => SN.UI.luckyCard({ k: 1, events: [special()] }) },
    { label: 'Día 77 (doble)', run: () => SN.UI.luckyCard({ k: 2, events: [special()] }) },
    // La escena del bono (no suma dinero: la deuda es de mentira)
    { label: 'Bono del encapuchado', run: () => SN.Narrative.payBonus({ bonus: S.rescueAmount(), bonusPending: false }) },
    // El final (los tres acaban la partida)
    { label: 'Final: llegar a la meta', run: () => finale() },
    { label: 'Final A (el avatar)', run: () => finale('A') },
    { label: 'Final B (NULL.EXE)', run: () => finale('B') },
    // Solo la escena de la Policía Fiscal (no acaba la partida)
    { label: 'Final B: el embargo', run: raid },
  ];

  // ¿Se puede lanzar algo ahora? (con la partida en marcha y sin nada más pasando)
  function ready() {
    return SN.Game.state === 'GAMEPLAY' && !!S.run && !SN.UI.busy && !SN.Bailout.active && !SN.Bankruptcy.active &&
      !SN.Cine.running && !SN.Cine.shot && !SN.Windows.current && !SN.Dialog.active && !SN.Finale.active();
  }

  SN.DebugPanel = {
    busy: false,
    init() {
      const el = document.createElement('div');
      el.id = 'debug-panel';
      el.className = 'px-font';
      el.innerHTML = '<div class="dp-h">DEBUG <i>· quitar al publicar</i></div>';
      for (const a of ACTIONS) {
        const b = document.createElement('button');
        b.textContent = a.label;
        b.addEventListener('click', (e) => { e.stopPropagation(); this.run(a, b); });
        el.appendChild(b);
      }
      document.body.appendChild(el);
      this.el = el;
      this.w1 = el.offsetWidth; // ancho a escala 1, desplegado
      setInterval(() => this.layout(), 150);
      this.layout();
    },
    // El panel nunca tapa FUTURO.exe: si cabe a la izquierda del monitor, desplegado y tan grande como quepa;
    // si no (ventana pequeña: el monitor ocupa toda la pantalla), una pestaña "DEBUG" que se abre al pasar el
    // ratón. Mientras pasa una escena se pliega (solo "DEBUG") para no tapar lo que estás probando.
    layout() {
      const el = this.el, mon = document.getElementById('monitor');
      const playing = this.busy || SN.Bailout.active || SN.Bankruptcy.active || SN.Cine.running || !!SN.Cine.shot || SN.Finale.busy;
      el.classList.toggle('mini', !!playing);
      if (!mon) return;
      const free = mon.getBoundingClientRect().left - 8;
      const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;
      const fits = free >= this.w1;
      const scale = fits ? Math.max(1, Math.min(Math.round(k), Math.floor(free / this.w1))) : Math.max(1, Math.round(k));
      const tf = `scale(${scale})`;
      if (el.style.transform !== tf) el.style.transform = tf;
      el.classList.toggle('tab', !fits);
    },
    async run(a, btn) {
      if (this.busy || !ready()) { this.say(SN.Game.state === 'GAMEPLAY' ? 'Espera a que termine lo que pasa' : 'Empieza una partida'); return; }
      this.busy = true;
      btn.classList.add('on');
      try { await a.run(); } catch (e) { console.error(e); }
      btn.classList.remove('on');
      this.busy = false;
      SN.UI.renderAll();
    },
    // Aviso corto en la cabecera del panel
    say(text) {
      const h = this.el.querySelector('.dp-h');
      h.textContent = text;
      h.classList.add('warn');
      clearTimeout(this.sayT);
      this.sayT = setTimeout(() => { h.classList.remove('warn'); h.innerHTML = 'DEBUG <i>· quitar al publicar</i>'; }, 1600);
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => SN.DebugPanel.init());
  else SN.DebugPanel.init();
})(window.SN);
