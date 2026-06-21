import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Clock, CreditCard, Lock, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Subscription } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatPrice = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function daysRemaining(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-tiam-green" />
      <span className="text-sm text-slate-600">{text}</span>
    </li>
  )
}

type BillingPeriod = 'monthly' | 'annual'

// ─── Page ───────────────────────────────────────────────────────────────────

export function SubscriptionPage() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  const { toast } = useToast()
  const { hasActiveAccess, subscription: storeSubscription } = useAuthStore()

  function handleSubscribe(plan: string) {
    toast.info('Próximamente: integración con Mercado Pago para el plan ' + plan)
  }

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<Subscription>('/subscription'),
  })

  // Prefer query data for display; fall back to store so the page is useful even before the query resolves
  const sub = subscription ?? storeSubscription ?? null
  const accessActive = hasActiveAccess()
  const isOnTrial = sub?.status === 'TRIAL' && accessActive
  const isActive = sub?.status === 'ACTIVE'
  const isBlocked = !accessActive
  const trialDays = sub?.trialEndsAt ? daysRemaining(sub.trialEndsAt) : 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <CreditCard className="h-6 w-6 text-tiam-blue" />
          <h1 className="text-2xl font-bold text-slate-900">Suscripción</h1>
        </div>
        <p className="text-slate-500 ml-9">Elegí el plan que mejor se adapte a tu práctica</p>
      </div>

      {/* Current subscription status banner — mutually exclusive */}
      {isBlocked && (
        <div className="mb-8 flex items-start gap-4 rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            {sub?.status === 'CANCELLED' ? (
              <Lock className="h-5 w-5 text-amber-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div>
            <p className="font-semibold text-amber-900">
              {sub?.status === 'CANCELLED'
                ? 'Tu suscripción está inactiva'
                : 'Tu prueba gratuita terminó'}
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Suscribite para recuperar el acceso a tu biblioteca, tus sesiones y tus pacientes.
            </p>
          </div>
        </div>
      )}

      {!isBlocked && isOnTrial && sub?.trialEndsAt && (
        <div className="mb-8 flex items-start gap-4 rounded-2xl bg-tiam-blue/5 border border-tiam-blue/20 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tiam-blue/10">
            <Sparkles className="h-5 w-5 text-tiam-blue" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Estás en período de prueba</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Te {trialDays === 1 ? 'queda' : 'quedan'}{' '}
              <span className="font-medium text-tiam-blue">
                {trialDays} {trialDays === 1 ? 'día' : 'días'}
              </span>{' '}
              hasta el {formatDate(sub.trialEndsAt)}.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Suscribite para no perder el acceso a tu biblioteca y pacientes.
            </p>
          </div>
        </div>
      )}

      {!isBlocked && isActive && sub?.currentPeriodEnd && (
        <div className="mb-8 flex items-start gap-4 rounded-2xl bg-tiam-green/10 border border-tiam-green p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tiam-green/10">
            <Check className="h-5 w-5 text-tiam-green" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Tu suscripción está activa</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Renovación el {formatDate(sub.currentPeriodEnd)}.
            </p>
          </div>
        </div>
      )}

      {/* Billing period toggle */}
      <div className="mb-8 flex justify-center">
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          <button
            onClick={() => setPeriod('monthly')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              period === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
              period === 'annual'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Anual
            <Badge className="bg-tiam-green/10 text-tiam-green text-[10px] px-1.5 py-0">
              Ahorrá 2 meses
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Free trial card */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Prueba gratuita
              </p>
            </div>
            <p className="mt-4 text-4xl font-bold text-slate-900">Gratis</p>
            <p className="mt-1 text-sm text-slate-500">7 días de acceso completo</p>
          </div>

          <ul className="mb-6 flex flex-1 flex-col gap-3">
            <FeatureItem text="Acceso completo a todas las funciones" />
            <FeatureItem text="Sin tarjeta de crédito requerida" />
            <FeatureItem text="Por tiempo limitado" />
          </ul>

          <Button variant="secondary" disabled={isOnTrial} className="w-full">
            {isOnTrial ? 'Plan actual' : 'Comenzar prueba'}
          </Button>
        </div>

        {/* Professional — featured */}
        <div className="relative flex flex-col rounded-2xl border-2 border-tiam-blue bg-white p-6 shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-tiam-blue text-white px-3 py-0.5 text-xs font-semibold shadow-sm">
              Recomendado
            </Badge>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-tiam-blue">
              Profesional
            </p>
            {period === 'monthly' ? (
              <>
                <p className="mt-4 text-4xl font-bold text-slate-900">
                  {formatPrice(20000)}
                </p>
                <p className="mt-1 text-sm text-slate-500">por mes</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-4xl font-bold text-slate-900">
                  {formatPrice(200000)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  por año{' '}
                  <span className="text-slate-400">(≈ {formatPrice(16666)}/mes)</span>
                </p>
              </>
            )}
          </div>

          <ul className="mb-6 flex flex-1 flex-col gap-3">
            <FeatureItem text="Biblioteca completa de ejercicios TIAM" />
            <FeatureItem text="Ejercicios propios ilimitados" />
            <FeatureItem text="Pacientes ilimitados" />
            <FeatureItem text="Armado de sesiones e impresión de fichas" />
            <FeatureItem text="Seguimiento de evolución por paciente" />
          </ul>

          <Button
            onClick={() =>
              handleSubscribe(
                period === 'monthly' ? 'Profesional Mensual' : 'Profesional Anual',
              )
            }
            className="w-full"
          >
            Suscribirme
          </Button>
        </div>

        {/* Institutional */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-tiam-orange">
              Institucional
            </p>
            <p className="mt-4 text-4xl font-bold text-slate-900">A consultar</p>
            <p className="mt-1 text-sm text-slate-500">
              Para geriátricos, centros de día e instituciones
            </p>
          </div>

          <ul className="mb-6 flex flex-1 flex-col gap-3">
            <FeatureItem text="Todo lo del plan Profesional" />
            <FeatureItem text="Múltiples profesionales" />
            <FeatureItem text="Panel de administración institucional" />
            <FeatureItem text="Facturación centralizada" />
            <FeatureItem text="Soporte prioritario" />
          </ul>

          <Button
            variant="secondary"
            onClick={() => toast.info('Próximamente: contacto institucional')}
            className="w-full"
          >
            Contactanos
          </Button>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-xs text-slate-400">
        Los pagos se procesan de forma segura con Mercado Pago. Podés cancelar cuando quieras.
      </p>
    </div>
  )
}
