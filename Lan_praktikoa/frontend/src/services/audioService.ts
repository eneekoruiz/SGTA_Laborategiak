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
  musicGain: GainNode;
  sfxGain: GainNode;
}

let audioInstance: AudioContextInstance | null = null;
let musicOscillators: OscillatorNode[] = [];
let musicPlaying = false;

/**
 * Initialize Web Audio API context on user gesture (required by browsers).
 */
export function initAudio(): void {
  if (audioInstance || typeof window === 'undefined' || !window.AudioContext) return;

  try {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.4; // Safe default volume

    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.3;
    musicGain.connect(masterGain);

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);

    masterGain.connect(ctx.destination);

    audioInstance = { ctx, masterGain, musicGain, sfxGain };
  } catch (error) {
    console.warn('Audio context initialization failed:', error);
  }
}

/**
 * Start ambient background music loop (simple arpeggio pattern).
 */
export function startBackgroundMusic(): void {
  if (!audioInstance || musicPlaying) return;

  const { ctx, musicGain } = audioInstance;
  musicPlaying = true;

  const playArpeggio = () => {
    if (!audioInstance || !musicPlaying) return;

    const notes = [262, 330, 392, 494]; // C4, E4, G4, B4 (major chord progression)
    let noteIndex = 0;

    const playNote = () => {
      if (!audioInstance || !musicPlaying) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = notes[noteIndex % notes.length];
      osc.connect(gain);
      gain.connect(audioInstance.musicGain);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);

      musicOscillators.push(osc);

      noteIndex += 1;
      if (noteIndex < 32) {
        setTimeout(playNote, 400);
      } else {
        playArpeggio();
      }
    };

    playNote();
  };

  playArpeggio();
}

/**
 * Stop ambient background music.
 */
export function stopBackgroundMusic(): void {
  musicPlaying = false;
  musicOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch (e) {
      // Already stopped
    }
  });
  musicOscillators = [];
}

/**
 * Set master volume (0-1).
 */
export function setMasterVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.masterGain.gain.value = Math.max(0, Math.min(1, level));
}

/**
 * Set music volume (0-1).
 */
export function setMusicVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.musicGain.gain.value = Math.max(0, Math.min(1, level));
}

/**
 * Set SFX volume (0-1).
 */
export function setSFXVolume(level: number): void {
  if (!audioInstance) return;
  audioInstance.sfxGain.gain.value = Math.max(0, Math.min(1, level));
}

/**
 * Play zone painting sound (ascending tone burst).
 */
export function playZonePaintSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(sfxGain);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

/**
 * Play infrastructure painting sound (quick digital chirp).
 */
export function playInfrastructureSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(sfxGain);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

/**
 * Play building placement sound (higher pitched success chime).
 */
export function playBuildingPlacementSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  // Two-note chime
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = i === 0 ? 800 : 1000;
    osc.type = 'sine';
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(sfxGain);

    const startTime = ctx.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }
}

/**
 * Play demolition sound (descending resonant tone).
 */
export function playDemolitionSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(sfxGain);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

/**
 * Play month-end chime (pleasant notification).
 */
export function playMonthEndSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(sfxGain);

    const startTime = ctx.currentTime + idx * 0.1;
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}

/**
 * Play disaster/warning sound (alarm tone).
 */
export function playDisasterSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  for (let pulse = 0; pulse < 3; pulse++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(900, ctx.currentTime + pulse * 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + pulse * 0.15 + 0.1);

    osc.connect(gain);
    gain.connect(sfxGain);

    const startTime = ctx.currentTime + pulse * 0.15;
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.02, startTime + 0.1);

    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }
}

/**
 * Play error/invalid action sound.
 */
export function playErrorSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(sfxGain);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

/**
 * Play cash/money transaction sound (power-up ding).
 */
export function playCashSound(): void {
  if (!audioInstance) return;
  const { ctx, sfxGain } = audioInstance;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(sfxGain);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}
