// PNG mínimo (sin compresión real: zlib "stored") para ver port | Chrome | diferencias lado a lado, ampliado x4.
using System;
using System.IO;

public static class Png
{
    public static void Save(string path, byte[] a, byte[] b, int w, int h, int z = 4)
    {
        int W = w * 3 + 4, H = h;
        var img = new byte[W * H * 4];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
        {
            int o = (y * w + x) * 4;
            for (int k = 0; k < 4; k++) { img[(y * W + x) * 4 + k] = a[o + k]; img[(y * W + x + w + 2) * 4 + k] = b[o + k]; }
            int d = 0; for (int k = 0; k < 4; k++) d = Math.Max(d, Math.Abs(a[o + k] - b[o + k]));
            int q = (y * W + x + 2 * w + 4) * 4;
            img[q] = (byte)(d > 0 ? 255 : 0); img[q + 1] = (byte)(d > 0 ? Math.Max(0, 255 - d * 8) : 40); img[q + 2] = 0; img[q + 3] = 255;
        }
        Write(path, img, W, H, z);
    }
    public static void Write(string path, byte[] rgba, int w, int h, int z)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
        int W = w * z, H = h * z;
        var raw = new MemoryStream();
        for (int y = 0; y < H; y++) { raw.WriteByte(0); for (int x = 0; x < W; x++) raw.Write(rgba, ((y / z) * w + x / z) * 4, 4); }
        var data = raw.ToArray();
        var z1 = new MemoryStream();
        z1.WriteByte(0x78); z1.WriteByte(0x01);
        int pos = 0;
        while (pos < data.Length) { int n = Math.Min(65535, data.Length - pos); bool last = pos + n >= data.Length; z1.WriteByte((byte)(last ? 1 : 0)); z1.WriteByte((byte)n); z1.WriteByte((byte)(n >> 8)); z1.WriteByte((byte)~n); z1.WriteByte((byte)(~n >> 8)); z1.Write(data, pos, n); pos += n; }
        uint s1 = 1, s2 = 0; foreach (var bt in data) { s1 = (s1 + bt) % 65521; s2 = (s2 + s1) % 65521; }
        uint ad = (s2 << 16) | s1; z1.WriteByte((byte)(ad >> 24)); z1.WriteByte((byte)(ad >> 16)); z1.WriteByte((byte)(ad >> 8)); z1.WriteByte((byte)ad);
        using (var f = File.Create(path))
        {
            f.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }, 0, 8);
            var hdr = new byte[13]; BE(hdr, 0, (uint)W); BE(hdr, 4, (uint)H); hdr[8] = 8; hdr[9] = 6;
            Chunk(f, "IHDR", hdr); Chunk(f, "IDAT", z1.ToArray()); Chunk(f, "IEND", new byte[0]);
        }
    }
    static void BE(byte[] b, int o, uint v) { b[o] = (byte)(v >> 24); b[o + 1] = (byte)(v >> 16); b[o + 2] = (byte)(v >> 8); b[o + 3] = (byte)v; }
    static void Chunk(Stream f, string type, byte[] d)
    {
        var len = new byte[4]; BE(len, 0, (uint)d.Length); f.Write(len, 0, 4);
        var td = new byte[4 + d.Length]; for (int i = 0; i < 4; i++) td[i] = (byte)type[i]; Array.Copy(d, 0, td, 4, d.Length);
        f.Write(td, 0, td.Length);
        uint c = 0xFFFFFFFF; foreach (var bt in td) { c ^= bt; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? (c >> 1) ^ 0xEDB88320u : c >> 1; }
        var cb = new byte[4]; BE(cb, 0, ~c); f.Write(cb, 0, 4);
    }
}
