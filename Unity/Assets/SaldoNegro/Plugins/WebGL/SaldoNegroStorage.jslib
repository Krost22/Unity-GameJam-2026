// localStorage del navegador para el build WebGL (las mismas claves que la web: saldonegro.run.v1 y
// saldonegro.profile.v1). Nunca lanza: si el navegador bloquea el almacenamiento, no se guarda y ya está.
mergeInto(LibraryManager.library, {
  SN_StorageGet: function (keyPtr) {
    var v = null;
    try { v = window.localStorage.getItem(UTF8ToString(keyPtr)); } catch (e) { v = null; }
    if (v === null) return 0;
    var size = lengthBytesUTF8(v) + 1;
    var buf = _malloc(size);
    stringToUTF8(v, buf, size);
    return buf;
  },
  SN_StorageSet: function (keyPtr, valuePtr) {
    try { window.localStorage.setItem(UTF8ToString(keyPtr), UTF8ToString(valuePtr)); return 1; } catch (e) { return 0; }
  },
  SN_StorageRemove: function (keyPtr) {
    try { window.localStorage.removeItem(UTF8ToString(keyPtr)); } catch (e) { }
  },
  SN_Free: function (ptr) { _free(ptr); },
});
