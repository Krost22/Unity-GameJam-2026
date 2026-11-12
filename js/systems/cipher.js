// CipherManager: el idioma secreto. Traduce los textos según las letras que ya conoces y registra las
// pistas encontradas. Lo descubierto es de la PARTIDA: una partida nueva empieza sin ninguna letra
// (volver a un punto de control no las quita: lo encontrado, encontrado está).
// No toca la interfaz: avisa con 'cipher:found' y la interfaz hace el ruido (js/ui/ui.js).
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;
  const A = () => D.cipher.alphabet;
  // Mayúsculas y sin tildes (la Ñ queda en N): así cuenta para el cifrado
  const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const esc = (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c);

  const Ci = SN.Cipher = {
    state() {
      const run = S.run;
      if (!run) return { known: {}, found: {} };
      if (!run.cipher) {
        // Partidas guardadas cuando las letras iban en el perfil: pasan a la partida (y el perfil las olvida)
        run.cipher = S.profile.cipher || { known: {}, found: {} };
        delete S.profile.cipher;
      }
      return run.cipher;
    },
    knows(letter) { return !!this.state().known[letter]; },
    count() { return Object.keys(this.state().known).length; },
    total() { return Object.keys(A()).length; },
    complete() { return this.count() >= this.total(); },
    found(clueId) { return !!this.state().found[clueId]; },
    clue(id) { return D.cipher.clues.find((c) => c.id === id); },

    // Letras del texto que forman parte del cifrado (para comprobar que todas tienen pista)
    letters(text) { return [...norm(text)].filter((ch) => /[A-Z]/.test(ch)); },

    // Texto como se ve ahora, sin HTML: lo conocido en latín, lo demás en cirílico
    text(t) { return [...norm(t)].map((ch) => (A()[ch] && !this.knows(ch) ? A()[ch] : ch)).join(''); },

    // HTML: cada letra en su <span> (cx = sin descifrar, cx-k = descifrada; cx-new = la que acabas de encontrar)
    html(t, fresh) {
      let out = '';
      for (const ch of norm(t)) {
        const g = A()[ch];
        if (!g) { out += esc(ch); continue; }
        if (this.knows(ch)) out += `<span class="cx-k${ch === fresh ? ' cx-new' : ''}">${ch}</span>`;
        else out += `<span class="cx">${g}</span>`;
      }
      return out;
    },

    // El nombre del programa en el idioma secreto: FUTURO.exe (lo que ya conoces, en latín).
    // brand() para HTML, brandText() para lienzos y textos que se escriben letra a letra.
    brand(upper) { return `<span class="cx-brand">${this.html('FUTURO')}</span>${upper ? '.EXE' : '.exe'}`; },
    brandText(upper) { return this.text('FUTURO') + (upper ? '.EXE' : '.exe'); },
    // Cambia FUTURO.exe por su versión cifrada en un texto plano
    brandify(t) { return String(t).replace(/FUTURO\.(exe|EXE)/g, (_, e) => this.brandText(e === 'EXE')); },

    // Encuentra la pista: su letra queda descifrada para siempre. Devuelve la pista si es nueva.
    discover(clueId) {
      if (!S.run) return null;
      const st = this.state(), clue = this.clue(clueId);
      if (!clue || st.found[clueId]) return null;
      st.found[clueId] = true;
      const isNew = !st.known[clue.letter];
      st.known[clue.letter] = true;
      if (SN.Save) SN.Save.saveRun();
      SN.Events.emit('cipher:found', { clue, letter: clue.letter, glyph: A()[clue.letter], isNew, count: this.count(), total: this.total() });
      return clue;
    },

    // Comodín (la ruleta de la suerte): una letra que todavía no conoces
    wildcard(rng) {
      const missing = D.cipher.clues.filter((c) => !this.knows(c.letter) && !this.found(c.id));
      if (!missing.length) return null;
      const r = rng ? rng.next() : Math.random();
      return this.discover(missing[Math.floor(r * missing.length)].id);
    },
  };
  void Ci;
})(window.SN);
