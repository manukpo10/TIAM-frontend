import type { OrderConfirmation, PackItem, PackOrder, RegretReceipt } from './packTypes'
import { PackApiError } from './packTypes'

/**
 * Fake backend for the Pack pages. It only exists in a development build with VITE_PACK_MOCK=1 (see packClient.ts):
 * in a production build the condition is a compile-time `false`, so this file never reaches `dist/`. Build it with
 * `node scripts/pack-landings/build-mock.mjs <folder outside the repo>` (it sets NODE_ENV=development for you).
 * Every answer has the shape of the real one (src/pages/pack/contract/*.json are the backend's golden answers).
 *
 * Pick a scenario with the order token (the same URLs the real flow uses):
 *   /pack/gracias?o=mock-paid                         paid, pack only
 *   /pack/gracias?o=mock-full                         paid, with the extra booklet and the games month
 *   /pack/gracias?o=mock-cuadernos                    paid Cuadernos order with the Desafío month 2 (personal link, 30 days from the purchase)
 *   /pack/gracias?o=mock-cuadernos-nolink             same, but the link could not be generated and the month number is missing (WhatsApp fallback)
 *   /pack/gracias?o=mock-cuadernos-sin-juegos         paid Cuadernos order without any Desafío month (the block must not appear)
 *   /pack/gracias?o=mock-pending&status=in_process    payment still being confirmed
 *   /pack/gracias?o=mock-cash&status=pending&payment_type=ticket   cash coupon waiting to be paid
 *   /pack/gracias?o=mock-slow                         pending for two polls (8 s), then paid
 *   /pack/gracias?o=mock-failed                       failed for good (edition profesionales)
 *   /pack/gracias?o=mock-failed-noedition             failed, and the answer does not say which landing (generic "try again")
 *   /pack/gracias?o=mock-flip&payment_id=1            failed for two polls (about 20 s), then paid; the first two confirms answer
 *                                                     429 and 503, the way a busy backend would
 *   /pack/gracias?o=mock-review                       held for a manual check (edition profesionales)
 *   /pack/gracias?o=mock-weird                        a status this frontend does not know
 *   /pack/gracias?o=mock-lost (unknown order) | mock-offline (no connection)
 *   /pack/descargas/mock-paid | mock-full | mock-lost
 *   /pack/recuperar and /arrepentimiento: any input is accepted; use "fail@" in the email to see the error state.
 *
 * `window.__packMockLog` lists the calls the pages made (method and path with the token masked), for the browser checks.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const pack: PackItem = {
  code: 'PACK',
  title: 'Pack imprimible - Edición Familias',
  files: [
    { key: 'pack-completo-a4', label: 'Pack completo (1 PDF)', paper: 'A4', sizeMb: 19 },
    { key: 'cuadernillos-a4', label: 'Cuadernillos sueltos (ZIP)', paper: 'A4', sizeMb: 38 },
    { key: 'pack-completo-carta', label: 'Pack completo (1 PDF)', paper: 'Carta', sizeMb: 19 },
    { key: 'cuadernillos-carta', label: 'Cuadernillos sueltos (ZIP)', paper: 'Carta', sizeMb: 38 },
  ],
}

const extra: PackItem = {
  code: 'EXTRA',
  title: 'Cuadernillo extra',
  files: [
    { key: 'extra-a4', label: 'Cuadernillo extra (PDF)', paper: 'A4', sizeMb: 7 },
    { key: 'extra-carta', label: 'Cuadernillo extra (PDF)', paper: 'Carta', sizeMb: 7 },
  ],
}

const cuadernos: PackItem = {
  code: 'PACK',
  title: 'Cuadernos TIAM',
  files: [
    { key: 'coleccion-completa-a4', label: 'Colección completa: los 4 cuadernos en 1 PDF', paper: 'A4', sizeMb: 27 },
    { key: 'cuaderno-1-a4', label: 'Cuaderno 1 · Nivel inicial', paper: 'A4', sizeMb: 7 },
    { key: 'coleccion-completa-carta', label: 'Colección completa: los 4 cuadernos en 1 PDF', paper: 'Carta', sizeMb: 27 },
    { key: 'cuaderno-1-carta', label: 'Cuaderno 1 · Nivel inicial', paper: 'Carta', sizeMb: 7 },
  ],
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

/** A paid Cuadernos order. `games`: 'month' = month 2 with its link, 'nolink' = month granted but no link (and no month number), 'none' = none granted. */
const cuadernosOrder = (games: 'month' | 'nolink' | 'none'): PackOrder => ({
  status: 'PAID',
  firstName: 'Laura',
  edition: 'cuadernos',
  items: [cuadernos],
  games:
    games === 'none'
      ? null
      : {
          link: games === 'month' ? 'https://tiamdigital.com/desafio/mock-token' : null,
          monthsIncluded: 1,
          ...(games === 'month' ? { month: 2 } : {}),
          durationDays: 30,
          startsAt: 'purchase',
          nextMonthsPaidSeparately: true,
          nextMonthPriceArs: 20000,
        },
  expiresAt: inDays(90),
  total: games === 'none' ? 20000 : 35000,
})

/** The answer for an order that is not paid: everything is empty except the edition. */
const unpaid = (status: PackOrder['status'], edition: PackOrder['edition']): PackOrder => ({
  status,
  firstName: null,
  edition,
  items: [],
  games: null,
  expiresAt: null,
  total: null,
})

const polls = new Map<string, number>()
const confirms = new Map<string, number>()

const bump = (counter: Map<string, number>, token: string) => {
  const n = (counter.get(token) ?? 0) + 1
  counter.set(token, n)
  return n
}

const paidOrder = (full: boolean): PackOrder => ({
  status: 'PAID',
  firstName: 'Laura',
  edition: 'familias',
  items: full ? [pack, extra] : [pack],
  games: full ? { link: 'https://tiamdigital.com/desafio/mock-token' } : null,
  expiresAt: inDays(90),
  // 14990 pack + 4990 extra + 10000 games month, as the backend would charge it
  total: full ? 29980 : 14990,
})

/** What GET /packs/orders/{token} answers. `advance` counts the poll: the scenarios that change over time use it. */
function order(token: string, advance: boolean): PackOrder {
  switch (token) {
    case 'mock-paid':
      return paidOrder(false)
    case 'mock-full':
      return paidOrder(true)
    case 'mock-cuadernos':
      return cuadernosOrder('month')
    case 'mock-cuadernos-nolink':
      return cuadernosOrder('nolink')
    case 'mock-cuadernos-sin-juegos':
      return cuadernosOrder('none')
    case 'mock-pending':
    case 'mock-cash':
      return unpaid('PENDING', 'familias')
    case 'mock-slow': {
      const n = advance ? bump(polls, token) : (polls.get(token) ?? 0)
      return n < 3 ? unpaid('PENDING', 'familias') : paidOrder(false)
    }
    case 'mock-flip': {
      const n = advance ? bump(polls, token) : (polls.get(token) ?? 0)
      return n < 3 ? unpaid('FAILED', 'familias') : paidOrder(false)
    }
    case 'mock-failed':
      return unpaid('FAILED', 'profesionales')
    case 'mock-failed-noedition':
      return unpaid('FAILED', null)
    case 'mock-review':
      return unpaid('REVIEW', 'profesionales')
    case 'mock-weird':
      return unpaid('EXPIRED' as string as PackOrder['status'], 'familias')
    case 'mock-offline':
      throw new PackApiError('network')
    default:
      throw new PackApiError('not-found', 404)
  }
}

function confirm(token: string): OrderConfirmation {
  const n = bump(confirms, token)
  if (token === 'mock-flip' && n === 1) throw new PackApiError('rate-limited', 429)
  if (token === 'mock-flip' && n === 2) throw new PackApiError('server', 503)
  return { status: order(token, false).status }
}

const receipt = (): RegretReceipt => ({ reference: 'ARR-000012', receivedAt: new Date().toISOString() })

declare global {
  interface Window {
    __packMockLog?: string[]
  }
}

export async function mockCall<T>(method: string, path: string, body: unknown): Promise<T> {
  const log = (window.__packMockLog ??= [])
  log.push(`${method} ${path.replace(/^(\/packs\/orders\/)[^/]+/, '$1{token}')} @${Math.round(performance.now())}`)
  await wait(450)

  const order_ = /^\/packs\/orders\/([^/]+)$/.exec(path)
  if (method === 'GET' && order_) return order(decodeURIComponent(order_[1]), true) as T

  const confirm_ = /^\/packs\/orders\/([^/]+)\/confirm$/.exec(path)
  if (method === 'POST' && confirm_) return confirm(decodeURIComponent(confirm_[1])) as T

  if (method === 'POST' && /^\/packs\/orders\/[^/]+\/files\/[^/]+\/link$/.test(path)) {
    await wait(500)
    return { url: '#descarga-simulada', expiresInSeconds: 300 } as T
  }

  const email = String((body as { email?: string } | undefined)?.email ?? '')
  if (method === 'POST' && path === '/packs/access/resend') {
    if (email.startsWith('fail@')) throw new PackApiError('server', 503)
    return undefined as T
  }
  if (method === 'POST' && path === '/packs/regret') {
    if (email.startsWith('fail@')) throw new PackApiError('server', 503)
    return receipt() as T
  }

  throw new PackApiError('not-found', 404)
}
