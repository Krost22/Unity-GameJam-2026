// Una función de filter de CSS (Filter Effects 1) como filtro propio de UI Toolkit: brightness, saturate, grayscale
// y contrast con las matrices del navegador, en los valores sRGB (el navegador no pasa estos filtros a lineal).
// UI Toolkit aplica cada función de la lista en su propia pasada sobre una textura de 8 bits, así que entre una y
// otra el color queda recortado a 0..1, como en el navegador. El color llega premultiplicado: las matrices son
// lineales y se aplican igual; el desplazamiento de contrast se multiplica por la alfa.
// Basado en la plantilla de filtros propios de Unity (ui-toolkit-manual-code-examples, Swirl.shader).
Shader "Hidden/SaldoNegro/CssFilter"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Kind ("Kind", Float) = 0
        _Amount ("Amount", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Blend One Zero
        ZWrite Off
        ZTest Always
        Cull Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _UIE_OUTPUT_LINEAR

            #include "UnityCG.cginc"
            #include "UnityUIEFilter.cginc"

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;
            float _Kind;    // 0 brightness, 1 saturate, 2 grayscale, 3 contrast
            float _Amount;

            v2f vert (FilterVertexInput v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                return o;
            }

            float4 frag (v2f i) : SV_Target
            {
                float4 col = tex2D(_MainTex, i.uv);
                float3 c = col.rgb;
                float a = col.a;
                float s = _Amount;
                if (_Kind < 0.5)
                {
                    c = c * s;
                }
                else if (_Kind < 2.5)
                {
                    // saturate(s) con 0.213/0.715/0.072; grayscale(g) con 0.2126/0.7152/0.0722 y s = 1 - g
                    float3 w = _Kind < 1.5 ? float3(0.213, 0.715, 0.072) : float3(0.2126, 0.7152, 0.0722);
                    if (_Kind >= 1.5) s = 1.0 - saturate(s);
                    float3x3 m = float3x3(
                        w.r + (1.0 - w.r) * s, w.g - w.g * s,         w.b - w.b * s,
                        w.r - w.r * s,         w.g + (1.0 - w.g) * s, w.b - w.b * s,
                        w.r - w.r * s,         w.g - w.g * s,         w.b + (1.0 - w.b) * s);
                    c = mul(m, c);
                }
                else
                {
                    c = c * s + (0.5 - 0.5 * s) * a;
                }
                c = clamp(c, 0.0, a);

                #if _UIE_OUTPUT_LINEAR
                c = GammaToLinearSpace(c);
                #endif
                return float4(c, a);
            }
            ENDCG
        }
    }
}
