import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      await api.post('/auth/forgot-password', { email: data.email })
    } catch {
      // Security: never reveal whether the email exists — always show success
    }
    toast.success('Enlace enviado')
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tiam-green/10">
          <MailCheck className="h-7 w-7 text-tiam-green" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Revisá tu correo</h2>
          <p className="mt-2 text-sm text-slate-500">
            Si existe una cuenta con ese email, te enviamos un enlace para restablecer tu
            contraseña.
          </p>
        </div>

        <Link to="/login" className="mt-2 text-sm font-medium text-tiam-blue hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Recuperar contraseña</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <Input
        id="email"
        type="email"
        label="Email"
        placeholder="tu@email.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        Enviar enlace
      </Button>

      <p className="text-center text-sm text-slate-500">
        ¿Recordaste tu contraseña?{' '}
        <Link to="/login" className="font-medium text-tiam-blue hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
