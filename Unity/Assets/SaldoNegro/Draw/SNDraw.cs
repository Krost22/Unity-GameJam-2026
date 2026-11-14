// SN para todo lo que no necesita Unity: hereda la lógica (SaldoNegro.Logic.SN) y cuelga los demás módulos de la
// web (dibujo, interfaz, sistemas con interfaz, el juego), en C# puro sobre el lienzo (Canvas) y el DOM mínimo
// (Dom). Así el juego entero corre sin Unity (pruebas rápidas en .NET) y Unity solo pone la pantalla, la entrada
// y el sonido (SaldoNegro.App: refleja el DOM en UI Toolkit, sube los lienzos a texturas y llama a Game.frame).
using System;
using System.Text.RegularExpressions;
using SaldoNegro.Logic;

namespace SaldoNegro
{
    public class SN : SaldoNegro.Logic.SN
    {
        // Pantalla física del monitor dentro del escenario (js/render/desk.js la calcula: SCR x2)
        public static readonly V SCREEN = V.Obj("x", 108, "y", 14, "w", 420, "h", 236);

        // ---------- Módulos (en el orden de index.html) ----------
        public static Music Music;
        public static Audio Audio;
        public static Drama Drama;
        public static Hero Hero;
        public static Sprites Sprites;
        public static Desk Desk;
        public static Hands Hands;
        public static Chart Chart;
        public static FX FX;
        public static NewsArt NewsArt;
        public static Chars Chars;
        public static Bailout Bailout;
        public static Officer Officer;
        public static Dialog Dialog;
        public static Windows Windows;
        public static UI UI;
        public static Desktop Desktop;
        public static HeroSay HeroSay;
        // (la lógica solo ve dos banderas del tutorial: ITutorialFlags, el mismo objeto)
        public static new Tutorial Tutorial { get { return SaldoNegro.Logic.SN.Tutorial as Tutorial; } set { SaldoNegro.Logic.SN.Tutorial = value; } }
        public static Narrative Narrative;
        public static ScreenCanvas ScreenCanvas;
        public static Bankruptcy Bankruptcy;
        public static Finale Finale;
        public static Cine Cine;
        public static Game Game;

        // Carga la lógica y todo lo demás (como abrir la página). data: el JSON de js/data.
        // Los módulos se crean en el orden de los <script> de index.html; ninguno toca el DOM al crearse (igual que
        // en la web, donde solo se definen): lo hacen en su init(), que llama Game.start().
        public static void LoadAll(string data, IStorage storage = null)
        {
            // SN.DEBUG = /[?&]debug\b/.test(location.search) (js/core/sn.js)
            DEBUG = Regex.IsMatch(Dom.locationSearch ?? "", @"[?&]debug\b");
            Load(data, storage);
            Music = new Music();
            Audio = new Audio();
            Drama = new Drama();
            Hero = new Hero();
            Sprites = new Sprites();
            Desk = new Desk();
            Hands = new Hands();
            Chart = new Chart();
            FX = new FX();
            NewsArt = new NewsArt();
            Chars = new Chars();
            Bailout = new Bailout();
            Officer = new Officer();
            Dialog = new Dialog();
            Windows = new Windows();
            UI = new UI();
            Desktop = new Desktop();
            HeroSay = new HeroSay();
            Tutorial = new Tutorial();
            Narrative = new Narrative();
            ScreenCanvas = new ScreenCanvas();
            Bankruptcy = new Bankruptcy();
            Finale = new Finale();
            Cine = new Cine();
            Game = new Game();
        }
    }
}
