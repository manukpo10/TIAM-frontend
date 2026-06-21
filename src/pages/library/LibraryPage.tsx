import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Layers, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { ExerciseCard } from '@/features/library/ExerciseCard'
import { ExerciseFilters, type FilterState } from '@/features/library/ExerciseFilters'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { useSessionStore } from '@/store/session'
import type { Exercise, PagedResponse } from '@/types'

const PAGE_SIZE = 12

export function LibraryPage() {
  const navigate = useNavigate()
  const { exercises: sessionExercises, toggleExercise, clearSession } = useSessionStore()
  const [filters, setFilters] = useState<FilterState>({ areas: [], difficulty: '', owner: '' })
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const queryParams = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    ...(debouncedSearch && { q: debouncedSearch }),
    ...(filters.difficulty && { difficulty: filters.difficulty }),
    ...(filters.areas.length > 0 && { areas: filters.areas.join(',') }),
    ...(filters.owner && { owner: filters.owner }),
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exercises', filters, page, debouncedSearch],
    queryFn: () => api.get<PagedResponse<Exercise>>(`/exercises?${queryParams}`),
  })

  function handleFiltersChange(next: FilterState) {
    setFilters(next)
    setPage(0)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  const sessionIds = new Set(sessionExercises.map((e: Exercise) => e.id))
  const hasActiveFilters = filters.areas.length > 0 || !!filters.difficulty || !!filters.owner || !!debouncedSearch

  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full">
      {/* ── Filter sidebar: desktop (lg+) only ── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-slate-100 bg-white px-4 py-6 overflow-y-auto">
        <ExerciseFilters filters={filters} onChange={handleFiltersChange} />
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Biblioteca de ejercicios</h1>
              <p className="mt-0.5 text-sm text-slate-400">
                {isLoading ? 'Cargando...' : data ? `${data.totalElements} ejercicios disponibles` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {filters.owner === 'mine' && (
                <Button variant="secondary" size="sm" onClick={() => navigate('/library/new')}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar ejercicio</span>
                </Button>
              )}
              {sessionExercises.length > 0 && (
                <>
                  <button
                    onClick={() => clearSession()}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/sessions/builder')}>
                    <Layers className="h-4 w-4" />
                    Armar sesión ({sessionExercises.length})
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Buscar ejercicios por nombre..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="lg:hidden mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {(filters.areas.length > 0 || filters.difficulty || filters.owner) && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tiam-blue text-[10px] font-bold text-white">
                  {filters.areas.length + (filters.difficulty ? 1 : 0) + (filters.owner ? 1 : 0)}
                </span>
              )}
            </span>
            {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Mobile filters panel */}
          {filtersOpen && (
            <div className="lg:hidden mt-2 rounded-xl border border-slate-100 bg-white px-4 py-4">
              <ExerciseFilters filters={filters} onChange={handleFiltersChange} />
            </div>
          )}

          {/* Active filter chips */}
          {(filters.areas.length > 0 || filters.difficulty) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.areas.map(slug => (
                <button
                  key={slug}
                  onClick={() => handleFiltersChange({ ...filters, areas: filters.areas.filter(a => a !== slug) })}
                  className="flex items-center gap-1 rounded-full bg-tiam-blue/10 px-2.5 py-1 text-xs font-medium text-tiam-blue-dark hover:bg-tiam-blue/15"
                >
                  {slug.replace(/-/g, ' ')}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {filters.difficulty && (
                <button
                  onClick={() => handleFiltersChange({ ...filters, difficulty: '' })}
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  {filters.difficulty}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-8 w-8" />
            </div>
          )}

          {isError && (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <p className="text-slate-500">Error al cargar los ejercicios.</p>
              <button onClick={() => window.location.reload()} className="text-sm text-tiam-blue hover:underline">
                Reintentar
              </button>
            </div>
          )}

          {data && data.content.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Search className="h-10 w-10 text-slate-200" />
              <p className="text-slate-500">
                {debouncedSearch
                  ? `Sin resultados para "${debouncedSearch}".`
                  : 'No hay ejercicios con esos filtros.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => { handleFiltersChange({ areas: [], difficulty: '', owner: '' }); handleSearchChange('') }}
                  className="text-sm text-tiam-blue hover:underline"
                >
                  Limpiar búsqueda y filtros
                </button>
              )}
            </div>
          )}

          {data && data.content.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {data.content.map(exercise => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onAddToSession={toggleExercise}
                    inSession={sessionIds.has(exercise.id)}
                  />
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-400">
                    {page + 1} / {data.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
