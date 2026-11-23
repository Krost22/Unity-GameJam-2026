// Idiomas. El juego está escrito en español; cada idioma es un diccionario { 'texto en español': 'traducción' }
// (js/i18n/en.js, js/i18n/pt.js...). Lo que no esté en el diccionario sale en español.
//   SN.T('Texto', { n: 3 })  traduce un texto de la interfaz ({n} se rellena con vars.n)
//   applyData(SN.Data)       traduce todos los datos de js/data al cargar (js/i18n/apply.js)
//   applyDOM(nodo)           traduce los textos fijos de index.html
// El idioma se elige en Ajustes, se guarda en el perfil y cambiarlo recarga la página (todo sale ya traducido).
// La partida guarda en qué idioma están sus textos (noticias, chats...): si se carga en otro, se convierten.
// Para añadir un idioma: una entrada en LANGS (con su bandera, js/render/sprites.js), su diccionario en js/i18n/,
// su <script> en index.html y sus palabras de color (js/ui/keywords.js). Más detalles en el README.
// node tools/i18n.js dice qué textos faltan por traducir.
window.SN = window.SN || {};
(function (SN) {
  'use strict';

  // flag: la bandera de Ajustes (js/render/sprites.js, FLAGS)
  const LANGS = [
    { id: 'es', name: 'Español', flag: 'es' },
    { id: 'en', name: 'English', flag: 'us' },
    { id: 'pt', name: 'Português', flag: 'br' },
    { id: 'fr', name: 'Français', flag: 'fr' },
    { id: 'de', name: 'Deutsch', flag: 'de' },
    { id: 'it', name: 'Italiano', flag: 'it' },
    { id: 'ro', name: 'Română', flag: 'ro' },
    { id: 'pl', name: 'Polski', flag: 'pl' },
    { id: 'tr', name: 'Türkçe', flag: 'tr' },
    { id: 'nl', name: 'Nederlands', flag: 'nl' },
    { id: 'sv', name: 'Svenska', flag: 'se' },
    { id: 'cs', name: 'Čeština', flag: 'cz' },
    { id: 'id', name: 'Indonesia', flag: 'id' },
    { id: 'ca', name: 'Català', flag: 'ca' },
  ];
  const BASE = 'es';
  const dicts = {};
  const known = (id) => LANGS.some((l) => l.id === id);

  // El idioma guardado en el perfil; si no hay, el del navegador (y si no es ninguno de los nuestros, inglés)
  function pick() {
    try {
      const p = JSON.parse(localStorage.getItem('saldonegro.profile.v1') || 'null');
      const l = p && p.settings && p.settings.lang;
      if (known(l)) return l;
    } catch (_) { /* sin almacenamiento */ }
    if (typeof navigator === 'undefined') return BASE;
    for (const n of navigator.languages || [navigator.language || '']) {
      const id = String(n).slice(0, 2).toLowerCase();
      if (known(id)) return id;
    }
    return 'en';
  }

  // Campos de los datos que son nombres internos (ids, iconos, colores...): nunca se traducen
  const SKIP = new Set(['id', 'kind', 'art', 'icon', 'sprite', 'tone', 'market', 'ev', 'color', 'colors', 'cls', 'mood',
    'who', 'type', 'key', 'sel', 'letter', 'file', 'src', 'track', 'branch', 'flag', 'when', 'orWhen', 'unlockBy', 'item', 'target', 'wait', 'spot', 'spots', 'open', 'skipIf']);
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);
  const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const I = SN.I18n = {
    LANGS,
    BASE,
    lang: pick(),

    add(id, dict) { Object.assign(dicts[id] || (dicts[id] = {}), dict); },
    dict(id) { return dicts[id] || {}; },
    name(id) { const l = LANGS.find((x) => x.id === id); return l ? l.name : id; },

    // El texto (en español) en el idioma actual
    t(es, vars) {
      if (es == null) return es;
      const d = dicts[I.lang];
      const s = I.lang !== BASE && d && d[es] != null ? d[es] : es;
      return fill(String(s), vars);
    },
    has(es) { const d = dicts[I.lang]; return I.lang === BASE || !!(d && d[es] != null); },

    // Cambia de idioma: se guarda en el perfil y se recarga la página (la partida ya está guardada)
    set(id) {
      if (!known(id) || id === I.lang) return;
      const S = SN.State;
      if (S && S.profile) { S.profile.settings.lang = id; if (SN.Save) { SN.Save.saveRun(); SN.Save.saveProfile(); } }
      try { location.reload(); } catch (_) { I.lang = id; }
    },

    // ---------- Datos (js/data) ----------
    // Recorre los datos y cambia cada texto que tenga traducción. Los nombres internos (ids, iconos...) no.
    applyData(root) {
      if (I.lang === BASE || !dicts[I.lang]) return;
      const d = dicts[I.lang], seen = new Set();
      const walk = (o) => {
        if (!o || typeof o !== 'object' || seen.has(o)) return;
        seen.add(o);
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (typeof v === 'string') { if (!SKIP.has(k) && d[v] != null) o[k] = d[v]; } else if (v && typeof v === 'object' && !SKIP.has(k)) walk(v);
        }
      };
      walk(root);
    },

    // ---------- index.html ----------
    // Textos y títulos fijos de la página: los que coinciden (sin espacios alrededor) con el diccionario
    applyDOM(root) {
      if (I.lang === BASE || !dicts[I.lang] || !root) return;
      const d = dicts[I.lang];
      const doc = root.ownerDocument || root;
      const tw = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const raw = n.nodeValue, key = raw.trim();
        if (key && d[key] != null) n.nodeValue = raw.replace(key, d[key]);
      }
      for (const el of root.querySelectorAll('[title], [aria-label]')) {
        for (const a of ['title', 'aria-label']) { const v = el.getAttribute(a); if (v && d[v] != null) el.setAttribute(a, d[v]); }
      }
      if (doc.documentElement) doc.documentElement.lang = I.lang;
    },

    // ---------- Textos guardados en la partida ----------
    // Pasa un texto de un idioma a otro: exacto o como plantilla ('Día {n}' -> 'Day {n}')
    convert(str, from, to) {
      if (typeof str !== 'string' || from === to || !str) return str;
      const src = I.source(str, from);
      if (!src) return str;
      const d = to === BASE ? null : dicts[to] || {};
      const tpl = d && d[src.key] != null ? d[src.key] : src.key;
      const vars = {};
      for (const [k, v] of Object.entries(src.vars)) vars[k] = I.convert(v, from, to);
      return fill(tpl, vars);
    },
    // De qué texto en español sale `str` (escrito en el idioma `from`): { key, vars } o null
    source(str, from) {
      const rev = I._rev(from);
      if (rev.exact.has(str)) return { key: rev.exact.get(str), vars: {} };
      for (const t of rev.tpl) {
        const m = t.rx.exec(str);
        if (!m) continue;
        const vars = {};
        t.names.forEach((nm, i) => { vars[nm] = m[i + 1]; });
        return { key: t.key, vars };
      }
      return null;
    },
    _revs: {},
    _rev(from) {
      if (I._revs[from]) return I._revs[from];
      const exact = new Map(), tpl = [];
      // En español, cada clave es su propio texto
      let d = dicts[from] || {};
      if (from === BASE) { d = {}; for (const x of Object.values(dicts)) for (const k of Object.keys(x)) d[k] = k; }
      for (const [key, val] of Object.entries(d)) {
        if (/\{\w+\}/.test(val)) {
          const names = [];
          const rx = new RegExp('^' + escRx(val).replace(/\\\{(\w+)\\\}/g, (_, nm) => { names.push(nm); return '([\\s\\S]*?)'; }) + '$');
          tpl.push({ key, rx, names });
        } else if (!exact.has(val)) exact.set(val, key);
      }
      tpl.sort((a, b) => b.rx.source.length - a.rx.source.length); // las más concretas primero
      return (I._revs[from] = { exact, tpl });
    },
    // Recorre la partida y pasa sus textos al idioma actual (noticias, chats, nombres de deudas...)
    convertRun(run) {
      if (!run) return;
      const from = run.lang || BASE, to = I.lang;
      run.lang = to;
      if (from === to) return;
      const seen = new Set();
      const ok = (s) => /[\sA-ZÁÉÍÓÚÑ¿¡]/.test(s); // (los nombres internos van en minúsculas y sin espacios)
      const walk = (o) => {
        if (!o || typeof o !== 'object' || seen.has(o)) return;
        seen.add(o);
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (typeof v === 'string') { if (!SKIP.has(k) && ok(v)) o[k] = I.convert(v, from, to); } else if (v && typeof v === 'object' && !SKIP.has(k)) walk(v);
        }
      };
      walk(run);
    },
  };
  SN.T = I.t;
})(window.SN);
