// El sonido en Unity (lo que en la web hace el navegador):
//   · efectos: SN.Audio.sfx(nombre, opciones) -> Sfx (Draw/Audio, port de js/systems/audio.js) los sintetiza a
//     48 kHz con la tonalidad de la música que suena (master 0.7 y compresor incluidos) -> AudioClip -> un
//     AudioSource libre;
//   · capas de la música hechas con síntesis (el pulso a tempo): igual, con el volumen de la música (layerLevel);
//   · música: los <audio> de js/systems/music.js son UnityAudioEl: un AudioSource con su MP3 de
//     Resources/SaldoNegro/Music (copias de Musics/ de la web). playbackRate es pitch (la cinta se frena y se
//     vuelve más grave, como con preservesPitch = false en la web).
// Si algo falla, no suena y ya está (como la web sin AudioContext).
using System;
using System.Collections.Generic;
using SaldoNegro.Logic;
using UnityEngine;

namespace SaldoNegro
{
    public sealed class UnityAudio
    {
        readonly GameObject host;
        readonly List<AudioSource> pool = new List<AudioSource>();
        readonly Sfx synth = new Sfx();
        double layerGain = 0;
        const int RATE = 48000;

        public UnityAudio(GameObject host) { this.host = host; }

        public void attach()
        {
            Dom.audioFactory = () => new UnityAudioEl(host);
            SN.Audio.backend = (name, opts) => play(synth.renderFull(name, opts, key()), 1, "sfx " + name);
            SN.Audio.musicBackend = (what, arg) =>
            {
                if (what.StartsWith("layer:")) { if (layerGain > 0) play(synth.renderLayer(what.Substring(6), arg, key()), (float)layerGain, what); }
                else if (what == "layerLevel") layerGain = arg.num;
            };
        }

        SfxKey key()
        {
            V k = SN.Music != null ? SN.Music.tonality() : V.@null;
            if (k.isNullish) return Sfx.DefaultKey;
            var sc = new List<double>();
            foreach (var x in k["scale"]) sc.Add(x.num);
            return new SfxKey(k["root"].num, sc.ToArray(), k["rate"].num);
        }

        void play(float[] samples, float gain, string name)
        {
            if (samples == null || samples.Length == 0) return;
            AudioSource src = null;
            foreach (var s in pool) if (!s.isPlaying) { src = s; break; }
            if (src == null) { src = host.AddComponent<AudioSource>(); src.playOnAwake = false; pool.Add(src); }
            if (src.clip != null) UnityEngine.Object.Destroy(src.clip);
            var clip = AudioClip.Create(name, samples.Length, 1, RATE, false);
            clip.SetData(samples, 0);
            src.clip = clip;
            src.volume = Mathf.Clamp01(gain);
            src.Play();
        }
    }

    // Un <audio> de la web hecho con un AudioSource
    public sealed class UnityAudioEl : IAudioEl
    {
        readonly AudioSource a;
        string srcPath;
        bool failed, wasPlaying, userPaused = true;
        public Action onError { get; set; }

        public UnityAudioEl(GameObject host) { a = host.AddComponent<AudioSource>(); a.playOnAwake = false; a.volume = 1; }

        // "Musics/Background.mp3" -> Resources/SaldoNegro/Music/Background
        public string src
        {
            get { return srcPath; }
            set
            {
                srcPath = value;
                string file = Uri.UnescapeDataString(value ?? "");
                int slash = file.LastIndexOf('/');
                if (slash >= 0) file = file.Substring(slash + 1);
                int dot = file.LastIndexOf('.');
                if (dot > 0) file = file.Substring(0, dot);
                var clip = Resources.Load<AudioClip>("SaldoNegro/Music/" + file);
                if (clip == null) { failed = true; Debug.LogWarning("SALDO NEGRO: no encuentro la pista " + value); onError?.Invoke(); return; }
                a.clip = clip;
            }
        }
        public double volume { get { return a.volume; } set { a.volume = Mathf.Clamp01((float)value); } }
        public bool loop { get { return a.loop; } set { a.loop = value; } }
        public bool muted { get { return a.mute; } set { a.mute = value; } }
        public bool preservesPitch { get; set; } = true;
        public double playbackRate { get { return a.pitch; } set { a.pitch = (float)value; } }
        public double currentTime
        {
            get { return a.clip != null ? a.time : 0; }
            set { if (a.clip != null) a.time = Mathf.Clamp((float)value, 0, Math.Max(0, a.clip.length - 0.001f)); }
        }
        public double duration { get { return a.clip != null && a.clip.loadState == AudioDataLoadState.Loaded ? a.clip.length : double.NaN; } }
        public bool paused { get { return userPaused; } }
        // Acabó: estaba sonando, no está en bucle, ya no suena y no se pausó a mano
        public bool ended { get { return !userPaused && !a.loop && !a.isPlaying && a.clip != null && (wasPlaying || a.time <= 0.0001f); } }
        public int readyState { get { return failed || a.clip == null ? 0 : a.clip.loadState == AudioDataLoadState.Loaded ? 4 : 1; } }
        public void play()
        {
            if (a.clip == null) return;
            if (a.clip.loadState == AudioDataLoadState.Unloaded) a.clip.LoadAudioData();
            userPaused = false; wasPlaying = true;
            a.Play();
        }
        public void pause() { userPaused = true; a.Pause(); }
    }
}
