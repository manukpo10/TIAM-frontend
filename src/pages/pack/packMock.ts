import type { PackItem, PackOrder } from './packTypes'
import { PackApiError } from './packTypes'

/**
 * Fake backend for the Pack pages. Only reachable with VITE_PACK_MOCK=1 (see packClient.ts): without
 * that variable the dynamic import is dead code and this file never reaches a production build.
 *
 * Pick a scenario with the order token (the same URLs the real flow uses):
 *   /pack/gracias?o=mock-paid                         paid, pack only
 *   /pack/gracias?o=mock-full                         paid, with the extra booklet and the games month
 *   /pack/gracias?o=mock-pending&status=in_process    payment still being confirmed
 *   /pack/gracias?o=mock-cash&status=pending&payment_type=ticket   cash coupon waiting to be paid
 *   /pack/gracias?o=mock-flip                         pending for two polls (8 s), then paid
 *   /pack/gracias?o=mock-failed | mock-review | mock-lost (unknown order) | mock-offline (no connection)
 *   /pack/descargas/mock-paid | mock-full | mock-lost
 *   /pack/recuperar and /arrepentimiento: any input is accepted; use "fail@" in the email to see the error state.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const pack: PackItem = {
  code: 'PACK',
  title: 'Pack Básico · edición familias',
  files: [
    { key: 'pack-a4-completo', label: 'Pack completo (1 PDF)', paper: 'A4', sizeMb: 19 },
    { key: 'pack-a4-cuadernillos', label: 'Cuadernillos sueltos (ZIP)', paper: 'A4', sizeMb: 32 },
    { key: 'pack-carta-completo', label: 'Pack completo (1 PDF)', paper: 'CARTA', sizeMb: 19 },
    { key: 'pack-carta-cuadernillos', label: 'Cuadernillos sueltos (ZIP)', paper: 'CARTA', sizeMb: 32 },
  ],
}

const extra: PackItem = {
  code: 'EXTRA',
  title: 'Cuadernillo extra · 40 fichas más',
  files: [
    { key: 'extra-a4', label: 'Cuadernillo extra (1 PDF)', paper: 'A4', sizeMb: 7 },
    { key: 'extra-carta', label: 'Cuadernillo extra (1 PDF)', paper: 'CARTA', sizeMb: 7 },
  ],
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

const polls = new Map<string, number>()

function order(token: string): PackOrder {
  switch (token) {
    case 'mock-paid':
      return { status: 'PAID', firstName: 'Laura', edition: 'familias', items: [pack], games: null, expiresAt: inDays(90), total: 14990 }
    case 'mock-full':
      return {
        status: 'PAID',
        firstName: 'Laura',
        edition: 'familias',
        items: [pack, extra],
        games: { link: 'https://tiamdigital.com/desafio/mock-token' },
        expiresAt: inDays(90),
        total: 29990,
      }
    case 'mock-pending':
    case 'mock-cash':
      return { status: 'PENDING' }
    case 'mock-flip': {
      const n = (polls.get(token) ?? 0) + 1
      polls.set(token, n)
      return n < 3 ? { status: 'PENDING' } : order('mock-paid')
    }
    case 'mock-failed':
      return { status: 'FAILED' }
    case 'mock-review':
      return { status: 'REVIEW' }
    case 'mock-offline':
      throw new PackApiError('network')
    default:
      throw new PackApiError('not-found', 404)
  }
}

export async function mockCall<T>(method: string, path: string, body: unknown): Promise<T> {
  await wait(450)

  const order_ = /^\/packs\/orders\/([^/]+)$/.exec(path)
  if (method === 'GET' && order_) return order(decodeURIComponent(order_[1])) as T

  if (method === 'POST' && /^\/packs\/orders\/[^/]+\/confirm$/.test(path)) return undefined as T

  if (method === 'POST' && /^\/packs\/orders\/[^/]+\/files\/[^/]+\/link$/.test(path)) {
    await wait(500)
    return { url: '#descarga-simulada', expiresInSeconds: 300 } as T
  }

  const email = String((body as { email?: string } | undefined)?.email ?? '')
  if (method === 'POST' && (path === '/packs/access/resend' || path === '/packs/regret')) {
    if (email.startsWith('fail@')) throw new PackApiError('server', 503)
    return undefined as T
  }

  throw new PackApiError('not-found', 404)
}
