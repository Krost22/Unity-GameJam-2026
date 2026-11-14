// Port de js/render/hands.js (SN.Hands): conecta el ratón y el teclado con la escena. El cursor sobre el monitor mueve
// el ratón de la mesa, cada tecla hunde su tecla y levanta un dedo del protagonista.
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Hands
    {
        public bool drumming; // compatibilidad: el protagonista ya sabe por el juego cuándo hay una operación abierta

        public void pointAt(double sx, double sy) { SN.Hero.pointAt(sx, sy); }
        public void press() { SN.Hero.press(); }

        // La tecla se hunde en el teclado de la mesa y el dedo que le toca se mueve (por columnas: de la
        // izquierda a la derecha del teclado, del meñique al índice; el espacio, cualquiera)
        public void tapKey(string code)
        {
            var k = SN.Desk.keyFor(code);
            if (k != null) k.press = 0.14;
            int? finger = k != null && code != "Space" ? (int?)Math.Min(3, k.c / 4) : null;
            SN.Hero.tapFinger(finger);
        }

        public void celebrate(bool big) { SN.Hero.celebrate(big); }
        public void flinch(bool big) { SN.Hero.flinch(big); }

        // Cursor pixel art dentro del monitor (se reescala con el escenario)
        public void applyCursor(double scale)
        {
            double s = JsMath.max(1, JsMath.min(4, JsMath.round(scale)));
            var mon = Dom.byId("monitor");
            string arrow = "url(" + SN.Sprites.url("cursor", s) + ") 0 0, default";
            string hand = "url(" + SN.Sprites.url("pointer", s) + ") " + Js.String(3 * s) + " 0, pointer";
            mon.style["cursor"] = arrow;
            var st = Dom.byId("cursor-style");
            if (st == null)
            {
                st = Dom.createElement("style");
                st.id = "cursor-style";
                // TODO(infra): la web lo pone en document.head; Dom no tiene head, así que va al final de la raíz
                Dom.document.appendChild(st);
            }
            st.textContent = "#monitor button:not(:disabled), #monitor .mcard:not(.locked), #monitor #slider, #monitor .dlg-catch, #monitor #events:not(.empty), #monitor #chart-wrap, #monitor canvas.clickable { cursor: " + hand + "; }";
        }
    }
}
