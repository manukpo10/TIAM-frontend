// Ilustración de la tarjeta «Cuadernos TIAM» de /material-digital (src/assets/material-digital/edicion-cuadernos.webp), con FLUX.2 klein 4B fp8 en local
// (ComfyUI), con el mismo grafo que make_illustrations.mjs. Las otras tres tarjetas son ilustraciones planas, cálidas y suaves (crema, verde azulado, ocre):
// la consigna pide ese estilo, 4:3 (1152 x 864 px) y una sola persona mayor, sola, en una mesa con un cuaderno.
//
// Uso, desde la raíz del repo, con ComfyUI andando en 127.0.0.1:8188 (python main.py --lowvram):
//   node scripts/pack-landings/make_material_card.mjs --out CARPETA [--semillas=20271001,20271002,...]
// Deja un PNG por semilla y candidatos.json (consigna y semillas). Se mira cada uno y se elige; el elegido se pasa a WebP con Pillow.
// Elegida (2026-10-19): la semilla 20271002 de las seis por defecto (las 1 y 4 tenían los ojos cerrados; la 2 tiene la cara y las manos más claras),
// WebP calidad 80 a 1152 x 864: `src/assets/material-digital/edicion-cuadernos.webp`.

import fs from 'node:fs'
import path from 'node:path'

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188'
const SUBJECT =
  'An elderly woman with short gray hair and round glasses sits alone at a wooden kitchen table by a bright window with sheer curtains, smiling softly while she writes with a pencil in an open exercise workbook. ' +
  'A cup of tea, a second pencil and a small potted plant are on the table. Warm cream room, a wooden shelf with jars in the background.'
const STYLE =
  'Flat vector illustration, soft rounded shapes without outlines, rosy cheeks, warm cream, teal, mustard and soft blue palette, gentle light, simple clean background, ' +
  'friendly and dignified adult style, not childish, no text, natural faces and correct hands, only one person in the picture.'
const WIDTH = 1152
const HEIGHT = 864

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
if (!args.out) throw new Error('Uso: node make_material_card.mjs --out CARPETA [--semillas=a,b,c]')
const seeds = (args.semillas ?? '20271001,20271002,20271003,20271004,20271005,20271006').split(',').map(Number)
fs.mkdirSync(args.out, { recursive: true })

const prompt = `${SUBJECT} ${STYLE}`
const graph = (seed) => ({
  1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-4b-fp8.safetensors', weight_dtype: 'default' } },
  2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'flux2', device: 'default' } },
  3: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
  4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
  5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
  6: { class_type: 'EmptyFlux2LatentImage', inputs: { width: WIDTH, height: HEIGHT, batch_size: 1 } },
  7: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: WIDTH, height: HEIGHT } },
  8: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
  9: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  10: { class_type: 'CFGGuider', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], cfg: 1 } },
  11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['9', 0], guider: ['10', 0], sampler: ['8', 0], sigmas: ['7', 0], latent_image: ['6', 0] } },
  12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
  13: { class_type: 'PreviewImage', inputs: { images: ['12', 0] } },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const seed of seeds) {
  const res = await fetch(`${HOST}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph(seed), client_id: 'material-card' }) })
  const body = await res.json()
  if (!res.ok || (body.node_errors && Object.keys(body.node_errors).length)) throw new Error('POST /prompt falló: ' + JSON.stringify(body).slice(0, 600))
  let item
  for (let t = 0; t < 1200; t++) {
    item = (await (await fetch(`${HOST}/history/${body.prompt_id}`)).json())[body.prompt_id]
    if (item?.status?.status_str === 'error') throw new Error('Error de ejecución: ' + JSON.stringify(item.status).slice(0, 600))
    if (item?.outputs?.['13']) break
    await sleep(700)
  }
  const img = item.outputs['13'].images[0]
  const png = await (await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`)).arrayBuffer()
  fs.writeFileSync(path.join(args.out, `s${seed}.png`), Buffer.from(png))
  console.log(`s${seed}.png`)
}
fs.writeFileSync(path.join(args.out, 'candidatos.json'), JSON.stringify({ prompt, width: WIDTH, height: HEIGHT, seeds, model: 'flux-2-klein-4b-fp8', steps: 4, cfg: 1, sampler: 'euler' }, null, 2))
