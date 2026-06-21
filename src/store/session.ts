import { create } from 'zustand'
import type { Exercise } from '@/types'

interface SessionDraft {
  exercises: Exercise[]
  patientId: string | null
  title: string
  notes: string
}

interface SessionStore extends SessionDraft {
  toggleExercise: (exercise: Exercise) => void
  removeExercise: (id: string) => void
  moveExercise: (fromIndex: number, toIndex: number) => void
  setPatient: (patientId: string | null) => void
  setTitle: (title: string) => void
  setNotes: (notes: string) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>()(set => ({
  exercises: [],
  patientId: null,
  title: '',
  notes: '',
  toggleExercise: (exercise) => set(s => ({
    exercises: s.exercises.some(e => e.id === exercise.id)
      ? s.exercises.filter(e => e.id !== exercise.id)
      : [...s.exercises, exercise],
  })),
  removeExercise: (id) => set(s => ({ exercises: s.exercises.filter(e => e.id !== id) })),
  moveExercise: (from, to) => set(s => {
    const arr = [...s.exercises]
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    return { exercises: arr }
  }),
  setPatient: (patientId) => set({ patientId }),
  setTitle: (title) => set({ title }),
  setNotes: (notes) => set({ notes }),
  clearSession: () => set({ exercises: [], patientId: null, title: '', notes: '' }),
}))
