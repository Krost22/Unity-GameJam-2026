// Semilla fija: el port juega lo mismo que la web en Chrome (Unity/Tools~/ref-golden.js) y tiene que dar
// exactamente lo mismo: las mismas salidas del generador, los mismos textos y, turno a turno, la misma partida
// (resumen del JSON de la partida y del perfil) y los mismos eventos (resumen de su tipo y su contenido).
// Es la misma función golden() de ref-golden.js, traducida línea a línea. No usa NUnit: lo llaman los tests
// EditMode (GoldenTests.cs) y el banco rápido de .NET (Unity/Tools~/LogicLab).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;

namespace SaldoNegro.Tests
{
    public sealed class GoldenSuite
    {
        readonly string dataJson;
        readonly V refs;
        public readonly List<string> failures = new List<string>();
        public readonly List<string> log = new List<string>();

        public GoldenSuite(string dataJson, string refsJson) { this.dataJson = dataJson; refs = Json.parse(refsJson); }

        static string hex(double x) { return ((ulong)BitConverter.DoubleToInt64Bits(x)).ToString("x16"); }
        static uint fnv(string s, uint h = 0x811c9dc5)
        {
            foreach (char c in s) { h ^= c; h = unchecked(h * 16777619u); }
            return h;
        }
        void fail(string m) { if (failures.Count < 40) failures.Add(m); }
        void same(V want, string got, string what) { if (want.str != got) fail(what + ": esperaba " + Json.stringify(want) + " y sale " + Json.stringify(got)); }

        void load() { SN.Load(dataJson); }

        // 1) El generador
        public void Rng()
        {
            load();
            var r = new RNG(42); var r2 = new RNG(3000000000); var r3 = new RNG(0);
            V w = refs["rng"];
            for (int i = 0; i < 2000; i++) same(w["next"][i], hex(r.next()), "next() nº " + i);
            for (int i = 0; i < 1000; i++) same(w["normal"][i], hex(r.normal()), "normal() nº " + i);
            for (int i = 0; i < 500; i++) { double v = r.@int(-7, 13); if (w["int"][i] != v) fail("int() nº " + i + ": esperaba " + w["int"][i] + " y sale " + v); }
            for (int i = 0; i < 50; i++) same(w["big"][i], hex(r2.next()), "semilla grande nº " + i);
            for (int i = 0; i < 50; i++) same(w["zero"][i], hex(r3.next()), "semilla 0 nº " + i);
            if (w["state"] != r.s) fail("estado final " + r.s + " / " + w["state"]);
        }

        // 2) Textos
        public void Textos()
        {
            load();
            V t = refs["text"];
            var nums = new List<double>();
            foreach (var h in t["nums"]) nums.Add(BitConverter.Int64BitsToDouble((long)Convert.ToUInt64(h.str, 16)));
            for (int i = 0; i < nums.Count; i++)
            {
                double v = nums[i];
                string n = Js.String(v) + " (nº " + i + ")";
                same(t["money"][i], Util.money(v), "money " + n);
                same(t["moneySign"][i], Util.money(v, true), "money con signo " + n);
                same(t["short"][i], Util.@short(v), "short " + n);
                same(t["pct"][i], Util.pct(v), "pct " + n);
                same(t["pct1"][i], Util.pct(v, 1), "pct 1 " + n);
                same(t["pct2"][i], Util.pct(v, 2), "pct 2 " + n);
                same(t["str"][i], Js.String(v), "String " + n);
                same(t["fixed2"][i], JsNumber.toFixed(v, 2), "toFixed(2) " + n);
            }
            SN.State.newRun();
            var phrases = new List<string> { "Debes $250 hoy.", "Te faltan $1,750.", "$60.", "Día 17", "Siete pavos", "¡Qué suerte!", "Estás afortunada", "suertes",
                "Toma un regalo de bienvenida: ya puedes comprar LÍMITE. Y un multiplicador ×10.", "Tienes una deuda con plazo", "¡Liquidado!",
                "Se abre el Mercado Dorado", "Pulsa COBRAR ya", "vas a cobrar mañana", "apuesta x2", "max2 y xbox", "EL DIARIO DEL FUTURO", "<b>$5</b>",
                "FUTURO.exe ha encontrado algo", "Abre FUTURO.EXE", "−$7,777 de deuda", "+$ 77K y $3M", "10x más y x 5", "Plan B y apalancamiento",
                "Desbloqueas la Tienda, las Mejoras y la Academia", "ЖДФ Я son letras", "Embargado por el cobrador: intereses de la bancarrota",
                "SUBIRÁ o BAJARÁ? ESPERAR", "Mercados nuevos: Salud, Tecnología, Negocios, Minería y mineria" };
            foreach (var f in SN.Data["story"]["fillerNews"] || new JsArray()) { phrases.Add(f["title"].str); phrases.Add(f["text"].str); }
            for (int i = 0; i < phrases.Count; i++)
            {
                V k = refs["kw"][i];
                same(k[0], SN.KW.html(phrases[i]), "KW.html \"" + phrases[i] + "\"");
                same(k[1], SN.KW.html(phrases[i], V.Obj("terms", false)), "KW.html sin términos \"" + phrases[i] + "\"");
                if (k[2] != SN.KW.has(phrases[i])) fail("KW.has \"" + phrases[i] + "\"");
            }
            var C = SN.Cipher;
            for (int i = 0; i < 12; i++) same(refs["cipher"][i], C.text(phrases[i]), "Cipher.text \"" + phrases[i] + "\"");
            for (int i = 0; i < 12; i++) same(refs["cipherHtml"][i], C.html(phrases[i], "A"), "Cipher.html \"" + phrases[i] + "\"");
            C.discover(SN.Data["cipher"]["clues"][0]["id"]); C.discover(SN.Data["cipher"]["clues"][3]["id"]);
            for (int i = 0; i < 12; i++) same(refs["cipher2"][i], C.text(phrases[i]) + "|" + C.html(phrases[i], SN.Data["cipher"]["clues"][0]["letter"]) + "|" + C.brandify(phrases[i]), "Cipher con letras \"" + phrases[i] + "\"");
        }

        // 3) Partidas enteras con el bot determinista (índice de la semilla en GoldenRefs.json)
        public void Partida(int index)
        {
            V want = refs["runs"][index];
            double seed = want["seed"];
            load();
            var S = SN.State; var U = SN.Unlocks; var T = SN.Trading; var D = SN.Data;
            uint evHash = 0x811c9dc5; int evCount = 0;
            SN.Events.spy = (type, data) =>
            {
                string s;
                try { s = Json.stringify(data) ?? "undefined"; } catch (Exception) { s = "!"; }
                // (JSON.stringify(undefined) es undefined: en JS 'tipo:' + undefined = 'tipo:undefined')
                evHash = fnv(type + ":" + s, evHash); evCount++;
            };
            S.newRun(seed);
            V run = S.run;
            V last = -1; int rewinds = 0, rescues = 0;
            var turns = new List<string>();
            Action mark = () => { if (run["step"] != last) { last = run["step"]; S.checkpoint("paso " + run["step"]); } };
            Func<double, double> bestLev = (wantLev) =>
            {
                V l = D["sim"]["leverages"].arr.map((x) => x["value"]).filter((v) => v <= wantLev && T.leverageAvailable(v)).pop();
                return l || 1;
            };
            check(want["full"]["start"], Json.stringify(run), "JSON de la partida al empezar");
            mark();
            for (int t = 0; t < 400 && U.step(); t++)
            {
                if (SN.Debt.canPay()) SN.Debt.pay();
                SN.Debt.flushBonuses();
                while (U.check()) mark();
                mark();
                V st = U.step();
                if (!st) break;
                if (st["kind"] == "item" && U.canBuyItem(st["item"])["ok"]) U.acceptOffer(st["item"]);
                else
                {
                    if (run["flags"]["debtPaid"]) run["flags"]["academy"] = true;
                    foreach (var n in SN.Academy.buyable()) if (run["capital"] - n["cost"] >= run["capital"] * 0.6) SN.Academy.buy(n["id"]);
                    foreach (var id in new[] { "multiplicador", "limite", "analisis", "suerte", "resistencia" })
                    {
                        V c = SN.Upgrades.canBuy(id);
                        if (c["ok"] && run["capital"] >= c["debt"] * 2) SN.Upgrades.buy(id);
                    }
                    if (SN.Luck.canSpin()) SN.Luck.spin();
                    SN.ShopWatch.afterTurn();
                    if (t % 4 == 0) SN.ShopWatch.markSeen("shop");
                    bool late = (run["debt"] && run["debt"]["defaulted"]).truthy || SN.Debt.hopeless();
                    if (late || run["capital"] + run["committed"] < D["sim"]["bankruptcyThreshold"])
                    {
                        if (run["rescue"] == "ready")
                        {
                            rescues++;
                            SN.Economy.add(S.rescueAmount(), "rescue");
                            run["rescue"] = "used";
                            if (late) { run["debt"]["deadlineDay"] = JsMath.max(run["debt"]["deadlineDay"], run["day"]) + 2; run["debt"]["defaulted"] = false; }
                        }
                        else
                        {
                            rewinds++; S.restoreCheckpoint(); run = S.run; S.rng.s = JsMath.toInt32(S.rng.s + rewinds * 7919);
                        }
                    }
                    else
                    {
                        V bestD = null, bestH = null;
                        foreach (var d in D["markets"])
                        {
                            if (!U.isUnlocked(d["id"])) continue;
                            V h = SN.Market.hint(d["id"]);
                            if (h["power"] && (bestD is null || d["cap"] > bestD["cap"] || (d["cap"] == bestD["cap"] && h["power"] > bestH["power"]))) { bestD = d; bestH = h; }
                        }
                        if (bestD is null) T.skipTurn();
                        else
                        {
                            run["selected"] = bestD["id"];
                            int p = bestH["power"].i;
                            double lev = bestLev(new double[] { 1, 2, 2, 5 }[p]);
                            run["form"] = V.Obj("amount", JsMath.max(D["sim"]["minInvestment"], Math.Floor(T.maxAmount() * new double[] { 0, 0.3, 0.6, 1 }[p])), "leverage", lev);
                            T.clampForm();
                            V pos = T.open(bestH["dir"], t == 0 ? V.Obj("tutorial", true) : V.undefined);
                            if (!pos) T.skipTurn();
                            else
                            {
                                if (t % 3 == 0 && pos["candles"] > 2)
                                {
                                    V h = run["markets"][pos["market"]]["history"];
                                    double seen = JsMath.min(4, pos["candles"] - 1);
                                    T.cashOut(h[(int)(h.length - pos["candles"] + seen - 1)]["c"], seen);
                                }
                                T.close();
                            }
                        }
                    }
                }
                string line = fnv(Json.stringify(run) + "|" + Json.stringify(S.profile)).ToString("x") + " " + evHash.ToString("x") + " " + evCount;
                turns.Add(line);
                if (t < want["turns"].length && want["turns"][t] != line && failures.Count == 0)
                    fail("semilla " + seed + ": el turno " + t + " ya no coincide (" + line + " / " + want["turns"][t] + ")");
                if (t == 60) check(want["full"]["t60"], Json.stringify(run), "JSON de la partida en el turno 60");
            }
            check(want["full"]["end"], Json.stringify(run), "JSON de la partida al final");
            if (turns.Count != want["turns"].length) fail("semilla " + seed + ": " + turns.Count + " turnos y la web " + want["turns"].length);
            if (rewinds != want["rewinds"] || rescues != want["rescues"]) fail("semilla " + seed + ": " + rescues + " rescates y " + rewinds + " vueltas (web: " + want["rescues"] + " y " + want["rewinds"] + ")");
            log.Add("semilla " + seed + ": " + turns.Count + " turnos, día " + run["day"] + ", paso " + run["step"] + ", " + rescues + " rescates, " + rewinds + " vueltas");
        }
        public int runCount { get { return refs["runs"].length.i; } }

        // Dos JSON que tienen que ser iguales: si no, dónde empiezan a diferir
        void check(V want, string got, string what)
        {
            if (want.isUndefined) return;
            string w = want.str;
            if (w == got) return;
            int i = 0;
            while (i < w.Length && i < got.Length && w[i] == got[i]) i++;
            int a = Math.Max(0, i - 80);
            fail(what + " difiere en la posición " + i + ":\n  web:  …" + w.Substring(a, Math.Min(160, w.Length - a)) + "\n  port: …" + got.Substring(a, Math.Min(160, got.Length - a)));
        }
    }
}
