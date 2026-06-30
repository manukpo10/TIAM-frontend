import { Link } from 'react-router-dom'
import { Plus, Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  cn,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_ICONS,
  AREA_COLORS,
  MATERIAL_TYPE_ICONS,
  MATERIAL_TYPE_LABELS,
} from '@/lib/utils'
import type { Exercise } from '@/types'

interface ExerciseCardProps {
  exercise: Exercise
  onAddToSession?: (exercise: Exercise) => void
  inSession?: boolean
}

export function ExerciseCard({ exercise, onAddToSession, inSession = false }: ExerciseCardProps) {
  const primaryArea = exercise.cognitiveAreas[0]
  const areaColor = primaryArea
    ? (AREA_COLORS[primaryArea.slug] ?? AREA_COLORS['memoria'])
    : AREA_COLORS['funciones-ejecutivas']
  const AreaIcon = areaColor.icon
  const MaterialIcon = MATERIAL_TYPE_ICONS[exercise.materialType] ?? MATERIAL_TYPE_ICONS['PRINTABLE']

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-tiam-blue/20 hover:shadow-lg">

      {/* Colored thumbnail */}
      <Link to={`/exercises/${exercise.id}`} className="block">
        <div className={cn('relative flex h-32 items-center justify-center', areaColor.bg)}>
          <AreaIcon className="h-12 w-12 text-white/90 drop-shadow-sm" />
          {exercise.ownerId !== null && (
            <span className="absolute left-2 top-2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              Mío
            </span>
          )}
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            <MaterialIcon className="h-3 w-3" />
            {MATERIAL_TYPE_LABELS[exercise.materialType]}
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Area badges */}
        <div className="flex flex-wrap gap-1">
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
          {exercise.cognitiveAreas.length > 2 && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              +{exercise.cognitiveAreas.length - 2}
            </span>
          )}
        </div>

        {/* Title */}
        <Link to={`/exercises/${exercise.id}`}>
          <h3 className="font-semibold leading-snug text-slate-900 group-hover:text-tiam-blue line-clamp-2">
            {exercise.title}
          </h3>
        </Link>

        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{exercise.description}</p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <Badge className={cn('inline-flex items-center gap-1', DIFFICULTY_COLORS[exercise.difficulty])}>
            {(() => { const I = DIFFICULTY_ICONS[exercise.difficulty]; return <I className="h-3 w-3" /> })()}
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </Badge>

          {onAddToSession && (
            <button
              data-tour="add-exercise-btn"
              onClick={() => onAddToSession(exercise)}
              title={inSession ? 'Agregado a sesión' : 'Agregar a sesión'}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                inSession
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-slate-100 text-slate-400 hover:bg-tiam-blue/15 hover:text-tiam-blue',
              )}
            >
              {inSession ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
