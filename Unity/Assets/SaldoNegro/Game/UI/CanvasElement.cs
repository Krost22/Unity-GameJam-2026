// Un <canvas> en pantalla: enseña un lienzo (Canvas) dentro del panel de UI Toolkit.
// Sin filtrado y sin suavizado: la textura se muestrea por el píxel más cercano, como image-rendering: pixelated.
// El elemento se estira a su caja (el #desk de la web es un lienzo de 320x180 que se ve a 640x360).
using UnityEngine;
using UnityEngine.UIElements;

namespace SaldoNegro
{
    public sealed class CanvasElement : VisualElement
    {
        public Canvas canvas { get; private set; }
        Texture2D tex;
        int uploaded = -1;

        public CanvasElement(Canvas canvas)
        {
            pickingMode = PickingMode.Ignore;
            generateVisualContent += draw;
            setCanvas(canvas);
        }

        public void setCanvas(Canvas c)
        {
            if (c == canvas) return;
            canvas = c;
            if (tex != null && (tex.width != c.width || tex.height != c.height)) { destroy(tex); tex = null; }
            if (tex == null)
            {
                tex = new Texture2D(c.width, c.height, TextureFormat.RGBA32, false)
                {
                    name = "lienzo " + c.width + "x" + c.height,
                    filterMode = FilterMode.Point,
                    wrapMode = TextureWrapMode.Clamp,
                    anisoLevel = 0,
                    hideFlags = HideFlags.HideAndDontSave,
                };
            }
            uploaded = -1;
            upload();
            MarkDirtyRepaint();
        }

        // Sube los píxeles a la tarjeta gráfica si el lienzo ha cambiado. Se llama una vez por fotograma.
        // (El lienzo guarda el color premultiplicado; con lienzos opacos, como la habitación, es lo mismo.
        //  Los lienzos con transparencia se afinan cuando lleguen: fases 4 y 5.)
        public void upload()
        {
            if (canvas == null || uploaded == canvas.version) return;
            tex.SetPixelData(canvas.data, 0);
            tex.Apply(false, false);
            uploaded = canvas.version;
        }

        void draw(MeshGenerationContext mgc)
        {
            var r = contentRect;
            if (tex == null || r.width <= 0 || r.height <= 0) return;
            var mesh = mgc.Allocate(4, 6, tex);
            // La fila 0 del lienzo es la de arriba y es la primera de la textura (v = 0)
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMin, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMin, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 0) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMax, r.yMax, Vertex.nearZ), tint = Color.white, uv = new Vector2(1, 1) });
            mesh.SetNextVertex(new Vertex { position = new Vector3(r.xMin, r.yMax, Vertex.nearZ), tint = Color.white, uv = new Vector2(0, 1) });
            mesh.SetNextIndex(0); mesh.SetNextIndex(1); mesh.SetNextIndex(2);
            mesh.SetNextIndex(2); mesh.SetNextIndex(3); mesh.SetNextIndex(0);
        }

        public void dispose()
        {
            if (tex != null) destroy(tex);
            tex = null;
        }

        static void destroy(Object o)
        {
            if (Application.isPlaying) Object.Destroy(o); else Object.DestroyImmediate(o);
        }
    }
}
