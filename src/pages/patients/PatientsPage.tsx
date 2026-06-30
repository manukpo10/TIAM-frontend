import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, X, Pencil, Trash2, UserRound, Plus, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import type { Patient, PagedResponse } from '@/types'

function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface PatientFormData {
  fullName: string
  birthDate: string
  diagnosis: string
  notes: string
}

const emptyForm: PatientFormData = { fullName: '', birthDate: '', diagnosis: '', notes: '' }

interface PatientFormCardProps {
  initial?: PatientFormData
  onSave: (data: PatientFormData) => void
  onCancel: () => void
  loading: boolean
}

function PatientFormCard({ initial = emptyForm, onSave, onCancel, loading }: PatientFormCardProps) {
  const [form, setForm] = useState<PatientFormData>(initial)

  function set(field: keyof PatientFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors'

  return (
    <form data-tour="patient-form" onSubmit={handleSubmit} className="rounded-2xl border border-tiam-blue/20 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        {initial.fullName ? 'Editar paciente' : 'Nuevo paciente'}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre completo *</label>
          <input
            required
            type="text"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            placeholder="Ej: María González"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Fecha de nacimiento *</label>
          <input
            required
            type="date"
            value={form.birthDate}
            onChange={e => set('birthDate', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Diagnóstico</label>
          <input
            type="text"
            value={form.diagnosis}
            onChange={e => set('diagnosis', e.target.value)}
            placeholder="Ej: Deterioro cognitivo leve"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Notas</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Observaciones sobre el paciente..."
            className={inputClass + ' resize-none'}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button data-tour="patient-form-submit" type="submit" variant="primary" size="sm" loading={loading}>
          Guardar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

interface PatientCardProps {
  patient: Patient
  onEdit: (p: Patient) => void
  onDelete: (id: string) => void
  onClick: (id: string) => void
}

function PatientCard({ patient, onEdit, onDelete, onClick }: PatientCardProps) {
  return (
    <div
      className="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-md hover:shadow-lg hover:border-tiam-blue/20 transition-[box-shadow,border-color] duration-200 cursor-pointer"
      onClick={() => onClick(patient.id)}
    >
      {/* Action buttons — visible on hover */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={e => { e.stopPropagation(); onEdit(patient) }}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(patient.id) }}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
          {getInitials(patient.fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{patient.fullName}</p>
          <p className="text-xs text-slate-400">{getAge(patient.birthDate)} años</p>
        </div>
      </div>

      {/* Diagnosis */}
      <p className={`mt-3 text-sm ${patient.diagnosis ? 'text-slate-500' : 'italic text-slate-300'}`}>
        {patient.diagnosis ?? 'Sin diagnóstico'}
      </p>

      {/* Last session */}
      <p className="mt-2 text-xs text-slate-400">
        {patient.lastSessionAt
          ? `Última sesión: ${formatDate(patient.lastSessionAt)}`
          : 'Sin sesiones aún'}
      </p>

      {/* Home subscription indicator */}
      {patient.homeSubscriptionActive && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-tiam-green shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium text-tiam-green/90">
            <Home className="inline h-3 w-3 mr-0.5 -mt-0.5" aria-hidden="true" />
            A domicilio activo
          </span>
        </div>
      )}
    </div>
  )
}

export function PatientsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', search],
    queryFn: () =>
      api.get<PagedResponse<Patient>>(`/patients${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  })

  const createMutation = useMutation({
    mutationFn: (body: Omit<Patient, 'id' | 'createdAt' | 'professionalId'>) =>
      api.post<Patient>('/patients', { ...body, professionalId: 'mock-admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setShowForm(false)
      toast.success('Paciente creado')
    },
    onError: () => {
      toast.error('No se pudo crear el paciente')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<Patient> & { id: string }) =>
      api.put<Patient>(`/patients/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setEditingPatient(null)
      toast.success('Paciente actualizado')
    },
    onError: () => {
      toast.error('No se pudo actualizar el paciente')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/patients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente eliminado')
    },
    onError: () => {
      toast.error('No se pudo eliminar el paciente')
    },
  })

  function handleSaveNew(form: PatientFormData) {
    createMutation.mutate({
      fullName: form.fullName,
      birthDate: form.birthDate,
      diagnosis: form.diagnosis || undefined,
      notes: form.notes || undefined,
    })
  }

  function handleSaveEdit(form: PatientFormData) {
    if (!editingPatient) return
    updateMutation.mutate({
      id: editingPatient.id,
      fullName: form.fullName,
      birthDate: form.birthDate,
      diagnosis: form.diagnosis || undefined,
      notes: form.notes || undefined,
    })
  }

  function handleEdit(patient: Patient) {
    setEditingPatient(patient)
    setShowForm(false)
  }

  function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este paciente?')) return
    deleteMutation.mutate(id)
  }

  const patients = data?.content ?? []

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {isLoading ? 'Cargando...' : data ? `${data.totalElements} pacientes registrados` : ''}
            </p>
          </div>
          <Button
            data-tour="new-patient-btn"
            variant="primary"
            size="sm"
            onClick={() => {
              setShowForm(v => !v)
              setEditingPatient(null)
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pacientes por nombre..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-tiam-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-tiam-blue/20 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* New patient form */}
        {showForm && (
          <div className="mb-6">
            <PatientFormCard
              onSave={handleSaveNew}
              onCancel={() => setShowForm(false)}
              loading={createMutation.isPending}
            />
          </div>
        )}

        {/* Edit form */}
        {editingPatient && (
          <div className="mb-6">
            <PatientFormCard
              initial={{
                fullName: editingPatient.fullName,
                birthDate: editingPatient.birthDate,
                diagnosis: editingPatient.diagnosis ?? '',
                notes: editingPatient.notes ?? '',
              }}
              onSave={handleSaveEdit}
              onCancel={() => setEditingPatient(null)}
              loading={updateMutation.isPending}
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <p className="text-slate-500">Error al cargar los pacientes.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && patients.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <UserRound className="h-12 w-12 text-slate-200" />
            <p className="text-slate-500">
              {search ? `Sin resultados para "${search}".` : 'Aún no tenés pacientes registrados'}
            </p>
            {!search && (
              <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Agregar paciente
              </Button>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && patients.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {patients.map(patient => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={id => navigate(`/patients/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
