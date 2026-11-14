// Hueco de Chart para compilar el banco sin los módulos que se están portando (lab.sh con HUECOS=1).
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Chart
    {
        public V anim = V.@null;
        public double kick;
        public V tradeCandle(V climax) { return V.undefined; }
        public V lastCandlePos() { return V.undefined; }
    }
}
