export type DifficultyLevel = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'
export type MaterialType = 'PRINTABLE' | 'SENSORIAL' | 'VERBAL' | 'IMAGE_SEQUENCE'
export type ExerciseStatus = 'DRAFT' | 'PUBLISHED'
export type UserRole = 'PROFESSIONAL' | 'ADMIN'
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED'

export interface CognitiveArea {
  id: string
  name: string
  slug: string
}

export interface Exercise {
  id: string
  title: string
  description: string
  instructions: string
  difficulty: DifficultyLevel
  materialType: MaterialType
  fileUrl: string
  previewImageUrl: string | null
  status: ExerciseStatus
  cognitiveAreas: CognitiveArea[]
  ownerId: string | null
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  fullName: string
  specialty: string | null
  role: UserRole
}

export interface Subscription {
  id: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

export interface AuthState {
  user: User | null
  subscription: Subscription | null
  token: string | null
}

export interface Session {
  id: string
  name: string
  description: string | null
  exercises: SessionExercise[]
  createdAt: string
}

export interface SessionExercise {
  id: string
  exercise: Exercise
  orderIndex: number
}

export interface PatientSessionExercise {
  exerciseId: string
  title: string
  cognitiveAreaSlugs: string[]
  difficulty: DifficultyLevel
  materialType: MaterialType
}

export interface PatientSession {
  id: string
  patientId: string
  professionalId: string
  title: string
  exercises: PatientSessionExercise[]
  scheduledDate: string
  notes?: string
  status: 'DRAFT' | 'COMPLETED'
}

export interface Patient {
  id: string
  fullName: string
  birthDate: string          // ISO date string, e.g. "1948-03-15"
  diagnosis?: string         // e.g. "Deterioro cognitivo leve"
  notes?: string
  professionalId: string
  createdAt: string
  lastSessionAt?: string
  /** Whether this patient's family has an active at-home subscription. Derived live from activeHomeSubs. */
  homeSubscriptionActive?: boolean
}

export interface PagedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ApiError {
  message: string
  status: number
}

// ── Patient at-home play ──────────────────────────────────────────────────────

export interface MemoryCard {
  id: string
  pairKey: string  // two cards share the same pairKey
  label: string    // e.g. "Sol"
  icon: string     // key the UI maps to a Lucide icon
}

export interface PatientExercise {
  type: 'MEMORY_PAIRS'
  title: string
  instructions: string
  cards: MemoryCard[]  // already in pairs (e.g. 6 pairs = 12 cards), UNSHUFFLED
}

export interface PatientPlaySession {
  patientFirstName: string
  exercise: PatientExercise
  /** Whether this patient's home subscription is currently active. */
  subscriptionActive: boolean
}

export interface HomeExerciseResult {
  id: string
  exerciseType: 'MEMORY_PAIRS'
  exerciseTitle: string       // e.g. "Memoria"
  completedAt: string         // ISO datetime
  completed: boolean          // did they finish it
  moves: number               // attempts/moves (lower is better for memory)
  durationSeconds: number
}
