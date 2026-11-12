// El idioma secreto (equivalente a un ScriptableObject de lore): una sustitución FIJA de 16 letras del
// español por letras cirílicas. Es arbitraria a propósito (saber ruso no ayuda) y solo usa letras
// cirílicas que no se parecen a ninguna latina. Los textos cifrados SOLO pueden usar estas 16 letras
// (sin B, H, J, K, Ñ, Q, V, W, X, Y, Z; las tildes no cuentan): una prueba lo comprueba, así todo se
// puede leer cuando encuentras las 16 pistas. Lo descubierto se guarda en el perfil: vale para siempre.
// El nombre del programa, FUTURO, también se escribe así (SN.Cipher.brand).
(function (SN) {
  'use strict';

  SN.Data.cipher = {
    // (1.6: la F, para escribir FUTURO en el idioma secreto)
    alphabet: { A: 'Ж', E: 'Д', O: 'Ф', S: 'Я', N: 'И', R: 'Л', I: 'Ш', L: 'Б', D: 'Э', U: 'Ц', T: 'Г', C: 'Ю', M: 'Щ', P: 'П', G: 'Ч', F: 'Ы' },

    // Dónde está cada letra: difícil de encontrar, imposible de no notar al encontrarla.
    // `hint` es la pista vaga que enseña la app Símbolos (una más cada día de la suerte).
    clues: [
      { id: 'errata', letter: 'A', where: 'La "errata" del periódico', hint: 'Lo que el encapuchado dijo que no era relevante.' },
      { id: 'papelera', letter: 'E', where: 'Papelera: no_abrir.txt', hint: 'Hay cosas que se tiran por algo.' },
      { id: 'notas', letter: 'O', where: 'Notas.txt, de noche', hint: 'Las notas cambian cuando se hace de noche.' },
      { id: 'gato', letter: 'S', where: 'El collar del gato', hint: 'Los gatos ven lo que tú no. Espera a que se despierte.' },
      { id: 'cuervo', letter: 'N', where: 'El cuervo del alféizar', hint: 'Un visitante negro en la ventana.' },
      { id: 'logo', letter: 'R', where: 'El logo del escritorio', hint: 'El número de la suerte, en el escritorio.' },
      { id: 'retrato', letter: 'L', where: 'El retrato del encapuchado', hint: 'Cuando su cara parpadea, mírale bien.' },
      { id: 'letra', letter: 'D', where: 'La letra pequeña', hint: 'Lee siempre la letra pequeña.' },
      { id: 'madre', letter: 'U', where: 'El papel de Kevo', hint: 'Alguien te escribe desde una cuenta que no es la suya.' },
      { id: 'azotea', letter: 'T', where: 'La azotea de enfrente', hint: 'A veces mira desde una azotea. No dura mucho.' },
      { id: 'calavera', letter: 'C', where: 'La calavera del mercado negro', hint: 'Tres golpes a la calavera.' },
      { id: 'poster', letter: 'M', where: 'El póster de tu cuarto', hint: 'Cuando la ciudad se apaga, el póster habla.' },
      { id: 'firma', letter: 'I', where: 'La firma de Trompa', hint: 'La firma del presidente parece un garabato. Mírala bien cuando te la enseñe.' },
      { id: 'avatar', letter: 'P', where: 'La foto de LOS DESFASADOS', hint: 'Llama tres veces a su puerta.' },
      { id: 'estrella', letter: 'G', where: 'La Estrella de la Suerte', hint: 'Una estrella que solo sale los días de suerte.' },
      { id: 'acerca', letter: 'F', where: 'Acerca de FUTURO.exe', hint: 'Todo programa tiene su "Acerca de". Mira bien el icono.' },
    ],

    // Quien escribe en este idioma por Mensajín (no se le puede contestar): LOS DESFASADOS, los que ya pagaron
    // "lo otro" (y con ello, su idioma). Son la gente de las noticias raras.
    contact: { id: 'ser', name: 'LOS DESFASADOS' },
    // Cuándo llega cada mensaje (como js/data/chat.js: day/turn, o when/delay en turnos).
    // null: n -> con ese mensaje entregan la parte n de NULL.EXE (con las 3 se puede elegir el final B)
    messages: [
      { id: 's1', day: 2, turn: 1, text: 'NO ESTAS SOLO' },
      { id: 's2', day: 4, turn: 0, text: 'EL DE LA CAPA MIENTE' },
      { id: 's3', when: 'debtPaid', delay: 2, text: 'NO ES UN REGALO' },
      { id: 's4', when: 'tele', delay: 1, text: 'CADA DEUDA TE CUESTA UN RECUERDO' },
      // Al descubrir la primera letra, el encapuchado entra en la conversación
      { id: 'hood', when: 'cipher', delay: 1, orWhen: 'regalo2', orDelay: 1, hood: ['*El encapuchado se ha unido a la conversación.', 'Silencio.', '*LOS DESFASADOS se ha desconectado.'] },
      { id: 's5', when: 'regalo2', delay: 3, text: 'NO DIGAS NADA. SOLO LEE', back: true },
      // (justo después de que Kevo desaparezca: su conversación `ventana` llega a los 6 turnos del tercer regalo)
      { id: 's6', when: 'regalo3', delay: 7, text: 'TU AMIGO ESTA CON NOSOTROS' },
      { id: 'n1', when: 'regalo3', delay: 8, text: 'PARA SOLTAR, PIERDE TODO', null: 1 },
      { id: 's7', when: 'regalo4', delay: 2, text: 'NOSOTROS TAMPOCO PUDIMOS PARAR', null: 2 },
      // Los dos últimos los entrega el final en cuanto llegas a la meta (js/systems/finale.js)
      { id: 's8', when: 'g100000', delay: 1, text: 'NO SE PUEDE CERRAR. PERO SE PUEDE SOLTAR' },
      { id: 's9', when: 'g100000', delay: 1, text: 'EL ES TU', null: 3 },
    ],

    // "Erratas" del periódico (la primera sale en el tutorial)
    news: [
      { id: 'tuto', text: 'NO LE CREAS', art: 'cartel' },
      { id: 'n2', text: 'EL MERCADO SE ALIMENTA DE NOSOTROS', art: 'dibujo' },
      { id: 'n3', text: 'NADIE GANA. ALGUIEN PAGA', art: 'cartel' },
      { id: 'n4', text: 'LA ULTIMA SIEMPRE MIENTE', art: 'grietas' },
      { id: 'n5', text: 'TODOS PAGAMOS', art: 'ciudad' },
    ],

    // Textos escondidos en la habitación y el escritorio
    hidden: {
      papelera: 'NO LO TIRES. LEE',
      notas: 'NO DUERMAS',
      gato: 'MIAU',
      cuervo: 'CRA',
      poster: 'EL DINERO NO DUERME. TU SI',
      dibujo: 'EL SEÑOR DE LA CAPA',
      calavera: 'PAGAS',
      avatar: 'PASA',
    },

    // El encapuchado sabe de este idioma (escena al descubrir la primera letra)
    hoodFirst: ['Veo que has encontrado garabatos.', 'Hay quien escribe en las paredes cuando ya no le queda nada que perder.', 'No les hagas caso. Y tú... no digas nada.'],
    // Al tenerlas todas
    hoodAll: ['Así que ya sabes leer.', 'Saber leer no te salva. Solo te deja ver quién paga.'],
  };
})(window.SN);
