// Palabras clave con color y movimiento. Censo de lo que se marca (y por qué):
//   dinero   (dorado, brillo)      cantidades como $250, ×-cantidades con signo, dinero / dólares / pavos
//   siete    (arcoíris)            cada 7 (también dentro de una cantidad) y la palabra "siete"
//   suerte   (verde, ola)          suerte, afortunado/a, fortuna
//   mejora   (cian, brillo)        lo que te hace más fuerte: Límite, Análisis, Resistencia, Plan B, multiplicador,
//                                  apalancamiento y los multiplicadores escritos (×10, x2...)
//   regalo   (magenta, destello)   lo que se abre o se regala: regalo(s), desbloquear, mercado nuevo, Mercado
//                                  Dorado / Negro, Academia, Tienda, Mejoras y los mercados (Salud, Tecnología,
//                                  Negocios, Minería)
//   peligro  (coral, tiembla)      lo que te puede hundir: deuda(s), plazo(s), embargo, liquidado, liquidación,
//                                  bancarrota, cobrador, intereses
//   acción   (amarillo, late)      los botones que nombra el texto, solo en MAYÚSCULAS: COBRAR, SUBIRÁ, BAJARÁ, ESPERAR
// De paso, el nombre del programa, FUTURO.exe, sale en el idioma secreto (SN.Cipher.brand) y las letras cirílicas
// sueltas se pintan como cifrado.
//   SN.KW.html(texto, opts)  -> HTML (escapado) con las palabras envueltas
//   SN.KW.apply(el, opts)    -> lo mismo sobre el texto de un elemento ya pintado. No toca el texto cifrado, los
//                               botones, las teclas ni lo que tenga data-nokw (dentro del elemento).
//   opts.terms = false       -> solo dinero, 7 y suerte (para listas como la tienda, donde todo sería clave)
// Las animaciones están en css/style.css (.kw-*) y se paran con prefers-reduced-motion.
(function (SN) {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GLYPHS = () => Object.values(SN.Data.cipher ? SN.Data.cipher.alphabet : {}).join('');
  const B = '(?<![\\wÀ-ÿ])', E = '(?![\\wÀ-ÿ])'; // bordes de palabra que entienden los acentos
  const word = (alts) => `${B}(?:${alts})${E}`;
  // El orden importa: lo más largo y lo más concreto, primero
  const PARTS = [
    ['brand', 'FUTURO\\.exe'],
    ['money', `(?:[+−-]\\s?)?\\$\\s?\\d(?:[\\d.,]*\\d)?\\s?[KM]?${E}|${word('dinero|dólares|dolares|pavos')}`],
    ['gift', word('mercados? nuevos?|mercado dorado|mercado negro|regalos?|desbloque(?:a|as|an|ar|ado|ada|ados|adas)|academia|tienda|mejoras|salud|tecnología|tecnologia|negocios|minería|mineria')],
    ['up', `${word('límite|limite|análisis|analisis|resistencia|plan b|multiplicador(?:es)?|apalancamiento')}|${B}[×x]\\s?\\d+${E}|${B}\\d+\\s?[×x]${E}`],
    ['risk', word('deudas?|plazos?|embargos?|embargad[oa]|liquidad[oa]s?|liquidación|liquidacion|bancarrota|cobrador(?:es)?|intereses')],
    ['act', word('COBRAR|SUBIRÁ|BAJARÁ|ESPERAR')],
    ['seven', word('siete')],
    ['luck', word('suerte|afortunad[oa]s?|fortuna')],
    ['seven1', '7'],
  ];
  const TERMS = new Set(['gift', 'up', 'risk', 'act']);
  const cache = {};
  function pattern(terms) {
    const g = GLYPHS(), key = (terms ? 't' : 'b') + g;
    if (!cache[key]) {
      const parts = PARTS.filter(([n]) => terms || !TERMS.has(n)).map(([n, src]) => `(?<${n}>${src})`);
      if (g) parts.push(`(?<cyr>[${g}]+)`);
      cache[key] = { re: new RegExp(parts.join('|'), 'gi'), test: new RegExp(parts.join('|'), 'i') };
    }
    return cache[key];
  }
  // Cada letra en su <i> con su retraso: así el arcoíris y la ola van letra a letra
  const letters = (t, from = 0) => [...t].map((ch, i) => (ch === ' ' ? ' ' : `<i style="--i:${from + i}">${esc(ch)}</i>`)).join('');
  const sevens = (t) => esc(t).replace(/7/g, '<span class="kw-7 in"><i style="--i:0">7</i></span>');

  const KW = SN.KW = {
    html(text, opts = {}) {
      const { re } = pattern(opts.terms !== false);
      let out = '', last = 0, m;
      const s = String(text);
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        const k = m.groups, t = m[0];
        out += esc(s.slice(last, m.index));
        if (k.brand) out += SN.Cipher ? SN.Cipher.brand(k.brand.endsWith('EXE')) : esc(t);
        else if (k.money) out += `<span class="kw kw-gold">${sevens(t)}</span>`;
        else if (k.gift) out += `<span class="kw kw-gift">${letters(t)}</span>`;
        else if (k.up) out += `<span class="kw kw-up">${/7/.test(t) ? sevens(t) : letters(t)}</span>`;
        else if (k.risk) out += `<span class="kw kw-risk">${letters(t)}</span>`;
        // Las acciones solo cuentan escritas como el botón (en mayúsculas)
        else if (k.act) out += t === t.toUpperCase() ? `<span class="kw kw-act">${letters(t)}</span>` : esc(t);
        else if (k.seven || k.seven1) out += `<span class="kw kw-7">${letters(t)}</span>`;
        else if (k.luck) out += `<span class="kw kw-luck">${letters(t)}</span>`;
        else if (k.cyr) out += `<span class="cx">${esc(t)}</span>`;
        last = m.index + t.length;
        if (!t.length) re.lastIndex++;
      }
      return out + esc(s.slice(last));
    },
    // ¿Hay algo que pintar en este texto?
    has(text, opts = {}) { return pattern(opts.terms !== false).test.test(String(text)); },

    apply(root, opts = {}) {
      if (!root || typeof document === 'undefined') return root;
      const skip = 'kbd,button,input,textarea,.cx,.cx-k,.cx-brand,[data-nokw],.kw';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.nodeValue || !this.has(n.nodeValue, opts)) continue;
        // Solo cuenta lo que hay DENTRO del elemento (un aviso puede ser un botón entero)
        let p = n.parentElement, bad = false;
        while (p && p !== root) { if (p.matches(skip)) { bad = true; break; } p = p.parentElement; }
        if (!bad) nodes.push(n);
      }
      for (const n of nodes) {
        const tmp = document.createElement('span');
        tmp.innerHTML = this.html(n.nodeValue, opts);
        n.replaceWith(...tmp.childNodes);
      }
      return root;
    },
  };
  void KW;
})(window.SN);
