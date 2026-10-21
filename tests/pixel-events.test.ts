// Meta Pixel rules for the sales campaign (2026-10-20): the Purchase event goes out ONCE per order, carries the order total in ARS and a stable
// eventID, and never carries the access token, the email, the name or anything health-related. The pixel ID is set in the tracked .env.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { purchaseEventId, purchaseParams, rememberPurchase, trackArgs, wasPurchaseSent } from '../src/lib/pixelEvents.ts'
import type { PurchaseStore } from '../src/lib/pixelEvents.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

/** A localStorage stand-in. Sharing one instance between "page loads" is what a reload or a second tab does. */
function memoryStore(initial: Record<string, string> = {}): PurchaseStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const brokenStore: PurchaseStore = {
  getItem: () => {
    throw new Error('storage blocked')
  },
  setItem: () => {
    throw new Error('storage blocked')
  },
}

const TOKEN = 'tok_9f8e7d6c5b4a39281706f5e4d3c2b1a0'

describe('purchaseEventId (the eventID of the Purchase event)', () => {
  it('is the same for the same order, so a reload or a second tab dedupes in Meta too', async () => {
    assert.equal(await purchaseEventId(TOKEN), await purchaseEventId(TOKEN))
  })
  it('is different for another order', async () => {
    assert.notEqual(await purchaseEventId(TOKEN), await purchaseEventId(`${TOKEN}x`))
  })
  it('has a fixed, opaque shape and never contains the access token', async () => {
    const id = await purchaseEventId(TOKEN)
    assert.match(id ?? '', /^tiam-purchase-[0-9a-f]{32}$/)
    assert.ok(!(id ?? '').includes(TOKEN))
    assert.ok(!(id ?? '').includes(TOKEN.slice(4, 14)))
  })
  it('is null without a token', async () => {
    assert.equal(await purchaseEventId(''), null)
    assert.equal(await purchaseEventId('   '), null)
  })
})

describe('once-per-order guard (wasPurchaseSent / rememberPurchase)', () => {
  it('is false until the purchase is remembered, then true (also after a "reload" with the same storage)', () => {
    const store = memoryStore()
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-a'), false)
    rememberPurchase(store, 'tiam-purchase-a')
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-a'), true)
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-b'), false, 'another order is still to be sent')
  })
  it('remembers several orders at once', () => {
    const store = memoryStore()
    rememberPurchase(store, 'tiam-purchase-a')
    rememberPurchase(store, 'tiam-purchase-b')
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-a'), true)
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-b'), true)
  })
  it('does not grow forever: keeps the latest 20 and drops the oldest', () => {
    const store = memoryStore()
    for (let i = 0; i < 25; i++) rememberPurchase(store, `tiam-purchase-${i}`)
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-24'), true)
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-5'), true)
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-0'), false)
  })
  it('stores only event ids, never the token', () => {
    const store = memoryStore()
    rememberPurchase(store, 'tiam-purchase-a')
    assert.ok(!JSON.stringify(store.data).includes(TOKEN))
  })
  it('survives a corrupted value in the storage', () => {
    const store = memoryStore({ 'tiam.meta.purchases': '{not json' })
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-a'), false)
    rememberPurchase(store, 'tiam-purchase-a')
    assert.equal(wasPurchaseSent(store, 'tiam-purchase-a'), true)
  })
  it('never throws when the storage is blocked (private mode): it just cannot remember', () => {
    assert.equal(wasPurchaseSent(brokenStore, 'tiam-purchase-a'), false)
    assert.doesNotThrow(() => rememberPurchase(brokenStore, 'tiam-purchase-a'))
    assert.equal(wasPurchaseSent(null, 'tiam-purchase-a'), false)
    assert.doesNotThrow(() => rememberPurchase(null, 'tiam-purchase-a'))
  })
})

describe('purchaseParams (what the Purchase event carries)', () => {
  it('sends the order total in ARS, as a number, with the Cuadernos category', () => {
    const params = purchaseParams({ total: 29980, edition: 'cuadernos' })
    assert.equal(params.currency, 'ARS')
    assert.equal(params.value, 29980)
    assert.equal(params.content_type, 'product')
    assert.equal(params.content_category, 'cuadernos')
    assert.equal(params.content_name, 'cuadernos', 'same product name the landing sends in ViewContent / InitiateCheckout')
  })
  it('accepts the total as it comes on the wire (29980.00 or a numeric string)', () => {
    assert.equal(purchaseParams({ total: 29980.0, edition: 'cuadernos' }).value, 29980)
    assert.equal(purchaseParams({ total: '29980.50', edition: 'cuadernos' }).value, 29980.5)
  })
  it('leaves the value out (and invents none) when the total is missing or unusable', () => {
    for (const total of [null, undefined, 0, -5, 'abc', Number.NaN]) {
      const params = purchaseParams({ total, edition: 'cuadernos' })
      assert.ok(!('value' in params), `no value for ${String(total)}`)
      assert.equal(params.currency, 'ARS')
    }
  })
  it('keeps the Pack orders in their own category and name', () => {
    const params = purchaseParams({ total: 14990, edition: 'familias' })
    assert.equal(params.content_category, 'pack-fichas')
    assert.equal(params.content_name, 'pack-familias')
  })
  it('has no content_name for an unknown edition', () => {
    assert.ok(!('content_name' in purchaseParams({ total: 100, edition: null })))
  })
  it('carries no personal data and no health wording, whatever the order holds', () => {
    const order = { total: 29980, edition: 'cuadernos', firstName: 'Marta', email: 'marta@example.com', phone: '+54 9 221 555 5555', token: TOKEN, items: [{ title: 'Memoria' }] }
    const params = purchaseParams(order)
    const allowed = ['content_category', 'content_name', 'content_type', 'currency', 'value']
    for (const key of Object.keys(params)) assert.ok(allowed.includes(key), `unexpected parameter: ${key}`)
    const text = JSON.stringify(params)
    for (const secret of [TOKEN, 'Marta', 'marta@example.com', '555', 'Memoria']) assert.ok(!text.includes(secret), secret)
    assert.doesNotMatch(text, /demencia|alzheimer|enfermedad|deterioro|cognitiv|salud|diagn|paciente|memoria/i)
  })
})

describe('trackArgs (the fbq call)', () => {
  it('adds the eventID as the fourth argument, which is where Meta reads it', () => {
    assert.deepEqual(trackArgs('Purchase', { value: 1 }, 'tiam-purchase-a'), ['track', 'Purchase', { value: 1 }, { eventID: 'tiam-purchase-a' }])
  })
  it('sends no fourth argument without an eventID', () => {
    assert.deepEqual(trackArgs('Purchase', { value: 1 }), ['track', 'Purchase', { value: 1 }])
    assert.deepEqual(trackArgs('Lead', undefined, null), ['track', 'Lead', undefined])
  })
})

describe('where the Pixel is configured and how it is loaded (source-level checks)', () => {
  it('the tracked .env carries the TIAM pixel id', () => {
    assert.match(read('.env'), /^VITE_META_PIXEL_ID=966620562662347\s*$/m)
  })
  for (const file of ['src/lib/metaPixel.ts', 'pack/landing.ts']) {
    it(`${file} turns the automatic configuration off before init (no form scraping, no automatic button or page metadata events)`, () => {
      const source = read(file)
      const off = source.search(/'set',\s*'autoConfig',\s*'false',\s*PIXEL_ID/)
      const init = source.search(/'init',\s*PIXEL_ID/)
      assert.ok(off >= 0, 'autoConfig is switched off')
      assert.ok(init >= 0, 'the pixel is initialised')
      assert.ok(off < init, 'autoConfig goes before init')
    })
  }
  it('the SPA pixel never follows client-side navigation (it could read a token from a later URL)', () => {
    assert.match(read('src/lib/metaPixel.ts'), /disablePushState\s*=\s*true/)
  })
  it('the Purchase fires from the thank-you page only, with the once-per-order guard and the eventID', () => {
    const gracias = read('src/pages/pack/GraciasPage.tsx')
    assert.match(gracias, /trackMetaPixel\('Purchase'/)
    assert.match(gracias, /wasPurchaseSent/)
    assert.match(gracias, /rememberPurchase/)
    assert.match(gracias, /purchaseEventId/)
  })
})
