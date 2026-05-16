/**
 * Sound Manager — Procedural Web Audio API
 *
 * All sounds are generated on-the-fly using Web Audio API synthesizers.
 * No external audio files required.
 */

import * as audio from './audioService';

export type SFXType = 'build' | 'demolish' | 'click' | 'money' | 'error' | 'zone' | 'infrastructure';

type AudioState = {
  isMuted: boolean;
  volumeLevel: number;
  bgmPlaying: boolean;
};

type StateListener = (state: AudioState) => void;

const STORAGE_KEYS = {
  muted: 'simhiri.audio.muted',
  volume: 'simhiri.audio.volume'
};

const DEFAULT_VOLUME = 0.70;

class SoundManager {
  private isMuted = false;
  private volumeLevel = DEFAULT_VOLUME;
  private listeners = new Set<StateListener>();
  private firstInteractionArmed = false;
  public userUnlocked = false;
  private bgmPlaying = false;
  private lastSfxAt: Partial<Record<SFXType, number>> = {};

  // Cooldowns to prevent audio spam
  private readonly SFX_COOLDOWN_MS: Record<SFXType, number> = {
    build: 70,
    demolish: 120,
    click: 40,
    money: 180,
    error: 180,
    zone: 50,
    infrastructure: 50
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem(STORAGE_KEYS.muted) === 'true';
      const storedVolume = Number(localStorage.getItem(STORAGE_KEYS.volume));
      if (Number.isFinite(storedVolume)) {
        this.volumeLevel = Math.max(0, Math.min(1, storedVolume));
      }

      // Initialize audio context on first user interaction
      this.armBGMOnFirstInteraction();
    }
  }

  getState(): AudioState {
    return {
      isMuted: this.isMuted,
      volumeLevel: this.volumeLevel,
      bgmPlaying: this.bgmPlaying
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  armBGMOnFirstInteraction(): void {
    if (typeof window === 'undefined' || this.firstInteractionArmed) return;
    this.firstInteractionArmed = true;

    const unlock = (): void => {
      this.userUnlocked = true;
      audio.initAudio();
      if (!this.isMuted) {
        this.startBGM();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  playSFX(type: SFXType): void {
    if (this.isMuted || this.volumeLevel <= 0) return;

    // Proactively ensure audio context is active
    audio.initAudio();

    const now = Date.now();
    const cooldown = this.SFX_COOLDOWN_MS[type];
    const last = this.lastSfxAt[type] ?? 0;
    if (now - last < cooldown) return;

    this.lastSfxAt[type] = now;

    // Set volume levels before playing
    audio.setSFXVolume(this.volumeLevel);

    // Map SFX types to audio functions
    switch (type) {
      case 'build':
        audio.playBuildingPlacementSound();
        break;
      case 'demolish':
        audio.playDemolitionSound();
        break;
      case 'click':
        audio.playClickSound();
        break;
      case 'money':
        audio.playCashSound();
        break;
      case 'error':
        audio.playErrorSound();
        break;
      case 'zone':
        audio.playZonePaintSound();
        break;
      case 'infrastructure':
        audio.playInfrastructureSound();
        break;
    }
  }

  startBGM(): void {
    if (typeof window === 'undefined' || this.isMuted || this.volumeLevel <= 0) return;

    // Ensure audio context is initialized
    if (!this.userUnlocked) {
      this.armBGMOnFirstInteraction();
      return;
    }

    if (!this.bgmPlaying) {
      audio.initAudio();
      audio.setMusicVolume(this.volumeLevel * 0.34);
      audio.startBackgroundMusic();
      this.bgmPlaying = true;
      this.notify();
    }
  }

  stopBGM(): void {
    if (this.bgmPlaying) {
      audio.stopBackgroundMusic();
      this.bgmPlaying = false;
      this.notify();
    }
  }

  setVolume(value: number): void {
    this.volumeLevel = Math.max(0, Math.min(1, value));
    this.persist();

    audio.setMasterVolume(this.volumeLevel);

    if (!this.isMuted && this.userUnlocked) {
      if (this.bgmPlaying) {
        audio.setMusicVolume(this.volumeLevel * 0.34);
      } else {
        this.startBGM();
      }
    }

    this.notify();
  }

  setMuted(value: boolean): void {
    this.isMuted = value;
    this.persist();

    if (this.isMuted) {
      this.stopBGM();
      audio.setMasterVolume(0);
    } else if (this.userUnlocked) {
      audio.setMasterVolume(this.volumeLevel);
      this.startBGM();
    }

    this.notify();
  }

  toggleMute(): void {
    this.setMuted(!this.isMuted);
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.muted, String(this.isMuted));
    localStorage.setItem(STORAGE_KEYS.volume, String(this.volumeLevel));
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export const soundManager = new SoundManager();
