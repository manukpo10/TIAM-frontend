// Chrome headless por el protocolo CDP, sin dependencias. Lo usan shoot.mjs y check.mjs.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Abre Chrome headless con el viewport pedido y devuelve una API mínima de CDP. */
export async function openPage({ width, height, mobile = width < 768, chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) {
  const port = 9300 + Math.floor(Math.random() * 500)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tiam-cdp-'))
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const close = () => {
    try {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      proc.kill()
    }
    try {
      fs.rmSync(profile, { recursive: true, force: true })
    } catch {
      /* el perfil temporal puede quedar tomado un rato */
    }
  }

  try {
    let wsUrl
    for (let i = 0; i < 80 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl
      } catch {
        /* Chrome todavía arrancando */
      }
      if (!wsUrl) await sleep(150)
    }
    if (!wsUrl) throw new Error('Chrome no respondió')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })

    let nextId = 0
    const pending = new Map()
    const listeners = []
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const l of listeners) if (l.method === msg.method) l.handler(msg.params)
      }
    }

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++nextId
        pending.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      })
    const on = (method, handler) => listeners.push({ method, handler })
    const once = (method) => new Promise((resolve) => on(method, resolve))
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'error al evaluar')
      return r.result.value
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height })
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true })

    return {
      send,
      on,
      once,
      evaluate,
      sleep,
      close: () => {
        try {
          ws.close()
        } finally {
          close()
        }
      },
    }
  } catch (error) {
    close()
    throw error
  }
}

/**
 * Navega, espera `load` y las tipografías, recorre la página para cargar lo diferido y vuelve arriba.
 * Recorre también los carruseles horizontales (la galería): las imágenes diferidas que quedan fuera del
 * recuadro de su carrusel no se piden hasta que se desliza, y sin eso la espera final no terminaba nunca.
 */
export async function loadAndSettle(page, url, height) {
  const loaded = page.once('Page.loadEventFired')
  await page.send('Page.navigate', { url })
  await loaded
  await page.evaluate('document.fonts.ready.then(() => true)')
  const total = await page.evaluate('document.documentElement.scrollHeight')
  for (let y = 0; y < total; y += Math.round(height * 0.8)) {
    await page.evaluate(`window.scrollTo(0, ${y})`)
    await sleep(120)
  }
  await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const strips = [...document.querySelectorAll('*')].filter((el) => {
      const overflowX = getComputedStyle(el).overflowX
      return (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4
    })
    for (const el of strips) {
      el.scrollIntoView({ block: 'center' })
      await wait(150)
      for (let x = 0; x <= el.scrollWidth; x += Math.max(80, Math.round(el.clientWidth * 0.7))) {
        el.scrollLeft = x
        await wait(120)
      }
      el.scrollLeft = 0
    }
    return strips.length
  })()`)
  await page.evaluate('window.scrollTo(0, 0)')
  // Con tope de tiempo: una imagen oculta o rota no debe colgar la corrida.
  await page.evaluate(`Promise.race([
    Promise.all([...document.images].filter((i) => i.offsetParent !== null).map((i) => (i.complete ? true : new Promise((r) => { i.onload = i.onerror = r })))),
    new Promise((r) => setTimeout(r, 8000)),
  ])`)
  await sleep(400)
}
