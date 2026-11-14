// Port de js/systems/time.js. TimeManager: el juego avanza por turnos (mañana, tarde, noche), nunca con el
// reloj real. Cada operación (o esperar) consume un turno; al terminar la noche empieza un día nuevo.
namespace SaldoNegro.Logic
{
    public sealed class Time
    {
        static State S { get { return SN.State; } }
        static Data D { get { return SN.Data; } }

        public V turnName() { return D["sim"]["turnNames"][S.run["turn"]]; }
        public V phase() { return V.Arr("morning", "evening", "night")[S.run["turn"]]; }

        // Cierra el turno actual: los mercados que no operaste se mueven solos, cambia la hora
        // y aparecen eventos nuevos para el turno siguiente.
        public void advance(V tradedMarketId)
        {
            V run = S.run;
            SN.Market.advanceIdle(tradedMarketId);
            run["totalTurns"] = run["totalTurns"] + 1;
            run["turn"] = run["turn"] + 1;
            bool newDay = false;
            if (run["turn"] >= D["sim"]["turnNames"].length)
            {
                run["turn"] = 0;
                run["day"] = run["day"] + 1;
                newDay = true;
            }
            SN.Market.spawnEvents();
            SN.Market.rollHints();
            SN.Events.emit("turn:advanced", V.Obj("day", run["day"], "turn", run["turn"], "newDay", newDay));
            if (newDay) SN.Events.emit("day:changed", V.Obj("day", run["day"]));
        }
    }
}
