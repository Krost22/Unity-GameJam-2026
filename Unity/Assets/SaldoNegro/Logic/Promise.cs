// Las promesas de JavaScript (Promise, async / await) en C#, para que el código asíncrono de la web se porte
// línea a línea: `async Promise foo()`, `await SN.wait(0.6)`, `new Promise(resolve => ...)`, `Promise.race(a, b)`.
// No hay hilos ni Task: todo corre en el hilo del juego, con el mismo orden que en el navegador.
//   · Lo que va detrás de un `await` (o un then) NO se ejecuta en el momento en que se cumple la promesa, sino
//     como MICROTAREA: cuando termina el código que está corriendo. En la web eso pasa al acabar cada fotograma
//     (Game.frame) y cada manejador de un evento de usuario; aquí lo hace quien llama a Microtasks.drain()
//     (el bucle del juego y el reparto de eventos del DOM).
//   · `await` siempre cede el turno, aunque la promesa ya esté cumplida (como en JS).
//   · Una promesa rechazada que nadie espera se avisa por SN.logError ("Uncaught (in promise)").
// Promise es la promesa sin valor; Promise<T> la que devuelve algo (`async Promise<bool> ask()` + `return true;`).
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;

namespace SaldoNegro.Logic
{
    public static class Microtasks
    {
        static readonly Queue<Action> queue = new Queue<Action>();
        static readonly List<PromiseBase> rejected = new List<PromiseBase>();
        static bool draining;

        public static void enqueue(Action a) { queue.Enqueue(a); }
        public static int pending { get { return queue.Count; } }
        internal static void watch(PromiseBase p) { rejected.Add(p); }

        // Ejecuta todas las microtareas pendientes (y las que estas encolen). Lo llama el bucle al acabar cada
        // fotograma y el DOM después de cada manejador de un evento de usuario.
        public static void drain()
        {
            if (draining) return;
            draining = true;
            try
            {
                int guard = 0;
                while (queue.Count > 0)
                {
                    var a = queue.Dequeue();
                    try { a(); } catch (Exception e) { SN.logError("[microtarea] " + e); }
                    if (++guard > 1000000) { queue.Clear(); SN.logError("Microtasks.drain: bucle sin fin de promesas"); break; }
                }
                if (rejected.Count > 0)
                {
                    foreach (var p in rejected) if (!p.handled) SN.logError("Uncaught (in promise) " + p.error);
                    rejected.Clear();
                }
            }
            finally { draining = false; }
        }

        // Empezar de cero (cada SN.Load, como recargar la página)
        public static void reset() { queue.Clear(); rejected.Clear(); draining = false; }
    }

    public abstract class PromiseBase
    {
        internal int state;                 // 0 pendiente, 1 cumplida, 2 rechazada
        public Exception error { get; private set; }
        internal bool handled;
        List<Action> waiting;

        public bool settled { get { return state != 0; } }
        public bool fulfilled { get { return state == 1; } }
        public bool isRejected { get { return state == 2; } }

        protected bool settle(int to, Exception e)
        {
            if (state != 0) return false;   // como en JS: solo vale la primera vez
            state = to; error = e;
            if (to == 2 && !handled) Microtasks.watch(this);
            if (waiting != null) { foreach (var w in waiting) Microtasks.enqueue(w); waiting = null; }
            return true;
        }
        public void reject(Exception e) { settle(2, e ?? new Exception("rechazada")); }

        // Encola `fn` para cuando la promesa quede resuelta (cumplida o rechazada)
        public void onSettled(Action fn)
        {
            handled = true;
            if (state != 0) Microtasks.enqueue(fn);
            else (waiting ?? (waiting = new List<Action>())).Add(fn);
        }
        internal void rethrow() { if (state == 2) ExceptionDispatchInfo.Capture(error).Throw(); }
    }

    [AsyncMethodBuilder(typeof(PromiseBuilder))]
    public sealed class Promise : PromiseBase
    {
        public Promise() { }
        // new Promise((resolve) => { ... })
        public Promise(Action<Action> executor) { try { executor(resolve); } catch (Exception e) { reject(e); } }
        // new Promise((resolve, reject) => { ... })
        public Promise(Action<Action, Action<Exception>> executor) { try { executor(resolve, reject); } catch (Exception e) { reject(e); } }

        public void resolve() { settle(1, null); }

        public Awaiter GetAwaiter() { return new Awaiter(this); }
        public readonly struct Awaiter : ICriticalNotifyCompletion
        {
            readonly Promise p;
            internal Awaiter(Promise p) { this.p = p; }
            public bool IsCompleted { get { return false; } }
            public void OnCompleted(Action c) { p.onSettled(c); }
            public void UnsafeOnCompleted(Action c) { p.onSettled(c); }
            public void GetResult() { p.rethrow(); }
        }

        // p.then(fn) / p.catch(fn) / p.finally(fn)
        public Promise then(Action fn)
        {
            var r = new Promise();
            onSettled(() => { if (state == 2) { r.reject(error); return; } try { fn(); r.resolve(); } catch (Exception e) { r.reject(e); } });
            return r;
        }
        public Promise @catch(Action<Exception> fn)
        {
            var r = new Promise();
            onSettled(() => { if (state == 1) { r.resolve(); return; } try { fn(error); r.resolve(); } catch (Exception e) { r.reject(e); } });
            return r;
        }
        public Promise @finally(Action fn)
        {
            var r = new Promise();
            onSettled(() => { try { fn(); if (state == 2) r.reject(error); else r.resolve(); } catch (Exception e) { r.reject(e); } });
            return r;
        }

        // Promise.resolve()
        public static Promise resolved() { var p = new Promise(); p.resolve(); return p; }
        public static Promise<T> resolved<T>(T value) { var p = new Promise<T>(); p.resolve(value); return p; }
        // Promise.race([...]): la primera que quede resuelta (cumplida o rechazada)
        public static Promise race(params PromiseBase[] ps)
        {
            var r = new Promise();
            foreach (var p in ps) { var q = p; q.onSettled(() => { if (q.isRejected) r.reject(q.error); else r.resolve(); }); }
            return r;
        }
        // Promise.all([...]): cuando se cumplen todas (o en cuanto se rechaza una)
        public static Promise all(params PromiseBase[] ps)
        {
            var r = new Promise();
            int left = ps.Length;
            if (left == 0) { r.resolve(); return r; }
            foreach (var p in ps) { var q = p; q.onSettled(() => { if (q.isRejected) r.reject(q.error); else if (--left == 0) r.resolve(); }); }
            return r;
        }
    }

    [AsyncMethodBuilder(typeof(PromiseBuilder<>))]
    public sealed class Promise<T> : PromiseBase
    {
        public T value { get; private set; }
        public Promise() { }
        // new Promise((resolve) => { ... resolve(valor) ... })
        public Promise(Action<Action<T>> executor) { try { executor(resolve); } catch (Exception e) { reject(e); } }
        public Promise(Action<Action<T>, Action<Exception>> executor) { try { executor(resolve, reject); } catch (Exception e) { reject(e); } }

        public void resolve(T v) { if (state == 0) { value = v; settle(1, null); } }

        public Awaiter GetAwaiter() { return new Awaiter(this); }
        public readonly struct Awaiter : ICriticalNotifyCompletion
        {
            readonly Promise<T> p;
            internal Awaiter(Promise<T> p) { this.p = p; }
            public bool IsCompleted { get { return false; } }
            public void OnCompleted(Action c) { p.onSettled(c); }
            public void UnsafeOnCompleted(Action c) { p.onSettled(c); }
            public T GetResult() { p.rethrow(); return p.value; }
        }

        public Promise then(Action<T> fn)
        {
            var r = new Promise();
            onSettled(() => { if (state == 2) { r.reject(error); return; } try { fn(value); r.resolve(); } catch (Exception e) { r.reject(e); } });
            return r;
        }
        public Promise @catch(Action<Exception> fn)
        {
            var r = new Promise();
            onSettled(() => { if (state == 1) { r.resolve(); return; } try { fn(error); r.resolve(); } catch (Exception e) { r.reject(e); } });
            return r;
        }
    }

    // ---------- Lo que necesita el compilador para `async Promise` y `async Promise<T>` ----------
    public struct PromiseBuilder
    {
        Promise p;
        public static PromiseBuilder Create() { return new PromiseBuilder { p = new Promise() }; }
        public Promise Task { get { return p; } }
        public void Start<TSM>(ref TSM sm) where TSM : IAsyncStateMachine { sm.MoveNext(); }
        public void SetStateMachine(IAsyncStateMachine sm) { }
        public void SetResult() { p.resolve(); }
        public void SetException(Exception e) { p.reject(e); }
        public void AwaitOnCompleted<TA, TSM>(ref TA a, ref TSM sm) where TA : INotifyCompletion where TSM : IAsyncStateMachine
        { IAsyncStateMachine box = sm; a.OnCompleted(box.MoveNext); }
        public void AwaitUnsafeOnCompleted<TA, TSM>(ref TA a, ref TSM sm) where TA : ICriticalNotifyCompletion where TSM : IAsyncStateMachine
        { IAsyncStateMachine box = sm; a.UnsafeOnCompleted(box.MoveNext); }
    }

    public struct PromiseBuilder<T>
    {
        Promise<T> p;
        public static PromiseBuilder<T> Create() { return new PromiseBuilder<T> { p = new Promise<T>() }; }
        public Promise<T> Task { get { return p; } }
        public void Start<TSM>(ref TSM sm) where TSM : IAsyncStateMachine { sm.MoveNext(); }
        public void SetStateMachine(IAsyncStateMachine sm) { }
        public void SetResult(T v) { p.resolve(v); }
        public void SetException(Exception e) { p.reject(e); }
        public void AwaitOnCompleted<TA, TSM>(ref TA a, ref TSM sm) where TA : INotifyCompletion where TSM : IAsyncStateMachine
        { IAsyncStateMachine box = sm; a.OnCompleted(box.MoveNext); }
        public void AwaitUnsafeOnCompleted<TA, TSM>(ref TA a, ref TSM sm) where TA : ICriticalNotifyCompletion where TSM : IAsyncStateMachine
        { IAsyncStateMachine box = sm; a.UnsafeOnCompleted(box.MoveNext); }
    }
}
