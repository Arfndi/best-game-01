// Synthesized sound for Ember Orbit — no audio files, everything is WebAudio.
// The context is created lazily on the first user gesture (browsers block audio
// before that) and every call is guarded, so headless runs stay silent and safe.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  unlock() {
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (this.ctx === null || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  click() {
    this.tone(660, 0.06, 'triangle', 0.3);
  }

  launch() {
    this.tone(180, 0.35, 'sawtooth', 0.25, 520);
  }

  shard(combo) {
    const base = 520 * Math.pow(1.122, Math.min(combo, 12));
    this.tone(base, 0.16, 'sine', 0.5);
    this.tone(base * 2, 0.1, 'sine', 0.2);
  }

  crash() {
    this.tone(140, 0.4, 'sawtooth', 0.5, 40);
  }

  levelWin() {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i += 1) {
      setTimeout(() => this.tone(notes[i], 0.22, 'triangle', 0.4), i * 90);
    }
  }

  gameOver() {
    this.tone(392, 0.3, 'triangle', 0.4, 330);
    setTimeout(() => this.tone(311, 0.5, 'triangle', 0.4, 220), 220);
  }
}
