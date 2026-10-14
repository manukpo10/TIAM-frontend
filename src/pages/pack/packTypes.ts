/**
 * Shapes of the Pack checkout API (design: Proyecto Digitales/pack/cobro-diseno.md, sections 2.7 and 2.8).
 * The backend's implemented contract lives in Proyecto Digitales/pack/cobro-contrato.md; if the two differ,
 * adjust here and in packClient.ts, which is the only place that talks to the network.
 */

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REVIEW' | 'REVOKED'

export type Paper = 'A4' | 'CARTA'

export interface PackFile {
  /** Opaque id the backend understands; sent back untouched to request a download link. */
  key: string
  label: string
  paper: Paper
  sizeMb?: number
}

export interface PackItem {
  /** "PACK" | "EXTRA" in the design; anything else is rendered the same way. */
  code: string
  title: string
  files: PackFile[]
}

export interface PackOrder {
  status: OrderStatus
  firstName?: string
  edition?: string
  items?: PackItem[]
  /** Present only when the buyer added the games month. `link` is the Challenge play page. */
  games?: { link?: string } | null
  /** ISO date-time after which the download link stops working. */
  expiresAt?: string
  /** Amount charged, in ARS. Optional: used only to give the Meta Pixel a purchase value. */
  total?: number
}

export interface DownloadLink {
  url: string
  expiresInSeconds?: number
}

export interface RegretRequest {
  fullName: string
  email: string
  orderRef?: string
  reason?: string
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
