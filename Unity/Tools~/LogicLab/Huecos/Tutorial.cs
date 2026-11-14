// Hueco de Tutorial para compilar el banco sin los módulos que se están portando (lab.sh con HUECOS=1).
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Tutorial : ITutorialFlags
    {
        public bool active { get; set; }
        public bool replaying { get; set; }
    }
}
