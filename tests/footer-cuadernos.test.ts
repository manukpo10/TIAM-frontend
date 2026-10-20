// The site footer says what TIAM sells today: the Cuadernos TIAM are on sale since 2026-10-19, so the blurb names them and the "Producto" list links to their landing.
// /cuadernos is a static page outside the SPA (vercel.json rewrite): a plain <a>, never <Link> (see the note in App.tsx).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const footer = fs.readFileSync(path.join(root, 'src/components/layout/PublicFooter.tsx'), 'utf8')
const flat = footer.replace(/\s+/g, ' ')

describe('the footer blurb', () => {
  it('names the Cuadernos TIAM, with the platform launched or not', () => {
    const blurbs = [...flat.matchAll(/'(Estimulación cognitiva para cada momento:[^']*)'/g)].map((m) => m[1])
    assert.equal(blurbs.length, 2, 'one blurb per state of PLATFORM_LAUNCHED')
    for (const blurb of blurbs) {
      assert.match(blurb, /Cuadernos TIAM/)
      assert.match(blurb, /Desafío 30 días/)
      assert.match(blurb, /formación para especializarte/)
    }
  })
  it('says what is for sale as available and the platform as "pronto" while it is not launched', () => {
    const notLaunched = /: 'Estimulación cognitiva para cada momento:([^']*)'\}/.exec(flat)?.[1] ?? ''
    assert.match(notLaunched, /el Desafío 30 días y los Cuadernos TIAM para hacer en casa/)
    assert.match(notLaunched, /pronto una plataforma para profesionales/)
  })
})

describe('the "Producto" list', () => {
  it('links to the Cuadernos TIAM landing with a plain <a>, right next to "Material digital"', () => {
    const material = flat.indexOf('>Material digital</Link>')
    const cuadernos = flat.indexOf('<a href="/cuadernos"')
    assert.ok(cuadernos > -1, 'has the link')
    assert.ok(material > -1 && cuadernos > material && cuadernos - material < 200, 'right after Material digital')
    assert.match(flat, /<a href="\/cuadernos" className="[^"]*">Cuadernos TIAM<\/a>/)
    assert.doesNotMatch(flat, /<Link to="\/cuadernos"/)
  })
})

describe('the static landings footer', () => {
  it('does not repeat that blurb, so there is nothing to keep in step there', () => {
    const partial = fs.readFileSync(path.join(root, 'pack/_partials/footer.html'), 'utf8')
    assert.doesNotMatch(partial, /formación para especializarte/)
  })
})
