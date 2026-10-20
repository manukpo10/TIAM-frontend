// Facts every landing's footer and meta tags must keep (review of 2026-10-19):
//  - canonical, og:url and og:image use the site's real host, https://www.tiamdigital.com (with www);
//  - the Data Fiscal (ARCA F960/D) seal is visible in the static landing footers and in the site-wide footer, exactly as the owner's snippet says.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const LANDINGS = ['pack/familias/index.html', 'pack/profesionales/index.html', 'pack/cuadernos/index.html']

describe('canonical and Open Graph URLs', () => {
  for (const file of LANDINGS) {
    const html = read(file)
    it(`${file} uses https://www.tiamdigital.com`, () => {
      const urls = [
        /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1],
        /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1],
        /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1],
      ]
      for (const url of urls) {
        assert.ok(url, 'the tag exists')
        assert.match(url, /^https:\/\/www\.tiamdigital\.com\//, url)
      }
      assert.doesNotMatch(html, /https:\/\/tiamdigital\.com/, 'no URL without www')
    })
  }
})

describe('Data Fiscal (ARCA)', () => {
  const HREF = 'href="http://qr.afip.gob.ar/?qr=PIsGIBwby_5J18px30h7uQ,,"'
  const SRC = 'src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg"'
  const footers: Array<[string, string]> = [
    ['the static landing footer', 'pack/_partials/footer.html'],
    ['the site-wide footer', 'src/components/layout/PublicFooter.tsx'],
  ]
  for (const [name, file] of footers) {
    it(`${name} carries the seal as the owner's snippet says`, () => {
      const source = read(file).replace(/\s+/g, ' ')
      assert.ok(source.includes(HREF) || source.includes(HREF.replace('href="', 'href={"').replace(/"$/, '"}')), 'the link, exactly as given')
      assert.match(source, /target="_F960AFIPInfo"/)
      assert.match(source, /rel="noopener noreferrer"/)
      assert.ok(source.includes(SRC.replace('src="', 'src="')) || source.includes(SRC.replace('src="', 'src={"').replace(/"$/, '"}')), 'the image over https')
      assert.match(source, /alt="Data Fiscal \(ARCA\)"/)
      assert.match(source, /loading="lazy"/)
      const width = /DATAWEB\.jpg[^>]*width="?\{?(\d+)/.exec(source)?.[1] ?? /width="?\{?(\d+)[^>]*DATAWEB\.jpg/.exec(source)?.[1]
      assert.ok(width && Number(width) >= 60 && Number(width) <= 80, `a small fixed width (60 to 80 px), got ${width}`)
    })
  }
})

describe('the logo of the landings links to the home page', () => {
  const topbar = read('pack/_partials/topbar.html')
  it('is a plain link to / with an accessible label, around the same logo', () => {
    assert.match(topbar, /<a href="\/"[^>]*aria-label="TIAM: ir al inicio"[^>]*>\s*<img src="\/pack\/img\/logo-144\.webp"[^>]*>\s*<\/a>/)
  })
  it('keeps the size of the logo and a tap target of at least 44 px', () => {
    assert.match(topbar, /<img src="\/pack\/img\/logo-144\.webp" width="144" height="81"[^>]*class="h-8 w-auto"/)
    assert.match(topbar, /<a href="\/"[^>]*class="[^"]*min-h-11/)
  })
})
