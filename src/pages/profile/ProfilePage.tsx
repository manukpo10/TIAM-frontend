import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CreditCard, LogOut, Sparkles, User as UserIcon } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Subscription, User } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

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

// ─── Inline success message ──────────────────────────────────────────────────


// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().min(2, 'Ingresá tu nombre completo'),
  specialty: z.string().optional(),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
    newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

// ─── Card: Personal information ──────────────────────────────────────────────

function PersonalInfoCard({ user }: { user: User }) {
  const { setUser } = useAuthStore()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName,
      specialty: user.specialty ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ProfileFormData) => api.put<User>('/profile', data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      reset({ fullName: updatedUser.fullName, specialty: updatedUser.specialty ?? '' })
      toast.success('Perfil actualizado')
    },
    onError: () => {
      toast.error('No se pudieron guardar los cambios')
    },
  })

  function onSubmit(data: ProfileFormData) {
    mutation.mutate(data)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Información personal</h2>
      <p className="text-sm text-slate-500 mb-6">Actualizá tu nombre y especialidad.</p>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-2xl font-bold text-white">
          {getInitials(user.fullName)}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{user.fullName}</p>
          {user.specialty && <p className="text-sm text-slate-500">{user.specialty}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          id="fullName"
          label="Nombre completo"
          placeholder="María García"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          id="specialty"
          label="Especialidad"
          placeholder="Ej: Estimulación cognitiva, Fonoaudióloga..."
          error={errors.specialty?.message}
          {...register('specialty')}
        />

        {mutation.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {(mutation.error as { message?: string })?.message ?? 'Error al guardar los cambios'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={!isDirty}
          >
            Guardar cambios
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
            disabled={!isDirty}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Card: Account ───────────────────────────────────────────────────────────

function AccountCard({ user }: { user: User }) {
  const roleLabel = user.role === 'ADMIN' ? 'Administrador' : 'Profesional'
  const roleBgClass = user.role === 'ADMIN' ? 'bg-tiam-blue/10 text-tiam-blue-dark' : 'bg-slate-100 text-slate-600'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Cuenta</h2>
      <p className="text-sm text-slate-500 mb-6">Información de tu cuenta.</p>

      <div className="flex flex-col gap-4">
        {/* Email */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-500">{user.email}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">El email no se puede cambiar por ahora.</p>
        </div>

        {/* Role */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
          <Badge className={roleBgClass}>{roleLabel}</Badge>
        </div>
      </div>
    </div>
  )
}

// ─── Card: Security ──────────────────────────────────────────────────────────

function SecurityCard() {
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const mutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      api.post<{ success: boolean }>('/profile/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      reset()
      toast.success('Contraseña actualizada')
    },
    onError: () => {
      toast.error('No se pudo cambiar la contraseña')
    },
  })

  function onSubmit(data: PasswordFormData) {
    mutation.mutate(data)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Seguridad</h2>
      <p className="text-sm text-slate-500 mb-6">Cambiá tu contraseña de acceso.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          id="currentPassword"
          type="password"
          label="Contraseña actual"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <Input
          id="newPassword"
          type="password"
          label="Nueva contraseña"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <Input
          id="confirmPassword"
          type="password"
          label="Confirmar nueva contraseña"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {mutation.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {(mutation.error as { message?: string })?.message ?? 'Error al cambiar la contraseña'}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" loading={mutation.isPending}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Card: Subscription summary ──────────────────────────────────────────────

function SubscriptionCard() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<Subscription>('/subscription'),
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Suscripción</h2>
      <p className="text-sm text-slate-500 mb-6">Estado actual de tu plan.</p>

      {isLoading && (
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      )}

      {subscription && (
        <div className="space-y-4">
          {subscription.status === 'TRIAL' && subscription.trialEndsAt && (
            <div className="flex items-start gap-3 rounded-xl bg-tiam-blue/5 border border-tiam-blue/20 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tiam-blue/10">
                <Sparkles className="h-4 w-4 text-tiam-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Período de prueba</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {daysRemaining(subscription.trialEndsAt)} días restantes — hasta el{' '}
                  {formatDate(subscription.trialEndsAt)}
                </p>
              </div>
            </div>
          )}

          {subscription.status === 'ACTIVE' && (
            <div className="flex items-start gap-3 rounded-xl bg-tiam-green/10 border border-tiam-green p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tiam-green/10">
                <Check className="h-4 w-4 text-tiam-green" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Plan activo</p>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    Renovación el {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>
            </div>
          )}

          {(subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
              <UserIcon className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Sin acceso activo</p>
                <p className="text-sm text-slate-500 mt-0.5">Tu plan venció o fue cancelado.</p>
              </div>
            </div>
          )}

          <Link to="/subscription">
            <Button variant="secondary" className="w-full sm:w-auto mt-1">
              <CreditCard className="h-4 w-4" />
              Gestionar suscripción
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  // Redirect if somehow rendered without auth (ProtectedRoute handles it, but defensive)
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
        <p className="mt-1 text-slate-500">Gestioná tu información y tu cuenta.</p>
      </div>

      {/* Cards — masonry-style columns so the width is used deliberately and the
          cards pack tightly instead of leaving row gaps under the shorter ones. */}
      <div className="gap-6 columns-1 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <PersonalInfoCard user={user} />
        <AccountCard user={user} />
        <SecurityCard />
        <SubscriptionCard />

        {/* Logout */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Sesión</h2>
          <p className="text-sm text-slate-500 mb-4">Cerrá la sesión en este dispositivo.</p>
          <Button variant="danger" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
