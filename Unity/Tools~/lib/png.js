// PNG mínimo sin dependencias (solo zlib de Node): leer y escribir imágenes RGBA de 8 bits.
// Sirve para comparar las capturas de la web (Chrome) con las de Unity píxel a píxel.
'use strict';
const zlib = require('zlib');
const fs = require('fs');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// { width, height, data: Uint8Array RGBA (fila 0 arriba) } -> Buffer PNG
function encode(img) {
  const { width: w, height: h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Buffer PNG (8 bits, gris / RGB / paleta / gris+alfa / RGBA, sin entrelazado) -> { width, height, data RGBA }
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('No es un PNG');
  let p = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), name = buf.toString('latin1', p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') trns = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG no soportado (profundidad ${depth}, entrelazado ${interlace})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error(`PNG: tipo de color ${type} no soportado`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = new Uint8Array(w * h * 4), line = new Uint8Array(stride), prev = new Uint8Array(stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    for (let i = 0; i < stride; i++) {
      const x = raw[q++], a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (type === 6) { out[o] = line[i]; out[o + 1] = line[i + 1]; out[o + 2] = line[i + 2]; out[o + 3] = line[i + 3]; }
      else if (type === 2) { out[o] = line[i]; out[o + 1] = line[i + 1]; out[o + 2] = line[i + 2]; out[o + 3] = 255; }
      else if (type === 0) { out[o] = out[o + 1] = out[o + 2] = line[i]; out[o + 3] = 255; }
      else if (type === 4) { out[o] = out[o + 1] = out[o + 2] = line[i]; out[o + 3] = line[i + 1]; }
      else { const k = line[i]; out[o] = palette[k * 3]; out[o + 1] = palette[k * 3 + 1]; out[o + 2] = palette[k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    }
    prev.set(line);
  }
  return { width: w, height: h, data: out };
}

const read = (file) => decode(fs.readFileSync(file));
const write = (file, img) => fs.writeFileSync(file, encode(img));

// Compara dos imágenes del mismo tamaño. Devuelve cuántos píxeles difieren, la mayor diferencia por canal y,
// si se pide, una imagen de diferencias (lo igual, atenuado; lo distinto, en magenta más o menos fuerte).
function diff(a, b, opts = {}) {
  if (a.width !== b.width || a.height !== b.height) return { sameSize: false, a: `${a.width}x${a.height}`, b: `${b.width}x${b.height}` };
  const n = a.width * a.height, tol = opts.tolerance || 0;
  let count = 0, max = 0, over = 0, first = null;
  const hist = {};
  const out = opts.image ? new Uint8Array(n * 4) : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]), opts.alpha ? Math.abs(a.data[o + 3] - b.data[o + 3]) : 0);
    if (d) { count++; hist[d] = (hist[d] || 0) + 1; if (d > max) max = d; if (d > tol) { over++; if (!first) first = { x: i % a.width, y: (i / a.width) | 0, a: [...a.data.subarray(o, o + 4)], b: [...b.data.subarray(o, o + 4)] }; } }
    if (out) {
      if (d > tol) { out[o] = 255; out[o + 1] = 0; out[o + 2] = 255; out[o + 3] = 255; }
      else if (d) { out[o] = 255; out[o + 1] = 200; out[o + 2] = 0; out[o + 3] = 255; }
      else { const g = (a.data[o] * 77 + a.data[o + 1] * 150 + a.data[o + 2] * 29) >> 10; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255; }
    }
  }
  return { sameSize: true, pixels: n, different: count, overTolerance: over, maxDelta: max, histogram: hist, first, image: out ? { width: a.width, height: a.height, data: out } : null };
}

// Reduce una imagen por un factor entero promediando cada bloque (para dar la cifra a 320x180)
function downscale(img, k) {
  const w = Math.floor(img.width / k), h = Math.floor(img.height / k), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += img.data[((y * k + j) * img.width + x * k + i) * 4 + c];
    out[(y * w + x) * 4 + c] = Math.round(s / (k * k));
  }
  return { width: w, height: h, data: out };
}

module.exports = { encode, decode, read, write, diff, downscale };
