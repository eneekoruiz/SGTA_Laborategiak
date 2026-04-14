<script lang="ts">
  /**
   * Thin gameplay shell entry component.
   *
   * Why: keep route-level Svelte file minimal and presentation-only.
   * How: delegates full gameplay rendering to GameShellView.
   */
  import GameShellView from './GameShellView.svelte';
</script>

<GameShellView />
