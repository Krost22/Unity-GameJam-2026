// Palabras clave con color y movimiento: el DINERO en dorado (cantidades como $250 y las palabras dinero,
// dólares y pavos), el 7 en arcoíris (cada 7, también dentro de una cantidad, y la palabra "siete") y la
// SUERTE en verde (suerte, afortunado/a, fortuna). De paso, el nombre del programa, FUTURO.exe, sale en el
// idioma secreto (SN.Cipher.brand) y las letras cirílicas sueltas se pintan como cifrado.
//   SN.KW.html(texto)  -> HTML (escapado) con las palabras envueltas
//   SN.KW.apply(el)    -> lo mismo sobre el texto de un elemento ya pintado. No toca el texto cifrado, los
//                         botones, las teclas ni lo que tenga data-nokw (dentro del elemento).
// Las animaciones están en css/style.css (.kw-gold, .kw-7, .kw-luck) y se paran con prefers-reduced-motion.
(function (SN) {
  'use strict';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GLYPHS = () => Object.values(SN.Data.cipher ? SN.Data.cipher.alphabet : {}).join('');
  // Orden: el nombre del programa, el dinero (con sus 7 dentro), "siete", la suerte, un 7 suelto, cirílico
  const SRC = '(FUTURO\\.exe)|((?:[+−-]\\s?)?\\$\\s?\\d(?:[\\d.,]*\\d)?\\s?[KM]?(?![\\wÀ-ÿ])|(?<![\\wÀ-ÿ])(?:dinero|dólares|dolares|pavos)(?![\\wÀ-ÿ]))' +
    '|((?<![\\wÀ-ÿ])siete(?![\\wÀ-ÿ]))|((?<![\\wÀ-ÿ])(?:suerte|afortunad[oa]s?|fortuna)(?![\\wÀ-ÿ]))|(7)';
  let re = null, reTest = null, glyphs = '';
  function patterns() {
    const g = GLYPHS();
    if (re && g === glyphs) return;
    glyphs = g;
    const cyr = g ? `|([${g}]+)` : '';
    re = new RegExp(SRC + cyr, 'gi');
    reTest = new RegExp(SRC + cyr, 'i');
  }
  // Cada letra en su <i> con su retraso: así el arcoíris y la ola van letra a letra
  const letters = (t, from = 0) => [...t].map((ch, i) => `<i style="--i:${from + i}">${esc(ch)}</i>`).join('');
  const sevens = (t) => esc(t).replace(/7/g, '<span class="kw-7 in"><i style="--i:0">7</i></span>');

  const KW = SN.KW = {
    html(text) {
      patterns();
      let out = '', last = 0, m;
      const s = String(text);
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        out += esc(s.slice(last, m.index));
        if (m[1]) out += SN.Cipher ? SN.Cipher.brand(m[1].endsWith('EXE')) : esc(m[1]);
        else if (m[2]) out += `<span class="kw kw-gold">${sevens(m[2])}</span>`;
        else if (m[3]) out += `<span class="kw kw-7">${letters(m[3])}</span>`;
        else if (m[4]) out += `<span class="kw kw-luck">${letters(m[4])}</span>`;
        else if (m[5]) out += `<span class="kw kw-7">${letters(m[5])}</span>`;
        else if (m[6]) out += `<span class="cx">${esc(m[6])}</span>`;
        last = m.index + m[0].length;
        if (!m[0].length) re.lastIndex++;
      }
      return out + esc(s.slice(last));
    },
    // ¿Hay algo que pintar en este texto?
    has(text) { patterns(); return reTest.test(String(text)); },

    apply(root) {
      if (!root || typeof document === 'undefined') return root;
      const skip = 'kbd,button,input,textarea,.cx,.cx-k,.cx-brand,[data-nokw],.kw';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.nodeValue || !this.has(n.nodeValue)) continue;
        // Solo cuenta lo que hay DENTRO del elemento (un aviso puede ser un botón entero)
        let p = n.parentElement, bad = false;
        while (p && p !== root) { if (p.matches(skip)) { bad = true; break; } p = p.parentElement; }
        if (!bad) nodes.push(n);
      }
      for (const n of nodes) {
        const tmp = document.createElement('span');
        tmp.innerHTML = this.html(n.nodeValue);
        n.replaceWith(...tmp.childNodes);
      }
      return root;
    },
  };
  void KW;
})(window.SN);
