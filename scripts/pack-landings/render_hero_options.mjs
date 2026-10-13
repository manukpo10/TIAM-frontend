// Muestra cada variante del hero EN la página real, sin tocar ningún archivo del repo: carga la landing, cambia en memoria el src de la
// imagen del hero por la variante (data URL) y captura el primer pantallazo del celular (390 x 844, con --scale 2 sale en 780 x 1688).
//
// Uso:
//   node scripts/pack-landings/render_hero_options.mjs --url https://www.tiamdigital.com/pack/familias --out CARPETA \
//        [--width 390] [--height 844] [--scale 2] actual= A=ruta/hero-A-1x1-1200.webp B=...
//   Cada argumento `nombre=ruta` deja `CARPETA/vista-nombre.png`; con la ruta vacía (`actual=`) se captura la página tal cual está.
//   Con `--clip .hero` se captura solo ese elemento (la barra de compra fija se oculta): así salen las capturas del hero solo.
//   Se imprime también el rectángulo real de la imagen en la página (ancho y alto en px CSS).
//
// Solo lee la página (un GET); el cambio de imagen ocurre en el Chrome headless y se descarta al cerrar.

import fs from 'node:fs'
import path from 'node:path'
import { loadAndSettle, openPage } from './cdp.mjs'

const argv = process.argv.slice(2)
const opts = {}
const items = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i]
  else items.push(argv[i])
}
if (!opts.url || !opts.out) throw new Error('Falta --url o --out')
const width = Number(opts.width ?? 390)
const height = Number(opts.height ?? (width >= 768 ? 900 : 844))
const scale = Number(opts.scale ?? 2)
fs.mkdirSync(opts.out, { recursive: true })

const page = await openPage({ width, height })
try {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 768, screenWidth: width, screenHeight: height })
  await loadAndSettle(page, opts.url, height)
  for (const item of items) {
    const eq = item.indexOf('=')
    const name = item.slice(0, eq)
    const file = item.slice(eq + 1)
    if (file) {
      const dataUrl = `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`
      await page.evaluate(`(async () => {
        const img = document.querySelector('.hero-photo img')
        img.removeAttribute('srcset'); img.removeAttribute('sizes')
        img.src = ${JSON.stringify(dataUrl)}
        await img.decode()
        img.removeAttribute('width'); img.removeAttribute('height')
        img.setAttribute('width', img.naturalWidth); img.setAttribute('height', img.naturalHeight)
      })()`)
    }
    await page.evaluate('window.scrollTo(0, 0)')
    await page.sleep(500)
    const rect = await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('.hero-photo img').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)] })())`)
    let params = { format: 'png' }
    if (opts.clip) {
      await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '#sticky-cta{display:none!important}'; document.head.appendChild(s) })()`)
      const r = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector(${JSON.stringify(opts.clip)}).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } })())`))
      params = { format: 'png', captureBeyondViewport: true, clip: { ...r, scale: 1 } }
    }
    const { data } = await page.send('Page.captureScreenshot', params)
    const target = path.join(opts.out, `vista-${name}.png`)
    fs.writeFileSync(target, Buffer.from(data, 'base64'))
    console.log(`${name}: imagen ${rect} (ancho, alto, arriba) -> ${path.basename(target)}`)
  }
} finally {
  page.close()
}
