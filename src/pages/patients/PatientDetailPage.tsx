import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Pencil, CalendarX, Plus, Home, Brain, Share2, Copy, X, CheckCircle2, BadgeCheck, Clock, TrendingUp, TrendingDown, Minus, BarChart2, CheckCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { Patient, PatientSession, HomeExerciseResult } from '@/types'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useSessionStore } from '@/store/session'
import { AREA_COLORS } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

// ─── helpers ────────────────────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function formatLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── home results helpers ─────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDateShortEs(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function countDistinctDays(results: HomeExerciseResult[]): number {
  const days = new Set(results.map(r => r.completedAt.slice(0, 10)))
  return days.size
}

function computeTrend(results: HomeExerciseResult[]): {
  direction: 'improving' | 'worsening' | 'stable'
  oldAvg: number
  newAvg: number
} {
  if (results.length < 2) return { direction: 'stable', oldAvg: 0, newAvg: 0 }
  // Sort ascending by date, split in half
  const sorted = [...results].sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const mid = Math.floor(sorted.length / 2)
  const older = sorted.slice(0, mid)
  const newer = sorted.slice(mid)
  const avg = (arr: HomeExerciseResult[]) => Math.round(arr.reduce((s, r) => s + r.moves, 0) / arr.length)
  const oldAvg = avg(older)
  const newAvg = avg(newer)
  const delta = oldAvg - newAvg // positive = improved (fewer moves)
  const direction = delta >= 2 ? 'improving' : delta <= -2 ? 'worsening' : 'stable'
  return { direction, oldAvg, newAvg }
}

// ─── HomeProgressPanel sub-components (hoisted, never defined inside render) ──

interface HomeProgressEmptyProps {
  firstName: string
  subscribed: boolean
}

function HomeProgressEmpty({ firstName, subscribed }: HomeProgressEmptyProps) {
  if (!subscribed) {
    return (
      <p className="text-sm text-slate-400 leading-relaxed">
        Cuando la familia de {firstName} active el servicio, vas a ver acá su progreso con los ejercicios.
      </p>
    )
  }
  return (
    <p className="text-sm text-slate-400 leading-relaxed">
      {firstName} todavía no completó ejercicios en casa.
    </p>
  )
}

interface TrendBadgeProps {
  direction: 'improving' | 'worsening' | 'stable'
  oldAvg: number
  newAvg: number
}

function TrendBadge({ direction, oldAvg, newAvg }: TrendBadgeProps) {
  if (direction === 'improving') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-tiam-green/30 bg-tiam-green/10 px-4 py-3">
        <TrendingUp className="h-4 w-4 shrink-0 text-tiam-green" aria-hidden="true" />
        <p className="text-sm font-medium text-tiam-green/90">
          Va mejorando: de {oldAvg} a {newAvg} intentos promedio en las últimas semanas.
        </p>
      </div>
    )
  }
  if (direction === 'worsening') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-tiam-orange/30 bg-tiam-orange/10 px-4 py-3">
        <TrendingDown className="h-4 w-4 shrink-0 text-tiam-orange" aria-hidden="true" />
        <p className="text-sm font-medium text-tiam-orange/90">
          Necesita más práctica: de {oldAvg} a {newAvg} intentos promedio en las últimas semanas.
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <Minus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">
        Se mantiene estable: {newAvg} intentos promedio en las últimas semanas.
      </p>
    </div>
  )
}

interface MovesSparklineProps {
  results: HomeExerciseResult[]
}

// Simple inline bar chart of moves over time (ascending by date). Lower = better.
function MovesSparkline({ results }: MovesSparklineProps) {
  const sorted = [...results].sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const maxMoves = Math.max(...sorted.map(r => r.moves), 1)
  return (
    <div className="flex items-end gap-1 h-8" role="img" aria-label="Gráfico de intentos por sesión">
      {sorted.map(r => {
        const heightPct = Math.round((r.moves / maxMoves) * 100)
        return (
          <div
            key={r.id}
            title={`${r.moves} intentos`}
            className="flex-1 rounded-sm bg-tiam-blue/30 min-w-[4px]"
            style={{ height: `${heightPct}%` }}
          />
        )
      })}
    </div>
  )
}

interface ResultRowProps {
  result: HomeExerciseResult
}

function ResultRow({ result }: ResultRowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 w-20 shrink-0 tabular-nums">
        {formatDateShortEs(result.completedAt)}
      </span>
      <span className="text-sm text-slate-700 flex-1 font-medium truncate">
        {result.exerciseTitle}
      </span>
      {result.completed && (
        <span className="flex items-center gap-1 text-xs font-semibold text-tiam-green shrink-0">
          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Completado
        </span>
      )}
      <span className="text-xs text-slate-500 tabular-nums shrink-0">
        {result.moves} int.
      </span>
      <span className="text-xs text-slate-400 tabular-nums shrink-0 w-10 text-right">
        {formatDuration(result.durationSeconds)}
      </span>
    </div>
  )
}

interface HomeProgressPanelProps {
  patient: Patient
}

function HomeProgressPanel({ patient }: HomeProgressPanelProps) {
  const firstName = patient.fullName.split(' ')[0]
  const subscribed = !!patient.homeSubscriptionActive

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['home-results', patient.id],
    queryFn: () => api.get<HomeExerciseResult[]>(`/patients/${patient.id}/home-results`),
    enabled: subscribed,
  })

  const trend = computeTrend(results)
  const distinctDays = countDistinctDays(results)
  const avgMoves = results.length
    ? Math.round(results.reduce((s, r) => s + r.moves, 0) / results.length)
    : 0
  const mostRecent = results[0]
  const displayResults = results.slice(0, 8)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10">
          <BarChart2 className="h-4 w-4 text-tiam-blue" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Progreso en casa</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Resultados de los ejercicios digitales completados por el paciente.
          </p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner className="h-5 w-5" />
        </div>
      )}

      {/* Not subscribed or no data yet */}
      {!isLoading && results.length === 0 && (
        <HomeProgressEmpty firstName={firstName} subscribed={subscribed} />
      )}

      {/* With data */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1">Completados</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{results.length}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1">Última actividad</p>
              <p className="text-sm font-semibold text-slate-900">
                {mostRecent ? formatDateShortEs(mostRecent.completedAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1">Días activa</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{distinctDays}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1">Prom. intentos</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{avgMoves}</p>
            </div>
          </div>

          {/* Sparkline */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1.5">
              Intentos por sesión <span className="font-normal">(menos es mejor)</span>
            </p>
            <MovesSparkline results={results} />
          </div>

          {/* Trend insight */}
          <TrendBadge
            direction={trend.direction}
            oldAvg={trend.oldAvg}
            newAvg={trend.newAvg}
          />

          {/* Results list */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Últimas sesiones
            </p>
            <div role="list" aria-label="Resultados de ejercicios en casa">
              {displayResults.map(r => (
                <ResultRow key={r.id} result={r} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface AreaDotsProps {
  slugs: string[]
}

function AreaDots({ slugs }: AreaDotsProps) {
  const unique = [...new Set(slugs)]
  return (
    <div className="flex flex-wrap gap-1.5">
      {unique.map(slug => {
        const color = AREA_COLORS[slug]
        if (!color) return null
        return (
          <span
            key={slug}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'transparent' }}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.bg}`} />
            <span className={color.text}>
              {slug
                .split('-')
                .map(w => w[0].toUpperCase() + w.slice(1))
                .join(' ')}
            </span>
          </span>
        )
      })}
    </div>
  )
}

interface SessionCardProps {
  session: PatientSession
}

function SessionCard({ session }: SessionCardProps) {
  const MAX_SHOWN = 3
  const shown = session.exercises.slice(0, MAX_SHOWN)
  const extra = session.exercises.length - MAX_SHOWN

  const allSlugs = session.exercises.flatMap(e => e.cognitiveAreaSlugs)

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition-all">
      {/* Header: date + status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-slate-700">
          {formatLong(session.scheduledDate)}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            session.status === 'COMPLETED'
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {session.status === 'COMPLETED' ? 'Completada' : 'Borrador'}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-900 mb-2">{session.title}</p>

      {/* Exercise chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {shown.map(ex => (
          <span
            key={ex.exerciseId}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-600 truncate max-w-[180px]"
            title={ex.title}
          >
            {ex.title}
          </span>
        ))}
        {extra > 0 && (
          <span className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-400">
            +{extra} más
          </span>
        )}
      </div>

      {/* Area dots */}
      <AreaDots slugs={allSlugs} />

      {/* Notes */}
      {session.notes && (
        <p className="mt-2 text-xs text-slate-400 italic line-clamp-1">{session.notes}</p>
      )}
    </div>
  )
}

// ─── Home exercise modal ─────────────────────────────────────────────────────

// Static list of exercise types — hoisted outside component (never changes)
const HOME_EXERCISES = [
  { id: 'memory', label: 'Memoria', description: 'Encontrá las parejas', icon: Brain, available: true },
  { id: 'categorize', label: 'Asociar y categorizar', description: 'Próximamente', icon: CheckCircle2, available: false },
  { id: 'sequence', label: 'Completar secuencia', description: 'Próximamente', icon: CheckCircle2, available: false },
] as const

interface HomeExerciseModalProps {
  patient: Patient
  onClose: () => void
}

function HomeExerciseModal({ patient, onClose }: HomeExerciseModalProps) {
  const { toast } = useToast()
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const patientFirstName = patient.fullName.split(' ')[0]
  const link = `${window.location.origin}/jugar/${patient.playToken}`
  const whatsappMessage = `Hola ${patientFirstName}, te comparto tu ejercicio de hoy en TIAM: ${link}`

  // Focus the close button when the modal opens
  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Enlace copiado')
    }).catch(() => {
      toast.error('No se pudo copiar el enlace')
    })
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank')
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Enviar ejercicio a ${patientFirstName}`}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 py-0 sm:py-6"
    >
      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-[480px] rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh] sm:max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Enviar ejercicio a {patientFirstName}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              El paciente abre el enlace y hace el ejercicio desde su celular o compu.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-tiam-blue/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Subscription status */}
          {patient.homeSubscriptionActive ? (
            <div className="flex items-center gap-2 rounded-xl border border-tiam-green/30 bg-tiam-green/10 px-4 py-2.5">
              <BadgeCheck className="h-4 w-4 shrink-0 text-tiam-green" aria-hidden="true" />
              <p className="text-sm text-tiam-green/90 font-medium">
                {patientFirstName} ya tiene el servicio activo.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">
                Al abrir el enlace, la familia de {patientFirstName} podrá activar la suscripción.
              </p>
            </div>
          )}

          {/* Exercise selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Tipo de ejercicio
            </p>
            <ul className="space-y-2" role="list">
              {HOME_EXERCISES.map(ex => {
                const Icon = ex.icon
                return (
                  <li
                    key={ex.id}
                    className={[
                      'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                      ex.available
                        ? 'border-tiam-blue bg-tiam-blue/5 cursor-default'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed',
                    ].join(' ')}
                    aria-disabled={!ex.available}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${ex.available ? 'text-tiam-blue' : 'text-slate-300'}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${ex.available ? 'text-slate-800' : 'text-slate-400'}`}>
                        {ex.label}
                      </p>
                      {!ex.available && (
                        <p className="text-xs text-slate-400">{ex.description}</p>
                      )}
                    </div>
                    {ex.available && (
                      <span className="text-xs font-semibold text-tiam-blue bg-tiam-blue/10 rounded-full px-2 py-0.5 shrink-0">
                        Seleccionado
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Generated link */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Enlace del ejercicio
            </p>
            <input
              type="url"
              readOnly
              value={link}
              aria-label="Enlace del ejercicio"
              onClick={e => (e.target as HTMLInputElement).select()}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-tiam-blue/30 cursor-text"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4" />
              Copiar enlace
            </Button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1ebe5d] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:ring-offset-2"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Compartir por WhatsApp
            </button>
          </div>

          {/* Coming-soon note */}
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            El paciente abre el enlace y hace el ejercicio. Próximamente vas a poder ver sus resultados acá.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setPatient = useSessionStore(s => s.setPatient)
  const [showHomeModal, setShowHomeModal] = useState(false)

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get<Patient>(`/patients/${id}`),
    enabled: !!id,
  })

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['patient-sessions', id],
    queryFn: () => api.get<PatientSession[]>(`/patients/${id}/sessions`),
    enabled: !!id,
  })

  function handleNewSession() {
    if (id) setPatient(id)
    navigate('/sessions/builder')
  }

  // ── derived stats ──
  const completed = sessions.filter(s => s.status === 'COMPLETED')
  const lastSession = sessions[0]

  const areaCounts: Record<string, number> = {}
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const slug of ex.cognitiveAreaSlugs) {
        areaCounts[slug] = (areaCounts[slug] ?? 0) + 1
      }
    }
  }
  const topAreas = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([slug]) => slug)

  // ── loading ──
  if (loadingPatient) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-slate-500">Paciente no encontrado.</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/patients')}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Home exercise modal */}
      {showHomeModal && patient && (
        <HomeExerciseModal patient={patient} onClose={() => setShowHomeModal(false)} />
      )}

      {/* Page header bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-2">
        <button
          onClick={() => navigate('/patients')}
          className="text-sm text-slate-400 hover:text-tiam-blue transition-colors"
        >
          Pacientes
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700 truncate">{patient.fullName}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ── Patient info card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            {/* Avatar + info row on mobile */}
            <div className="flex items-center gap-4 sm:contents">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-white text-lg font-bold sm:h-16 sm:w-16 sm:text-xl">
                {getInitials(patient.fullName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-900 leading-tight sm:text-2xl">{patient.fullName}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {calcAge(patient.birthDate)} años &bull;{' '}
                  {formatShort(patient.birthDate)}
                </p>
                <p className={`text-sm mt-1 ${patient.diagnosis ? 'text-slate-500' : 'text-slate-300 italic'}`}>
                  {patient.diagnosis ?? 'Sin diagnóstico registrado'}
                </p>
                {patient.notes && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{patient.notes}</p>
                )}
              </div>
            </div>

            {/* Edit button — right on desktop, full-width below on mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/patients')}
              className="sm:ml-auto sm:shrink-0"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Completed sessions */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-400 mb-1">Sesiones completadas</p>
            <p className="text-2xl font-bold text-slate-900">{completed.length}</p>
          </div>

          {/* Last session */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-400 mb-1">Última sesión</p>
            <p className="text-sm font-semibold text-slate-900">
              {lastSession ? formatShort(lastSession.scheduledDate) : 'Sin sesiones'}
            </p>
          </div>

          {/* Top areas */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-400 mb-2">Áreas más trabajadas</p>
            {topAreas.length === 0 ? (
              <p className="text-sm text-slate-300 italic">—</p>
            ) : (
              <div className="flex flex-col gap-1">
                {topAreas.map(slug => {
                  const color = AREA_COLORS[slug]
                  return (
                    <div key={slug} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color?.bg ?? 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-600">
                        {slug
                          .split('-')
                          .map(w => w[0].toUpperCase() + w.slice(1))
                          .join(' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Home exercises ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10">
              <Home className="h-4 w-4 text-tiam-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-900">Ejercicios a domicilio</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enviá un ejercicio para que tu paciente lo haga desde casa.
              </p>
            </div>
          </div>

          {/* Subscription status */}
          {patient.homeSubscriptionActive ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-tiam-green/30 bg-tiam-green/10 px-4 py-3 mb-4">
              <BadgeCheck className="h-5 w-5 shrink-0 text-tiam-green" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-tiam-green/90">Servicio activo</p>
                <p className="text-xs text-tiam-green/80 mt-0.5">
                  {patient.fullName.split(' ')[0]} tiene los ejercicios a domicilio activos.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
              <Clock className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-500">Sin suscripción</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  La familia de {patient.fullName.split(' ')[0]} todavía no activó el servicio. Al compartir el enlace, podrán suscribirse.
                </p>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowHomeModal(true)}
            className="w-full sm:w-auto justify-center"
          >
            <Share2 className="h-4 w-4" />
            Enviar ejercicio a domicilio
          </Button>
        </div>

        {/* ── Home exercise progress ── */}
        <HomeProgressPanel patient={patient} />

        {/* ── Session history ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Historial de sesiones</h2>
            <Button variant="primary" size="sm" onClick={handleNewSession}>
              <Plus className="h-4 w-4" />
              Nueva sesión
            </Button>
          </div>

          {loadingSessions && (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {!loadingSessions && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <CalendarX className="h-12 w-12 text-slate-200" />
              <p className="text-slate-500">Aún no hay sesiones registradas</p>
              <Button variant="secondary" size="sm" onClick={handleNewSession}>
                <Plus className="h-4 w-4" />
                Nueva sesión
              </Button>
            </div>
          )}

          {!loadingSessions && sessions.length > 0 && (
            <div className="flex flex-col gap-3">
              {sessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
