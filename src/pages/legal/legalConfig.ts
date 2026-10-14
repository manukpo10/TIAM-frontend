/**
 * Business data the legal pages repeat, read from the same VITE_PACK_* variables the Pack landings use
 * (see .env). Nothing is invented here: when a variable is empty, the clause that needs it is left out or
 * falls back to neutral wording, and the owner fills the real value in Vercel.
 *
 * PENDING LEGAL REVIEW: every text in src/pages/legal that talks about the Packs, the 30-day Challenge,
 * the right of withdrawal, the warranty or the buyers' personal data is a DRAFT written from the product's
 * real behaviour (Proyecto Digitales/pack/cobro-diseno.md, sections 2.7 to 2.9). A lawyer must review it
 * before the sale opens, including: the 10-day withdrawal period (Ley 24.240 art. 34) and how it applies to
 * digital content that was already downloaded, Resolución 424/2020, the licence wording per edition, the
 * retention periods, and whether the database must be registered with the AAIP (Ley 25.326).
 */

const read = (value: unknown): string => String(value ?? '').trim()

/** Legal name and CUIT of the seller. Empty until the owner provides it. */
export const LEGAL_ENTITY = read(import.meta.env.VITE_PACK_LEGAL_ENTITY)

/** Days of the money-back guarantee the landings promise. 0 = no guarantee is offered. */
export const GUARANTEE_DAYS = Number(read(import.meta.env.VITE_PACK_GUARANTEE_DAYS)) || 0

/** Licence texts per edition, as published on the landings. */
export const LICENSE_FAMILIAS = read(import.meta.env.VITE_PACK_LICENSE_FAMILIAS)
export const LICENSE_PROFESIONALES = read(import.meta.env.VITE_PACK_LICENSE_PROFESIONALES)

/** How professionals ask for an invoice. */
export const INVOICE_TEXT = read(import.meta.env.VITE_PACK_INVOICE_TEXT)

/** True when the Meta Pixel is configured, i.e. when the policy has to say it exists. */
export const PIXEL_ENABLED = read(import.meta.env.VITE_META_PIXEL_ID) !== ''

// The contact the landings publish (VITE_PACK_CONTACT_URL) wins when it is a mailto: link.
// TODO(legal): the fallback below is the owner's personal Gmail, kept only because there is no institutional
// address yet. Replace it (cobro-diseno.md, section 2.8) by setting VITE_PACK_CONTACT_URL=mailto:<address>.
const FALLBACK_EMAIL = 'manuu.robles@gmail.com'
const mailto = /^mailto:([^?]+)/i.exec(read(import.meta.env.VITE_PACK_CONTACT_URL))
export const CONTACT_EMAIL: string = mailto ? decodeURIComponent(mailto[1]) : FALLBACK_EMAIL
