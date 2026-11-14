// SN.Audio (js/systems/audio.js): la cara que ve el resto del juego. Los efectos se sintetizan y la música la lleva
// el director (fase 8): aquí, de momento, solo se reenvía cada llamada a quien suene de verdad (backend). En las
// pruebas no hay backend y no suena nada, como en la web sin AudioContext.
using System;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed class Audio
    {
        public bool sfxOn = true;
        public bool musicOn = true;
        // Quien suena (la capa de Unity): (nombre, opciones). null = en silencio.
        public Action<string, V> backend;
        public Action<string, V> musicBackend; // startMusic, stopMusic, mood, duck, darkness, layerLevel

        public void unlock() { musicBackend?.Invoke("unlock", V.undefined); }
        public void sfx(string name, V opts = null)
        {
            if (!sfxOn) return;
            try { backend?.Invoke(name, opts ?? new JsObject()); } catch (Exception e) { SN.logError("[sonido " + name + "] " + e.Message); }
        }
        // Capas de la música hechas con síntesis (el pulso a tempo): van con la música, no con los efectos
        public void layer(string name, V opts = null) { if (musicOn) musicBackend?.Invoke("layer:" + name, opts ?? new JsObject()); }
        public void layerLevel(double v) { musicBackend?.Invoke("layerLevel", v); }
        public void startMusic() { if (musicOn) musicBackend?.Invoke("start", V.undefined); }
        public void stopMusic() { musicBackend?.Invoke("stop", V.undefined); }
        public void setMood(V mood) { musicBackend?.Invoke("mood", mood); }
        public void duck(bool on) { musicBackend?.Invoke("duck", on); }
        public void setDarkness(double d) { musicBackend?.Invoke("darkness", d); }
        public void setSfx(bool on) { sfxOn = on; }
        public void setMusic(bool on) { musicOn = on; if (on) startMusic(); else stopMusic(); }
    }
}
