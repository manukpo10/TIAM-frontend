// What the gracias / descargas pages say about the Desafío month the buyer got with the order (Pack and Cuadernos).
// Backend contract: Proyecto Digitales/pack/cobro-contrato.md, section 14. The month runs 30 days from the PURCHASE (it does not wait for a
// WhatsApp message), the buyer starts right away from the personal link (or by WhatsApp when there is no link), and `games` is null when
// nothing was granted: then the page shows nothing at all.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { gamesView } from '../src/pages/pack/gamesView.ts'

const PACK_GAMES = { link: 'https://tiamdigital.com/desafio/abc123' }
const CUADERNOS_GAMES = {
  link: 'https://tiamdigital.com/desafio/abc123',
  monthsIncluded: 1,
  month: 2,
  durationDays: 30,
  startsAt: 'purchase',
  nextMonthsPaidSeparately: true,
  nextMonthPriceArs: 20000,
}

describe('gamesView', () => {
  it('shows nothing when no month was granted (games is null)', () => {
    assert.equal(gamesView(null, null), null)
    assert.equal(gamesView(undefined, null), null)
  })

  it('names the month by its number when the backend sends it', () => {
    assert.equal(gamesView(CUADERNOS_GAMES, CUADERNOS_GAMES.link)?.heading, 'Mes 2 del Desafío')
    assert.equal(gamesView({ ...CUADERNOS_GAMES, month: 1 }, CUADERNOS_GAMES.link)?.heading, 'Mes 1 del Desafío')
  })

  it('says "1 mes del Desafío" when there is no (valid) month number, never "primer mes"', () => {
    assert.equal(gamesView(PACK_GAMES, PACK_GAMES.link)?.heading, '1 mes del Desafío')
    for (const month of [0, -1, 1.5, Number.NaN, '2', null]) {
      const view = gamesView({ ...CUADERNOS_GAMES, month: month as unknown as number }, CUADERNOS_GAMES.link)
      assert.equal(view?.heading, '1 mes del Desafío', String(month))
    }
  })

  it('starts right away from the personal link when there is one', () => {
    assert.equal(gamesView(CUADERNOS_GAMES, CUADERNOS_GAMES.link)?.start, 'link')
    assert.equal(gamesView(PACK_GAMES, PACK_GAMES.link)?.start, 'link')
  })

  it('falls back to WhatsApp, from the number left at checkout, when there is no usable link', () => {
    const view = gamesView({ ...PACK_GAMES, link: null }, null)
    assert.equal(view?.start, 'whatsapp')
    assert.match(view?.startText ?? '', /WhatsApp/)
    assert.match(view?.startText ?? '', /número que dejaste al comprar/)
    // a link that the page refuses to follow (unsafe URL) is no link
    assert.equal(gamesView(PACK_GAMES, null)?.start, 'whatsapp')
  })

  it('says the month lasts 30 days from the purchase, for Pack and Cuadernos orders alike', () => {
    for (const games of [PACK_GAMES, CUADERNOS_GAMES]) {
      const text = gamesView(games, games.link)?.durationText ?? ''
      assert.match(text, /30 días/)
      assert.match(text, /desde la compra/)
    }
  })

  it('uses the duration the backend sends and 30 when it is missing or invalid', () => {
    assert.match(gamesView({ ...CUADERNOS_GAMES, durationDays: 45 }, 'x')?.durationText ?? '', /45 días/)
    for (const durationDays of [0, -3, 2.5, Number.NaN, '30', null]) {
      assert.match(gamesView({ ...CUADERNOS_GAMES, durationDays: durationDays as unknown as number }, 'x')?.durationText ?? '', /30 días/, String(durationDays))
    }
  })

  it('does not claim "from the purchase" when the backend says the clock starts some other way', () => {
    const text = gamesView({ ...CUADERNOS_GAMES, startsAt: 'first-message' }, 'x')?.durationText ?? ''
    assert.match(text, /30 días/)
    assert.doesNotMatch(text, /desde la compra/)
  })

  it('tells the next months are optional, bought apart, with the price when the backend sends it, and never renew by themselves', () => {
    const text = gamesView(CUADERNOS_GAMES, CUADERNOS_GAMES.link)?.nextMonthsText ?? ''
    assert.match(text, /opcionales/)
    assert.match(text, /aparte/)
    assert.match(text, /\$ 20\.000 por mes/)
    assert.match(text, /No hay renovación automática/)
    const generic = gamesView(PACK_GAMES, PACK_GAMES.link)?.nextMonthsText ?? ''
    assert.match(generic, /aparte/)
    assert.doesNotMatch(generic, /\$/)
    assert.match(generic, /No hay renovación automática/)
  })

  it('leaves the next-months line out when the backend says they are not sold apart', () => {
    assert.equal(gamesView({ ...CUADERNOS_GAMES, nextMonthsPaidSeparately: false }, 'x')?.nextMonthsText, null)
  })

  it('ignores a next-month price that is not a sensible amount', () => {
    for (const price of [0, -1, 999, Number.NaN, '20000']) {
      const text = gamesView({ ...CUADERNOS_GAMES, nextMonthPriceArs: price as unknown as number }, 'x')?.nextMonthsText ?? ''
      assert.doesNotMatch(text, /\$/, String(price))
    }
  })

  it('never says the month is activated by WhatsApp or that it is the "primer mes"', () => {
    for (const games of [PACK_GAMES, CUADERNOS_GAMES, { ...PACK_GAMES, link: null }]) {
      const view = gamesView(games, games.link)
      const all = [view?.heading, view?.startText, view?.durationText, view?.nextMonthsText].join(' ')
      assert.doesNotMatch(all, /se activa por WhatsApp/i)
      assert.doesNotMatch(all, /primer mes/i)
    }
  })
})
