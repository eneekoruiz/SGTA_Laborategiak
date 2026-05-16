import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Use polling for reliable file watching inside Docker containers
      usePolling: true,
      interval: 300
    }
  }
});
