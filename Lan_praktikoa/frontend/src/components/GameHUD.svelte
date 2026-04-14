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
    top: 130px;
    left: 0;
    right: 0;
    width: 100vw;
    z-index: 39;
    pointer-events: none;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .corner-btn {
    pointer-events: auto;
    padding: 10px 20px;
    border-radius: 12px;
    background: linear-gradient(175deg, rgba(19, 24, 32, 0.82), rgba(19, 24, 32, 0.58));
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(14px) saturate(140%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 10px 28px rgba(0, 0, 0, 0.32);
    color: #edf4ff;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .corner-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    filter: brightness(1.15);
    background: linear-gradient(175deg, rgba(25, 35, 50, 0.9), rgba(20, 30, 42, 0.68));
    border-color: rgba(255, 255, 255, 0.25);
  }

  .corner-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .top-left {
    margin-left: 0;
  }

  .top-right {
    margin-right: 0;
  }
</style>
