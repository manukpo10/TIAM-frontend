// Capturas de pantalla de las landings con Chrome headless (protocolo CDP, sin dependencias).
//
// Uso, desde la raíz del repo (con `npm run build` hecho y `npx vite preview` andando):
//   node scripts/pack-landings/shoot.mjs --url http://localhost:4173/pack/familias --width 390 --out captura.png
//
// Opciones
//   --url      página a capturar (obligatoria)
//   --width    ancho del viewport en px (390 = celular, 1440 = escritorio). Por defecto 390.
//   --height   alto del viewport. Por defecto 844 (celular) u 900 (ancho >= 768).
//   --scale    factor de nitidez de la captura (2 = el doble de píxeles, para verla en un celular). Por defecto 1.
//   --out      PNG de la página completa
//   --slices   carpeta donde guardar además tramos del tamaño del viewport (para revisar de a poco)
//   --view     PNG solo del viewport, después de bajar tantos px (ej. --view 2400:vista.png)
//   --eval     expresión JavaScript que se evalúa en la página antes de capturar y se imprime
//   --chrome   ruta a chrome.exe (o variable CHROME)
//
// Recorre la página antes de capturar para que se carguen las imágenes diferidas (loading="lazy").

import fs from 'node:fs'
import path from 'node:path'
import { loadAndSettle, openPage } from './cdp.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, token, i, all) => (token.startsWith('--') ? [...acc, [token.slice(2), all[i + 1]?.startsWith('--') ? 'true' : (all[i + 1] ?? 'true')]] : acc), []),
)
if (!args.url) throw new Error('Falta --url')

const width = Number(args.width ?? 390)
const height = Number(args.height ?? (width >= 768 ? 900 : 844))
const scale = Number(args.scale ?? 1)

const page = await openPage({ width, height, chrome: args.chrome })
try {
  await loadAndSettle(page, args.url, height)
  if (args.eval) console.log(`eval: ${JSON.stringify(await page.evaluate(args.eval))}`)

  const pageHeight = await page.evaluate('document.documentElement.scrollHeight')
  const save = (file, data) => {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
    fs.writeFileSync(file, Buffer.from(data, 'base64'))
  }
  const shot = async (file, clip) => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale } })
    save(file, data)
  }

  // La barra de compra es position:fixed: en una captura de página completa aparece a mitad de la
  // página. Se oculta para las capturas largas y se vuelve a mostrar para --view.
  await page.evaluate(`(() => { const s = document.createElement('style'); s.id = 'shoot-hide'; s.textContent = '#sticky-cta{display:none!important}'; document.head.appendChild(s) })()`)
  if (args.out) {
    await shot(args.out, { x: 0, y: 0, width, height: pageHeight })
    console.log(`${args.out}: ${width}x${pageHeight}`)
  }
  if (args.slices) {
    let n = 0
    for (let y = 0; y < pageHeight; y += height) {
      n++
      await shot(path.join(args.slices, `tramo-${String(n).padStart(2, '0')}.png`), { x: 0, y, width, height: Math.min(height, pageHeight - y) })
    }
    console.log(`${n} tramos en ${args.slices}`)
  }
  await page.evaluate(`document.getElementById('shoot-hide')?.remove()`)
  if (args.view) {
    const [offset, file] = args.view.split(/:(.*)/s)
    await page.evaluate(`window.scrollTo(0, ${Number(offset)})`)
    await page.sleep(700)
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
    save(file, data)
    console.log(`${file}: viewport ${width}x${height} desde y=${offset}`)
  }
} finally {
  page.close()
}
