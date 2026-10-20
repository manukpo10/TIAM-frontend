// The editions the React pack pages know about, and where "try again" goes back to.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LANDING_ROUTES } from '../pack/logic.ts'
import { EDITIONS, LANDING_PATHS, asEdition, retryHref } from '../src/pages/pack/packTypes.ts'

describe('the app and the build agree on where each landing lives', () => {
  it('LANDING_PATHS (app) equals LANDING_ROUTES (vite.config.ts and vercel.json)', () => {
    assert.deepEqual({ ...LANDING_PATHS }, { ...LANDING_ROUTES })
  })
  it('has a path for every edition', () => {
    for (const edition of EDITIONS) assert.ok(LANDING_PATHS[edition], edition)
  })
})

describe('asEdition', () => {
  it('knows the Pack editions and the workbooks', () => {
    assert.deepEqual([...EDITIONS].sort(), ['cuadernos', 'familias', 'profesionales'])
    assert.equal(asEdition('familias'), 'familias')
    assert.equal(asEdition('profesionales'), 'profesionales')
    assert.equal(asEdition('cuadernos'), 'cuadernos')
  })
  it('ignores anything else the API might send', () => {
    for (const value of ['', 'Cuadernos', 'pack', 'constructor', null, undefined, 3, {}]) assert.equal(asEdition(value), null, String(value))
  })
})

describe('retryHref (the "volver a intentar" button of a payment that did not go through)', () => {
  it('sends a Pack buyer back to the purchase card of their landing', () => {
    assert.equal(retryHref('familias'), '/pack/familias#comprar')
    assert.equal(retryHref('profesionales'), '/pack/profesionales#comprar')
  })
  it('sends a workbooks buyer to /cuadernos, not to /pack/cuadernos', () => {
    assert.equal(retryHref('cuadernos'), '/cuadernos#comprar')
  })
  it('falls back to the generic page when the edition is unknown', () => {
    assert.equal(retryHref(null), '/material-digital')
  })
})
