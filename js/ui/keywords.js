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
  const B = '(?<![\\wÀ-ɏ])', E = '(?![\\wÀ-ɏ])'; // bordes de palabra que entienden los acentos (también ă ș ł ğ ı č...)
  const word = (alts) => `${B}(?:${alts})${E}`;
  // Las palabras de cada color, en cada idioma (js/core/i18n.js). "act" son los botones: solo cuentan en mayúsculas.
  const WORDS = {
    es: {
      money: 'dinero|dólares|dolares|pavos',
      gift: 'mercados? nuevos?|mercado dorado|mercado negro|regalos?|desbloque(?:a|as|an|ar|ado|ada|ados|adas)|academia|tienda|mejoras|salud|tecnología|tecnologia|negocios|minería|mineria',
      up: 'límite|limite|análisis|analisis|resistencia|plan b|multiplicador(?:es)?|apalancamiento',
      risk: 'deudas?|plazos?|embargos?|embargad[oa]|liquidad[oa]s?|liquidación|liquidacion|bancarrota|cobrador(?:es)?|intereses',
      act: 'COBRAR|SUBIRÁ|BAJARÁ|ESPERAR', seven: 'siete', luck: 'suerte|afortunad[oa]s?|fortuna',
    },
    en: {
      money: 'money|dollars|bucks|cash',
      gift: 'new markets?|golden market|black market|gifts?|unlock(?:s|ed|ing)?|academy|shop|upgrades|health|tech(?:nology)?|business|mining',
      up: 'limit|analysis|resistance|plan b|multipliers?|leverage',
      risk: 'debts?|deadlines?|seizures?|seized|repossess(?:ed|ion)?|liquidated|liquidation|bankrupt(?:cy)?|collectors?|interest',
      act: 'CASH OUT|UP|DOWN|WAIT', seven: 'seven', luck: 'luck|lucky|fortune',
    },
    pt: {
      money: 'dinheiro|dólares|dolares|grana',
      gift: 'mercados? novos?|novos? mercados?|mercado dourado|mercado negro|presentes?|desbloque(?:ia|ias|iam|ar|ado|ada|ados|adas)|academia|loja|melhorias|saúde|saude|tecnologia|negócios|negocios|mineração|mineracao',
      up: 'limite|análise|analise|resistência|resistencia|plano b|multiplicador(?:es)?|alavancagem',
      risk: 'dívidas?|dividas?|prazos?|penhoras?|penhorad[oa]s?|liquidad[oa]s?|liquidação|liquidacao|falência|falencia|cobrador(?:es)?|juros',
      act: 'SACAR|SOBE|DESCE|ESPERAR', seven: 'sete', luck: 'sorte|sortud[oa]s?|fortuna',
    },
    fr: {
      money: 'argent|dollars?|fric|thune|sous',
      gift: 'nouveaux? march[eé]s?|march[eé] dor[eé]|march[eé] noir|cadeaux?|d[eé]bloqu(?:e|es|er|[eé]|[eé]e|[eé]s|[eé]es)|acad[eé]mie|boutique|am[eé]liorations?|sant[eé]|tech(?:nologie)?|commerces?|mines?',
      up: 'limite|analyse|r[eé]sistance|plan b|multiplicateurs?|levier',
      risk: 'dettes?|[eé]ch[eé]ances?|saisies?|saisi|saisir|huissiers?|liquid[eé]e?s?|liquidation|faillite|int[eé]r[eê]ts',
      act: 'ENCAISSER|HAUSSE|BAISSE|ATTENDRE', seven: 'sept', luck: 'chance|chanceux|chanceuse|fortune',
    },
    de: {
      money: 'geld|dollars?|kohle|cash',
      gift: 'neuer? märkte?|neuen? märkte?|neuer markt|goldmarkt|schwarzmarkt|schwarz-[a-zäöüß]+|geschenk(?:e|en|s)?|freischalt(?:e|en|et|ung)?|freigeschaltet|akademie|shop|upgrades?|gesundheit|tech|handel|bergbau',
      up: 'limit|analyse|widerstand|plan b|multiplikator(?:en)?|hebel',
      risk: 'schulden?|schuld|frist(?:en)?|pfändung(?:en)?|gepfändet|pfänden|liquidiert|liquidation|pleite|insolvenz|eintreiber[a-z]*|zinsen|verzugszinsen',
      act: 'KASSIEREN|STEIGT|FÄLLT|WARTEN', seven: 'sieben|siebenblättriges', luck: 'glück|glücks[a-zäöüß]*|glücklich|glückstag|fortuna',
    },
    it: {
      money: 'soldi|denaro|dollari|contanti',
      gift: 'mercati? nuov[oi]|nuovi? mercati?|mercato dorato|mercato nero|regal[oi]|sblocc(?:a|ano|ato|ata|ati|ate|are)|accademia|negozio|migliorie|miglioria|salute|tecnologia|affari|miniere|miniera',
      up: 'limite|analisi|resistenza|piano b|moltiplicator[ei]|leva',
      risk: 'debit[oi]|scadenz[ae]|pignorament[oi]|pignorat[oi]|pignorare|liquidat[oi]|liquidazione|fallimento|esattor[ei]|interessi',
      act: 'INCASSA|SALIRÀ|SCENDERÀ|ASPETTA', seven: 'sette', luck: 'fortuna|fortunat[oiae]|sorte',
    },
    ro: {
      money: 'bani|banii|dolari|dolarii|dolar|numerar',
      gift: 'piețe noi|piață nouă|piața de aur|piața neagră|cadou|cadouri|cadoul|cadourile|deblochez|deblocat|academia|magazin|magazinul|îmbunătățiri|îmbunătățirile|sănătate|sănătatea|tehnologie|tehnologia|afaceri|afacerile|minerit|mineritul',
      up: 'limită|limita|analiză|analiza|rezistență|rezistența|plan b|multiplicator|multiplicatorul|multiplicatori|multiplicatorii',
      risk: 'datorie|datoria|datorii|datoriile|datorezi|termen limită|executor|executorul|executorii|sechestru|sechestrat|sechestrată|lichidat|lichidare|lichidarea|faliment|dobândă|dobânzi|dobânzile',
      act: 'ÎNCASEAZĂ|URCĂ|SCADE|AȘTEAPTĂ', seven: 'șapte|sapte', luck: 'noroc|norocul|norocos|norocoasă|norocoase|avere|averea',
    },
    tr: {
      money: 'para[a-zçğıöşü]*|dolar[a-zçğıöşü]*|papel',
      gift: 'yeni piyasa[a-zçğıöşü]*|altın pazar[a-zçğıöşü]*|kara piyasa[a-zçğıöşü]*|hediye[a-zçğıöşü]*|akademi[a-zçğıöşü]*|mağaza[a-zçğıöşü]*|geliştirme[a-zçğıöşü]*|sağlık|teknoloji[a-zçğıöşü]*|işletme[a-zçğıöşü]*|madencilik|kilit[a-zçğıöşü]*',
      up: 'limit[a-zçğıöşü]*|analiz[a-zçğıöşü]*|direnç[a-zçğıöşü]*|plan b|çarpan[a-zçğıöşü]*|kaldıraç[a-zçğıöşü]*',
      risk: 'borç[a-zçğıöşü]*|süre[a-zçğıöşü]*|haciz[a-zçğıöşü]*|tasfiye[a-zçğıöşü]*|iflas[a-zçğıöşü]*|tahsildar[a-zçğıöşü]*|faiz[a-zçğıöşü]*',
      act: 'ÇEK|YÜKSELİR|DÜŞER|BEKLE', seven: 'yedi', luck: 'şans[a-zçğıöşü]*|talih[a-zçğıöşü]*|servet[a-zçğıöşü]*',
    },
    nl: {
      money: 'geld|dollars?|poen|centen|cash',
      gift: 'nieuwe markt(?:en)?|gouden markt|zwarte markt(?:en)?|cadeau|cadeaus|ontgrendel(?:t|en|d)?|academie|winkel|upgrades?|gezondheid|tech|bedrijven|mijnbouw',
      up: 'limiet|analyse|weerstand|plan b|vermenigvuldigers?|hefboom',
      risk: 'schulden?|schuld|deadlines?|beslag|inbeslag|geliquideerd|liquidatie|faillissement|deurwaarders?|incassobureaus?|rente',
      act: 'CASHEN|STIJGT|DAALT|WACHTEN', seven: 'zeven', luck: 'geluk|geluksdag|gelukkig|fortuin|lot',
    },
    sv: {
      money: 'pengar(?:na)?|dollar(?:n)?|spänn|kosing|stålar',
      gift: 'nya? marknad(?:er|en|erna)?|gyllene marknaden|svarta marknaden|svart (?:hälsa|teknik|handel)|svarta gruvor|presenter(?:na)?|present(?:en)?|akademi(?:n|er)?|butik(?:en|er|erna)?|uppgradering(?:ar|arna)?|hälsa|teknik|handel|gruvor|gruvmarknad(?:en)?|öppnar|låser upp',
      up: 'gräns(?:en)?|analys(?:en)?|motstånd(?:et)?|plan b|multiplikator(?:n|er|erna)?|hävstång',
      risk: 'skuld(?:en|er|erna)?|frist(?:en)?|tiden ute|utmätning(?:en)?|utmätt|utmäta|likviderad|likvidation(?:en)?|konkurs|indrivare(?:n)?|indrivarna|ränta(?:n)?|dröjsmålsränta',
      act: 'TA UT|UPP|NER|VÄNTA', seven: 'sju|sjua(?:n)?', luck: 'tur(?:en)?|lyckodag(?:en)?|lycklig|lyckliga|lycko\\w*|förmögenhet(?:en)?',
    },
    cs: {
      money: 'peníz(?:e|ů|ům|ích)|pen[ií]ze|dolar(?:y|ů|ů|ech)?|dolarů|prachy|babky|babek|hotovost',
      gift: 'nov(?:ý|é|ém|ých) trh(?:y|ů|u)?|zlat(?:ý|ého|ém) trh(?:u)?|černý trh|černého trhu|dárek|dárky|dárků|dárku|dárkem|odemyk(?:á|ám|ají|nout|nuto|nutý)|akademie|akademii|akademií|obchod(?:u|em|y)?|vylepšení|zdraví|technologi(?:e|í|ích)|byznys(?:u)?|těžba|těžby|těžbu',
      up: 'limit(?:u|em|y)?|analýz(?:a|u|y|ou)|odolnost(?:i)?|plán b|násobič(?:e|i|em)?|páka',
      risk: 'dluh(?:u|y|ů|em|ech)?|termín(?:u|y|ů)?|exekuc(?:e|i|í)|zabaven(?:ý|o|é|í)|likvidac(?:e|i|í)|likvidován(?:o|a|ý)|zlikvidován(?:o|a|ý)|bankrot(?:u)?|vymahač(?:e|i|ů|ům)?|úrok(?:y|ů|ům)?',
      act: 'VYBRAT|NAHORU|DOLŮ|ČEKAT', seven: 'sedm(?:i|ička|ičky|ičkou|ičku)?', luck: 'štěst(?:í|ěna|ěny|ěně)|šťastn(?:ý|á|é|ém|ých)|jmění',
    },
    id: {
      money: 'uang|dolar|duit|perak',
      gift: 'pasar baru|pasar emas|pasar gelap|hadiah|membuka|terbuka|akademi|toko|upgrade|kesehatan|teknologi|bisnis|tambang',
      up: 'batas|analisis|ketahanan|plan b|pengganda|leverage',
      risk: 'utang|tenggat|sita|disita|penyitaan|likuidasi|terlikuidasi|bangkrut|kebangkrutan|penagih|bunga',
      act: 'CAIRKAN|NAIK|TURUN|TUNGGU', seven: 'tujuh', luck: 'hoki|keberuntungan|beruntung|nasib baik',
    },
    pl: {
      money: 'pieni[ąa]d(?:z|ze|zy|zach|zami|zów|zom|ze)|pieniądze|dolar(?:y|ów|ach|ami)?|dolców|kasa|kasy|kasę|kasie|kasą|gotówk(?:a|i|ę|ą)',
      gift: 'now(?:y|e|ego|ym) rynk(?:i|ów|ach)?|złot(?:y|ego|ym) rynek|złotym rynku|czarn(?:y|ego|ym) rynek|czarnym rynku|prezent(?:y|ów|em|u|ach)?|odblokow(?:uję|uje|ać|any|ana|ane|ani)|akademi(?:a|i|ę|ą)|sklep(?:u|ie|em|y|ów)?|ulepszeni(?:a|e|ach|ami)|zdrowi(?:e|a|u)|technologi(?:a|i|ę|ą)|biznes(?:u|y|ów|ie|em)?|górnictw(?:o|a|u|em)',
      up: 'limit(?:u|em|y)?|analiz(?:a|y|ę|ie|ą)|odporno(?:ść|ści|ścią)|plan(?:u|em)? b|mnożnik(?:a|i|ów|iem|u)?|dźwigni(?:a|i|ę|ą)',
      risk: 'dług(?:i|u|iem|ów|ach|om)?|termin(?:u|em|y|ów)?|zajęci(?:e|a|u|em)|zajęt(?:y|a|e|ych)|likwidacj(?:a|i|ę|ą)|zlikwidowan(?:o|y|a|e)|bankructw(?:o|a|u|em)|windykator(?:a|ów|em|zy|owi)?|odsetk(?:i|ów|ami|ach|om)',
      act: 'WYPŁAĆ|WZROŚNIE|SPADNIE|CZEKAJ', seven: 'siedem|siódemk(?:a|i|ę|ą)|siódm(?:y|a|e)', luck: 'szczęści(?:e|a|u|em)|szczęśliw(?:y|a|e|ych)|fortun(?:a|y|ę|ą)',
    },
    ca: {
      money: 'diners|dòlars|dolars|dòlar|peles|calés',
      gift: 'mercats? nous?|nous? mercats?|mercat daurat|mercat negre|regals?|desbloque(?:ja|ges|gen|jar|jat|jada|jats|jades|jo)|acadèmia|academia|botiga|millores|salut|tecnologia|negocis|mineria',
      up: 'límit|limit|anàlisi|analisi|resistència|resistencia|pla b|multiplicadors?|palanquejament',
      risk: 'deutes?|terminis?|embargaments?|embargat|embargada|liquidat|liquidada|liquidats|liquidades|liquidació|liquidacio|fallida|cobradors?|interessos',
      act: 'COBRAR|PUJARÀ|BAIXARÀ|ESPERAR', seven: 'set', luck: 'sort|afortunat|afortunada|afortunats|afortunades|fortuna',
    },
  };
  const Wd = WORDS[SN.I18n && SN.I18n.lang] || WORDS.es;
  // El orden importa: lo más largo y lo más concreto, primero
  const PARTS = [
    ['brand', 'FUTURO\\.exe'],
    ['money', `(?:[+−-]\\s?)?\\$\\s?\\d(?:[\\d.,]*\\d)?\\s?[KM]?${E}|${word(Wd.money)}`],
    ['gift', word(Wd.gift)],
    ['up', `${word(Wd.up)}|${B}[×x]\\s?\\d+${E}|${B}\\d+\\s?[×x]${E}`],
    ['risk', word(Wd.risk)],
    ['act', word(Wd.act)],
    ['seven', word(Wd.seven)],
    ['luck', word(Wd.luck)],
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
