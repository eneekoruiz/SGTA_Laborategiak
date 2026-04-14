<script lang="ts">
  import GameShell from './components/GameShell.svelte';

  /**
   * App entry wrapper.
   *
   * Why:
   * - Keep the root component intentionally tiny and stable.
   * - Delegate all gameplay orchestration to GameShell.
   *
   * How:
   * - AppRouter resolves routes/auth.
   * - When route is /game/:id, App renders GameShell.
   * - GameShell owns API calls, stores, HUD/modals, and replay flow.
   */
</script>

<div class="app-root">
  <GameShell />
</div>

<style>
  .app-root {
    position: fixed;
    inset: 0;
    contain: strict;
    overflow: hidden;
  }
</style>
