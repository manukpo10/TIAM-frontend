// Backend de mentira para probar el formulario de compra de las landings, sin Mercado Pago ni base de datos.
// Imita lo que hace POST /packs/checkout (ver Proyecto Digitales/pack/cobro-diseno.md, sección 2.3): recibe el
// formulario como application/x-www-form-urlencoded y responde 303. SOLO PARA DESARROLLO LOCAL.
//
// Uso, desde la raíz del repo:
//   node scripts/pack-landings/mock-checkout.mjs [puerto] [--site http://localhost:4191]
//   y armar el sitio con `node scripts/pack-landings/build-mock.mjs <carpeta>` (apunta el formulario a este servidor y enciende el mock de
//   las páginas /pack/gracias, /pack/descargas y /arrepentimiento, que solo existe en esa build de desarrollo)
//
// A dónde responde, según lo que se escriba en el formulario:
//   campo «hp_contacto» (trampa) con texto  vuelve a la landing sin aviso (como haría el backend con un bot)
//   email sin «@» o «juegos» sin teléfono .. vuelve a la landing con ?error=email / ?error=telefono
//   nombre con «precio» o «pago» ........... vuelve con ?error=precio / ?error=pago
//   nombre con «efectivo» .................. /pack/gracias con un pago en efectivo pendiente (mock-cash)
//   nombre con «pendiente» ................. /pack/gracias con el pago todavía sin confirmar (mock-pending)
//   nombre con «revision» .................. /pack/gracias con el pedido retenido para una revisión manual (mock-review)
//   nombre con «rechazado» ................. /pack/gracias con el pago rechazado, que no se recupera (mock-failed)
//   nombre con «reintento» ................. /pack/gracias con el pago rechazado y, a los ~20 s, pagado en un segundo intento (mock-flip)
//   cualquier otro ......................... /pack/gracias con el pedido pagado (mock-full si compró extras, si no mock-paid)
// Imprime solo los NOMBRES de los campos que llegaron, nunca sus valores.

import http from 'node:http'

const args = process.argv.slice(2)
const portArg = args.find((a) => /^\d+$/.test(a))
const siteIdx = args.indexOf('--site')
const port = Number(portArg ?? 8787)
const defaultSite = siteIdx > -1 ? args[siteIdx + 1] : 'http://localhost:4191'
const EDITIONS = new Set(['familias', 'profesionales'])

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method !== 'POST' || url.pathname !== '/packs/checkout') {
      res.writeHead(404).end('mock-checkout: solo POST /packs/checkout')
      return
    }
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 20_000) req.destroy()
    })
    req.on('end', () => {
      const body = new URLSearchParams(raw)
      const get = (k) => (body.get(k) ?? '').trim()
      const extras = body.getAll('extras')
      const edition = EDITIONS.has(get('edicion')) ? get('edicion') : 'familias'
      // Nunca se redirige a una URL que mande el cliente: el sitio sale del Origin del navegador o de --site, la página de la edición ya validada.
      const origin = req.headers.origin && /^https?:\/\/localhost(:\d+)?$/.test(req.headers.origin) ? req.headers.origin : defaultSite
      const back = (error) => `${origin}/pack/${edition}${error ? `?error=${error}` : ''}#comprar`
      const name = get('nombre').toLowerCase()

      console.log(`POST /packs/checkout  campos: ${[...new Set(body.keys())].join(', ')}  extras: [${extras.join(', ')}]  total: ${get('expected_total') || '-'}`)

      let location
      if (get('hp_contacto')) location = back('')
      else if (!get('email').includes('@')) location = back('email')
      else if (name.includes('precio')) location = back('precio')
      else if (name.includes('pago')) location = back('pago')
      else if (extras.includes('juegos') && !get('telefono')) location = back('telefono')
      else {
        const params = new URLSearchParams({ payment_id: '1234567890', collection_id: '1234567890', external_reference: 'pack:42', preference_id: 'mock-pref', site_id: 'MLA', merchant_order_id: '99' })
        let token = extras.length ? 'mock-full' : 'mock-paid'
        if (name.includes('efectivo')) {
          token = 'mock-cash'
          params.set('status', 'pending')
          params.set('collection_status', 'pending')
          params.set('payment_type', 'ticket')
        } else if (name.includes('revision')) {
          token = 'mock-review'
          params.set('status', 'approved')
          params.set('collection_status', 'approved')
          params.set('payment_type', 'credit_card')
        } else if (name.includes('rechazado') || name.includes('reintento')) {
          token = name.includes('reintento') ? 'mock-flip' : 'mock-failed'
          params.set('status', 'rejected')
          params.set('collection_status', 'rejected')
          params.set('payment_type', 'credit_card')
        } else if (name.includes('pendiente')) {
          token = 'mock-pending'
          params.set('status', 'in_process')
          params.set('collection_status', 'in_process')
          params.set('payment_type', 'credit_card')
        } else {
          params.set('status', 'approved')
          params.set('collection_status', 'approved')
          params.set('payment_type', 'credit_card')
        }
        params.set('o', token)
        location = `${origin}/pack/gracias?${params}`
      }
      res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }).end()
    })
  })
  .listen(port, () => console.log(`mock-checkout en http://localhost:${port}/packs/checkout  (sitio de vuelta: ${defaultSite})`))
