import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronUp, ChevronDown, X, Layers, Library } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useSessionStore } from '@/store/session'
import { api } from '@/lib/api'
import { cn, AREA_COLORS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/utils'
import type { PagedResponse, Patient, Exercise, PatientSession, PatientSessionExercise } from '@/types'

function getTodayTitle(): string {
  const d = new Date()
  return `Sesión del ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

interface ExerciseRowProps {
  exercise: Exercise
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
}

function ExerciseRow({ exercise, index, total, onMove, onRemove }: ExerciseRowProps) {
  const primaryArea = exercise.cognitiveAreas[0]
  const areaColor = primaryArea
    ? (AREA_COLORS[primaryArea.slug] ?? AREA_COLORS['memoria'])
    : AREA_COLORS['funciones-ejecutivas']

  return (
    <div className="flex items-stretch gap-0 rounded-xl border border-slate-100 bg-white shadow-md hover:shadow-lg hover:border-tiam-blue/20 transition-[box-shadow,border-color] duration-200 overflow-hidden">
      {/* Area color strip */}
      <div className={cn('w-1.5 shrink-0 border-l-2 border-l-tiam-blue/30', areaColor.bg)} />

      {/* Reorder controls */}
      <div className="flex flex-col items-center justify-center border-r border-slate-100 px-1.5 py-2 gap-0.5">
        <button
          onClick={() => onMove(index, index - 1)}
          disabled={index === 0}
          className="rounded p-0.5 text-slate-300 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-extrabold text-tiam-blue tabular-nums select-none">{index + 1}</span>
        <button
          onClick={() => onMove(index, index + 1)}
          disabled={index === total - 1}
          className="rounded p-0.5 text-slate-300 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-slate-900 text-sm">{exercise.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {exercise.cognitiveAreas.slice(0, 2).map(area => {
              const color = AREA_COLORS[area.slug]
              return (
                <span
                  key={area.id}
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    color?.light ?? 'bg-slate-100',
                    color?.text ?? 'text-slate-700',
                  )}
                >
                  {area.name}
                </span>
              )
            })}
          </div>
        </div>
        <Badge className={cn('shrink-0 text-xs', DIFFICULTY_COLORS[exercise.difficulty])}>
          {DIFFICULTY_LABELS[exercise.difficulty]}
        </Badge>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(exercise.id)}
        className="flex items-center justify-center px-3 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function SessionBuilderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { exercises, patientId, title, notes, moveExercise, removeExercise, setPatient, setTitle, setNotes, clearSession } =
    useSessionStore()

  const [patientError, setPatientError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  const resolvedTitle = title || getTodayTitle()

  const { data: patientsData } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get<PagedResponse<Patient>>('/patients'),
  })

  const patients = patientsData?.content ?? []

  const saveMutation = useMutation({
    mutationFn: (payload: {
      patientId: string
      title: string
      notes?: string
      exercises: PatientSessionExercise[]
    }) => api.post<PatientSession>('/sessions', payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-sessions', variables.patientId] })
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] })
      toast.success('Sesión guardada')
      clearSession()
      navigate(`/patients/${variables.patientId}`)
    },
    onError: () => {
      toast.error('No se pudo guardar la sesión')
    },
  })

  function handleSave() {
    if (!patientId) {
      setPatientError('Seleccioná un paciente para guardar la sesión.')
      return
    }
    setPatientError(null)

    const mappedExercises: PatientSessionExercise[] = exercises.map(ex => ({
      exerciseId: ex.id,
      title: ex.title,
      cognitiveAreaSlugs: ex.cognitiveAreas.map(a => a.slug),
      difficulty: ex.difficulty,
      materialType: ex.materialType,
    }))

    saveMutation.mutate({
      patientId,
      title: resolvedTitle,
      notes: notes || undefined,
      exercises: mappedExercises,
    })
  }

  async function handlePrint() {
    if (exercises.length === 0) return
    try {
      setPrinting(true)
      const blob = await api.postBlob('/exercises/pdf', {
        exerciseIds: exercises.map(ex => Number(ex.id)),
        patientId: patientId ? Number(patientId) : undefined,
        sessionTitle: resolvedTitle,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'fichas-sesion.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo generar el PDF de fichas')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-tiam-blue" />
          <h1 className="text-lg font-bold text-slate-900">Armar sesión</h1>
        </div>
      </div>

      {/* Body — stacked on mobile, side-by-side on lg+ */}
      <div className="flex flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-slate-100 bg-white p-4 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto lg:p-5">
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Sesión</h2>

            {/* Patient selector */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Paciente</label>
              <select
                data-tour="session-patient-select"
                value={patientId ?? ''}
                onChange={e => {
                  setPatient(e.target.value || null)
                  if (e.target.value) setPatientError(null)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors"
              >
                <option value="">Seleccionar paciente</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
              {patientError && (
                <p className="mt-1.5 text-xs text-red-500">{patientError}</p>
              )}
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Título de la sesión</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={getTodayTitle()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Notas (opcional)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones para esta sesión..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <Button
              data-tour="save-session-btn"
              variant="secondary"
              size="md"
              className="w-full"
              loading={saveMutation.isPending}
              disabled={exercises.length === 0}
              onClick={handleSave}
            >
              Guardar sesión
            </Button>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              loading={printing}
              disabled={exercises.length === 0}
              onClick={handlePrint}
            >
              Imprimir fichas
            </Button>
            <button
              onClick={() => {
                clearSession()
                navigate(-1)
              }}
              className="mt-1 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </aside>

        {/* Main — exercise list */}
        <main className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Ejercicios seleccionados ({exercises.length})
          </h2>

          {exercises.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-tiam-blue/5 to-white border border-slate-100 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tiam-blue/10">
                <Library className="h-8 w-8 text-tiam-blue/60" />
              </div>
              <div>
                <p className="font-medium text-slate-700">Todavía no hay ejercicios</p>
                <p className="mt-1 text-sm text-slate-400">Volvé a la biblioteca para agregar ejercicios</p>
              </div>
              <Link to="/library">
                <Button variant="secondary" size="sm">
                  Ir a la biblioteca
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 shadow-lg shadow-tiam-blue/10 bg-white p-4">
              <div className="flex flex-col gap-2">
                {exercises.map((exercise, index) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    total={exercises.length}
                    onMove={moveExercise}
                    onRemove={removeExercise}
                  />
                ))}
              </div>

              <div className="mt-4">
                <Link to="/library">
                  <Button variant="ghost" size="sm">
                    <Library className="h-4 w-4" />
                    Agregar más ejercicios
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
