// Naturaleza muerta fotorrealista para la maqueta del cuadernillo impreso (hero de las landings del pack), con FLUX.2 klein 4B fp8 en
// ComfyUI local (Apache 2.0, uso comercial permitido). No descarga nada: usa los modelos que ya están instalados.
//
// Regla de honestidad: el producto es un PDF para imprimir en casa. La foto muestra lo que la persona termina teniendo: un cuadernillo A4 impreso,
// engrapado o anillado, sobre una mesa. NO un libro de tapa dura de librería, y NUNCA personas (ni manos ni caras).
// La TAPA del cuadernillo sale en blanco: la tapa real (PDF de TIAM-pack) se compone encima con make_mockup.py.
//
// El grafo de la API sale de TIAM-pack/scripts/ilustrar.mjs (solo lectura): 4 pasos, cfg 1, euler, negativo = ConditioningZeroOut del positivo.
//
// Uso (ComfyUI escuchando en 127.0.0.1:8188):
//   node scripts/pack-landings/make_mockup_stills.mjs generar --out RUTA/candidatos [--solo=id1,id2] [--semillas=6] [--simular]
//
// Deja los candidatos como PNG y candidatos.json (consigna y semilla de cada uno). Se elige el más limpio a ojo y se registra en
// pack/img/ilustraciones.json con make_mockup.py.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const SEED_BASE = 20265000
const SQUARE = [1344, 1344]
const WIDE = [1536, 1152] // 4:3
const TALL = [1152, 1440] // 4:5

const SHOT =
  'Professional product photograph, photorealistic, shot with a 50mm lens, soft diffused natural daylight from a window on the left, ' +
  'gentle shadows, shallow depth of field, calm warm home atmosphere, sharp focus on the booklet, high resolution, ' +
  'absolutely no text, no letters, no numbers, no logos, no writing anywhere, no people, no hands.'

// Para las mesas vacías (fondos): sin la palabra "booklet", que hace aparecer un cuadernillo aunque se pida la mesa vacía.
const SHOT_PLATE =
  'Professional photograph, photorealistic, shot with a 50mm lens, soft diffused natural daylight from a window at the upper left, gentle gradients, ' +
  'shallow depth of field, calm warm home atmosphere, high resolution, absolutely no text, no letters, no numbers, no logos, no writing anywhere, no people, no hands.'

/** n fija las semillas (SEED_BASE + n * 100 + k): no reordenar, solo agregar al final. */
export const STILLS = [
  {
    n: 0,
    id: 'corner-staple',
    size: SQUARE,
    subject:
      'A printed A4 paper booklet lying on a light oak wooden table, seen from above at a gentle angle and slightly rotated, ' +
      'the front cover is a completely plain matte white sheet of paper with nothing printed on it, the thin stack of pages is held together by one small silver staple in the top left corner, ' +
      'a white ceramic cup of tea with a saucer and a yellow wooden pencil lie on the table beside the booklet, the booklet is large in the frame and sits in the lower middle of the picture',
  },
  {
    n: 1,
    id: 'spiral',
    size: SQUARE,
    subject:
      'A printed A4 paper booklet with a black plastic spiral binding along its left edge, lying on a light oak wooden table, seen from above at a gentle angle and slightly rotated, ' +
      'the front cover is a completely plain matte white card with nothing printed on it, ' +
      'a white ceramic cup of tea with a saucer and a yellow wooden pencil lie on the table beside the booklet, the booklet is large in the frame and sits in the lower middle of the picture',
  },
  {
    n: 3,
    id: 'spiral-a',
    size: SQUARE,
    subject:
      'A rectangular printed A4 paper booklet, perfectly flat with straight clean edges and sharp corners, bound with a black plastic spiral coil along its left edge, ' +
      'the front cover is a completely plain matte white sheet with nothing printed on it, lying on a light oak wooden table, ' +
      'seen from above at a gentle angle and slightly rotated, a white ceramic cup of tea sits far in the upper right corner of the picture, the booklet is large in the frame and sits in the middle of the picture',
  },
  {
    n: 4,
    id: 'spiral-b',
    size: SQUARE,
    subject:
      'A single flat rectangular A4 booklet with straight edges, a metal wire spiral binding running along the left edge, and a smooth plain white matte cover without any print, ' +
      'resting on a pale wooden table photographed from above at a gentle angle, the table is empty except for the booklet, soft window light, the booklet fills most of the picture',
  },
  {
    n: 5,
    id: 'left-staples',
    size: SQUARE,
    subject:
      'A rectangular printed A4 paper booklet, perfectly flat with straight clean edges and sharp corners, held together by exactly two small silver staples along its left edge, ' +
      'the front cover is a completely plain matte white sheet with nothing printed on it, lying on a light oak wooden table, ' +
      'seen from above at a gentle angle and slightly rotated, a white ceramic cup of tea sits far in the upper right corner of the picture, the booklet is large in the frame and sits in the middle of the picture',
  },
  {
    n: 6,
    id: 'stack-plain',
    size: SQUARE,
    subject:
      'A rectangular stack of plain white A4 paper, about twenty sheets thick, perfectly neat with straight clean edges and sharp corners, the top sheet is completely plain matte white with nothing printed on it, no binding, no staples, no clips, ' +
      'lying on a light oak wooden table, seen from above at a gentle angle and slightly rotated, a white ceramic cup of tea sits far in the upper right corner of the picture, the stack is large in the frame and sits in the middle of the picture',
  },
  {
    n: 7,
    id: 'table-plate',
    plate: true,
    size: SQUARE,
    subject:
      'An empty round light oak wooden table seen from above at a gentle angle, a white ceramic cup of tea sits in the upper right corner of the picture, ' +
      'the rest of the tabletop is completely empty and clean, nothing else on the table, the window is at the upper left',
  },
  {
    n: 8,
    id: 'table-close',
    plate: true,
    size: SQUARE,
    subject:
      'A close-up photograph of an empty light oak wooden table surface seen from above at a gentle angle, the wood fills the whole frame, ' +
      'a white ceramic cup of tea sits in the upper right corner of the picture, the rest of the tabletop is completely empty, clean and uncluttered, soft window light from the upper left',
  },
  {
    n: 9,
    id: 'table-bare',
    plate: true,
    size: SQUARE,
    subject:
      'A close-up photograph of a completely empty light oak wooden table surface seen from above at a gentle angle, the wood grain fills the whole frame edge to edge, ' +
      'nothing at all on the table, no objects, no cup, no paper, soft warm window light from the upper left casting gentle gradients, shallow depth of field',
  },
  {
    n: 2,
    id: 'corner-staple-clean',
    size: SQUARE,
    subject:
      'A single printed A4 paper booklet lying alone on a light wooden table, photographed from above at a gentle angle and slightly rotated, ' +
      'the front cover is a completely plain matte white sheet of paper, one small silver staple holds the pages in the top left corner, ' +
      'the plain light wooden table fills the rest of the picture with only a white cup of tea far in the upper right corner, the booklet sits in the lower middle of the picture',
  },
]

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188'
const GENERATION = { model: 'flux-2-klein-4b-fp8.safetensors', textEncoder: 'qwen_3_4b.safetensors (type flux2)', vae: 'flux2-vae.safetensors', steps: 4, cfg: 1, sampler: 'euler' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const promptFor = (s) => `${s.subject}. ${s.plate ? SHOT_PLATE : SHOT}`
export const seedsFor = (s, count) => Array.from({ length: count }, (_, i) => SEED_BASE + s.n * 100 + i + 1)

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
  return fetch(`${HOST}${route}`, { ...init, signal: AbortSignal.timeout(120_000) })
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
  const opt = {}
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) continue
    const [k, ...v] = rest[i].slice(2).split('=')
    opt[k] = v.length ? v.join('=') : rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true'
  }
  if (command !== 'generar' || !opt.out) {
    console.error('Uso: node make_mockup_stills.mjs generar --out CARPETA [--solo=id1,id2] [--semillas=6] [--simular]')
    process.exitCode = 2
    return
  }
  const count = Number(opt.semillas ?? 6)
  const targets = STILLS.filter((s) => !opt.solo || opt.solo.split(',').includes(s.id))
  if (opt.simular) {
    for (const s of targets) console.log(`${s.id} ${s.size.join('x')} semillas ${seedsFor(s, count).join(',')}\n  ${promptFor(s)}\n`)
    return
  }
  const out = path.resolve(opt.out)
  await mkdir(out, { recursive: true })
  if (!(await api('/system_stats')).ok) throw new Error('ComfyUI no responde en ' + HOST)

  const logFile = path.join(out, 'candidatos.json')
  let log = { generation: GENERATION, shot: SHOT, items: [] }
  try { log = JSON.parse(await readFile(logFile, 'utf8')) } catch { /* primera corrida */ }

  const clientId = randomUUID()
  console.log(`Precalentando ${targets.length} consignas...`)
  const t0 = Date.now()
  await run(warmupGraph(targets.map(promptFor)), clientId, 1_800_000)
  console.log(`  listo en ${((Date.now() - t0) / 1000).toFixed(0)} s`)

  for (const s of targets) {
    for (const seed of seedsFor(s, count)) {
      const file = `${s.id}-s${seed}.png`
      if (log.items.some((i) => i.file === file)) continue
      const started = Date.now()
      const item = await run(graph({ prompt: promptFor(s), seed, width: s.size[0], height: s.size[1] }), clientId)
      const image = item.outputs?.['13']?.images?.[0]
      if (!image) throw new Error('La salida no trae imagen')
      const res = await api('/view?' + new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type }))
      await writeFile(path.join(out, file), Buffer.from(await res.arrayBuffer()))
      log.items.push({ id: s.id, file, seed, width: s.size[0], height: s.size[1], prompt: promptFor(s) })
      await writeFile(logFile, JSON.stringify(log, null, 2) + '\n')
      console.log(`  ${file} (${((Date.now() - started) / 1000).toFixed(1)} s)`)
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
