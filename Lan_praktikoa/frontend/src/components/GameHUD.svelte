<script lang="ts">
  export let isGameOver = false;
  export let savePending = false;
  export let onBack: () => void = () => {};
  export let onSave: () => void = () => {};
</script>

<header class="hud-corners" class:game-over={isGameOver}>
  <button class="corner-btn control-chip top-left" type="button" on:click={onBack} disabled={isGameOver}>Itzuli</button>
  <button class="corner-btn control-chip top-right" type="button" on:click={onSave} disabled={savePending || isGameOver}>
    {savePending ? 'Gordetzen...' : 'Gorde'}
  </button>
</header>

<style>
  .hud-corners {
    position: fixed;
    top: 0; left: 0; right: 0;
    width: 100vw;
    z-index: 39;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    padding: 16px;
  }

  .corner-btn {
    pointer-events: auto;
    padding: 10px 20px;
    border-radius: 12px;
    background: linear-gradient(175deg, rgba(19, 24, 32, 0.66), rgba(19, 24, 32, 0.42));
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px) saturate(132%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 20px rgba(2, 8, 16, 0.34);
    color: #edf4ff;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, filter 0.2s ease;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .corner-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }

  .corner-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
