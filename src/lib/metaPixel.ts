/**
 * Meta Pixel for the SPA. The static landings carry their own copy of the base code (pack/landing.ts);
 * in the SPA the Pixel is loaded ONLY by the pages that ask for it, and only after they have taken the
 * order token and the Mercado Pago parameters out of the URL (see pages/pack/returnParams.ts): the
 * script reads location.href, so loading it earlier would send the token to Meta.
 *
 * No Pixel ID configured (VITE_META_PIXEL_ID) = nothing is loaded and every call is a no-op.
 */

import { trackArgs } from './pixelEvents.ts'

type Fbq = {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded: boolean
  version: string
  push: Fbq
  disablePushState?: boolean
}

type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq }

const PIXEL_ID: string = import.meta.env.VITE_META_PIXEL_ID ?? ''

let ready = false

/** Loads the base code once. Returns false when there is no Pixel configured. */
export function startMetaPixel(): boolean {
  if (!PIXEL_ID) return false
  if (ready) return true
  const w = window as PixelWindow
  if (!w.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    } as Fbq
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    // The Pixel never follows client-side navigation: a later route can carry a token or a patient link, and the Pixel reads the address.
    fbq.disablePushState = true
    w.fbq = fbq
    w._fbq = fbq
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
    // No automatic configuration: it would scrape form fields (advanced matching), button text and page metadata. Only the events sent here go out.
    fbq('set', 'autoConfig', 'false', PIXEL_ID)
    fbq('init', PIXEL_ID)
    fbq('track', 'PageView')
  }
  ready = true
  return true
}

/** Sends a standard event. `eventId` goes as `eventID`, so Meta drops the same event if it ever arrives twice. */
export function trackMetaPixel(event: string, params?: Record<string, unknown>, eventId?: string | null): void {
  if (!ready) return
  ;(window as PixelWindow).fbq?.(...trackArgs(event, params, eventId))
}
