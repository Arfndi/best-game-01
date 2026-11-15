// Ember Orbit — synthesized sound.
// No audio files ship with the game: every sound is a small WebAudio patch built at
// runtime (oscillators, filtered noise, gain envelopes). The context is created lazily
// on the first user gesture, so browsers never block it, and the screenshot scenes
// never create one at all.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  /** Create the context. Call from a user gesture; safe to call twice. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  /** A short tone with a pitch glide and an exponential fade. */
  tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** A burst of filtered noise (whooshes, thuds, shimmer). */
  noise(seconds, filterFreq, volume, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  /** The launch whoosh: rising noise as the ember leaves. */
  launch() {
    this.noise(0.35, 2400, 0.5);
    this.tone(180, 520, 0.3, 'sine', 0.25);
  }

  /** A shard pickup: a bright two-note chime, higher with the combo. */
  shard(combo) {
    const base = 660 * Math.pow(1.059, Math.min(combo, 8));
    this.tone(base, base, 0.12, 'sine', 0.4);
    this.tone(base * 1.5, base * 1.5, 0.18, 'sine', 0.35, 0.07);
  }

  /** A crash: a low thud and a falling tone. */
  crash() {
    this.noise(0.4, 300, 0.7);
    this.tone(160, 40, 0.45, 'triangle', 0.5);
  }

  /** A level cleared: a rising four-note arpeggio. */
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, n, 0.22, 'sine', 0.35, i * 0.09));
  }

  /** Game over: three descending notes. */
  lose() {
    const notes = [392, 311.13, 233.08];
    notes.forEach((n, i) => this.tone(n, n * 0.94, 0.3, 'triangle', 0.3, i * 0.14));
  }

  /** A UI click. */
  click() {
    this.tone(880, 880, 0.06, 'square', 0.12);
  }
}
