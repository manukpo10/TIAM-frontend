// Ilustraciones de las landings del pack con FLUX.2 klein 4B (fp8, destilado) en ComfyUI local.
//
// Reglas de uso (dueño de TIAM, 2026-10-07):
//  - Solo estilo ilustrado, nunca personas fotorrealistas.
//  - Nunca reemplazan testimonios, fotos del taller, clientes ni prueba del producto: el producto son páginas reales.
//  - Van en secciones decorativas y explicativas (la situación, "cómo funciona").
//
// El grafo de la API y el estilo salen de TIAM-pack/scripts/ilustrar.mjs (solo lectura): 4 pasos, cfg 1, euler,
// negativo = ConditioningZeroOut del positivo. Este script no modifica TIAM-pack ni descarga modelos.
//
// Uso (ComfyUI escuchando en 127.0.0.1:8188):
//   node scripts/pack-landings/make_illustrations.mjs generar --out RUTA/candidatos [--solo=id1,id2] [--ronda=N] [--simular]
//
// Deja los candidatos de cada ilustración (PNG) y candidatos.json con la consigna y la semilla de cada uno: tres en el estilo plano anterior, ocho en el
// estilo "tinta firme". La semilla es SEED_BASE + n * 100 + (ronda - 1) * 10 + k (k = 1..candidatos): la ronda 1 da las mismas semillas de siempre.
// Después se elige uno por ilustración y se convierte:
//  - estilo "tinta firme" (las dos escenas de personas de la landing de profesionales): `python scripts/pack-landings/make_escenas_pro.py` (ver su encabezado);
//  - estilo plano anterior (los objetos de "cómo funciona"): `python scripts/pack-landings/make_images.py --solo ilustraciones`. OJO: ese grupo reescribe
//    `items` de ilustraciones.json con SOLO lo que se le pasa en --elegidas; para tocar un par de imágenes usar el script de cada estilo.
//
// Sin --solo se generan las ilustraciones vigentes; las retiradas (`retired`) se pueden volver a generar nombrándolas con --solo.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

// Mismo estilo que las portadas del pack (TIAM-pack/scripts/ilustrar.mjs).
export const STYLE =
  'Clean editorial illustration, simple shapes with dark navy outlines, flat muted fills in navy, soft blue, ' +
  'warm beige and light gray, plain light background, generous white space, dignified adult style, ' +
  'never childish or cartoonish, no text, no letters, no numbers.'
const PEOPLE = 'Natural faces and correct hands. Only the people described appear in the picture, nobody else.'

// Estilo "tinta firme" (opción C2 que aprobó el dueño: las cuatro tapas de área del pack): texto EXACTO de COVER_STYLE de TIAM-pack/scripts/ilustrar.mjs (solo
// lectura). La consigna de una escena en este estilo es `${escena} ${COVER_STYLE}` (la escena ya trae su punto final), sin PEOPLE ni STYLE.
export const COVER_STYLE =
  'Style: hand-drawn editorial illustration with confident dark navy ink contour lines of medium weight around the faces, eyes, hands, hair and ' +
  'clothes, light flat gouache washes on warm cream paper, very little shading, restrained palette of dusty blue, light gray, warm tan and cream, ' +
  'faces with gentle fine wrinkles, calm and dignified, refined magazine illustration, never childish, never cartoonish, no text, no letters, no numbers.'
const INK_STYLE = 'tinta-firme'
const INK_CANDIDATES = 8

const SEED_BASE = 20264000
const CANDIDATES = 3
const WIDE = [1536, 1024] // 3:2
const SQUARE = [1024, 1024]

/** n fija las semillas (SEED_BASE + n * 100 + k): no reordenar, solo agregar al final. */
export const SUBJECTS = [
  {
    // RETIRADA del sitio el 2026-10-11: con el estilo nuevo de las tapas (opción C2) la imagen de "Con este pack no hay nada que preparar" es la escena de la
    // portada de Memoria (`python scripts/pack-landings/make_images.py --solo compartir`). Esta consigna es el estilo plano anterior; se conserva solo por la historia.
    n: 0,
    id: 'compartir-familia',
    retired: '2026-10-11',
    size: WIDE,
    people: true,
    subject:
      'An older Latin American woman in her seventies with short gray hair and a soft blue cardigan, and her adult daughter with dark hair tied back, ' +
      'sitting side by side at a pale wooden kitchen table in warm daylight, smiling and relaxed, two cups of tea and one blank sheet of paper on the table',
  },
  {
    n: 1,
    id: 'paso-recibir',
    size: SQUARE,
    subject: 'A laptop open on a wooden desk with a small paper envelope floating above its screen, a soft glow around the envelope, a small potted plant beside the laptop, no people',
  },
  {
    n: 2,
    id: 'paso-imprimir',
    size: SQUARE,
    subject: 'A small home inkjet printer on a wooden desk with one blank white sheet of paper coming out of it, a mug and a pencil cup beside it, no people',
  },
  {
    n: 3,
    id: 'paso-compartir',
    size: SQUARE,
    subject: 'A small round kitchen timer next to two cups of tea on a pale wooden table, with a pencil and one blank sheet of paper, warm afternoon light, no people',
  },
  {
    // RETIRADA el 2026-10-11 (estilo plano anterior): la reemplaza `sesion-profesional` (n: 6, estilo "tinta firme"). Se conserva para poder volver a generarla
    // (`--solo=sesion-profesional-plano`); su semilla elegida fue 20264403 y los WebP anteriores están en pack/img/anteriores/.
    n: 4,
    id: 'sesion-profesional-plano',
    retired: '2026-10-11',
    size: WIDE,
    people: true,
    subject:
      'A friendly woman facilitator in her thirties with a lanyard sitting at a round table with three older Latin American adults, everyone holding a pencil over a blank sheet of paper, ' +
      'calm and focused, a bright room with a window and a plant, only these four people',
  },
  {
    // RETIRADA el 2026-10-11 (estilo plano anterior): la reemplaza `paso-registrar` (n: 7, estilo "tinta firme"). Se conserva para poder volver a generarla
    // (`--solo=paso-registrar-plano`); su semilla elegida fue 20264502 y los WebP anteriores están en pack/img/anteriores/.
    n: 5,
    id: 'paso-registrar-plano',
    retired: '2026-10-11',
    size: SQUARE,
    people: true,
    subject:
      'A woman professional in her thirties with a lanyard holding a clipboard with a blank form, standing beside an older Latin American man sitting at a table with a pencil and a blank sheet of paper, ' +
      'a friendly quiet moment, only these two people',
  },

  // ---- Estilo "tinta firme" (2026-10-11): las dos escenas de personas de la landing de profesionales, rehechas con el estilo aprobado de las tapas ----
  // Misma toma que las tapas (personas de frente, de pecho para arriba, detrás de una mesa, caras grandes y enteras, ropa clara que se sostiene en grises). La
  // profesional es una adulta con ropa común de trabajo (nada de uniforme médico, estetoscopio ni nada que sugiera un tratamiento); hojas lisas, sin escritura.
  // `subject` puede ser un texto (vale para todas las rondas) o { 1: '...', 2: '...' } para afinar una ronda nueva (--ronda=N).
  {
    // "Cada ficha ya trae lo que necesitás": una profesional y dos adultos mayores trabajando con hojas en una mesa redonda (se muestra a ~320 px de ancho, 3:2).
    n: 6,
    id: 'sesion-profesional',
    style: INK_STYLE,
    candidates: INK_CANDIDATES,
    size: WIDE,
    subject: {
      1:
        'Three people sitting close together behind a round wooden table, seen from the front in a close medium shot from the chest up: in the middle a woman professional ' +
        'in her forties with dark brown shoulder-length hair and warm light brown skin, wearing a plain light blue button-up shirt with the sleeves rolled up; on the left an ' +
        'older Latin American man in his seventies with short white hair, a neat gray mustache and warm olive skin, wearing a light gray cardigan over a white shirt; on the ' +
        'right an older Latin American woman in her seventies with a silver-gray bun, thin round glasses and tan skin, wearing a pale sage-green cardigan over a cream blouse. ' +
        'All three faces are large, fully visible and evenly lit. The two older adults look down with calm smiles at a plain blank white sheet of paper each, holding a pencil ' +
        'in a relaxed hand with five natural fingers, while the professional looks straight at the viewer with a warm friendly smile, her relaxed hands resting on the table. ' +
        'The sheets are completely blank, with no lines, no writing and no marks. Plain warm cream paper background, the three people fill the wide horizontal frame. ' +
        'Only these three people.',
    },
  },
  {
    // Paso 3, "Trabajás y registrás": una profesional con una tablilla con hoja en blanco junto a un hombre mayor que escribe (se muestra a 96 px en celular y a ~320x240 recortada
    // a 4:3 en escritorio, así que las dos caras tienen que ser grandes y estar en el tramo central del cuadrado).
    n: 7,
    id: 'paso-registrar',
    style: INK_STYLE,
    candidates: INK_CANDIDATES,
    size: SQUARE,
    subject: {
      1:
        'Two people sitting close side by side behind a wooden table, seen from the front in a close medium shot from the chest up: on the left a woman professional in her ' +
        'forties with dark brown hair tied back in a low bun and warm light brown skin, wearing a plain cream knit sweater over a white collared shirt, holding a clipboard ' +
        'with a plain blank white sheet in both hands in front of her; on the right an older Latin American man in his seventies with short white hair, a neat gray mustache ' +
        'and warm olive skin, wearing a pale gray sweater over a white shirt, holding a pencil in a relaxed hand over a plain blank white sheet of paper lying on the table. ' +
        'Both faces are large, fully visible and evenly lit, with warm gentle smiles: she looks at him and he looks down at his sheet. Their relaxed hands have five natural ' +
        'fingers each. The sheets are completely blank, with no lines, no writing and no marks. Plain warm cream paper background, the two people fill the square frame. ' +
        'Only these two people.',
    },
  },
]

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188'
const GENERATION = { model: 'flux-2-klein-4b-fp8.safetensors', textEncoder: 'qwen_3_4b.safetensors (type flux2)', vae: 'flux2-vae.safetensors', steps: 4, cfg: 1, sampler: 'euler' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Texto de la escena de una ronda: el de la ronda pedida o, si no tiene uno propio, el de la ronda más alta anterior que sí lo tiene. */
export function subjectText(s, round = 1) {
  if (typeof s.subject === 'string') return s.subject
  const rounds = Object.keys(s.subject).map(Number).sort((a, b) => b - a)
  return s.subject[rounds.find((k) => k <= round) ?? rounds.at(-1)]
}
export const promptFor = (s, round = 1) =>
  s.style === INK_STYLE ? `${subjectText(s, round)} ${COVER_STYLE}` : `${subjectText(s, round)}.${s.people ? ` ${PEOPLE}` : ''} ${STYLE}`
export const seedsFor = (s, round = 1) => Array.from({ length: s.candidates ?? CANDIDATES }, (_, i) => SEED_BASE + s.n * 100 + (round - 1) * 10 + i + 1)

// El cargador del codificador es idéntico en el grafo de generación y en el de precalentamiento, así ComfyUI reutiliza
// el texto ya codificado sin recargar 7,6 GB por cada consigna.
const CLIP_LOADER = { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'flux2', device: 'default' } }

function graph({ prompt, seed, width, height }) {
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: GENERATION.model, weight_dtype: 'default' } },
    2: structuredClone(CLIP_LOADER),
    3: { class_type: 'VAELoader', inputs: { vae_name: GENERATION.vae } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    6: { class_type: 'EmptyFlux2LatentImage', inputs: { width, height, batch_size: 1 } },
    7: { class_type: 'Flux2Scheduler', inputs: { steps: GENERATION.steps, width, height } },
    8: { class_type: 'KSamplerSelect', inputs: { sampler_name: GENERATION.sampler } },
    9: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    10: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], cfg: GENERATION.cfg } },
    11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['9', 0], guider: ['10', 0], sampler: ['8', 0], sigmas: ['7', 0], latent_image: ['6', 0] } },
    12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
    13: { class_type: 'PreviewImage', inputs: { images: ['12', 0] } },
  }
}

function warmupGraph(prompts) {
  const g = { L: structuredClone(CLIP_LOADER) }
  prompts.forEach((text, i) => {
    g[`e${i}`] = { class_type: 'CLIPTextEncode', inputs: { text, clip: ['L', 0] } }
    g[`p${i}`] = { class_type: 'PreviewAny', inputs: { source: [`e${i}`, 0] } }
  })
  return g
}

async function api(route, init = {}) {
  const res = await fetch(`${HOST}${route}`, { ...init, signal: AbortSignal.timeout(120_000) })
  return res
}

async function run(g, clientId, timeoutMs = 900_000) {
  const res = await api('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: clientId }) })
  const body = await res.json()
  if (!res.ok || (body.node_errors && Object.keys(body.node_errors).length)) throw new Error('POST /prompt falló: ' + JSON.stringify(body).slice(0, 800))
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const item = (await (await api(`/history/${body.prompt_id}`)).json())[body.prompt_id]
    if (item?.status?.status_str === 'error') throw new Error('Error de ejecución: ' + JSON.stringify(item.status).slice(0, 800))
    if (item?.status?.completed || item?.outputs) return item
    await sleep(700)
  }
  throw new Error('Tiempo agotado')
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  // admite --clave=valor y --clave valor
  const opt = {}
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) continue
    const [k, ...v] = rest[i].slice(2).split('=')
    opt[k] = v.length ? v.join('=') : rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true'
  }
  if (command !== 'generar' || !opt.out) {
    console.error('Uso: node make_illustrations.mjs generar --out CARPETA [--solo=id1,id2] [--ronda=N] [--simular]')
    process.exitCode = 2
    return
  }
  const round = Number(opt.ronda ?? 1)
  const ids = opt.solo ? opt.solo.split(',') : null
  for (const id of ids ?? []) if (!SUBJECTS.some((s) => s.id === id)) throw new Error(`No existe la ilustración "${id}"`)
  // Sin --solo: solo las vigentes. Con --solo se puede nombrar una retirada para volver a generarla.
  const targets = SUBJECTS.filter((s) => (ids ? ids.includes(s.id) : !s.retired))
  if (opt.simular) {
    for (const s of targets) console.log(`${s.id} ${s.size.join('x')} ronda ${round} semillas ${seedsFor(s, round).join(',')}\n  ${promptFor(s, round)}\n`)
    return
  }
  const out = path.resolve(opt.out)
  await mkdir(out, { recursive: true })
  if (!(await api('/system_stats')).ok) throw new Error('ComfyUI no responde en ' + HOST)

  const logFile = path.join(out, 'candidatos.json')
  let log = { generation: GENERATION, style: STYLE, coverStyle: COVER_STYLE, items: [] }
  try { log = JSON.parse(await readFile(logFile, 'utf8')) } catch { /* primera corrida */ }
  log.coverStyle ??= COVER_STYLE

  const clientId = randomUUID()
  console.log(`Precalentando ${targets.length} consignas (ronda ${round})...`)
  const t0 = Date.now()
  await run(warmupGraph(targets.map((s) => promptFor(s, round))), clientId, 1_800_000)
  console.log(`  listo en ${((Date.now() - t0) / 1000).toFixed(0)} s`)

  for (const s of targets) {
    for (const seed of seedsFor(s, round)) {
      const file = `${s.id}-s${seed}.png`
      if (log.items.some((i) => i.file === file)) continue
      const started = Date.now()
      const item = await run(graph({ prompt: promptFor(s, round), seed, width: s.size[0], height: s.size[1] }), clientId)
      const image = item.outputs?.['13']?.images?.[0]
      if (!image) throw new Error('La salida no trae imagen')
      const res = await api('/view?' + new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type }))
      await writeFile(path.join(out, file), Buffer.from(await res.arrayBuffer()))
      log.items.push({ id: s.id, file, seed, round, ...(s.style ? { style: s.style } : {}), width: s.size[0], height: s.size[1], prompt: promptFor(s, round) })
      await writeFile(logFile, JSON.stringify(log, null, 2) + '\n')
      console.log(`  ${file} (${((Date.now() - started) / 1000).toFixed(1)} s)`)
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
