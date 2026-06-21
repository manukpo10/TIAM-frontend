import { X } from 'lucide-react'
import { cn, COGNITIVE_AREAS, DIFFICULTY_LABELS, DIFFICULTY_ICONS, AREA_COLORS } from '@/lib/utils'
import type { DifficultyLevel } from '@/types'

export interface FilterState {
  areas: string[]
  difficulty: DifficultyLevel | ''
  owner: '' | 'tiam' | 'mine'
}

interface ExerciseFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const DIFFICULTIES: { value: DifficultyLevel; label: string; color: string }[] = [
  { value: 'BASIC',        label: DIFFICULTY_LABELS.BASIC,        color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'INTERMEDIATE', label: DIFFICULTY_LABELS.INTERMEDIATE,  color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'ADVANCED',     label: DIFFICULTY_LABELS.ADVANCED,      color: 'bg-red-100 text-red-800 border-red-200' },
]

export function ExerciseFilters({ filters, onChange }: ExerciseFiltersProps) {
  function toggleArea(slug: string) {
    const next = filters.areas.includes(slug)
      ? filters.areas.filter(a => a !== slug)
      : [...filters.areas, slug]
    onChange({ ...filters, areas: next })
  }

  function setDifficulty(value: DifficultyLevel) {
    onChange({ ...filters, difficulty: filters.difficulty === value ? '' : value })
  }

  function setOwner(value: FilterState['owner']) {
    onChange({ ...filters, owner: filters.owner === value ? '' : value })
  }

  const hasFilters = filters.areas.length > 0 || filters.difficulty !== '' || filters.owner !== ''

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtros</span>
        {hasFilters && (
          <button
            onClick={() => onChange({ areas: [], difficulty: '', owner: '' })}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Origin */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-slate-500">Origen</p>
        {(
          [
            { value: '' as const, label: 'Todos' },
            { value: 'tiam' as const, label: 'Biblioteca TIAM' },
            { value: 'mine' as const, label: 'Mis ejercicios' },
          ] as const
        ).map(({ value, label }) => (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <input
              type="radio"
              name="owner-filter"
              checked={filters.owner === value}
              onChange={() => setOwner(value)}
              className="accent-tiam-blue"
            />
            {label}
          </label>
        ))}
      </div>

      {/* Cognitive areas */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-slate-500">Área cognitiva</p>
        {COGNITIVE_AREAS.map(area => {
          const color = AREA_COLORS[area.slug]
          const Icon = color?.icon
          const active = filters.areas.includes(area.slug)
          return (
            <button
              key={area.slug}
              onClick={() => toggleArea(area.slug)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all',
                active
                  ? cn(color?.bg ?? 'bg-tiam-blue', 'text-white shadow-sm')
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span>{area.name}</span>
            </button>
          )
        })}
      </div>

      {/* Difficulty */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-slate-500">Nivel de dificultad</p>
        {DIFFICULTIES.map(({ value, label, color }) => {
          const active = filters.difficulty === value
          const Icon = DIFFICULTY_ICONS[value]
          return (
            <button
              key={value}
              onClick={() => setDifficulty(value)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all',
                active ? cn(color, 'shadow-sm') : 'border-transparent text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
