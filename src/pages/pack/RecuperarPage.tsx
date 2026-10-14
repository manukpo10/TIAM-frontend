import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Mail, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, PackShell, StateHero } from './PackShell'
import { ContactLink } from './ContactLink'
import { resendAccess } from './packClient'
import { PackApiError } from './packTypes'

/**
 * /pack/recuperar: "send me my access again". The answer is the same whatever the email (an outsider must not
 * be able to find out who bought), so the confirmation below never says whether an order exists.
 *
 * The only different outcome is a transport failure (no connection, or the server erroring): then nothing was
 * decided about the email and the buyer is told to try again.
 */

const schema = z.object({
  email: z.string().trim().min(1, 'Escribí tu email').email('Revisá el email: no parece válido').max(254),
})

type FormData = z.infer<typeof schema>

// Gives the buyer time to find the email before asking for another (the backend also limits requests).
const COOLDOWN_SECONDS = 30

export function RecuperarPage() {
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Counts the cooldown down one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  async function onSubmit(data: FormData) {
    setFailed(false)
    try {
      await resendAccess(data.email)
    } catch (error) {
      // 4xx answers (including "too many requests") are the backend deciding something about this email:
      // they get the same confirmation as a success. Only "could not reach it" is reported.
      if (error instanceof PackApiError && (error.kind === 'network' || error.kind === 'server')) {
        setFailed(true)
        return
      }
    }
    setSent(true)
    setCooldown(COOLDOWN_SECONDS)
  }

  function again() {
    reset()
    setSent(false)
  }

  return (
    <PackShell title="Recuperar mi acceso">
      {sent ? (
        <div className="space-y-6">
          <StateHero tone="green" icon={MailCheck} title="Revisá tu correo">
            <p>Si hay un pedido con ese email, te mandamos el acceso a tus archivos. Puede tardar unos minutos.</p>
          </StateHero>
          <Card>
            <ul className="list-disc space-y-2 pl-5 text-slate-600">
              <li>Mirá también en la carpeta de spam o de promociones.</li>
              <li>Usá el mismo email con el que hiciste la compra.</li>
              <li>
                Si te equivocaste de email, podés{' '}
                <button type="button" onClick={again} className="font-medium text-tiam-blue underline underline-offset-2">
                  probar con otro
                </button>
                .
              </li>
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              ¿Sigue sin llegar? <ContactLink />.
            </p>
          </Card>
        </div>
      ) : (
        <div className="space-y-8">
          <StateHero tone="blue" icon={Mail} title="Recuperá el acceso a tus archivos">
            <p>Escribí el email con el que compraste y te mandamos de nuevo el link para descargar.</p>
          </StateHero>

          <Card>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <Input
                id="recuperar-email"
                type="email"
                label="Tu email"
                placeholder="nombre@correo.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                className="min-h-12 text-base"
                error={errors.email?.message}
                {...register('email')}
              />
              {failed && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
                  No pudimos enviar tu pedido ahora. Probá de nuevo en un momento.
                </p>
              )}
              <Button type="submit" size="lg" loading={isSubmitting} disabled={cooldown > 0} className="min-h-[52px] w-full">
                {cooldown > 0 ? `Esperá ${cooldown} s para pedirlo otra vez` : 'Mandame el acceso'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-600">
              Si todavía no pagaste, <Link to="/material-digital" className="font-medium text-tiam-blue underline underline-offset-2">mirá los packs</Link>.
            </p>
          </Card>
        </div>
      )}
    </PackShell>
  )
}
