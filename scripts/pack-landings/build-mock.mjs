// Arma el sitio con el backend de mentira (src/pages/pack/packMock.ts) para probar el cobro sin backend ni Mercado Pago.
// SOLO PARA DESARROLLO LOCAL: el resultado nunca se publica.
//
// El mock solo existe en una build de desarrollo (import.meta.env.DEV): en una build normal, aunque VITE_PACK_MOCK=1 llegue al
// entorno, ese código se descarta y no entra a dist/ (revisión M-08). Vite decide DEV por NODE_ENV, no por --mode, así que una
// build de producción con la variable puesta NO sirve para probar; este script fija NODE_ENV=development y la variable por vos.
//
// Uso, desde la raíz del repo:
//   node scripts/pack-landings/build-mock.mjs <carpeta-de-salida> [--checkout http://localhost:8787/packs/checkout]
//   npx vite preview --outDir <carpeta-de-salida> --port 4192
//   node scripts/pack-landings/mock-checkout.mjs 8787 --site http://localhost:4192
//
// La carpeta de salida es obligatoria y tiene que estar fuera de dist/: así una build con mock no se confunde nunca con la real.

import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)
const flag = args.indexOf('--checkout')
const checkout = flag > -1 ? args[flag + 1] : 'http://localhost:8787/packs/checkout'
const outArg = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--checkout')

if (!outArg) throw new Error('Uso: node scripts/pack-landings/build-mock.mjs <carpeta-de-salida> [--checkout <url>]')
const outDir = path.resolve(outArg)
const dist = path.join(root, 'dist')
if (outDir === dist || outDir.startsWith(dist + path.sep)) throw new Error('La build con mock no puede ir a dist/: usá otra carpeta (mejor, fuera del repo).')

process.env.NODE_ENV = 'development'
process.env.VITE_PACK_MOCK = '1'
process.env.VITE_PACK_CHECKOUT_URL = checkout

const { build } = await import('vite')
await build({ root, build: { outDir, emptyOutDir: true } })
console.log(`\nBuild con mock en ${outDir}\n  servir:  npx vite preview --outDir "${outDir}" --port 4192\n  backend: node scripts/pack-landings/mock-checkout.mjs 8787 --site http://localhost:4192`)
