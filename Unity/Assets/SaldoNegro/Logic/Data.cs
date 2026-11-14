// SN.Data: los datos del juego (js/data/*.js), exportados a JSON por Unity/Tools~/export-data.js.
// Aquí solo están, portadas a mano, las funciones que hay entre los datos (el JSON no las lleva):
//   markets.js     -> marketById, marketLabel
//   progression.js -> keyItemById, payBonusFor, stepById
//   simulation.js  -> el "effect" de cada mejora (texto de su efecto según el valor)
using System;

namespace SaldoNegro.Logic
{
    public sealed class Data
    {
        public readonly V v;

        public Data(V root)
        {
            v = root;
            // Los textos de efecto de las mejoras (js/data/simulation.js), colgados de cada mejora como en la web
            foreach (var up in v["upgrades"])
            {
                string id = up["id"].str;
                JsFn fx = null;
                if (id == "multiplicador") fx = (a) => a[0].truthy ? (V)("Hasta ×" + a[0]) : "Solo ×1";
                else if (id == "limite") fx = (a) => "Máximo: " + Util.@short(a[0]);
                else if (id == "analisis") fx = (a) => V.Arr("Sin efecto", "Pista nítida", "Pista muy nítida", "Pista casi exacta")[a[0]];
                else if (id == "suerte") fx = (a) => a[0].truthy ? (V)("≈ +" + (a[0] * 3) + "% de acierto") : "Sin efecto";
                else if (id == "resistencia") fx = (a) => a[0].truthy ? (V)("Giros: −" + (a[0] * 20) + "%") : "Sin efecto";
                if (fx == null) throw new InvalidOperationException("Mejora sin texto de efecto: " + id);
                up["effect"] = fx;
            }
        }

        public V this[string key] { get { return v[key]; } set { v[key] = value; } }

        public V marketById(V id) { return v["markets"].arr.find((m) => m["id"] == id); }
        // Nombre corto para cabeceras y noticias (los negros llevan "negro")
        public V marketLabel(V id) { var d = marketById(id); return d.truthy ? (d["label"] || d["short"]) : ""; }
        public V keyItemById(V id) { return v["keyItems"].arr.find((k) => k["id"] == id); }
        public V stepById(V id) { return v["chain"].arr.find((s) => s["id"] == id); }
        public double payBonusFor(double amount, double next = 0, double capital = 0)
        {
            var pb = v["payBonus"];
            return JsMath.max(pb["min"], JsMath.max(JsMath.round(amount * pb["frac"]), JsMath.round(next * pb["ready"] - capital)));
        }
    }
}
