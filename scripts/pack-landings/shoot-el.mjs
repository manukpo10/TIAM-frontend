// Captura de un tramo de una página (o de un elemento) con Chrome headless, después de dejarla en el estado que se quiera.
// Sirve para ver el formulario de compra vacío, con «juegos» tildado, con un error, o las páginas de gracias/descargas con datos de ejemplo.
//
// Uso, desde la raíz del repo (con una build y `npx vite preview` andando):
//   node scripts/pack-landings/shoot-el.mjs --url http://localhost:4192/pack/familias --selector "#pedido" --width 390 --scale 2 --out form.png
//   node scripts/pack-landings/shoot-el.mjs --url ... --selector "#pedido" --pre "document.querySelector('input[value=juegos]').click()" --out form-juegos.png
//
// Opciones
//   --url        página (obligatoria)
//   --selector   elemento a capturar (por defecto, la página completa)
//   --pad        px de margen alrededor del elemento. Por defecto 12.
//   --width / --height / --scale   viewport y nitidez (como shoot.mjs)
//   --pre        JavaScript que se evalúa antes de capturar (puede ser asíncrono); se imprime su resultado
//   --wait       ms de espera después de --pre (por defecto 400)
//   --out        PNG de salida (obligatorio)
//   --chrome     ruta a chrome.exe (o variable CHROME)

import fs from 'node:fs'
import path from 'node:path'
import { loadAndSettle, openPage } from './cdp.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, token, i, all) => (token.startsWith('--') ? [...acc, [token.slice(2), all[i + 1]?.startsWith('--') ? 'true' : (all[i + 1] ?? 'true')]] : acc), []),
)
if (!args.url || !args.out) throw new Error('Faltan --url y --out')

const width = Number(args.width ?? 390)
const height = Number(args.height ?? (width >= 768 ? 900 : 844))
const scale = Number(args.scale ?? 1)
const pad = Number(args.pad ?? 12)

const page = await openPage({ width, height, chrome: args.chrome })
try {
  await loadAndSettle(page, args.url, height)
  // la barra de compra del celular es position:fixed: se oculta para que no aparezca a mitad de la captura
  await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '#sticky-cta{display:none!important}'; document.head.appendChild(s) })()`)
  if (args.pre) console.log(`pre: ${JSON.stringify(await page.evaluate(args.pre))}`)
  await page.sleep(Number(args.wait ?? 400))

  let clip
  if (args.selector) {
    const rect = await page.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(args.selector)})
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
    })()`)
    if (!rect) throw new Error(`No encontré ${args.selector}`)
    const x = Math.max(0, rect.x - pad)
    const y = Math.max(0, rect.y - pad)
    clip = { x, y, width: Math.min(width - x, rect.width + pad * 2), height: rect.height + pad * 2 }
  } else {
    clip = { x: 0, y: 0, width, height: await page.evaluate('document.documentElement.scrollHeight') }
  }
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale } })
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true })
  fs.writeFileSync(args.out, Buffer.from(data, 'base64'))
  console.log(`${args.out}: ${Math.round(clip.width)}x${Math.round(clip.height)} (x${scale})`)
} finally {
  page.close()
}
