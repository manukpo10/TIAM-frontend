// «Cada área, su planta» wherever an area is named: the plant goes next to the written label, as decoration, and the label stays.
// Static checks of the sources (the repo's pattern for markup facts, see landing-meta.test.ts); the behaviour of the mapping is in area-plants.test.ts.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { AREA_KEYS, AREA_LABELS, PLANTS_DIR } from '../src/lib/areaPlants.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
/** The source without its comments (block, JSX and whole-line ones): the docs of a component say alt="" too, and a test must fail when the real attribute is gone. */
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('AreaPlantIcon', () => {
  const icon = code('src/components/plants/AreaPlantIcon.tsx')
  it('is decoration: alt="" and aria-hidden, lazy and low priority, with width and height (no layout shift)', () => {
    assert.match(icon, /alt=""/)
    assert.match(icon, /aria-hidden="true"/)
    assert.match(icon, /loading="lazy"/)
    // In the Desafío's hero the deck's first card is the LCP image: the icons next to its label must not compete with it.
    assert.match(icon, /fetchPriority="low"/)
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
    const include = `planta-${area}`
    it(`${area}: every ${classes[area]} item has its plant in front of the name, through the ${include} partial`, () => {
      const items = [...partial.matchAll(new RegExp(`<li class="${classes[area]}">([^<]*(?:<!--include:[\\w-]+-->)?[^<]*)</li>`, 'g'))].map((m) => m[1])
      assert.equal(items.length, 5, 'the key plus the exercise of each of the 4 cuadernos')
      for (const item of items) assert.ok(item.startsWith(`<!--include:${include}-->`), `${item} starts with the plant`)
    })
    it(`${area}: the ${include} partial is a decorative, lazy <img> with its size and both densities`, () => {
      const img = read(`pack/_partials/${include}.html`).trim()
      assert.match(img, /^<img [^>]*>$/, 'one <img> and nothing else (no spaces around it)')
      assert.ok(img.includes(`src="${PLANTS_DIR}/${area}-48.webp"`))
      assert.ok(img.includes(`srcset="${PLANTS_DIR}/${area}-48.webp 1x, ${PLANTS_DIR}/${area}-96.webp 2x"`))
      assert.match(img, /alt=""/)
      assert.match(img, /aria-hidden="true"/)
      assert.match(img, /loading="lazy"/)
      assert.match(img, /decoding="async"/)
      assert.match(img, /width="22" height="28"/)
      for (const file of [`${area}-48.webp`, `${area}-96.webp`]) assert.ok(fs.existsSync(path.join(root, 'public', 'plantas', 'v1', file)), file)
    })
  }
  it('left no dead CSS behind: the coloured dots are gone, and so are the --k colours only they used', () => {
    assert.doesNotMatch(css, /--k:/)
    assert.doesNotMatch(css, /var\(--k\)/)
    assert.doesNotMatch(css, /\.tipos--dots[^{]*::before/, 'no pseudo-element dot in front of the area names')
  })
  it('is lazy on purpose: no CSS background loads the plants at page load (the landing is the one that sells)', () => {
    assert.doesNotMatch(css, /url\(\s*["']?\/plantas/)
  })
  it('reserves the icon box in the CSS, so the pills do not grow when the file arrives', () => {
    const rule = /\.tipos--dots li > img\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    assert.match(rule, /width:\s*1\.4rem/)
    assert.match(rule, /height:\s*1\.75rem/)
    assert.match(rule, /margin-block:\s*-0\.3rem/)
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
  const sprouts = code('src/components/plants/Sprouts.tsx')
  const css = read('src/index.css')

  it('adds three kinds of spots and leaves the rest of the home as it was (the hero, the cards and the closing are untouched)', () => {
    assert.match(home, /<Sprouts areas=\{\['orientacion', 'memoria', 'atencion'\]\}[^>]*xl:hidden/, 'over the heading of the paths, on a phone')
    // The side groups need 32 + 182 px beside the 672 px column: that only fits from xl (1280 px) up; at lg (1024) the right one was cut off by the viewport.
    assert.match(home, /<Sprouts areas=\{\['orientacion', 'memoria'\]\}[^>]*right-full[^>]*hidden[^>]*xl:flex/, 'beside the heading, from xl up')
    assert.match(home, /<Sprouts areas=\{\['lenguaje', 'calculo'\]\}[^>]*left-full[^>]*hidden[^>]*xl:flex/, 'beside the heading, from xl up')
    assert.doesNotMatch(home, /lg:flex/, 'no side group is shown from lg')
    assert.match(home, /<AreaChips areas=\{path\.areas\} label="Las áreas del Pack Básico" sprout/, 'next to the "4 áreas" of the Material digital card')
    assert.match(home, /areas: \['memoria', 'atencion', 'lenguaje', 'calculo'\]/, 'the four areas of the Pack Básico')
    assert.match(home, /pointer-events-none absolute inset-x-0 bottom-0/, 'the plants that stand on the bottom edge of the paths section')
  })
  it('keeps the seam plants shorter than the bottom padding of their section (py-16 = 64 px until md), so they never touch the text above', () => {
    const seam = home.slice(home.indexOf('pointer-events-none absolute inset-x-0 bottom-0'))
    assert.match(seam, /h-12 w-auto md:h-\[72px\]/, '48 px below md, 72 px from md (py-24 = 96 px)')
    assert.doesNotMatch(seam, /sm:h-\[72px\]/)
  })
  it('keeps every hero element out of it: nothing above the fold gets a plant', () => {
    const hero = home.slice(home.indexOf('aria-labelledby="hero-heading"'), home.indexOf('aria-labelledby="paths-heading"'))
    assert.ok(hero.length > 500, 'the hero was found (its markers still exist)')
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
