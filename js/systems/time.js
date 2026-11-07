// TimeManager: el juego avanza por turnos (mañana, tarde, noche), nunca con el reloj real.
// Cada operación (o esperar) consume un turno; al terminar la noche empieza un día nuevo.
(function (SN) {
  'use strict';
  const S = SN.State, D = SN.Data;

  SN.Time = {
    turnName() { return D.sim.turnNames[S.run.turn]; },
    phase() { return ['morning', 'evening', 'night'][S.run.turn]; },

    // Cierra el turno actual: los mercados que no operaste se mueven solos, cambia la hora
    // y aparecen eventos nuevos para el turno siguiente.
    advance(tradedMarketId) {
      const run = S.run;
      SN.Market.advanceIdle(tradedMarketId);
      run.totalTurns++;
      run.turn++;
      let newDay = false;
      if (run.turn >= D.sim.turnNames.length) {
        run.turn = 0;
        run.day++;
        newDay = true;
      }
      SN.Market.spawnEvents();
      SN.Market.rollHints();
      SN.Events.emit('turn:advanced', { day: run.day, turn: run.turn, newDay });
      if (newDay) SN.Events.emit('day:changed', { day: run.day });
    },
  };
})(window.SN);
