/**
 * JavaScript de las landings del pack. Casi nada, a propósito: la página es HTML y CSS.
 *
 * Hace cinco cosas (todas son mejoras: el formulario de compra funciona también sin este archivo):
 *  1. Formulario de compra (form[data-checkout]): completa los campos ocultos (utm_*, fbclid y el total que
 *     ve la persona, para que el servidor avise si el precio cambió), pide el teléfono solo si se eligió
 *     «juegos», evita el doble envío y muestra el aviso cuando el backend vuelve con ?error=.
 *  2. Ofertas al pagar (casillas dentro de [data-offer]): suman su precio al total. Los precios vienen del
 *     HTML, que los toma de la configuración.
 *  3. Barra de compra del celular: aparece cuando no se ve ningún botón de compra principal.
 *  4. Aviso de promo ([data-promo-end]): se oculta solo pasada la fecha.
 *  5. Pixel de Meta, solo si hay un ID configurado (VITE_META_PIXEL_ID): PageView y ViewContent al
 *     cargar, InitiateCheckout al enviar el formulario.
 *
 * Los botones de compra ya no llevan a ningún lado: son anclas. Con checkout bajan a la tarjeta del formulario
 * (#pedido); sin checkout, a la sección de precio (#comprar), como antes.
 *
 * Privacidad: el email, el nombre y el teléfono nunca viajan por la URL. Solo se guardan en sessionStorage de
 * esta pestaña mientras dura el viaje a Mercado Pago, para no pedirlos de nuevo si el backend vuelve con un error.
 */

import { computeTotal, formErrorMessage, pesos, toNumber } from './logic.ts'

// Parámetros de la visita que se guardan con el pedido. fbclid lo agrega Meta a los clics de los anuncios.
const PASS_THROUGH = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']

// data-pack: qué landing es (familias, profesionales o cuadernos). Las de los cuadernos suman data-pack-price (el precio de la
// configuración, para el Pixel) y data-pack-content / data-pack-category (cómo se llama en el Pixel); las del Pack no los tienen.
const { pack = '', packPrice, packContent, packCategory } = document.body.dataset

const incoming = new URLSearchParams(location.search)

// Los avisos del backend (?error=<código>) y el total salen de pack/logic.ts, que tiene sus pruebas (npm test).
const product = pack === 'cuadernos' ? 'cuadernos' : 'pack'

const DRAFT_KEY = 'tiam.pack.draft'

type Draft = { email?: string; nombre?: string; telefono?: string; extras?: string[] }

const storage = {
  read(): Draft | null {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      return raw ? (JSON.parse(raw) as Draft) : null
    } catch {
      return null
    }
  },
  write(draft: Draft) {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* sin almacenamiento (modo privado): no pasa nada */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      /* idem */
    }
  },
}

// ── Pixel de Meta (se arma primero porque lo usa el formulario) ────────────────────────────
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

let track: (event: string, value?: number) => void = () => {}

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
  const price = toNumber(packPrice ?? import.meta.env.VITE_PACK_PRICE)
  const content = {
    content_name: packContent ?? `pack-${pack}`,
    content_category: packCategory ?? 'pack-fichas',
    content_type: 'product',
    currency: 'ARS',
    ...(price > 0 ? { value: price } : {}),
  }

  // Con `value` (el total del formulario, ya con las ofertas) se manda ese monto en vez del precio base.
  track = (event, value) => fbq('track', event, value && value > 0 ? { ...content, value } : content)

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

// ── 1 y 2. Formulario de compra y ofertas al pagar ─────────────────────────────────────────
const offer = document.querySelector<HTMLElement>('[data-offer]')
const form = document.querySelector<HTMLFormElement>('form[data-checkout]')
const field = <T extends HTMLElement>(selector: string) => form?.querySelector<T>(selector) ?? null

let currentTotal = Number(offer?.dataset.base ?? 0)

if (offer) {
  const base = Number(offer.dataset.base ?? 0)
  const boxes = [...offer.querySelectorAll<HTMLInputElement>('input[data-price]')]
  const totals = [...document.querySelectorAll<HTMLElement>('[data-total]')]

  // Teléfono: solo hace falta con «juegos». Sin JavaScript el campo se ve siempre y el servidor es quien lo exige.
  const phoneBox = field<HTMLElement>('[data-phone]')
  const phoneInput = field<HTMLInputElement>('input[name="telefono"]')
  const phoneHint = field<HTMLElement>('[data-phone-opt]')
  const gamesBox = boxes.find((box) => box.value === 'juegos')
  form?.setAttribute('data-js', '')

  const update = () => {
    currentTotal = computeTotal(
      base,
      boxes.map((box) => ({ checked: box.checked, disabled: box.disabled, price: Number(box.dataset.price ?? 0) })),
    )
    for (const el of totals) el.textContent = `$\u00a0${pesos(currentTotal)}`

    const needsPhone = !!gamesBox?.checked && !gamesBox.disabled
    if (phoneBox) phoneBox.toggleAttribute('data-open', needsPhone)
    if (phoneInput) phoneInput.required = needsPhone
    if (phoneHint) phoneHint.hidden = needsPhone
  }
  for (const box of boxes) box.addEventListener('change', update)
  update()
  // Al volver con «atrás» desde Mercado Pago el navegador puede devolver la página con las casillas como estaban.
  addEventListener('pageshow', update)
}

if (form) {
  const submit = field<HTMLButtonElement>('[data-submit]')
  const label = field<HTMLElement>('[data-submit-label]')
  const status = field<HTMLElement>('[data-form-status]')
  const errorBox = field<HTMLElement>('[data-form-error]')
  const labelIdle = label?.textContent ?? ''
  let sending = false
  let slowTimer: number | undefined

  // utm_* y fbclid de la visita, en los campos ocultos (los vacíos no se envían, ver más abajo).
  for (const key of PASS_THROUGH) {
    const input = field<HTMLInputElement>(`input[name="${key}"]`)
    const value = incoming.get(key)
    if (input && value) input.value = value.slice(0, 200)
  }

  const showError = (message: string) => {
    if (!errorBox) return
    errorBox.textContent = message
    errorBox.hidden = false
  }

  const setBusy = (busy: boolean) => {
    sending = busy
    clearTimeout(slowTimer)
    if (!submit || !label || !status) return
    if (busy) submit.setAttribute('aria-disabled', 'true')
    else submit.removeAttribute('aria-disabled')
    submit.classList.toggle('is-busy', busy)
    label.textContent = busy ? 'Abriendo Mercado Pago…' : labelIdle
    status.hidden = !busy
    status.textContent = busy ? 'Te estamos llevando a Mercado Pago para que pagues.' : ''
    // El servidor puede tardar en despertar: se avisa para que nadie cierre la página ni vuelva a tocar el botón.
    if (busy) {
      slowTimer = window.setTimeout(() => {
        status.textContent = 'Todavía estamos conectando. Es normal que tarde unos segundos: no cierres la página ni vuelvas a tocar el botón.'
      }, 6000)
    }
  }

  form.addEventListener('submit', (event) => {
    if (sending) {
      event.preventDefault()
      return
    }
    // El navegador ya validó los campos (required, email, largo). Acá solo se completa lo que falta.
    const totalInput = field<HTMLInputElement>('input[name="expected_total"]')
    if (totalInput) totalInput.value = String(currentTotal)
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')) {
      if (input.name !== 'edicion' && input.name !== 'expected_total' && !input.value) input.disabled = true // no mandar vacíos
    }
    const data = new FormData(form)
    storage.write({
      email: String(data.get('email') ?? ''),
      nombre: String(data.get('nombre') ?? ''),
      telefono: String(data.get('telefono') ?? ''),
      extras: data.getAll('extras').map(String),
    })
    track('InitiateCheckout', currentTotal)
    setBusy(true)
  })

  // Volver con «atrás» desde Mercado Pago: el botón tiene que quedar usable y los campos que se deshabilitaron, de vuelta.
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')) input.disabled = false
    setBusy(false)
  })

  // Vuelta del backend con un error: aviso al lado del botón, datos que ya había escrito y la tarjeta a la vista.
  const code = incoming.get('error')
  if (code) {
    showError(formErrorMessage(code, product))
    const draft = storage.read()
    if (draft) {
      const set = (name: string, value?: string) => {
        const input = field<HTMLInputElement>(`input[name="${name}"]`)
        if (input && value) input.value = value
      }
      set('email', draft.email)
      set('nombre', draft.nombre)
      set('telefono', draft.telefono)
      for (const box of form.querySelectorAll<HTMLInputElement>('input[name="extras"]')) {
        box.checked = !!draft.extras?.includes(box.value) && !box.disabled
        box.dispatchEvent(new Event('change'))
      }
    }
    // La URL vuelve a quedar limpia: recargar la página no repite el aviso.
    const clean = new URL(location.href)
    clean.searchParams.delete('error')
    history.replaceState(history.state, '', clean.pathname + clean.search + clean.hash)
    const reveal = () => form.scrollIntoView({ block: 'start' })
    requestAnimationFrame(reveal)
    addEventListener('load', reveal, { once: true })
  } else {
    storage.clear()
  }
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
