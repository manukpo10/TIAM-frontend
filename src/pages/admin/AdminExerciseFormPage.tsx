import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'
import type { Exercise, CognitiveArea } from '@/types'

const schema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().min(10, 'Describí el ejercicio brevemente'),
  instructions: z.string().min(10, 'Agregá las instrucciones'),
  difficulty: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']),
  materialType: z.enum(['PRINTABLE', 'SENSORIAL', 'VERBAL', 'IMAGE_SEQUENCE']),
  cognitiveAreaIds: z.array(z.string()).min(1, 'Seleccioná al menos un área cognitiva'),
  status: z.enum(['DRAFT', 'PUBLISHED']),
})

type FormData = z.infer<typeof schema>

export function AdminExerciseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['admin', 'exercise', id],
    queryFn: () => api.get<Exercise>(`/admin/exercises/${id}`),
    enabled: isEdit,
  })

  // Cognitive areas come from the backend (single source of truth) instead of a
  // hardcoded list, so the selector stays in sync if areas are ever added/reordered.
  const { data: areas } = useQuery({
    queryKey: ['cognitive-areas'],
    queryFn: () => api.get<CognitiveArea[]>('/cognitive-areas'),
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: existing
      ? {
          title: existing.title,
          description: existing.description,
          instructions: existing.instructions,
          difficulty: existing.difficulty,
          materialType: existing.materialType,
          cognitiveAreaIds: existing.cognitiveAreas.map(a => String(a.id)),
          status: existing.status,
        }
      : {
          difficulty: 'BASIC',
          materialType: 'PRINTABLE',
          cognitiveAreaIds: [],
          status: 'DRAFT',
          title: '',
          description: '',
          instructions: '',
        },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? api.put<Exercise>(`/admin/exercises/${id}`, data)
        : api.post<Exercise>('/admin/exercises', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exercises'] })
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      navigate('/admin/exercises')
    },
  })

  if (isEdit && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <h1 className="mb-6 text-xl font-bold text-slate-900">
        {isEdit ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      </h1>

      <form
        onSubmit={handleSubmit(data => mutation.mutate(data))}
        className="flex flex-col gap-5"
      >
        <Input
          id="title"
          label="Título"
          placeholder="Ej: Secuencia de números con atención dividida"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-tiam-blue focus:outline-none focus:ring-1 focus:ring-tiam-blue"
            rows={2}
            placeholder="Breve descripción del objetivo del ejercicio"
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Instrucciones</label>
          <textarea
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-tiam-blue focus:outline-none focus:ring-1 focus:ring-tiam-blue"
            rows={5}
            placeholder="Instrucciones paso a paso para el profesional..."
            {...register('instructions')}
          />
          {errors.instructions && (
            <p className="text-xs text-red-600">{errors.instructions.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            id="difficulty"
            label="Nivel de dificultad"
            error={errors.difficulty?.message}
            {...register('difficulty')}
          >
            <option value="BASIC">Básico</option>
            <option value="INTERMEDIATE">Intermedio</option>
            <option value="ADVANCED">Avanzado</option>
          </Select>

          <Select
            id="materialType"
            label="Tipo de material"
            error={errors.materialType?.message}
            {...register('materialType')}
          >
            <option value="PRINTABLE">Imprimible</option>
            <option value="SENSORIAL">Sensorial</option>
            <option value="VERBAL">Verbal</option>
            <option value="IMAGE_SEQUENCE">Secuencia de imágenes</option>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Áreas cognitivas <span className="text-red-500">*</span>
          </label>
          <Controller
            name="cognitiveAreaIds"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {(areas ?? []).map(area => {
                  const areaId = String(area.id)
                  const selected = field.value.includes(areaId)
                  return (
                    <button
                      key={areaId}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? field.value.filter(id => id !== areaId)
                          : [...field.value, areaId]
                        field.onChange(next)
                      }}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        selected
                          ? 'bg-tiam-blue text-white'
                          : 'border border-slate-200 text-slate-600 hover:border-tiam-blue/30'
                      }`}
                    >
                      {area.name}
                    </button>
                  )
                })}
              </div>
            )}
          />
          {errors.cognitiveAreaIds && (
            <p className="text-xs text-red-600">{errors.cognitiveAreaIds.message}</p>
          )}
        </div>

        <Select
          id="status"
          label="Estado"
          {...register('status')}
        >
          <option value="DRAFT">Borrador</option>
          <option value="PUBLISHED">Publicado</option>
        </Select>

        {mutation.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Error al guardar. Intentá de nuevo.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear ejercicio'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
