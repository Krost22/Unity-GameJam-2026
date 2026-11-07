// Bus de eventos: los sistemas se comunican emitiendo eventos en vez de llamarse entre sí,
// así se evitan referencias circulares (economía -> UI -> efectos -> narrativa...).
(function (SN) {
  'use strict';
  const handlers = new Map();

  SN.Events = {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
      return () => this.off(type, fn);
    },
    off(type, fn) {
      const list = handlers.get(type);
      if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }
    },
    emit(type, data) {
      const list = handlers.get(type);
      if (!list) return;
      for (const fn of list.slice()) {
        try { fn(data); } catch (e) { console.error(`[evento ${type}]`, e); }
      }
    },
  };
})(window.SN);
