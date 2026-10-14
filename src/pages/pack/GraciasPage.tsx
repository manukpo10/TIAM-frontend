import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CheckCircle2, Clock, Loader2, Mail, RefreshCw, SearchX, ShieldAlert, WifiOff, XCircle } from 'lucide-react'
import { startMetaPixel, trackMetaPixel } from '@/lib/metaPixel'
import { Card, PackShell, StateHero } from './PackShell'
import { DownloadsPanel } from './DownloadsPanel'
import { ContactLink } from './ContactLink'
import { linkButton } from './linkButton'
import { confirmPayment, getOrder } from './packClient'
import type { PackOrder } from './packTypes'
import { PackApiError } from './packTypes'
import { consumeReturnParams, isPurchaseTracked, markPurchaseTracked } from './returnParams'

/**
 * Where Mercado Pago sends the buyer back (the preference's back_url): /pack/gracias?o=<token>&payment_id=...
 *
 * Order of events, on purpose:
 *  1. While rendering, the token and Mercado Pago's parameters are taken out of the address bar (returnParams).
 *  2. Only then can anything third-party load: the Meta Pixel is started after the order is confirmed paid.
 *  3. The page asks the backend for the order's state, polling until it is paid (or fails). If Mercado Pago
 *     gave us a payment id it also asks the backend, once, to verify that payment, so the buyer does not wait
 *     for the webhook. The backend re-reads the payment from Mercado Pago: nothing here is trusted.
 *
 * A cash coupon (Rapipago, Pago Fácil) is paid later and away from this screen, so that case only says what
 * will happen and checks slowly in case the buyer leaves the tab open.
 */

type View =
  | { kind: 'loading'; slow: boolean }
  | { kind: 'paid'; order: PackOrder }
  | { kind: 'waiting'; delayed: boolean }
  | { kind: 'failed' }
  | { kind: 'review' }
  | { kind: 'not-found' }
  | { kind: 'offline' }

const FAST_MS = 4_000
const SLOW_MS = 30_000
const FAST_ATTEMPTS = 30 // about two minutes of checking every 4 seconds

// One confirm call per order and payment, even if React runs the effect twice (StrictMode) or the page re-renders.
const confirmations = new Map<string, Promise<unknown>>()
function confirmOnce(token: string, paymentId: string): Promise<unknown> {
  const id = `${token}|${paymentId}`
  let promise = confirmations.get(id)
  if (!promise) {
    promise = confirmPayment(token, paymentId).catch(() => {
      /* the poll below still finds the order once the webhook arrives */
    })
    confirmations.set(id, promise)
  }
  return promise
}

export function GraciasPage() {
  // Takes the token out of the URL during the first render: nothing third-party has run yet.
  const [info] = useState(consumeReturnParams)
  const { token, paymentId, hint } = info
  const cash = hint === 'cash'

  // If Mercado Pago itself said the payment was rejected, say so right away: the order stays "pending" until the
  // webhook reports it, and "we are confirming your payment" would be wrong for a payment that already failed.
  const [view, setView] = useState<View>(!token ? { kind: 'not-found' } : hint === 'failed' ? { kind: 'failed' } : { kind: 'loading', slow: false })
  const [paidOrder, setPaidOrder] = useState<PackOrder | null>(null)
  const pollNow = useRef<() => void>(() => {})

  useEffect(() => {
    if (!token) return
    let stopped = false
    let timer: number | undefined
    let attempts = 0
    let failures = 0
    let inFlight = false
    let again = false // a confirmation arrived while a poll was running: look once more right after it

    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      if (!stopped) timer = window.setTimeout(poll, ms)
    }

    async function poll() {
      if (stopped || inFlight) return
      inFlight = true
      try {
        const order = await getOrder(token as string)
        if (stopped) return
        failures = 0
        if (order.status === 'PAID') {
          setPaidOrder(order)
          setView({ kind: 'paid', order })
          return
        }
        if (order.status === 'FAILED') return setView({ kind: 'failed' })
        if (order.status === 'REVIEW') return setView({ kind: 'review' })
        attempts += 1
        if (hint === 'failed') return schedule(SLOW_MS) // keep the "failed" screen; only a paid order changes it
        setView({ kind: 'waiting', delayed: attempts >= FAST_ATTEMPTS })
        schedule(cash || attempts >= FAST_ATTEMPTS ? SLOW_MS : FAST_MS)
      } catch (error) {
        if (stopped) return
        if (error instanceof PackApiError && error.kind === 'not-found') return setView({ kind: 'not-found' })
        failures += 1
        // The server may be waking up: keep trying quietly, and only say so after a few failed attempts.
        if (failures >= 3) setView({ kind: 'offline' })
        schedule(failures >= 3 ? SLOW_MS : FAST_MS * 2)
      } finally {
        inFlight = false
        if (again && !stopped) {
          again = false
          schedule(0)
        }
      }
    }

    pollNow.current = () => {
      attempts = 0
      failures = 0
      setView({ kind: 'loading', slow: false })
      window.clearTimeout(timer)
      void poll()
    }

    const slowTimer = window.setTimeout(() => setView((current) => (current.kind === 'loading' ? { kind: 'loading', slow: true } : current)), 6_000)

    void poll()
    // Verify the payment with the backend right away; when it answers, look at the order again without waiting.
    if (paymentId) {
      void confirmOnce(token, paymentId).then(() => {
        if (stopped) return
        if (inFlight) again = true
        else schedule(0)
      })
    }

    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(slowTimer)
    }
  }, [token, paymentId, cash, hint])

  // The Meta Pixel starts only now: the URL was cleaned at render time, and only a paid order counts as a purchase.
  useEffect(() => {
    if (!paidOrder || isPurchaseTracked()) return
    if (startMetaPixel()) {
      trackMetaPixel('Purchase', { currency: 'ARS', content_type: 'product', content_category: 'pack-fichas', ...(paidOrder.total ? { value: paidOrder.total } : {}) })
    }
    markPurchaseTracked()
  }, [paidOrder])

  const retry = useCallback(() => pollNow.current(), [])

  return (
    <PackShell title="Gracias por tu compra">
      {view.kind === 'loading' && <Loading slow={view.slow} />}
      {view.kind === 'paid' && token && <Paid order={view.order} token={token} />}
      {view.kind === 'waiting' && <Waiting cash={cash} delayed={view.delayed} onRetry={retry} />}
      {view.kind === 'failed' && <Failed />}
      {view.kind === 'review' && <Review />}
      {view.kind === 'not-found' && <NotFound />}
      {view.kind === 'offline' && <Offline onRetry={retry} />}
    </PackShell>
  )
}

// ─── States ─────────────────────────────────────────────────────────────────

function Loading({ slow }: { slow: boolean }) {
  return (
    <div role="status" aria-live="polite">
      <StateHero tone="blue" icon={Loader2} spin title="Buscando tu pedido…">
        <p>{slow ? 'Está tardando un poco más de lo normal. No cierres la página, ya casi.' : 'Un momento, estamos confirmando tu pago.'}</p>
      </StateHero>
    </div>
  )
}

function Paid({ order, token }: { order: PackOrder; token: string }) {
  return (
    <div className="space-y-8">
      <StateHero tone="green" icon={CheckCircle2} title={order.firstName ? `¡Listo, ${order.firstName}! Tu pago está confirmado` : '¡Listo! Tu pago está confirmado'}>
        <p>Ya podés descargar tus archivos. Elegí el papel en el que vas a imprimir y tocá «Descargar».</p>
      </StateHero>

      <DownloadsPanel order={order} token={token} />

      <Card className="bg-slate-50">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden />
          <div className="text-slate-600">
            <p className="font-semibold text-slate-900">También te lo mandamos por email</p>
            <p className="mt-1 leading-relaxed">
              Te llega el mismo acceso por correo, para que puedas volver cuando quieras. Si en unos minutos no lo ves, revisá la carpeta de spam o de promociones.
            </p>
            {/* A plain link on purpose: a full page load, so the Pixel started on this page never sees the token's address. */}
            <a href={`/pack/descargas/${encodeURIComponent(token)}`} className="mt-3 inline-flex min-h-11 items-center font-medium text-tiam-blue underline underline-offset-2">
              Abrir mi página de descargas
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Waiting({ cash, delayed, onRetry }: { cash: boolean; delayed: boolean; onRetry: () => void }) {
  if (cash) {
    return (
      <div className="space-y-6">
        <StateHero tone="orange" icon={Banknote} title="Estamos esperando tu pago en efectivo">
          <p>
            Cuando pagues el cupón, el pago se acredita en unas horas, y a veces tarda uno o dos días hábiles según el medio que elegiste.
          </p>
        </StateHero>
        <Card>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden />
            <p className="leading-relaxed text-slate-600">
              <strong className="text-slate-900">Apenas se acredite te llega un email con tus archivos.</strong> No hace falta que hagas nada más ni que dejes esta
              página abierta. Si la dejás abierta, se actualiza sola.
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            ¿No te llegó el cupón o ya pagaste y pasaron más de dos días?{' '}
            <ContactLink />
            .
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={Clock} title="Estamos confirmando tu pago">
        {delayed ? (
          <p>Está tardando más de lo normal. No te preocupes: apenas se confirme te llega un email con tus archivos.</p>
        ) : (
          <p>Suele tardar menos de un minuto. No cierres esta página: cuando se confirme, vas a ver acá tus archivos.</p>
        )}
      </StateHero>
      <div className="flex flex-col items-center gap-3">
        {!delayed && <Loader2 className="h-6 w-6 animate-spin text-tiam-blue" aria-hidden />}
        <button type="button" onClick={onRetry} className={linkButton('secondary')}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Revisar de nuevo
        </button>
        <p className="text-center text-sm text-slate-600">También te mandamos los archivos por email apenas se acredite el pago.</p>
      </div>
    </div>
  )
}

function Failed() {
  return (
    <div className="space-y-6">
      <StateHero tone="red" icon={XCircle} title="El pago no se completó">
        <p>No se te cobró nada. Podés intentarlo de nuevo cuando quieras.</p>
      </StateHero>
      <div className="flex justify-center">
        <Link to="/material-digital" className={linkButton('primary')}>
          Volver a intentar
        </Link>
      </div>
    </div>
  )
}

function Review() {
  return (
    <div className="space-y-6">
      <StateHero tone="orange" icon={ShieldAlert} title="Estamos revisando tu pago">
        <p>Tu pago llegó, pero necesitamos revisarlo antes de entregarte los archivos. Te escribimos por email en las próximas horas.</p>
      </StateHero>
      <Card>
        <p className="text-slate-600">
          Si pasa más de un día hábil sin noticias nuestras, <ContactLink />.
        </p>
      </Card>
    </div>
  )
}

function NotFound() {
  return (
    <div className="space-y-6">
      <StateHero tone="blue" icon={SearchX} title="No encontramos tu pedido">
        <p>Puede que este link haya vencido o se haya copiado mal. Si ya pagaste, podés pedir que te mandemos el acceso de nuevo.</p>
      </StateHero>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/pack/recuperar" className={linkButton('primary', 'w-full sm:w-auto')}>
          Recibir mi acceso por email
        </Link>
        <ContactLink className={linkButton('secondary', 'w-full sm:w-auto')} />
      </div>
    </div>
  )
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={WifiOff} title="No pudimos conectarnos">
        <p>Tu pago no se perdió. Estamos teniendo problemas para consultar el estado: probá de nuevo en un momento. También te mandamos los archivos por email.</p>
      </StateHero>
      <div className="flex justify-center">
        <button type="button" onClick={onRetry} className={linkButton('primary')}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Reintentar
        </button>
      </div>
    </div>
  )
}
