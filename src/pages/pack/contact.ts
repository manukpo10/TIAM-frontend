import { supportLink } from '@/lib/whatsapp'

/**
 * Where a buyer is sent when something goes wrong. Uses the contact the landings already publish
 * (VITE_PACK_CONTACT_URL / VITE_PACK_CONTACT_TEXT, a WhatsApp or mailto: link) and falls back to TIAM's
 * WhatsApp number while those are still empty.
 */
const url: string = String(import.meta.env.VITE_PACK_CONTACT_URL ?? '').trim()
const text: string = String(import.meta.env.VITE_PACK_CONTACT_TEXT ?? '').trim()

export const contact = {
  href: url || supportLink,
  label: url ? text || 'Escribinos' : 'Escribinos por WhatsApp',
  /** mailto: links open in the same tab; web links in a new one. */
  external: !url || !url.startsWith('mailto:'),
}
