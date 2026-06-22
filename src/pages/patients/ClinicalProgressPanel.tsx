import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import type { PatientSession, CognitiveArea } from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Count sessions in the last 30 calendar days (by scheduledDate). */
function countLast30Days(sessions: PatientSession[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  cutoff.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.scheduledDate) >= cutoff).length
}

/** Average days between consecutive sessions (sorted ascending). Returns null if < 2 sessions. */
function avgDaysBetween(sessions: PatientSession[]): number | null {
  if (sessions.length < 2) return null
  const sorted = [...sessions]
    .map(s => new Date(s.scheduledDate).getTime())
    .sort((a, b) => a - b)
  let totalMs = 0
  for (let i = 1; i < sorted.length; i++) {
    totalMs += sorted[i] - sorted[i - 1]
  }
  const avgMs = totalMs / (sorted.length - 1)
  return Math.round(avgMs / (1000 * 60 * 60 * 24))
}

/** Group sessions by calendar month (YYYY-MM), for the last N months. */
function sessionsByMonth(sessions: PatientSession[], monthCount = 6): { label: string; count: number }[] {
  const now = new Date()
  const months: { label: string; count: number }[] = []

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    const count = sessions.filter(s => s.scheduledDate.startsWith(key)).length
    months.push({ label, count })
  }
  return months
}

/** Count exercises per cognitive area slug across all sessions. */
function countByArea(sessions: PatientSession[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const session of sessions) {
    for (const ex of session.exercises) {
      for (const slug of ex.cognitiveAreaSlugs) {
        counts[slug] = (counts[slug] ?? 0) + 1
      }
    }
  }
  return counts
}

// ─── sub-components ─────────────────────────────────────────────────────────

interface SummaryTileProps {
  label: string
  value: string | number
}

function SummaryTile({ label, value }: SummaryTileProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

interface MonthlyBarChartProps {
  months: { label: string; count: number }[]
}

function MonthlyBarChart({ months }: MonthlyBarChartProps) {
  const maxCount = Math.max(...months.map(m => m.count), 1)
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-2">Sesiones por mes</p>
      <div
        className="flex items-end gap-1.5 h-16"
        role="img"
        aria-label="Gráfico de sesiones por mes"
      >
        {months.map(m => {
          const heightPct = Math.round((m.count / maxCount) * 100)
          return (
            <div key={m.label} className="flex flex-col items-center flex-1 gap-1">
              <div
                title={`${m.count} sesión${m.count !== 1 ? 'es' : ''}`}
                className="w-full rounded-t-sm bg-tiam-blue/30 min-h-[3px]"
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[10px] text-slate-400 tabular-nums">{m.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface CoverageBarProps {
  area: CognitiveArea
  count: number
  maxCount: number
}

function CoverageBar({ area, count, maxCount }: CoverageBarProps) {
  const isEmpty = count === 0
  const widthPct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-36 shrink-0 truncate" title={area.name}>
        {area.name}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          {!isEmpty && (
            <div
              className="h-full rounded-full bg-tiam-blue/50 transition-all"
              style={{ width: `${widthPct}%` }}
            />
          )}
        </div>
        {isEmpty ? (
          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            sin trabajar
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-slate-500 tabular-nums w-5 text-right">
            {count}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

interface ClinicalProgressPanelProps {
  sessions: PatientSession[]
}

export function ClinicalProgressPanel({ sessions }: ClinicalProgressPanelProps) {
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['cognitive-areas'],
    queryFn: () => api.get<CognitiveArea[]>('/cognitive-areas'),
  })

  // ── Section A computations ──
  const totalSessions = sessions.length
  const last30 = countLast30Days(sessions)
  const avgDays = avgDaysBetween(sessions)
  const months = sessionsByMonth(sessions, 6)

  // ── Section B computations ──
  const areaCounts = countByArea(sessions)
  const sortedAreas = [...areas].sort(
    (a, b) => (areaCounts[b.slug] ?? 0) - (areaCounts[a.slug] ?? 0)
  )
  const maxAreaCount = Math.max(...sortedAreas.map(a => areaCounts[a.slug] ?? 0), 1)

  // Empty state — no sessions at all
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10">
            <Activity className="h-4 w-4 text-tiam-blue" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Progreso clínico</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Adherencia y cobertura cognitiva de las sesiones presenciales.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Todavía no hay sesiones registradas para ver progreso.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
      {/* Panel header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10">
          <Activity className="h-4 w-4 text-tiam-blue" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Progreso clínico</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Adherencia y cobertura cognitiva de las sesiones presenciales.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Section A: Adherencia ── */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Adherencia
          </p>

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryTile label="Total de sesiones" value={totalSessions} />
            <SummaryTile label="Últimos 30 días" value={last30} />
            <SummaryTile label="Cada cuánto" value={avgDays !== null ? `${avgDays}d` : '—'} />
          </div>

          {/* Monthly bar chart */}
          <MonthlyBarChart months={months} />
        </section>

        {/* Divider */}
        <hr className="border-slate-100" />

        {/* ── Section B: Cobertura cognitiva ── */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Cobertura cognitiva
          </p>

          {loadingAreas ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedAreas.map(area => (
                <CoverageBar
                  key={area.id}
                  area={area}
                  count={areaCounts[area.slug] ?? 0}
                  maxCount={maxAreaCount}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
