/**
 * What Mercado Pago hands back to /pack/gracias, and what we do with it.
 *
 * Mercado Pago returns the buyer to `PACK_THANKYOU_URL?o=<order token>` plus its own parameters
 * (payment_id, status, payment_type, external_reference, preference_id...). The order token is a
 * bearer credential, and the Meta Pixel reads location.href: so this module takes everything out of
 * the address bar (history.replaceState) the moment the page renders, BEFORE any Pixel is loaded
 * (see lib/metaPixel.ts), and keeps only what the page needs in memory plus sessionStorage for this
 * tab, so a reload of the thank-you page still works. Nothing here is ever logged.
 */

export type PaymentHint = 'approved' | 'pending' | 'cash' | 'failed' | 'unknown'

export interface ReturnInfo {
  token: string | null
  /** Mercado Pago payment id, to ask the backend to verify it. Present only on the first load. */
  paymentId: string | null
  hint: PaymentHint
}

const STORAGE_KEY = 'tiam.pack.order'
const DRAFT_KEY = 'tiam.pack.draft'

interface Stored {
  token: string
  hint: PaymentHint
  tracked?: boolean
}

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function writeStored(value: Stored): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* private mode: the page still works until it is reloaded */
  }
}

function classify(params: URLSearchParams): PaymentHint {
  const status = (params.get('status') ?? params.get('collection_status') ?? '').toLowerCase()
  const type = (params.get('payment_type') ?? '').toLowerCase()
  if (status === 'approved') return 'approved'
  if (status === 'rejected' || status === 'failure' || status === 'cancelled') return 'failed'
  if (status === 'pending' || status === 'in_process' || status === 'in_mediation') {
    // ticket = cash coupon (Rapipago, Pago Fácil...), atm = bank cash machine: paid later, away from the screen
    return type === 'ticket' || type === 'atm' ? 'cash' : 'pending'
  }
  return 'unknown'
}

let consumed: ReturnInfo | null = null

/**
 * Reads the return parameters once and removes the whole query string from the URL. Safe to call from
 * render: later calls (React StrictMode runs components twice, a reload has no parameters) return the
 * same answer.
 */
export function consumeReturnParams(): ReturnInfo {
  const search = window.location.search
  if (search) {
    const params = new URLSearchParams(search)
    const token = params.get('o')?.trim() || null
    const paymentId = (params.get('payment_id') ?? params.get('collection_id'))?.trim() || null
    const hint = classify(params)

    // Everything goes: the token, MP's ids and the external_reference.
    window.history.replaceState(window.history.state, '', window.location.pathname)

    if (token) {
      const previous = readStored()
      writeStored({ token, hint, tracked: previous?.token === token ? previous.tracked : false })
      // The form's draft (name, email, phone) is no longer needed once the buyer is back from paying
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        /* nothing to clean */
      }
    }
    consumed = { token: token ?? readStored()?.token ?? null, paymentId, hint: token ? hint : (readStored()?.hint ?? hint) }
    return consumed
  }
  if (consumed) return consumed
  const stored = readStored()
  consumed = { token: stored?.token ?? null, paymentId: null, hint: stored?.hint ?? 'unknown' }
  return consumed
}

/** Meta's Purchase event must fire once per order, even if the buyer reloads this page. */
export function isPurchaseTracked(): boolean {
  return !!readStored()?.tracked
}

export function markPurchaseTracked(): void {
  const stored = readStored()
  if (stored) writeStored({ ...stored, tracked: true })
}
