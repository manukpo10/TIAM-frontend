// The seller's street address is public in ARCA and the owner accepts publishing it, with the exposure kept to a minimum (owner decision, 2026-10-19):
//   - the FULL address goes ONLY in the seller-information block of the legal pages (Terms, id="vendedor");
//   - the landings' footers (and everything else) show only the city and a link «Datos del vendedor» to that block;
//   - never in emails, meta tags, structured data, OG images or alt texts.
// This test reads the sources: it fails if the address (or its config variable) shows up anywhere but the legal config and the Terms clauses.
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

/** What identifies the street address, and the variable that carries it. */
const STREET = [/Calle\s*155/i, /\b1721\b/, /entre\s*67\s*y\s*68/i, /VITE_PACK_LEGAL_ADDRESS/]

/** The only places allowed to know the street address: the config that reads it and the Terms clause that prints it. */
const ALLOWED = new Set(['src/pages/legal/legalConfig.ts', 'src/pages/legal/packTerms.tsx'])

describe('the street address stays on the legal pages', () => {
  it('no landing, partial, script of the landings, public text file or index.html mentions it', () => {
    const files = [
      ...walk(path.join(root, 'pack'), ['.html', '.ts', '.css']),
      ...walk(path.join(root, 'public'), ['.html', '.xml', '.txt', '.json', '.webmanifest']),
      ...walk(path.join(root, 'scripts', 'pack-landings'), ['.mjs', '.py']),
      path.join(root, 'index.html'),
      path.join(root, 'vite.config.ts'),
    ].filter((file) => fs.existsSync(file))
    assert.ok(files.length > 20, 'the walk found the landings')
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const pattern of STREET) assert.doesNotMatch(text, pattern, `${rel(file)} must not carry the street address (${pattern})`)
    }
  })

  it('in the app, only the legal config and the Terms clauses know it', () => {
    const files = walk(path.join(root, 'src'), ['.ts', '.tsx'], (file) => ALLOWED.has(rel(file)) || rel(file).startsWith('src/pages/pack/contract/'))
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const pattern of STREET) assert.doesNotMatch(text, pattern, `${rel(file)} must not carry the street address (${pattern})`)
    }
  })

  it('the Terms print it in the seller-information block, which the footers link to', () => {
    const terms = read('src/pages/legal/packTerms.tsx')
    assert.match(terms, /id="vendedor"/)
    assert.match(terms, /LEGAL_ADDRESS/)
    const config = read('src/pages/legal/legalConfig.ts')
    assert.match(config, /VITE_PACK_LEGAL_ADDRESS/)
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
  const env = read('.env')
  const value = (key: string) => new RegExp(`^${key}=(.*)$`, 'm').exec(env)?.[1].trim() ?? ''
  it('has the seller name, CUIT, city and the contact email', () => {
    assert.equal(value('VITE_PACK_LEGAL_ENTITY'), 'Manuel Alejandro Robles Robles, CUIT 20-19019644-6')
    assert.equal(value('VITE_PACK_LEGAL_CITY'), 'La Plata, Provincia de Buenos Aires')
    assert.equal(value('VITE_PACK_CONTACT_URL'), 'mailto:manuu.robles@gmail.com')
    assert.equal(value('VITE_PACK_CONTACT_TEXT'), 'manuu.robles@gmail.com')
  })
  it('keeps the full address in its own variable, with the city and the street in it', () => {
    assert.match(value('VITE_PACK_LEGAL_ADDRESS'), /^Calle 155 N\.º 1721, entre 67 y 68, Los Hornos \(CP 1900\), La Plata, Provincia de Buenos Aires$/)
  })
  it('leaves the guarantee days and the licence texts as placeholders (pending owner data)', () => {
    for (const key of ['VITE_PACK_LICENSE_FAMILIAS', 'VITE_PACK_LICENSE_PROFESIONALES', 'VITE_PACK_LICENSE_CUADERNOS']) assert.equal(value(key), '', key)
  })
})
