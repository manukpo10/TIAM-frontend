import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { linkButton } from './linkButton'
import { isInAppBrowser } from './inAppBrowser'

/**
 * Shown above the file buttons when the page is open inside the Facebook / Instagram / Messenger in-app browser,
 * where downloads often do nothing (see inAppBrowser.ts). It asks the buyer to open the page in Chrome or Safari and
 * gives them the link to do it. The download buttons below keep working: if the in-app browser does let the
 * file through, nothing else is needed.
 *
 * The link is the buyer's own downloads address. It is only copied to their clipboard and shown on their own
 * screen: it is never logged and never sent anywhere.
 */

type CopyState = 'idle' | 'copied' | 'manual'

export function InAppBrowserNotice({ token }: { token: string }) {
  const [inApp] = useState(() => isInAppBrowser(typeof navigator === 'undefined' ? '' : navigator.userAgent))
  const [state, setState] = useState<CopyState>('idle')
  const input = useRef<HTMLInputElement>(null)

  // "Link copiado" is a confirmation, not a permanent state.
  useEffect(() => {
    if (state !== 'copied') return
    const id = window.setTimeout(() => setState('idle'), 4000)
    return () => window.clearTimeout(id)
  }, [state])

  if (!inApp) return null

  const link = `${window.location.origin}/pack/descargas/${encodeURIComponent(token)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      return setState('copied')
    } catch {
      /* no clipboard API in this window (or it refused): select the text and try the old way */
    }
    const field = input.current
    if (field) {
      field.focus()
      field.select()
      field.setSelectionRange(0, link.length)
      try {
        if (document.execCommand('copy')) return setState('copied')
      } catch {
        /* the buyer copies it by hand from the selected text */
      }
    }
    setState('manual')
  }

  return (
    <section aria-labelledby="inapp-title" className="rounded-3xl border-2 border-tiam-orange/50 bg-tiam-orange/10 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tiam-orange/15 text-tiam-orange">
          <ExternalLink className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 id="inapp-title" className="text-xl font-bold leading-snug text-slate-900">
            Abrí esta página en tu navegador (Chrome o Safari) para poder descargar tus archivos
          </h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            Ahora estás dentro de la app de Facebook o Instagram, y a veces esa ventana no deja bajar archivos. Copiá el link, abrí Chrome o Safari y pegalo ahí. Es el
            mismo link que te mandamos por email: también podés abrirlo desde el email.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="text"
          readOnly
          value={link}
          aria-label="Link de tus descargas"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-[52px] w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button type="button" onClick={copy} className={linkButton('primary', 'w-full shrink-0 sm:w-auto')}>
          {state === 'copied' ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
          Copiar link
        </button>
      </div>

      <p className="mt-3 min-h-6 text-base font-semibold text-slate-900" role="status" aria-live="polite">
        {state === 'copied' && 'Link copiado'}
        {state === 'manual' && 'No pudimos copiarlo solo: dejá apretado el link de arriba y elegí «Copiar».'}
      </p>
    </section>
  )
}
