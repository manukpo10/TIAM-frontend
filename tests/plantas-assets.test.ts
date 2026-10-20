// The weight budget and the format of the plant files (public/plantas/v1, exported by scripts/plantas/export_plantas.py).
// Budget of the owner's brief: each icon under 4 KB, the footer band under 60 KB, everything the home adds under 120 KB, all with transparency.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { AREA_KEYS, GARDEN, PLANTS_DIR, plantGrow, plantIcon } from '../src/lib/areaPlants.ts'

const root = path.resolve(import.meta.dirname, '..')
const KB = 1024

/** The file a site path like /plantas/v1/memoria-48.webp points at (it is served from public/). */
const fileOf = (sitePath: string): string => path.join(root, 'public', ...sitePath.split('/').filter(Boolean))
const read = (sitePath: string): Buffer => fs.readFileSync(fileOf(sitePath))
const sizeOf = (sitePath: string): number => read(sitePath).length

/** A WebP made by the exporter: RIFF....WEBP, and an extended header (VP8X) with the alpha flag on. */
function webpHasAlpha(file: Buffer): boolean {
  return file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP' && file.toString('ascii', 12, 16) === 'VP8X' && (file[20] & 0x10) !== 0
}

describe('the area icons', () => {
  for (const area of AREA_KEYS) {
    const icon = plantIcon(area, 40)
    const files = icon.srcSet.split(',').map((part) => part.trim().split(' ')[0])
    it(`${area}: 1x and 2x exist, each under 4 KB, with transparency`, () => {
      assert.equal(files.length, 2)
      for (const file of files) {
        assert.ok(fs.existsSync(fileOf(file)), `${file} exists`)
        assert.ok(sizeOf(file) < 4 * KB, `${file} is ${sizeOf(file)} bytes`)
        assert.ok(webpHasAlpha(read(file)), `${file} has an alpha channel`)
      }
    })
  }
})

describe('the garden band of the footer', () => {
  it('has both widths in both formats, and the 1600 px ones are under 60 KB', () => {
    for (const ext of ['avif', 'webp']) {
      for (const width of [800, 1600]) {
        const file = `${PLANTS_DIR}/jardin-${width}.${ext}`
        assert.ok(fs.existsSync(fileOf(file)), `${file} exists`)
      }
      assert.ok(sizeOf(`${PLANTS_DIR}/jardin-1600.${ext}`) < 60 * KB, `1600 .${ext} is ${sizeOf(`${PLANTS_DIR}/jardin-1600.${ext}`)} bytes`)
      assert.ok(sizeOf(`${PLANTS_DIR}/jardin-800.${ext}`) < 30 * KB, `800 .${ext} is ${sizeOf(`${PLANTS_DIR}/jardin-800.${ext}`)} bytes`)
    }
  })
  it('is at most 1600 px wide, as the brief says, and its WebP keeps the transparency', () => {
    assert.ok(GARDEN.width <= 1600)
    assert.ok(webpHasAlpha(read(`${PLANTS_DIR}/jardin-1600.webp`)))
    assert.ok(webpHasAlpha(read(`${PLANTS_DIR}/jardin-800.webp`)))
  })
  it('is an AVIF (ftyp avif) with the declared size', () => {
    const avif = read(`${PLANTS_DIR}/jardin-1600.avif`)
    assert.equal(avif.toString('ascii', 4, 8), 'ftyp')
    assert.match(avif.toString('ascii', 8, 16), /^avi[fs]/)
  })
})

describe('what the home adds', () => {
  it('all the sprouting plants and every icon together weigh under 120 KB (the home only loads some of them, lazily)', () => {
    const everything = AREA_KEYS.flatMap((area) => [plantGrow(area).src, ...plantIcon(area, 40).srcSet.split(',').map((part) => part.trim().split(' ')[0])])
    const total = everything.reduce((sum, file) => sum + sizeOf(file), 0)
    assert.ok(total < 120 * KB, `${total} bytes`)
  })
  it('each sprouting plant exists, keeps its transparency and is under 12 KB', () => {
    for (const area of AREA_KEYS) {
      const { src } = plantGrow(area)
      assert.ok(webpHasAlpha(read(src)), `${src} has an alpha channel`)
      assert.ok(sizeOf(src) < 12 * KB, `${src} is ${sizeOf(src)} bytes`)
    }
  })
})

describe('caching', () => {
  it('vercel.json lets the browser keep the versioned plant files for a year (the folder name carries the version)', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }
    const rule = config.headers.find((entry) => entry.source === `${PLANTS_DIR}/:file`)
    assert.ok(rule, 'a header rule for the plants folder')
    const cache = rule.headers.find((header) => header.key === 'Cache-Control')?.value
    assert.equal(cache, 'public, max-age=31536000, immutable')
  })
})
