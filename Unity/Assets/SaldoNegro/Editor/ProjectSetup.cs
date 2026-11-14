// Ajustes del proyecto y escena principal del port, aplicados por código para que se puedan repetir y revisar
// (menú Saldo Negro > Proyecto). Nada de esto se edita a mano en los archivos .unity ni .asset.
//
// Por qué cada ajuste:
//   · Espacio de color Gamma: el navegador mezcla las transparencias en sRGB; en Linear darían otros colores.
//   · Sin suavizado (MSAA 0), sin HDR, sin filtro anisótropo, escala de render 1: ningún píxel se toca.
//   · VSync: la web va al ritmo de requestAnimationFrame.
//   · Ventana redimensionable y que siga en segundo plano: como una pestaña visible del navegador.
//   · Cámara ortográfica con Pixel Perfect Camera (640x360, 1 píxel por unidad) y fondo del color del body.
//     El juego se compone entero en un panel de UI Toolkit (como el #stage de la web), así que hoy la cámara
//     solo pinta el fondo: el escalado lo hace el panel con la fórmula de la web (ver Stage.cs).
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;

namespace SaldoNegro.EditorTools
{
    public static class ProjectSetup
    {
        public const string ScenePath = "Assets/SaldoNegro/Scenes/Main.unity";
        public const string PanelPath = "Assets/SaldoNegro/UI/PanelSettings.asset";
        public const string ThemePath = "Assets/SaldoNegro/UI/SaldoNegro.tss";

        [MenuItem("Saldo Negro/Proyecto/Aplicar ajustes y reconstruir la escena")]
        public static void ApplyAllMenu() { Debug.Log(ApplyAll()); }

        public static string ApplyAll() { return ApplySettings() + "\n" + BuildMainScene(); }

        public static string ApplySettings()
        {
            PlayerSettings.colorSpace = ColorSpace.Gamma;
            PlayerSettings.companyName = "KrostGames";
            PlayerSettings.productName = "Saldo Negro";
            PlayerSettings.bundleVersion = "2.0";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.defaultIsNativeResolution = false;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.defaultWebScreenWidth = 1280;
            PlayerSettings.defaultWebScreenHeight = 720;

            // La plantilla asigna el asset de URP en cada nivel de calidad (no como pipeline por defecto)
            var urps = new System.Collections.Generic.HashSet<UniversalRenderPipelineAsset>();
            if (GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset def) urps.Add(def);
            int level = QualitySettings.GetQualityLevel(), levels = QualitySettings.names.Length;
            for (int i = 0; i < levels; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.antiAliasing = 0;
                QualitySettings.anisotropicFiltering = AnisotropicFiltering.Disable;
                QualitySettings.vSyncCount = 1;
                if (QualitySettings.GetRenderPipelineAssetAt(i) is UniversalRenderPipelineAsset q) urps.Add(q);
            }
            QualitySettings.SetQualityLevel(level, false);

            if (urps.Count == 0) return "ERROR: el proyecto no tiene ningún asset de URP asignado";
            var names = new System.Collections.Generic.List<string>();
            foreach (var urp in urps)
            {
                urp.supportsHDR = false;
                urp.msaaSampleCount = 1;
                urp.renderScale = 1f;
                EditorUtility.SetDirty(urp);
                names.Add(AssetDatabase.GetAssetPath(urp));
            }
            AssetDatabase.SaveAssets();
            return "Ajustes aplicados: color " + PlayerSettings.colorSpace + ", " + levels + " niveles de calidad sin suavizado y con VSync, URP sin HDR ni MSAA (" + string.Join(", ", names) + ")";
        }

        public static string BuildMainScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return "ERROR: sal del modo Play antes de reconstruir la escena";
            var panel = EnsurePanelSettings();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            camGo.transform.position = new Vector3(0, 0, -10);
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = Stage.H / 2f; // (alto de referencia / 2) / píxeles por unidad
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color32(0x0E, 0x0A, 0x1C, 255); // --coalDD: el fondo de html y body
            cam.allowHDR = false;
            cam.allowMSAA = false;
            cam.allowDynamicResolution = false;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 100f;
            camGo.AddComponent<AudioListener>();
            var data = camGo.GetComponent<UniversalAdditionalCameraData>();
            if (data == null) data = camGo.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = false;
            data.antialiasing = AntialiasingMode.None;
            data.dithering = false;
            data.stopNaN = false;
            var pp = camGo.AddComponent<PixelPerfectCamera>();
            pp.assetsPPU = 1;
            pp.refResolutionX = Stage.W;
            pp.refResolutionY = Stage.H;
            pp.gridSnapping = PixelPerfectCamera.GridSnapping.None;
            pp.cropFrame = PixelPerfectCamera.CropFrame.None;

            var go = new GameObject("Saldo Negro");
            var doc = go.AddComponent<UIDocument>();
            doc.panelSettings = panel;
            go.AddComponent<SaldoNegroApp>();

            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            if (!EditorSceneManager.SaveScene(scene, ScenePath)) return "ERROR: no se pudo guardar " + ScenePath;
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            // La escena de ejemplo de la plantilla ya no hace falta
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>("Assets/Scenes/SampleScene.unity") != null) AssetDatabase.DeleteAsset("Assets/Scenes/SampleScene.unity");
            if (AssetDatabase.IsValidFolder("Assets/Scenes") && AssetDatabase.FindAssets("", new[] { "Assets/Scenes" }).Length == 0) AssetDatabase.DeleteAsset("Assets/Scenes");
            AssetDatabase.SaveAssets();
            return "Escena guardada en " + ScenePath + " (cámara ortográfica con Pixel Perfect Camera " + pp.refResolutionX + "x" + pp.refResolutionY + ", panel " + PanelPath + ")";
        }

        static PanelSettings EnsurePanelSettings()
        {
            AssetDatabase.ImportAsset(ThemePath);
            var theme = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(ThemePath);
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelPath);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(panel, PanelPath);
            }
            // Un píxel del panel = un píxel de pantalla: la escala del escenario la pone Stage, como en la web
            panel.scaleMode = PanelScaleMode.ConstantPixelSize;
            panel.scale = 1f;
            panel.themeStyleSheet = theme;
            panel.clearColor = false;
            panel.clearDepthStencil = true;
            panel.sortingOrder = 0;
            panel.targetTexture = null;
            EditorUtility.SetDirty(panel);
            return panel;
        }
    }
}
