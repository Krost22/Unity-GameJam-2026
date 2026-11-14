// GameManager: estados del juego (BOOT, MENU, INTRO, TUTORIAL, GAMEPLAY, BANKRUPTCY), bucle principal,
// cámara/escalado del escenario, velocidad del tiempo (cámara lenta) y el orden de lo que pasa en cada turno.
// La lógica de cada sistema vive en su propio archivo; aquí solo se orquesta.
// Port de js/core/game.js. Este archivo: estado, escalado y cámara, bucle. El resto (arranque, menú, turnos,
// atajos de depuración) está en Game.Parte2.cs.
// Como en JS, algunas promesas se lanzan sin esperarlas (el juego sigue y ellas acaban solas): no es un olvido.
#pragma warning disable CS4014
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using U = SaldoNegro.Logic.Util;

namespace SaldoNegro
{
    public sealed partial class Game
    {
        // this.cam y su animación (camTo): x, y y zoom del encuadre
        sealed class Cam { public double x, y, zoom; }
        sealed class Tween { public Cam from, to; public double t, dur; }
        // this.focus: el acercamiento de la cámara lenta (se acerca a la gráfica sin perder de vista COBRAR)
        sealed class Focus { public double x, y, zoom, k, from, to, t, dur; }
        // this.slow: la velocidad del tiempo que cambia poco a poco (slowTo con duración)
        sealed class Slow { public double from, to, t, dur; }

        public string state = "BOOT";
        public double @base = 1, vw = 0, vh = 0, tx = 0, ty = 0, z = 1;
        public string mode = "full";
        Cam cam = new Cam { x = 320, y = 180, zoom = 1 };
        Tween tween = null;
        // Enfoque de la cámara lenta: se acerca a la gráfica sin perder de vista el botón COBRAR
        Focus focus = new Focus { x = 400, y = 140, zoom = 1.75, k = 0, from = 0, to = 0, t = 1, dur = 1 };
        public double timeScale = 1;
        Slow slow = null;
        public double pulse = 0;
        public double last = 0;
        public bool dayChanged = false;
        string camKey = "";

        // Contexto del lienzo de la habitación (this.deskCtx)
        Ctx2D deskCtx;

        // S y D: los módulos de datos y estado (SN.State, SN.Data)
        State S { get { return SN.State; } }
        Data D { get { return SN.Data; } }

        public void setState(string s) { state = s; Dom.document.dataset["state"] = s; }

        public void init()
        {
            SN.Save.loadProfile();
            V st = S.profile["settings"];
            SN.Audio.sfxOn = st["sfx"].truthy;
            SN.Audio.musicOn = st["music"].truthy;
            deskCtx = Px.ctx(Dom.byId("desk").getContext().canvas);
            SN.ScreenCanvas.init();
            SN.UI.init();
            SN.Desktop.init();
            // Los oyentes de la elección final (turn:settled / turn:ready) se registran aquí, como al cargar finale.js
            SN.Finale.init();
            SN.Cine.init();
            SN.UI.renderSound();
            Dom.addWindowListener("resize", () => layout());
            layout();
            bindMenu();
            SN.Events.on("day:changed", (e) => { dayChanged = true; });
            // Primer gesto (clic o tecla): el navegador ya deja sonar el audio
            Action gesture = () =>
            {
                SN.Audio.unlock();
                if (state == "MENU" || state == "BOOT") SN.Audio.startMusic();
            };
            Dom.document.addEventListener("pointerdown", gesture);
            Dom.document.addEventListener("keydown", gesture);
            if (SN.DEBUG) debugKeys();
            Dom.byId("stage").classList.add("ready");
            Dom.byId("loading").remove();
            Dom.requestAnimationFrame((t) => { last = t; frame(t); });
            boot();
        }

        // Espera a que cargue la fuente pixel (en la web, document.fonts.load(...).then(go, go); aquí la fuente
        // ya está cargada y el anfitrión lo llama directamente)
        public void start()
        {
            init();
        }

        // ---------- Escalado y cámara ----------
        public void layout()
        {
            double vw = Dom.innerWidth, vh = Dom.innerHeight;
            double b = JsMath.min(vw / SN.W, vh / SN.H);
            mode = "full";
            // En pantallas pequeñas la cámara se acerca al monitor para que se pueda leer
            if (b < 1.55)
            {
                double mz = JsMath.min(vw / 452, vh / 270);
                if (mz > b * 1.12) { b = mz; mode = "monitor"; }
            }
            @base = b; this.vw = vw; this.vh = vh;
            Dom.document.style.setProperty("--k", JsNumber.toFixed(JsMath.max(1, b), 3));
            SN.Hands.applyCursor(b);
            camKey = "";
            applyCam();
        }

        public void applyCam()
        {
            // El rescate bancario también es a pantalla completa: sin el zoom sobre el monitor de las ventanas pequeñas
            // (con la escala de Windows al 125-150 % se recortaba y el móvil se veía demasiado cerca)
            bool shot = SN.Cine.shot.truthy || (SN.Bailout != null && SN.Bailout.active);
            double b = @base, fx = cam.x, fy = cam.y, zoom = cam.zoom;
            if (shot)
            {
                // Planos de cinemática a pantalla completa: encuadre fijo, sin el zoom del escritorio
                b = JsMath.min(vw / SN.W, vh / SN.H); fx = 320; fy = 180; zoom = 1;
            }
            else
            {
                // En pantallas pequeñas la cámara se queda centrada en el monitor
                if (mode == "monitor") { fx = SN.SCREEN["x"].num + SN.SCREEN["w"].num / 2; fy = SN.SCREEN["y"].num + SN.SCREEN["h"].num / 2 - 4; }
                var f = focus;
                if (f.k > 0)
                {
                    double k = U.ease.inOutSine(U.clamp(f.k, 0, 1));
                    double fz = mode == "monitor" ? 1 + (f.zoom - 1) * 0.45 : f.zoom;
                    fx = U.lerp(fx, f.x, k); fy = U.lerp(fy, f.y, k);
                    zoom *= 1 + (fz - 1) * k;
                }
                zoom *= 1 + pulse;
            }
            double zz = b * zoom;
            double tX = JsMath.round(vw / 2 - fx * zz), tY = JsMath.round(vh / 2 - fy * zz);
            // Con zoom, la cámara nunca enseña lo que hay fuera del escenario
            if (!shot)
            {
                double sw = SN.W * zz, sh = SN.H * zz;
                if (sw >= vw) tX = JsMath.round(U.clamp(tX, vw - sw, 0));
                if (sh >= vh) tY = JsMath.round(U.clamp(tY, vh - sh, 0));
            }
            string key = Js.String(tX) + "," + Js.String(tY) + "," + JsNumber.toFixed(zz, 4);
            if (key == camKey) return;
            camKey = key;
            tx = tX; ty = tY; z = zz;
            Dom.byId("stage").style.transform = "translate(" + Js.String(tX) + "px, " + Js.String(tY) + "px) scale(" + Js.String(zz) + ")";
            SN.Desk.camShift = (cam.x - 320) + (cam.zoom - 1) * 60;
        }

        // Copia de { x, y, zoom } de JS (Object.assign({}, this.cam, target)): lo que no viene en target se queda
        static Cam mergeCam(Cam from, V target)
        {
            return new Cam
            {
                x = target.has("x") ? target["x"].num : from.x,
                y = target.has("y") ? target["y"].num : from.y,
                zoom = target.has("zoom") ? target["zoom"].num : from.zoom,
            };
        }

        public void camTo(V target, double dur = 1)
        {
            var from = new Cam { x = cam.x, y = cam.y, zoom = cam.zoom };
            tween = new Tween { from = from, to = mergeCam(from, target), t = 0, dur = JsMath.max(0.01, dur) };
        }

        // Acercar la cámara a la última vela (zoom > 0) o volver a la vista normal (zoom = 0)
        public void focusOn(double zoom, double dur = 1)
        {
            var f = focus;
            if (zoom > 0)
            {
                V p = SN.Chart.lastCandlePos();
                // Entre la vela y el panel de operar, para no perder de vista COBRAR
                f.x = SN.SCREEN["x"].num + U.clamp(p["x"].num * 0.45 + 365 * 0.55, 190, 312);
                f.y = SN.SCREEN["y"].num + U.clamp(p["y"].num, 96, 151);
                f.zoom = zoom;
            }
            f.from = f.k; f.to = zoom > 0 ? 1 : 0; f.t = 0; f.dur = JsMath.max(0.01, dur);
        }

        // Velocidad del tiempo del juego (1 normal, 0 congelado). La interfaz y los diálogos no se ralentizan.
        public void slowTo(double scale, double dur = 0)
        {
            if (dur <= 0) { timeScale = scale; slow = null; return; }
            slow = new Slow { from = timeScale, to = scale, t = 0, dur = dur };
        }

        // Toda la cámara lenta a cero (al salir al menú, en una bancarrota...)
        public void resetTime()
        {
            SN.Drama.reset();
            timeScale = 1; slow = null; pulse = 0;
            focus.k = focus.from = focus.to = 0; focus.t = 1;
        }

        // Cliente (px de ventana) -> coordenadas del escenario de pixel art
        public V toStage(double cx, double cy) { return V.Obj("x", (cx - tx) / z, "y", (cy - ty) / z); }

        // ---------- Bucle ----------
        public void frame(double now)
        {
            double dt = JsMath.min(0.05, JsMath.max(0, (now - last) / 1000));
            last = now;
            step(dt);
            Dom.requestAnimationFrame((t) => frame(t));
        }

        public void step(double dt)
        {
            SN.tickTimers(dt);
            SN.Drama.update(dt);
            if (slow != null)
            {
                var s = slow;
                s.t = JsMath.min(1, s.t + dt / s.dur);
                timeScale = U.lerp(s.from, s.to, U.ease.inOutSine(s.t));
                if (s.t >= 1) slow = null;
            }
            var f = focus;
            if (f.t < 1) { f.t = JsMath.min(1, f.t + dt / f.dur); f.k = U.lerp(f.from, f.to, f.t); }
            pulse *= JsMath.pow(0.0005, dt);
            if (pulse < 0.001) pulse = 0;
            double w = dt * timeScale; // tiempo del mundo (se frena con la cámara lenta)
            if (tween != null)
            {
                var tw = tween;
                tw.t = JsMath.min(1, tw.t + dt / tw.dur);
                double k = U.ease.inOutSine(tw.t);
                cam.x = U.lerp(tw.from.x, tw.to.x, k);
                cam.y = U.lerp(tw.from.y, tw.to.y, k);
                cam.zoom = U.lerp(tw.from.zoom, tw.to.zoom, k);
                if (tw.t >= 1) tween = null;
            }
            SN.Chart.update(w, dt);
            SN.Dialog.update(dt);
            SN.UI.update(dt);
            SN.Cine.update(dt);
            SN.Finale.update(dt);
            SN.FX.update(w, dt);
            SN.Hero.follow(dt); // la mano va con el ratón real: tiempo real, no el del mundo
            SN.Desk.render(deskCtx, w);
            if (S.run.truthy && !Dom.byId("app").classList.contains("hidden")) SN.Chart.render();
            SN.ScreenCanvas.render(dt);
            SN.FX.render();
            SN.Cine.render();
            applyCam();
        }
    }
}
