// Dónde se guarda la partida (lo que en la web es localStorage):
//   · WebGL: el localStorage del navegador, con las mismas claves que la web (Plugins/WebGL/SaldoNegroStorage.jslib);
//   · el resto: un archivo por clave en Application.persistentDataPath.
// Como en js/systems/save.js, nunca rompe el juego: si falla, no guarda (y lo dice en la consola).
using System;
using System.IO;
using System.Runtime.InteropServices;
using SaldoNegro.Logic;
using UnityEngine;

namespace SaldoNegro
{
    public static class Storage
    {
        public static IStorage Create()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new BrowserStorage();
#else
            return new FileStorage(Path.Combine(Application.persistentDataPath, "saves"));
#endif
        }
    }

    public sealed class FileStorage : IStorage
    {
        readonly string dir;
        public FileStorage(string dir) { this.dir = dir; }
        string file(string key) { return Path.Combine(dir, key + ".json"); }
        public string getItem(string key)
        {
            try { var f = file(key); return File.Exists(f) ? File.ReadAllText(f) : null; }
            catch (Exception e) { Debug.LogWarning("SALDO NEGRO: no se pudo leer " + key + ": " + e.Message); return null; }
        }
        public void setItem(string key, string value)
        {
            try
            {
                Directory.CreateDirectory(dir);
                var f = file(key);
                File.WriteAllText(f + ".tmp", value);
                if (File.Exists(f)) File.Delete(f);
                File.Move(f + ".tmp", f); // (casi atómico: un corte a medias no deja un archivo roto)
            }
            catch (Exception e) { Debug.LogWarning("SALDO NEGRO: no se pudo guardar " + key + ": " + e.Message); }
        }
        public void removeItem(string key)
        {
            try { var f = file(key); if (File.Exists(f)) File.Delete(f); }
            catch (Exception e) { Debug.LogWarning("SALDO NEGRO: no se pudo borrar " + key + ": " + e.Message); }
        }
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    public sealed class BrowserStorage : IStorage
    {
        [DllImport("__Internal")] static extern IntPtr SN_StorageGet(string key);
        [DllImport("__Internal")] static extern int SN_StorageSet(string key, string value);
        [DllImport("__Internal")] static extern void SN_StorageRemove(string key);
        [DllImport("__Internal")] static extern void SN_Free(IntPtr p);
        public string getItem(string key)
        {
            var p = SN_StorageGet(key);
            if (p == IntPtr.Zero) return null;
            try { return Marshal.PtrToStringUTF8(p); } finally { SN_Free(p); }
        }
        public void setItem(string key, string value) { SN_StorageSet(key, value); }
        public void removeItem(string key) { SN_StorageRemove(key); }
    }
#endif
}
