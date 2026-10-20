/**
 * Lógica pura (sin DOM, sin Vite) de las landings estáticas del pack.
 * La usan `pack/landing.ts` (formulario de compra) y `vite.config.ts` (precios, rutas y bonos que salen de la configuración).
 * Está probada en `tests/pack-logic.test.ts` (`npm test`). La app React (`src/`) NO la importa, para que las landings no compartan un chunk con ella.
 *
 * Importante: este archivo no puede importar nada de Vite ni del navegador, porque también lo corre Node directamente
 * (con `--experimental-strip-types`), y tiene que ser sintaxis borrable (`erasableSyntaxOnly`).
 */

/** "14.990" o "14990" -> 14990 ("14.990,50" -> 14990.5). Vacío, negativo o inválido -> 0. */
export function toNumber(value: unknown): number {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** 14990 -> "14.990" (punto de miles, sin depender de los datos de idioma del entorno). */
export function pesos(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Costo por unidad (por ejercicio, por ficha) en pesos enteros; 0 si no hay con qué dividir. */
export function perUnit(price: number, units: number): number {
  return price > 0 && units > 0 ? Math.round(price / units) : 0
}

export interface AddOn {
  checked: boolean
  disabled?: boolean
  price: number
}

/** Total que ve la persona y que viaja como `expected_total`: el precio base más cada oferta tildada y habilitada. */
export function computeTotal(base: number, addOns: readonly AddOn[]): number {
  return addOns.reduce((sum, a) => (a.checked && !a.disabled && Number.isFinite(a.price) && a.price > 0 ? sum + a.price : sum), base)
}

export type FormErrorProduct = 'pack' | 'cuadernos'

const FORM_ERROR_DEFAULT = 'No pudimos procesar tu compra. Revisá los datos y probá de nuevo.'

/** Avisos del backend cuando rechaza el formulario: vuelve a la landing con ?error=<código>. */
function formErrors(product: FormErrorProduct): Record<string, string> {
  return {
    cerrado: 'Las ventas están cerradas por el momento. Probá de nuevo más tarde o escribinos.',
    precio: 'El precio cambió mientras mirabas la página. Recargá la página para ver el precio actualizado y volvé a intentar.',
    pago: 'No pudimos abrir Mercado Pago y no se te cobró nada. Probá de nuevo en un momento.',
    email: 'Revisá el email: no parece válido.',
    nombre: 'Escribí tu nombre y apellido.',
    telefono: 'Para sumar los juegos necesitamos tu WhatsApp, con código de área.',
    meses: 'Ese número de WhatsApp ya tiene los meses de juegos disponibles. Sacá los juegos de tu compra o usá otro número.',
    limite: 'Hubo muchos intentos seguidos. Esperá unos minutos y volvé a probar.',
    edicion: `Recargá la página y volvé a elegir ${product === 'cuadernos' ? 'tus cuadernos' : 'tu pack'}.`,
    extras: 'Recargá la página y volvé a elegir lo que querés sumar.',
    origen: 'No pudimos verificar desde dónde se envió el pedido. Recargá la página y probá de nuevo.',
  }
}

/**
 * Mensaje para un código de `?error=`. Los códigos que no conocemos caen en el mensaje general y nunca se muestra el código tal cual.
 * `hasOwn`: un código como «constructor» o «toString» no debe leer propiedades heredadas del objeto.
 */
export function formErrorMessage(code: string | null | undefined, product: FormErrorProduct = 'pack'): string {
  const messages = formErrors(product)
  return code && Object.hasOwn(messages, code) ? messages[code] : FORM_ERROR_DEFAULT
}

export interface Bonus {
  title: string
  text: string
}

/**
 * Lista opcional de bonos que el dueño escribe en una sola variable (VITE_PACK_CUADERNOS_BONUSES):
 * `Título | descripción corta ;; Otro título | otra descripción`. Sin título, el ítem se descarta; la descripción es opcional.
 */
export function parseBonuses(raw: unknown): Bonus[] {
  const bonuses: Bonus[] = []
  for (const item of String(raw ?? '').split(';;')) {
    const cut = item.indexOf('|')
    const title = (cut === -1 ? item : item.slice(0, cut)).trim()
    const text = cut === -1 ? '' : item.slice(cut + 1).trim()
    if (title) bonuses.push({ title, text })
  }
  return bonuses
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Variable de configuración con el precio de cada producto. Los Pack comparten una; los cuadernos tienen la suya. */
export function priceEnvKey(slug: string): string {
  return slug === 'cuadernos' ? 'VITE_PACK_CUADERNOS_PRICE' : 'VITE_PACK_PRICE'
}

/**
 * Variable de configuración con lo que cuesta sumar el primer mes del Desafío de 30 días al comprar. Los Pack tienen la suya (10.000);
 * los cuadernos, otra (15.000). El precio normal del mes (20.000) no está acá: sale de PRICE_ARS de la página del Desafío.
 */
export function gamesPriceEnvKey(slug: string): string {
  return slug === 'cuadernos' ? 'VITE_PACK_CUADERNOS_GAMES_PRICE' : 'VITE_PACK_GAMES_PRICE'
}

/**
 * Dónde vive cada landing en el sitio. Los archivos están todos en `pack/<slug>/index.html` (entradas de Vite), pero los cuadernos se
 * muestran en `/cuadernos`, no en `/pack/cuadernos`. Si se agrega una landing: acá, en `vercel.json` (rewrite explícito antes del catch-all)
 * y en la lista de entradas de `vite.config.ts`.
 */
export const LANDING_ROUTES = {
  familias: '/pack/familias',
  profesionales: '/pack/profesionales',
  cuadernos: '/cuadernos',
} as const

export type LandingSlug = keyof typeof LANDING_ROUTES

/** `/cuadernos`, `/cuadernos/` -> `/pack/cuadernos/index.html` (conserva el query string). Cualquier otra URL queda igual. */
export function landingIndexFor(url: string): string {
  const q = url.indexOf('?')
  const pathname = q === -1 ? url : url.slice(0, q)
  const rest = q === -1 ? '' : url.slice(q)
  const clean = pathname.replace(/\/+$/, '')
  for (const [slug, route] of Object.entries(LANDING_ROUTES)) {
    if (clean === route) return `/pack/${slug}/index.html${rest}`
  }
  return url
}

/**
 * Variable con el destino del formulario de compra de cada landing (POST /packs/checkout). Los cuadernos tienen la suya: así su formulario está activo
 * mientras los formularios del Pack siguen apagados (VITE_PACK_CHECKOUT_URL vacía).
 */
export function checkoutUrlEnvKey(slug: string): string {
  return slug === 'cuadernos' ? 'VITE_PACK_CUADERNOS_CHECKOUT_URL' : 'VITE_PACK_CHECKOUT_URL'
}

/**
 * Estado de vista previa POR LANDING. `VITE_PACK_PREVIEW` prende la vista previa (cinta amarilla, `noindex`, datos provisorios) y `VITE_PACK_LIVE` lista las
 * landings que ya están en venta (hoy: `cuadernos`). Una landing está en vista previa solo si el interruptor está prendido Y no figura en la lista de las que están en venta.
 */
export function liveSlugs(raw: unknown): LandingSlug[] {
  const found: LandingSlug[] = []
  for (const part of String(raw ?? '').split(',')) {
    const slug = part.trim().toLowerCase()
    if (Object.hasOwn(LANDING_ROUTES, slug) && !found.includes(slug as LandingSlug)) found.push(slug as LandingSlug)
  }
  return found
}

export function isPreview(slug: string, previewOn: boolean, live: readonly string[]): boolean {
  return previewOn && !live.includes(slug)
}

export interface GuardResult {
  /** Variables obligatorias que faltan. */
  missing: readonly string[]
  /** Marcadores [[ASÍ]] que quedaron sin completar. */
  leftovers: readonly string[]
}

/**
 * Qué landings hacen fallar el build de producción (el control estricto de vite.config.ts):
 *  - una landing que está EN VENTA (no está en vista previa) falla si le falta un dato obligatorio o le quedó un marcador;
 *  - las que siguen en vista previa se publican igual, con su cinta (el Pack, mientras no se abra);
 *  - con el interruptor explícito (`PACK_STRICT=1`), TODAS tienen que estar completas y fuera de la vista previa.
 */
export function guardBlockers(results: Record<string, GuardResult>, live: readonly string[], previewOn: boolean, strictAll: boolean): string[] {
  const blockers: string[] = []
  for (const [slug, result] of Object.entries(results)) {
    const incomplete = result.missing.length > 0 || result.leftovers.length > 0
    const preview = isPreview(slug, previewOn, live)
    if ((!preview && incomplete) || (strictAll && (incomplete || preview))) blockers.push(slug)
  }
  return blockers
}
