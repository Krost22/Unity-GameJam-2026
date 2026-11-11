// AudioManager: efectos sintetizados con Web Audio (sin archivos). La música son los MP3 de Musics/ y la lleva el
// director (js/systems/music.js); estas funciones de música solo le pasan el recado.
// Los efectos van EN LA TONALIDAD de la pista que suena (y a su velocidad de cinta): cada nota sale de su escala,
// así que ganar, perder, cobrar o comprar suenan como parte de la canción. Timbres suaves, de lo-fi.
// También hace las capas de la música que no tienen archivo: el pulso de las últimas velas y el reloj del último
// día de una deuda (a tempo, los programa el director). Nunca rompe el juego si falla.
(function (SN) {
  'use strict';

  let ac = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
  const note = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const semi = (f, n) => f * Math.pow(2, n / 12);

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.7;
      sfxGain = ac.createGain(); sfxGain.gain.value = 1;
      musicGain = ac.createGain(); musicGain.gain.value = 0; // capas de la música: siguen su volumen
      sfxGain.connect(master); musicGain.connect(master);
      master.connect(comp).connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone({ type = 'sine', f0, f1 = f0, dur, vol = 0.2, at = 0, attack = 0.005, out, detune = 0 }) {
    const a = ac, t = a.currentTime + at;
    const o = a.createOscillator(), gn = a.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(out || sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise({ dur, vol = 0.2, filter = 'bandpass', f0 = 1000, f1 = f0, q = 1, at = 0, attack = 0.005, out }) {
    const a = ac, t = a.currentTime + at;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), bq = a.createBiquadFilter(), gn = a.createGain();
    src.buffer = noiseBuf;
    bq.type = filter; bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(gn).connect(out || sfxGain);
    src.start(t, Math.random() * Math.max(0, 1.9 - dur)); src.stop(t + dur + 0.03);
  }

  // ---------- Afinación: la tonalidad de la pista que suena (sin música, la de la partida: Re menor) ----------
  const DEFAULT_KEY = { root: 62, scale: [0, 3, 5, 7, 10], rate: 1 };
  const keyNow = () => (SN.Music && SN.Music.tonality()) || DEFAULT_KEY;
  // Grado g de la escala (0 = tónica; los que se salen de la escala pasan de octava) y oct octavas más, en Hz.
  // Se multiplica por la velocidad de la cinta: si la música va más lenta (y más grave), los efectos también.
  function deg(K, g, oct = 0) {
    const s = K.scale, n = s.length, o = Math.floor(g / n);
    return note(K.root + 12 * (oct + o) + s[((g % n) + n) % n]) * K.rate;
  }
  // Pulsación suave: triángulo con una octava de seno encima, un pelín desafinados (lo-fi)
  function pluck(f, { vol = 0.06, dur = 0.12, at = 0, out, type = 'triangle' } = {}) {
    tone({ type, f0: f, dur, vol, at, attack: 0.004, out, detune: 4 });
    tone({ type: 'sine', f0: f * 2, dur: dur * 0.6, vol: vol * 0.35, at, attack: 0.003, out, detune: -5 });
  }
  // Campanita (monedas, avisos): seno con un armónico de campana
  function bell(f, { vol = 0.05, dur = 0.35, at = 0, out } = {}) {
    tone({ type: 'sine', f0: f, dur, vol, at, attack: 0.003, out });
    tone({ type: 'sine', f0: f * 2.76, dur: dur * 0.4, vol: vol * 0.22, at, attack: 0.002, out });
  }
  // Golpe sordo de los botones de operar
  function thump(at = 0) {
    tone({ type: 'sine', f0: 160, f1: 60, dur: 0.18, vol: 0.28, at });
    noise({ dur: 0.08, vol: 0.1, filter: 'lowpass', f0: 1400, at });
  }

  const SFX = {
    click: () => { noise({ dur: 0.025, vol: 0.1, filter: 'highpass', f0: 3000 }); tone({ type: 'sine', f0: 1150, f1: 850, dur: 0.03, vol: 0.035 }); },
    key: () => { noise({ dur: 0.03, vol: 0.09, filter: 'bandpass', f0: 2200, q: 2 }); tone({ type: 'triangle', f0: 260, f1: 160, dur: 0.04, vol: 0.06 }); },
    // Elegir algo: una nota de la escala de la música
    select: () => { const K = keyNow(); pluck(deg(K, 4, 1), { vol: 0.045, dur: 0.08 }); },
    // Error: un semitono que choca con la tónica y cae
    error: () => {
      const K = keyNow(), r = deg(K, 0, -1);
      tone({ type: 'triangle', f0: semi(r, 1), dur: 0.11, vol: 0.08 });
      tone({ type: 'triangle', f0: r, f1: semi(r, -1), dur: 0.16, vol: 0.08, at: 0.09 });
      tone({ type: 'sine', f0: semi(r, -12), dur: 0.18, vol: 0.12, at: 0.09 });
    },
    // SUBIRÁ: tres notas que suben; BAJARÁ: las mismas, bajando
    buy: () => { const K = keyNow(); [0, 1, 2].forEach((g, i) => pluck(deg(K, g, 1), { vol: 0.06, dur: 0.1, at: i * 0.045 })); thump(0.1); },
    sell: () => { const K = keyNow(); [2, 1, 0].forEach((g, i) => pluck(deg(K, g, 1), { vol: 0.06, dur: 0.1, at: i * 0.045 })); thump(0.1); },
    // Cada vela, una nota de la escala: más aguda cuanto mejor te va (ganar "sube" musicalmente)
    candle: ({ up = true, quiet = false, step = null } = {}) => {
      const K = keyNow();
      if (step == null) return pluck(deg(K, up ? 3 : 1, 1), { vol: quiet ? 0.022 : 0.04, dur: 0.06 });
      const k = Math.max(-10, Math.min(10, step));
      pluck(deg(K, k, 1), { vol: quiet ? 0.028 : 0.045, dur: 0.08 });
    },
    heart: () => { tone({ type: 'sine', f0: 74, f1: 46, dur: 0.13, vol: 0.45 }); tone({ type: 'sine', f0: 64, f1: 40, dur: 0.15, vol: 0.32, at: 0.16 }); },
    // Cámara lenta: ruido que sube y una sierra que va de la tónica grave a la aguda
    riser: ({ dur = 2 } = {}) => {
      const K = keyNow();
      noise({ dur, vol: 0.07, filter: 'bandpass', f0: 300, f1: 3200, q: 1.4, attack: dur * 0.85 });
      tone({ type: 'sawtooth', f0: deg(K, 0, -2), f1: deg(K, 0, 0), dur, vol: 0.02, attack: dur * 0.8 });
    },
    boom: ({ big = true } = {}) => {
      const K = keyNow();
      tone({ type: 'sine', f0: 130, f1: 38, dur: 0.55, vol: big ? 0.5 : 0.3 });
      noise({ dur: 0.45, vol: big ? 0.3 : 0.15, filter: 'lowpass', f0: 1600, f1: 120 });
      [0, 1, 2, 3, 4].forEach((g, i) => pluck(deg(K, g, 1), { vol: 0.05, dur: 0.22, at: 0.05 + i * 0.045 }));
      for (let i = 0; i < (big ? 5 : 2); i++) SFX.coinAt(0.2 + i * 0.07);
    },
    crash: ({ big = true } = {}) => {
      const K = keyNow(), r = deg(K, 0, -1);
      noise({ dur: 0.7, vol: big ? 0.32 : 0.16, filter: 'highpass', f0: 3200, f1: 400 });
      tone({ type: 'sawtooth', f0: semi(r, 12), f1: r / 2, dur: 0.75, vol: big ? 0.11 : 0.06 });
      tone({ type: 'triangle', f0: semi(r, 1), dur: 0.22, vol: 0.08, at: 0.12 }); tone({ type: 'triangle', f0: r, dur: 0.3, vol: 0.08, at: 0.32 });
    },
    // COBRAR: "cha-ching" en la tonalidad (la tercera nota y la tónica arriba) y monedas
    cash: () => {
      const K = keyNow();
      noise({ dur: 0.04, vol: 0.14, filter: 'highpass', f0: 3000 });
      bell(deg(K, 2, 2), { vol: 0.07, dur: 0.1, at: 0.03 });
      bell(deg(K, 0, 3), { vol: 0.07, dur: 0.32, at: 0.09 });
      for (let i = 0; i < 3; i++) SFX.coinAt(0.15 + i * 0.06);
    },
    tick: () => { const K = keyNow(); tone({ type: 'square', f0: deg(K, 0, 3), dur: 0.02, vol: 0.03 }); },
    coin: () => { const K = keyNow(); bell(deg(K, 4, 2), { vol: 0.055, dur: 0.1 }); bell(deg(K, 0, 3), { vol: 0.055, dur: 0.18, at: 0.05 }); },
    coinBounce: () => { const K = keyNow(); bell(deg(K, Math.floor(Math.random() * 5), 3), { vol: 0.02, dur: 0.05 }); },
    // Ganar: arpegio de la escala que sube (y monedas)
    win: ({ big = false } = {}) => {
      const K = keyNow(), seq = big ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3];
      seq.forEach((g, i) => { pluck(deg(K, g, 1), { vol: 0.06, dur: 0.14, at: i * 0.06 }); bell(deg(K, g, 2), { vol: 0.025, dur: 0.12, at: i * 0.06 }); });
      for (let i = 0; i < (big ? 6 : 3); i++) SFX.coinAt(0.25 + i * 0.07);
      if (big) noise({ dur: 1.2, vol: 0.08, filter: 'bandpass', f0: 900, f1: 1400, q: 0.6, attack: 0.2, at: 0.1 });
    },
    coinAt: (at) => { const K = keyNow(); bell(deg(K, 4, 2), { vol: 0.035, dur: 0.06, at }); bell(deg(K, 0, 3), { vol: 0.035, dur: 0.1, at: at + 0.04 }); },
    // Perder: la escala baja y cada nota se dobla hacia abajo, como una cinta que se frena
    loss: ({ big = false } = {}) => {
      const K = keyNow();
      [3, 2, 1, big ? -1 : 0].forEach((g, i) => { const f = deg(K, g, 0); tone({ type: 'triangle', f0: f, f1: semi(f, -1), dur: 0.16, vol: 0.07, at: i * 0.1 }); });
      tone({ type: 'sine', f0: 120, f1: 40, dur: big ? 0.6 : 0.3, vol: 0.35, at: 0.05 });
      if (big) noise({ dur: 0.4, vol: 0.18, filter: 'lowpass', f0: 800, f1: 100 });
    },
    liquidation: () => {
      const K = keyNow(), r = deg(K, 0, -1);
      noise({ dur: 0.6, vol: 0.25, filter: 'lowpass', f0: 1200, f1: 80 });
      tone({ type: 'sawtooth', f0: semi(r, 12), f1: r / 2, dur: 0.8, vol: 0.1 });
      tone({ type: 'triangle', f0: semi(r, 1), dur: 0.12, vol: 0.08, at: 0.3 }); tone({ type: 'triangle', f0: r, dur: 0.12, vol: 0.08, at: 0.45 });
    },
    unlock: () => {
      const K = keyNow();
      [0, 1, 2, 3, 4, 5].forEach((g, i) => { pluck(deg(K, g, 1), { vol: 0.06, dur: 0.18, at: i * 0.05 }); bell(deg(K, g, 2), { vol: 0.02, dur: 0.15, at: i * 0.05 }); });
      noise({ dur: 0.4, vol: 0.05, filter: 'highpass', f0: 6000, at: 0.1 });
    },
    // Símbolo descifrado: la escala que baja, desafinada, como algo que no debería oírse, y estática
    cipher: () => {
      const K = keyNow();
      noise({ dur: 0.5, vol: 0.12, filter: 'bandpass', f0: 2400, f1: 300, q: 3 });
      [4, 3, 2, 1].forEach((g, i) => { const f = deg(K, g, 1); tone({ type: 'triangle', f0: f, f1: semi(f, -1), dur: 0.35, vol: 0.07, at: 0.08 + i * 0.09, detune: i * 7 }); });
      tone({ type: 'sine', f0: deg(K, 0, -2), f1: semi(deg(K, 0, -2), -5), dur: 0.9, vol: 0.3, at: 0.1 });
    },
    // Día de la suerte: siete notas de la escala que suben
    lucky: () => {
      const K = keyNow();
      [0, 1, 2, 3, 4, 5, 6].forEach((g, i) => { pluck(deg(K, g, 1), { vol: 0.05, dur: 0.12, at: i * 0.07 }); bell(deg(K, g, 2), { vol: 0.025, dur: 0.1, at: i * 0.07 }); });
      for (let i = 0; i < 7; i++) SFX.coinAt(0.5 + i * 0.05);
    },
    // Ruleta: un clic por casilla
    wheel: () => { tone({ type: 'square', f0: 2100, f1: 1500, dur: 0.025, vol: 0.04 }); },
    // Compra (tienda, oferta aceptada): tres campanitas del acorde de la tónica
    pay: () => {
      const K = keyNow();
      noise({ dur: 0.05, vol: 0.15, filter: 'highpass', f0: 2500 });
      bell(deg(K, 0, 2), { vol: 0.07, dur: 0.12, at: 0.06 });
      bell(deg(K, 2, 2), { vol: 0.07, dur: 0.3, at: 0.12 });
      pluck(deg(K, 0, 3), { vol: 0.05, dur: 0.4, at: 0.16 });
    },
    // Deuda pagada: alivio... que se tuerce (la nota de arriba cae un semitono: ya viene la siguiente deuda)
    debtPaid: () => {
      const K = keyNow(), root = deg(K, 0, 1);
      [0, 1, 2, 3, 4].forEach((g, i) => bell(deg(K, g, 1), { vol: 0.05, dur: 0.25, at: i * 0.07 }));
      // Acorde final sin tercera (tónica, quinta y octava): vale igual en mayor y en menor
      [0, 7, 12].forEach((n, i) => tone({ type: 'triangle', f0: semi(root, n), dur: 1.3, vol: 0.045, at: 0.4, attack: 0.08, detune: i * 3 }));
      tone({ type: 'sine', f0: semi(root, 24), f1: semi(root, 23), dur: 1.1, vol: 0.035, at: 0.55, attack: 0.1 });
    },
    // Sin dinero: una caja de música rota que baja, desafinada y cada vez más lenta
    broke: ({ at = 0 } = {}) => {
      const K = keyNow();
      let t = at;
      [4, 3, 2, 1, 0, -1].forEach((g, i) => {
        const f = deg(K, g, 1) * Math.pow(2, (Math.random() - 0.5) * 40 / 1200);
        bell(f, { vol: 0.05, dur: 0.9, at: t });
        tone({ type: 'triangle', f0: f / 2, f1: f / 2 * 0.98, dur: 0.6, vol: 0.02, at: t });
        t += 0.32 + i * 0.09;
      });
      noise({ dur: t - at + 0.6, vol: 0.015, filter: 'highpass', f0: 5000, at, attack: 0.3 });
    },
    // Capa de las ÚLTIMAS VELAS (a tempo, la programa el director): tic a corcheas y latido cada dos tiempos
    pulseDanger: ({ at = 0, i = 0, out } = {}) => {
      const K = keyNow();
      if (i % 4 === 0) {
        tone({ type: 'sine', f0: 72, f1: 46, dur: 0.12, vol: 0.3, at, out });
        tone({ type: 'sine', f0: 62, f1: 40, dur: 0.14, vol: 0.2, at: at + 0.16, out });
      }
      noise({ dur: 0.02, vol: i % 2 ? 0.035 : 0.055, filter: 'highpass', f0: 6000, at, out });
      tone({ type: 'sine', f0: deg(K, 0, 3), dur: 0.025, vol: i % 2 ? 0.012 : 0.02, at, out });
    },
    // Capa del ÚLTIMO DÍA de una deuda (a tempo): tic-tac de reloj y, cada cuatro compases, una campana desafinada
    pulseClock: ({ at = 0, i = 0, out } = {}) => {
      const K = keyNow();
      noise({ dur: 0.015, vol: 0.03, filter: 'bandpass', f0: i % 2 ? 2400 : 3400, q: 4, at, out });
      tone({ type: 'sine', f0: deg(K, i % 2 ? 4 : 0, 3), dur: 0.02, vol: 0.012, at, out });
      if (i % 16 === 0) bell(deg(K, 0, 1) * Math.pow(2, -18 / 1200), { vol: 0.03, dur: 1.2, at, out });
    },
    notify: () => { const K = keyNow(); bell(deg(K, 4, 2), { vol: 0.1, dur: 0.15 }); bell(deg(K, 2, 2), { vol: 0.1, dur: 0.3, at: 0.12 }); },
    notifyBad: () => {
      const K = keyNow(), a = deg(K, 4, 2), b = deg(K, 1, 2);
      tone({ type: 'sine', f0: a, f1: semi(a, -1), dur: 0.2, vol: 0.11, detune: -30 });
      tone({ type: 'sine', f0: b, f1: semi(b, -3), dur: 0.5, vol: 0.11, at: 0.14, detune: 20 });
    },
    static: ({ dur = 0.5 } = {}) => { noise({ dur, vol: 0.14, filter: 'bandpass', f0: 2600, q: 0.4, attack: 0.02 }); tone({ type: 'sawtooth', f0: 60, dur, vol: 0.03 }); },
    // El susurro del encapuchado, en la tonalidad de su aparición (tónica grave y quinta)
    whisper: () => {
      const K = keyNow(), r = deg(K, 0, -2);
      tone({ type: 'sine', f0: r, f1: semi(r, -0.7), dur: 1.8, vol: 0.12, attack: 0.4 });
      tone({ type: 'sine', f0: semi(r, 7), f1: semi(r, 6.3), dur: 1.8, vol: 0.06, attack: 0.5, detune: 14 });
      noise({ dur: 1.4, vol: 0.04, filter: 'bandpass', f0: 500, q: 3, attack: 0.5 });
    },
    // La voz de los diálogos: cada letra, una nota de la escala (el encapuchado grave, Bravo con sierra)
    type: ({ voice = 'hood' } = {}) => {
      const K = keyNow(), g = Math.floor(Math.random() * 3);
      if (voice === 'bravo') return tone({ type: 'sawtooth', f0: deg(K, g - 2, 0), dur: 0.035, vol: 0.028 });
      if (voice === 'hood') return tone({ type: 'triangle', f0: deg(K, g - 2, -1), dur: 0.03, vol: 0.06 });
      tone({ type: 'square', f0: deg(K, g, 1), dur: 0.03, vol: 0.022 });
    },
    crack: ({ n = 0 } = {}) => {
      noise({ dur: 0.08, vol: 0.25, filter: 'bandpass', f0: 1800 + n * 300, q: 2 });
      tone({ type: 'triangle', f0: 240 + n * 40, f1: 120, dur: 0.1, vol: 0.18 });
    },
    shatter: () => {
      noise({ dur: 0.5, vol: 0.3, filter: 'highpass', f0: 1500, f1: 400 });
      tone({ type: 'sine', f0: 160, f1: 50, dur: 0.4, vol: 0.35 });
      for (let i = 0; i < 8; i++) SFX.coinAt(0.15 + Math.random() * 0.6);
    },
    pop: () => tone({ type: 'sine', f0: 300, f1: 700, dur: 0.08, vol: 0.1 }),
    siren: () => { for (let i = 0; i < 6; i++) tone({ type: 'triangle', f0: i % 2 ? 660 : 880, dur: 0.38, vol: 0.035, at: i * 0.4, attack: 0.05 }); },
    day: () => { const K = keyNow(); [0, 2, 4].forEach((g, i) => pluck(deg(K, g, 1), { vol: 0.08, dur: 0.28, at: i * 0.1 })); },
    open: () => { const K = keyNow(); tone({ type: 'triangle', f0: deg(K, 2, 1), f1: deg(K, 4, 1), dur: 0.07, vol: 0.05 }); },
    close: () => { const K = keyNow(); tone({ type: 'triangle', f0: deg(K, 4, 1), f1: deg(K, 2, 1), dur: 0.07, vol: 0.05 }); },
    boot: () => {
      const K = keyNow();
      tone({ type: 'sine', f0: 60, f1: 120, dur: 0.4, vol: 0.2 }); noise({ dur: 0.3, vol: 0.06, filter: 'highpass', f0: 4000 });
      [0, 2, 4].forEach((g, i) => pluck(deg(K, g, 2), { vol: 0.07, dur: 0.22, at: 0.35 + i * 0.08 }));
    },
    whoosh: () => noise({ dur: 0.3, vol: 0.1, filter: 'bandpass', f0: 400, f1: 2400, q: 2, attack: 0.08 }),
    // El final B: llaman a la puerta (un golpe seco; se repite tres veces)
    knock: () => { tone({ type: 'sine', f0: 120, f1: 70, dur: 0.12, vol: 0.4 }); noise({ dur: 0.06, vol: 0.18, filter: 'lowpass', f0: 900 }); },
    // Golpe de dibujos animados, fuera de plano
    punch: () => {
      const K = keyNow();
      noise({ dur: 0.09, vol: 0.28, filter: 'bandpass', f0: 1200, q: 1.5 });
      tone({ type: 'square', f0: deg(K, 0, 0), f1: deg(K, 0, -1), dur: 0.12, vol: 0.05 });
      tone({ type: 'sine', f0: 180, f1: 60, dur: 0.15, vol: 0.32 });
    },
    // NULL.EXE: todo cae a cero (dos notas de la escala que se hunden y ruido que se apaga)
    collapse: () => {
      const K = keyNow();
      tone({ type: 'sawtooth', f0: deg(K, 0, 1), f1: deg(K, 0, -3), dur: 2.4, vol: 0.05, attack: 0.05 });
      tone({ type: 'triangle', f0: deg(K, 2, 1), f1: deg(K, 2, -3), dur: 2.6, vol: 0.05, attack: 0.05 });
      noise({ dur: 2.2, vol: 0.12, filter: 'lowpass', f0: 3000, f1: 120, attack: 0.1 });
    },
    // La pantalla se apaga
    powerOff: () => { tone({ type: 'sine', f0: 900, f1: 40, dur: 0.5, vol: 0.12 }); noise({ dur: 0.25, vol: 0.08, filter: 'highpass', f0: 3000, f1: 300 }); },
    thud: () => { tone({ type: 'sine', f0: 140, f1: 50, dur: 0.25, vol: 0.35 }); noise({ dur: 0.1, vol: 0.1, filter: 'lowpass', f0: 600 }); },
    cheer: () => {
      const K = keyNow();
      [2, 3, 4].forEach((g, i) => pluck(deg(K, g, 2), { vol: 0.055, dur: 0.12, at: i * 0.07 }));
      noise({ dur: 0.8, vol: 0.08, filter: 'bandpass', f0: 900, f1: 1400, q: 0.6, attack: 0.15 });
    },
  };

  SN.Audio = {
    sfxOn: true,
    musicOn: true,
    // Llamar en cada gesto del jugador (los navegadores bloquean el audio hasta entonces)
    unlock() { try { ctx(); } catch (_) { /* sin audio */ } if (SN.Music) SN.Music.unlock(); },
    sfx(name, opts) {
      if (!this.sfxOn || !SFX[name]) return;
      try { if (ctx()) SFX[name](opts || {}); } catch (_) { /* sin audio */ }
    },
    // Capas de la música hechas con síntesis (el pulso a tempo): van con la música, no con los efectos
    layer(name, opts) {
      if (!this.musicOn || !SFX[name]) return;
      try { if (ctx()) SFX[name](Object.assign({ out: musicGain }, opts)); } catch (_) { /* sin audio */ }
    },
    layerLevel(v) { if (ac && musicGain) musicGain.gain.setTargetAtTime(v, ac.currentTime, 0.05); },
    // La música (Musics/) la lleva el director: js/systems/music.js
    startMusic() { if (this.musicOn && SN.Music) SN.Music.enable(true); },
    stopMusic() { if (SN.Music) SN.Music.enable(false); },
    setMood(mood) { if (SN.Music) SN.Music.mood(mood); },
    // La música casi desaparece durante la cámara lenta (el silencio hace más fuerte el golpe)
    duck(on) { if (SN.Music) SN.Music.duck(on); },
    setDarkness(d) { if (SN.Music) SN.Music.darkness(d); },
    setSfx(on) { this.sfxOn = on; },
    setMusic(on) { this.musicOn = on; if (on) this.startMusic(); else this.stopMusic(); },
  };
})(window.SN);
