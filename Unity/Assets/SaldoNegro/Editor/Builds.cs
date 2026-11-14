// Builds del port: Windows (64 bits) y WebGL para itch.io, en Unity/Builds/. Se lanzan desde el menú
// "Saldo Negro/Build" o desde la CLI (script eval: SaldoNegro.EditorTools.Builds.WebGL()).
// WebGL para itch.io: compresión Gzip con descompresión de respaldo (itch.io no manda la cabecera
// Content-Encoding) y sin datos de depuración. El guardado va al localStorage del navegador (Game/App/Storage.cs).
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace SaldoNegro.EditorTools
{
    public static class Builds
    {
        static string Root { get { return Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Builds")); } }
        static string[] Scenes { get { return new[] { "Assets/SaldoNegro/Scenes/Main.unity" }; } }

        [MenuItem("Saldo Negro/Build/Windows")]
        public static string Windows()
        {
            return Run(new BuildPlayerOptions
            {
                scenes = Scenes,
                locationPathName = Path.Combine(Root, "Windows", "SaldoNegro.exe"),
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            });
        }

        [MenuItem("Saldo Negro/Build/WebGL (itch.io)")]
        public static string WebGL()
        {
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            // (página a ventana completa como la web: Assets/WebGLTemplates/SaldoNegro)
            PlayerSettings.WebGL.template = "PROJECT:SaldoNegro";
            return Run(new BuildPlayerOptions
            {
                scenes = Scenes,
                locationPathName = Path.Combine(Root, "WebGL"),
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            });
        }

        static string Run(BuildPlayerOptions o)
        {
            var r = BuildPipeline.BuildPlayer(o);
            var s = r.summary;
            string msg = o.target + ": " + s.result + ", " + s.totalErrors + " errores, " + s.totalWarnings + " avisos, " + (s.totalSize / (1024 * 1024)) + " MB, " + s.totalTime.TotalSeconds.ToString("0") + " s -> " + o.locationPathName;
            if (s.result != BuildResult.Succeeded) Debug.LogError("SALDO NEGRO: " + msg); else Debug.Log("SALDO NEGRO: " + msg);
            return msg;
        }
    }
}
