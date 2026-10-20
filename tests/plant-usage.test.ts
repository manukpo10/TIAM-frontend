// «Cada área, su planta» wherever an area is named: the plant goes next to the written label, as decoration, and the label stays.
// Static checks of the sources (the repo's pattern for markup facts, see landing-meta.test.ts); the behaviour of the mapping is in area-plants.test.ts.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { AREA_KEYS, AREA_LABELS, PLANTS_DIR } from '../src/lib/areaPlants.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('AreaPlantIcon', () => {
  const icon = read('src/components/plants/AreaPlantIcon.tsx')
  it('is decoration: alt="" and aria-hidden, lazy, with width and height (no layout shift)', () => {
    assert.match(icon, /alt=""/)
    assert.match(icon, /aria-hidden="true"/)
    assert.match(icon, /loading="lazy"/)
    assert.match(icon, /width=\{icon\.width\}/)
    assert.match(icon, /height=\{icon\.height\}/)
    assert.match(icon, /srcSet=\{icon\.srcSet\}/)
  })
})

describe('AreaChips', () => {
  const chips = read('src/components/plants/AreaChips.tsx')
  it('prints the label of each area next to its plant, in a list with an accessible name', () => {
    assert.match(chips, /<AreaPlantIcon area=\{area\}/)
    assert.match(chips, /AREA_LABELS\[area\]/, 'the label is printed next to each plant')
    assert.match(chips, /aria-label=\{label\}/)
  })
  it('only sprouts when asked to (the home page), and staggers the plants', () => {
    assert.match(chips, /useReveal<HTMLUListElement>\(sprout\)/)
    assert.match(chips, /sprout=\{sprout \? index \* 130 : undefined\}/)
  })
})

describe('/material-digital', () => {
  const page = read('src/pages/material-digital/MaterialDigitalPage.tsx')
  it('shows the plants of the areas each product covers, next to their names', () => {
    assert.match(page, /import \{ AreaChips \} from '@\/components\/plants\/AreaChips'/)
    assert.match(page, /areas: \['memoria', 'atencion', 'lenguaje', 'calculo'\]/, 'the Pack Básico: its four areas')
    assert.match(page, /areas: \[\.\.\.AREA_KEYS\]/, 'the Cuadernos TIAM: the seven areas')
    assert.match(page, /<AreaChips areas=\{product\.areas\}/)
  })
})

describe('/cuadernos: the colour key and the area chips', () => {
  const css = read('pack/landing.css')
  const partial = read('pack/_partials/coleccion-cuadernos.html')
  it('keeps the seven area names as text in the key', () => {
    const key = /<ul class="tipos tipos--dots[^"]*" aria-label="Las 7 áreas y su color">([\s\S]*?)<\/ul>/.exec(partial)?.[1] ?? ''
    for (const area of AREA_KEYS) assert.ok(key.includes(`>${AREA_LABELS[area]}</li>`), AREA_LABELS[area])
  })
  const classes: Record<string, string> = { orientacion: 'k-ori', memoria: 'k-mem', atencion: 'k-ate', lenguaje: 'k-len', calculo: 'k-cal', razonamiento: 'k-raz', visuoespacial: 'k-vis' }
  for (const area of AREA_KEYS) {
    it(`${area}: the dot of .${classes[area]} becomes its plant (1x and 2x, existing files)`, () => {
      const rule = new RegExp(`\\.tipos--dots \\.${classes[area]}::before\\s*\\{([^}]*)\\}`).exec(css)
      assert.ok(rule, 'a ::before rule for the area')
      const files = [...rule[1].matchAll(/url\((\/plantas\/v1\/[^)]+)\)/g)].map((m) => m[1])
      assert.ok(files.includes(`${PLANTS_DIR}/${area}-48.webp`), '1x file')
      assert.ok(files.includes(`${PLANTS_DIR}/${area}-96.webp`), '2x file')
      for (const file of files) assert.ok(fs.existsSync(path.join(root, 'public', file)), `${file} exists`)
      assert.match(rule[1], /image-set\(/, 'image-set for the 2x screens, after a plain url() fallback')
    })
  }
  it('reserves the icon box in the CSS, so the pills do not grow when the file arrives', () => {
    const base = /\.tipos--dots li::before\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    assert.match(base, /width:\s*1\.4rem/)
    assert.match(base, /height:\s*1\.75rem/)
  })
})

describe('the Desafío 30 días page', () => {
  const deck = read('src/pages/desafio-30-dias/AreasDeck.tsx')
  const page = read('src/pages/desafio-30-dias/Desafio30DiasPage.tsx')
  it('puts the plant on the card of each area, and keeps the coloured dot where there is no plant (Reconocimiento)', () => {
    assert.match(deck, /areaKeyOf\(card\.label\)/)
    assert.match(deck, /<AreaPlantIcon /)
    assert.match(deck, /backgroundColor: card\.color/, 'the dot stays as the fallback')
  })
  it('puts the plants in the list of the areas the Desafío works, on paper discs because that band is dark', () => {
    assert.match(page, /areaKeyOf\(label\)/)
    assert.match(page, /<AreaPlantIcon [^>]*onPaper/)
  })
})

describe('the home page: plants that sprout as you scroll', () => {
  const home = read('src/pages/landing/LandingPage.tsx')
  const sprouts = read('src/components/plants/Sprouts.tsx')
  const css = read('src/index.css')

  it('adds three kinds of spots and leaves the rest of the home as it was (the hero, the cards and the closing are untouched)', () => {
    assert.match(home, /<Sprouts areas=\{\['orientacion', 'memoria', 'atencion'\]\}[^>]*lg:hidden/, 'over the heading of the paths, on a phone')
    assert.match(home, /<Sprouts areas=\{\['orientacion', 'memoria'\]\}[^>]*right-full[^>]*hidden[^>]*lg:flex/, 'beside the heading, from lg up')
    assert.match(home, /<AreaChips areas=\{path\.areas\} label="Las áreas del Pack Básico" sprout/, 'next to the "4 áreas" of the Material digital card')
    assert.match(home, /areas: \['memoria', 'atencion', 'lenguaje', 'calculo'\]/, 'the four areas of the Pack Básico')
    assert.match(home, /pointer-events-none absolute inset-x-0 bottom-0/, 'the plants that stand on the bottom edge of the paths section')
  })
  it('keeps every hero element out of it: nothing above the fold gets a plant', () => {
    const hero = home.slice(home.indexOf('aria-labelledby="hero-heading"'), home.indexOf('aria-labelledby="paths-heading"'))
    assert.doesNotMatch(hero, /Sprouts|AreaChips|AreaPlantIcon/)
  })
  it('is decoration that cannot shift the page: aria-hidden, alt="", lazy, low priority, with the width and height of each plant', () => {
    assert.match(sprouts, /aria-hidden="true"/)
    assert.match(sprouts, /alt=""/)
    assert.match(sprouts, /loading="lazy"/)
    assert.match(sprouts, /fetchPriority="low"/)
    assert.match(sprouts, /width=\{plant\.width\}/)
    assert.match(sprouts, /height=\{plant\.height\}/)
    assert.match(sprouts, /pointer-events-none/)
  })
  it('animates only transform-like properties and lives inside prefers-reduced-motion: no-preference', () => {
    const block = css.slice(css.indexOf('/* ── Plantas ──'), css.indexOf('@media print'))
    assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/)
    const animated = [...block.matchAll(/^\s*(opacity|scale|translate|rotate|width|height|top|left|margin[\w-]*|padding[\w-]*):/gm)].map((m) => m[1])
    assert.ok(animated.length > 0)
    assert.deepEqual([...new Set(animated)].filter((p) => !['opacity', 'scale', 'translate', 'rotate'].includes(p)), [], 'nothing that moves the layout')
    // The hidden state is only inside the no-preference block: under reduced motion the plants are a still image whatever the script did.
    const outside = block.slice(0, block.indexOf('@media (prefers-reduced-motion: no-preference)'))
    assert.doesNotMatch(outside, /opacity:\s*0/)
  })
})

describe('/recursos', () => {
  const page = read('src/pages/recursos/RecursosPage.tsx')
  it('shows the plant of each area in the list of the free worksheets, and the area name stays', () => {
    assert.match(page, /<AreaPlantIcon area=\{plant\}/)
    assert.match(page, /\{area\}\s*<\/span>/, 'the area name is still printed')
  })
})
