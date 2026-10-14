import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'node:fs'

/**
 * Landings del Pack: tiamdigital.com/pack/familias y /pack/profesionales.
 *
 * Son páginas HTML estáticas, no rutas de React: el SPA pesa cientos de KB de JavaScript y el
 * tráfico de los anuncios llega por celular, muchas veces con mala conexión. Cada landing es una
 * entrada más de este build (ver `input`) y carga casi nada de JavaScript (pack/landing.ts).
 *
 * En producción las sirve Vercel desde dist/pack/<slug>/index.html. vercel.json tiene un rewrite
 * explícito de /pack/<slug> (sin barra final) ANTES del catch-all del SPA: si se agrega una
 * landing, hay que sumarla en PACK_LANDINGS y en vercel.json.
 */
const PACK_LANDINGS = ['familias', 'profesionales']

const ROOT_DIR = __dirname
const PACK_DIR = path.resolve(ROOT_DIR, 'pack')
const PARTIALS_DIR = path.resolve(PACK_DIR, '_partials')
const PLACEHOLDER_RE = /\[\[[A-Z0-9_]+\]\]/g
/** Fichas del Pack Básico: 4 áreas x 3 niveles x 10 fichas. Se usa para el costo por ficha. */
const PACK_SHEETS = 120
/**
 * Páginas de los PDF que se venden (versión final de TIAM-pack, `npm run entrega`): «Empezá acá» (4: la tapa, qué trae, por dónde empezar e imprimir, y créditos y licencias) y los 12
 * cuadernillos (300). Salen como %PACK_PAGES% y %PACK_START_PAGES% en las landings: si cambia el número de páginas, se cambia acá y en ningún otro lado.
 */
const PACK_START_PAGES = 4
const PACK_BOOKLET_PAGES = 300

// ── Datos que hacen falta para publicar ───────────────────────────────────────────────────────
// Ningún [[MARCADOR]] llega a la página: si un dato real falta, el espacio se oculta o se usa un texto neutro (ver los
// <!--if:VARIABLE--> de pack/). Para que eso no pase a producción sin que nadie lo note, el build lista lo que falta y,
// con PACK_STRICT=1 (el entorno de producción), FALLA mientras falte algo de esta lista o siga prendido VITE_PACK_PREVIEW
// (que marca como "provisorios" el precio, la garantía y las ofertas). Lo recomendado no hace fallar el build.
type Pending = { key: string; what: string }
const REQUIRED_COMMON: Pending[] = [
  { key: 'VITE_PACK_CHECKOUT_URL', what: 'link de pago (checkout)' },
  { key: 'VITE_PACK_CONTACT_URL', what: 'enlace de contacto (WhatsApp o mailto:)' },
  { key: 'VITE_PACK_CONTACT_TEXT', what: 'texto visible del contacto' },
  { key: 'VITE_PACK_REGRET_URL', what: 'página del botón de arrepentimiento' },
  { key: 'VITE_PACK_LEGAL_ENTITY', what: 'razón social y CUIT del vendedor' },
]
const REQUIRED_BY_SLUG: Record<string, Pending[]> = {
  familias: [...REQUIRED_COMMON, { key: 'VITE_PACK_LICENSE_FAMILIAS', what: 'licencia de uso para familias' }],
  profesionales: [
    ...REQUIRED_COMMON,
    { key: 'VITE_PACK_LICENSE_PROFESIONALES', what: 'licencia de uso para profesionales' },
    { key: 'VITE_PACK_INVOICE_TEXT', what: 'cómo se pide factura' },
  ],
}
const RECOMMENDED: Pending[] = [
  { key: 'VITE_PACK_TALLERISTA_NAME', what: 'nombre de la tallerista (sin él, la página no dice quién revisa las guías)' },
  { key: 'VITE_PACK_TALLERISTA_PHOTO', what: 'foto de la tallerista (sin ella, no se muestra la tarjeta de la persona)' },
]

const isOn = (value: unknown): boolean => {
  const text = String(value ?? '').trim().toLowerCase()
  return text !== '' && text !== '0' && text !== 'false'
}

/** "14.990" o "14990" -> 14990. Vacío o inválido -> 0. */
const toNumber = (value: unknown): number => {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** 14990 -> "14.990" (punto de miles, sin depender de los datos de idioma de Node). */
const formatPesos = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Precio de lista del Desafío de 30 días: la fuente única es PRICE_ARS de su página (para que "vale $ X" nunca se desfase). */
let challengePrice: number | undefined
function desafioPrice(): number {
  if (challengePrice !== undefined) return challengePrice
  const file = path.resolve(ROOT_DIR, 'src/pages/desafio-30-dias/Desafio30DiasPage.tsx')
  const match = /const PRICE_ARS = ([\d_]+)/.exec(fs.readFileSync(file, 'utf8'))
  if (!match) throw new Error('[pack-landings] No encontré "const PRICE_ARS = ..." en Desafio30DiasPage.tsx. Definí VITE_PACK_GAMES_REGULAR_PRICE o arreglá vite.config.ts.')
  challengePrice = Number(match[1].replace(/_/g, ''))
  return challengePrice
}

/** Variables derivadas: los precios salen todos de la configuración (.env o variables de Vercel), nunca están escritos en el HTML. */
function packTokens(env: Record<string, string>, slug: string): Record<string, string> {
  const price = toNumber(env.VITE_PACK_PRICE)
  if (!price) throw new Error('[pack-landings] VITE_PACK_PRICE falta o no es un número (ejemplo: 14.990).')
  const gamesPrice = toNumber(env.VITE_PACK_GAMES_PRICE)
  const gamesRegular = toNumber(env.VITE_PACK_GAMES_REGULAR_PRICE) || desafioPrice()
  const extraPrice = toNumber(env.VITE_PACK_EXTRA_PRICE)
  const [y, m, d] = String(env.VITE_PACK_PROMO_END ?? '').split('-').map(Number)
  const promoOk = !!(y && m && d) && !Number.isNaN(Date.UTC(y, m - 1, d))
  return {
    PACK_EDICION: slug,
    // A dónde van los botones de compra: el checkout, o la sección de precio de la misma página mientras no haya checkout
    PACK_BUY_URL: isOn(env.VITE_PACK_CHECKOUT_URL) ? escapeHtml(String(env.VITE_PACK_CHECKOUT_URL).trim()) : '#comprar',
    PACK_PRICE: formatPesos(price),
    PACK_PRICE_NUM: String(price),
    PACK_PER_SHEET: formatPesos(price / PACK_SHEETS),
    PACK_PAGES: String(PACK_START_PAGES + PACK_BOOKLET_PAGES),
    PACK_START_PAGES: String(PACK_START_PAGES),
    PACK_GAMES_PRICE: formatPesos(gamesPrice),
    PACK_GAMES_PRICE_NUM: String(gamesPrice),
    PACK_GAMES_REGULAR: formatPesos(gamesRegular),
    PACK_GAMES_SAVING: formatPesos(Math.max(0, gamesRegular - gamesPrice)),
    PACK_EXTRA_PRICE: formatPesos(extraPrice),
    PACK_EXTRA_PRICE_NUM: String(extraPrice),
    PACK_GUARANTEE_DAYS: String(toNumber(env.VITE_PACK_GUARANTEE_DAYS) || ''),
    PACK_PROMO_END_ISO: promoOk ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '',
    PACK_PROMO_END_TEXT: promoOk ? `${d} de ${MONTHS[m - 1]}` : '',
  }
}

/** Condiciones que se pueden usar en <!--if:NOMBRE-->: cualquier variable VITE_* con valor, más estas calculadas. */
function packFlags(env: Record<string, string>, slug: string): Record<string, boolean> {
  const tokens = packTokens(env, slug)
  const flags: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(env)) flags[key] = isOn(value)
  const today = new Date().toISOString().slice(0, 10)
  return {
    ...flags,
    PACK_FAMILIAS: slug === 'familias',
    PACK_PROFESIONALES: slug === 'profesionales',
    PACK_GAMES_DISCOUNT: toNumber(tokens.PACK_GAMES_SAVING.replace(/\./g, '')) > 0 && toNumber(env.VITE_PACK_GAMES_PRICE) > 0,
    PACK_EXTRA_PRICE_SET: toNumber(env.VITE_PACK_EXTRA_PRICE) > 0,
    PACK_GUARANTEE: !!tokens.PACK_GUARANTEE_DAYS,
    PACK_PROMO: !!tokens.PACK_PROMO_END_ISO && tokens.PACK_PROMO_END_ISO >= today,
  }
}

/**
 * Plantillas de las landings, en este orden:
 * 1) <!--include:nombre--> trae pack/_partials/nombre.html (los bloques que comparten las dos landings; se pueden anidar).
 * 2) <!--if:NOMBRE-->...<!--endif--> y <!--ifnot:NOMBRE-->...<!--endif--> dejan o sacan el bloque según `packFlags`
 *    (variables VITE_* con valor, PACK_FAMILIAS, PACK_PROFESIONALES...). Se pueden anidar.
 * 3) %VITE_PACK_X% y %PACK_X% se reemplazan por la configuración y por los valores derivados de `packTokens`.
 */
function renderLanding(html: string, slug: string, env: Record<string, string>): string {
  for (let depth = 0; depth < 5 && /<!--\s*include:/.test(html); depth++) {
    html = html.replace(/<!--\s*include:([\w-]+)\s*-->/g, (_tag, name: string) => fs.readFileSync(path.join(PARTIALS_DIR, `${name}.html`), 'utf8'))
  }

  const flags = packFlags(env, slug)
  const innermost = /<!--(if|ifnot):([A-Z0-9_]+)-->((?:(?!<!--(?:if|ifnot):)[\s\S])*?)<!--endif-->/
  for (let guard = 0; guard < 500 && innermost.test(html); guard++) {
    html = html.replace(innermost, (_all, kind: string, name: string, body: string) => {
      if (!(name in flags) && name.startsWith('VITE_')) flags[name] = false // variable que no está definida = apagada
      if (!(name in flags)) throw new Error(`[pack-landings] <!--${kind}:${name}--> no es una condición conocida (pack/${slug}).`)
      return (kind === 'if') === flags[name] ? body : ''
    })
  }
  if (/<!--(if|ifnot):/.test(html) || /<!--endif-->/.test(html)) throw new Error(`[pack-landings] Hay un <!--if--> sin cerrar o un <!--endif--> de más en pack/${slug}.`)

  const tokens = packTokens(env, slug)
  return html.replace(/%((?:VITE_PACK|PACK|VITE_META)_[A-Z0-9_]+)%/g, (_all, key: string) => {
    if (key in tokens) return tokens[key]
    if (key.startsWith('VITE_')) return escapeHtml(String(env[key] ?? ''))
    throw new Error(`[pack-landings] %${key}% no es un valor conocido (pack/${slug}).`)
  })
}

/** `/pack/familias`, `/pack/familias/` -> `/pack/familias/index.html` (conserva el query string). */
function toIndexHtml(url: string): string {
  const q = url.indexOf('?')
  const pathname = q === -1 ? url : url.slice(0, q)
  const rest = q === -1 ? '' : url.slice(q)
  const clean = pathname.replace(/\/+$/, '')
  return PACK_LANDINGS.some((slug) => clean === `/pack/${slug}`) ? `${clean}/index.html${rest}` : url
}

const isLandingFile = (filename: string) =>
  path.relative(PACK_DIR, path.resolve(filename)).split(path.sep)[0] !== '..' &&
  filename.replace(/\\/g, '/').endsWith('/index.html')

/**
 * Dev y preview: sirve /pack/<slug> sin barra final (como hace vercel.json en producción) y arma las plantillas
 * (ver `renderLanding`).
 */
function packLandings(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'tiam:pack-landings',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) req.url = toIndexHtml(req.url)
        next()
      })
      // los parciales no son entradas: avisar al navegador cuando cambian
      server.watcher.add(PARTIALS_DIR)
      server.watcher.on('change', (file) => {
        if (path.resolve(file).startsWith(PARTIALS_DIR)) server.ws.send({ type: 'full-reload' })
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) req.url = toIndexHtml(req.url)
        next()
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!isLandingFile(ctx.filename)) return html
        return renderLanding(html, path.basename(path.dirname(ctx.filename)), config.env as Record<string, string>)
      },
    },
  }
}

/**
 * Solo en el build, ya con las URLs finales:
 * - avisa qué datos reales faltan (con PACK_STRICT=1, o con VITE_PACK_PREVIEW prendido, el build falla a propósito);
 * - saca comentarios y sangrías del HTML;
 * - mete el CSS dentro del HTML (un viaje de red menos antes del primer pintado).
 */
function packLandingsBuild(): Plugin {
  let config: ResolvedConfig
  const pending = new Map<string, { missing: Pending[]; leftovers: Map<string, number> }>()
  const inlined = new Set<string>()
  return {
    name: 'tiam:pack-landings-build',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !isLandingFile(ctx.filename)) return html

        const slug = path.basename(path.dirname(ctx.filename))
        const env = config.env as Record<string, string>
        const leftovers = new Map<string, number>()
        for (const m of html.match(PLACEHOLDER_RE) ?? []) leftovers.set(m, (leftovers.get(m) ?? 0) + 1)
        pending.set(slug, { missing: [...(REQUIRED_BY_SLUG[slug] ?? [])].filter((p) => !isOn(env[p.key])), leftovers })

        html = html
          .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/\n{2,}/g, '\n')
          // la landing no usa import() ni modulepreload: el polyfill para navegadores viejos sería un pedido de más
          .replace(/<script type="module" crossorigin src="[^"]*modulepreload-polyfill[^"]*"><\/script>\n?/, '')

        return html.replace(/<link\b[^>]*>/g, (tag) => {
          if (!/rel="stylesheet"/.test(tag)) return tag
          const href = /href="([^"]+\.css)"/.exec(tag)?.[1]
          const asset = href && ctx.bundle?.[href.replace(/^\//, '')]
          if (!href || !asset || asset.type !== 'asset') return tag
          inlined.add(href.replace(/^\//, ''))
          return `<style>${Buffer.from(asset.source).toString('utf8')}</style>`
        })
      },
    },
    writeBundle() {
      // el CSS ya viaja dentro del HTML: no dejar el archivo suelto en dist
      const outDir = path.resolve(config.root, config.build.outDir)
      for (const file of inlined) fs.rmSync(path.join(outDir, file), { force: true })
    },
    closeBundle() {
      if (!pending.size) return
      const env = config.env as Record<string, string>
      const preview = isOn(env.VITE_PACK_PREVIEW)
      const lines: string[] = []
      let blocking = false
      for (const [slug, { missing, leftovers }] of pending) {
        const parts: string[] = []
        if (missing.length) parts.push(`faltan ${missing.map((p) => `${p.key} (${p.what})`).join(', ')}`)
        if (leftovers.size) parts.push(`marcadores sin completar ${[...leftovers].map(([k, n]) => `${k.slice(2, -2)} x${n}`).join(', ')}`)
        const advice = RECOMMENDED.filter((p) => !isOn(env[p.key]))
        if (advice.length) parts.push(`recomendado: ${advice.map((p) => `${p.key} (${p.what})`).join(', ')}`)
        if (missing.length || leftovers.size) blocking = true
        if (parts.length) lines.push(`  pack/${slug}: ${parts.join('; ')}`)
      }
      if (preview) {
        blocking = true
        lines.push('  VITE_PACK_PREVIEW está prendido: el precio, la garantía y las ofertas son provisorios y la página muestra "Vista previa: datos provisorios".')
      }
      if (!lines.length) return
      const message = `[pack-landings] ${blocking ? 'Las landings todavía no están listas para publicarse' : 'Las landings se pueden publicar; quedan recomendaciones'}:\n${lines.join('\n')}`
      // En el entorno de producción de Vercel el modo estricto se prende solo: así un merge a main con datos provisorios
      // hace fallar el build (y sigue en línea la versión anterior) aunque nadie haya cargado PACK_STRICT.
      // Excepción: VITE_PACK_PUBLISH_PREVIEW deja publicar la vista previa en producción. El dueño lo decidió el 2026-10-13
      // para tener las páginas en el sitio antes de que exista el cobro. Hay que sacar esa variable cuando el cobro esté
      // listo, así este control vuelve a proteger producción. PACK_STRICT=1 siempre gana.
      const publishPreview = isOn(env.VITE_PACK_PUBLISH_PREVIEW)
      const strict = process.env.PACK_STRICT === '1' || (process.env.VERCEL_ENV === 'production' && !publishPreview)
      if (strict && blocking) throw new Error(`${message}\n(modo estricto: el build falla a propósito)`)
      if (publishPreview && blocking && process.env.VERCEL_ENV === 'production') {
        config.logger.warn('\n[pack-landings] ATENCIÓN: se publica la VISTA PREVIA en producción (VITE_PACK_PUBLISH_PREVIEW).')
      }
      config.logger.warn(`\n${message}\n`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), packLandings(), packLandingsBuild()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      // El SPA (index.html) y las landings estáticas del pack.
      input: {
        index: path.resolve(ROOT_DIR, 'index.html'),
        ...Object.fromEntries(PACK_LANDINGS.map((slug) => [`pack-${slug}`, path.resolve(PACK_DIR, slug, 'index.html')])),
      },
    },
  },
})
