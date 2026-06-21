import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import type { User, Subscription } from '@/types'

const schema = z.object({
  fullName: z.string().min(2, 'Ingresá tu nombre completo'),
  email: z.string().email('Email inválido'),
  specialty: z.string().min(1, 'Indicá tu especialidad'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

interface RegisterResponse {
  token: string
  user: User
  subscription: Subscription
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      const res = await api.post<RegisterResponse>('/auth/register', {
        fullName: data.fullName,
        email: data.email,
        specialty: data.specialty,
        password: data.password,
      })
      setAuth(res.user, res.subscription, res.token)
      navigate('/library')
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setError('root', { message: apiErr.message ?? 'Error al registrarse' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Crear cuenta</h2>
        <p className="mt-1 text-sm text-slate-500">7 días gratis, sin tarjeta de crédito</p>
      </div>

      <Input
        id="fullName"
        label="Nombre y apellido"
        placeholder="María García"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />

      <Input
        id="email"
        type="email"
        label="Email profesional"
        placeholder="tu@email.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        id="specialty"
        label="Especialidad"
        placeholder="Ej: Terapeuta Ocupacional, Fonoaudióloga, AT..."
        error={errors.specialty?.message}
        {...register('specialty')}
      />

      <Input
        id="password"
        type="password"
        label="Contraseña"
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

      {errors.root && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.root.message}</p>
      )}

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        Empezar prueba gratis
      </Button>

      <p className="text-center text-sm text-slate-500">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-tiam-blue hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </form>
  )
}
