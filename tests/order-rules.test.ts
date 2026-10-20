// Rules of the gracias / descargas / recuperar pages (review of 2026-10-19).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { orderHasFiles, purchaseCategory, recoverOutcome } from '../src/pages/pack/orderRules.ts'
import { PackApiError } from '../src/pages/pack/packTypes.ts'

describe('purchaseCategory (the content_category of the Purchase event)', () => {
  it('names the Cuadernos orders "cuadernos" and keeps the Pack ones as they were', () => {
    assert.equal(purchaseCategory('cuadernos'), 'cuadernos')
    assert.equal(purchaseCategory('familias'), 'pack-fichas')
    assert.equal(purchaseCategory('profesionales'), 'pack-fichas')
  })
  it('falls back to the Pack category when the edition is unknown', () => {
    assert.equal(purchaseCategory(null), 'pack-fichas')
    assert.equal(purchaseCategory(undefined), 'pack-fichas')
    assert.equal(purchaseCategory('otra'), 'pack-fichas')
  })
})

const file = { key: 'a', label: 'A', paper: 'A4' as const, sizeMb: 1 }

describe('orderHasFiles (a paid order with nothing to download is not a "ready" order)', () => {
  it('is true when at least one item lists at least one file', () => {
    assert.equal(orderHasFiles({ items: [{ code: 'PACK', title: 'x', files: [file] }] }), true)
    assert.equal(orderHasFiles({ items: [{ code: 'PACK', title: 'x', files: [] }, { code: 'EXTRA', title: 'y', files: [file] }] }), true)
  })
  it('is false for no items, items without files, or missing data', () => {
    assert.equal(orderHasFiles({ items: [] }), false)
    assert.equal(orderHasFiles({ items: [{ code: 'PACK', title: 'x', files: [] }] }), false)
    assert.equal(orderHasFiles({ items: null as unknown as [] }), false)
    assert.equal(orderHasFiles({}), false)
  })
})

describe('recoverOutcome (the "te mandamos el acceso" screen)', () => {
  it('is "sent" only when the request answered 2xx, i.e. it did not throw', () => {
    assert.equal(recoverOutcome(undefined), 'sent')
    assert.equal(recoverOutcome(null), 'sent')
  })
  it('is "failed" for any other answer: bad request, not found, too many requests, server error, no connection', () => {
    for (const [kind, status] of [['client', 400], ['not-found', 404], ['rate-limited', 429], ['server', 500], ['server', 503], ['network', 0]] as const) {
      assert.equal(recoverOutcome(new PackApiError(kind, status)), 'failed', `${kind} ${status}`)
    }
  })
  it('is "failed" for an unexpected error too', () => {
    assert.equal(recoverOutcome(new Error('boom')), 'failed')
    assert.equal(recoverOutcome('x'), 'failed')
  })
})
