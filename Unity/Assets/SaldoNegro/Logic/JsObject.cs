// Objeto y array de JavaScript.
// JsObject: claves de texto recorridas en el MISMO ORDEN que en JS (primero las que son índices enteros, de
// menor a mayor; después el resto, por orden de alta). Una clave que no existe devuelve undefined.
// JsArray: los métodos de Array que usa el juego, con la misma semántica (indexOf/includes por ===, slice,
// splice, sort estable...).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;

namespace SaldoNegro.Logic
{
    public sealed class JsObject : IEnumerable<KeyValuePair<string, V>>
    {
        readonly Dictionary<string, V> map = new Dictionary<string, V>();
        readonly List<string> named = new List<string>();     // claves normales, por orden de alta
        SortedDictionary<uint, string> indexed;               // claves que son índices ("0", "7", "42"...)

        public JsObject() { }

        public V this[string key]
        {
            get { return map.TryGetValue(key, out var v) ? v : V.undefined; }
            set
            {
                if (!map.ContainsKey(key))
                {
                    if (isIndex(key, out var k)) { if (indexed == null) indexed = new SortedDictionary<uint, string>(); indexed[k] = key; }
                    else named.Add(key);
                }
                map[key] = value ?? V.undefined;
            }
        }

        public int Count { get { return map.Count; } }
        public bool has(string key) { return map.ContainsKey(key); }

        // delete obj[key]
        public bool delete(string key)
        {
            if (!map.Remove(key)) return true;
            if (isIndex(key, out var k)) indexed.Remove(k); else named.Remove(key);
            return true;
        }

        // Object.keys(obj)
        public List<string> keys()
        {
            var list = new List<string>(map.Count);
            if (indexed != null) foreach (var k in indexed.Values) list.Add(k);
            list.AddRange(named);
            return list;
        }
        public JsArray keysArr() { var a = new JsArray(); foreach (var k in keys()) a.push(k); return a; }
        public JsArray values() { var a = new JsArray(); foreach (var k in keys()) a.push(map[k]); return a; }

        public IEnumerator<KeyValuePair<string, V>> GetEnumerator()
        {
            foreach (var k in keys()) yield return new KeyValuePair<string, V>(k, map[k]);
        }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }

        // Para poder escribir new JsObject { { "a", 1 }, { "b", "x" } }
        public void Add(string key, V value) { this[key] = value; }

        // Object.assign(this, ...fuentes)
        public JsObject assign(params V[] sources)
        {
            foreach (var s in sources) if (s.obj != null) foreach (var kv in s.obj) this[kv.Key] = kv.Value;
            return this;
        }
        // Object.assign({}, a, b...) -> una copia superficial
        public static JsObject Assign(params V[] sources) { return new JsObject().assign(sources); }

        // ¿La clave es un índice de array de JS? ("0" o un entero sin ceros delante, hasta 4294967294)
        public static bool isIndex(string key, out uint n)
        {
            n = 0;
            int len = key.Length;
            if (len == 0 || len > 10) return false;
            if (len > 1 && key[0] == '0') return false;
            ulong v = 0;
            for (int i = 0; i < len; i++)
            {
                char c = key[i];
                if (c < '0' || c > '9') return false;
                v = v * 10 + (ulong)(c - '0');
            }
            if (v > 4294967294UL) return false;
            n = (uint)v;
            return true;
        }
    }

    public sealed class JsArray : IEnumerable<V>
    {
        readonly List<V> list;

        public JsArray() { list = new List<V>(); }
        public JsArray(int capacity) { list = new List<V>(capacity); }
        public JsArray(IEnumerable<V> items) { list = new List<V>(items); }

        public int length { get { return list.Count; } }
        public int Count { get { return list.Count; } }

        public V this[int i]
        {
            get { return i >= 0 && i < list.Count ? list[i] : V.undefined; }
            set
            {
                if (i < 0) throw new ArgumentOutOfRangeException(nameof(i));
                while (list.Count <= i) list.Add(V.undefined);
                list[i] = value ?? V.undefined;
            }
        }

        public void Add(V v) { list.Add(v ?? V.undefined); }
        public IEnumerator<V> GetEnumerator() { return list.GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return list.GetEnumerator(); }
        public List<V> raw { get { return list; } }

        // ---------- Mutadores ----------
        public int push(params V[] items) { list.AddRange(items); return list.Count; }
        public V pop() { if (list.Count == 0) return V.undefined; var v = list[list.Count - 1]; list.RemoveAt(list.Count - 1); return v; }
        public V shift() { if (list.Count == 0) return V.undefined; var v = list[0]; list.RemoveAt(0); return v; }
        public int unshift(params V[] items) { list.InsertRange(0, items); return list.Count; }
        public JsArray splice(int start, int deleteCount = int.MaxValue, params V[] items)
        {
            int len = list.Count;
            if (start < 0) start = Math.Max(0, len + start); else start = Math.Min(start, len);
            deleteCount = Math.Max(0, Math.Min(deleteCount, len - start));
            var removed = new JsArray(list.GetRange(start, deleteCount));
            list.RemoveRange(start, deleteCount);
            list.InsertRange(start, items);
            return removed;
        }
        public JsArray reverse() { list.Reverse(); return this; }
        // sort estable (como en V8), con la comparación de JS (negativo, 0 o positivo)
        public JsArray sort(Func<V, V, double> cmp = null)
        {
            if (cmp == null) cmp = (a, b) => string.CompareOrdinal(JsString.sortKey(a), JsString.sortKey(b));
            var idx = new List<KeyValuePair<int, V>>(list.Count);
            int undef = 0;
            for (int i = 0; i < list.Count; i++) { if (list[i].isUndefined) undef++; else idx.Add(new KeyValuePair<int, V>(i, list[i])); }
            var arr = idx.ToArray();
            mergeSort(arr, (x, y) => { double c = cmp(x.Value, y.Value); if (c < 0) return -1; if (c > 0) return 1; return x.Key.CompareTo(y.Key); });
            list.Clear();
            foreach (var kv in arr) list.Add(kv.Value);
            for (int i = 0; i < undef; i++) list.Add(V.undefined);
            return this;
        }
        static void mergeSort<T>(T[] a, Comparison<T> cmp)
        {
            if (a.Length < 2) return;
            var tmp = new T[a.Length];
            for (int width = 1; width < a.Length; width *= 2)
            {
                for (int lo = 0; lo < a.Length; lo += 2 * width)
                {
                    int mid = Math.Min(lo + width, a.Length), hi = Math.Min(lo + 2 * width, a.Length);
                    int i = lo, j = mid, k = lo;
                    while (i < mid && j < hi) tmp[k++] = cmp(a[j], a[i]) < 0 ? a[j++] : a[i++];
                    while (i < mid) tmp[k++] = a[i++];
                    while (j < hi) tmp[k++] = a[j++];
                }
                Array.Copy(tmp, a, a.Length);
            }
        }
        public JsArray fill(V v, int start = 0, int end = int.MaxValue) { end = Math.Min(end, list.Count); for (int i = start; i < end; i++) list[i] = v; return this; }

        // ---------- Lectura ----------
        public JsArray slice(int start = 0, int end = int.MaxValue)
        {
            int len = list.Count;
            if (start < 0) start = Math.Max(0, len + start); else start = Math.Min(start, len);
            if (end < 0) end = Math.Max(0, len + end); else end = Math.Min(end, len);
            return new JsArray(end > start ? list.GetRange(start, end - start) : new List<V>());
        }
        public int indexOf(V v) { for (int i = 0; i < list.Count; i++) if (list[i] == v) return i; return -1; }
        public int lastIndexOf(V v) { for (int i = list.Count - 1; i >= 0; i--) if (list[i] == v) return i; return -1; }
        // includes usa SameValueZero: NaN se encuentra a sí mismo
        public bool includes(V v) { for (int i = 0; i < list.Count; i++) if (list[i] == v || (v.isNumber && double.IsNaN(v.n) && list[i].isNumber && double.IsNaN(list[i].n))) return true; return false; }
        public V find(Func<V, bool> f) { foreach (var v in list) if (f(v)) return v; return V.undefined; }
        public V find(Func<V, int, bool> f) { for (int i = 0; i < list.Count; i++) if (f(list[i], i)) return list[i]; return V.undefined; }
        public int findIndex(Func<V, bool> f) { for (int i = 0; i < list.Count; i++) if (f(list[i])) return i; return -1; }
        public V findLast(Func<V, bool> f) { for (int i = list.Count - 1; i >= 0; i--) if (f(list[i])) return list[i]; return V.undefined; }
        public bool some(Func<V, bool> f) { foreach (var v in list) if (f(v)) return true; return false; }
        public bool some(Func<V, int, bool> f) { for (int i = 0; i < list.Count; i++) if (f(list[i], i)) return true; return false; }
        public bool every(Func<V, bool> f) { foreach (var v in list) if (!f(v)) return false; return true; }
        public bool every(Func<V, int, bool> f) { for (int i = 0; i < list.Count; i++) if (!f(list[i], i)) return false; return true; }
        public JsArray filter(Func<V, bool> f) { var r = new JsArray(); foreach (var v in list) if (f(v)) r.list.Add(v); return r; }
        public JsArray filter(Func<V, int, bool> f) { var r = new JsArray(); for (int i = 0; i < list.Count; i++) if (f(list[i], i)) r.list.Add(list[i]); return r; }
        // Las mismas con una condición que devuelve un valor de JS (se mira su "verdad"): x => a && b
        public V find(Func<V, V> f) { return find((Func<V, bool>)(v => f(v).truthy)); }
        public int findIndex(Func<V, V> f) { return findIndex((Func<V, bool>)(v => f(v).truthy)); }
        public bool some(Func<V, V> f) { return some((Func<V, bool>)(v => f(v).truthy)); }
        public bool every(Func<V, V> f) { return every((Func<V, bool>)(v => f(v).truthy)); }
        public JsArray filter(Func<V, V> f) { return filter((Func<V, bool>)(v => f(v).truthy)); }
        public JsArray map(Func<V, V> f) { var r = new JsArray(list.Count); foreach (var v in list) r.list.Add(f(v)); return r; }
        public JsArray map(Func<V, int, V> f) { var r = new JsArray(list.Count); for (int i = 0; i < list.Count; i++) r.list.Add(f(list[i], i)); return r; }
        public void forEach(Action<V> f) { for (int i = 0; i < list.Count; i++) f(list[i]); }
        public void forEach(Action<V, int> f) { for (int i = 0; i < list.Count; i++) f(list[i], i); }
        public V reduce(Func<V, V, V> f, V init) { var acc = init; foreach (var v in list) acc = f(acc, v); return acc; }
        public V reduce(Func<V, V, V> f)
        {
            if (list.Count == 0) throw new InvalidOperationException("Reduce of empty array with no initial value");
            var acc = list[0];
            for (int i = 1; i < list.Count; i++) acc = f(acc, list[i]);
            return acc;
        }
        public JsArray flatMap(Func<V, V> f)
        {
            var r = new JsArray();
            foreach (var v in list) { var x = f(v); if (x.isArray) r.list.AddRange(x.arr.list); else r.list.Add(x); }
            return r;
        }
        public JsArray flat()
        {
            var r = new JsArray();
            foreach (var v in list) { if (v.isArray) r.list.AddRange(v.arr.list); else r.list.Add(v); }
            return r;
        }
        public JsArray concat(params V[] others)
        {
            var r = new JsArray(list);
            foreach (var o in others) { if (o.isArray) r.list.AddRange(o.arr.list); else r.list.Add(o); }
            return r;
        }
        public string join(string sep = ",")
        {
            var sb = new StringBuilder();
            for (int i = 0; i < list.Count; i++)
            {
                if (i > 0) sb.Append(sep);
                if (!list[i].isNullish) sb.Append(list[i].str);
            }
            return sb.ToString();
        }
        public override string ToString() { return join(","); }
    }
}
