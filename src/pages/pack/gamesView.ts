/**
 * What the gracias / descargas pages say about the Desafío month that came with an order (Pack or Cuadernos).
 * Pure on purpose: it has its tests in tests/games-view.test.ts (`npm test`). Backend contract: Proyecto Digitales/pack/cobro-contrato.md, section 14.
 *
 *  - `games` is null when the buyer did not add the Desafío OR the month could not be granted: the page shows nothing (this returns null).
 *  - The month runs 30 days from the PURCHASE. It does not wait for a WhatsApp message. The buyer starts right away from the personal link, or by
 *    WhatsApp (from the number left at checkout) when there is no usable link.
 *  - `month` (when present) is the number of the month that was granted ("Mes 2 del Desafío"; it may not be the first one). Without it: "1 mes del Desafío".
 *    Never "primer mes".
 *  - Pack orders only send `{ link }`: everything else falls back to what is true for every order (30 days, from the purchase).
 */

import type { CuadernosGames, PackGames } from './packTypes'

export interface GamesView {
  /** "Mes 2 del Desafío" or "1 mes del Desafío". */
  heading: string
  /** How the buyer starts: the personal link (a button that opens it) or WhatsApp (a button that opens the chat). */
  start: 'link' | 'whatsapp'
  startText: string
  durationText: string
  /** The next months are optional and bought apart; null when the backend says they are not sold apart. */
  nextMonthsText: string | null
}

const DEFAULT_DURATION_DAYS = 30
/** The backend refuses to open a sale with any price under ARS 1.000: anything lower is not a real price. */
const MIN_PRICE_ARS = 1000

const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

/** 20000 -> "20.000" (dot every three digits, without depending on the locale data of the runtime). */
const pesos = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * @param games the order's `games` as the API sent it
 * @param link the personal link AFTER the page checked it is safe to follow (null if there is none or it is not safe)
 */
export function gamesView(games: PackGames | CuadernosGames | null | undefined, link: string | null): GamesView | null {
  if (!games) return null
  const extra = games as Partial<CuadernosGames>

  const heading = isPositiveInteger(extra.month) ? `Mes ${extra.month} del Desafío` : '1 mes del Desafío'

  const days = isPositiveInteger(extra.durationDays) ? extra.durationDays : DEFAULT_DURATION_DAYS
  // An order that does not say when the clock starts (a Pack order) follows the same rule as the rest: from the purchase.
  const fromPurchase = extra.startsAt === undefined || extra.startsAt === 'purchase'
  const durationText = `El mes dura ${days} días${fromPurchase ? ' desde la compra' : ''}.`

  const start = link ? 'link' : 'whatsapp'
  const startText = link
    ? 'Podés empezar ya mismo desde tu link personal.'
    : 'Escribinos por WhatsApp desde el número que dejaste al comprar y empezás ya mismo.'

  let nextMonthsText: string | null = null
  if (extra.nextMonthsPaidSeparately !== false) {
    const price = typeof extra.nextMonthPriceArs === 'number' && Number.isFinite(extra.nextMonthPriceArs) && extra.nextMonthPriceArs >= MIN_PRICE_ARS ? extra.nextMonthPriceArs : null
    nextMonthsText = `Los meses siguientes son opcionales y se compran aparte, en la página del Desafío${price ? `, a $ ${pesos(price)} por mes` : ''}. No hay renovación automática.`
  }

  return { heading, start, startText, durationText, nextMonthsText }
}
