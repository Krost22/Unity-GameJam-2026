// Parte 2 de Finale (js/systems/finale.js): la X de FUTURO.EXE, la terminal, el epílogo B (la pala y Hacienda), el
// embargo, el FIN y los créditos, el cierre de la partida y los oyentes de los turnos.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using System.Linq;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public sealed partial class Finale
    {
        // La X de FUTURO.EXE (no la había tenido nunca): clic para cerrarla
        public Promise waitX()
        {
            return new Promise((resolve) =>
            {
                var x = Dom.byId("btn-x");
                x.classList.remove("hidden");
                x.classList.add("call");
                SN.Audio.sfx("notify");
                Action<DomEvent> done = null;
                Action<DomEvent> onKey = null;
                done = (e) =>
                {
                    if (e != null) e.stopPropagation();
                    x.removeEventListener("click", done);
                    Dom.document.removeEventListener("keydown", onKey); // DUDA: en la web se quita con capture = true
                    x.classList.add("hidden");
                    x.classList.remove("call");
                    SN.Audio.sfx("click");
                    resolve();
                };
                onKey = (e) => { if (e.code == "Enter" || e.code == "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } };
                x.addEventListener("click", done);
                Dom.document.addEventListener("keydown", onKey); // DUDA: capture = true omitido (el DOM no lo tiene)
            });
        }

        // ---------- La terminal ----------
        public void termLine(string t, string k = null)
        {
            if (!term.truthy) return;
            term["lines"].arr.push(V.Obj("t", t, "k", k == null ? V.undefined : (V)k));
            SN.Desktop.renderTerm();
        }

        // Espera a que el jugador "escriba" el comando (cualquier tecla pone unas letras) y lo ejecuta
        public Promise typeCmd(string cmd)
        {
            return new Promise((resolve) =>
            {
                term["typing"] = V.Obj("text", cmd, "shown", 0, "resolve", (JsFn)((a) => { resolve(); return V.undefined; }));
                SN.Desktop.renderTerm();
            });
        }

        public bool termKey(DomEvent e)
        {
            V T = term;
            V ty = T.truthy ? T["typing"] : V.@null;
            if (!ty.truthy) return false;
            e.preventDefault();
            int len = ty["text"].str.Length;
            if (ty["shown"].num >= len)
            {
                if (e.code == "Enter" || e.code == "Space") runCmd();
                return true;
            }
            if (e.repeat && JsMath.rnd() > 0.35) return true;
            ty["shown"] = JsMath.min(len, ty["shown"].num + 1 + Math.Floor(JsMath.rnd() * 3));
            SN.Hands.tapKey(e.code);
            SN.Desktop.renderTerm();
            // Escrito entero: se ejecuta solo enseguida
            if (ty["shown"].num >= len)
                SN.after(0.45, () => { if (term.truthy && term["typing"] == ty) runCmd(); });
            return true;
        }

        public void runCmd()
        {
            V T = term;
            V ty = T.truthy ? T["typing"] : V.@null;
            if (!ty.truthy) return;
            T["typing"] = V.@null;
            T["lines"].arr.push(V.Obj("t", T["prompt"].str + ty["text"].str, "k", "cmd"));
            SN.Audio.sfx("select");
            SN.Desktop.renderTerm();
            ty["resolve"].call();
        }

        // ---------- Epílogo B: la pala... y Hacienda ----------
        public async Promise epilogueB()
        {
            V L = F()["letter"];
            V run = SN.State.run;
            // La carta del servicio de compensación, en la pantalla, y la pala
            SN.Desktop.closeWin("chat");
            SN.Audio.sfx("notify");
            string body = "";
            foreach (V l in L["body"]) body += "<p>" + esc(l) + "</p>";
            await panel("<div class=\"lt-head\">" + esc(L["head"]) + "</div>" + body
                + "\n        <div class=\"lt-gift\"><i data-ico=\"pala\"></i><b>" + esc(L["gift"]) + "</b></div><p class=\"lt-foot\">«" + esc(L["foot"]) + "»</p>",
                "fin-letter", "layer-top", "Seguir");
            await raid();
            // El protagonista llora en la habitación vacía
            SN.Cine.setShot(V.Obj("type", "face", "expr", "cry", "night", true, "opts", V.Obj("tears", true)));
            SN.Game.camTo(Cam(320, 180, 1), 0.01);
            await SN.wait(4.2);
            SN.Cine.setShot(V.@null);
            // A la mañana siguiente, el periódico
            SN.Desk.phaseOverride = "morning";
            SN.Desk.dirty();
            SN.Music.force("bravo");
            SN.Audio.sfx("whoosh");
            V N = F()["paper"];
            string lines = "";
            foreach (V l in N["lines"]) lines += "<p class=\"t\">" + esc(l) + "</p>";
            string html = "<div class=\"np-mast\">" + esc(N["mast"]) + "</div><div class=\"np-sub\"><span>Día " + (run["day"] + 1).str
                + "</span><span>Edición de la ciudad</span><span>$1</span></div>\n        <div class=\"np-front\"><div class=\"np-ph\"></div><div class=\"np-fcol\"><span class=\"np-tag neg\">"
                + esc(N["kicker"]) + "</span><div class=\"h\">" + esc(N["title"]) + "</div>\n        " + lines
                + "<p class=\"cap\">" + esc(N["caption"]) + "</p></div></div>";
            await panel(html, "fin-paper", "stage-top", "Seguir", (el) =>
            {
                // DUDA: NewsArt.node devuelve un Canvas (en la web, un nodo del DOM): se mete en un <canvas> del DOM
                var art = Dom.el("canvas");
                art.setCanvas(SN.NewsArt.node("bravoDetenido", "neg", 0, V.@null, V.Obj("color", true)));
                el.querySelector(".np-ph").appendChild(art);
            });
            SN.Music.force(null);
            await catSting();
            await powerOff();
            await theEnd("B");
        }

        // El embargo: el agente de la Policía Fiscal entra en la habitación por el lado de la ventana (de cuerpo entero,
        // por detrás de la mesa y del monitor: lo dibuja js/render/officer.js), lee la lista, rodea el monitor para
        // repartir y luego recorre el cuarto metiendo en su caja, uno a uno, todo lo que tienes. Al final empuja el PC
        // hasta la puerta... y te deja la pala.
        public async Promise raid()
        {
            V Pz = F()["police"];
            V run = SN.State.run;
            Officer O = SN.Officer;
            Desk Dk = SN.Desk;
            async Promise cop(string text, double auto = 0)
            {
                O.talk = true;
                try { await say(Pz["name"].str, text, auto); }
                finally { O.talk = false; }
            }
            // Llaman a la puerta
            Dk.palaHere = true;
            Dk.dirty();
            for (int i = 0; i < 3; i++) { SN.Audio.sfx("knock"); SN.FX.shake(2, 0.15); await SN.wait(0.32); }
            await say(Pz["name"].str, Pz["knock"].str, 2);
            // No espera a que abras: entra (y al gato no le hace ninguna gracia)
            SN.Audio.sfx("thud");
            SN.FX.shake(3, 0.3);
            SN.Hero.catDo("arch", 2.4, "hiss");
            O.occlude(new[] { "cascos", "trofeo", "pleyzeta" }); // lo que está en la mesa por delante de él, cuando pase por la derecha
            await O.enter(25);
            await SN.wait(0.3);
            // La lista: lo que el jugador tiene de verdad (la consola primero)
            var ids = new List<string> { "pleyzeta" };
            foreach (V k in SN.Data["keyItems"]) ids.Add(k["id"].str);
            foreach (V s in SN.Data["shop"]) ids.Add(s["id"].str);
            V luck = SN.Data["luck"];
            if (luck.truthy && luck["golden"].truthy)
                foreach (V g in luck["golden"]) ids.Add(g["id"].str);
            ids = ids.FindAll((id) => id == "pleyzeta" || run["owned"][id].truthy);
            var names = new List<string>();
            foreach (var id in ids)
            {
                V g = Pz["goods"][id];
                if (g.truthy) names.Add(g.str);
            }
            string list = names.Count == 0 ? "undefined"
                : names.Count > 1 ? string.Join(", ", names.GetRange(0, names.Count - 1)) + " y " + names[names.Count - 1]
                : names[0];
            O.prop = "list";
            await cop(Replace1(Pz["read"].str, "{list}", list));
            string last = ids[ids.Count - 1];
            V objection = Pz["objection"][last];
            if (objection.truthy)
            {
                await say(Pz["me"].str, objection.str, 1.8);
                await cop(Pz["taken"].str, 1.8);
            }
            await say(Pz["me"].str, Pz["defense"][0].str, 2.2);
            await cop(Pz["defense"][1].str, 2.2);
            O.prop = null;
            // Los golpes, fuera de plano: rodea el monitor hacia ti (se pierde detrás de la pantalla) y la cámara se va
            // a la ventana
            await O.walkTo(96, 110);
            SN.Game.camTo(Cam(96, 112, 2.4), 0.6);
            await SN.wait(0.7);
            Dk.handsOff = true; // te aparta de la mesa: ya no vuelves a tocar el teclado
            (double x, double y)[] hits = { (30, 60), (92, 92), (40, 130), (110, 52), (70, 150) };
            for (int i = 0; i < 5; i++)
            {
                int hn = Pz["hits"]["length"].i;
                comic(Pz["hits"][i % hn].str, hits[i].x, hits[i].y);
                SN.Audio.sfx("punch");
                SN.FX.shake(4, 0.25);
                if (i == 1) say(Pz["me"].str, Pz["cries"][0].str, 1.6);
                if (i == 3) say(Pz["me"].str, Pz["cries"][1].str, 1.6);
                await SN.wait(0.55);
            }
            var dust = Dom.el("div", "fin-dust");
            Dom.byId("stage-top").appendChild(dust);
            SN.after(3.5, () => dust.remove());
            await SN.wait(1.6);
            SN.Game.camTo(Cam(320, 180, 1), 1);
            await SN.wait(0.8);
            // El embargo: el camión espera en la calle y el agente vuelve a salir de detrás del monitor, ya con la caja.
            // Recorre la habitación de la ventana a la consola, cada vez con más prisa: lo de los lados lo coge a la
            // vista; lo de la mesa, pasando por detrás de la pantalla (su mano asoma por debajo)
            Dk.windowEvent("camion");
            Dk.stripped = new HashSet<string>();
            O.box = true;
            await O.walkTo(30);
            int At(string id)
            {
                int idx = Array.IndexOf(RAID_ORDER, id);
                return idx < 0 ? RAID_ORDER.Length : idx;
            }
            var order = ids.OrderBy(At).ToList(); // (orden estable, como el sort de JS)
            for (int i = 0; i < order.Count; i++) await O.take(order[i], JsMath.max(0.55, 1 - i * 0.04));
            await SN.wait(0.4);
            await O.leave(110);
            // El PC, lo último: cruza hasta el otro lado del monitor y lo empuja hacia la puerta
            await say(Pz["me"].str, Pz["pc"][0].str, 2);
            await O.enter(292, 130);
            O.dir = -1;
            await cop(Pz["pc"][1].str, 1.8);
            await O.takePC();
            SN.Audio.sfx("thud");
            SN.FX.shake(3, 0.3);
            await SN.wait(0.8);
            // Lo único que no se embarga: vuelve a entrar en la habitación vacía, coge la pala de su rincón, te la
            // enseña... y te la deja en el escritorio
            await O.enter(250, 120);
            await O.takePala();
            await O.walkTo(Dk.PALA_DESK.x + 12, 90);
            await cop(Pz["shovel"].str, 2.6);
            await O.givePala();
            await SN.wait(0.4);
            await O.leave(120);
            // Te quedas a solas con ella: la cámara se acerca despacio a la pala, en la mesa vacía
            SN.Game.camTo(Cam(320, 250, 1.5), 1.6);
            await SN.wait(2.4);
        }

        // ---------- FIN y créditos ----------
        public async Promise theEnd(string which)
        {
            V C = F()["credits"];
            string extra = which == "B"
                ? "<p class=\"cr-final\">" + esc(C["b"]) + "</p><p class=\"cr-pala\"><i data-ico=\"pala\"></i>" + esc(C["pala"]) + "</p>"
                : "<p class=\"cr-final\">" + esc(C["a"]) + "</p>";
            SN.Music.force(which == "B" ? "final" : "menu2");
            string lines = "";
            foreach (V l in C["lines"]) lines += "<p>" + esc(l) + "</p>";
            await panel("<div class=\"cr-fin\">" + esc(F()["end"]) + "</div><div class=\"cr-title\">" + esc(C["title"]) + "</div>" + lines + extra,
                "fin-credits", "stage-top", C["back"].str);
            finish(which);
        }

        // La partida se cierra: perfil (finales vistos y la pala) y vuelta al menú
        public void finish(string which)
        {
            V prof = SN.State.profile;
            prof["endings"] = JsObject.Assign(prof["endings"], V.Obj(which, true));
            if (which == "B") prof["pala"] = true;
            SN.Save.saveProfile();
            if (SN.State.run.truthy) SN.State.run["over"] = true;
            SN.Save.clearRun();
            reset();
            SN.Game.showMenu();
        }

        // Todo como estaba (al salir al menú o empezar otra partida)
        public void reset()
        {
            busy = false;
            term = V.@null;
            termLock = false;
            you = V.@null;
            SN.Music.force(null);
            SN.Music.pulse(null);
            SN.Cine.setShot(V.@null);
            SN.UI.allow = V.@null;
            SN.UI.busy = false;
            Dom.byId("app").classList.remove("finale", "absorb");
            Dom.byId("finale").classList.add("hidden");
            Dom.byId("finale").classList.remove("falling");
            Dom.byId("finale-trade").classList.add("hidden");
            Dom.byId("btn-x").classList.add("hidden");
            Dom.byId("desk").classList.remove("gray");
            Dom.byId("monitor").classList.remove("hidden");
            Dom.byId("screen").classList.remove("off", "glitch");
            Dom.byId("stage-top").innerHTML = "";
            var fade = Dom.byId("fade");
            fade.style.transition = "opacity .6s";
            fade.style.opacity = "0";
            SN.Desk.crawl = 0;
            SN.Desk.stripped = null;
            SN.Desk.noPC = false;
            SN.Desk.palaHere = false;
            SN.Desk.palaPos = V.@null;
            SN.Desk.handsOff = false;
            SN.Officer.reset();
            SN.Desk.phaseOverride = null;
            SN.Desk.dirty();
            SN.Desktop.noApp = false;
            SN.Desktop.reset();
            SN.Hero.cat.hoodT = 0;
        }

        // ---------- Turnos durante la elección ----------
        // (en la web se registran al cargar el archivo: aquí los registra init(), tras cada carga de la lógica)
        public void init()
        {
            SN.Events.on("turn:settled", (v) =>
            {
                V f = RunFin();
                if (f.truthy && f["phase"] == "choice") f["insist"] = (f["insist"] | 0) + 1;
            });
            SN.Events.on("turn:ready", (v) =>
            {
                V f = RunFin();
                if (!f.truthy || !(f["phase"] == "choice") || busy) return;
                // A la tercera, la entidad elige por ti
                if (f["insist"].num >= F()["pact"]["turns"].num) { choose("A"); return; }
                if (f["insist"].num > 0) offerPact();
            });
        }
    }
}
