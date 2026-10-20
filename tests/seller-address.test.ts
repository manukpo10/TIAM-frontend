// The seller's street address is public in ARCA and the owner accepts publishing it, with the exposure kept to a minimum (owner decision, 2026-10-19):
//   - the FULL address goes ONLY in the seller-information block of the legal pages (Terms, id="vendedor");
//   - the landings' footers (and everything else) show only the city and a link «Datos del vendedor» to that block;
//   - never in emails, meta tags, structured data, OG images or alt texts.
//
// This test never contains the address itself: it reads it from the same config the Terms use (VITE_PACK_LEGAL_ADDRESS in the tracked .env, the single source)
// and asserts where it may and may not appear. It fails if the address (or its variable) shows up anywhere but the legal config and the Terms clauses.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')

function walk(dir: string, extensions: string[], skip: (file: string) => boolean = () => false): string[] {
  const found: string[] = []
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full, extensions, skip))
    else if (extensions.includes(path.extname(entry.name)) && !skip(full)) found.push(full)
  }
  return found
}

const rel = (file: string) => path.relative(root, file).replace(/\\/g, '/')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const env = read('.env')
const value = (key: string) => new RegExp(`^${key}=(.*)$`, 'm').exec(env)?.[1].trim() ?? ''

/** The address as configured, and the pieces of it that would give the street away if they leaked on their own. */
const address = value('VITE_PACK_LEGAL_ADDRESS')
const segments = address.split(',').map((part) => part.trim())
const street = segments.slice(0, 2).join(', ')
const streetNumbers = segments[0]?.match(/\d{4,}/g) ?? []

/** What must not show up outside the allowed files: the whole address, its street part, its street number and the variable that carries it. */
const LEAKS: RegExp[] = [address, street, segments[0] ?? '', ...streetNumbers].filter((text) => text.length >= 4).map((text) => new RegExp(escapeRegExp(text), 'i'))
LEAKS.push(/VITE_PACK_LEGAL_ADDRESS/)

/** The only places allowed to know the street address: the config that reads it and the Terms clause that prints it. */
const ALLOWED = new Set(['src/pages/legal/legalConfig.ts', 'src/pages/legal/packTerms.tsx'])

describe('the configured address', () => {
  it('is a real, full address with the city at the end', () => {
    assert.ok(segments.length >= 3, 'street, neighbourhood and city at least')
    assert.ok(streetNumbers.length >= 1, 'the street part carries a number')
    const city = value('VITE_PACK_LEGAL_CITY')
    assert.ok(city.length > 0)
    assert.ok(address.endsWith(city), 'the footers show the city, which is the end of the address')
  })
})

describe('the street address stays on the legal pages', () => {
  it('no landing, partial, script of the landings, public text file or index.html mentions it', () => {
    const files = [
      ...walk(path.join(root, 'pack'), ['.html', '.ts', '.css']),
      ...walk(path.join(root, 'public'), ['.html', '.xml', '.txt', '.json', '.webmanifest']),
      ...walk(path.join(root, 'scripts', 'pack-landings'), ['.mjs', '.py']),
      path.join(root, 'index.html'),
    ].filter((file) => fs.existsSync(file))
    assert.ok(files.length > 20, 'the walk found the landings')
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const pattern of LEAKS) assert.doesNotMatch(text, pattern, `${rel(file)} must not carry the street address (${pattern.source.length} chars)`)
    }
    // The build config may NAME the variable (the live landing requires it) but must never hold the address itself.
    const config = read('vite.config.ts')
    for (const pattern of LEAKS.filter((leak) => leak.source !== 'VITE_PACK_LEGAL_ADDRESS')) assert.doesNotMatch(config, pattern, 'vite.config.ts must not carry the street address')
  })

  it('in the app, only the legal config and the Terms clauses know it', () => {
    const files = walk(path.join(root, 'src'), ['.ts', '.tsx'], (file) => ALLOWED.has(rel(file)) || rel(file).startsWith('src/pages/pack/contract/'))
    assert.ok(files.length > 50, 'the walk found the app')
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const pattern of LEAKS) assert.doesNotMatch(text, pattern, `${rel(file)} must not carry the street address (${pattern.source.length} chars)`)
    }
  })

  it('this very test does not contain the address', () => {
    const self = read('tests/seller-address.test.ts')
    for (const pattern of LEAKS.filter((leak) => leak.source !== 'VITE_PACK_LEGAL_ADDRESS')) assert.doesNotMatch(self, pattern)
  })

  it('the Terms print it in the seller-information block, which the footers link to', () => {
    const terms = read('src/pages/legal/packTerms.tsx')
    assert.match(terms, /id="vendedor"/)
    assert.match(terms, /LEGAL_ADDRESS/)
    assert.match(read('src/pages/legal/legalConfig.ts'), /VITE_PACK_LEGAL_ADDRESS/)
  })
})

describe('the landings footer shows the city and a link to the seller block, not the street', () => {
  const footer = read('pack/_partials/footer.html')
  it('shows the city from the config', () => {
    assert.match(footer, /%VITE_PACK_LEGAL_CITY%/)
  })
  it('links «Datos del vendedor» to the Terms block', () => {
    assert.match(footer, /href="\/terms#vendedor"[^>]*>\s*Datos del vendedor/)
  })
})

describe('the committed config carries the seller data', () => {
  it('has the seller (name and CUIT), the city and the contact email, and they agree with each other', () => {
    assert.match(value('VITE_PACK_LEGAL_ENTITY'), /CUIT \d{2}-\d{8}-\d$/)
    assert.ok(value('VITE_PACK_LEGAL_CITY').length > 0)
    const email = value('VITE_PACK_CONTACT_TEXT')
    assert.match(email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/)
    assert.equal(value('VITE_PACK_CONTACT_URL'), `mailto:${email}`)
  })
  it('has a valid CUIT check digit', () => {
    const digits = /CUIT (\d{2})-(\d{8})-(\d)$/.exec(value('VITE_PACK_LEGAL_ENTITY'))
    assert.ok(digits)
    const body = digits[1] + digits[2]
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    const sum = [...body].reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const check = 11 - (sum % 11)
    assert.equal(check === 11 ? 0 : check, Number(digits[3]))
  })
})

describe('the licence texts', () => {
  it('has the Cuadernos licence approved by the owner (2026-10-19): personal and family use, no resale, no workshops', () => {
    const licence = value('VITE_PACK_LICENSE_CUADERNOS')
    assert.match(licence, /todas las veces que quieras/)
    assert.match(licence, /vos y tu familia/)
    assert.match(licence, /No se pueden revender, compartir públicamente ni usar en talleres, clases u otras actividades comerciales\.$/)
  })
  it('leaves the Pack licences as placeholders (pending owner data)', () => {
    for (const key of ['VITE_PACK_LICENSE_FAMILIAS', 'VITE_PACK_LICENSE_PROFESIONALES']) assert.equal(value(key), '', key)
  })
})
