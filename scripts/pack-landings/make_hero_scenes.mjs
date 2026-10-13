// Escenas de mesa vista desde arriba (flat lay) para la variante D del hero, con FLUX.2 klein 4B fp8 en ComfyUI local (Apache 2.0).
// No descarga nada. Solo genera la ESCENA (mesa, taza, lápiz, anteojos): las tapas reales se componen encima con make_hero_variants.py.
// Nunca personas ni manos; sin texto. Mismo grafo que make_mockup_stills.mjs (4 pasos, cfg 1, euler).
//
// Uso (ComfyUI escuchando en 127.0.0.1:8188):
//   node scripts/pack-landings/make_hero_scenes.mjs --out scripts/pack-landings/_cache/hero/scenes [--semillas=4] [--solo=id1,id2]

import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const SEED_BASE = 20271000
const SIZE = [1536, 1152] // 4:3

const SHOT =
  'Photorealistic top-down flat lay photograph shot directly from above with no perspective, soft diffused natural daylight from the upper left, ' +
  'gentle natural shadows, calm warm home atmosphere, sharp focus, high resolution, ' +
  'absolutely no text, no letters, no numbers, no logos, no writing, no paper, no books, no people, no hands.'

export const SCENES = [
  {
    n: 0,
    id: 'mesa-plana',
    subject:
      'A light oak wooden table seen directly from above, a white ceramic cup of coffee on a saucer near the upper right corner, ' +
      'a pair of thin round reading glasses near the lower right corner, a yellow wooden pencil near the left edge, ' +
      'the large central area of the table is completely empty and clean',
  },
  {
    n: 1,
    id: 'mesa-taza',
    subject:
      'A warm light wooden tabletop seen directly from above, a white ceramic mug of tea on the upper right, a yellow wooden pencil lying at the lower left, ' +
      'nothing else, the whole central area of the table is bare wood',
  },
  {
    n: 2,
    id: 'mesa-anteojos',
    subject:
      'A pale oak wooden table seen directly from above, a pair of black round reading glasses lying on the lower right, a white coffee cup with a saucer on the top left corner, ' +
      'the middle of the table is empty bare wood',
  },
]

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188'
const MODEL = { unet: 'flux-2-klein-4b-fp8.safetensors', clip: 'qwen_3_4b.safetensors', vae: 'flux2-vae.safetensors', steps: 4, cfg: 1 }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const graph = ({ prompt, seed, width, height }) => ({
  1: { class_type: 'UNETLoader', inputs: { unet_name: MODEL.unet, weight_dtype: 'default' } },
  2: { class_type: 'CLIPLoader', inputs: { clip_name: MODEL.clip, type: 'flux2', device: 'default' } },
  3: { class_type: 'VAELoader', inputs: { vae_name: MODEL.vae } },
  4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
  5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
  6: { class_type: 'EmptyFlux2LatentImage', inputs: { width, height, batch_size: 1 } },
  7: { class_type: 'Flux2Scheduler', inputs: { steps: MODEL.steps, width, height } },
  8: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  9: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  10: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], cfg: MODEL.cfg } },
  11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['9', 0], guider: ['10', 0], sampler: ['8', 0], sigmas: ['7', 0], latent_image: ['6', 0] } },
  12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
  13: { class_type: 'PreviewImage', inputs: { images: ['12', 0] } },
})

const api = (route, init = {}) => fetch(`${HOST}${route}`, { ...init, signal: AbortSignal.timeout(120_000) })

async function run(g, clientId, timeoutMs = 900_000) {
  const res = await api('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: clientId }) })
  const body = await res.json()
  if (!res.ok || (body.node_errors && Object.keys(body.node_errors).length)) throw new Error('POST /prompt falló: ' + JSON.stringify(body).slice(0, 600))
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const item = (await (await api(`/history/${body.prompt_id}`)).json())[body.prompt_id]
    if (item?.status?.status_str === 'error') throw new Error('Error de ejecución: ' + JSON.stringify(item.status).slice(0, 600))
    if (item?.status?.completed || item?.outputs) return item
    await sleep(700)
  }
  throw new Error('Tiempo agotado')
}

const opt = Object.fromEntries(
  process.argv.slice(2).reduce((acc, t, i, all) => (t.startsWith('--') ? [...acc, t.includes('=') ? t.slice(2).split('=') : [t.slice(2), all[i + 1] ?? 'true']] : acc), []),
)
if (!opt.out) throw new Error('Falta --out')
const out = path.resolve(opt.out)
await mkdir(out, { recursive: true })
if (!(await api('/system_stats')).ok) throw new Error('ComfyUI no responde en ' + HOST)
const count = Number(opt.semillas ?? 4)
const clientId = randomUUID()
for (const s of SCENES.filter((x) => !opt.solo || opt.solo.split(',').includes(x.id))) {
  for (let k = 1; k <= count; k++) {
    const seed = SEED_BASE + s.n * 100 + k
    const file = path.join(out, `${s.id}-s${seed}.png`)
    const started = Date.now()
    const item = await run(graph({ prompt: `${s.subject}. ${SHOT}`, seed, width: SIZE[0], height: SIZE[1] }), clientId)
    const image = item.outputs?.['13']?.images?.[0]
    if (!image) throw new Error('La salida no trae imagen')
    const res = await api('/view?' + new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type }))
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
    console.log(`${path.basename(file)} (${((Date.now() - started) / 1000).toFixed(1)} s)`)
  }
}
