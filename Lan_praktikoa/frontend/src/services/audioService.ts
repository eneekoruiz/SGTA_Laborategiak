/**
 * AUDIO SERVICE — SimHiri Sound Management
 * 
 * Handles all game audio: SFX for actions (zone painting, building placement, demolition)
 * and ambient background music using Web Audio API.
 * 
 * All sounds generated procedurally (no external dependencies) for instant responsiveness.
 */

interface AudioContextInstance {
  ctx: AudioContext;
  masterGain: GainNode;
  compressor: DynamicsCompressorNode;
  musicGain: GainNode;
  sfxGain: GainNode;
}

let audioInstance: AudioContextInstance | null = null;
let musicOscillators: OscillatorNode[] = [];
let musicPlaying = false;

/**
 * Initialize Web Audio API context on user gesture.
 */
export function initAudio(): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;

  if (audioInstance) {
    if (audioInstance.ctx.state === 'suspended') {
      void audioInstance.ctx.resume();
    }
    return;
  }

  try {
    const ctx = new AudioContext();
    
    // 1. Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0; // Maximize master output for "loud" requirement

    // 2. Dynamics Compressor for "Professional" punch
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, ctx.currentTime);
    compressor.knee.setValueAtTime(40, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    // 3. Sub-Gains
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 1.2; // Overdrive SFX for maximum impact

    // Route: sfx/music -> compressor -> master -> destination
    musicGain.connect(compressor);
    sfxGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    audioInstance = { ctx, masterGain, compressor, musicGain, sfxGain };
    console.log('[Audio] System Initialized with High-Impact Dynamics');
  } catch (error) {
    console.warn('Audio context initialization failed:', error);
  }
}

/**
 * Start ambient background music loop (richer pads).
 */
export function startBackgroundMusic(): void {
  if (!audioInstance || musicPlaying) return;

  const { ctx, musicGain } = audioInstance;
  musicPlaying = true;

  const playArpeggio = () => {
    if (!audioInstance || !musicPlaying) return;

    const notes = [261.63, 329.63, 392.00, 493.88]; // C4, E4, G4, B4
    let noteIndex = 0;

    const playNote = () => {
      if (!audioInstance || !musicPlaying) return;

      // Layered oscillators for "Professional" feel
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.value = notes[noteIndex % notes.length];
      osc2.frequency.value = notes[noteIndex % notes.length] * 1.005; // Slight detune

      filter.type = 'lowpass';
      filter.frequency.value = 800;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(audioInstance.musicGain);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);

      musicOscillators.push(osc1, osc2);

      noteIndex += 1;
      if (noteIndex < 16) {
        setTimeout(playNote, 600);
      } else {
        setTimeout(playArpeggio, 2000);
      }
    };

    playNote();
  };

  playArpeggio();
}

export function stopBackgroundMusic(): void {
  musicPlaying = false;
  musicOscillators.forEach((osc) => {
    try { osc.stop(); } catch (e) {}
  });
  musicOscillators = [];
}

export function setMasterVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.masterGain.gain.setTargetAtTime(level, audioInstance.ctx.currentTime, 0.1);
}

export function setMusicVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.musicGain.gain.setTargetAtTime(level, audioInstance.ctx.currentTime, 0.1);
}

export function setSFXVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.sfxGain.gain.setTargetAtTime(level, audioInstance.ctx.currentTime, 0.1);
}

/**
 * Play professional "Build" sound (thump + mechanical noise).
 */
export function playBuildingPlacementSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  // 1. Mechanical "Click" (Noise Transient)
  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 4));
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2000;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(sfxGain);
  noise.start(now);

  // 2. Power "Thud" (Layered Sine + Square)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const oscGain = ctx.createGain();
  
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(160, now);
  osc1.frequency.exponentialRampToValueAtTime(40, now + 0.15);

  osc2.type = 'square';
  osc2.frequency.setValueAtTime(80, now);
  osc2.frequency.exponentialRampToValueAtTime(20, now + 0.15);

  oscGain.gain.setValueAtTime(0.8, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

  osc1.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(sfxGain);
  
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.15);
  osc2.stop(now + 0.15);
}

/**
 * Play professional "Demolish" sound (low explosion + debris).
 */
export function playDemolitionSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  // 1. Explosion (Deep Sawtooth + Lowpass)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(30, now + 0.6);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

  gain.gain.setValueAtTime(1.0, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.6);

  // 2. Debris Crash (Filtered Noise)
  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 800;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(sfxGain);
  noise.start(now);
}

/**
 * Play "Zone" sound (electronic zip).
 */
export function playZonePaintSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * Play "Infrastructure" sound (digital click).
 */
export function playInfrastructureSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Play "Cash" sound (high quality coin ding).
 */
export function playCashSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  // Layered pure sine waves for that "Gold" sound
  [1500, 2200, 3100].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const start = now + idx * 0.04;
    gain.gain.setValueAtTime(0.6, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/**
 * Play professional "Click" sound (percussive transient).
 */
export function playClickSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2500, now);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.04);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.04);
}

/**
 * Play professional "Startup" sound (harmonic swell).
 */
export function playStartupSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.8);
  });
}

/**
 * Play "Error" sound (dull buzzer).
 */
export function playErrorSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.2);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function playMonthEndSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;
  const notes = [523, 659, 784, 1046];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + idx * 0.1;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

export function playDisasterSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;
  const now = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now + i * 0.2);
    osc.frequency.linearRampToValueAtTime(400, now + i * 0.2 + 0.15);
    const start = now + i * 0.2;
    gain.gain.setValueAtTime(0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(start);
    osc.stop(start + 0.15);
  }
}
