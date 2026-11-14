// Partidas completas del juego en el banco (equivalente a tools/test/e2e*.test.js, sin Chrome): de la intro a cada
// final. Se juega con clics del ratón (Mouse) y teclas; lo que hay que esperar (cinemáticas, diálogos) se espera con
// Until, que avanza los diálogos como lo haría el jugador. Cualquier SN.logError o excepción hace fallar la prueba.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using SaldoNegro;
using SN = SaldoNegro.SN;
using V = SaldoNegro.Logic.V;
using IStorage = SaldoNegro.Logic.IStorage;
using MemoryStorage = SaldoNegro.Logic.MemoryStorage;
using static FlowCheck;

public static class GameFlowLab
{
    // Perfil de las pruebas e2e: intro vista, tutorial hecho, sin música ni sonido
    const string PROFILE_DONE = "{\"introSeen\":true,\"tutorialDone\":true,\"tutorialV\":4,\"runs\":0,\"bestCapital\":0,\"settings\":{\"music\":false,\"sfx\":false}}";

    // Almacenamiento con un perfil dado (null = jugador nuevo)
    static IStorage Profile(string json = null)
    {
        var st = new MemoryStorage();
        if (json != null) st.setItem(SaldoNegro.Logic.Save.KEY_PROFILE, json);
        return st;
    }

    // Abre la página en modo ?debug, pasa la bienvenida y llega al menú
    static void Open(IStorage st)
    {
        Dom.locationSearch = "?debug";
        GameLab.open(st);
        GameLab.run(3);
        GameLab.click("#boot button");
        GameLab.until(() => SN.Game.state == "MENU", 6, "el menú");
    }

    // Pulsa "avanzar" si hay un diálogo o subtítulo abierto (como un clic en el escenario)
    static void Adv()
    {
        if (SN.Dialog.active) Dom.document.dispatchUser(new DomEvent("click"));
        else if ((SN.Cine.running && SN.Cine.say_.truthy) || SN.Cine.beatResolve != null) Dom.document.dispatchUser(new DomEvent("pointerdown"));
    }

    // Espera (hasta max s) avanzando los diálogos que aparezcan
    static void Until(Func<bool> test, double max, string what)
    {
        int n = 0;
        for (double t = 0; t < max; t += 0.25)
        {
            if (test()) return;
            if (++n % 2 == 0) Adv();
            GameLab.run(0.25);
        }
        Check(test(), "no llegó: " + what + " en " + max + " s (" + string.Join(" > ", GameLab.trace) + "); bloqueado: " + Bloqueo());
    }

    // Avanza diálogos mientras `busy` (sin exigir que termine)
    static void Drain(Func<bool> busy, double max)
    {
        for (double t = 0; t < max && busy(); t += 0.25) { Adv(); GameLab.run(0.25); }
    }

    // Clic del ratón: un botón deshabilitado no recibe el clic (como en el navegador)
    static void Mouse(string sel)
    {
        var e = Dom.querySelector(sel);
        Check(e != null, "no existe " + sel + " (" + string.Join(" > ", GameLab.trace) + ")");
        Check(GameLab.visible(e), "no se ve " + sel + " (" + string.Join(" > ", GameLab.trace) + "); ocultos: " + Hidden(e));
        if (e.disabled) return;
        e.dispatchUser(new DomEvent("pointerdown"));
        e.dispatchUser(new DomEvent("click"));
        if (GameLab.errors.Count > 0) throw new Exception("error al pulsar " + sel + ": " + GameLab.errors[0]);
    }

    static void Tecla(string code, string k = null) { GameLab.key(code, k ?? code); }
    static bool AllowHas(string a) { return !SN.UI.allow.isNullish && SN.UI.allow.arr.includes(a); }
    static V Run { get { return SN.State.run; } }
    static bool Vis(string sel) { var e = Dom.querySelector(sel); return e != null && GameLab.visible(e); }
    static bool Pos() { return Run["position"].truthy; }
    // Qué espera la partida (para diagnosticar los bloqueos)
    static string Bloqueo() { return "diálogo=" + SN.Dialog.active + " cine=" + SN.Cine.running + " subtítulo=" + SN.Cine.say_.truthy + " beat=" + (SN.Cine.beatResolve != null) + " ventana=" + SN.Windows.current + " ocupado=" + SN.UI.busy + " final=" + SN.Finale.active() + " pendientes=" + SN.Narrative.pending.Count + " bailout=" + SN.Bailout.active + " escritorio=" + SN.Desktop.open + " fase=" + Run["finale"]["phase"].str + " insist=" + Run["finale"]["insist"].str; }
    static string Hidden(DomElement e) { var s = ""; for (var p = e; p != null; p = p.parentElement) if (p.classList.contains("hidden")) s += p.describe() + " "; return s + (Dom.document.contains(e) ? "" : "(fuera del documento)"); }

    // Partida nueva (perfil ya visto): salta la intro y espera a la mesa
    static void NuevaPartida()
    {
        Mouse("#btn-new");
        GameLab.run(0.1);
        Check(SN.Game.state == "INTRO", "la partida nueva empieza con la intro: " + SN.Game.state);
        SN.Cine.skip();
        Until(() => SN.Game.state == "GAMEPLAY" && !SN.UI.busy, 15, "la mesa de juego");
    }

    // Recarga la página con el mismo almacenamiento y pulsa CONTINUAR
    static void Recargar(IStorage st)
    {
        Open(st);
        Mouse("#btn-continue");
        Until(() => SN.Game.state == "GAMEPLAY" || SN.Game.state == "MENU", 10, "continuar");
    }

    // Cierra la oferta de FUTURO.exe con "Ahora no"
    static void PactNo()
    {
        GameLab.run(0.45);
        Mouse(".pa-no");
        Until(() => SN.Windows.current == null, 3, "cerrar la oferta");
        GameLab.run(0.25);
    }

    // Lleva la partida a la meta final con F11 (?debug) y espera a la elección
    static void HastaLaElección()
    {
        NuevaPartida();
        Tecla("F11");
        Until(() => Run["finale"].truthy && Run["finale"]["phase"] == "choice" && SN.Windows.current == "pact" && !SN.UI.busy, 90, "la elección");
        GameLab.run(0.5);
    }

    // Pasa subtítulos, paneles y la terminal hasta los créditos (false si se acaba el tiempo)
    static bool PlayOut(double max)
    {
        for (double t = 0; t < max; t += 0.15)
        {
            if (Dom.querySelector(".fin-credits") != null) return true;
            if (SN.Finale.term.truthy && SN.Finale.term["typing"].truthy) Tecla("KeyA");
            else if (SN.Cine.say_.truthy && SN.Cine.say_["shown"].num >= SN.Cine.say_["full"].str.Length && !SN.Cine.say_["auto"].truthy) Adv();
            else if (!Dom.byId("btn-x").classList.contains("hidden")) { GameLab.run(0.3); if (Vis("#btn-x")) Mouse("#btn-x"); }
            else if (Vis(".fin-next")) { GameLab.run(0.9); if (Vis(".fin-next")) Mouse(".fin-next"); }
            GameLab.run(0.15);
        }
        return false;
    }

    // ---------- Pruebas ----------

    // Partida nueva: intro (cara feliz y encapuchado), tutorial solo con el ratón y la primera operación
    public static void Intro()
    {
        Open(Profile());
        GameLab.click("#btn-new");
        GameLab.run(2.6);
        Check(SN.Game.state == "INTRO", "empieza la intro: " + SN.Game.state);
        Until(() => SN.Cine.shot.truthy && SN.Cine.shot["type"].str == "face", 15, "la cara feliz");
        GameLab.run(0.5);
        Until(() => SN.Cine.screenMode == "hood", 25, "el encapuchado");
        GameLab.run(2);
        Until(() => SN.Game.state != "INTRO", 60, "fin de la intro");
        Check(SN.Game.state == "TUTORIAL", "tras la intro empieza el tutorial: " + SN.Game.state);

        // --- Tutorial, solo con el ratón ---
        bool sawCone = false, sawBuy = false, sawCash = false, sawDrama = false, sawErrata = false, sawShop = false, sawBadge = false;
        for (int i = 0; i < 1500 && SN.Tutorial.active; i++)
        {
            string spot = SN.UI.spotSel;
            if (spot == "#chart-wrap" && !sawCone) { sawCone = true; GameLab.run(0.7); }
            if (SN.Drama.active && !sawDrama) { sawDrama = true; GameLab.run(0.3); }
            if (!sawErrata && Vis(".np-hero.cipher") && spot == ".np-hero.cipher")
            {
                sawErrata = Regex.IsMatch(Dom.querySelector(".np-hero.cipher .h").textContent, "[ЖДФЯИЛШБЭЦГЮЩПЧ]");
                GameLab.run(0.3);
            }
            if (!sawBadge && spot == "#nav-shop") sawBadge = !Dom.byId("shop-badge").classList.contains("hidden");
            if (!sawShop && spot == ".win" && SN.Windows.current == "shop") { sawShop = true; GameLab.run(0.3); }
            if (SN.Dialog.active) { GameLab.run(0.2); Adv(); GameLab.run(0.12); continue; }
            if (AllowHas("buy")) { sawBuy = true; Mouse("#btn-buy"); GameLab.run(0.3); continue; }
            if (AllowHas("cashout")) { sawCash = true; GameLab.run(0.3); Mouse("#btn-close"); GameLab.run(0.3); continue; }
            GameLab.run(0.15);
        }
        Check(sawCone && sawBuy && sawCash, "el tutorial enseña la pista, SUBE y COBRAR");
        Check(sawDrama, "el tutorial enseña el susto de las últimas velas (cámara lenta)");
        Check(sawErrata, "el tutorial enseña las noticias con una \"errata\" en el idioma secreto");
        Check(sawShop, "el tutorial enseña la TIENDA por dentro (mejoras incluidas)");
        Check(sawBadge, "el tutorial enseña el número rojo de lo que se puede comprar");
        Check(SN.Windows.current == null, "al acabar el tutorial no queda ninguna ventana abierta");
        Check(!SN.Tutorial.active && SN.Game.state == "GAMEPLAY", "el tutorial termina: " + SN.Game.state);
        Check(Run["capital"].num > 100, "cobrar en el tutorial deja ganancias: " + Run["capital"].num);
        Check(Run["turn"].num == 1, "la operación del tutorial consume un turno: " + Run["turn"].num);
        Check(SN.State.profile["tutorialDone"].truthy && SN.State.profile["tutorialV"].num == SaldoNegro.Tutorial.VERSION, "tutorial marcado como hecho");
        Until(() => !SN.UI.busy, 8, "fin del tutorial");
    }

    // Operaciones (una entera y otra cobrada a mitad), doble clic en SUBE, cámara lenta, mejoras, periódico y pagar la deuda
    public static void PrimeraDeuda()
    {
        Open(Profile(PROFILE_DONE));
        NuevaPartida();

        for (int n = 0; n < 2; n++)
        {
            Until(() => !SN.UI.busy && !Pos(), 20, "sin operación abierta");
            SN.Data["markets"].arr[0]["twist"]["chance"] = 0;
            double before = Run["capital"].num, tr0 = Run["stats"]["trades"].num;
            Mouse(".quick button[data-frac=\"0.5\"]");
            Mouse(n == 1 ? "#btn-sell" : "#btn-buy");
            GameLab.run(0.25);
            Check(Pos() && Run["committed"].num > 0, "al operar el dinero queda comprometido");
            Check(Math.Abs(Run["committed"].num - Run["position"]["amount"].num) < 0.001, "lo comprometido es exactamente la apuesta");
            if (n == 1)
            {
                GameLab.run(1.3);
                Mouse("#btn-close");
                GameLab.run(0.25);
                Check(Run["position"]["cashed"].truthy && Run["committed"].num == 0, "COBRAR paga al instante");
            }
            else GameLab.run(1.6);
            Until(() => !Pos(), 30, "la operación se liquida");
            double after = Run["capital"].num;
            Check(Run["stats"]["trades"].num == tr0 + 1 && after == Math.Round(after), "la operación " + (n + 1) + " se liquida en dólares enteros (" + before + " -> " + after + ")");
            Drain(() => SN.UI.busy, 8);
        }

        // Regresión: un doble clic en SUBE no cobra la operación al instante
        Until(() => !SN.UI.busy && !Pos(), 20, "sin operación abierta");
        Mouse("#btn-buy");
        GameLab.run(0.08);
        if (Vis("#btn-buy")) Mouse("#btn-buy"); // el formulario se esconde al primer clic: el segundo no le llega
        GameLab.run(0.15);
        Check(Pos() && !Run["position"]["cashed"].truthy, "un doble clic en SUBE no cobra la operación al instante");
        Until(() => !Pos() && !SN.UI.busy, 30, "liquidar tras el doble clic");

        // Cámara lenta: giro forzado en las últimas velas
        Until(() => !SN.UI.busy && !Pos(), 20, "sin operación abierta");
        SN.Economy.add(60, "test");
        SN.Data["markets"].arr[0]["twist"]["chance"] = 1;
        SN.UI.renderAll();
        Mouse("#btn-buy");
        Until(() => SN.Drama.active, 20, "la cámara lenta");
        GameLab.run(0.4);
        Check(SN.Drama.stage != "crawl" || SN.Game.timeScale < 0.6, "el tiempo se frena");
        GameLab.run(0.9);
        Check(SN.Chart.zoom > 0.3, "la gráfica hace zoom");
        Until(() => SN.Drama.stage == "after", 6, "el golpe");
        Until(() => !Pos() && !SN.UI.busy, 20, "fin de la cámara lenta");
        Check(SN.Game.timeScale == 1 && !SN.Drama.active, "todo vuelve a la normalidad tras el golpe");
        SN.Data["markets"].arr[0]["twist"]["chance"] = 0.26;

        // Mejoras: al empezar solo el ×1 (las demás llegan como regalo)
        Check(Run["form"]["leverage"] == 1 && !SN.Trading.leverageAvailable(2) && Dom.querySelectorAll("#leverages button.locked").Count == 3,
            "acabado el tutorial solo queda el ×1: ×2, ×5 y ×10 salen con candado");
        Mouse("#leverages button[data-l=\"5\"]");
        GameLab.run(0.5);
        Check(SN.Windows.current == "shop" && Dom.querySelector(".sh-nb.on").dataset["cat"] == "mejoras" && Dom.querySelector(".sh-row.sel").dataset["id"] == "multiplicador",
            "pulsar un multiplicador con candado abre la Tienda en el MULTIPLICADOR");
        {
            double d0 = SN.Debt.amount, cr = SN.Upgrades.creditCost("multiplicador");
            Mouse(".sh-buy");
            GameLab.run(0.4);
            Check(SN.Upgrades.level("multiplicador") == 1 && SN.Trading.leverageAvailable(2) && !SN.Trading.leverageAvailable(5) && Run["debt"]["amount"].num == d0 + cr,
                "el ×2 se compra a crédito en la Tienda: hoy $0 y +$" + cr + " a la deuda");
        }
        Mouse(".win-x");
        GameLab.run(0.3);
        Check(!Dom.querySelector("#leverages button[data-l='2']").classList.contains("locked"), "el botón ×2 pierde el candado");

        // Periódico: clic en la noticia de la gráfica
        SN.Market.addEvent(Run["markets"]["salud"], SN.Data["marketEvents"]["salud"].arr[0]);
        SN.UI.renderAll();
        GameLab.run(0.3);
        Mouse("#events");
        GameLab.run(0.5);
        Check(SN.Windows.current == "news", "clic en la noticia de la gráfica abre el periódico");
        Check(Dom.querySelector(".np-mast") != null && Dom.querySelectorAll(".win canvas.photo").Count > 0, "el periódico tiene portada y fotos");
        Tecla("Escape");
        GameLab.run(0.3);
        Check(SN.Windows.current == null, "ESC cierra la ventana");

        // Pagar la deuda de la Pleyzeta: el encapuchado da el bono cuando se lo entregas
        SN.Economy.add(400, "test");
        SN.UI.renderAll();
        GameLab.run(0.4);
        Check(!Dom.byId("btn-pay").classList.contains("hidden"), "aparece el botón PAGAR DEUDA");
        double capPay = Run["capital"].num - Run["debt"]["amount"].num;
        Mouse("#btn-pay");
        bool sawHood = false, bonusLate = false;
        for (int i = 0; i < 480 && SN.UI.busy; i++)
        {
            if (!bonusLate && Run["debt"]["id"] == "pleyzeta" && SN.Debt.pendingBonus() > 0 && SN.Narrative.hood != null && SN.Dialog.active)
                bonusLate = Run["capital"].num == capPay;
            if (!sawHood && SN.Narrative.hood != null && SN.Dialog.active) sawHood = true;
            Adv();
            GameLab.run(0.25);
        }
        Check(Run["flags"]["debtPaid"].truthy, "deuda de la Pleyzeta pagada");
        double pb = 0;
        foreach (var d in Run["debts"].arr) if (d["id"] == "pleyzeta") pb = d["bonus"].num;
        Check(bonusLate, "el bono no está en tu dinero mientras el encapuchado habla");
        Check(Run["capital"].num == capPay + pb && SN.Debt.pendingBonus() == 0, "el bono ($" + pb + ") se suma cuando te lo da");
        Check(!SN.Trading.leverageAvailable(10), "pagar la deuda ya no regala el ×10: se compra");
        Check(sawHood && SN.Debt.active() && Run["debt"]["id"] == "regalo1" && SN.Upgrades.isUnlocked("limite") && SN.Upgrades.level("limite") == 0,
            "el \"regalo\" del encapuchado: LÍMITE para comprar... y una deuda nueva");
        Until(() => !SN.UI.busy, 10, "fin del regalo");
    }

    // Bancarrota: sin fondos -> rescate bancario (vida extra) -> sin rescate -> vuelta al punto de control
    public static void Bancarrota()
    {
        Open(Profile(PROFILE_DONE));
        NuevaPartida();
        Check(!SN.Debt.hopeless(), "al empezar no es imposible pagar");
        SN.Economy.spend(Run["capital"].num - 4, "test");
        SN.UI.setBusy(true);
        SN.Game.afterTurn(V.@null);
        Until(() => Dom.querySelector(".stamp") != null, 6, "el sello de SIN FONDOS");
        Check(Dom.querySelector(".stamp").textContent.Contains("SIN FONDOS"), "con menos de la apuesta mínima: SIN FONDOS");
        Until(() => SN.Bailout.active, 10, "la Línea de Rescate");
        GameLab.run(0.4);
        double cp = Run["checkpoint"]["capital"].num;

        // El rescate (js/render/bailout.js): contestador -> banco enorme -> nombre -> llamada con Trompa
        SN.Bailout.speed = 3;
        Until(() => SN.Bailout.V.ui == "menu", 12, "el contestador");
        Tecla("Digit2", "2");
        Until(() => SN.Bailout.V.ui == "name", 6, "el nombre del banco");
        GameLab.run(0.3);
        for (int i = 0; i < 40 && SN.Bailout.V.typed < SN.Data["story"]["rescue"]["bankName"].str.Length; i++) { Tecla("KeyK", "k"); GameLab.run(0.05); }
        Tecla("Enter", "Enter");
        Until(() => SN.Bailout.V.scene == "call", 15, "la videollamada");
        for (int i = 0; i < 400 && SN.Bailout.active; i++)
        {
            bool full = SN.Bailout.say_ != null && SN.Bailout.say_.shown >= SN.Bailout.say_.full.Length;
            if (full) Tecla("Space", " ");
            GameLab.run(0.08);
        }
        Until(() => Dom.byId("bk-continue") != null, 6, "el justificante");
        Check(Dom.querySelector(".rescue-ui").textContent.Contains("TRANSFERENCIA RECIBIDA"), "el justificante: transferencia recibida");
        double coins = SN.Bankruptcy.coins;
        Mouse("#bk-continue");
        GameLab.run(0.9);
        Check(SN.Game.state == "GAMEPLAY" && Run["capital"].num == 4 + coins && Run["rescue"].str == "used", "la partida sigue con el dinero del rescate (+" + coins + ")");
        Check(SN.Save.hasRun(), "la partida no se borra");

        // Sin rescate: se acaba de verdad y vuelves al inicio de la meta
        SN.Economy.spend(Run["capital"].num - 3, "test");
        SN.UI.setBusy(true);
        SN.Game.afterTurn(V.@null);
        Until(() => Dom.querySelector(".final-loss") != null, 9, "la pantalla de fin");
        GameLab.run(0.4);
        Check(Dom.querySelector(".final-loss").textContent.Contains("inicio de"), "dice a qué paso vuelves y con cuánto");
        Mouse("#bk-retry");
        GameLab.run(1.5);
        Drain(() => SN.Dialog.active || SN.UI.busy, 6);
        Check(SN.Game.state == "GAMEPLAY" && Math.Abs(Run["capital"].num - cp) < 0.001, "vuelves al inicio de la meta con " + cp);
        Check(Run["rescue"].str == "ready", "la Línea de Rescate vuelve a coger el teléfono");
    }

    // Escalera: se paga cada deuda con dinero de depuración y se acepta cada oferta hasta la meta (la elección)
    public static void EscaleraCompleta()
    {
        Open(Profile(PROFILE_DONE));
        NuevaPartida();
        for (int i = 0; i < 80 && !Run["finale"].truthy; i++)
        {
            // Meta: el dinero de depuración la completa (la meta mira el capital)
            V stp = SN.Unlocks.step();
            if (stp.truthy && stp["kind"] == "goal" && Run["capital"].num < stp["amount"].num && !SN.UI.busy) { SN.Economy.add(stp["amount"].num - Run["capital"].num, "test"); SN.UI.setBusy(true); SN.Game.afterTurn(V.@null); Until(() => !SN.UI.busy, 90, "la meta"); continue; }
            if (SN.Windows.current == "offer" && Vis(".of-yes")) { Mouse(".of-yes"); Drain(() => SN.UI.busy, 10); continue; }
            if (SN.Debt.active() && SN.Debt.amount > Run["capital"].num) SN.Economy.add(SN.Debt.amount, "test");
            if (SN.Debt.canPay()) { Mouse("#btn-pay"); Drain(() => SN.UI.busy, 20); continue; }
            Until(() => !SN.UI.busy, 12, "turno");
            GameLab.run(0.25);
        }
        Check(Run["finale"].truthy, "llega a la meta final: " + Run["step"].str);
        Check(Run["flags"]["debtPaid"].truthy, "la meta llega con las deudas pagadas");
    }

    // FINAL A (el avatar perfecto): elección, tres turnos sin elegir, recargar y el final A entero
    public static void FinalA()
    {
        var st = Profile(PROFILE_DONE);
        Open(st);
        HastaLaElección();
        PactNo();
        Check(SN.Windows.current == null && Dom.querySelectorAll(".fz-card.off").Count == 8 && Dom.querySelector(".fz-card.you") != null,
            "«Ahora no» cierra la oferta: 8 mercados bloqueados y TÚ");
        Tecla("KeyT");
        GameLab.run(0.3);
        Check(SN.Windows.current == null, "durante la elección no se abre la tienda");

        // Tres turnos sin elegir: la entidad elige por ti
        Mouse("#btn-skip-turn");
        Until(() => SN.Windows.current == "pact" && !SN.UI.busy, 15, "la oferta vuelve");
        PactNo();
        Mouse("#btn-skip-turn");
        Until(() => SN.Windows.current == "pact" && !SN.UI.busy, 15, "la oferta vuelve (2)");
        PactNo();
        Mouse("#btn-skip-turn");
        Until(() => Run["finale"]["phase"] == "A", 15, "el final A por los tres turnos");

        // Recargar: se vuelve a la elección
        Recargar(st);
        Check(SN.Save.hasRun(), "el final no se guarda mientras dura: la partida sigue en la elección");
        Until(() => SN.Windows.current == "pact" && Run["finale"]["phase"] == "choice", 15, "volver a la elección");

        // FINAL A entero: FUTURO.exe absorbe la interfaz, el encapuchado se funde con el protagonista y los créditos
        GameLab.run(0.5);
        Mouse(".of-yes");
        Until(() => Dom.byId("app").classList.contains("absorb"), 4, "FUTURO.exe absorbe la interfaz");
        Until(() => SN.Cine.shot.truthy && SN.Cine.shot["type"].str == "face" && SN.Cine.shot["opts"]["hoodIn"].truthy, 6, "el encapuchado se funde");
        GameLab.run(3.5);
        Until(() => Dom.byId("desk").classList.contains("gray") && SN.Desk.crawl > 0, 8, "la habitación pierde sus colores");
        Until(() => SN.Cine.shot.truthy && SN.Cine.shot["type"].str == "black" && SN.Cine.shot["lines"].arr.Any(l => l["text"].str.Contains("ADMINISTRADOR")), 25, "NUEVO ADMINISTRADOR REGISTRADO");
        Until(() => SN.Hero.cat.state == "stare", 25, "el gato mira a la cámara");
        Until(() => SN.Hero.cat.hoodT > 0, 6, "el gato tiene la cara del encapuchado");
        Until(() => Dom.querySelector(".fin-credits") != null, 15, "FIN y créditos");
        string credits = Dom.querySelector(".fin-credits").textContent;
        Check(credits.Contains("AVATAR PERFECTO") && !credits.Contains("PALA"), "créditos del final A, sin la pala");
        Mouse(".fin-credits .fin-next");
        Until(() => SN.Game.state == "MENU", 6, "vuelta al menú");
        Check(SN.State.profile["endings"]["A"].truthy && !SN.State.profile["pala"].truthy && !SN.Save.hasRun(), "el final A queda visto, la partida cerrada y sin pala");
    }

    // FINAL B (NULL.EXE): la terminal, la X, el agente de la Policía Fiscal y la pala
    public static void FinalB()
    {
        Open(Profile(PROFILE_DONE));
        HastaLaElección();
        PactNo();
        Mouse("#btn-fmin");
        Until(() => SN.Desktop.open && SN.Desktop.wins.ContainsKey("null") && Dom.querySelector(".nu-run:not([disabled])") != null
            && Dom.byId("app").classList.contains("hidden"), 5, "NULL.EXE con su LÉEME");
        GameLab.run(0.3);
        Mouse(".nu-run");
        Until(() => SN.Desktop.wins.ContainsKey("term") && SN.Finale.term.truthy && SN.Finale.term["typing"].truthy, 4, "la terminal");
        for (int i = 0; i < 6; i++) { Tecla("KeyA"); GameLab.run(0.09); }
        GameLab.run(0.9);
        Check(SN.Finale.term["lines"].arr.Any(l => l["t"].str.Contains("tasklist")), "cualquier tecla escribe el comando (tasklist)");
        Mouse(".dt-term .dt-x");
        Tecla("Escape");
        Mouse(".dt-icon[data-app=\"futuro\"]");
        GameLab.run(0.3);
        Check(SN.Desktop.wins.ContainsKey("term") && SN.Desktop.open && SN.Desktop.topWin() == "term" && SN.Finale.term["notice"].truthy,
            "la terminal no se cierra mientras NULL.EXE se ejecuta");
        Mouse(".dt-icon[data-app=\"notes\"]");
        Mouse(".dt-icon[data-app=\"null\"]");
        Check(SN.Desktop.topWin() == "term", "el icono de NULL.EXE te lleva a la terminal");
        Check(PlayOut(200), "final B entero hasta los créditos");
        foreach (var id in new[] { "pleyzeta", "tele", "movil", "moto", "reloj", "pc" })
            Check(SN.Officer.taken.Contains(id), "el agente se lleva " + id);
        Check(SN.Desk.noPC && !SN.Officer.on, "el agente se lleva el PC");
        Check(SN.Desk.palaPos == "desk" && SN.Desk.state()["pala"].truthy, "la pala te la deja el agente en el escritorio");
        Mouse(".fin-credits .fin-next");
        Until(() => SN.Game.state == "MENU", 6, "volver al menú");
        Check(SN.State.profile["endings"]["B"].truthy && SN.State.profile["pala"].truthy, "el final B queda visto y LA PALA, desbloqueada");
    }

    // Guardar y cargar: continuar tras recargar, con la partida y con una operación abierta
    public static void GuardarYCargar()
    {
        var st = Profile(PROFILE_DONE);
        Open(st);
        NuevaPartida();
        Mouse("#btn-buy");
        Until(() => !SN.UI.busy && !Pos(), 25, "la operación");
        double c = Run["capital"].num, d = Run["day"].num, t = Run["turn"].num, p = Run["markets"]["salud"]["price"].num;
        Recargar(st);
        Check(Run["capital"].num == c && Run["day"].num == d && Run["turn"].num == t && Run["markets"]["salud"]["price"].num == p,
            "continuar restaura la partida");

        Mouse("#btn-buy");
        GameLab.run(0.4);
        Check(Pos(), "operación abierta");
        Recargar(st);
        Until(() => SN.Game.state == "GAMEPLAY" && !Pos() && !SN.UI.busy, 10, "resolver la operación pendiente");
        Check(Run["stats"]["trades"].num == 2, "la operación pendiente se resuelve al continuar");
        Check(Run["committed"].num == 0, "no queda dinero comprometido tras continuar");
    }
}
