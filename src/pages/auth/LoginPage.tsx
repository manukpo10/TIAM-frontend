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
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})

type FormData = z.infer<typeof schema>

interface LoginResponse {
  token: string
  user: User
  subscription: Subscription
}

export function LoginPage() {
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
      const res = await api.post<LoginResponse>('/auth/login', data)
      setAuth(res.user, res.subscription, res.token)
      navigate('/library')
    } catch {
      setError('root', { message: 'Email o contraseña incorrectos' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-slate-500">Accedé a tu biblioteca de ejercicios</p>
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

      <div className="flex flex-col gap-1">
        <Input
          id="password"
          type="password"
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-tiam-blue hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      {errors.root && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.root.message}</p>
      )}

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        Entrar
      </Button>

      <p className="text-center text-sm text-slate-500">
        ¿No tenés cuenta?{' '}
        <Link to="/register" className="font-medium text-tiam-blue hover:underline">
          Probá gratis 7 días
        </Link>
      </p>
    </form>
  )
}
