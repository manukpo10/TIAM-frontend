import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CheckCircle2, CircleAlert, Clock, Loader2, Mail, MessageCircle, RefreshCw, SearchX, ShieldAlert, WifiOff } from 'lucide-react'
import { startMetaPixel, trackMetaPixel } from '@/lib/metaPixel'
import { purchaseValue } from '@/lib/purchaseValue'
import { Card, PackShell, StateHero } from './PackShell'
import { DownloadsPanel } from './DownloadsPanel'
import { ContactLink } from './ContactLink'
import { contact } from './contact'
import { linkButton } from './linkButton'
import { confirmPayment, getOrder } from './packClient'
import type { Edition, OrderConfirmation, PackOrder } from './packTypes'
import { PackApiError, asEdition } from './packTypes'
import { CONFIRM_RETRY_MS, FAST_MS, SLOW_MS, decide } from './pollPolicy'
import type { Phase } from './pollPolicy'
import { consumeReturnParams, isPurchaseTracked, markPurchaseTracked } from './returnParams'

/**
 * Where Mercado Pago sends the buyer back (the preference's back_url): /pack/gracias?o=<token>&payment_id=...
 *
 * Order of events, on purpose:
 *  1. While rendering, the token and Mercado Pago's parameters are taken out of the address bar (returnParams).
 *  2. Only then can anything third-party load: the Meta Pixel is started after the order is confirmed paid.
 *  3. The page asks the backend for the order's state and keeps asking until it is paid. If Mercado Pago gave us a
 *     payment id it also asks the backend to verify that payment, right away and again a few times on a slow backoff
 *     (the backend re-reads the payment from Mercado Pago: nothing here is trusted), so the buyer does not depend on
 *     the webhook arriving.
 *
 * Only PAID ends the waiting (pollPolicy.ts has the rules). FAILED never says "nothing was charged": a rejected
 * first attempt can be followed by an approved retry in the same checkout, and a late webhook can flip the order to
 * PAID after the buyer already saw "failed". REVIEW (approved by Mercado Pago but held for a manual check) is told
 * honestly, and both keep being checked, slowly. A state this page does not know ends on a calm "when it is credited
 * you get the email" screen with the contact, never on a dead end.
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
  | { kind: 'stalled' }
  | { kind: 'not-found' }
  | { kind: 'offline' }

const viewFor = (phase: Phase, delayed: boolean): View => (phase === 'waiting' ? { kind: 'waiting', delayed } : { kind: phase })

// One confirm call per order, payment and moment (slot), even if React runs the effect twice (StrictMode) or the page re-renders.
const confirmations = new Map<string, Promise<OrderConfirmation | null>>()
function confirmOnce(token: string, paymentId: string, slot: string): Promise<OrderConfirmation | null> {
  const id = `${token}|${paymentId}|${slot}`
  let promise = confirmations.get(id)
  if (!promise) {
    // 429 (too many calls), 503 (Mercado Pago not answering) or no connection: not an answer. The polling goes on and
    // the next slot asks again.
    promise = confirmPayment(token, paymentId).catch(() => null)
    confirmations.set(id, promise)
  }
  return promise
}

export function GraciasPage() {
  // Takes the token out of the URL during the first render: nothing third-party has run yet.
  const [info] = useState(consumeReturnParams)
  const { token, paymentId, hint } = info
  const cash = hint === 'cash'

  // If Mercado Pago itself said the payment was rejected, say so right away (without claiming anything about the
  // money): the order stays "pending" until the webhook reports it, and "we are confirming your payment" would be
  // wrong for a payment that already failed.
  const [view, setView] = useState<View>(!token ? { kind: 'not-found' } : hint === 'failed' ? { kind: 'failed' } : { kind: 'loading', slow: false })
  const [paidOrder, setPaidOrder] = useState<PackOrder | null>(null)
  // The landing the buyer came from, known as soon as the backend answers for any state: "try again" goes back to it.
  const [edition, setEdition] = useState<Edition | null>(null)
  const pollNow = useRef<() => void>(() => {})

  useEffect(() => {
    if (!token) return
    let stopped = false
    let done = false // paid (or not found): nothing left to ask
    let timer: number | undefined
    const confirmTimers: number[] = []
    let attempts = 0
    let failures = 0
    let inFlight = false
    let again = false // a confirmation arrived while a poll was running: look once more right after it
    let seen: { status: string; at: number } | null = null // the status the backend last reported, and since when

    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      if (!stopped && !done) timer = window.setTimeout(poll, ms)
    }

    // Shows the screen for a status and returns when to look again (null = stop asking). PAID without the order
    // (it came from a confirmation) means "go and get the files now".
    function apply(status: string, order?: PackOrder): number | null {
      if (status === 'PAID') {
        if (!order) return 0
        done = true
        window.clearTimeout(timer)
        confirmTimers.forEach(window.clearTimeout)
        setPaidOrder(order)
        setView({ kind: 'paid', order })
        return null
      }
      const now = Date.now()
      if (seen?.status !== status) {
        seen = { status, at: now }
        attempts = 0
      }
      attempts += 1
      const decision = decide({ status, hint, sinceMs: now - seen.at, attempts })
      setView(viewFor(decision.phase, decision.delayed))
      return decision.nextMs
    }

    async function poll() {
      if (stopped || done || inFlight) return
      inFlight = true
      try {
        const order = await getOrder(token as string)
        if (stopped) return
        failures = 0
        const known = asEdition(order.edition)
        if (known) setEdition(known)
        const next = apply(String(order.status), order)
        if (next !== null) schedule(next)
      } catch (error) {
        if (stopped) return
        if (error instanceof PackApiError && error.kind === 'not-found') {
          done = true
          return setView({ kind: 'not-found' })
        }
        failures += 1
        // The server may be waking up: keep trying quietly, and only say so after a few failed attempts.
        if (failures >= 3) setView({ kind: 'offline' })
        schedule(failures >= 3 ? SLOW_MS : FAST_MS * 2)
      } finally {
        inFlight = false
        if (again && !stopped && !done) {
          again = false
          schedule(0)
        }
      }
    }

    // What the backend found when it re-read the payment. Paid: go and get the files. Anything else: its word is
    // newer than the URL's, so show it now; the polling keeps its own pace.
    function confirmed(result: OrderConfirmation | null) {
      if (stopped || done || !result) return
      const status = String(result.status)
      if (status === 'PAID') {
        if (inFlight) again = true
        else schedule(0)
        return
      }
      apply(status)
    }

    // Verifies the payment with the backend: right away and again on a slow backoff, as long as the order is not paid.
    const verify = (slot: string) => {
      if (paymentId) void confirmOnce(token, paymentId, slot).then(confirmed)
    }

    pollNow.current = () => {
      seen = null
      attempts = 0
      failures = 0
      done = false
      setView({ kind: 'loading', slow: false })
      window.clearTimeout(timer)
      void poll()
      verify(`manual-${Date.now()}`)
    }

    const slowTimer = window.setTimeout(() => setView((current) => (current.kind === 'loading' ? { kind: 'loading', slow: true } : current)), 6_000)

    void poll()
    if (paymentId) {
      verify('0')
      CONFIRM_RETRY_MS.forEach((ms, index) => confirmTimers.push(window.setTimeout(() => !stopped && !done && verify(String(index + 1)), ms)))
    }

    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(slowTimer)
      confirmTimers.forEach(window.clearTimeout)
    }
  }, [token, paymentId, hint])

  // The Meta Pixel starts only now: the URL was cleaned at render time, and only a paid order counts as a purchase.
  // The event carries the order total as its value (in ARS) when the backend sent one, and nothing else about the
  // order or the buyer: no token, no name, no email, no phone.
  useEffect(() => {
    if (!paidOrder || isPurchaseTracked()) return
    if (startMetaPixel()) {
      const value = purchaseValue(paidOrder.total)
      trackMetaPixel('Purchase', { currency: 'ARS', content_type: 'product', content_category: 'pack-fichas', ...(value === null ? {} : { value }) })
    }
    markPurchaseTracked()
  }, [paidOrder])

  const retry = useCallback(() => pollNow.current(), [])

  return (
    <PackShell title="Gracias por tu compra">
      {view.kind === 'loading' && <Loading slow={view.slow} />}
      {view.kind === 'paid' && token && <Paid order={view.order} token={token} />}
      {view.kind === 'waiting' && <Waiting cash={cash} delayed={view.delayed} onRetry={retry} />}
      {view.kind === 'failed' && <Failed edition={edition} onCheck={retry} />}
      {view.kind === 'review' && <Review />}
      {view.kind === 'stalled' && <Stalled onCheck={retry} />}
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

/** "Escribinos": WhatsApp (green) or whatever contact the Pack publishes (a mailto: link looks like a plain button). */
function ContactButton({ className }: { className?: string }) {
  return (
    <ContactLink className={linkButton(contact.external ? 'whatsapp' : 'secondary', className)}>
      {contact.external && <MessageCircle className="h-5 w-5" aria-hidden />}
      {contact.label}
    </ContactLink>
  )
}

/**
 * The payment did not come through (yet). Deliberately says nothing about whether money left the buyer's account: a
 * rejected first attempt can be followed by an approved retry in the same checkout, and the file list appears here
 * on its own the moment the order turns PAID.
 */
function Failed({ edition, onCheck }: { edition: Edition | null; onCheck: () => void }) {
  // The landings are static pages outside the app's router, hence a plain link. Without a known edition: the generic page.
  const retryHref = edition ? `/pack/${edition}#comprar` : '/material-digital'
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={CircleAlert} title="Todavía no pudimos confirmar tu pago">
        <p>Puede que el pago no se haya completado, o que todavía no nos haya llegado el aviso.</p>
      </StateHero>
      <Card>
        <ul className="space-y-4 text-slate-600">
          <li className="leading-relaxed">
            <strong className="text-slate-900">Si ya pagaste</strong> (también si lo lograste en un segundo intento), quedate en esta página o esperá el email: tus
            archivos aparecen acá apenas el pago se acredite.
          </li>
          <li className="leading-relaxed">
            <strong className="text-slate-900">Si no llegaste a pagar</strong>, podés intentarlo de nuevo cuando quieras.
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={retryHref} className={linkButton('primary', 'w-full sm:w-auto')}>
            Volver a intentar
          </a>
          <button type="button" onClick={onCheck} className={linkButton('secondary', 'w-full sm:w-auto')}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Revisar de nuevo
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Seguimos consultando durante unos minutos. ¿Algo no cierra? <ContactLink />.
        </p>
      </Card>
    </div>
  )
}

/** Mercado Pago approved the payment, but the amount or currency did not match the order: it is held for a manual check. */
function Review() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={ShieldAlert} title="Recibimos tu pago y lo estamos revisando">
        <p>
          Mercado Pago nos avisó que tu pago fue aprobado, pero hace falta una revisión manual antes de entregarte los archivos. No se perdió nada: ya le avisamos a
          TIAM.
        </p>
      </StateHero>
      <Card>
        <p className="leading-relaxed text-slate-600">
          <strong className="text-slate-900">Si está todo bien, te escribimos al email que dejaste.</strong> Si preferís no esperar, escribinos y lo revisamos.
        </p>
        <div className="mt-4 flex">
          <ContactButton className="w-full sm:w-auto" />
        </div>
        <p className="mt-4 text-sm text-slate-600">Esta página se actualiza sola durante un rato: si lo aprobamos mientras está abierta, vas a ver tus archivos acá. Si la cerrás, igual te escribimos.</p>
      </Card>
    </div>
  )
}

/** The order is still not paid after a long time, or in a state this page does not know: say what happens next, and offer the contact. */
function Stalled({ onCheck }: { onCheck: () => void }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <StateHero tone="orange" icon={Clock} title="Todavía no tenemos novedades de tu pago">
        <p>No hace falta que dejes esta página abierta: apenas se acredite el pago te llega un email con tus archivos.</p>
      </StateHero>
      <Card>
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden />
          <p className="leading-relaxed text-slate-600">
            Los pagos con tarjeta suelen acreditarse en minutos, y los de efectivo o transferencia pueden tardar uno o dos días hábiles. Si pasó más de eso y no
            recibiste nada, escribinos y lo resolvemos.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <ContactButton className="w-full sm:w-auto" />
          <button type="button" onClick={onCheck} className={linkButton('secondary', 'w-full sm:w-auto')}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Revisar de nuevo
          </button>
        </div>
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
