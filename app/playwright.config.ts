import { defineConfig } from '@playwright/test'

// Browser smoke tests run against the PRODUCTION build served under the same base path as GitHub Pages,
// because that is where the map once collapsed to height 0 (CSS load order) and where base-path mistakes show up.
const BASE = '/Peak-Finder_DATA511/'
// PW_PORT lets several people (or agents) run the suite at the same time: each gets its own port and its own build folder.
const PORT = Number(process.env.PW_PORT ?? 4173)
const OUT = PORT === 4173 ? 'dist' : `dist-pw-${PORT}`
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}`,
    // headless Chromium has no GPU: software WebGL so MapLibre can draw
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    viewport: { width: 1400, height: 850 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx tsc -b && npx vite build --outDir ${OUT} --emptyOutDir && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_BASE: BASE, SKIP_WALKS: '1' },
  },
})
