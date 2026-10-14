import type { PaymentHint } from './returnParams'

/**
 * How the thank-you page reacts to what the backend says about the order, as pure functions so the rules can be
 * read (and checked) without a browser.
 *
 * The one rule behind all of them: only PAID ends the waiting. A rejected payment can still turn into a paid
 * order (the buyer retries inside the same Mercado Pago checkout, or the webhook of the approved payment arrives
 * late), and a payment held for review can be approved by hand, so FAILED and REVIEW keep being checked, just
 * more slowly than a payment that is about to be credited. After each window the page stops asking and the screen
 * says what will happen next; nothing ever ends in a dead end.
 */

const SECOND = 1_000
const MINUTE = 60 * SECOND

export const FAST_MS = 4 * SECOND
export const SLOW_MS = 30 * SECOND
/** About two minutes of looking every 4 seconds for a payment that is just being credited. */
export const FAST_ATTEMPTS = 30
/** A pending payment is checked for this long; after that the screen says "when it is credited you get the email". */
export const PENDING_WINDOW_MS = 20 * MINUTE
/** A cash coupon is paid away from this screen: look slowly, and not forever. */
export const CASH_WINDOW_MS = 30 * MINUTE

export const FAILED_EVERY_MS = 10 * SECOND
export const FAILED_WINDOW_MS = 10 * MINUTE

export const REVIEW_EVERY_MS = 30 * SECOND
export const REVIEW_WINDOW_MS = 30 * MINUTE

/**
 * When to ask the backend to re-read the payment from Mercado Pago again (POST .../confirm), counted from the
 * moment the page opened, besides the call it makes right away. Slow on purpose: the backend rate-limits it.
 */
export const CONFIRM_RETRY_MS: readonly number[] = [20 * SECOND, MINUTE, 3 * MINUTE]

export type Phase = 'waiting' | 'failed' | 'review' | 'stalled'

export interface PollDecision {
  /** Which screen to show. PAID is not here: the page handles it, because it needs the order. */
  phase: Phase
  /** The payment is taking longer than usual (only meaningful for `waiting`). */
  delayed: boolean
  /** Milliseconds until the next look at the order, or null to stop asking. */
  nextMs: number | null
}

export interface PollInput {
  /** What the backend said. Anything that is not one of the four known states gets the calm "stalled" screen. */
  status: string
  /** What Mercado Pago put in the return URL (the first load only). */
  hint: PaymentHint
  /** Milliseconds since the page first saw this status. */
  sinceMs: number
  /** How many times this status has been seen in a row. */
  attempts: number
}

const within = (windowMs: number, sinceMs: number, everyMs: number): number | null => (sinceMs < windowMs ? everyMs : null)

export function decide({ status, hint, sinceMs, attempts }: PollInput): PollDecision {
  switch (status) {
    case 'FAILED':
      // Mercado Pago's own return says "approved": the order is just behind, so we are verifying, not failing.
      if (hint === 'approved') {
        const nextMs = within(FAILED_WINDOW_MS, sinceMs, FAILED_EVERY_MS)
        return { phase: nextMs === null ? 'stalled' : 'waiting', delayed: true, nextMs }
      }
      return { phase: 'failed', delayed: false, nextMs: within(FAILED_WINDOW_MS, sinceMs, FAILED_EVERY_MS) }

    case 'REVIEW':
      return { phase: 'review', delayed: false, nextMs: within(REVIEW_WINDOW_MS, sinceMs, REVIEW_EVERY_MS) }

    case 'PENDING': {
      // Mercado Pago said "rejected" and the order has not caught up yet: show it as not completed, keep looking.
      if (hint === 'failed') return { phase: 'failed', delayed: false, nextMs: within(FAILED_WINDOW_MS, sinceMs, FAILED_EVERY_MS) }
      if (hint === 'cash') return { phase: 'waiting', delayed: false, nextMs: within(CASH_WINDOW_MS, sinceMs, SLOW_MS) }
      if (sinceMs >= PENDING_WINDOW_MS) return { phase: 'stalled', delayed: false, nextMs: null }
      const slow = attempts >= FAST_ATTEMPTS
      return { phase: 'waiting', delayed: slow, nextMs: slow ? SLOW_MS : FAST_MS }
    }

    default:
      return { phase: 'stalled', delayed: false, nextMs: within(PENDING_WINDOW_MS, sinceMs, SLOW_MS) }
  }
}
