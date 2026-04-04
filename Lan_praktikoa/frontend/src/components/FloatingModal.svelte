<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let open = false;
  export let title = 'Panel';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const dispatch = createEventDispatcher<{ close: void }>();

  function close(): void {
    dispatch('close');
  }
</script>

{#if open}
  <div class="layer" in:fade={{ duration: 170 }} out:fade={{ duration: 150 }}>
    <div
      class="backdrop"
      role="button"
      tabindex="0"
      aria-label="Close modal"
      on:click={close}
      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && close()}
    ></div>

    <div
      class={`modal ${size}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      in:fly={{ y: 16, duration: 280, easing: quintOut }}
      out:scale={{ start: 0.985, duration: 180, easing: quintOut }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close" on:click={close}>✕</button>
      </header>
      <div class="body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(4, 10, 20, 0.36);
    backdrop-filter: blur(8px);
  }

  .modal {
    position: relative;
    z-index: 1;
    width: min(560px, 92vw);
    border-radius: 18px;
    background: linear-gradient(165deg, rgba(19, 34, 58, 0.9), rgba(15, 28, 48, 0.84));
    box-shadow: 0 30px 72px rgba(1, 8, 20, 0.45);
    border: 1px solid rgba(238, 244, 252, 0.14);
    backdrop-filter: blur(26px) saturate(106%);
    padding: 14px;
  }

  .modal.sm {
    width: min(440px, 92vw);
  }

  .modal.lg {
    width: min(760px, 94vw);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 560;
    color: rgba(243, 248, 255, 0.96);
  }

  button {
    border: 0;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(242, 248, 255, 0.94);
    cursor: pointer;
    transition: transform 180ms ease, background-color 180ms ease;
  }

  button:hover {
    transform: scale(1.04);
    background: rgba(255, 255, 255, 0.13);
  }

  .body {
    color: rgba(226, 235, 246, 0.9);
    font-size: 0.92rem;
    line-height: 1.55;
  }
</style>
