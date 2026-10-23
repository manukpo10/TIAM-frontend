// The thank-you page tells the buyer the files also went by email and what to do if the mailbox filed it in Spam
// (Yahoo does, and it disables the links of a mail it files there). Same wording as the "Resumen" line of the email itself.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { EMAIL_NOTICE } from '../src/pages/pack/emailNoticeCopy.ts'

const root = path.resolve(import.meta.dirname, '..')
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\s+/g, ' ')

describe('EMAIL_NOTICE (the copy)', () => {
  it('says the files also went by email, where to look and what to mark so the links work', () => {
    assert.equal(
      EMAIL_NOTICE.body,
      'Te mandamos también los archivos por mail. Si no lo ves, revisá la carpeta de Spam o Correo no deseado, y marcalo como "No es spam" para que funcionen los enlaces.',
    )
  })
  it('has a title, and speaks in voseo (never the "tú" forms)', () => {
    assert.ok(EMAIL_NOTICE.title.length > 0)
    for (const text of [EMAIL_NOTICE.title, EMAIL_NOTICE.body]) {
      assert.doesNotMatch(text, /\b(revisa|marca|tienes|puedes|mira)\b/i)
    }
  })
})

describe('the thank-you page', () => {
  const gracias = source('src/pages/pack/GraciasPage.tsx')
  const paid = gracias.slice(gracias.indexOf('function Paid('), gracias.indexOf('function Waiting('))

  it('shows the notice once the payment is confirmed, for every product (Pack and Cuadernos share this view)', () => {
    assert.ok(paid.length > 0, 'found the paid view')
    assert.match(paid, /<EmailNotice>/)
  })
  it('keeps the link to the downloads page and the downloads panel in that view', () => {
    assert.match(paid, /<DownloadsPanel order=\{order\} token=\{token\} \/>/)
    assert.match(paid, /Abrir mi página de descargas/)
  })
  it('no longer carries its own, weaker "revisá la carpeta de spam o de promociones" line', () => {
    assert.doesNotMatch(gracias, /carpeta de spam o de promociones/)
  })
})

describe('the notice component', () => {
  const component = source('src/pages/pack/EmailNotice.tsx')

  it('renders the copy from emailNoticeCopy.ts, not its own text', () => {
    assert.match(component, /EMAIL_NOTICE\.title/)
    assert.match(component, /EMAIL_NOTICE\.body/)
    assert.doesNotMatch(component, /No es spam/)
  })
  it('hides its decorative icon from assistive technology and is announced as a note', () => {
    assert.match(component, /aria-hidden/)
    assert.match(component, /role="note"/)
  })
})
