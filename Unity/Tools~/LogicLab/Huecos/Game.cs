// Hueco de Game para compilar el banco sin los módulos que se están portando (lab.sh con HUECOS=1).
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Game
    {
        public string state = "BOOT";
        public double pulse;
        public void slowTo(double to, double dur) { }
        public void focusOn(double k, double dur) { }
    }
}
