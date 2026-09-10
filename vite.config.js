import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      // dev parity: npm run dev talks to the real backend (server.mjs)
      '/api': 'http://127.0.0.1:8910',
    },
  },
})
