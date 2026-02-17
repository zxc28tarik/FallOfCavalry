/**
 * FallOfCavalry - Audio System
 * Music ve SFX yönetimi
 */

const audioWarningState = {
  emitted: new Set(),
};

function warnOnce(key, message) {
  if (audioWarningState.emitted.has(key)) return;
  audioWarningState.emitted.add(key);
  console.warn(message);
}

export class AudioSystem {
  constructor(settings = {}) {
    this.settings = settings;
    this.context = null;
    this.enabled = true;
    this.musicVolume = Number.isFinite(settings.music) ? settings.music : 0.5;
    this.sfxVolume = Number.isFinite(settings.sfx) ? settings.sfx : 0.8;
    this.activeSounds = new Set();
  }

  getAudioContextCtor() {
    const ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return typeof ctor === 'function' ? ctor : null;
  }

  init() {
    if (!this.enabled) return false;
    if (this.context) return true;

    const AudioContextCtor = this.getAudioContextCtor();
    if (!AudioContextCtor) {
      warnOnce('audio:missing-context', '[AudioSystem] AudioContext unavailable');
      this.enabled = false;
      return false;
    }

    try {
      this.context = new AudioContextCtor();
      return true;
    } catch (err) {
      warnOnce('audio:context-init-failed', '[AudioSystem] AudioContext init failed');
      this.enabled = false;
      return false;
    }
  }

  async ensureContextReady() {
    if (!this.context) return false;
    if (this.context.state !== 'suspended') return true;

    try {
      if (typeof this.context.resume === 'function') {
        await this.context.resume();
      }
      return true;
    } catch (err) {
      warnOnce('audio:resume-failed', '[AudioSystem] Audio resume failed');
      return false;
    }
  }

  createHtmlAudio(src, { loop = false, volume = 1 } = {}) {
    if (typeof globalThis.Audio !== 'function') {
      warnOnce('audio:missing-html-audio', '[AudioSystem] HTMLAudio unavailable');
      return null;
    }

    try {
      const audio = new globalThis.Audio(src);
      audio.loop = Boolean(loop);
      audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
      return audio;
    } catch (err) {
      warnOnce('audio:html-audio-create-failed', '[AudioSystem] HTMLAudio create failed');
      return null;
    }
  }

  async play(src, options = {}) {
    if (!this.enabled || typeof src !== 'string' || !src) return false;

    this.init();

    const type = options.type === 'music' ? 'music' : 'sfx';
    const baseVolume = type === 'music' ? this.musicVolume : this.sfxVolume;
    const volume = Number.isFinite(options.volume) ? options.volume : baseVolume;

    const audio = this.createHtmlAudio(src, {
      loop: options.loop,
      volume,
    });

    if (!audio) return false;

    this.activeSounds.add(audio);

    try {
      await this.ensureContextReady();
      if (typeof audio.play === 'function') {
        await Promise.resolve(audio.play());
      }
      return true;
    } catch (err) {
      warnOnce('audio:play-failed', '[AudioSystem] Audio play failed');
      this.activeSounds.delete(audio);
      return false;
    }
  }

  stopAll() {
    this.activeSounds.forEach((audio) => {
      try {
        if (audio && typeof audio.pause === 'function') {
          audio.pause();
        }
      } catch (err) {
        // no-op
      }
    });
    this.activeSounds.clear();
  }

  setMusicVolume(value) {
    this.musicVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.musicVolume;
    return this.musicVolume;
  }

  setSfxVolume(value) {
    this.sfxVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.sfxVolume;
    return this.sfxVolume;
  }
}

export default AudioSystem;
