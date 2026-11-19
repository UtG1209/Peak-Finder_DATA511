import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// VITE_BASE is set by the deploy workflow (GitHub Pages serves under /<repo>/).
// Locally it is "/" so `npm run dev` just works.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
