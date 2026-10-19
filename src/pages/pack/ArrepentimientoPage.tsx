import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { CircleCheck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, PackShell, StateHero } from './PackShell'
import { ContactLink } from './ContactLink'
import { sendRegret } from './packClient'
import type { RegretReceipt } from './packTypes'

/**
 * /arrepentimiento: the "botón de arrepentimiento" the landings link from their footer (VITE_PACK_REGRET_URL).
 *
 * Argentine distance-selling rules (Res. 424/2020 of the Secretaría de Comercio Interior, Ley 24.240 art. 34)
 * require an easy way to revoke a purchase. PENDING LEGAL REVIEW: the wording of this page, the promise it makes
 * and how it applies to digital content already downloaded must be confirmed with a lawyer before launch
 * (see Proyecto Digitales/pack/cobro-diseno.md, section 2.8).
 *
 * The form is deliberately short and in one step. Nothing goes into the URL. The backend stores the request and
 * notifies the owner; the refund itself is made by hand from Mercado Pago, and the refund webhook then revokes the
 * access.
 *
 * The constancia is on screen: the backend answers with a reference (ARR-000012) and the moment it received the
 * request, and the page shows both. That is the buyer's proof, because the email copy is not guaranteed: it is sent only
 * if the address matches a purchase, and it does not repeat what was typed in the form (nobody can use this form to
 * make TIAM send arbitrary text to someone else's inbox).
 */

/** "14 de octubre de 2026, 12:30": the moment the request was received, always in Argentina time whatever the device says. */
function argentinaDateTime(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

const schema = z.object({
  fullName: z.string().trim().min(2, 'Escribí tu nombre y apellido').max(255),
  email: z.string().trim().min(1, 'Escribí tu email').email('Revisá el email: no parece válido').max(254),
  orderRef: z.string().trim().max(100, 'Es demasiado largo').optional(),
  reason: z.string().trim().max(1000, 'Escribí hasta 1000 caracteres').optional(),
})

type FormData = z.infer<typeof schema>

export function ArrepentimientoPage() {
  const [receipt, setReceipt] = useState<RegretReceipt | null>(null)
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setFailed(false)
    try {
      const result = await sendRegret({
        fullName: data.fullName,
        email: data.email,
        orderRef: data.orderRef || undefined,
        reason: data.reason || undefined,
      })
      // The request is in. If the answer came without the constancia (it should not), the page still says so.
      setReceipt(result?.reference ? result : null)
      setSent(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <PackShell title="Botón de arrepentimiento" indexable>
      {sent ? (
        <div className="space-y-6">
          <StateHero tone="green" icon={CircleCheck} title="Recibimos tu solicitud">
            <p>Guardá el número de abajo: es tu comprobante.</p>
          </StateHero>
          {receipt && (
            <Card className="border-t-4 border-t-tiam-green text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Constancia de arrepentimiento</p>
              <p className="mt-2 break-words text-3xl font-bold tracking-wide text-slate-900 sm:text-4xl" aria-label={`Número de constancia ${receipt.reference}`}>
                {receipt.reference}
              </p>
              {argentinaDateTime(receipt.receivedAt) && (
                <p className="mt-3 text-slate-600">
                  Recibida el <strong className="text-slate-900">{argentinaDateTime(receipt.receivedAt)}</strong> (hora de Argentina)
                </p>
              )}
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Si ese email tiene una compra, te mandamos una copia a tu casilla. Si no la ves en unos minutos, mirá en spam o promociones. Con este número y esta fecha
                tenés tu constancia, llegue o no el email.
              </p>
            </Card>
          )}
          <Card>
            <h2 className="text-lg font-bold text-slate-900">Qué sigue</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
              <li>Revisamos tu solicitud y te respondemos al email que dejaste.</li>
              <li>Si corresponde, te devolvemos el pago por el mismo medio con el que pagaste.</li>
              <li>Cuando se devuelve el pago, el acceso a los archivos deja de funcionar.</li>
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              ¿Alguna duda? <ContactLink /> y mencioná tu número de constancia.
            </p>
          </Card>
          <div className="text-center">
            <Link to="/" className="inline-flex min-h-11 items-center font-medium text-tiam-blue underline underline-offset-2">
              Volver al inicio
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <StateHero tone="blue" icon={Undo2} title="Botón de arrepentimiento">
            <p>
              Si compraste en TIAM y querés revocar tu compra, completá este formulario. Al enviarlo te mostramos una constancia con un número de referencia y revisamos tu solicitud.
            </p>
          </StateHero>

          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
              <Input
                id="arrep-nombre"
                label="Nombre y apellido"
                autoComplete="name"
                className="min-h-12 text-base"
                error={errors.fullName?.message}
                {...register('fullName')}
              />
              <Input
                id="arrep-email"
                type="email"
                label="Email con el que compraste"
                placeholder="nombre@correo.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                className="min-h-12 text-base"
                error={errors.email?.message}
                {...register('email')}
              />
              <div>
                <Input
                  id="arrep-pedido"
                  label="Número de pedido (opcional)"
                  autoComplete="off"
                  aria-describedby="arrep-pedido-ayuda"
                  className="min-h-12 text-base"
                  error={errors.orderRef?.message}
                  {...register('orderRef')}
                />
                <p id="arrep-pedido-ayuda" className="mt-1 text-sm text-slate-600">
                  Si lo tenés a mano, está en el email de tu compra o en el comprobante de Mercado Pago. Si no, no pasa nada: te encontramos por el email.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="arrep-motivo" className="text-sm font-medium text-slate-700">
                  Contanos el motivo (opcional)
                </label>
                <textarea
                  id="arrep-motivo"
                  rows={4}
                  maxLength={1000}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-tiam-blue focus:outline-none focus:ring-1 focus:ring-tiam-blue"
                  {...register('reason')}
                />
                {errors.reason?.message && <p className="text-xs text-red-600">{errors.reason.message}</p>}
              </div>

              {failed && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
                  No pudimos enviar tu solicitud. Probá de nuevo en un momento; si el problema sigue, <ContactLink className="underline" />.
                </p>
              )}

              <Button type="submit" size="lg" loading={isSubmitting} className="min-h-[52px] w-full">
                Enviar mi solicitud
              </Button>
              <p className="text-center text-sm text-slate-600">
                Usamos estos datos solo para atender tu solicitud. Más información en la{' '}
                <Link to="/privacy" className="font-medium text-tiam-blue underline underline-offset-2">
                  política de privacidad
                </Link>
                .
              </p>
            </form>
          </Card>
        </div>
      )}
    </PackShell>
  )
}
