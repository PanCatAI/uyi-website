import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicAssetsDir = path.resolve(__dirname, '../../public/assets')

const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
}

/**
 * In production Cloudflare Pages serves /assets/* directly from public/assets/.
 * During local `vite dev` and `vite preview`, this middleware exposes the same
 * directory so fonts and room artwork render identically without duplicating files.
 */
function serveSharedPublicAssets(): Plugin {
  const middleware = (
    req: { url?: string },
    res: {
      statusCode: number
      setHeader: (name: string, value: string) => void
      end: (chunk?: Buffer) => void
    },
    next: () => void,
  ) => {
    const rawUrl = req.url ?? ''
    const pathname = rawUrl.split('?')[0]
    if (!pathname.startsWith('/assets/')) {
      next()
      return
    }
    const rel = path.normalize(pathname.slice('/assets/'.length))
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      next()
      return
    }
    const filePath = path.join(publicAssetsDir, rel)
    if (!filePath.startsWith(publicAssetsDir) || !fs.existsSync(filePath)) {
      next()
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.end(fs.readFileSync(filePath))
  }

  return {
    name: 'uyi-shared-public-assets',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && (req.url === '/login' || req.url.startsWith('/login?'))) {
          req.url = `/login/${req.url.slice('/login'.length)}`
        }
        next()
      })
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  base: '/login/',
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    serveSharedPublicAssets(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../public/login'),
    emptyOutDir: true,
  },
})
