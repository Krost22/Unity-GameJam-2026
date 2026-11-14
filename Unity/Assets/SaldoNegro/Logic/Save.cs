// Port de js/systems/save.js. SaveManager: guarda la partida y el perfil en localStorage (SN.localStorage: en
// WebGL, el localStorage del navegador con las mismas claves que la web; en el resto, un archivo). Nunca rompe
// el juego si el almacenamiento falla: simplemente no guarda.
using System;

namespace SaldoNegro.Logic
{
    public sealed class Save
    {
        static State S { get { return SN.State; } }
        public const string KEY_RUN = "saldonegro.run.v1";
        public const string KEY_PROFILE = "saldonegro.profile.v1";

        static V read(string key)
        {
            try { string raw = SN.localStorage.getItem(key); return !string.IsNullOrEmpty(raw) ? Json.parse(raw) : V.@null; } catch (Exception) { return V.@null; }
        }
        static bool write(string key, V value)
        {
            try { SN.localStorage.setItem(key, Json.stringify(value)); return true; } catch (Exception) { return false; }
        }

        public void saveRun()
        {
            if (!S.run || S.run["over"] || (SN.Tutorial != null && SN.Tutorial.replaying)) return;
            // Mientras dura un final no se guarda: si se recarga, se vuelve a la elección
            if (S.run["finale"] && S.run["finale"]["lock"]) { saveProfile(); return; }
            S.sync();
            write(KEY_RUN, S.run);
            saveProfile();
        }
        public V loadRun()
        {
            V run = read(KEY_RUN);
            return run && run["v"] == 4 && !run["over"] ? run : V.@null; // las partidas de la 1.5 o antes no se cargan
        }
        public bool hasRun() { return !!loadRun(); }
        public void clearRun() { try { SN.localStorage.removeItem(KEY_RUN); } catch (Exception) { /* sin almacenamiento */ } }

        public void saveProfile() { write(KEY_PROFILE, S.profile); }
        public void loadProfile()
        {
            V p = read(KEY_PROFILE);
            if (p)
            {
                S.profile.obj.assign(p);
                S.profile["settings"] = JsObject.Assign(V.Obj("music", true, "sfx", true), p["settings"] || new JsObject());
            }
        }
    }
}
