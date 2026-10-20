/**
 * Small rules of the gracias / descargas / recuperar pages. Pure on purpose: they have their tests in tests/order-rules.test.ts (`npm test`).
 */

import type { PackItem } from './packTypes'

/** The `content_category` of the Meta Pixel Purchase event: the Cuadernos have their own, the Pack orders keep "pack-fichas". */
export function purchaseCategory(edition: string | null | undefined): string {
  return edition === 'cuadernos' ? 'cuadernos' : 'pack-fichas'
}

/** A paid order that lists no file to download is not a "ready" order: the pages must say so instead of showing an empty list. */
export function orderHasFiles(order: { items?: PackItem[] | null }): boolean {
  return Array.isArray(order.items) && order.items.some((item) => Array.isArray(item.files) && item.files.length > 0)
}

/**
 * What /pack/recuperar shows after asking for a new access link. Only an answer of the 2xx family (the request did not throw) says "te mandamos el acceso";
 * any other answer (a bad request, a 404, "too many requests", a server error, no connection, anything unexpected) is the error state.
 */
export function recoverOutcome(error?: unknown): 'sent' | 'failed' {
  return error === undefined || error === null ? 'sent' : 'failed'
}
