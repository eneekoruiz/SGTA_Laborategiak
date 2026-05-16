<script lang="ts">
  import { soundManager } from '../services/soundManager';
  import { onMount } from 'svelte';

  export let isGameOver = false;
  export let savePending = false;
  export let disabled = false;
  export let onBack: () => void = () => {};
  export let onSave: () => void = () => {};

  let audioState = soundManager.getState();
  let volumeVisible = false;

  onMount(() => {
    return soundManager.subscribe((state) => {
      audioState = state;
    });
  });

  function handleMuteToggle() {
    soundManager.playSFX('click');
    soundManager.toggleMute();
  }

  function handleVolumeChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    soundManager.setVolume(value);
  }

  function handleBack() {
    soundManager.playSFX('click');
    onBack();
  }

  function handleSave() {
    soundManager.playSFX('click');
    onSave();
  }
</script>

<header class="hud-corners" class:game-over={isGameOver}>
  <div class="hud-group top-left">
    <button 
      class="premium-btn control-chip corner-btn" 
      type="button" 
      on:click={handleBack} 
      disabled={isGameOver || savePending || disabled}
    >
      Itzuli
    </button>
  </div>

  <div class="hud-group top-right">
    <div class="audio-controls" class:expanded={volumeVisible}>
      <button 
        class="audio-toggle" 
        on:click={() => { volumeVisible = !volumeVisible; soundManager.playSFX('click'); }}
        title="Audio ezarpenak"
      >
        {#if audioState.isMuted || audioState.volumeLevel === 0}
          <span class="icon">🔇</span>
        {:else if audioState.volumeLevel < 0.5}
          <span class="icon">🔉</span>
        {:else}
          <span class="icon">🔊</span>
        {/if}
      </button>

      {#if volumeVisible}
        <div class="volume-slider-container">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={audioState.volumeLevel} 
            on:input={handleVolumeChange}
            class="volume-slider"
          />
          <button class="mute-btn" on:click={handleMuteToggle}>
            {audioState.isMuted ? 'UNMUTE' : 'MUTE'}
          </button>
        </div>
      {/if}
    </div>

    <button 
      class="premium-btn control-chip corner-btn" 
      type="button" 
      on:click={handleSave} 
      disabled={savePending || isGameOver || disabled}
    >
      {savePending ? 'Gordetzen...' : 'Gorde'}
    </button>
  </div>
</header>

<style>
  .hud-corners {
    position: fixed;
    top: 0; left: 0; right: 0;
    width: 100vw;
    z-index: 40;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    padding: 16px;
  }

  .hud-group {
    display: flex;
    gap: 12px;
    align-items: center;
    pointer-events: auto;
  }

  .corner-btn {
    padding: 10px 20px;
    border-radius: 12px;
    background: linear-gradient(175deg, rgba(19, 24, 32, 0.8), rgba(19, 24, 32, 0.6));
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(16px) saturate(160%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.4);
    color: #edf4ff;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .corner-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.3);
    background: linear-gradient(175deg, rgba(32, 40, 52, 0.9), rgba(19, 24, 32, 0.7));
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  }

  .audio-controls {
    display: flex;
    align-items: center;
    background: rgba(19, 24, 32, 0.75);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px;
    transition: all 0.3s ease;
  }

  .audio-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background 0.2s;
  }

  .audio-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .volume-slider-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    width: 180px;
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    outline: none;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: #4cc9f0;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(76, 201, 240, 0.5);
  }

  .mute-btn {
    background: none;
    border: none;
    color: #4cc9f0;
    font-size: 0.65rem;
    font-weight: 800;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .mute-btn:hover {
    background: rgba(76, 201, 240, 0.1);
  }

  .corner-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
</style>
