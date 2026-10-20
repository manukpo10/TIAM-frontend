// The garden band at the top of the footer of every page: the SPA's PublicFooter (React) and the static landings' footer partial (pack/_partials/footer.html).
// It is pure decoration: aria-hidden, alt="", lazy, with its size declared so it can't shift the page, and it sits in the flow right above the footer.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { GARDEN } from '../src/lib/areaPlants.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('the SPA footer', () => {
  const footer = read('src/components/layout/PublicFooter.tsx')
  const band = read('src/components/plants/GardenBand.tsx')

  it('puts the garden band right above the <footer>, in the flow', () => {
    assert.match(footer, /import \{ GardenBand \} from '@\/components\/plants\/GardenBand'/)
    const at = footer.indexOf('<GardenBand />')
    assert.ok(at > -1, 'renders <GardenBand />')
    assert.ok(at < footer.indexOf('<footer'), 'before the footer element')
  })
  it('keeps the Data Fiscal seal and the footer landmark untouched', () => {
    assert.equal((footer.match(/<footer\b/g) ?? []).length, 1)
    assert.match(footer, /DATAWEB\.jpg/)
  })
  it('is decoration: aria-hidden, alt="", lazy, low priority, with its size declared', () => {
    assert.match(band, /aria-hidden="true"/)
    assert.match(band, /alt=""/)
    assert.match(band, /loading="lazy"/)
    assert.match(band, /decoding="async"/)
    assert.match(band, /fetchPriority="low"/)
    assert.match(band, /width=\{GARDEN\.width\}/)
    assert.match(band, /height=\{GARDEN\.height\}/)
  })
  it('offers AVIF first and WebP as the fallback', () => {
    assert.ok(band.indexOf('image/avif') > -1 && band.indexOf('image/avif') < band.indexOf('image/webp'))
    assert.match(band, /srcSet=\{GARDEN\.avifSrcSet\}/)
    assert.match(band, /srcSet=\{GARDEN\.webpSrcSet\}/)
  })
  it('is also on the legal pages, whose footer is its own', () => {
    const legal = read('src/pages/legal/LegalPage.tsx')
    assert.match(legal, /<GardenBand \/>/)
  })
})

describe('the footer of the static landings', () => {
  const partial = read('pack/_partials/footer.html')
  const band = partial.slice(0, partial.indexOf('<footer'))

  it('has the garden band before the <footer>, in the flow', () => {
    assert.ok(band.includes('<picture>'), 'the band comes first')
  })
  it('is decoration: aria-hidden, alt="", lazy, with the width and height of the file', () => {
    assert.match(band, /aria-hidden="true"/)
    assert.match(band, /<img [^>]*alt=""/)
    assert.match(band, /loading="lazy"/)
    assert.match(band, /decoding="async"/)
    assert.match(band, new RegExp(`width="${GARDEN.width}" height="${GARDEN.height}"`))
  })
  it('offers the same files as the SPA, AVIF first', () => {
    const avif = band.indexOf('type="image/avif"')
    const webp = band.indexOf('type="image/webp"')
    assert.ok(avif > -1 && webp > avif)
    assert.ok(band.includes(`srcset="${GARDEN.avifSrcSet}"`))
    assert.ok(band.includes(`srcset="${GARDEN.webpSrcSet}"`))
    assert.ok(band.includes(`src="${GARDEN.src}"`))
  })
  it('is included by the three landings (so it is on /cuadernos and the Pack landings)', () => {
    for (const landing of ['cuadernos', 'familias', 'profesionales']) {
      assert.match(read(`pack/${landing}/index.html`), /<!--include:footer-->/, landing)
    }
  })
  it('keeps the footer element, its data-watch-cta mark and the Data Fiscal seal', () => {
    assert.match(partial, /<footer class="[^"]*" data-watch-cta>/)
    assert.match(partial, /DATAWEB\.jpg/)
  })
})
