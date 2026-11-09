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
      S.sync();
      write(KEY_RUN, S.run);
      this.saveProfile();
    },
    loadRun() {
      const run = read(KEY_RUN);
      return run && run.v === 3 && !run.over ? run : null; // las partidas de la 1.4 o antes no se cargan
    },
    hasRun() { return !!this.loadRun(); },
    clearRun() { try { localStorage.removeItem(KEY_RUN); } catch (_) { /* sin almacenamiento */ } },

    saveProfile() { write(KEY_PROFILE, S.profile); },
    loadProfile() {
      const p = read(KEY_PROFILE);
      if (p) {
        Object.assign(S.profile, p);
        S.profile.settings = Object.assign({ music: true, sfx: true }, p.settings || {});
      }
    },
  };
})(window.SN);
