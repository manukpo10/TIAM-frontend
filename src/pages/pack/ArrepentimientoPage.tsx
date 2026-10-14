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

/**
 * /arrepentimiento: the "botón de arrepentimiento" the landings link from their footer (VITE_PACK_REGRET_URL).
 *
 * Argentine distance-selling rules (Res. 424/2020 of the Secretaría de Comercio Interior, Ley 24.240 art. 34)
 * require an easy way to revoke a purchase. PENDING LEGAL REVIEW: the wording of this page, the promise it makes
 * and how it applies to digital content already downloaded must be confirmed with a lawyer before launch
 * (see Proyecto Digitales/pack/cobro-diseno.md, section 2.8).
 *
 * The form is deliberately short and in one step. Nothing goes into the URL. The backend stores the request,
 * emails the buyer a receipt and notifies the owner; the refund itself is made by hand from Mercado Pago, and the
 * refund webhook then revokes the access.
 */

const schema = z.object({
  fullName: z.string().trim().min(2, 'Escribí tu nombre y apellido').max(255),
  email: z.string().trim().min(1, 'Escribí tu email').email('Revisá el email: no parece válido').max(254),
  orderRef: z.string().trim().max(100, 'Es demasiado largo').optional(),
  reason: z.string().trim().max(1000, 'Escribí hasta 1000 caracteres').optional(),
})

type FormData = z.infer<typeof schema>

export function ArrepentimientoPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setFailed(false)
    try {
      await sendRegret({
        fullName: data.fullName,
        email: data.email,
        orderRef: data.orderRef || undefined,
        reason: data.reason || undefined,
      })
      setSentTo(data.email)
    } catch {
      setFailed(true)
    }
  }

  return (
    <PackShell title="Botón de arrepentimiento" indexable>
      {sentTo ? (
        <div className="space-y-6">
          <StateHero tone="green" icon={CircleCheck} title="Recibimos tu solicitud">
            <p>
              Te enviamos una constancia a <strong className="break-words text-slate-900">{sentTo}</strong>. Si en unos minutos no la ves, mirá en spam o promociones.
            </p>
          </StateHero>
          <Card>
            <h2 className="text-lg font-bold text-slate-900">Qué sigue</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
              <li>Revisamos tu solicitud y te respondemos a ese email.</li>
              <li>Si corresponde, te devolvemos el pago por el mismo medio con el que pagaste.</li>
              <li>Cuando se devuelve el pago, el acceso a los archivos deja de funcionar.</li>
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              ¿Alguna duda? <ContactLink />.
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
              Si compraste en TIAM y querés revocar tu compra, completá este formulario. Te enviamos una constancia por email y revisamos tu solicitud.
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
