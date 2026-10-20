// Servidor estático de dist/ que imita lo que hace Vercel con vercel.json, para probar en local:
//   1. si el archivo existe en dist, se sirve (los archivos estáticos van antes que los rewrites);
//   2. si no, se aplican los rewrites de vercel.json en orden, y solo si el destino existe;
//   3. con compresión brotli o gzip para HTML, CSS, JS y SVG, como en producción;
//   4. con las cabeceras de `headers` de vercel.json (por ejemplo Referrer-Policy en /pack/descargas/:token).
//
// Uso, desde la raíz del repo, después de `npm run build`:
//   node scripts/pack-landings/serve-dist.mjs [puerto]        (por defecto 4180)

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..', '..')
const dist = path.join(root, 'dist')
const port = Number(process.argv[2] ?? 4180)
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const rewrites = vercelConfig.rewrites ?? []
// Solo los patrones simples de vercel.json: /ruta/fija y /ruta/:parametro
const headerRules = (vercelConfig.headers ?? []).map((rule) => ({
  re: new RegExp('^' + rule.source.replace(/:[a-zA-Z]+/g, '[^/]+') + '/?$'),
  headers: Object.fromEntries(rule.headers.map((h) => [h.key, h.value])),
}))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
}
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.json'])

const fileFor = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '')
  for (const candidate of [path.join(dist, clean), path.join(dist, clean, 'index.html')]) {
    if (candidate.startsWith(dist) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

const toRegExp = (source) => new RegExp('^' + source.replace(/\(\.\*\)/g, '(.*)') + '/?$')

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let file = fileFor(url.pathname)
    let via = 'archivo'
    if (!file) {
      for (const rule of rewrites) {
        if (toRegExp(rule.source).test(url.pathname)) {
          const dest = fileFor(rule.destination)
          if (dest) {
            file = dest
            via = `rewrite ${rule.source}`
            break
          }
        }
      }
    }
    if (!file) {
      res.writeHead(404).end('no encontrado')
      return
    }
    const ext = path.extname(file)
    const body = fs.readFileSync(file)
    const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Served-Via': via }
    for (const rule of headerRules) if (rule.re.test(url.pathname)) Object.assign(headers, rule.headers)
    const accept = String(req.headers['accept-encoding'] ?? '')
    if (COMPRESSIBLE.has(ext) && body.length > 512) {
      if (accept.includes('br')) {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'br', Vary: 'Accept-Encoding' }).end(zlib.brotliCompressSync(body))
        return
      }
      if (accept.includes('gzip')) {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }).end(zlib.gzipSync(body))
        return
      }
    }
    res.writeHead(200, headers).end(body)
  })
  .listen(port, () => console.log(`dist en http://localhost:${port} (rewrites de vercel.json: ${rewrites.map((r) => r.source).join(', ')})`))
