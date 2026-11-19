import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The finished 3D walks live in <repo>/walks/<id>/ (static sites, ~35 MB each). They are served at /walks/<id>/ by
// `npm run dev` and `npm run preview`, and copied into dist/walks/ by `npm run build`, so every environment
// (local, CI preview, GitHub Pages) behaves the same. Set SKIP_WALKS=1 to leave them out (CI branch builds do).
const walksDir = resolve(__dirname, '../walks')
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
}

function walks(): Plugin {
  const serve = (prefix: string) => (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s?: string) => void } & NodeJS.WritableStream, next: () => void) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (!path.startsWith(prefix)) return next()
    let file = normalize(join(walksDir, path.slice(prefix.length)))
    if (!file.startsWith(walksDir)) return next() // no path traversal
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return next()
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
    createReadStream(file).pipe(res)
  }
  let outDir = 'dist'
  return {
    name: 'peak-finder-walks',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(serve('/walks/'))
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve('/walks/'))
    },
    closeBundle() {
      if (process.env.SKIP_WALKS === '1' || !existsSync(walksDir)) return
      cpSync(walksDir, join(outDir, 'walks'), { recursive: true })
    },
  }
}

// VITE_BASE is set by the deploy workflow (GitHub Pages serves under /<repo>/). Locally it is "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), walks()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
