<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let open = false;
  export let title = 'Drawer';
  export let side: 'left' | 'right' = 'right';
  export let width = 480;

  const dispatch = createEventDispatcher<{ close: void }>();

  function close(): void {
    dispatch('close');
  }
</script>

{#if open}
  <div class="layer" in:fade={{ duration: 160 }} out:fade={{ duration: 140 }}>
    <div
      class="scrim"
      role="button"
      tabindex="0"
      aria-label="Close drawer"
      on:click={close}
      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && close()}
    ></div>

    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      class={`drawer ${side}`}
      style={`width:min(${width}px, 92vw)`}
      in:fly={{ x: side === 'right' ? 26 : -26, duration: 300, easing: quintOut }}
      out:fly={{ x: side === 'right' ? 18 : -18, duration: 180, easing: quintOut }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close" on:click={close}>✕</button>
      </header>
      <div class="content">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 65;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(4, 10, 20, 0.26);
    backdrop-filter: blur(5px);
  }

  .drawer {
    position: absolute;
    top: 14px;
    bottom: 14px;
    border-radius: 18px;
    background: linear-gradient(164deg, rgba(18, 33, 56, 0.9), rgba(14, 26, 46, 0.84));
    border: 1px solid rgba(235, 243, 255, 0.12);
    box-shadow: 0 28px 70px rgba(1, 8, 20, 0.42);
    backdrop-filter: blur(24px) saturate(106%);
    overflow: hidden;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  .drawer.right {
    right: 14px;
  }

  .drawer.left {
    left: 14px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  h2 {
    margin: 0;
    color: rgba(242, 248, 255, 0.96);
    font-size: 0.98rem;
    font-weight: 560;
  }

  button {
    border: 0;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(242, 248, 255, 0.95);
    cursor: pointer;
    transition: transform 180ms ease, background-color 180ms ease;
  }

  button:hover {
    transform: scale(1.04);
    background: rgba(255, 255, 255, 0.14);
  }

  .content {
    padding: 0 14px 14px;
    overflow: auto;
  }
</style>
