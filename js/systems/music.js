// MusicDirector: la música de Musics/ con fundidos, sin cortes y a compás (las pistas, en js/data/music.js).
//   · Cada momento tiene su pista: menú, partida, ganando, mercado negro, día de la suerte, Bravo Fines, el
//     encapuchado y el final. El director mira el estado del juego y decide cuál toca.
//   · Las pistas de la partida van a 90 BPM: un cambio espera al siguiente compás y la pista nueva entra por el
//     mismo compás en el que iba la anterior (no se pierde el ritmo).
//   · El bucle se cierra con un fundido muy corto entre dos copias del mismo archivo (el MP3 deja un hueco).
//   · Lo que no tiene pista propia se hace con la cinta y con un pulso a tempo: PERDIENDO frena la cinta (más
//     lenta y más grave, con vaivén); en las ÚLTIMAS VELAS y el ÚLTIMO DÍA de una deuda suena un tic-tac a
//     compás (js/systems/audio.js); al quedarte SIN DINERO la cinta se para.
//   · Con <audio> y no con Web Audio a propósito: así también funciona abriendo index.html con doble clic.
// Los efectos de sonido se afinan con la pista que suena: SN.Music.tonality().
(function (SN) {
  'use strict';
  const S = SN.State;
  const C = () => SN.Data.music;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;
  const bar = () => 60 / C().bpm * C().beatsPerBar;

  // En iPhone y iPad el volumen de un <audio> no se puede cambiar: allí se cambia de pista sin fundido
  let volOK = true;
  try { const t = new Audio(); t.volume = 0.5; volOK = Math.abs(t.volume - 0.5) < 0.01; } catch (_) { volOK = false; }

  const voices = {};
  const st = {
    enabled: false, timer: null, last: 0, unlocked: false,
    mood: 'normal', duck: false, dark: 0,
    main: null,      // pista que suena
    want: null,      // pista que toca
    switchAt: 0,     // cuándo se cambia (el siguiente compás)
    menu: 'menu1',   // parte del tema del menú que toca
    trade: null,     // operación en directo: { r: resultado / apostado, danger, settled }
    winUntil: 0,     // GANANDO se queda un rato tras una operación ganada
    ending: false,   // el final suena hasta la siguiente operación
    stopped: false,  // cinta parada (sin dinero) hasta que vuelva el ambiente normal
    force: null,     // una pista fija durante una escena (los finales): manda sobre todo lo demás
    pulseKind: null, // pulso a tempo pedido a mano ('danger' | 'clock'), p. ej. en la terminal de NULL.EXE
    tape: null,      // la cinta frenándose: { t, dur }
    mix: 0,          // volumen general de la música ahora mismo
    pulseIdx: -1,    // último golpe del pulso programado
    hidden: [],      // <audio> parados al ocultar la pestaña
  };

  // ---------- Voces: cada pista, con dos copias del archivo para cerrar el bucle ----------
  function voice(id) {
    if (voices[id]) return voices[id];
    const t = C().tracks[id];
    if (!t) return null;
    const v = { id, t, els: [], cur: 0, env: 0, target: 0, fade: C().fadeIn, rate: t.rate || 1, xf: null, playing: false, failed: false };
    for (let i = 0; i < (t.once || t.next ? 1 : 2); i++) {
      const a = new Audio();
      a.preload = 'auto';
      // Frenar la cinta también la vuelve más grave (como una cinta de verdad)
      a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
      a.addEventListener('error', () => { v.failed = true; });
      if (!volOK && !t.once && !t.next) a.loop = true; // sin volumen no hay fundido: bucle del navegador
      a.src = encodeURI(C().dir + t.file);
      try { a.volume = 0; } catch (_) { /* iOS */ }
      v.els.push(a);
    }
    voices[id] = v;
    return v;
  }
  const el = (v) => (v ? v.els[v.cur] : null);
  // (quitar el silencio también cancela el desbloqueo en curso de ese <audio>: ver unlockVoices)
  function play(a) { a.muted = false; try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* sin audio */ } }
  function seek(a, t) { try { a.currentTime = t; } catch (_) { /* todavía sin cargar */ } }
  function stopVoice(v) {
    for (const a of v.els) { try { a.pause(); } catch (_) { /* */ } }
    v.playing = false; v.xf = null; v.env = 0; v.target = 0;
  }
  function start(v, offset) {
    v.target = 1; v.fade = C().fadeIn;
    if (v.playing) return; // todavía sonaba (estaba saliendo): sigue por donde iba
    const a = el(v);
    offset = v.t.sync && isFinite(a.duration) && a.duration > 0 ? offset % a.duration : 0;
    // Si la entrada cae justo al final, mejor desde el principio (el bucle ya se cerraría)
    if (isFinite(a.duration) && a.duration - offset < 0.5) offset = 0;
    seek(a, offset);
    v.rate = rateFor(v, now());
    for (const x of v.els) x.playbackRate = v.rate;
    play(a);
    v.playing = true;
    const b = v.els[1 - v.cur];
    if (b) seek(b, 0); // la otra copia, lista en el principio para cerrar el bucle
  }

  // ---------- ¿Qué pista toca? ----------
  function winning(t) {
    const tr = st.trade, w = C().winning;
    if (tr && !tr.settled) return tr.r >= (st.main === 'win' ? w.stay : w.enter);
    return t < st.winUntil;
  }
  function resolve(t) {
    if (st.tape) return st.main;
    if (st.enabled && st.force) return st.force;
    if (!st.enabled || st.stopped) return null;
    const G = SN.Game, state = G && G.state;
    if (state === 'MENU' || state === 'BOOT' || state === 'INTRO') return st.menu;
    if (state !== 'GAMEPLAY' && state !== 'BANKRUPTCY') return st.main;
    if (st.ending) return 'final';
    const Dg = SN.Dialog, W = SN.Windows;
    const bravo = (Dg && Dg.active && Dg.opts && (Dg.opts.voice === 'bravo' || Dg.opts.portrait === 'bravo')) || (W && W.current === 'upgrades');
    if (bravo) return 'bravo';
    if (winning(t)) return 'win';
    const run = S.run;
    const def = run && SN.Data.marketById(run.selected);
    if (def && def.black) return 'black';
    if (SN.Luck && SN.Luck.today()) return 'lucky';
    return 'base';
  }
  // Entre pistas de la partida el cambio espera al siguiente compás; desde el menú o hacia el silencio, ya
  function planSwitch(id, t) {
    const v = voices[st.main], a = el(v), to = id && C().tracks[id];
    if (!v || !v.playing || !a || a.paused || !isFinite(a.duration) || st.mix < 0.05 || !v.t.sync || !to || !to.sync) return t;
    const p = a.currentTime, next = Math.ceil((p + 0.02) / bar()) * bar();
    return t + (next - p) / (a.playbackRate || 1);
  }
  function doSwitch(id) {
    const old = voices[st.main], to = id ? voice(id) : null;
    let offset = 0;
    // Mismo compás: la nueva pista entra por donde iba la anterior (todas a 90 BPM y de compases enteros)
    if (old && old.playing && to && old.t.sync && to.t.sync) { const a = el(old); if (a && isFinite(a.currentTime)) offset = a.currentTime; }
    if (old && old !== to) { old.target = 0; old.fade = C().fadeOut; }
    st.main = id;
    if (to) start(to, offset);
  }

  // ---------- Volumen general y velocidad de la cinta ----------
  function losingDepth() {
    const tr = st.trade, L = C().losing;
    if (!tr || tr.settled || tr.r >= -L.from) return 0;
    return clamp((-tr.r - L.from) / (L.full - L.from), 0, 1);
  }
  function mixTarget() {
    if (!st.enabled) return 0;
    const m = C().mix, tr = st.trade;
    let k = st.mood === 'silent' ? 0 : st.mood === 'tense' ? m.tense : 1;
    if (st.duck) k *= m.duck;
    if (SN.Desktop && SN.Desktop.open) k *= m.desktop;
    if (tr && !tr.settled && tr.danger) k *= m.danger;
    k *= 1 - (1 - m.losing) * losingDepth();
    const h = voices.hood;
    if (h && h.playing && h.env > 0.5) k *= m.sting;
    if (st.tape) k *= 1 - clamp(st.tape.t / st.tape.dur, 0, 1);
    return k;
  }
  function rateFor(v, t) {
    let r = v.t.rate || 1;
    if (v.t.once) return r;
    if (st.mood === 'tense') r *= C().tenseRate;
    if (v.t.sync) r *= 1 - st.dark * C().darkRate;
    // Perdiendo: la cinta se frena y se bambolea, más cuanto peor va
    const L = C().losing, k = v.id === st.main ? losingDepth() : 0;
    if (k > 0) r *= (1 - L.slow * k) * (1 + L.wobble * k * Math.sin(t * Math.PI * 2 * L.wobbleHz));
    // Sin dinero: la cinta se para
    if (st.tape && v.id === st.main) r *= Math.max(0.25, 1 - 0.75 * Math.pow(clamp(st.tape.t / st.tape.dur, 0, 1), 0.8));
    return r;
  }

  // ---------- Cada voz: fundido, final de la pista, bucle, volumen y velocidad ----------
  function update(v, dt, t) {
    if (!v.playing) return;
    const step = dt / Math.max(0.05, v.fade);
    v.env = v.target > v.env ? Math.min(v.target, v.env + step) : Math.max(v.target, v.env - step);
    if (v.env <= 0 && v.target <= 0) { stopVoice(v); return; }
    let a = el(v);
    // La de una vez se acaba sola
    if (v.t.once) { if (a.ended) { stopVoice(v); return; } }
    else if (v.t.next) {
      // Tema del menú: al acabar una parte entra la otra
      const left = (a.duration - a.currentTime) / (a.playbackRate || 1);
      if (v.id === st.main && isFinite(left) && left <= C().fadeOut) st.menu = v.t.next;
      if (a.ended) { stopVoice(v); return; }
    } else if (volOK) {
      // Bucle: la otra copia entra justo antes del final, con un fundido muy corto
      const left = (a.duration - a.currentTime) / (a.playbackRate || 1);
      if (!v.xf && isFinite(left) && !a.paused && left <= C().loopFade + 0.05) {
        const b = v.els[1 - v.cur];
        seek(b, 0);
        b.playbackRate = a.playbackRate;
        play(b);
        v.xf = { from: a, to: b, k: 0 };
        v.cur = 1 - v.cur;
        a = b;
      }
    }
    if (v.xf) {
      v.xf.k += dt / C().loopFade;
      if (v.xf.k >= 1 || v.xf.from.ended) { try { v.xf.from.pause(); } catch (_) { /* */ } v.xf = null; }
    }
    // Velocidad de la cinta (cambia poco a poco, salvo al pararse)
    const want = rateFor(v, t);
    if (Math.abs(want - v.rate) > 0.0015) {
      const max = (st.tape ? 3 : 0.25) * dt;
      v.rate += clamp(want - v.rate, -max, max);
      for (const x of v.els) { try { x.playbackRate = v.rate; } catch (_) { /* */ } }
    }
    // Volumen
    const vol = clamp(C().volume * v.t.gain * v.env * (v.t.once ? (st.enabled ? 1 : 0) : st.mix), 0, 1);
    if (!volOK) {
      // Sin volumen: suena o calla
      const on = v.target > 0 && (v.t.once || st.mix > 0.05);
      if (!on && !a.paused) a.pause(); else if (on && a.paused && !a.ended) play(a);
      return;
    }
    if (v.xf) {
      const k = clamp(v.xf.k, 0, 1);
      v.xf.from.volume = vol * Math.cos(k * Math.PI / 2);
      v.xf.to.volume = vol * Math.sin(k * Math.PI / 2);
    } else a.volume = vol;
  }

  // ---------- Pulso a tempo: tic-tac y latido en las últimas velas; reloj el último día de una deuda ----------
  function lastDay() {
    const run = S.run, G = SN.Game;
    return !!(run && G && G.state === 'GAMEPLAY' && run.debt && !run.debt.paid && !run.debt.defaulted &&
      run.day >= run.debt.deadlineDay && !(SN.Tutorial && SN.Tutorial.active));
  }
  function pulse() {
    const tr = st.trade;
    const kind = st.pulseKind || (tr && !tr.settled && tr.danger ? 'danger' : lastDay() ? 'clock' : null);
    const v = voices[st.main], a = el(v);
    if (!kind || !v || !v.playing || !v.t.sync || !a || a.paused || st.mix < 0.2 || !isFinite(a.currentTime)) { st.pulseIdx = -1; return; }
    const beat = 60 / C().bpm, step = kind === 'danger' ? beat / 2 : beat;
    const p = a.currentTime, idx = Math.floor(p / step) + 1;
    const wait = (idx * step - p) / (a.playbackRate || 1);
    if (wait > 0.11 || idx === st.pulseIdx) return;
    st.pulseIdx = idx;
    if (SN.Audio) SN.Audio.layer(kind === 'danger' ? 'pulseDanger' : 'pulseClock', { at: wait, i: idx });
  }

  function tick() {
    const t = now(), dt = clamp(t - (st.last || t), 0, 0.25);
    st.last = t;
    if (st.tape) {
      st.tape.t += dt;
      if (st.tape.t >= st.tape.dur) {
        // Cinta parada: silencio hasta que vuelva el ambiente normal
        const v = voices[st.main];
        if (v) stopVoice(v);
        st.tape = null; st.stopped = true; st.main = null; st.want = null;
      }
    }
    const want = resolve(t);
    if (want !== st.want) { st.want = want; st.switchAt = planSwitch(want, t); }
    if (st.want !== st.main && t >= st.switchAt) doSwitch(st.want);
    const target = mixTarget(), tau = st.duck || st.tape ? 0.08 : 0.35;
    st.mix += (target - st.mix) * (1 - Math.exp(-dt / tau));
    for (const id in voices) update(voices[id], dt, t);
    pulse();
    if (SN.Audio && SN.Audio.layerLevel) SN.Audio.layerLevel(st.enabled ? st.mix : 0);
    // Música apagada y todo en silencio: se para el reloj
    if (!st.enabled && !Object.values(voices).some((v) => v.playing)) { clearInterval(st.timer); st.timer = null; }
  }

  // Toca (sin sonido) cada <audio> que todavía no se ha tocado: dentro de un gesto, queda desbloqueado
  function unlockVoices() {
    for (const v of Object.values(voices)) for (const a of v.els) {
      if (a.dataset.unlocked || !a.paused) continue;
      a.dataset.unlocked = '1';
      a.muted = true;
      const done = () => { if (a.muted) { try { a.pause(); } catch (_) { /* */ } a.muted = false; } };
      try { const p = a.play(); if (p && p.then) p.then(done, () => { a.muted = false; }); else done(); } catch (_) { a.muted = false; }
    }
  }

  // Pestaña oculta: la música se para y vuelve donde estaba
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        st.hidden = [];
        for (const v of Object.values(voices)) for (const a of v.els) if (!a.paused) { try { a.pause(); } catch (_) { /* */ } st.hidden.push(a); }
      } else {
        for (const a of st.hidden) play(a);
        st.hidden = [];
      }
    });
  }

  SN.Music = {
    // Encender o apagar la música (ajustes). La primera vez se preparan todas las pistas.
    enable(on) {
      st.enabled = !!on;
      if (!on) return;
      for (const id of Object.keys(C().tracks)) if (id !== 'final') voice(id);
      // Lo que debía sonar y el navegador no dejó (antes del primer clic), ahora sí
      for (const v of Object.values(voices)) { const a = el(v); if (v.playing && a && a.paused && !a.ended) play(a); }
      if (st.unlocked) unlockVoices();
      if (!st.timer) { st.last = now(); st.timer = setInterval(tick, 40); }
    },
    // Gesto del jugador (clic o tecla): Safari solo deja sonar después a los <audio> que ya se tocaron en un gesto
    unlock() { st.unlocked = true; unlockVoices(); },
    mood(m) { st.mood = m; if (m === 'normal') st.stopped = false; },
    duck(on) { st.duck = !!on; },
    darkness(d) { st.dark = clamp(d || 0, 0, 1); },
    // La operación en directo (la interfaz avisa en cada vela). info: { pnl, amount, danger, settled } o null
    trade(info) {
      if (!info) { st.trade = null; return; }
      st.ending = false;
      st.trade = { r: info.amount ? info.pnl / info.amount : 0, danger: !!info.danger, settled: !!info.settled };
    },
    // Operación terminada: si ganaste, GANANDO se queda un rato más
    tradeEnd(pnl) { st.winUntil = pnl > 0 ? now() + C().winning.hold : 0; },
    // Una pista corta por encima de todo (el encapuchado)
    sting(id) {
      if (!st.enabled) return;
      const v = voice(id), a = el(v);
      if (!a) return;
      stopVoice(v);
      seek(a, 0);
      v.env = 1; v.target = 1; v.fade = 0.05;
      play(a);
      v.playing = true;
    },
    // Sin dinero: la cinta se frena hasta pararse
    tapeStop(dur = 0.9) { if (st.enabled && st.main && !st.tape) st.tape = { t: 0, dur }; },
    // El final: el tema principal, lento, hasta la siguiente operación
    ending() { st.ending = true; },
    // Una pista fija durante una escena (null: vuelve a decidir el director). Quita la cinta parada.
    force(id) { st.force = id || null; if (id) st.stopped = false; },
    // Pulso a tempo a mano ('danger' | 'clock' | null)
    pulse(kind) { st.pulseKind = kind || null; },
    // Tonalidad de lo que suena (para afinar los efectos) o null si no suena nada
    tonality() {
      const h = voices.hood;
      const v = h && h.playing && h.env > 0.5 ? h : voices[st.main];
      if (!v || !v.playing) return null;
      return { root: v.t.key.root, scale: v.t.key.scale, rate: v.rate };
    },
    // Para pruebas y depuración
    get current() { return st.main; },
    get state() { return { main: st.main, want: st.want, mix: +st.mix.toFixed(2), mood: st.mood, stopped: st.stopped, rate: voices[st.main] ? +voices[st.main].rate.toFixed(3) : 1, trade: st.trade && Object.assign({}, st.trade) }; },
    loaded(id) { const v = voices[id]; return !!(v && !v.failed && el(v).readyState >= 2); },
    // Para pruebas: lleva la pista a `left` segundos del final (para ver cómo se cierra el bucle)
    seekEnd(id, left = 1) { const v = voices[id], a = el(v); if (!a || !isFinite(a.duration)) return false; seek(a, a.duration - left); return true; },
    // Lo que suena ahora: por pista, si suena, su volumen, por dónde va y a qué velocidad
    debug() {
      const out = {};
      for (const [id, v] of Object.entries(voices)) {
        if (!v.playing && !v.failed) continue;
        const a = el(v);
        out[id] = { env: +v.env.toFixed(2), vol: +a.volume.toFixed(3), t: +a.currentTime.toFixed(2), paused: a.paused, rate: +a.playbackRate.toFixed(3), ready: a.readyState, failed: v.failed };
      }
      return out;
    },
  };
})(window.SN);
