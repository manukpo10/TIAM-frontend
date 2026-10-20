// Pure logic shared by the static Pack landings (pack/landing.ts, vite.config.ts) and the React pack pages.
// Run with: npm test   (Node's own test runner with type stripping: no extra dependency).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LANDING_ROUTES,
  computeTotal,
  escapeHtml,
  formErrorMessage,
  checkoutUrlEnvKey,
  gamesPriceEnvKey,  guardBlockers,
  isPreview,
  landingIndexFor,
  liveSlugs,
  parseBonuses,
  perUnit,
  pesos,
  priceEnvKey,
  toNumber,
} from '../pack/logic.ts'

describe('toNumber (prices written in the config)', () => {
  it('reads thousands dots and plain digits', () => {
    assert.equal(toNumber('14.990'), 14990)
    assert.equal(toNumber('14990'), 14990)
    assert.equal(toNumber(' 10.000 '), 10000)
  })
  it('reads a decimal comma', () => {
    assert.equal(toNumber('14.990,50'), 14990.5)
  })
  it('answers 0 for anything that is not a positive number', () => {
    for (const bad of ['', undefined, null, 'abc', '-5', '0', 'NaN', '1e999']) assert.equal(toNumber(bad), 0, `value: ${String(bad)}`)
  })
})

describe('pesos (display format)', () => {
  it('puts a dot every three digits', () => {
    assert.equal(pesos(999), '999')
    assert.equal(pesos(14990), '14.990')
    assert.equal(pesos(1000000), '1.000.000')
  })
  it('rounds to whole pesos', () => {
    assert.equal(pesos(124.9), '125')
  })
})

describe('perUnit (cost per exercise)', () => {
  it('divides and rounds to whole pesos', () => {
    assert.equal(perUnit(14990, 120), 125)
    assert.equal(perUnit(9990, 120), 83)
  })
  it('is 0 when there is nothing to divide by', () => {
    assert.equal(perUnit(14990, 0), 0)
    assert.equal(perUnit(0, 120), 0)
  })
})

describe('computeTotal (what the buyer sees and what is sent as expected_total)', () => {
  const games = { checked: true, disabled: false, price: 10000 }
  it('is the base price with nothing added', () => {
    assert.equal(computeTotal(14990, []), 14990)
    assert.equal(computeTotal(14990, [{ ...games, checked: false }]), 14990)
  })
  it('adds every checked add-on', () => {
    assert.equal(computeTotal(14990, [games]), 24990)
    assert.equal(computeTotal(14990, [games, { checked: true, price: 4990 }]), 29980)
  })
  it('gives the workbooks totals: 20.000 alone, 35.000 with the first month of the Desafío at 15.000', () => {
    const base = toNumber('20.000')
    const firstMonth = toNumber('15.000')
    assert.equal(computeTotal(base, [{ checked: false, price: firstMonth }]), 20000)
    assert.equal(computeTotal(base, [{ checked: true, price: firstMonth }]), 35000)
    assert.equal(perUnit(base, 120), 167)
  })
  it('ignores a disabled add-on even if it is checked', () => {
    assert.equal(computeTotal(14990, [{ ...games, disabled: true }]), 14990)
  })
  it('ignores prices that are not positive numbers', () => {
    assert.equal(computeTotal(14990, [{ checked: true, price: Number.NaN }, { checked: true, price: -5 }]), 14990)
  })
})

describe('formErrorMessage (the ?error= codes the backend answers with)', () => {
  it('shows a friendly sentence for the sales-closed code', () => {
    const text = formErrorMessage('cerrado')
    assert.match(text, /cerradas/)
    assert.doesNotMatch(text, /cerrado\b/)
  })
  it('explains a price change', () => {
    assert.match(formErrorMessage('precio'), /precio cambió/)
  })
  it('falls back to the general message for unknown codes and never echoes them', () => {
    const general = formErrorMessage('lo-que-sea')
    assert.match(general, /No pudimos procesar tu compra/)
    assert.ok(!general.includes('lo-que-sea'))
    assert.equal(formErrorMessage(''), general)
    assert.equal(formErrorMessage(null), general)
    assert.equal(formErrorMessage(undefined), general)
  })
  it('does not read inherited object properties (?error=constructor)', () => {
    const general = formErrorMessage('x')
    for (const code of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(formErrorMessage(code), general, code)
  })
  it('names the product in the edition error', () => {
    assert.match(formErrorMessage('edicion'), /tu pack/)
    assert.match(formErrorMessage('edicion', 'pack'), /tu pack/)
    assert.match(formErrorMessage('edicion', 'cuadernos'), /tus cuadernos/)
  })
  it('covers every code the backend can send', () => {
    for (const code of ['cerrado', 'precio', 'pago', 'email', 'nombre', 'telefono', 'meses', 'limite', 'edicion', 'extras', 'origen']) {
      assert.notEqual(formErrorMessage(code), formErrorMessage('desconocido'), code)
    }
  })
})

describe('parseBonuses (optional bonus list written in the config)', () => {
  it('is empty when nothing is configured', () => {
    assert.deepEqual(parseBonuses(''), [])
    assert.deepEqual(parseBonuses(undefined), [])
    assert.deepEqual(parseBonuses('   '), [])
    assert.deepEqual(parseBonuses(' ;; ;; '), [])
  })
  it('splits items on ";;" and the title from the text on the first "|"', () => {
    assert.deepEqual(parseBonuses('Uno | Primer bono ;; Dos'), [
      { title: 'Uno', text: 'Primer bono' },
      { title: 'Dos', text: '' },
    ])
  })
  it('keeps later pipes inside the text', () => {
    assert.deepEqual(parseBonuses('Uno | a | b'), [{ title: 'Uno', text: 'a | b' }])
  })
  it('drops items without a title', () => {
    assert.deepEqual(parseBonuses('| solo texto ;; Dos | ok'), [{ title: 'Dos', text: 'ok' }])
  })
})

describe('escapeHtml', () => {
  it('escapes the characters that break markup and attributes', () => {
    assert.equal(escapeHtml('<b a="1">Tom & Jerry</b>'), '&lt;b a=&quot;1&quot;&gt;Tom &amp; Jerry&lt;/b&gt;')
  })
})

describe('priceEnvKey', () => {
  it('picks the price variable of each product', () => {
    assert.equal(priceEnvKey('cuadernos'), 'VITE_PACK_CUADERNOS_PRICE')
    assert.equal(priceEnvKey('familias'), 'VITE_PACK_PRICE')
    assert.equal(priceEnvKey('profesionales'), 'VITE_PACK_PRICE')
  })
})

describe('gamesPriceEnvKey (first month of the Desafío, bought together)', () => {
  it('gives the workbooks their own price (15.000), apart from the Pack offer (10.000)', () => {
    assert.equal(gamesPriceEnvKey('cuadernos'), 'VITE_PACK_CUADERNOS_GAMES_PRICE')
    assert.equal(gamesPriceEnvKey('familias'), 'VITE_PACK_GAMES_PRICE')
    assert.equal(gamesPriceEnvKey('profesionales'), 'VITE_PACK_GAMES_PRICE')
  })
})

describe('checkoutUrlEnvKey (each landing has its own checkout switch)', () => {
  it('gives the workbooks their own variable, so their form can be live while the Pack forms stay off', () => {
    assert.equal(checkoutUrlEnvKey('cuadernos'), 'VITE_PACK_CUADERNOS_CHECKOUT_URL')
    assert.equal(checkoutUrlEnvKey('familias'), 'VITE_PACK_CHECKOUT_URL')
    assert.equal(checkoutUrlEnvKey('profesionales'), 'VITE_PACK_CHECKOUT_URL')
  })
})

describe('per-landing preview state (VITE_PACK_PREVIEW + VITE_PACK_LIVE)', () => {
  it('reads the list of live landings, ignoring spaces, case, duplicates and names that are not landings', () => {
    assert.deepEqual(liveSlugs('cuadernos'), ['cuadernos'])
    assert.deepEqual(liveSlugs(' Cuadernos , familias,cuadernos '), ['cuadernos', 'familias'])
    assert.deepEqual(liveSlugs(''), [])
    assert.deepEqual(liveSlugs(undefined), [])
    assert.deepEqual(liveSlugs('otra, constructor, __proto__'), [])
  })
  it('keeps a landing in preview only while the preview switch is on AND it is not on the live list', () => {
    assert.equal(isPreview('familias', true, ['cuadernos']), true)
    assert.equal(isPreview('profesionales', true, ['cuadernos']), true)
    assert.equal(isPreview('cuadernos', true, ['cuadernos']), false)
    assert.equal(isPreview('cuadernos', true, []), true)
    assert.equal(isPreview('familias', false, []), false) // preview switched off: nothing is in preview
  })
})

describe('guardBlockers (what makes the production build fail)', () => {
  const complete = { missing: [], leftovers: [] }
  const incomplete = { missing: ['VITE_PACK_CONTACT_URL'], leftovers: [] }
  const live = ['cuadernos']

  it('lets the Pack landings go out in preview while the live landing is complete', () => {
    assert.deepEqual(guardBlockers({ cuadernos: complete, familias: incomplete, profesionales: incomplete }, live, true, false), [])
  })
  it('blocks when the LIVE landing lacks required data or has leftover markers', () => {
    assert.deepEqual(guardBlockers({ cuadernos: incomplete, familias: incomplete }, live, true, false), ['cuadernos'])
    assert.deepEqual(guardBlockers({ cuadernos: { missing: [], leftovers: ['[[X]]'] } }, live, true, false), ['cuadernos'])
  })
  it('with the explicit strict switch (PACK_STRICT=1) every landing must be complete and out of preview', () => {
    assert.deepEqual(guardBlockers({ cuadernos: complete, familias: incomplete }, live, true, true), ['familias'])
    assert.deepEqual(guardBlockers({ cuadernos: complete, familias: complete }, live, true, true), ['familias']) // still in preview
    assert.deepEqual(guardBlockers({ cuadernos: complete, familias: complete }, ['cuadernos', 'familias'], true, true), [])
  })
  it('with the preview switch off nothing is in preview: every incomplete landing blocks', () => {
    assert.deepEqual(guardBlockers({ cuadernos: complete, familias: incomplete }, [], false, false), ['familias'])
  })
})

describe('landing routes', () => {
  it('keeps the Pack routes under /pack and serves the workbooks at /cuadernos', () => {
    assert.equal(LANDING_ROUTES.familias, '/pack/familias')
    assert.equal(LANDING_ROUTES.profesionales, '/pack/profesionales')
    assert.equal(LANDING_ROUTES.cuadernos, '/cuadernos')
  })
  it('maps a route, with or without trailing slash and query, to its index.html', () => {
    assert.equal(landingIndexFor('/cuadernos'), '/pack/cuadernos/index.html')
    assert.equal(landingIndexFor('/cuadernos/'), '/pack/cuadernos/index.html')
    assert.equal(landingIndexFor('/cuadernos?utm_source=fb#comprar'), '/pack/cuadernos/index.html?utm_source=fb#comprar')
    assert.equal(landingIndexFor('/pack/familias/'), '/pack/familias/index.html')
    assert.equal(landingIndexFor('/pack/profesionales?x=1'), '/pack/profesionales/index.html?x=1')
  })
  it('leaves every other URL alone', () => {
    for (const url of ['/', '/talleres', '/pack/cuadernos', '/cuadernosx', '/pack/gracias', '/pack/familias/index.html', '/cuadernos/otra']) {
      assert.equal(landingIndexFor(url), url, url)
    }
  })
})
