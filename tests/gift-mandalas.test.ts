// The gift of the Cuadernos: «Mandalas para pintar» (22 pages, 20 black-line mandalas to colour). Every Cuadernos order gets it, with or without the Desafío month,
// and the ads say «Mandalas de regalo con tu compra». These tests check what the landing says about it, that the pictures exist and are light, that the words stay
// sober (no health claims, no false urgency) and that the Pack landings do not mention it.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file: string) => fs.existsSync(path.join(root, file))

/** What a buyer can read: no HTML comments, no tags, entities turned into spaces, one space between words. */
function words(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const GIFT_SENTENCE = 'Cuadernillo de mandalas para pintar: 20 mandalas de línea negra para colorear con lápices o marcadores, en tres niveles de detalle.'
const PARTIAL = 'pack/_partials/regalo-cuadernos.html'

/** Things the gift must never promise: nothing about health or about what colouring does for anybody. */
const HEALTH_CLAIMS = /salud|relaj|estr[eé]s|ansiedad|terap|calma|bienestar|memoria|cognitiv|prevenci|demencia|alzheimer|beneficio|mejora/i
/** ...and no false urgency. */
const URGENCY = /[uú]ltim|solo por hoy|por tiempo limitado|tiempo limitado|antes de que|se acaba|quedan|hoy mismo|aprovech|no te lo pierdas|solo hasta/i

describe('the gift block on the Cuadernos landing', () => {
  it('is included by the Cuadernos landing, between the comparison and the price, and by no Pack landing', () => {
    const cuadernos = read('pack/cuadernos/index.html')
    const gift = cuadernos.indexOf('<!--include:regalo-cuadernos-->')
    assert.ok(gift > -1, 'the Cuadernos landing includes the gift partial')
    assert.ok(gift > cuadernos.indexOf('<!--include:comparacion-cuadernos-->'), 'after the comparison')
    assert.ok(gift < cuadernos.indexOf('<!--include:ofertas-cuadernos-->'), 'before the price block')
    for (const slug of ['familias', 'profesionales']) {
      const html = read(`pack/${slug}/index.html`)
      assert.doesNotMatch(html, /regalo-cuadernos/, slug)
      assert.doesNotMatch(words(html), /mandalas/i, slug)
    }
  })

  it('says «De regalo con tu compra» and the sentence the owner approved', () => {
    const text = words(read(PARTIAL))
    assert.match(text, /De regalo con tu compra/)
    assert.ok(text.includes(GIFT_SENTENCE), 'the approved sentence, word for word')
  })

  it('says it comes with every purchase of the Cuadernos, with or without the Desafío month, in A4 and Carta', () => {
    const text = words(read(PARTIAL))
    assert.match(text, /con o sin el mes del Desafío/)
    assert.match(text, /A4 y en Carta/)
  })

  it('shows the real cover, honestly: it is in colour, the pages inside are black line', () => {
    const html = read(PARTIAL)
    const img = /<img\b[^>]*>/.exec(html)?.[0] ?? ''
    assert.ok(img, 'the cover picture is there')
    assert.match(img, /\balt="[^"]{60,}"/, 'a descriptive alt')
    assert.match(img, /alt="[^"]*Mandalas para pintar/)
    assert.match(img, /\bwidth="\d+"/)
    assert.match(img, /\bheight="\d+"/)
    assert.match(img, /loading="lazy"/)
    assert.match(words(html), /La tapa es a color\. Adentro, los mandalas son de línea negra/)
  })

  it('has no health claim and no false urgency', () => {
    const text = words(read(PARTIAL))
    assert.doesNotMatch(text, HEALTH_CLAIMS)
    assert.doesNotMatch(text, URGENCY)
    assert.doesNotMatch(text, /\$/, 'the gift carries no price in pesos')
  })
})

describe('the cover pictures', () => {
  const SIZES = [240, 400]
  it('exist as light webp files at two widths, like the covers of the four workbooks', () => {
    for (const width of SIZES) {
      const file = `pack/img/mandalas-tapa-${width}.webp`
      assert.ok(exists(file), `${file} exists`)
      const bytes = fs.statSync(path.join(root, file)).size
      assert.ok(bytes < 90_000, `${file} is ${bytes} bytes: keep every cover under 90 KB`)
    }
  })

  it('are the only pictures the partial and the offer point to, and they all exist', () => {
    const sources = [PARTIAL, 'pack/_partials/ofertas-cuadernos.html'].flatMap((file) => [...read(file).matchAll(/\/pack\/img\/(mandalas-[\w-]+\.webp)/g)].map((m) => m[1]))
    assert.ok(sources.length > 0)
    for (const name of new Set(sources)) assert.ok(exists(`pack/img/${name}`), name)
  })
})

describe('the gift in the price section', () => {
  const offer = read('pack/_partials/ofertas-cuadernos.html')

  it('is a line of «Todo lo que recibís» (its own «De regalo con tu compra» sub-list), with the cover thumbnail', () => {
    const received = /<section class="stack"[\s\S]*?<\/section>/.exec(offer)?.[0] ?? ''
    assert.match(words(received), /De regalo con tu compra/)
    assert.match(words(received), /De regalo: Mandalas para pintar/)
    assert.match(words(received), /20 mandalas de línea negra para colorear/)
    assert.match(received, /class="extra-cover"[^>]*mandalas-tapa-240\.webp|mandalas-tapa-240\.webp[^>]*class="extra-cover"/, 'the existing small-cover style, not a new one')
    assert.ok(received.indexOf('De regalo con tu compra') < received.indexOf('Opcional, al pagar'), 'before the optional Desafío month')
  })

  it('is named in the price box, next to the price', () => {
    const head = /<div class="price-head">[\s\S]*?<\/div>/.exec(offer)?.[0] ?? ''
    assert.match(words(head), /De regalo:? .*mandalas/i)
  })

  it('keeps the price and the totals exactly as they were (nothing changes except the gift)', () => {
    assert.match(offer, /%PACK_PRICE%/)
    assert.match(offer, /data-base="%PACK_PRICE_NUM%"/)
    assert.match(offer, /data-price="%PACK_GAMES_PRICE_NUM%"/)
  })

  it('has no health claim and no false urgency in the lines about the gift', () => {
    const lines = words(offer).split(/(?<=[.!?])\s+/).filter((line) => /mandala/i.test(line))
    assert.ok(lines.length >= 2)
    for (const line of lines) {
      assert.doesNotMatch(line, HEALTH_CLAIMS, line)
      assert.doesNotMatch(line, URGENCY, line)
    }
  })
})

describe('the FAQ of the Cuadernos landing', () => {
  const faq = words(read('pack/cuadernos/index.html'))

  it('says how the gift arrives and that it costs nothing extra', () => {
    assert.match(faq, /¿El cuadernillo de mandalas tiene un costo aparte\?/)
    assert.match(faq, /Está incluido en la compra de los cuadernos, con o sin el mes del Desafío/)
  })

  it('names the gift when it lists what arrives by email', () => {
    assert.match(faq, /Recibís los PDF de los 4 cuadernos y el cuadernillo de mandalas de regalo/)
  })
})

describe('the thank-you page and the downloads page', () => {
  it('the paid Cuadernos fixture and the dev mock list the gift as one more file of the same item, in both papers', () => {
    const fixture = JSON.parse(read('src/pages/pack/contract/order-paid-cuadernos.json')) as { data: { items: { files: { key: string; label: string; paper: string; sizeMb: number }[] }[] } }
    assert.equal(fixture.data.items.length, 1, 'still one item')
    const files = fixture.data.items[0].files
    for (const [key, paper] of [['mandalas-para-pintar-a4', 'A4'], ['mandalas-para-pintar-carta', 'Carta']]) {
      const gift = files.find((file) => file.key === key)
      assert.ok(gift, key)
      assert.equal(gift.label, 'Regalo: Mandalas para pintar')
      assert.equal(gift.paper, paper)
      assert.equal(gift.sizeMb, 10)
    }
    const mock = read('src/pages/pack/packMock.ts')
    assert.match(mock, /key: 'mandalas-para-pintar-a4', label: 'Regalo: Mandalas para pintar'/)
    assert.match(mock, /key: 'mandalas-para-pintar-carta', label: 'Regalo: Mandalas para pintar'/)
  })

  it('the Pack fixture has no gift', () => {
    assert.doesNotMatch(read('src/pages/pack/contract/order-paid.json'), /mandalas|Regalo/i)
  })
})
