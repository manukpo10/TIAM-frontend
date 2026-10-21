// The words the pages use about the Desafío and the legal dates (review of 2026-10-19):
//  - the offer is «1 mes del Desafío por $15.000 (precio normal $20.000)», never "el primer mes": a buyer who already did a month gets the next one;
//  - the month runs 30 days from the PURCHASE and starts from the personal link, never "se activa por WhatsApp" (WhatsApp is only the fallback);
//  - Terms and Privacy carry today's date and Privacy covers the Cuadernos buyers too.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')

function walk(dir: string, extensions: string[]): string[] {
  const found: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full, extensions))
    else if (extensions.includes(path.extname(entry.name))) found.push(full)
  }
  return found
}

const rel = (file: string) => path.relative(root, file).replace(/\\/g, '/')

/** The visible words of a source file: HTML comments, block comments and whole-line `//` comments are not shown to anybody. */
function visible(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const COPY_FILES = [
  ...walk(path.join(root, 'pack'), ['.html']),
  path.join(root, 'src/pages/legal/packTerms.tsx'),
  path.join(root, 'src/pages/legal/PrivacyPage.tsx'),
  path.join(root, 'src/pages/legal/TermsPage.tsx'),
  path.join(root, 'src/pages/pack/gamesView.ts'),
  path.join(root, 'src/lib/whatsapp.ts'),
]

describe('how the pages talk about the Desafío month', () => {
  it('never calls it "el primer mes": the offer is 1 mes del Desafío, and a returning buyer gets the next one', () => {
    for (const file of COPY_FILES) assert.doesNotMatch(visible(file), /primer mes/i, rel(file))
  })

  it('never says the month "se activa por WhatsApp": it runs from the purchase and starts from the personal link', () => {
    for (const file of COPY_FILES) {
      const text = visible(file)
      assert.doesNotMatch(text, /se activan? por WhatsApp/i, rel(file))
      assert.doesNotMatch(text, /activar el Desaf[ií]o[^.]{0,60}por WhatsApp/i, rel(file))
    }
  })

  it('the WhatsApp fallback message asks for the link, not for a "primer ejercicio"', () => {
    const text = visible(path.join(root, 'src/lib/whatsapp.ts'))
    assert.doesNotMatch(text, /primer ejercicio/i)
    assert.match(text, /link/i)
  })

  it('the Cuadernos offer reads «1 mes del Desafío» with the 15.000 price and the normal price', () => {
    const offer = visible(path.join(root, 'pack/_partials/ofertas-cuadernos.html'))
    assert.match(offer, /1&nbsp;mes del Desafío/)
    assert.match(offer, /%PACK_GAMES_PRICE%/)
    assert.match(offer, /%PACK_GAMES_REGULAR%/)
    const faq = visible(path.join(root, 'pack/cuadernos/index.html'))
    assert.match(faq, /Ya hice el Desafío, ¿qué mes recibo\?/)
  })
})

describe('the legal pages', () => {
  it('Terms and Privacy carry the date of their last update (Privacy: the Meta Pixel paragraph, 2026-10-20)', () => {
    assert.match(fs.readFileSync(path.join(root, 'src/pages/legal/TermsPage.tsx'), 'utf8'), /const LAST_UPDATED = '19 de octubre de 2026'/)
    assert.match(fs.readFileSync(path.join(root, 'src/pages/legal/PrivacyPage.tsx'), 'utf8'), /const LAST_UPDATED = '20 de octubre de 2026'/)
  })

  it('Privacy covers the people who buy the Cuadernos and says the Desafío starts from the personal link', () => {
    const privacy = visible(path.join(root, 'src/pages/legal/PrivacyPage.tsx')).replace(/\s+/g, ' ')
    assert.match(privacy, /Cuadernos TIAM/)
    assert.match(privacy, /enlace personal/)
  })
})
