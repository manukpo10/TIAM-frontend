// «Cada área, su planta»: which cut-paper plant stands for which cognitive area (src/lib/areaPlants.ts).
// The seven areas, their order and their colours are the ones of the Cuadernos TIAM covers (COLOR_KEY / AREA_COLOR of TIAM-pack) and of the landing's colour key (pack/landing.css).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { AREA_COLORS, AREA_KEYS, AREA_LABELS, GARDEN, PLANTS_DIR, areaKeyOf, plantGrow, plantIcon } from '../src/lib/areaPlants.ts'

const root = path.resolve(import.meta.dirname, '..')

describe('the seven areas', () => {
  it('are the ones of the covers, in the order of their colour key', () => {
    assert.deepEqual([...AREA_KEYS], ['orientacion', 'memoria', 'atencion', 'lenguaje', 'calculo', 'razonamiento', 'visuoespacial'])
  })
  it('keep the exact colour of each area', () => {
    assert.deepEqual(AREA_COLORS, {
      orientacion: '#8F6B00',
      memoria: '#1B6FC4',
      atencion: '#CC4610',
      lenguaje: '#2C801C',
      calculo: '#5B3C9E',
      razonamiento: '#0F766E',
      visuoespacial: '#A3225C',
    })
  })
  it('keep the label the covers print (the label always stays next to the plant)', () => {
    assert.deepEqual(AREA_LABELS, {
      orientacion: 'Orientación',
      memoria: 'Memoria',
      atencion: 'Atención',
      lenguaje: 'Lenguaje',
      calculo: 'Cálculo',
      razonamiento: 'Razonamiento',
      visuoespacial: 'Visión y espacio',
    })
  })
  it('use the same colours as the colour key of the Cuadernos landing (pack/landing.css)', () => {
    const css = fs.readFileSync(path.join(root, 'pack/landing.css'), 'utf8')
    const classes: Record<string, string> = { orientacion: 'k-ori', memoria: 'k-mem', atencion: 'k-ate', lenguaje: 'k-len', calculo: 'k-cal', razonamiento: 'k-raz', visuoespacial: 'k-vis' }
    for (const key of AREA_KEYS) {
      const rule = new RegExp(`\\.${classes[key]}\\s*\\{\\s*--k:\\s*(#[0-9a-fA-F]{6})`).exec(css)
      assert.ok(rule, `${classes[key]} has a --k colour`)
      assert.equal(rule[1].toUpperCase(), AREA_COLORS[key], key)
    }
  })
})

describe('areaKeyOf: from the name an area has on the site to its plant', () => {
  it('recognises the labels of the covers, with or without accents and in any case', () => {
    assert.equal(areaKeyOf('Orientación'), 'orientacion')
    assert.equal(areaKeyOf('orientacion'), 'orientacion')
    assert.equal(areaKeyOf('MEMORIA'), 'memoria')
    assert.equal(areaKeyOf('Atención'), 'atencion')
    assert.equal(areaKeyOf('  Lenguaje '), 'lenguaje')
    assert.equal(areaKeyOf('Cálculo'), 'calculo')
    assert.equal(areaKeyOf('Razonamiento'), 'razonamiento')
    assert.equal(areaKeyOf('Visión y espacio'), 'visuoespacial')
  })
  it('recognises the name the Desafío uses for the seventh area', () => {
    assert.equal(areaKeyOf('Visuoespacial'), 'visuoespacial')
  })
  it('never invents a plant for something that is not one of the seven areas', () => {
    // The Desafío also has "Reconocimiento": it has no plant yet, so it keeps its coloured dot.
    assert.equal(areaKeyOf('Reconocimiento'), undefined)
    assert.equal(areaKeyOf('¡Lo lograste!'), undefined)
    assert.equal(areaKeyOf('Praxias'), undefined)
    assert.equal(areaKeyOf(''), undefined)
  })
})

describe('plantIcon: the small plant that goes next to a label', () => {
  it('serves the 1x file and offers the 2x one, both from the versioned folder', () => {
    const icon = plantIcon('memoria', 40)
    assert.equal(icon.src, `${PLANTS_DIR}/memoria-48.webp`)
    assert.equal(icon.srcSet, `${PLANTS_DIR}/memoria-48.webp 1x, ${PLANTS_DIR}/memoria-96.webp 2x`)
  })
  it('keeps the 4:5 proportion of the icons so the box is reserved before the image loads (no layout shift)', () => {
    assert.deepEqual({ w: plantIcon('atencion', 40).width, h: plantIcon('atencion', 40).height }, { w: 32, h: 40 })
    assert.deepEqual({ w: plantIcon('atencion', 24).width, h: plantIcon('atencion', 24).height }, { w: 19, h: 24 })
  })
  it('uses the slug of the area in the file name (the Cuadernos spell the last area "visuoespacial")', () => {
    assert.equal(plantIcon('visuoespacial', 32).src, `${PLANTS_DIR}/visuoespacial-48.webp`)
  })
})

describe('plantGrow: the whole plant that sprouts on the home page', () => {
  it('points at the 240 px tall file of the area and reports its real size', () => {
    const plant = plantGrow('lenguaje')
    assert.equal(plant.src, `${PLANTS_DIR}/lenguaje-g.webp`)
    assert.equal(plant.height, 120)
    assert.ok(plant.width > 40 && plant.width < 130, `width ${plant.width}`)
  })
})

describe('the garden band of the footer', () => {
  it('lists AVIF first and WebP as the fallback, at 800 and 1600 px', () => {
    assert.equal(GARDEN.width, 1600)
    assert.equal(GARDEN.height, 250)
    assert.equal(GARDEN.avifSrcSet, `${PLANTS_DIR}/jardin-800.avif 800w, ${PLANTS_DIR}/jardin-1600.avif 1600w`)
    assert.equal(GARDEN.webpSrcSet, `${PLANTS_DIR}/jardin-800.webp 800w, ${PLANTS_DIR}/jardin-1600.webp 1600w`)
    assert.equal(GARDEN.src, `${PLANTS_DIR}/jardin-1600.webp`)
  })
})
