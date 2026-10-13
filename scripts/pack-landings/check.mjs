// Verificación automática de las landings en Chrome headless (sin dependencias).
//
// Uso, desde la raíz del repo (con `npm run build` hecho y `npx vite preview` andando):
//   node scripts/pack-landings/check.mjs http://localhost:4173/pack/familias [--widths 320,390,768,1440]
//
// Revisa, por cada ancho: errores de consola y de red, desborde horizontal, objetivos táctiles de
// menos de 44 px, contraste de texto (aproximado: cuenta degradados con su color más claro),
// imágenes (alt, medidas, resolución), tipografías cargadas y orden de los títulos.
// Es una ayuda, no reemplaza mirar la página.

import { loadAndSettle, openPage } from './cdp.mjs'

const url = process.argv[2]
if (!url) throw new Error('Uso: node check.mjs <url> [--widths 320,390,768,1440]')
const widthsArg = process.argv.indexOf('--widths')
const widths = (widthsArg > -1 ? process.argv[widthsArg + 1] : '320,390,768,1440').split(',').map(Number)

// Corre dentro de la página: devuelve un objeto con los hallazgos.
const PAGE_CHECKS = `(() => {
  const dpr = devicePixelRatio
  const out = { overflow: [], taps: [], contrast: [], images: [], headings: [], landmarks: {}, fonts: [], buy: [] }

  // ── desborde horizontal ──
  const vw = document.documentElement.clientWidth
  out.scrollWidth = document.documentElement.scrollWidth
  out.clientWidth = vw
  // Lo que está dentro de un carrusel horizontal (la galería) sale del ancho a propósito: se desliza.
  const inStrip = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('[hidden]') && !inStrip(el)) {
      out.overflow.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' ' + Math.round(r.left) + '..' + Math.round(r.right))
      if (out.overflow.length > 8) break
    }
  }

  // ── objetivos táctiles ──
  for (const el of document.querySelectorAll('a[href], button, summary, [role=button]')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue
    if (el.closest('.sticky-cta') && getComputedStyle(el.closest('.sticky-cta')).visibility === 'hidden') {
      // la barra está oculta: se mide igual
    }
    const r = el.getBoundingClientRect()
    if (!r.width) continue
    const inline = cs.display === 'inline' && !!el.closest('p, li, dd')
    if (!inline && (r.height < 43.5 || r.width < 43.5)) out.taps.push(el.tagName.toLowerCase() + ' "' + (el.textContent || '').trim().slice(0, 30) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height))
  }

  // ── contraste ──
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  const bgOf = (el) => {
    // pila de fondos de adentro hacia afuera; con degradado se toma el color más claro (peor caso para texto claro)
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      const bg = parse(cs.backgroundColor)
      if (bg && bg.a > 0) layers.push(bg)
      if (/gradient\\(/.test(cs.backgroundImage)) {
        const cols = [...cs.backgroundImage.matchAll(/rgba?\\([^)]+\\)/g)].map((m) => parse(m[0])).filter(Boolean)
        if (cols.length) {
          cols.sort((x, y) => lum(y) - lum(x))
          layers.push(cols[0])
        }
      }
      if (layers.some((l) => l.a >= 1)) break
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (const l of layers.reverse()) base = over(l, base)
    return base
  }
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden]') || el.closest('svg') || el.closest('.sr-only')) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const fg = parse(cs.color)
    if (!fg) continue
    const bg = bgOf(el)
    const c = ratio(over(fg, bg), bg)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    const key = cs.color + '|' + JSON.stringify(bg) + '|' + size
    if (c < need && !seen.has(key)) {
      seen.add(key)
      out.contrast.push(c.toFixed(2) + ' (<' + need + ') ' + (el.textContent || '').trim().slice(0, 40) + ' [' + cs.color + ' sobre rgb(' + [bg.r, bg.g, bg.b].map(Math.round) + ') ' + size + 'px]')
    }
  }

  // ── imágenes ──
  for (const img of document.images) {
    const r = img.getBoundingClientRect()
    const need = r.width * dpr
    const entry = { src: (img.currentSrc || img.src).split('/').pop(), alt: img.getAttribute('alt'), shown: Math.round(r.width) + 'x' + Math.round(r.height), natural: img.naturalWidth + 'x' + img.naturalHeight, loading: img.loading, hasSize: img.hasAttribute('width') && img.hasAttribute('height') }
    entry.problems = []
    if (img.getAttribute('alt') === null) entry.problems.push('sin alt')
    if (!entry.hasSize) entry.problems.push('sin width/height')
    if (r.width && need > img.naturalWidth * 1.15) entry.problems.push('baja resolución para ' + dpr + 'x')
    out.images.push(entry)
  }

  // ── títulos, hitos, tipografías, botones de compra ──
  let prev = 0
  for (const h of document.querySelectorAll('h1,h2,h3,h4')) {
    if (h.closest('[hidden]')) continue
    const level = +h.tagName[1]
    out.headings.push(h.tagName + ' ' + (h.textContent || '').trim().slice(0, 50) + (prev && level > prev + 1 ? '  <-- salto de nivel' : ''))
    prev = level
  }
  for (const tag of ['header', 'main', 'footer', 'nav']) out.landmarks[tag] = document.querySelectorAll(tag).length
  out.fonts = [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status)
  out.buy = [...document.querySelectorAll('a[data-buy]')].map((a) => a.getAttribute('href'))
  out.lang = document.documentElement.lang
  out.viewportMeta = document.querySelector('meta[name=viewport]')?.content
  return out
})()`

let problems = 0
for (const width of widths) {
  const height = width >= 768 ? 900 : 844
  const page = await openPage({ width, height })
  const errors = []
  const failed = []
  page.on('Runtime.exceptionThrown', (p) => errors.push('excepción: ' + (p.exceptionDetails.exception?.description ?? p.exceptionDetails.text)))
  page.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') errors.push(p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' '))
  })
  page.on('Network.loadingFailed', (p) => failed.push('falló ' + (p.errorText ?? '') + ' ' + (p.requestId ?? '')))
  page.on('Network.responseReceived', (p) => {
    if (p.response.status >= 400) failed.push(p.response.status + ' ' + p.response.url)
  })
  try {
    await loadAndSettle(page, url, height)
    const r = await page.evaluate(PAGE_CHECKS)
    const lines = []
    const note = (label, items) => items.length && lines.push(`  ${label} (${items.length}):\n    - ${items.join('\n    - ')}`)
    if (r.scrollWidth > r.clientWidth + 1) lines.push(`  DESBORDE HORIZONTAL: scrollWidth ${r.scrollWidth} > ancho ${r.clientWidth}`)
    note('elementos fuera del ancho', r.overflow)
    note('objetivos táctiles < 44 px', r.taps)
    note('contraste insuficiente', r.contrast)
    note('imágenes con problemas', r.images.filter((i) => i.problems.length).map((i) => `${i.src} ${i.shown} (natural ${i.natural}): ${i.problems.join(', ')}`))
    note('consola', errors)
    note('red', failed)
    if (!r.landmarks.main || !r.landmarks.header || !r.landmarks.footer) lines.push(`  hitos incompletos: ${JSON.stringify(r.landmarks)}`)
    if (!r.fonts.length || r.fonts.some((f) => !f.endsWith('loaded'))) lines.push(`  tipografías: ${r.fonts.join(' | ')}`)
    console.log(`\n== ${url} a ${width}px: ${lines.length ? 'HALLAZGOS' : 'sin hallazgos'}`)
    if (lines.length) console.log(lines.join('\n'))
    problems += lines.length
    if (width === widths[0]) {
      console.log(`  lang=${r.lang}; viewport="${r.viewportMeta}"; hitos ${JSON.stringify(r.landmarks)}`)
      console.log(`  tipografías: ${r.fonts.join(' | ')}`)
      console.log(`  títulos:\n    ${r.headings.join('\n    ')}`)
      console.log(`  botones de compra: ${r.buy.length} -> ${[...new Set(r.buy)].join(', ')}`)
    }
  } finally {
    page.close()
  }
}
console.log(problems ? `\n${problems} grupos de hallazgos` : '\nTodo en orden')
