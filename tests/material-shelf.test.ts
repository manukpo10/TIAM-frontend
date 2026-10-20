// The "Material digital" shelf (src/pages/material-digital): which cards link to their landing while the material is not on sale, and what the intro line says.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isExternal, shelfCount, visibleLanding } from '../src/pages/material-digital/shelf.ts'

describe('visibleLanding', () => {
  it('hides every landing while the material is not on sale, unless the product is open on purpose', () => {
    assert.equal(visibleLanding({ landing: '/pack/profesionales' }, false), undefined)
    assert.equal(visibleLanding({ landing: '/cuadernos', landingOpen: true }, false), '/cuadernos')
  })
  it('shows the landing of every product that has one once the material is on sale', () => {
    assert.equal(visibleLanding({ landing: '/pack/profesionales' }, true), '/pack/profesionales')
    assert.equal(visibleLanding({ landing: '/cuadernos', landingOpen: true }, true), '/cuadernos')
  })
  it('never invents a landing for a product that has none', () => {
    assert.equal(visibleLanding({}, true), undefined)
    assert.equal(visibleLanding({ landingOpen: true }, false), undefined)
    assert.equal(visibleLanding({ landing: '' , landingOpen: true }, false), undefined)
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
  it('says what is on sale when the material is on sale', () => {
    assert.equal(shelfCount(1, [], true), '1 producto, en PDF para imprimir.')
    assert.equal(shelfCount(3, [], true), '3 productos, todos en PDF para imprimir.')
  })
  it('says nothing can be bought yet when no product has its page open', () => {
    assert.equal(shelfCount(1, [], false), '1 pack, en PDF para imprimir. Todavía no se puede comprar.')
    assert.equal(shelfCount(3, [], false), '3 packs, todos en PDF para imprimir. Todavía no se pueden comprar.')
  })
  it('says a product already has its page and that buying opens soon, while the others still cannot be bought', () => {
    const text = shelfCount(3, ['Cuadernos TIAM'], false)
    assert.match(text, /^3 productos, todos en PDF para imprimir\./)
    assert.match(text, /Ya podés ver la página de Cuadernos TIAM/)
    assert.match(text, /la compra abre muy pronto/)
    assert.match(text, /Los demás todavía no se pueden comprar\.$/)
  })
  it('agrees with the number of products that are open', () => {
    assert.match(shelfCount(3, ['Cuadernos TIAM', 'Otro'], false), /Ya podés ver las páginas de Cuadernos TIAM y Otro/)
    assert.match(shelfCount(3, ['A', 'B', 'C'], false), /las páginas de A, B y C/)
    assert.match(shelfCount(2, ['A', 'B'], false), /la compra abre muy pronto\.$/) // all open: nobody is left out
  })
})
