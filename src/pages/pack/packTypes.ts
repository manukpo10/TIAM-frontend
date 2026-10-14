/**
 * Shapes of the Pack checkout API, exactly as the backend sends them (data of the { success, data, message } envelope).
 * The golden answers live in ./contract/*.json: they are the very files the backend's tests compare its real answers with,
 * and ./contract/contract.check.ts makes `tsc -b` fail if these types and those answers ever drift apart.
 *
 * Contract notes: Proyecto Digitales/pack/cobro-contrato.md (the old text) and pack/cobro-revision.md (what changed).
 * If the backend changes, copy its fixtures again, fix the types, and the compiler points at everything that must follow.
 */

/** REVOKED never reaches the browser: a refunded or expired order answers 404, like an unknown one. */
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REVIEW'

export type Edition = 'familias' | 'profesionales'

/** The two landings the buyer can come from. Anything else the API sends is ignored. */
export const EDITIONS: readonly Edition[] = ['familias', 'profesionales']

export function asEdition(value: unknown): Edition | null {
  return typeof value === 'string' && (EDITIONS as readonly string[]).includes(value) ? (value as Edition) : null
}

/** What the pages work with: one key per paper size. The API's spelling is {@link WirePaper}. */
export type Paper = 'A4' | 'CARTA'

/** How the API spells the paper ("Carta", not "CARTA"). The downloads panel normalizes it to {@link Paper}. */
export type WirePaper = 'A4' | 'Carta'

export interface PackFile {
  /** Catalog code of the file, sent back untouched to request a download link. It is not a storage key. */
  key: string
  label: string
  paper: WirePaper
  sizeMb: number
}

export interface PackItem {
  /** "PACK" or "EXTRA"; anything else is rendered the same way. */
  code: string
  title: string
  files: PackFile[]
}

/**
 * GET /packs/orders/{token}. Every field is always present; only a PAID order fills them all in. For the other
 * states `edition` is still known (so "try again" can go back to the landing the buyer was on) and the rest is
 * empty (null / []).
 */
export interface PackOrder {
  status: OrderStatus
  firstName: string | null
  edition: Edition | null
  items: PackItem[]
  /** Present only when the buyer added the games month. `link` is the Challenge play page, or null if it could not be generated. */
  games: { link: string | null } | null
  /** ISO date-time after which the download link stops working. */
  expiresAt: string | null
  /** Amount charged, in ARS (29980 or 29980.00 on the wire: the same JSON number). Null unless PAID. */
  total: number | null
}

/** POST /packs/orders/{token}/confirm: what the backend found when it re-read the payment from Mercado Pago. */
export interface OrderConfirmation {
  status: OrderStatus
}

/** POST /packs/orders/{token}/files/{key}/link */
export interface DownloadLink {
  url: string
  expiresInSeconds: number
}

export interface RegretRequest {
  fullName: string
  email: string
  orderRef?: string
  reason?: string
}

/** POST /packs/regret: the constancia. `receivedAt` is an ISO date-time in UTC. */
export interface RegretReceipt {
  reference: string
  receivedAt: string
}

export type PackErrorKind = 'not-found' | 'rate-limited' | 'client' | 'server' | 'network'

/** Never carries the request path or body: those contain the order token. */
export class PackApiError extends Error {
  readonly kind: PackErrorKind
  readonly status: number

  constructor(kind: PackErrorKind, status = 0) {
    super(`pack api: ${kind}`)
    this.name = 'PackApiError'
    this.kind = kind
    this.status = status
  }
}
