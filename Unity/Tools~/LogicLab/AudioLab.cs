// Los efectos de sonido (Draw/Audio/Sfx.cs) contra Chrome: Refs/AudioRefs.json, generado por Unity/Tools~/ref-audio.js
// (OfflineAudioContext a 48 kHz, con Math.random de semilla 12345). Se compara el render "dry" de cada caso: el error
// máximo por muestra tiene que ser <= 1e-4 más la cuantización a int16 (0.5 / 32767). El render "full" (master 0.7 y
// DynamicsCompressor) no se porta todavía.
// Uso: bash Unity/Tools~/lab.sh run audio AudioLab
using System;
using System.Collections.Generic;
using System.IO;
using SaldoNegro;
using SaldoNegro.Logic;

public static class AudioLab
{
    const double Tol = 1e-4 + 0.5 / 32767;
    const double FullTol = 1e-2;
    static V refs;

    static string A(string rel) { return Path.GetFullPath(Path.Combine("../../Assets/SaldoNegro", rel)); }

    static V Refs()
    {
        if (refs is null) refs = Json.parse(File.ReadAllText(A("Tests/EditMode/Refs/AudioRefs.json")));
        return refs;
    }

    // La tonalidad del caso ("def" o "alt"), tal como la guarda ref-audio.js
    static SfxKey KeyOf(V key)
    {
        var scale = new List<double>();
        foreach (V x in key["scale"]) scale.Add(x.num);
        return new SfxKey(key["root"].num, scale.ToArray(), key["rate"].num);
    }

    // int16 little-endian en base64 -> muestras en [-1, 1) con la escala del archivo
    static double[] Decode(string b64, double scale)
    {
        byte[] bytes = Convert.FromBase64String(b64);
        var r = new double[bytes.Length / 2];
        for (int i = 0; i < r.Length; i++) r[i] = BitConverter.ToInt16(bytes, 2 * i) / scale;
        return r;
    }

    // Compara los casos que cumplen el filtro; lanza una excepción si alguno se aleja más de la tolerancia
    static void Group(string titulo, Func<V, bool> filtro, bool full = false)
    {
        V data = Refs();
        double scale = data["scale"].num;
        V cases = data["cases"];
        int total = 0, ok = 0;
        var fallos = new List<string>();
        for (int c = 0; c < cases.length.i; c++)
        {
            V rc = cases[c];
            if (!filtro(rc)) continue;
            total++;
            string name = rc["name"].str;
            string tag = name + (rc["opts"]["voice"].isUndefined ? "" : " voice=" + rc["opts"]["voice"].str);
            if (rc["key"]["rate"].num != 1) tag += " (alt)";
            // Como en Chrome: Math.random = mulberry32(12345), reiniciado en cada caso (ref-audio.js)
            JsMath.rndOverride = new RNG(12345).next;
            float[] mine;
            try { mine = full ? new Sfx().renderFull(name, rc["opts"], KeyOf(rc["key"])) : new Sfx().render(name, rc["opts"], KeyOf(rc["key"])); }
            finally { JsMath.rndOverride = null; }
            int n = rc["n"].i;
            double[] chrome = Decode(rc[full ? "full" : "dry"].str, scale);
            if (mine == null) { fallos.Add($"  {tag}: efecto desconocido"); continue; }
            double maxErr = 0; int at = -1;
            int m = Math.Min(n, Math.Min(mine.Length, chrome.Length));
            for (int i = 0; i < m; i++)
            {
                double e = Math.Abs(mine[i] - chrome[i]);
                if (e > maxErr) { maxErr = e; at = i; }
            }
            string extra = mine.Length != n ? $" longitud {mine.Length} != {n}" : "";
            if (maxErr <= (full ? FullTol : Tol) && extra.Length == 0) ok++;
            else fallos.Add($"  {tag}: error max {maxErr:E2} en la muestra {at} (Chrome {(at >= 0 ? chrome[at] : 0):F6}, port {(at >= 0 && at < mine.Length ? mine[at] : 0):F6}){extra}");
        }
        foreach (var f in fallos) Console.WriteLine(f);
        Console.WriteLine($"{titulo}: {ok} de {total} casos iguales (tolerancia {(full ? FullTol : Tol):E2})");
        if (ok < total) throw new Exception((total - ok) + " casos distintos de Chrome en " + titulo);
    }

    // Todos los casos del render dry, en un solo paso
    public static void Dry() { Group("efectos (dry)", r => true); }

    // Camino real (master 0.7 y compresor): error máximo por muestra < 1e-2
    public static void Full() { Group("efectos (full)", r => true, true); }
}
