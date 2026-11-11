// Música: los archivos de Musics/ y en qué momento suena cada uno (el director está en js/systems/music.js).
// Todas las pistas van a 90 BPM y duran compases enteros (32, 16 u 8 compases): el director cambia de pista en
// el siguiente compás y la nueva entra por el mismo compás en el que iba la anterior.
//   file  -> archivo dentro de Musics/
//   gain  -> volumen relativo (igualadas: las que vienen más fuertes, más bajas)
//   key   -> tónica (nota MIDI) y escala de la pista. Los efectos de sonido se afinan con la pista que suena
//            (medido con un análisis de las pistas: todas en La 440)
//   sync  -> de la familia de la partida: al cambiar entre ellas se conserva el compás
//   next  -> al acabar pasa a esa pista (el menú alterna sus dos partes); si no hay next, se repite
//   once  -> suena una sola vez, por encima de la música (la aparición del encapuchado)
//   rate  -> velocidad de la cinta (menos de 1: más lenta y más grave)
(function (SN) {
  'use strict';
  const MIN = [0, 3, 5, 7, 10]; // pentatónica menor
  const MAJ = [0, 2, 4, 7, 9];  // pentatónica mayor
  SN.Data.music = {
    dir: 'Musics/',
    bpm: 90,
    beatsPerBar: 4,
    volume: 0.5,        // música respecto a los efectos de sonido
    fadeIn: 0.6,        // segundos de entrada de una pista
    fadeOut: 1.0,       // segundos de salida
    loopFade: 0.12,     // solape al cerrar el bucle (tapa el hueco que deja el MP3)
    tracks: {
      menu1: { file: 'cancionIntroParte1.mp3', gain: 0.95, key: { root: 64, scale: MAJ }, next: 'menu2' },     // Mi mayor
      menu2: { file: 'CancionIntroParte2.mp3', gain: 0.87, key: { root: 69, scale: MIN }, next: 'menu1' },     // La menor
      base: { file: 'Background.mp3', gain: 0.93, key: { root: 62, scale: MIN }, sync: true },                // Re menor
      win: { file: 'Ganancia (2).mp3', gain: 0.72, key: { root: 60, scale: MIN }, sync: true },               // Do menor
      black: { file: 'MercadoNegro.mp3', gain: 0.72, key: { root: 65, scale: [0, 5, 7, 10] }, sync: true },   // Fa (sin tercera: suena con Fa, La bemol y Si bemol)
      lucky: { file: 'LuckyDay.mp3', gain: 0.75, key: { root: 62, scale: MIN }, sync: true },                 // Re menor
      bravo: { file: 'BravosFines.mp3', gain: 0.9, key: { root: 69, scale: MIN }, sync: true },               // La menor
      hood: { file: 'AparicionEncapuchado.mp3', gain: 1, key: { root: 66, scale: [0, 3, 8] }, once: true },   // Fa# menor (Fa#, La, Re)
      // El final: la segunda parte del tema principal, más lenta y dos semitonos más grave (victoria vacía)
      final: { file: 'CancionIntroParte2.mp3', gain: 0.8, key: { root: 69, scale: MIN }, rate: Math.pow(2, -2 / 12) },
    },
    // Cuánto pesa cada situación en el volumen de la música (se multiplican)
    mix: { tense: 0.45, duck: 0.12, desktop: 0.6, danger: 0.85, sting: 0.3, losing: 0.8 },
    // PERDIENDO (no tiene pista): la cinta se frena hasta un 6% (un semitono) y se bambolea
    losing: { from: 0.08, full: 0.6, slow: 0.06, wobble: 0.006, wobbleHz: 0.55 },
    // GANANDO: entra a partir de un +8% de lo apostado y se queda 6 s tras una operación ganada
    winning: { enter: 0.08, stay: 0.02, hold: 6 },
    tenseRate: 0.94,   // ambiente tenso: cinta algo más lenta
    darkRate: 0.03,    // la historia oscura frena la cinta hasta un 3%
  };
})(window.SN);
