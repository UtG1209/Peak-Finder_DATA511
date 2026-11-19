import { defineConfig } from '@playwright/test'

// Browser smoke tests run against the PRODUCTION build served under the same base path as GitHub Pages,
// because that is where the map once collapsed to height 0 (CSS load order) and where base-path mistakes show up.
const BASE = '/Peak-Finder_DATA511/'
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:4173${BASE}`,
    // headless Chromium has no GPU: software WebGL so MapLibre can draw
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    viewport: { width: 1400, height: 850 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: `http://127.0.0.1:4173${BASE}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_BASE: BASE, SKIP_WALKS: '1' },
  },
})
