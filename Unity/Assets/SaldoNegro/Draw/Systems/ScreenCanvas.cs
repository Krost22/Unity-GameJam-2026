// Port de js/systems/narrative.js (SN.ScreenCanvas): dueño de la capa #screen-canvas (cinemáticas y el encapuchado).
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class ScreenCanvas
    {
        public string owner;
        public DomElement canvas;
        public Ctx2D g;

        public void init()
        {
            canvas = Dom.byId("screen-canvas");
            // Px.ctx(canvas): el contexto 2D con el suavizado apagado
            g = canvas.getContext();
            g.imageSmoothingEnabled = false;
        }

        public void take(string owner)
        {
            this.owner = owner;
            canvas.classList.remove("hidden");
        }

        public void release(string owner)
        {
            if (this.owner != owner) return;
            this.owner = null;
            g.clearRect(0, 0, 420, 236);
            canvas.classList.add("hidden");
            canvas.classList.remove("clickable");
        }

        public void render(double dt)
        {
            if (string.IsNullOrEmpty(owner)) return;
            if (owner == "hood") SN.Narrative.renderHood(g, dt);
            else if (owner == "cine") SN.Cine.renderScreen(g, dt);
        }
    }
}
