// SaveManager: guarda la partida y el perfil en localStorage. Nunca rompe el juego si el navegador
// bloquea el almacenamiento (modo privado, file:// restringido...): simplemente no guarda.
(function (SN) {
  'use strict';
  const S = SN.State;
  const KEY_RUN = 'saldonegro.run.v1';
  const KEY_PROFILE = 'saldonegro.profile.v1';

  function read(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  SN.Save = {
    saveRun() {
      if (!S.run || S.run.over || (SN.Tutorial && SN.Tutorial.replaying)) return;
      // Mientras dura un final no se guarda: si se recarga, se vuelve a la elección
      if (S.run.finale && S.run.finale.lock) { this.saveProfile(); return; }
      S.sync();
      write(KEY_RUN, S.run);
      this.saveProfile();
    },
    loadRun() {
      const run = read(KEY_RUN);
      if (!run || run.v !== 4 || run.over) return null; // las partidas de la 1.5 o antes no se cargan
      // (la Ruleta de la Fortuna ya no existe: fuera de los días de la suerte guardados)
      if (run.luck && Array.isArray(run.luck.events)) run.luck.events = run.luck.events.filter((e) => SN.Data.luck.specials[e]);
      delete run.shield;
      if (SN.I18n) SN.I18n.convertRun(run); // textos guardados en otro idioma: al de ahora
      return run;
    },
    hasRun() { return !!this.loadRun(); },
    clearRun() { try { localStorage.removeItem(KEY_RUN); } catch (_) { /* sin almacenamiento */ } },

    saveProfile() { write(KEY_PROFILE, S.profile); },
    loadProfile() {
      const p = read(KEY_PROFILE);
      if (p) {
        Object.assign(S.profile, p);
        S.profile.settings = Object.assign({ music: true, sfx: true, volume: 1 }, p.settings || {});
      }
    },
  };
})(window.SN);
