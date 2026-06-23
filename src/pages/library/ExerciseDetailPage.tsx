import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, Layers, Plus, BookOpen, Image as ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'
import { useSessionStore } from '@/store/session'
import {
  cn,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_ICONS,
  MATERIAL_TYPE_LABELS,
  AREA_COLORS,
  MATERIAL_TYPE_ICONS,
} from '@/lib/utils'
import type { Exercise } from '@/types'

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { exercises: sessionExercises, toggleExercise } = useSessionStore()

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => api.get<Exercise>(`/exercises/${id}`),
    enabled: Boolean(id),
  })

  async function handleDownloadPdf() {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/exercises/${id}/pdf`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('tiam_token')}` } },
    )
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exercise?.title ?? 'ejercicio'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-slate-500">Ejercicio no encontrado.</p>
        <Link to="/library" className="text-sm text-tiam-blue hover:underline">
          Volver a la biblioteca
        </Link>
      </div>
    )
  }

  const inSession = sessionExercises.some(e => e.id === exercise.id)

  const primaryArea = exercise.cognitiveAreas[0]
  const areaColor = primaryArea
    ? (AREA_COLORS[primaryArea.slug] ?? AREA_COLORS['funciones-ejecutivas'])
    : AREA_COLORS['funciones-ejecutivas']
  const AreaIcon = areaColor.icon
  const MaterialIcon = MATERIAL_TYPE_ICONS[exercise.materialType]

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      {/* Hero banner */}
      <div className={cn('relative px-8 py-10', areaColor.bg)}>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la biblioteca
        </button>

        <div className="flex items-end gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <AreaIcon className="h-10 w-10 text-white" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {exercise.cognitiveAreas.map(area => (
                <span
                  key={area.id}
                  className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
                >
                  {area.name}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-bold text-white">{exercise.title}</h1>
            <p className="mt-1 text-white/80">{exercise.description}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

          {/* Main */}
          <div className="flex flex-col gap-5">
            {/* Meta chips */}
            <div className="flex flex-wrap gap-2">
              <Badge className={cn('inline-flex items-center gap-1.5', DIFFICULTY_COLORS[exercise.difficulty])}>
                {(() => { const I = DIFFICULTY_ICONS[exercise.difficulty]; return <I className="h-3.5 w-3.5" /> })()}
                {DIFFICULTY_LABELS[exercise.difficulty]}
              </Badge>
              <Badge className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600">
                {MaterialIcon && <MaterialIcon className="h-3.5 w-3.5" />}
                {MATERIAL_TYPE_LABELS[exercise.materialType]}
              </Badge>
            </div>

            {/* Preview image */}
            {exercise.previewImageUrl && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-tiam-blue" />
                  <h2 className="font-semibold text-slate-900">Vista previa del material</h2>
                </div>
                <a href={exercise.previewImageUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={exercise.previewImageUrl}
                    alt={`Material del ejercicio ${exercise.title}`}
                    className="mx-auto max-h-[600px] w-full rounded-xl border border-slate-100 object-contain"
                  />
                </a>
                <p className="mt-2 text-center text-xs text-slate-400">Clic para ampliar</p>
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-tiam-blue" />
                <h2 className="font-semibold text-slate-900">Instrucciones para el profesional</h2>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {exercise.instructions}
              </p>
            </div>
          </div>

          {/* Sidebar actions */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              {exercise.previewImageUrl ? (
                <a
                  href={exercise.previewImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 block overflow-hidden rounded-xl border border-slate-200"
                >
                  <img
                    src={exercise.previewImageUrl}
                    alt={`Vista previa de ${exercise.title}`}
                    className="h-40 w-full bg-white object-contain"
                  />
                </a>
              ) : (
                <div className={cn('mb-4 flex h-40 items-center justify-center rounded-xl', areaColor.bg)}>
                  <AreaIcon className="h-16 w-16 text-white/90" />
                </div>
              )}

              <Button size="lg" onClick={handleDownloadPdf} className="mb-2 w-full">
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>

              <Button
                size="lg"
                variant={inSession ? 'secondary' : 'secondary'}
                className={cn('w-full', inSession && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}
                onClick={() => toggleExercise(exercise)}
              >
                {inSession ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {inSession ? 'En sesión ✓' : 'Agregar a sesión'}
              </Button>

              {sessionExercises.length > 0 && (
                <Button
                  size="lg"
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate('/sessions/builder')}
                >
                  <Layers className="h-4 w-4" />
                  Ver sesión ({sessionExercises.length})
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Detalles</p>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nivel</dt>
                  <dd className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                    {(() => { const I = DIFFICULTY_ICONS[exercise.difficulty]; return <I className="h-3.5 w-3.5 text-slate-400" /> })()}
                    {DIFFICULTY_LABELS[exercise.difficulty]}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tipo</dt>
                  <dd className="font-medium text-slate-900">{MATERIAL_TYPE_LABELS[exercise.materialType]}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Áreas</dt>
                  <dd className="font-medium text-slate-900">{exercise.cognitiveAreas.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
