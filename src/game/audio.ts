/**
 * Procedural Web Audio synthesizer & ambient soundscape engine for ECHO-9: The Last Signal.
 * Generates layered low-frequency hull hums, faint metallic creaks, and distant vent rattles
 * with zero external audio files.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientOsc3: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientNoiseSource: AudioBufferSourceNode | null = null;

  private ambientActive = false;
  private creakTimer: number | null = null;
  private rattleTimer: number | null = null;
  private muted = false;
  private masterVolume = 0.8;
  private lastHoverMs = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume * 0.56,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        mute ? 0 : this.masterVolume * 0.56,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume * 0.56;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.ambientOsc1) return;

    const hullFilter = ctx.createBiquadFilter();
    hullFilter.type = 'lowpass';
    hullFilter.frequency.value = 128;
    hullFilter.Q.value = 1.8;

    // Slow breathing LFO modulating hull filter cutoff for deep station resonance
    this.ambientLfo = ctx.createOscillator();
    this.ambientLfo.type = 'sine';
    this.ambientLfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 38;
    this.ambientLfo.connect(lfoGain);
    lfoGain.connect(hullFilter.frequency);

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.085;

    // Multi-layered low-frequency station hums
    this.ambientOsc1 = ctx.createOscillator();
    this.ambientOsc1.type = 'sawtooth';
    this.ambientOsc1.frequency.value = 42;

    this.ambientOsc2 = ctx.createOscillator();
    this.ambientOsc2.type = 'triangle';
    this.ambientOsc2.frequency.value = 63;

    this.ambientOsc3 = ctx.createOscillator();
    this.ambientOsc3.type = 'sine';
    this.ambientOsc3.frequency.value = 84.4;

    this.ambientOsc1.connect(hullFilter);
    this.ambientOsc2.connect(hullFilter);
    this.ambientOsc3.connect(hullFilter);

    // Faint filtered life-support airflow bed
    const airLen = ctx.sampleRate * 3;
    const airBuffer = ctx.createBuffer(1, airLen, ctx.sampleRate);
    const airData = airBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < airLen; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      airData[i] = lastOut * 2.2;
    }
    this.ambientNoiseSource = ctx.createBufferSource();
    this.ambientNoiseSource.buffer = airBuffer;
    this.ambientNoiseSource.loop = true;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 260;
    airFilter.Q.value = 0.9;

    const airGain = ctx.createGain();
    airGain.gain.value = 0.16;

    this.ambientNoiseSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.ambientGain);

    hullFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambientLfo.start();
    this.ambientOsc1.start();
    this.ambientOsc2.start();
    this.ambientOsc3.start();
    this.ambientNoiseSource.start();
  }

  public setAmbientLevel(active: boolean): void {
    this.ambientActive = active;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(
        active ? 0.095 : 0.025,
        this.ctx.currentTime,
        0.25
      );
    }

    if (active) {
      this.scheduleNextCreak();
      this.scheduleNextRattle();
    } else {
      this.clearAmbientTimers();
    }
  }

  private clearAmbientTimers(): void {
    if (this.creakTimer !== null) {
      window.clearTimeout(this.creakTimer);
      this.creakTimer = null;
    }
    if (this.rattleTimer !== null) {
      window.clearTimeout(this.rattleTimer);
      this.rattleTimer = null;
    }
  }

  private scheduleNextCreak(): void {
    if (!this.ambientActive || this.creakTimer !== null) return;
    const delayMs = 5500 + Math.random() * 6500;
    this.creakTimer = window.setTimeout(() => {
      this.creakTimer = null;
      if (this.ambientActive && !this.muted) {
        this.playMetallicCreak();
      }
      if (this.ambientActive) {
        this.scheduleNextCreak();
      }
    }, delayMs);
  }

  private scheduleNextRattle(): void {
    if (!this.ambientActive || this.rattleTimer !== null) return;
    const delayMs = 4500 + Math.random() * 6000;
    this.rattleTimer = window.setTimeout(() => {
      this.rattleTimer = null;
      if (this.ambientActive && !this.muted) {
        this.playVentRattle();
      }
      if (this.ambientActive) {
        this.scheduleNextRattle();
      }
    }, delayMs);
  }

  /**
   * Synthesizes a faint distant metallic hull creak / bulkhead groan.
   */
  public playMetallicCreak(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const duration = 0.85 + Math.random() * 0.75;
    const startFreq = 165 + Math.random() * 145;
    const endFreq = startFreq * (0.68 + Math.random() * 0.14);

    // Carrier + subtle FM modulator for metallic groan texture
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(startFreq, now);
    carrier.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = 18 + Math.random() * 24;
    const modGain = ctx.createGain();
    modGain.gain.value = 26;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq * 1.4, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq * 1.1, now + duration);
    filter.Q.value = 7.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032 + Math.random() * 0.018, now + duration * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    const panner = this.createPanner(ctx, (Math.random() * 2 - 1) * 0.75);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    mod.start(now);
    carrier.start(now);
    mod.stop(now + duration + 0.05);
    carrier.stop(now + duration + 0.05);
  }

  /**
   * Synthesizes distant air-vent clatters & sheet-metal duct rattles.
   */
  public playVentRattle(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const hits = 3 + Math.floor(Math.random() * 4);
    const panner = this.createPanner(ctx, (Math.random() * 2 - 1) * 0.85);
    panner.connect(this.masterGain);

    let offset = 0;
    for (let i = 0; i < hits; i++) {
      const t = now + offset;
      const hitDur = 0.035 + Math.random() * 0.025;
      offset += 0.048 + Math.random() * 0.055;

      const bufLen = Math.max(64, Math.floor(ctx.sampleRate * hitDur));
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let s = 0; s < bufLen; s++) {
        data[s] = (Math.random() * 2 - 1) * (1 - s / bufLen);
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 520 + Math.random() * 580;
      bandpass.Q.value = 4.5;

      const hitGain = ctx.createGain();
      const amp = (0.045 - i * 0.005) * (0.75 + Math.random() * 0.5);
      hitGain.gain.setValueAtTime(Math.max(0.01, amp), t);
      hitGain.gain.exponentialRampToValueAtTime(0.0005, t + hitDur);

      src.connect(bandpass);
      bandpass.connect(hitGain);
      hitGain.connect(panner);
      src.start(t);

      // Subtle metallic duct ring
      const ring = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ring.type = 'triangle';
      ring.frequency.setValueAtTime(440 + Math.random() * 320, t);
      ringGain.gain.setValueAtTime(0.012, t);
      ringGain.gain.exponentialRampToValueAtTime(0.0005, t + hitDur * 1.4);
      ring.connect(ringGain);
      ringGain.connect(panner);
      ring.start(t);
      ring.stop(t + hitDur * 1.5);
    }
  }

  private createPanner(ctx: AudioContext, pan: number): AudioNode {
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      return p;
    }
    return ctx.createGain();
  }

  public destroy(): void {
    this.ambientActive = false;
    this.clearAmbientTimers();
    const stopNode = (node: { stop: () => void } | null) => {
      if (!node) return;
      try {
        node.stop();
      } catch {
        // Ignore if already stopped
      }
    };
    stopNode(this.ambientOsc1);
    stopNode(this.ambientOsc2);
    stopNode(this.ambientOsc3);
    stopNode(this.ambientLfo);
    stopNode(this.ambientNoiseSource);

    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientOsc3 = null;
    this.ambientLfo = null;
    this.ambientNoiseSource = null;

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  public playFootstep(isGrate: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isGrate ? 'triangle' : 'sine';
    const baseFreq = isGrate ? 145 + Math.random() * 25 : 88 + Math.random() * 14;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.065);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playDoorSlide(opening: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opening ? 900 : 620, now);
    filter.frequency.exponentialRampToValueAtTime(opening ? 1500 : 320, now + 0.25);
    filter.Q.value = 1.6;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(opening ? 190 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 320 : 140, now + 0.22);
    oscGain.gain.setValueAtTime(0.09, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playLocked(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.setValueAtTime(110, t + 0.04);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  public playPickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 880];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playTerminalOpen(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.09);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playPowerSurge(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const chord = [110, 220, 329.63, 440, 659.25];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.7, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.35);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.95);
    });
  }

  public playHazardShock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playSuitRecharge(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playGameOver(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [220, 164.81, 110];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.35);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  public playBlasterFire(): void {
    this.playMiningLaserFire();
  }

  public playMiningLaserFire(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Focused high-energy plasma cutter beam core
    const osc = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(590, now);
    oscHarm.frequency.exponentialRampToValueAtTime(160, now + 0.12);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(640, now + 0.12);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(filter);
    oscHarm.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    oscHarm.start(now);
    osc.stop(now + 0.14);
    oscHarm.stop(now + 0.14);
  }

  public playLaserOverheat(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Coolant steam vent hiss + thermal warning tone
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.11, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);

    const beep = ctx.createOscillator();
    const bGain = ctx.createGain();
    beep.type = 'square';
    beep.frequency.setValueAtTime(420, now);
    beep.frequency.setValueAtTime(310, now + 0.11);
    bGain.gain.setValueAtTime(0.07, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    beep.connect(bGain);
    bGain.connect(this.masterGain);
    beep.start(now);
    beep.stop(now + 0.25);
  }

  public playMonsterHit(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playMonsterDefeat(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.36);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playBossRoar(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(135, now);
    osc1.frequency.exponentialRampToValueAtTime(52, now + 0.85);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(92, now);
    osc2.frequency.exponentialRampToValueAtTime(38, now + 0.85);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.85);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.92);
    osc2.stop(now + 0.92);
  }

  public playMonsterSlash(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playEchoBeaconPing(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [980, 1470];
    freqs.forEach((f, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, t + 0.42);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public playListenerAlert(hunting: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const clicks = hunting ? 4 : 2;
    for (let i = 0; i < clicks; i++) {
      const t = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = hunting ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(hunting ? 340 - i * 35 : 210 + i * 50, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.09);
      gain.gain.setValueAtTime(hunting ? 0.13 : 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.11);
    }
  }

  public playPuzzleClick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public unlockAudio(): void {
    this.ensureContext();
  }

  /**
   * Tactile sci-fi hover resonance with sub-bass weight for menu cursors.
   */
  public playMenuHover(primary = false): void {
    if (this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHoverMs < 65) return;
    this.lastHoverMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;

    // 1. Sub-bass tactile thump so the cursor lock feels physical
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(primary ? 115 : 95, now);
    subOsc.frequency.exponentialRampToValueAtTime(44, now + 0.065);
    subGain.gain.setValueAtTime(primary ? 0.16 : 0.08, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.075);

    // 2. Crisp harmonic telemetry lock tone
    const toneOsc = ctx.createOscillator();
    const toneGain = ctx.createGain();
    toneOsc.type = 'triangle';
    toneOsc.frequency.setValueAtTime(primary ? 440 : 560, now);
    toneOsc.frequency.exponentialRampToValueAtTime(primary ? 740 : 780, now + 0.075);
    toneGain.gain.setValueAtTime(primary ? 0.085 : 0.055, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    toneOsc.connect(toneGain);
    toneGain.connect(this.masterGain);
    toneOsc.start(now);
    toneOsc.stop(now + 0.095);

    if (primary) {
      const shimmerOsc = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmerOsc.type = 'sine';
      shimmerOsc.frequency.setValueAtTime(880, now + 0.015);
      shimmerOsc.frequency.exponentialRampToValueAtTime(1180, now + 0.095);
      shimmerGain.gain.setValueAtTime(0.04, now + 0.015);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(this.masterGain);
      shimmerOsc.start(now + 0.015);
      shimmerOsc.stop(now + 0.11);
    }
  }

  /**
   * Decisive sci-fi activation sound on menu button press.
   */
  public playMenuConfirm(primary = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = primary ? [330, 523.25, 783.99] : [520, 740];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(primary ? 0.11 : 0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playPuzzleSolved(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }
}
