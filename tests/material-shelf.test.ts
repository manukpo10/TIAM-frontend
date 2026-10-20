// The "Material digital" shelf (src/pages/material-digital): which cards link to their landing and show a price while the whole shelf is not launched, and what the intro line says.
// A product that is `onSale` (the Cuadernos TIAM, since 2026-10-19) is bought now even though the rest of the shelf is still "Próximamente".
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isExternal, shelfBadge, shelfCount, showsPrice, visibleLanding } from '../src/pages/material-digital/shelf.ts'

describe('visibleLanding', () => {
  it('hides every landing while the shelf is not launched, unless the product is on sale', () => {
    assert.equal(visibleLanding({ landing: '/pack/profesionales' }, false), undefined)
    assert.equal(visibleLanding({ landing: '/cuadernos', onSale: true }, false), '/cuadernos')
  })
  it('shows the landing of every product that has one once the shelf is launched', () => {
    assert.equal(visibleLanding({ landing: '/pack/profesionales' }, true), '/pack/profesionales')
    assert.equal(visibleLanding({ landing: '/cuadernos', onSale: true }, true), '/cuadernos')
  })
  it('never invents a landing for a product that has none', () => {
    assert.equal(visibleLanding({}, true), undefined)
    assert.equal(visibleLanding({ onSale: true }, false), undefined)
    assert.equal(visibleLanding({ landing: '', onSale: true }, false), undefined)
  })
})

describe('showsPrice', () => {
  it('shows the price of a product on sale even while the rest of the shelf is not launched', () => {
    assert.equal(showsPrice({ price: 20000, onSale: true }, false), true)
  })
  it('keeps the price of a product that is not on sale hidden until the shelf is launched', () => {
    assert.equal(showsPrice({ price: 14990 }, false), false)
    assert.equal(showsPrice({ price: 14990 }, true), true)
  })
  it('shows nothing for a product without a price', () => {
    assert.equal(showsPrice({ onSale: true }, false), false)
    assert.equal(showsPrice({}, true), false)
  })
})

describe('shelfBadge (the small badge over the picture)', () => {
  it('says "Disponible" for a product on sale and "Próximamente" for the rest while the shelf is not launched', () => {
    assert.equal(shelfBadge({ onSale: true }, false), 'Disponible')
    assert.equal(shelfBadge({}, false), 'Próximamente')
  })
  it('has no badge once the shelf is launched', () => {
    assert.equal(shelfBadge({ onSale: true }, true), null)
    assert.equal(shelfBadge({}, true), null)
  })
})

describe('isExternal', () => {
  it('is true only for absolute http(s) URLs: a path served by the site is a plain same-tab link', () => {
    assert.equal(isExternal('https://example.com/x'), true)
    assert.equal(isExternal('http://example.com'), true)
    assert.equal(isExternal('/cuadernos'), false)
    assert.equal(isExternal('//example.com'), false)
  })
})

describe('shelfCount (the line under "Lo que estamos preparando")', () => {
  it('says what is on the shelf when the shelf is launched', () => {
    assert.equal(shelfCount(1, [], true), '1 producto, en PDF para imprimir.')
    assert.equal(shelfCount(3, [], true), '3 productos, todos en PDF para imprimir.')
  })
  it('says nothing can be bought yet when no product is on sale', () => {
    assert.equal(shelfCount(1, [], false), '1 pack, en PDF para imprimir. Todavía no se puede comprar.')
    assert.equal(shelfCount(3, [], false), '3 packs, todos en PDF para imprimir. Todavía no se pueden comprar.')
  })
  it('says which product can be bought now and that the others still cannot', () => {
    const text = shelfCount(3, ['Cuadernos TIAM'], false)
    assert.match(text, /^3 productos, todos en PDF para imprimir\./)
    assert.match(text, /Ya podés comprar Cuadernos TIAM\./)
    assert.match(text, /Los demás todavía no se pueden comprar\.$/)
    assert.doesNotMatch(text, /muy pronto/i)
  })
  it('lists several products and says nothing about the others when all are on sale', () => {
    assert.match(shelfCount(3, ['Cuadernos TIAM', 'Otro'], false), /Ya podés comprar Cuadernos TIAM y Otro\./)
    assert.match(shelfCount(3, ['A', 'B', 'C'], false), /Ya podés comprar A, B y C\.$/)
    assert.match(shelfCount(2, ['A', 'B'], false), /Ya podés comprar A y B\.$/)
  })
})
