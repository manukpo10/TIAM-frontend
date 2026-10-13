/**
 * JavaScript de las landings del pack. Casi nada, a propósito: la página es HTML y CSS.
 *
 * Hace cinco cosas:
 *  1. Botones de compra (a[data-buy]): suman al enlace la edición y los utm_* con que llegó la visita.
 *  2. Ofertas al pagar (casillas dentro de [data-offer]): suman su precio al total y avisan al checkout
 *     cuáles se eligieron (?extras=juegos,...). Los precios vienen del HTML, que los toma de la configuración.
 *  3. Barra de compra del celular: aparece cuando no se ve ningún botón de compra principal.
 *  4. Aviso de promo ([data-promo-end]): se oculta solo pasada la fecha.
 *  5. Pixel de Meta, solo si hay un ID configurado (VITE_META_PIXEL_ID): PageView y ViewContent al
 *     cargar, InitiateCheckout al tocar un botón de compra.
 */

// Parámetros que se reenvían al checkout. fbclid lo agrega Meta a los clics de los anuncios.
const PASS_THROUGH = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']

const { pack = '', edicion = '' } = document.body.dataset

const pesos = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ── 1. Botones de compra ───────────────────────────────────────────────────────────────
// Sin checkout configurado, el botón apunta a una ancla de la misma página (#comprar): no hay nada que reenviar.
const incoming = new URLSearchParams(location.search)
const buyLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[data-buy]')]
const isCheckout = (link: HTMLAnchorElement) => !(link.getAttribute('href') ?? '#').startsWith('#')

function buildCheckoutUrl(link: HTMLAnchorElement, extras: string[]): string | null {
  try {
    const url = new URL(link.dataset.base ?? '', location.href)
    if (edicion) url.searchParams.set('edicion', edicion)
    if (extras.length) url.searchParams.set('extras', extras.join(','))
    for (const key of PASS_THROUGH) {
      const value = incoming.get(key)
      if (value) url.searchParams.set(key, value)
    }
    return url.href
  } catch {
    return null // URL inválida: el enlace queda como está
  }
}

function refreshLinks(extras: string[]) {
  for (const link of buyLinks) {
    if (!isCheckout(link)) continue
    link.dataset.base ??= link.getAttribute('href') ?? ''
    const href = buildCheckoutUrl(link, extras)
    if (href) link.href = href
  }
}
refreshLinks([])

// ── 2. Ofertas al pagar ────────────────────────────────────────────────────────────────
const offer = document.querySelector<HTMLElement>('[data-offer]')
if (offer) {
  const base = Number(offer.dataset.base ?? 0)
  const boxes = [...offer.querySelectorAll<HTMLInputElement>('input[data-price]')]
  const totals = [...document.querySelectorAll<HTMLElement>('[data-total]')]
  const update = () => {
    const on = boxes.filter((box) => box.checked && !box.disabled)
    const total = base + on.reduce((sum, box) => sum + Number(box.dataset.price ?? 0), 0)
    for (const el of totals) el.textContent = `$\u00a0${pesos(total)}`
    refreshLinks(on.map((box) => box.value))
  }
  for (const box of boxes) box.addEventListener('change', update)
  update()
}

// ── 3. Barra de compra del celular ─────────────────────────────────────────────────────
const bar = document.getElementById('sticky-cta')
const watched = document.querySelectorAll<HTMLElement>('[data-watch-cta]')
if (bar && watched.length && 'IntersectionObserver' in window) {
  const inView = new Set<Element>()
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) inView.add(entry.target)
      else inView.delete(entry.target)
    }
    bar.toggleAttribute('data-on', inView.size === 0)
  })
  for (const el of watched) observer.observe(el)
}

// ── 4. Promo con fecha de fin: pasada la fecha, el aviso desaparece ────────────────────
const promo = document.querySelector<HTMLElement>('[data-promo-end]')
if (promo) {
  const end = new Date(`${promo.dataset.promoEnd}T23:59:59`)
  if (!Number.isNaN(end.getTime()) && end < new Date()) promo.hidden = true
}

// ── 5. Pixel de Meta ───────────────────────────────────────────────────────────────────
type Fbq = {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded: boolean
  version: string
  push: Fbq
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

const PIXEL_ID: string = import.meta.env.VITE_META_PIXEL_ID ?? ''

let track: (event: string) => void = () => {}

if (PIXEL_ID) {
  // Código base del Pixel (cola de eventos hasta que carga fbevents.js).
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq

  // Precio como número (si no está cargado, no se manda value).
  const price = Number(String(import.meta.env.VITE_PACK_PRICE ?? '').replace(/\./g, '').replace(',', '.'))
  const content = {
    content_name: `pack-${pack}`,
    content_category: 'pack-fichas',
    content_type: 'product',
    currency: 'ARS',
    ...(Number.isFinite(price) && price > 0 ? { value: price } : {}),
  }

  track = (event) => fbq('track', event, content)

  // Se carga después de `load`: no compite con el texto, las tipografías ni las imágenes.
  const start = () => {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
    fbq('init', PIXEL_ID)
    fbq('track', 'PageView')
    track('ViewContent')
  }
  if (document.readyState === 'complete') start()
  else addEventListener('load', start, { once: true })
}

// Toque en un botón de compra: avisa al Pixel. Sin checkout configurado, el botón baja a la sección de precio y no mide nada.
document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-buy]')
  if (!link || !isCheckout(link)) return
  track('InitiateCheckout')
})
