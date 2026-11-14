// El DOM mínimo (Assets/SaldoNegro/Draw/Dom): HTML, selectores, clases, dataset y eventos.
using System;
using SaldoNegro;
using static Program;

public static class DomLab
{
    public static void Basico()
    {
        var root = Dom.el("div", "root");
        root.innerHTML = "<div class=\"win-head\"><span>¡GRACIAS &amp; ya!</span><button class=\"btn btn-yellow\" data-frac=\"0.5\">50%<kbd>Enter</kbd></button></div><br><p class='hi x'>Hola <b class=y>$5</b></p><!-- nada -->";
        Check(root.childList().Count == 3, "hijos: " + root.childList().Count);
        Check(root.querySelector(".win-head span").textContent == "¡GRACIAS & ya!", "texto con entidad: " + root.querySelector(".win-head span").textContent);
        var b = root.querySelector("button[data-frac=\"0.5\"]");
        Check(b != null && b.dataset["frac"] == "0.5" && b.classList.contains("btn-yellow"), "atributo y dataset");
        Check(root.querySelector(".hi > b.y").textContent == "$5", "hijo directo");
        Check(root.querySelectorAll("span, kbd").Count == 2, "lista de selectores");
        Check(root.querySelector("p:not(.x)") == null && root.querySelector("p:not(.z)") != null, ":not");
        Check(root.querySelector("div:first-child") != null, ":first-child");
        int n = 0;
        root.addEventListener("click", (e) => { n++; Check(e.target == b, "target"); });
        b.click();
        Check(n == 1, "burbujeo");
        b.dataset["confirm"] = "1";
        Check(b.getAttribute("data-confirm") == "1", "dataset escribe");
        b.dataset.delete("confirm");
        Check(!b.hasAttribute("data-confirm"), "dataset borra");
        root.querySelector(".hi").insertAdjacentHTML("beforeend", "<i style=\"--i:3\">7</i>");
        Check(root.querySelector(".hi i").style["--i"] == "3", "estilo en línea: " + root.querySelector(".hi i").style.cssText);
        Check(root.querySelector(".hi").textContent == "Hola $57", "textContent: " + root.querySelector(".hi").textContent);
        b.classList.toggle("hidden", true);
        Check(b.hidden, "toggle");
        Check(Selector.parse("#a .b > c.d").specificity() == 10201, "especificidad");
    }
}
