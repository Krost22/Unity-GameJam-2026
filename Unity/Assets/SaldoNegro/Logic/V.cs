// V: un valor de JavaScript (undefined, null, número, texto, booleano, objeto, array o función).
// La partida, los datos y los mensajes del juego son objetos de JS a los que el código va añadiendo campos;
// con V el port los maneja igual: run["capital"] += 5, if (run["position"]) ..., run["debt"]["paid"] = true.
// Reglas (iguales que en JS):
//   · leer un campo que no existe da undefined (V.undefined, nunca el null de C#; aun así, un null de C# se
//     trata como undefined);
//   · if (v), !v, a || b y a && b siguen la "verdad" de JS (0, "", null, undefined y NaN son falsos)
//     y || / && devuelven uno de los dos valores, no un booleano;
//   · a + b concatena si alguno es texto; si no, suma números;
//   · == es el === de JS (los objetos se comparan por identidad). Para "x == null" de JS: x.isNullish.
// V es una clase (como en JS, todo se pasa por referencia): así run["debt"]["amount"] = 5 funciona.
using System;
using System.Collections;
using System.Collections.Generic;

namespace SaldoNegro.Logic
{
    // Una función de JS guardada como valor (por ejemplo, el "effect" de una mejora)
    public delegate V JsFn(params V[] args);

    public sealed class V : IEquatable<V>, IEnumerable<V>
    {
        // Etiquetas de los tipos que no tienen objeto propio
        sealed class Tag { public readonly string name; public Tag(string n) { name = n; } public override string ToString() { return name; } }
        static readonly Tag NUM = new Tag("number"), NULL = new Tag("null"), TRUE = new Tag("true"), FALSE = new Tag("false"), UNDEF = new Tag("undefined");

        public readonly object o;
        public readonly double n;

        V(object o, double n) { this.o = o; this.n = n; }

        public static readonly V undefined = new V(UNDEF, 0);
        public static readonly V @null = new V(NULL, 0);
        public static readonly V @true = new V(TRUE, 0);
        public static readonly V @false = new V(FALSE, 0);
        public static readonly V NaN = new V(NUM, double.NaN);
        public static readonly V Infinity = new V(NUM, double.PositiveInfinity);

        // Enteros pequeños ya creados (los más usados: contadores, índices, días...)
        static readonly V[] SMALL = makeSmall();
        static V[] makeSmall() { var a = new V[1153]; for (int k = 0; k < a.Length; k++) a[k] = new V(NUM, k - 128); return a; }
        static V number(double x)
        {
            if (x >= -128 && x <= 1024 && x == Math.Floor(x) && !(x == 0 && BitConverter.DoubleToInt64Bits(x) != 0)) return SMALL[(int)x + 128];
            return new V(NUM, x);
        }
        // Un null de C# cuenta como undefined
        static V u(V v) { return (object)v == null ? undefined : v; }
        static double N(V v) { return (object)v == null ? double.NaN : v.num; }

        // ---------- Crear ----------
        public static implicit operator V(double x) { return number(x); }
        public static implicit operator V(int x) { return number(x); }
        public static implicit operator V(long x) { return number(x); }
        public static implicit operator V(bool x) { return x ? @true : @false; }
        public static implicit operator V(string x) { return x == null ? @null : new V(x, 0); }
        public static implicit operator V(JsObject x) { return x == null ? @null : new V(x, 0); }
        public static implicit operator V(JsArray x) { return x == null ? @null : new V(x, 0); }
        public static implicit operator V(JsFn x) { return x == null ? @null : new V(x, 0); }
        // Cualquier otro objeto de C# (un lienzo, un elemento de la interfaz...) guardado tal cual
        public static V wrap(object x) { return x == null ? @null : x is V v ? v : new V(x, 0); }

        // ---------- Tipo ----------
        public bool isUndefined { get { return ReferenceEquals(o, UNDEF); } }
        public bool isNull { get { return ReferenceEquals(o, NULL); } }
        public bool isNullish { get { return ReferenceEquals(o, UNDEF) || ReferenceEquals(o, NULL); } } // x == null en JS
        public bool isNumber { get { return ReferenceEquals(o, NUM); } }
        public bool isString { get { return o is string; } }
        public bool isBool { get { return ReferenceEquals(o, TRUE) || ReferenceEquals(o, FALSE); } }
        public bool isObject { get { return o is JsObject; } }
        public bool isArray { get { return o is JsArray; } }
        public bool isFunction { get { return o is JsFn; } }
        // typeof
        public string type
        {
            get
            {
                if (ReferenceEquals(o, UNDEF)) return "undefined";
                if (ReferenceEquals(o, NUM)) return "number";
                if (o is string) return "string";
                if (isBool) return "boolean";
                if (o is JsFn) return "function";
                return "object";
            }
        }

        // ---------- Leer ----------
        // Verdad de JS
        public bool truthy
        {
            get
            {
                if (ReferenceEquals(o, UNDEF) || ReferenceEquals(o, NULL) || ReferenceEquals(o, FALSE)) return false;
                if (ReferenceEquals(o, NUM)) return n != 0 && !double.IsNaN(n);
                if (o is string s) return s.Length > 0;
                return true;
            }
        }
        // Number(x)
        public double num
        {
            get
            {
                if (ReferenceEquals(o, NUM)) return n;
                if (ReferenceEquals(o, UNDEF)) return double.NaN;
                if (ReferenceEquals(o, NULL) || ReferenceEquals(o, FALSE)) return 0;
                if (ReferenceEquals(o, TRUE)) return 1;
                if (o is string s) return JsNumber.fromString(s);
                if (o is JsArray a) { if (a.length == 0) return 0; if (a.length == 1) return a[0].num; }
                return double.NaN;
            }
        }
        public int i { get { return (int)num; } }
        // String(x)
        public string str { get { return Js.String(this); } }
        public JsObject obj { get { return o as JsObject; } }
        public JsArray arr { get { return o as JsArray; } }
        public JsFn fn { get { return o as JsFn; } }
        public T as_<T>() where T : class { return o as T; }

        public static implicit operator double(V v) { return N(v); }

        // Propiedades: obj["clave"], arr[3], arr["length"], texto["length"]
        public V this[string key]
        {
            get
            {
                if (o is JsObject ob) return ob[key];
                if (o is JsArray a) { if (key == "length") return a.length; return JsObject.isIndex(key, out uint k) ? a[(int)k] : undefined; }
                if (o is string s) { if (key == "length") return s.Length; return undefined; }
                if (isNullish) throw new NullReferenceException("No se puede leer '" + key + "' de " + type);
                return undefined;
            }
            set
            {
                if (o is JsObject ob) { ob[key] = value; return; }
                if (o is JsArray a && JsObject.isIndex(key, out uint k)) { a[(int)k] = value; return; }
                throw new InvalidOperationException("No se puede escribir '" + key + "' en " + type);
            }
        }
        public V this[V key]
        {
            get
            {
                key = u(key);
                if (key.isNumber && o is JsArray a) return a[(int)key.n];
                if (key.isNumber && o is string s) { int k = (int)key.n; return k >= 0 && k < s.Length ? (V)s[k].ToString() : undefined; }
                return this[key.str];
            }
            set { key = u(key); if (key.isNumber && o is JsArray a) { a[(int)key.n] = value; return; } this[key.str] = value; }
        }
        public V this[int index]
        {
            get { if (o is JsArray a) return a[index]; if (o is string s) return index >= 0 && index < s.Length ? (V)s[index].ToString() : undefined; return this[index.ToString()]; }
            set { if (o is JsArray a) { a[index] = value; return; } this[index.ToString()] = value; }
        }
        public V length { get { return this["length"]; } }

        // ¿Tiene esa propiedad? ('k' in obj)
        public bool has(string key) { return o is JsObject ob && ob.has(key); }
        // delete obj.k
        public bool delete(string key) { return !(o is JsObject ob) || ob.delete(key); }

        // Llamar a una función guardada
        public V call(params V[] args) { if (o is JsFn f) return f(args); throw new InvalidOperationException("No es una función: " + type); }

        // ---------- Verdad, ||, && y ! ----------
        public static bool operator true(V v) { return (object)v != null && v.truthy; }
        public static bool operator false(V v) { return (object)v == null || !v.truthy; }
        public static bool operator !(V v) { return (object)v == null || !v.truthy; }
        // (C# convierte a || b en: a es verdad ? a : a | b; y a && b en: a es falso ? a : a & b)
        public static V operator |(V a, V b) { a = u(a); return a.truthy ? a : u(b); }
        public static V operator &(V a, V b) { a = u(a); return a.truthy ? u(b) : a; }

        // ---------- Aritmética ----------
        public static V operator +(V a, V b)
        {
            a = u(a); b = u(b);
            if (a.isNumber && b.isNumber) return a.n + b.n;
            var pa = a.prim; var pb = b.prim;
            if (pa.isString || pb.isString) return pa.str + pb.str;
            return pa.num + pb.num;
        }
        public static V operator +(V a, double b) { a = u(a); if (a.isNumber) return a.n + b; return a + (V)b; }
        public static V operator +(double a, V b) { b = u(b); if (b.isNumber) return a + b.n; return (V)a + b; }
        public static V operator +(V a, int b) { return a + (double)b; }
        public static V operator +(int a, V b) { return (double)a + b; }
        public static string operator +(V a, string b) { return u(a).prim.str + b; }
        public static string operator +(string a, V b) { return a + u(b).prim.str; }
        public static V operator -(V a, V b) { return N(a) - N(b); }
        public static V operator -(V a, double b) { return N(a) - b; }
        public static V operator -(double a, V b) { return a - N(b); }
        public static V operator -(V a, int b) { return N(a) - b; }
        public static V operator -(int a, V b) { return a - N(b); }
        public static V operator *(V a, V b) { return N(a) * N(b); }
        public static V operator *(V a, double b) { return N(a) * b; }
        public static V operator *(double a, V b) { return a * N(b); }
        public static V operator *(V a, int b) { return N(a) * b; }
        public static V operator *(int a, V b) { return a * N(b); }
        public static V operator /(V a, V b) { return N(a) / N(b); }
        public static V operator /(V a, double b) { return N(a) / b; }
        public static V operator /(double a, V b) { return a / N(b); }
        public static V operator /(V a, int b) { return N(a) / b; }
        public static V operator /(int a, V b) { return a / N(b); }
        public static V operator %(V a, V b) { return JsMath.mod(N(a), N(b)); }
        public static V operator %(V a, double b) { return JsMath.mod(N(a), b); }
        public static V operator %(V a, int b) { return JsMath.mod(N(a), b); }
        public static V operator -(V a) { return -N(a); }
        public static V operator +(V a) { return N(a); }
        public static V operator ++(V a) { return N(a) + 1; }
        public static V operator --(V a) { return N(a) - 1; }

        // Valor primitivo (para + con objetos: String(obj))
        V prim { get { return o is JsObject || o is JsArray || o is JsFn ? (V)str : this; } }

        // ---------- Igualdad estricta (===) ----------
        public static bool operator ==(V a, V b) { return u(a).Equals(u(b)); }
        public static bool operator !=(V a, V b) { return !u(a).Equals(u(b)); }
        public static bool operator ==(V a, double b) { a = u(a); return a.isNumber && a.n == b; }
        public static bool operator !=(V a, double b) { return !(a == b); }
        public static bool operator ==(double a, V b) { return b == a; }
        public static bool operator !=(double a, V b) { return !(b == a); }
        public static bool operator ==(V a, int b) { a = u(a); return a.isNumber && a.n == b; }
        public static bool operator !=(V a, int b) { return !(a == b); }
        public static bool operator ==(int a, V b) { return b == a; }
        public static bool operator !=(int a, V b) { return !(b == a); }
        // (x == null: cierto con el null de JS y también con el de C#, para que comprobar un parámetro opcional no falle)
        public static bool operator ==(V a, string b) { if (b == null) return (object)a == null || a.isNull; return a.o is string s && s == b; }
        public static bool operator !=(V a, string b) { return !(a == b); }
        public static bool operator ==(V a, bool b) { a = u(a); return b ? ReferenceEquals(a.o, TRUE) : ReferenceEquals(a.o, FALSE); }
        public static bool operator !=(V a, bool b) { return !(a == b); }

        public bool Equals(V b)
        {
            b = u(b);
            if (ReferenceEquals(o, NUM)) return ReferenceEquals(b.o, NUM) && n == b.n;
            if (o is string s) return b.o is string t && s == t;
            return ReferenceEquals(o, b.o);
        }
        public override bool Equals(object obj) { return obj is V v && Equals(v); }
        public override int GetHashCode()
        {
            if (ReferenceEquals(o, NUM)) return n.GetHashCode();
            return o.GetHashCode();
        }
        public override string ToString() { return Js.String(this); }

        // Recorrer un array (for...of); un texto, por puntos de código
        public IEnumerator<V> GetEnumerator()
        {
            if (o is JsArray a) { for (int k = 0; k < a.length; k++) yield return a[k]; yield break; }
            if (o is string s) { foreach (var ch in JsString.codePoints(s)) yield return ch; yield break; }
            if (isNullish) throw new NullReferenceException("No se puede recorrer " + type);
            throw new InvalidOperationException("No se puede recorrer " + type);
        }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }

        // Atajos para crear objetos y arrays: V.Obj("a", 1, "b", "x"), V.Arr(1, 2, 3)
        public static V Obj(params V[] kv)
        {
            var ob = new JsObject();
            for (int k = 0; k + 1 < kv.Length; k += 2) ob[kv[k].str] = kv[k + 1];
            return ob;
        }
        public static V Arr(params V[] items) { return new JsArray(items); }
    }
}
