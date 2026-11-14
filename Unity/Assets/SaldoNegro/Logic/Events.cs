// Port de js/core/events.js. Bus de eventos: los sistemas se comunican emitiendo eventos en vez de llamarse
// entre sí, así se evitan referencias circulares (economía -> UI -> efectos -> narrativa...).
using System;
using System.Collections.Generic;

namespace SaldoNegro.Logic
{
    public sealed class Events
    {
        readonly Dictionary<string, List<Action<V>>> handlers = new Dictionary<string, List<Action<V>>>();

        public Action on(string type, Action<V> fn)
        {
            if (!handlers.TryGetValue(type, out var list)) handlers[type] = list = new List<Action<V>>();
            list.Add(fn);
            return () => off(type, fn);
        }
        public void off(string type, Action<V> fn)
        {
            if (handlers.TryGetValue(type, out var list)) { int i = list.IndexOf(fn); if (i >= 0) list.RemoveAt(i); }
        }
        // Para las pruebas: ve pasar cada evento (con o sin oyentes)
        public Action<string, V> spy;

        public void emit(string type, V data = null)
        {
            data = data ?? V.undefined;
            spy?.Invoke(type, data);
            if (!handlers.TryGetValue(type, out var list)) return;
            foreach (var fn in list.ToArray())
            {
                try { fn(data); } catch (Exception e) { SN.logError("[evento " + type + "] " + e); }
            }
        }
    }
}
