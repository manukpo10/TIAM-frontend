import { Link, useSearchParams } from 'react-router-dom'
import {
  MessageCircle, CheckCircle2, Clock, XCircle, ArrowRight, Smartphone, CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

// TIAM's WhatsApp business number in international format (no "+"), for wa.me links.
// Argentine mobiles carry the "9" right after the "54" country code.
const WHATSAPP_NUMBER = '5492214817297'
const ACTIVATION_TEXT = 'Quiero empezar mi Desafío 30 días 💙'
const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(ACTIVATION_TEXT)}`

type Phase = 'ready' | 'pending' | 'error'

/**
 * Where the buyer lands after Mercado Pago (the checkout's back_url). We read the
 * payment outcome straight from MP's `status` query param — we intentionally do NOT
 * call our own backend here, so there is no purchase-status endpoint to enumerate.
 * The real gate is the WhatsApp phone-match on the backend: an unpaid visitor who
 * reaches this page still can't get exercises. And if a buyer taps "activate" in the
 * brief window before our payment webhook lands, the WhatsApp reply itself tells them
 * the payment is still being confirmed.
 */
export function DesafioExitoPage() {
  const [params] = useSearchParams()
  const mpStatus = params.get('status') ?? params.get('collection_status')

  const phase: Phase =
    mpStatus === 'rejected' || mpStatus === 'failure' || mpStatus === 'cancelled'
      ? 'error'
      : mpStatus === 'pending' || mpStatus === 'in_process'
        ? 'pending'
        : 'ready'

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />
      <main className="flex-1 bg-gradient-to-b from-tiam-blue/5 to-white">
        <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
          {phase === 'ready' && <Ready />}
          {phase === 'pending' && <Pending />}
          {phase === 'error' && <ErrorState />}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

function WhatsAppButton({ label }: { label: string }) {
  return (
    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="block">
      <Button
        size="lg"
        className="w-full min-h-[52px] bg-[#25D366] text-white text-base hover:bg-[#1ebe5b]"
      >
        <MessageCircle className="h-5 w-5" />
        {label}
      </Button>
    </a>
  )
}

function Ready() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tiam-green/10">
        <CheckCircle2 className="h-9 w-9 text-tiam-green" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">¡Pago confirmado! 🎉</h1>
      <p className="mt-3 text-lg text-slate-600 leading-relaxed">
        Ya sos parte del <strong className="text-slate-800">Desafío 30 días</strong>. Falta
        un solo paso para empezar.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-100 border-t-4 border-t-tiam-green bg-white p-6 shadow-sm text-left sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-tiam-green">Último paso</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Activá tu desafío por WhatsApp</h2>
        <p className="mt-3 text-slate-600 leading-relaxed">
          Tocá el botón: se abre WhatsApp con un mensaje ya escrito. Enviálo y te llega
          tu <strong>primer ejercicio</strong> al instante.
        </p>

        <div className="mt-6">
          <WhatsAppButton label="Activar por WhatsApp" />
        </div>

        <div className="mt-5 rounded-2xl bg-tiam-blue/5 p-4">
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-tiam-blue" />
            <span>
              <strong className="text-slate-800">Importante:</strong> activá desde el WhatsApp
              que cargaste en la compra.
            </span>
          </p>
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-slate-500">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-tiam-orange" />
          <span>
            Después, cada día escribinos <strong>“desafío”</strong> y te mandamos el ejercicio nuevo.
          </span>
        </p>
      </div>
    </div>
  )
}

function Pending() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tiam-orange/10">
        <Clock className="h-9 w-9 text-tiam-orange" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">Tu pago está en proceso</h1>
      <p className="mt-3 text-lg text-slate-600 leading-relaxed">
        Algunos medios (efectivo, transferencia) tardan un rato en acreditarse. Cuando
        se confirme, activá tu desafío por WhatsApp:
      </p>

      <div className="mx-auto mt-6 max-w-xs">
        <WhatsAppButton label="Activar por WhatsApp" />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Si te avisamos que el pago sigue pendiente, esperá unos minutos y volvé a escribirnos.
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <XCircle className="h-9 w-9 text-red-500" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900">El pago no se completó</h1>
      <p className="mt-3 text-lg text-slate-600 leading-relaxed">
        No se realizó ningún cobro. Podés intentarlo de nuevo cuando quieras.
      </p>
      <Link to="/desafio-30-dias" className="mt-6 inline-block">
        <Button size="lg" variant="secondary" className="min-h-[48px]">
          Volver a intentar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  )
}
