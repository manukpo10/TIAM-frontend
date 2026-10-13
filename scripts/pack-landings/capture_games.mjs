// Capturas REALES de los juegos del Desafío de 30 días, para las landings del pack.
//
// Qué hace: abre en Chrome headless la pantalla real del Desafío (/desafio/<token>) servida desde dist/,
// toca el día pedido (y, si hace falta, algunos botones del juego) y guarda la tarjeta del juego con
// fondo transparente. Es el sitio tal cual: el juego, su contenido y sus estilos son los de producción.
// Lo único que no es "de verdad" son los datos de la persona: el build corre con el modo de ejemplo que
// trae la app (src/lib/mock.ts, VITE_USE_MOCK), así que el nombre y el día desbloqueado son los de la demo.
// No hay backend ni se crea ningún dato; en la tarjeta no aparece ningún nombre.
//
// Uso, desde la raíz del repo, con `node scripts/pack-landings/serve-dist.mjs 4181` andando:
//   node scripts/pack-landings/capture_games.mjs --base http://127.0.0.1:4181 [--out <carpeta>]   (por defecto scripts/pack-landings/_cache/juegos)
// Después: python scripts/pack-landings/make_game_images.py
//
// Salida (PNG con transparencia, al doble de píxeles de un celular de 320 px de ancho):
//   <carpeta>/juego-<nombre>.png  la tarjeta de cada juego, ya en juego (ver GAMES)
//   <carpeta>/grilla.png          los 30 días del desafío (sin saludo ni nombre)

import fs from 'node:fs'
import path from 'node:path'
import { openPage } from './cdp.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, token, i, all) => (token.startsWith('--') ? [...acc, [token.slice(2), all[i + 1] ?? 'true']] : acc), []),
)
const base = args.base ?? 'http://127.0.0.1:4181'
const out = path.resolve(args.out ?? path.join(import.meta.dirname, '_cache', 'juegos'))
const WIDTH = 320
const HEIGHT = 1000 // alto de sobra: la tarjeta del juego no se corta ni necesita desplazarse
fs.mkdirSync(out, { recursive: true })

// día del desafío, nombre del archivo y botones que se tocan (por su texto exacto) hasta llegar a una pantalla de juego
const GAMES = [
  { day: 2, name: 'lista-mercado', taps: [] }, // Memoria: la lista para memorizar
  { day: 5, name: 'vuelto', taps: ['$50'] }, // Cálculo: armar el vuelto con billetes (los precios salen al azar: se toca un billete)
  { day: 9, name: 'reloj', taps: [] }, // Visuoespacial: leer la hora
  { day: 1, name: 'palabras', taps: [] }, // Lenguaje: unir fichas de letras
  { day: 4, name: 'simbolos', taps: ['Empezar'] }, // Atención: clave de símbolos
  { day: 8, name: 'frase', taps: ['Empezar'] }, // Lenguaje: ordenar la frase
]

const page = await openPage({ width: WIDTH, height: HEIGHT, chrome: args.chrome })
await page.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true, screenWidth: WIDTH, screenHeight: HEIGHT })
await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })

const open = async () => {
  const loaded = page.once('Page.loadEventFired')
  await page.send('Page.navigate', { url: `${base}/desafio/demo` })
  await loaded
  await page.evaluate('document.fonts.ready.then(() => true)')
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(`!!document.querySelector('button[aria-label^="Día 1"]')`)) break
    await page.sleep(150)
  }
  await page.sleep(400)
}

const shoot = async (selectorExpr, file, pad = 0) => {
  const r = await page.evaluate(`(() => { const b = (${selectorExpr}).getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height } })()`)
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2, scale: 1 }
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
  fs.writeFileSync(path.join(out, file), Buffer.from(data, 'base64'))
  console.log(`${file}  ${Math.round(clip.width)}x${Math.round(clip.height)} px css`)
}

// La grilla de los 30 días: sin el saludo (que lleva el nombre de la demo), solo el cartel de días desbloqueados y los días.
await open()
await page.evaluate(`(() => {
  const s = document.createElement('style')
  s.textContent = 'html,body,.min-h-dvh{background:#f2f7fc!important}'
  document.head.appendChild(s)
})()`)
const grid = await page.evaluate(`(() => {
  const g = document.querySelector('button[aria-label^="Día 1"]').parentElement
  const pill = [...document.querySelectorAll('header p')].pop()
  const gb = g.getBoundingClientRect(), pb = pill.getBoundingClientRect()
  return { x: 0, y: pb.top + scrollY - 14, width: innerWidth, height: gb.bottom + scrollY - (pb.top + scrollY) + 28 }
})()`)
{
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...grid, scale: 1 }, captureBeyondViewport: true })
  fs.writeFileSync(path.join(out, 'grilla.png'), Buffer.from(data, 'base64'))
  console.log(`grilla.png  ${Math.round(grid.width)}x${Math.round(grid.height)} px css`)
}

for (const { day, name, taps } of GAMES) {
  await open()
  await page.evaluate(`document.querySelector('button[aria-label^="Día ${day}:"], button[aria-label^="Día ${day},"]').click()`)
  await page.sleep(900)
  for (const label of taps) {
    await page.evaluate(`(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) throw new Error('no hay botón ${label}'); b.click() })()`)
    await page.sleep(700)
  }
  // se saca el fondo oscuro y el resto de la página: queda solo la tarjeta del juego con su sombra
  await page.evaluate(`(() => {
    const s = document.createElement('style')
    s.textContent = 'html,body,.min-h-dvh{background:transparent!important} [role=dialog]{background:transparent!important} .min-h-dvh > .mx-auto{visibility:hidden!important}'
    document.head.appendChild(s)
  })()`)
  await page.sleep(150)
  await shoot(`document.querySelector('[role=dialog] > div')`, `juego-${name}.png`)
}
page.close()
