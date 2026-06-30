import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Edit, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { cn, DIFFICULTY_LABELS, DIFFICULTY_COLORS, DIFFICULTY_ICONS } from '@/lib/utils'
import type { Exercise, PagedResponse } from '@/types'

export function AdminExerciseListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'exercises'],
    queryFn: () => api.get<PagedResponse<Exercise>>('/admin/exercises?size=50'),
  })

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/exercises/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exercises'] })
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      toast.success('Ejercicio eliminado')
    },
    onError: () => toast.error('No se pudo eliminar el ejercicio'),
  })

  function handleDelete(exercise: Exercise) {
    if (window.confirm(`¿Eliminar "${exercise.title}"? Esta acción no se puede deshacer desde el panel.`)) {
      deleteMutation.mutate(exercise.id)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestión de ejercicios</h1>
          <p className="text-sm text-slate-500">
            {data?.totalElements ?? 0} ejercicios en la biblioteca
          </p>
        </div>
        <Link to="/admin/exercises/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo ejercicio
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      )}

      {data && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Ejercicio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Áreas</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Nivel</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.content.map(exercise => (
                <tr key={exercise.id} className="border-b border-slate-100 transition-[background-color,box-shadow] duration-200 hover:bg-tiam-blue/5 hover:shadow-[inset_2px_0_0_0_theme(colors.tiam-blue/0.3)]">
                  <td className="px-4 py-3 font-medium text-slate-900">{exercise.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {exercise.cognitiveAreas.slice(0, 2).map(area => (
                        <Badge key={area.id} className="bg-tiam-blue/10 text-tiam-blue-dark">
                          {area.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn('inline-flex items-center gap-1', DIFFICULTY_COLORS[exercise.difficulty])}>
                      {(() => { const I = DIFFICULTY_ICONS[exercise.difficulty]; return <I className="h-3 w-3" /> })()}
                      {DIFFICULTY_LABELS[exercise.difficulty]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {exercise.status === 'PUBLISHED' ? (
                      <Badge className="inline-flex items-center gap-1 bg-tiam-green/10 text-tiam-green">
                        <Eye className="h-3.5 w-3.5" /> Publicado
                      </Badge>
                    ) : (
                      <Badge className="inline-flex items-center gap-1 bg-slate-100 text-slate-500">
                        <EyeOff className="h-3.5 w-3.5" /> Borrador
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/exercises/${exercise.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200"
                        onClick={() => handleDelete(exercise)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
