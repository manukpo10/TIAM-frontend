import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { COGNITIVE_AREAS } from '@/lib/utils'
import type { Exercise } from '@/types'

const schema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().min(10, 'Describí el ejercicio brevemente'),
  instructions: z.string().min(10, 'Agregá las instrucciones'),
  difficulty: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED']),
  materialType: z.enum(['PRINTABLE', 'SENSORIAL', 'VERBAL', 'IMAGE_SEQUENCE']),
  cognitiveAreaIds: z.array(z.string()).min(1, 'Seleccioná al menos un área cognitiva'),
})

type FormData = z.infer<typeof schema>

const DIFFICULTY_OPTIONS = [
  { value: 'BASIC', label: 'Básico' },
  { value: 'INTERMEDIATE', label: 'Intermedio' },
  { value: 'ADVANCED', label: 'Avanzado' },
] as const

const MATERIAL_OPTIONS = [
  { value: 'PRINTABLE', label: 'Imprimible' },
  { value: 'SENSORIAL', label: 'Sensorial' },
  { value: 'VERBAL', label: 'Verbal' },
  { value: 'IMAGE_SEQUENCE', label: 'Secuencia de imágenes' },
] as const

export function MyExerciseFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      instructions: '',
      difficulty: 'BASIC',
      materialType: 'VERBAL',
      cognitiveAreaIds: [],
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post<Exercise>('/exercises/mine', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      navigate('/library')
    },
  })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button
        onClick={() => navigate('/library')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la biblioteca
      </button>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md hover:shadow-lg hover:border-tiam-blue/20 transition-[box-shadow,border-color] duration-200">
        <h1 className="text-xl font-bold text-slate-900">Agregar ejercicio propio</h1>
        <p className="mt-1 text-sm text-slate-500">Este ejercicio solo lo verás vos.</p>

        <form
          onSubmit={handleSubmit(data => mutation.mutate(data))}
          className="mt-6 flex flex-col gap-5"
        >
          <Input
            id="title"
            label="Título"
            placeholder="Ej: Recordar la lista del supermercado"
            error={errors.title?.message}
            {...register('title')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Descripción <span className="text-red-500">*</span>
            </label>
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
            <label className="text-sm font-medium text-slate-700">
              Instrucciones <span className="text-red-500">*</span>
            </label>
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

          {/* Cognitive areas */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-6 mt-1">
            <label className="text-sm font-medium text-slate-700">
              Áreas cognitivas <span className="text-red-500">*</span>
            </label>
            <Controller
              name="cognitiveAreaIds"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {COGNITIVE_AREAS.map(area => {
                    const selected = field.value.includes(area.id)
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? field.value.filter(id => id !== area.id)
                            : [...field.value, area.id]
                          field.onChange(next)
                        }}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          selected
                            ? 'bg-tiam-blue text-white shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:border-tiam-blue/30 hover:bg-tiam-blue/5'
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

          {/* Difficulty */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-6 mt-1">
            <label className="text-sm font-medium text-slate-700">Nivel de dificultad</label>
            <div className="flex flex-col gap-1.5">
              {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    value={value}
                    className="accent-tiam-blue"
                    {...register('difficulty')}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.difficulty && (
              <p className="text-xs text-red-600">{errors.difficulty.message}</p>
            )}
          </div>

          {/* Material type */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-6 mt-1">
            <label className="text-sm font-medium text-slate-700">Tipo de material</label>
            <div className="flex flex-col gap-1.5">
              {MATERIAL_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    value={value}
                    className="accent-tiam-blue"
                    {...register('materialType')}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.materialType && (
              <p className="text-xs text-red-600">{errors.materialType.message}</p>
            )}
          </div>

          {mutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Error al guardar. Intentá de nuevo.
            </p>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-100 mt-1">
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Guardar ejercicio
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/library')}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
