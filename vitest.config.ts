import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Resolve Svelte to the client-side bundle (not SSR) when running in vitest
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
})
