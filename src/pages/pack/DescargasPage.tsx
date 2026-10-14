import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { PackShell, StateHero } from './PackShell'
import { ContactLink } from './ContactLink'
import { DownloadsPanel } from './DownloadsPanel'
import { linkButton } from './linkButton'
import { getOrder } from './packClient'
import type { PackOrder } from './packTypes'
import { PackApiError } from './packTypes'

/**
 * /pack/descargas/:token, the page the purchase email links to. The token is the credential: this route
 * loads no Pixel and nothing third-party, sends no referrer (see PackShell and vercel.json), and the page
 * never logs or echoes it.
 *
 * Unknown, expired, revoked and unpaid orders all look the same ("not found"): the page must not tell an
 * outsider which tokens exist.
 */

type State =
  | { kind: 'loading'; slow: boolean }
  | { kind: 'ready'; order: PackOrder }
  | { kind: 'not-found' }
  | { kind: 'offline' }

export function DescargasPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading', slow: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // The backend may be asleep: say so if the answer takes a while.
    const slowTimer = window.setTimeout(() => setState((current) => (current.kind === 'loading' ? { kind: 'loading', slow: true } : current)), 6_000)

    getOrder(token, controller.signal)
      .then((order) => {
        if (controller.signal.aborted) return
        // Only a paid order has downloads; any other state is "not found" for whoever holds this link.
        setState(order.status === 'PAID' && order.items?.length ? { kind: 'ready', order } : { kind: 'not-found' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState(error instanceof PackApiError && error.kind === 'not-found' ? { kind: 'not-found' } : { kind: 'offline' })
      })

    return () => {
      controller.abort()
      window.clearTimeout(slowTimer)
    }
  }, [token, attempt])

  const retry = useCallback(() => {
    setState({ kind: 'loading', slow: false })
    setAttempt((n) => n + 1)
  }, [])

  return (
    <PackShell title="Tus descargas">
      {state.kind === 'loading' && (
        <div role="status" aria-live="polite">
          <StateHero tone="blue" icon={Loader2} spin title="Abriendo tus descargas…">
            <p>{state.slow ? 'Está tardando un poco más de lo normal. No cierres la página, ya casi.' : 'Un momento, por favor.'}</p>
          </StateHero>
        </div>
      )}

      {state.kind === 'ready' && (
        <div className="space-y-8">
          <StateHero tone="green" icon={CheckCircle2} title={state.order.firstName ? `Hola, ${state.order.firstName}: acá están tus archivos` : 'Acá están tus archivos'}>
            <p>Elegí el papel en el que vas a imprimir y tocá «Descargar». Guardá esta página en favoritos para volver cuando quieras.</p>
          </StateHero>
          <DownloadsPanel order={state.order} token={token} />
        </div>
      )}

      {state.kind === 'not-found' && (
        <div className="space-y-6">
          <StateHero tone="blue" icon={SearchX} title="No encontramos esta página">
            <p>Puede que el link haya vencido o que se haya copiado mal. Si ya compraste, pedí un acceso nuevo con tu email y te lo mandamos al instante.</p>
          </StateHero>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/pack/recuperar" className={linkButton('primary', 'w-full sm:w-auto')}>
              Recibir mi acceso por email
            </Link>
            <ContactLink className={linkButton('secondary', 'w-full sm:w-auto')} />
          </div>
        </div>
      )}

      {state.kind === 'offline' && (
        <div className="space-y-6" role="status" aria-live="polite">
          <StateHero tone="orange" icon={WifiOff} title="No pudimos conectarnos">
            <p>Revisá tu conexión y probá de nuevo. Tu compra no se perdió.</p>
          </StateHero>
          <div className="flex justify-center">
            <button type="button" onClick={retry} className={linkButton('primary')}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reintentar
            </button>
          </div>
        </div>
      )}
    </PackShell>
  )
}
