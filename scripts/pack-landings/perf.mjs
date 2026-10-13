// Prueba de carga con red lenta y CPU limitada, en Chrome headless (sin dependencias).
//
// Uso (con `node scripts/pack-landings/serve-dist.mjs` andando, así hay compresión como en Vercel):
//   node scripts/pack-landings/perf.mjs http://localhost:4180/pack/familias [--runs 3] [--net slow4g|fast3g|none] [--width 390]
//
// Mide, sin scrollear: FCP, LCP, CLS, cantidad de pedidos y bytes transferidos hasta `load`.
// Después recorre toda la página y suma lo que cargan las imágenes diferidas.
// Los perfiles de red son los de Lighthouse: slow4g = 150 ms de latencia y 1,6 Mbps; fast3g = 562 ms y 1,6 Mbps.

import { openPage, loadAndSettle } from './cdp.mjs'

const url = process.argv[2]
if (!url) throw new Error('Uso: node perf.mjs <url> [--runs 3] [--net slow4g|fast3g|none] [--width 390]')
const opt = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const runs = Number(opt('runs', 3))
const net = opt('net', 'slow4g')
const width = Number(opt('width', 390))
const height = width >= 768 ? 900 : 844
const PROFILES = {
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  fast3g: { latency: 562, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

const results = []
for (let run = 0; run < runs; run++) {
  const page = await openPage({ width, height })
  try {
    const requests = new Map()
    page.on('Network.requestWillBeSent', (p) => requests.set(p.requestId, { url: p.request.url, bytes: 0, type: p.type }))
    page.on('Network.loadingFinished', (p) => {
      const r = requests.get(p.requestId)
      if (r) r.bytes = p.encodedDataLength
    })

    await page.send('Network.setCacheDisabled', { cacheDisabled: true })
    if (net !== 'none') await page.send('Network.emulateNetworkConditions', { offline: false, ...PROFILES[net] })
    await page.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__perf = { lcp: 0, cls: 0, fcp: 0 }
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
      `,
    })

    const loaded = page.once('Page.loadEventFired')
    await page.send('Page.navigate', { url })
    await loaded
    await page.sleep(1500)
    const first = await page.evaluate('JSON.stringify(window.__perf)')
    const firstView = [...requests.values()]
    const nav = await page.evaluate('JSON.stringify(performance.getEntriesByType("navigation")[0].toJSON ? performance.getEntriesByType("navigation")[0].toJSON() : {})')
    const { domContentLoadedEventEnd: dcl, loadEventStart: load } = JSON.parse(nav)

    const perf = JSON.parse(first)
    const sum = (items, test) => items.filter(test).reduce((a, r) => a + r.bytes, 0)
    const byType = (t) => sum(firstView, (r) => r.type === t)
    results.push({
      fcp: perf.fcp,
      lcp: perf.lcp,
      cls: perf.cls,
      dcl,
      load,
      reqs: firstView.length,
      total: sum(firstView, () => true),
      html: byType('Document'),
      css: byType('Stylesheet'),
      js: byType('Script'),
      font: byType('Font'),
      img: byType('Image'),
      list: firstView,
    })

    if (run === 0) {
      await page.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
      await loadAndSettle(page, url, height)
      const all = [...requests.values()]
      results[0].afterScroll = { reqs: all.length, total: sum(all, () => true), img: sum(all, (r) => r.type === 'Image') }
    }
  } finally {
    page.close()
  }
}

const f = (key) => median(results.map((r) => r[key]))
console.log(`\n${url}  (${width}px, red ${net}, CPU x4, ${runs} corridas, mediana)`)
console.log(`  FCP ${f('fcp').toFixed(0)} ms | LCP ${f('lcp').toFixed(0)} ms | CLS ${f('cls').toFixed(3)} | load ${f('load').toFixed(0)} ms`)
console.log(`  hasta load: ${f('reqs')} pedidos, ${kb(f('total'))} (html ${kb(f('html'))}, css ${kb(f('css'))}, js ${kb(f('js'))}, fuentes ${kb(f('font'))}, imágenes ${kb(f('img'))})`)
if (results[0].afterScroll) console.log(`  recorriendo toda la página: ${results[0].afterScroll.reqs} pedidos, ${kb(results[0].afterScroll.total)} (imágenes ${kb(results[0].afterScroll.img)})`)
console.log('  pedidos hasta load (corrida 1):')
for (const r of results[0].list) console.log(`    ${kb(r.bytes).padStart(9)}  ${r.type.padEnd(10)} ${r.url.replace(/^https?:\/\/[^/]+/, '')}`)
