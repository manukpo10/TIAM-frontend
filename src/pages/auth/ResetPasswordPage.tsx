import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

const schema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      toast.success('Contraseña restablecida')
      navigate('/login')
    } catch {
      toast.error('No se pudo restablecer la contraseña')
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg
            className="h-7 w-7 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-900">Enlace no válido</h2>
          <p className="mt-2 text-sm text-slate-500">El enlace no es válido o expiró.</p>
        </div>

        <Link
          to="/forgot-password"
          className="mt-2 text-sm font-medium text-tiam-blue hover:underline"
        >
          Solicitar un nuevo enlace
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Nueva contraseña</h2>
        <p className="mt-1 text-sm text-slate-500">Elegí una contraseña nueva para tu cuenta.</p>
      </div>

      <Input
        id="password"
        type="password"
        label="Nueva contraseña"
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        id="confirmPassword"
        type="password"
        label="Confirmá tu contraseña"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        Restablecer contraseña
      </Button>
    </form>
  )
}
