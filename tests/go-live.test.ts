// The Cuadernos are on sale (owner, 2026-10-19) while the Pack landings stay in preview: the preview state is PER LANDING (pack/logic.ts has the rules and their tests;
// this file checks the templates and the config that use them).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const env = read('.env')
const value = (key: string) => new RegExp(`^${key}=(.*)$`, 'm').exec(env)?.[1].trim() ?? ''

describe('per-landing preview in the templates', () => {
  it('the preview ribbon depends on the landing (PACK_PREVIEW), not on the global switch', () => {
    const topbar = read('pack/_partials/topbar.html')
    assert.match(topbar, /<!--if:PACK_PREVIEW-->\s*<div class="preview-ribbon"/)
    assert.doesNotMatch(topbar, /if:VITE_PACK_PREVIEW/)
  })
  for (const slug of ['familias', 'profesionales', 'cuadernos']) {
    it(`pack/${slug} is noindex only while it is in preview`, () => {
      const html = read(`pack/${slug}/index.html`)
      assert.match(html, /<!--if:PACK_PREVIEW-->\s*<meta name="robots" content="noindex, nofollow" \/>\s*<!--endif-->/)
      assert.equal((html.match(/name="robots"/g) ?? []).length, 1, 'one robots tag, inside the condition')
    })
  }
})

describe('per-landing checkout form', () => {
  it('the Cuadernos offer follows its own switch (PACK_CHECKOUT) and the Pack offer keeps the Pack one', () => {
    const cuadernos = read('pack/_partials/ofertas-cuadernos.html').replace(/<!--[\s\S]*?-->/g, (m) => (m.startsWith('<!--if') || m.startsWith('<!--ifnot') || m.startsWith('<!--endif') ? m : ''))
    assert.match(cuadernos, /<!--if:PACK_CHECKOUT-->/)
    assert.doesNotMatch(cuadernos, /<!--(if|ifnot):VITE_PACK_CHECKOUT_URL-->/)
    assert.match(read('pack/_partials/ofertas.html'), /<!--if:VITE_PACK_CHECKOUT_URL-->/)
  })
})

describe('the committed go-live config', () => {
  it('lists the Cuadernos as live and no longer carries the global "publish preview" override', () => {
    assert.equal(value('VITE_PACK_LIVE'), 'cuadernos')
    assert.equal(value('VITE_PACK_PREVIEW'), '1', 'the Pack landings stay in preview')
    assert.doesNotMatch(env, /^VITE_PACK_PUBLISH_PREVIEW=/m)
  })
  it('turns the Cuadernos form on, against the production backend, and keeps the Pack forms off', () => {
    assert.equal(value('VITE_PACK_CUADERNOS_CHECKOUT_URL'), 'https://tiam-backend.onrender.com/packs/checkout')
    assert.equal(value('VITE_PACK_CHECKOUT_URL'), '', 'the Pack landings post nowhere')
  })
  it('uses the launch prices, not the test ones', () => {
    assert.equal(value('VITE_PACK_CUADERNOS_PRICE'), '20.000')
    assert.equal(value('VITE_PACK_CUADERNOS_GAMES_PRICE'), '15.000')
    assert.equal(value('VITE_PACK_HIDE_GAMES_REGULAR'), '')
  })
})
