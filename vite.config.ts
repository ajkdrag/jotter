import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  css: {
    transformer: 'lightningcss'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
