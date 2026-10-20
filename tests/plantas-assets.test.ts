// The weight budget and the format of the plant files (public/plantas/v1, exported by scripts/plantas/export_plantas.py).
// Budget of the owner's brief: each icon under 4 KB, the footer band under 60 KB, everything the home adds under 120 KB, all with transparency.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
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

/** Canvas size of a WebP with an extended header (VP8X): width - 1 and height - 1 as 24-bit little-endian numbers at bytes 24 and 27. */
function webpSize(file: Buffer): { w: number; h: number } {
  return { w: 1 + file.readUIntLE(24, 3), h: 1 + file.readUIntLE(27, 3) }
}
/** Size of an AVIF: its `ispe` box (image spatial extents) holds width and height as 32-bit big-endian numbers after 4 bytes of version and flags. */
function avifSize(file: Buffer): { w: number; h: number } {
  const at = file.indexOf('ispe')
  assert.ok(at > -1, 'the AVIF has an ispe box')
  return { w: file.readUInt32BE(at + 8), h: file.readUInt32BE(at + 12) }
}

describe('the size of every file is the one the code declares (a wrong number would stretch a plant or shift the layout)', () => {
  it('the icons are 48x60 and 96x120, the 4:5 boxes plantIcon() reserves', () => {
    for (const area of AREA_KEYS) {
      assert.deepEqual(webpSize(read(`${PLANTS_DIR}/${area}-48.webp`)), { w: 48, h: 60 }, `${area}-48`)
      assert.deepEqual(webpSize(read(`${PLANTS_DIR}/${area}-96.webp`)), { w: 96, h: 120 }, `${area}-96`)
    }
  })
  it('each sprouting plant is 240 px tall and as wide as plantGrow() says', () => {
    for (const area of AREA_KEYS) {
      const native = plantGrow(area, 240)
      assert.deepEqual(webpSize(read(native.src)), { w: native.width, h: 240 }, area)
    }
  })
  it('the garden band is 1600x250 (and 800x125), in WebP and in AVIF, like GARDEN says', () => {
    assert.deepEqual(webpSize(read(`${PLANTS_DIR}/jardin-1600.webp`)), { w: GARDEN.width, h: GARDEN.height })
    assert.deepEqual(avifSize(read(`${PLANTS_DIR}/jardin-1600.avif`)), { w: GARDEN.width, h: GARDEN.height })
    assert.deepEqual(webpSize(read(`${PLANTS_DIR}/jardin-800.webp`)), { w: GARDEN.width / 2, h: GARDEN.height / 2 })
    assert.deepEqual(avifSize(read(`${PLANTS_DIR}/jardin-800.avif`)), { w: GARDEN.width / 2, h: GARDEN.height / 2 })
  })
})

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
  it('is an AVIF (an ftyp box that says avif)', () => {
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

describe('the versioned folder is immutable', () => {
  it('no file of the current version changed: a changed file never reaches the visitors who already cached it for a year', () => {
    const version = PLANTS_DIR.split('/').pop()
    const expected = JSON.parse(fs.readFileSync(path.join(root, 'tests', `plantas-${version}.sha256.json`), 'utf8')) as Record<string, string>
    const dir = fileOf(PLANTS_DIR)
    const actual = Object.fromEntries(fs.readdirSync(dir).sort().map((name) => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')]))
    assert.deepEqual(
      actual,
      expected,
      `A file of public${PLANTS_DIR} changed. vercel.json caches this folder as immutable for a year, so do not overwrite it: export the new art to a new folder ` +
        `(python scripts/plantas/export_plantas.py --version=v2), point PLANTS_DIR (src/lib/areaPlants.ts), the vercel.json rule and the static partials (pack/_partials/footer.html, planta-*.html) at it, ` +
        `and add tests/plantas-v2.sha256.json.`,
    )
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
