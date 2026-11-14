// Port de js/core/state.js. Estado del juego: la partida en curso (run) y el perfil persistente (intro vista,
// tutorial, ajustes). Los sistemas leen y escriben aquí; el SaveManager lo serializa tal cual.
using System;

namespace SaldoNegro.Logic
{
    public sealed class State
    {
        static Data D { get { return SN.Data; } }

        public V run = V.@null;
        public RNG rng;
        public V profile = V.Obj(
            "introSeen", false,
            "tutorialDone", false,
            "runs", 0,
            "bestCapital", 0,
            "settings", V.Obj("music", true, "sfx", true),
            "endings", new JsObject(),   // finales vistos (A: el avatar perfecto, B: NULL.EXE)
            "pala", false                // LA PALA: se gana con el final B y se queda en el cuarto para siempre
        );

        // Para las pruebas (logic.test.js cambia newRun para empezar con el MULTIPLICADOR al máximo)
        public Action<V> afterNewRun;

        public V newRun()
        {
            double seed = JsMath.toUint32(JsMath.rnd() * 2147483648.0);
            return newRun(seed);
        }
        // Con una semilla dada (la web la saca de Math.random; esto sirve para comprobar que todo sale igual)
        public V newRun(double seed)
        {
            rng = new RNG(seed);
            V run = V.Obj(
                "v", 4,
                "seed", seed,
                "rngState", 0,
                "capital", D["sim"]["startCapital"],
                "committed", 0,
                // Deuda activa (solo hay una a la vez). Las pagadas pasan a `debts`.
                "debt", V.Obj("id", "pleyzeta", "kind", "debt", "label", "la Pleyzeta", "amount", D["sim"]["startDebt"], "start", 1, "deadlineDay", D["sim"]["deadlineDays"], "paid", false, "defaulted", false),
                "debts", new JsArray(),
                "day", 1,
                "turn", 0,
                "totalTurns", 0,
                "stats", V.Obj("trades", 0, "wins", 0, "losses", 0, "best", 0, "worst", 0, "earned", 0),
                "markets", new JsObject(),
                "upgrades", V.Obj("multiplicador", 0, "suerte", 0, "limite", 0, "analisis", 0, "resistencia", 0),
                "gifts", new JsObject(),       // mejoras que ya llegaron como "regalo" (se pueden comprar)
                "step", 0,                     // paso actual de la escalera de progresión (js/data/progression.js)
                "stepOpen", true,              // el paso actual ya abrió su deuda (la Pleyzeta, desde el principio)
                "flags", V.Obj("debtPaid", false, "payHintShown", false, "endDemo", false),
                "news", new JsArray(),
                "darkness", 0,
                "darkUsed", new JsObject(),
                "owned", new JsObject(),
                "academy", new JsObject(),     // nodos comprados en la Academia de Bravo Fines
                "seen", new JsObject(),        // lo que ya se vio en Mejoras y Tienda (para los números rojos)
                "offer", V.@null,              // cuándo se enseñó la oferta pendiente de FUTURO.exe ({ step, shown, aff, day })
                "storySeen", new JsObject(),
                "cipher", V.Obj("known", new JsObject(), "found", new JsObject()), // letras del idioma secreto encontradas en esta partida
                "selected", "salud",
                "form", V.Obj("amount", 50, "frac", 0.5, "leverage", 1),
                "position", V.@null,
                "uid", 1
            );
            this.run = run;
            profile.delete("cipher"); // (antes las letras iban en el perfil y pasaban de una partida a otra)
            foreach (var def in D["markets"]) run["markets"][def["id"].str] = SN.Market.create(def, rng);
            run["rngState"] = rng.s;
            afterNewRun?.Invoke(run);
            return run;
        }

        // Restaura una partida guardada
        public void adopt(V run)
        {
            this.run = run;
            rng = new RNG(run["seed"]);
            rng.s = run["rngState"];
        }

        // Antes de guardar: copia el estado del generador aleatorio dentro de la partida
        public void sync()
        {
            if (run.truthy && rng != null) run["rngState"] = rng.s;
        }

        public V nextUid() { V u = run["uid"]; run["uid"] = u + 1; return u; }

        // Punto de control: al empezar cada paso de la escalera (la deuda, cada regalo, cada compra, cada meta)
        // se guarda la partida tal cual. Si pierdes del todo, vuelves aquí con los fondos que tenías entonces.
        // El rescate vuelve a estar disponible. Los chats y las letras del idioma secreto no se rebobinan.
        public V checkpoint(V label)
        {
            V run = this.run;
            // Nunca se guarda un punto de control sin dinero para apostar (volver ahí sería perder otra vez):
            // si acabas de pagar y te has quedado sin nada, sigue valiendo el anterior.
            if (run["checkpoint"] && run["capital"] + run["committed"] < D["sim"]["bankruptcyThreshold"]) return false;
            sync();
            var copy = JsObject.Assign(run, V.Obj("checkpoint", V.@null, "chat", V.@null, "chatSer", V.@null, "chatBravo", V.@null, "cipher", V.@null));
            run["checkpoint"] = V.Obj("label", label, "capital", run["capital"], "data", Json.stringify(copy));
            run["rescue"] = "ready";
            return V.undefined;
        }
        public bool restoreCheckpoint()
        {
            V old = this.run, cp = old["checkpoint"];
            if (!cp) return false;
            V run = Json.parse(cp["data"].str);
            run["checkpoint"] = cp;
            run["chat"] = old["chat"];
            run["chatSer"] = old["chatSer"];
            run["chatBravo"] = old["chatBravo"];
            run["cipher"] = old["cipher"];
            run["rescue"] = "ready";
            run["retries"] = (old["retries"] || 0) + 1;
            run["chatFlags"] = JsObject.Assign(new JsObject(), run["chatFlags"] || new JsObject(), old["chatFlags"] || new JsObject());
            run["over"] = false;
            adopt(run);
            return true;
        }
        // Lo que da el rescate: para la Pleyzeta, $60; después, una parte de lo que tenías al empezar el paso
        public double rescueAmount()
        {
            V cp = run["checkpoint"];
            double @base = cp.truthy ? cp["capital"].num : 100;
            return run["flags"]["debtPaid"].truthy ? Util.clamp(JsMath.round(@base * 0.2), 60, 5000) : 60;
        }
    }
}
