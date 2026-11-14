// Lo que necesita el reflejo del DOM en Unity (Game/UI/DomView.cs) y vive en otro ensamblado: la marca de
// "cambiado desde la última vez que se pintó".
namespace SaldoNegro
{
    public sealed partial class DomElement
    {
        public bool needsSync { get { return dirty; } set { dirty = value; } }
    }
}
