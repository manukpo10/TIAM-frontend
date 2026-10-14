import type { DownloadLink, PackOrder, RegretRequest } from './packTypes'
import { PackApiError } from './packTypes'

/**
 * Client for the Pack checkout API. Deliberately NOT built on lib/api.ts: those pages are public, so
 * the request must never carry the professional's JWT, never trigger the "bounce to /login on 401"
 * behaviour, and never go through the SaaS mock layer.
 *
 * Security rules kept here (design 2.9):
 *  - the order token only travels in the request path, never in a query string;
 *  - no Referer, no cookies, no caching;
 *  - nothing is logged and errors never include the path.
 *
 * `VITE_PACK_MOCK=1` (development only) answers every call from ./packMock instead of the network.
 */

const BASE_URL: string = String(import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const MOCK = import.meta.env.VITE_PACK_MOCK === '1'

// The hosted backend can be asleep (free plan): the first request may take about a minute to answer.
const TIMEOUT_MS = 75_000

type Method = 'GET' | 'POST'

async function call<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (MOCK) {
    const { mockCall } = await import('./packMock')
    return mockCall<T>(method, path, body)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
  } catch {
    throw new PackApiError('network')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromCaller)
  }

  if (!res.ok) {
    if (res.status === 404) throw new PackApiError('not-found', 404)
    if (res.status === 429) throw new PackApiError('rate-limited', 429)
    throw new PackApiError(res.status >= 500 ? 'server' : 'client', res.status)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text().catch(() => '')
  if (!text) return undefined as T
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return undefined as T
  }
  // The backend wraps JSON answers in { success, data, message }; unwrap it like lib/api.ts does.
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) return (json as { data: T }).data
  return json as T
}

const orderPath = (token: string) => `/packs/orders/${encodeURIComponent(token)}`

/** Order summary. 404 = unknown, expired, revoked or not paid yet: the backend never says which. */
export function getOrder(token: string, signal?: AbortSignal): Promise<PackOrder> {
  return call<PackOrder>('GET', orderPath(token), undefined, signal)
}

/**
 * Asks the backend to verify a Mercado Pago payment id against the order (it re-reads the payment
 * from Mercado Pago, it does not trust us). Lets the buyer in before the webhook arrives.
 */
export function confirmPayment(token: string, paymentId: string): Promise<void> {
  return call<void>('POST', `${orderPath(token)}/confirm`, { paymentId })
}

/** A signed, short-lived URL for one file. A POST on purpose: mail scanners that open links must not burn the download quota. */
export function requestFileLink(token: string, fileKey: string): Promise<DownloadLink> {
  return call<DownloadLink>('POST', `${orderPath(token)}/files/${encodeURIComponent(fileKey)}/link`, {})
}

/** Always answers the same whatever the email (the backend replies 202 even if there is no order). */
export function resendAccess(email: string): Promise<void> {
  return call<void>('POST', '/packs/access/resend', { email })
}

export function sendRegret(request: RegretRequest): Promise<void> {
  return call<void>('POST', '/packs/regret', request)
}

/**
 * Only https (or a same-site path) is followed after a download link comes back from the API, so a
 * tampered answer can never navigate the buyer to a javascript: or data: URL.
 */
export function safeNavigationUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.href)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol === 'https:' || (local && url.protocol === 'http:')) return url.href
    return null
  } catch {
    return null
  }
}
