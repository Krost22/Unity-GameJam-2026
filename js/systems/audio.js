// AudioManager: efectos sintetizados con Web Audio (sin archivos) y música chiptune procedural.
// La música empieza alegre y se transforma poco a poco con la historia (setDarkness 0..1):
// más lenta, acordes menores, voz desafinada y un zumbido grave. Nunca rompe el juego si falla.
(function (SN) {
  'use strict';

  let ac = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
  const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.7;
      sfxGain = ac.createGain(); sfxGain.gain.value = 1;
      musicGain = ac.createGain(); musicGain.gain.value = 0;
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

  const SFX = {
    click: () => { noise({ dur: 0.025, vol: 0.12, filter: 'highpass', f0: 3000 }); tone({ type: 'square', f0: 1200, f1: 900, dur: 0.03, vol: 0.04 }); },
    key: () => { noise({ dur: 0.03, vol: 0.09, filter: 'bandpass', f0: 2200, q: 2 }); tone({ type: 'triangle', f0: 260, f1: 160, dur: 0.04, vol: 0.06 }); },
    select: () => tone({ type: 'square', f0: note(84), dur: 0.06, vol: 0.05 }),
    error: () => { tone({ type: 'square', f0: 180, dur: 0.12, vol: 0.07 }); tone({ type: 'square', f0: 140, dur: 0.14, vol: 0.07, at: 0.1 }); },
    buy: () => {
      [64, 67, 71].forEach((n, i) => tone({ type: 'square', f0: note(n), dur: 0.08, vol: 0.07, at: i * 0.04 }));
      tone({ type: 'sine', f0: 160, f1: 60, dur: 0.18, vol: 0.3, at: 0.1 });
      noise({ dur: 0.08, vol: 0.12, filter: 'lowpass', f0: 1400, at: 0.1 });
    },
    sell: () => {
      [71, 67, 64].forEach((n, i) => tone({ type: 'square', f0: note(n), dur: 0.08, vol: 0.07, at: i * 0.04 }));
      tone({ type: 'sine', f0: 160, f1: 60, dur: 0.18, vol: 0.3, at: 0.1 });
      noise({ dur: 0.08, vol: 0.12, filter: 'lowpass', f0: 1400, at: 0.1 });
    },
    // Cada vela suena más aguda cuanto mejor te va (escala pentatónica): ganar "sube" musicalmente
    candle: ({ up = true, quiet = false, step = null } = {}) => {
      if (step == null) return tone({ type: 'triangle', f0: up ? note(79) : note(70), f1: up ? note(81) : note(67), dur: 0.05, vol: quiet ? 0.025 : 0.045 });
      const PENTA = [0, 2, 4, 7, 9];
      const k = Math.max(-10, Math.min(10, step));
      const n = 72 + Math.floor(k / 5) * 12 + PENTA[((k % 5) + 5) % 5];
      tone({ type: 'triangle', f0: note(n), dur: 0.07, vol: quiet ? 0.03 : 0.05 });
      tone({ type: 'square', f0: note(n + 12), dur: 0.04, vol: 0.015, at: 0.01 });
    },
    heart: () => { tone({ type: 'sine', f0: 74, f1: 46, dur: 0.13, vol: 0.45 }); tone({ type: 'sine', f0: 64, f1: 40, dur: 0.15, vol: 0.32, at: 0.16 }); },
    riser: ({ dur = 2 } = {}) => {
      noise({ dur, vol: 0.07, filter: 'bandpass', f0: 300, f1: 3200, q: 1.4, attack: dur * 0.85 });
      tone({ type: 'sawtooth', f0: 110, f1: 520, dur, vol: 0.022, attack: dur * 0.8 });
    },
    boom: ({ big = true } = {}) => {
      tone({ type: 'sine', f0: 130, f1: 38, dur: 0.55, vol: big ? 0.5 : 0.3 });
      noise({ dur: 0.45, vol: big ? 0.3 : 0.15, filter: 'lowpass', f0: 1600, f1: 120 });
      [72, 76, 79, 84, 88].forEach((n, i) => tone({ type: 'square', f0: note(n), dur: 0.22, vol: 0.05, at: 0.05 + i * 0.045 }));
      for (let i = 0; i < (big ? 5 : 2); i++) SFX.coinAt(0.2 + i * 0.07);
    },
    crash: ({ big = true } = {}) => {
      noise({ dur: 0.7, vol: big ? 0.32 : 0.16, filter: 'highpass', f0: 3200, f1: 400 });
      tone({ type: 'sawtooth', f0: 320, f1: 45, dur: 0.75, vol: big ? 0.13 : 0.07 });
      tone({ type: 'square', f0: 98, dur: 0.22, vol: 0.08, at: 0.12 }); tone({ type: 'square', f0: 92, dur: 0.3, vol: 0.08, at: 0.32 });
    },
    cash: () => {
      noise({ dur: 0.04, vol: 0.14, filter: 'highpass', f0: 3000 });
      tone({ type: 'square', f0: note(88), dur: 0.06, vol: 0.07, at: 0.03 });
      tone({ type: 'square', f0: note(95), dur: 0.28, vol: 0.07, at: 0.09 });
      for (let i = 0; i < 3; i++) SFX.coinAt(0.15 + i * 0.06);
    },
    tick: () => tone({ type: 'square', f0: 1700, dur: 0.02, vol: 0.035 }),
    coin: () => { tone({ type: 'square', f0: note(88), dur: 0.06, vol: 0.06 }); tone({ type: 'square', f0: note(95), dur: 0.12, vol: 0.06, at: 0.05 }); },
    coinBounce: () => tone({ type: 'triangle', f0: note(96 + Math.floor(Math.random() * 4)), dur: 0.04, vol: 0.025 }),
    win: ({ big = false } = {}) => {
      const seq = big ? [72, 76, 79, 84, 88, 91] : [72, 76, 79, 84];
      seq.forEach((n, i) => { tone({ type: 'square', f0: note(n), dur: 0.12, vol: 0.06, at: i * 0.06 }); tone({ type: 'triangle', f0: note(n + 12), dur: 0.1, vol: 0.04, at: i * 0.06 }); });
      for (let i = 0; i < (big ? 6 : 3); i++) SFX.coinAt(0.25 + i * 0.07);
      if (big) noise({ dur: 1.2, vol: 0.08, filter: 'bandpass', f0: 900, f1: 1500, q: 0.6, attack: 0.2, at: 0.1 });
    },
    coinAt: (at) => { tone({ type: 'square', f0: note(88), dur: 0.05, vol: 0.04, at }); tone({ type: 'square', f0: note(95), dur: 0.09, vol: 0.04, at: at + 0.04 }); },
    loss: ({ big = false } = {}) => {
      [67, 63, 60, big ? 55 : 58].forEach((n, i) => tone({ type: 'square', f0: note(n), f1: note(n - 1), dur: 0.14, vol: 0.06, at: i * 0.1 }));
      tone({ type: 'sine', f0: 120, f1: 40, dur: big ? 0.6 : 0.3, vol: 0.35, at: 0.05 });
      if (big) noise({ dur: 0.4, vol: 0.18, filter: 'lowpass', f0: 800, f1: 100 });
    },
    liquidation: () => {
      noise({ dur: 0.6, vol: 0.25, filter: 'lowpass', f0: 1200, f1: 80 });
      tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.8, vol: 0.12 });
      tone({ type: 'square', f0: 110, dur: 0.12, vol: 0.08, at: 0.3 }); tone({ type: 'square', f0: 104, dur: 0.12, vol: 0.08, at: 0.45 });
    },
    unlock: () => {
      [72, 79, 84, 88, 91, 96].forEach((n, i) => tone({ type: 'triangle', f0: note(n), dur: 0.18, vol: 0.08, at: i * 0.05 }));
      noise({ dur: 0.4, vol: 0.05, filter: 'highpass', f0: 6000, at: 0.1 });
    },
    // Símbolo descifrado: un acorde que baja, como algo que no debería oírse, y estática
    cipher: () => {
      noise({ dur: 0.5, vol: 0.12, filter: 'bandpass', f0: 2400, f1: 300, q: 3 });
      [86, 81, 77, 74].forEach((n, i) => tone({ type: 'triangle', f0: note(n), f1: note(n - 1), dur: 0.35, vol: 0.07, at: 0.08 + i * 0.09, detune: i * 7 }));
      tone({ type: 'sine', f0: 55, f1: 41, dur: 0.9, vol: 0.3, at: 0.1 });
    },
    // Día de la suerte: siete notas que suben
    lucky: () => {
      [72, 74, 76, 79, 81, 84, 91].forEach((n, i) => { tone({ type: 'square', f0: note(n), dur: 0.1, vol: 0.05, at: i * 0.07 }); tone({ type: 'triangle', f0: note(n + 12), dur: 0.08, vol: 0.03, at: i * 0.07 }); });
      for (let i = 0; i < 7; i++) SFX.coinAt(0.5 + i * 0.05);
    },
    // Ruleta: un clic por casilla
    wheel: () => { tone({ type: 'square', f0: 2100, f1: 1500, dur: 0.025, vol: 0.04 }); },
    pay: () => {
      noise({ dur: 0.05, vol: 0.15, filter: 'highpass', f0: 2500 });
      tone({ type: 'square', f0: note(84), dur: 0.08, vol: 0.07, at: 0.06 });
      tone({ type: 'square', f0: note(91), dur: 0.3, vol: 0.08, at: 0.12 });
      tone({ type: 'triangle', f0: note(96), dur: 0.4, vol: 0.06, at: 0.16 });
    },
    notify: () => { tone({ type: 'sine', f0: note(88), dur: 0.15, vol: 0.12 }); tone({ type: 'sine', f0: note(83), dur: 0.3, vol: 0.12, at: 0.12 }); },
    notifyBad: () => { tone({ type: 'sine', f0: note(88), f1: note(80), dur: 0.2, vol: 0.12, detune: -30 }); tone({ type: 'sine', f0: note(83), f1: note(70), dur: 0.5, vol: 0.12, at: 0.14, detune: 20 }); },
    static: ({ dur = 0.5 } = {}) => { noise({ dur, vol: 0.14, filter: 'bandpass', f0: 2600, q: 0.4, attack: 0.02 }); tone({ type: 'sawtooth', f0: 60, dur, vol: 0.03 }); },
    whisper: () => { tone({ type: 'sine', f0: 92, f1: 88, dur: 1.8, vol: 0.12, attack: 0.4 }); tone({ type: 'sine', f0: 138, f1: 131, dur: 1.8, vol: 0.06, attack: 0.5, detune: 14 }); noise({ dur: 1.4, vol: 0.04, filter: 'bandpass', f0: 500, q: 3, attack: 0.5 }); },
    type: ({ voice = 'hood' } = {}) => tone({ type: voice === 'hood' ? 'triangle' : 'square', f0: voice === 'hood' ? 110 + Math.random() * 20 : 600 + Math.random() * 80, dur: 0.03, vol: voice === 'hood' ? 0.06 : 0.025 }),
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
    day: () => [67, 72, 76].forEach((n, i) => tone({ type: 'triangle', f0: note(n), dur: 0.25, vol: 0.09, at: i * 0.1 })),
    open: () => tone({ type: 'square', f0: 400, f1: 900, dur: 0.07, vol: 0.05 }),
    close: () => tone({ type: 'square', f0: 900, f1: 400, dur: 0.07, vol: 0.05 }),
    boot: () => { tone({ type: 'sine', f0: 60, f1: 120, dur: 0.4, vol: 0.2 }); noise({ dur: 0.3, vol: 0.06, filter: 'highpass', f0: 4000 }); [72, 79, 84].forEach((n, i) => tone({ type: 'triangle', f0: note(n), dur: 0.2, vol: 0.08, at: 0.35 + i * 0.08 })); },
    whoosh: () => noise({ dur: 0.3, vol: 0.1, filter: 'bandpass', f0: 400, f1: 2400, q: 2, attack: 0.08 }),
    thud: () => { tone({ type: 'sine', f0: 140, f1: 50, dur: 0.25, vol: 0.35 }); noise({ dur: 0.1, vol: 0.1, filter: 'lowpass', f0: 600 }); },
    cheer: () => { [76, 79, 84].forEach((n, i) => tone({ type: 'square', f0: note(n), dur: 0.1, vol: 0.06, at: i * 0.07 })); noise({ dur: 0.8, vol: 0.08, filter: 'bandpass', f0: 900, f1: 1400, q: 0.6, attack: 0.15 }); },
  };

  // --- Música ---
  const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // C, Am, F, G
  const MELODY = [76, null, 79, 76, 74, null, 72, null, 74, 76, null, 72, 69, null, 72, null];
  const music = { on: false, step: 0, next: 0, timer: null, dark: 0, mood: 'normal', duck: false };

  function schedule() {
    if (!ac || !music.on) return;
    const dark = music.dark;
    const bpm = 104 - dark * 22;
    const stepDur = 60 / bpm / 2; // corcheas
    while (music.next < ac.currentTime + 0.15) {
      const s = music.step, at = music.next - ac.currentTime;
      const bar = Math.floor(s / 8) % 4;
      let chord = CHORDS[bar];
      if (dark > 0.45 && bar === 2) chord = [53, 56, 60]; // Fa menor
      if (dark > 0.75 && bar === 0) chord = [60, 63, 67]; // Do menor
      const pos = s % 8;
      const out = musicGain;
      if (pos === 0 || pos === 4) tone({ type: 'triangle', f0: note(chord[0] - 12), dur: stepDur * 1.8, vol: 0.16, at, out });
      if (pos % 2 === 1 && dark < 0.8) noise({ dur: 0.03, vol: 0.035 * (1 - dark), filter: 'highpass', f0: 7000, at, out });
      const arp = chord[[0, 1, 2, 1][pos % 4]] + 12;
      tone({ type: 'square', f0: note(arp), dur: stepDur * 0.7, vol: 0.022, at, out, detune: dark * 18 * (pos % 2 ? 1 : -1) });
      const mel = MELODY[s % 16];
      if (mel && (Math.floor(s / 16) % 2 === 0)) tone({ type: 'triangle', f0: note(mel - (dark > 0.6 ? 1 : 0) * (mel % 2)), dur: stepDur * 1.6, vol: 0.05 * (1 - dark * 0.5), at, out, detune: dark * 25 });
      if (dark > 0.3 && pos === 0) tone({ type: 'sine', f0: note(36), dur: stepDur * 7, vol: 0.05 * dark, at, out, attack: 0.3 });
      music.step++;
      music.next += stepDur;
    }
  }

  function musicLevel() {
    if (!music.on || music.mood === 'silent') return 0;
    const base = music.mood === 'tense' ? 0.25 : 0.55;
    return music.duck ? base * 0.12 : base;
  }

  SN.Audio = {
    sfxOn: true,
    musicOn: true,
    // Llamar en el primer gesto del jugador (los navegadores bloquean el audio hasta entonces)
    unlock() { try { ctx(); } catch (_) { /* sin audio */ } },
    sfx(name, opts) {
      if (!this.sfxOn || !SFX[name]) return;
      try { if (ctx()) SFX[name](opts || {}); } catch (_) { /* sin audio */ }
    },
    startMusic() {
      if (!this.musicOn) return;
      try {
        if (!ctx()) return;
        if (!music.on) { music.on = true; music.next = ac.currentTime + 0.1; music.timer = setInterval(schedule, 40); }
        this.fadeMusic();
      } catch (_) { /* sin audio */ }
    },
    stopMusic() {
      music.on = false;
      if (music.timer) clearInterval(music.timer);
      music.timer = null;
      if (musicGain) musicGain.gain.setTargetAtTime(0, ac.currentTime, 0.1);
    },
    setMood(mood) { music.mood = mood; this.fadeMusic(); },
    // La música casi desaparece durante la cámara lenta (el silencio hace más fuerte el golpe)
    duck(on) { if (music.duck === !!on) return; music.duck = !!on; try { if (musicGain) musicGain.gain.setTargetAtTime(musicLevel(), ac.currentTime, on ? 0.08 : 0.3); } catch (_) { /* sin audio */ } },
    setDarkness(d) { music.dark = Math.max(0, Math.min(1, d)); },
    fadeMusic() { if (musicGain) musicGain.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.4); },
    setSfx(on) { this.sfxOn = on; },
    setMusic(on) { this.musicOn = on; if (on) this.startMusic(); else this.stopMusic(); },
  };
})(window.SN);
