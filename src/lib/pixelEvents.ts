/**
 * Pure rules of the Meta Pixel Purchase event, kept apart from lib/metaPixel.ts (which reads Vite's env and so cannot run under
 * `node --test`). Tests: tests/pixel-events.test.ts (`npm test`).
 *
 *  - The eventID of a purchase is derived from the order's access token with SHA-256, so it is the same on every load of the
 *    thank-you page for that order, and the token itself never leaves the browser (the hash cannot be reversed).
 *  - The "already sent" memory lives in localStorage (it survives a closed tab and a second tab, unlike sessionStorage) and holds
 *    only those opaque ids, the latest 20.
 *  - The event's parameters are built from an allow-list: currency, value, content_type, content_category and content_name.
 *    Nothing about the buyer, the token, the file names or anything health-related can get in.
 */

import { purchaseCategory } from '../pages/pack/orderRules.ts'
import { purchaseValue } from './purchaseValue.ts'

export interface PurchaseStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORE_KEY = 'tiam.meta.purchases'
const KEEP = 20

/** `tiam-purchase-<32 hex>`, or null without a token or without Web Crypto (an insecure page): then there is no id and only the session flag guards. */
export async function purchaseEventId(token: string): Promise<string | null> {
  const clean = token.trim()
  const subtle = globalThis.crypto?.subtle
  if (!clean || !subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`tiam.purchase:${clean}`))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `tiam-purchase-${hex.slice(0, 32)}`
}

function readIds(store: PurchaseStore): string[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** True when this order's Purchase already went out from this browser. An unreadable storage answers false (the session flag is the second guard). */
export function wasPurchaseSent(store: PurchaseStore | null, eventId: string): boolean {
  return !!store && readIds(store).includes(eventId)
}

/** Remembers that this order's Purchase went out. Never throws: with the storage blocked it just cannot remember. */
export function rememberPurchase(store: PurchaseStore | null, eventId: string): void {
  if (!store) return
  try {
    const ids = readIds(store).filter((id) => id !== eventId)
    ids.push(eventId)
    store.setItem(STORE_KEY, JSON.stringify(ids.slice(-KEEP)))
  } catch {
    /* private mode or full storage: nothing to do */
  }
}

/** localStorage when the browser lets us use it, otherwise null. */
export function browserStore(): PurchaseStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The product name the landings send in ViewContent / InitiateCheckout (pack/landing.ts): "cuadernos" or "pack-<edition>". */
function contentName(edition: string | null | undefined): string | undefined {
  if (!edition) return undefined
  return edition === 'cuadernos' ? 'cuadernos' : `pack-${edition}`
}

/**
 * Parameters of the Purchase event, from an allow-list. `value` is the order total in ARS and is left out (never invented)
 * when the total is missing or unusable. Any other field of the order is ignored on purpose.
 */
export function purchaseParams(order: { total?: unknown; edition?: string | null }): Record<string, string | number> {
  const value = purchaseValue(order.total)
  const name = contentName(order.edition)
  return {
    currency: 'ARS',
    content_type: 'product',
    content_category: purchaseCategory(order.edition),
    ...(name ? { content_name: name } : {}),
    ...(value === null ? {} : { value }),
  }
}

/** The arguments of `fbq(...)` for a standard event. Meta reads the eventID from the fourth argument. */
export function trackArgs(event: string, params?: Record<string, unknown>, eventId?: string | null): unknown[] {
  return eventId ? ['track', event, params, { eventID: eventId }] : ['track', event, params]
}
