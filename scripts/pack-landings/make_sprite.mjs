// Genera pack/_partials/sprite.html: un sprite SVG con SOLO los íconos que usan las landings.
//
// Uso, desde la raíz del repo:  node scripts/pack-landings/make_sprite.mjs
//
// Los íconos salen de lucide-react (ya es dependencia del sitio, licencia ISC). Las páginas los
// piden con <svg class="i"><use href="#i-nombre"/></svg>; este script lee esas referencias en
// pack/**/*.html y arma el sprite. Si se agrega un ícono nuevo a una página, volver a correrlo.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..', '..')
const packDir = path.join(root, 'pack')
const iconsDir = path.join(root, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons')
const out = path.join(packDir, '_partials', 'sprite.html')

function htmlFiles(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...htmlFiles(full))
    else if (entry.name.endsWith('.html') && full !== out) found.push(full)
  }
  return found
}

const names = new Set()
for (const file of htmlFiles(packDir)) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/href="#i-([a-z0-9-]+)"/g)) names.add(match[1])
}

const attrs = (obj) =>
  Object.entries(obj)
    .filter(([key]) => key !== 'key')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

const symbols = []
for (const name of [...names].sort()) {
  const file = path.join(iconsDir, `${name}.mjs`)
  if (!fs.existsSync(file)) throw new Error(`No existe el ícono "${name}" en lucide-react (${file})`)
  const { __iconNode: nodes } = await import(pathToFileURL(file).href)
  const body = nodes.map(([tag, props]) => `<${tag} ${attrs(props)}/>`).join('')
  symbols.push(`<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
}

const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">\n${symbols.join('\n')}\n</svg>\n`
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, sprite)
console.log(`${symbols.length} íconos (${(sprite.length / 1024).toFixed(1)} KB): ${[...names].sort().join(', ')}`)
