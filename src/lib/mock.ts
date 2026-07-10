import type { Exercise, PagedResponse, User, Subscription, Patient, PatientSession, PatientPlaySession, HomeExerciseResult } from '@/types'
import { COGNITIVE_AREAS } from '@/lib/utils'
import { CHALLENGE_DAYS, CHALLENGE_TOTAL_DAYS, type ChallengeArea } from '@/lib/challengeContent'
import {
  computeStars,
  type AreaScore,
  type Badge,
  type BadgeId,
  type ChallengeProgress,
  type DayResult,
  type GameResult,
  type StreakInfo,
} from '@/lib/challengeProgress'

/**
 * Temporary mock layer for previewing the UI without a backend.
 * Set MOCK_ENABLED to false (or wire it to VITE_USE_MOCK) once the API is live.
 */
export const MOCK_ENABLED = import.meta.env.VITE_USE_MOCK !== 'false'

const area = (slug: string) => COGNITIVE_AREAS.find(a => a.slug === slug)!

export const MOCK_USER: User = {
  id: 'mock-admin',
  email: 'especialista@tiam.com.ar',
  fullName: 'Especialista TIAM',
  specialty: 'Estimulación cognitiva',
  role: 'ADMIN',
}

export const MOCK_SUBSCRIPTION: Subscription = {
  id: 'mock-sub',
  status: 'TRIAL',
  trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  currentPeriodEnd: null,
}

let mockPatients: Patient[] = [
  {
    id: 'p1',
    fullName: 'Nora Beatriz Fernández',
    birthDate: '1948-03-15',
    diagnosis: 'Deterioro cognitivo leve',
    notes: 'Trabaja bien con ejercicios de fluencia verbal. Prefiere sesiones matutinas.',
    professionalId: 'mock-admin',
    createdAt: '2026-03-10T09:00:00Z',
    lastSessionAt: '2026-06-12T10:30:00Z',
  },
  {
    id: 'p2',
    fullName: 'Héctor Raúl Gutiérrez',
    birthDate: '1941-11-28',
    diagnosis: 'Enfermedad de Alzheimer temprana',
    notes: 'Requiere apoyo familiar. Reacciona bien a estímulos musicales.',
    professionalId: 'mock-admin',
    createdAt: '2026-02-18T14:00:00Z',
    lastSessionAt: '2026-06-10T09:00:00Z',
  },
  {
    id: 'p3',
    fullName: 'Susana Marta López',
    birthDate: '1953-07-04',
    diagnosis: 'ACV con secuelas cognitivas',
    notes: 'Dificultades en praxias visoconstructivas. Buena adherencia al tratamiento.',
    professionalId: 'mock-admin',
    createdAt: '2026-04-05T11:00:00Z',
    lastSessionAt: '2026-06-15T11:00:00Z',
  },
  {
    id: 'p4',
    fullName: 'Roberto Ángel Martínez',
    birthDate: '1945-09-22',
    professionalId: 'mock-admin',
    createdAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'p5',
    fullName: 'Elsa Graciela Romero',
    birthDate: '1950-01-30',
    diagnosis: 'Deterioro cognitivo moderado',
    notes: 'Acompañada por su hija en cada sesión.',
    professionalId: 'mock-admin',
    createdAt: '2026-01-14T08:30:00Z',
    lastSessionAt: '2026-06-18T10:00:00Z',
  },
]

let mockSessions: PatientSession[] = [
  // p1 — Nora Beatriz Fernández
  {
    id: 's1',
    patientId: 'p1',
    professionalId: 'mock-admin',
    title: 'Sesión del 12/06/2026',
    exercises: [
      { exerciseId: '1', title: 'Secuencia de números con atención dividida', cognitiveAreaSlugs: ['atencion', 'funciones-ejecutivas'], difficulty: 'INTERMEDIATE', materialType: 'PRINTABLE' },
      { exerciseId: '2', title: 'Evocación de palabras por categoría', cognitiveAreaSlugs: ['fluencia-verbal', 'memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-06-12T10:30:00Z',
    notes: 'Buena sesión, la paciente respondió bien a los ejercicios de atención.',
    status: 'COMPLETED',
  },
  {
    id: 's2',
    patientId: 'p1',
    professionalId: 'mock-admin',
    title: 'Sesión del 22/05/2026',
    exercises: [
      { exerciseId: '8', title: 'Dictado de palabras — atención sostenida', cognitiveAreaSlugs: ['atencion', 'fluencia-verbal'], difficulty: 'BASIC', materialType: 'VERBAL' },
      { exerciseId: '10', title: 'Recordar la lista del supermercado', cognitiveAreaSlugs: ['memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
      { exerciseId: '11', title: 'Contar hacia atrás de 3 en 3', cognitiveAreaSlugs: ['atencion', 'funciones-ejecutivas'], difficulty: 'INTERMEDIATE', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-05-22T10:30:00Z',
    notes: 'Dificultades con la tarea de conteo regresivo. Se propone más práctica.',
    status: 'COMPLETED',
  },
  {
    id: 's3',
    patientId: 'p1',
    professionalId: 'mock-admin',
    title: 'Sesión del 08/05/2026',
    exercises: [
      { exerciseId: '2', title: 'Evocación de palabras por categoría', cognitiveAreaSlugs: ['fluencia-verbal', 'memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
      { exerciseId: '3', title: 'Canción incompleta — completar cantando', cognitiveAreaSlugs: ['estimulacion-sensorial', 'memoria'], difficulty: 'BASIC', materialType: 'SENSORIAL' },
    ],
    scheduledDate: '2026-05-08T10:30:00Z',
    status: 'COMPLETED',
  },

  // p2 — Héctor Raúl Gutiérrez
  {
    id: 's4',
    patientId: 'p2',
    professionalId: 'mock-admin',
    title: 'Sesión del 10/06/2026',
    exercises: [
      { exerciseId: '3', title: 'Canción incompleta — completar cantando', cognitiveAreaSlugs: ['estimulacion-sensorial', 'memoria'], difficulty: 'BASIC', materialType: 'SENSORIAL' },
      { exerciseId: '10', title: 'Recordar la lista del supermercado', cognitiveAreaSlugs: ['memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-06-10T09:00:00Z',
    notes: 'Se trabajó con canciones conocidas. Muy buena respuesta emocional.',
    status: 'COMPLETED',
  },
  {
    id: 's5',
    patientId: 'p2',
    professionalId: 'mock-admin',
    title: 'Sesión del 27/05/2026',
    exercises: [
      { exerciseId: '6', title: 'Reconocimiento de objetos por el tacto', cognitiveAreaSlugs: ['agnosias', 'estimulacion-sensorial'], difficulty: 'INTERMEDIATE', materialType: 'SENSORIAL' },
      { exerciseId: '8', title: 'Dictado de palabras — atención sostenida', cognitiveAreaSlugs: ['atencion', 'fluencia-verbal'], difficulty: 'BASIC', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-05-27T09:00:00Z',
    notes: 'Asistió con familiar. Requirió más tiempo para completar las actividades.',
    status: 'COMPLETED',
  },
  {
    id: 's6',
    patientId: 'p2',
    professionalId: 'mock-admin',
    title: 'Sesión planificada 25/06/2026',
    exercises: [
      { exerciseId: '2', title: 'Evocación de palabras por categoría', cognitiveAreaSlugs: ['fluencia-verbal', 'memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-06-25T09:00:00Z',
    status: 'DRAFT',
  },

  // p3 — Susana Marta López
  {
    id: 's7',
    patientId: 'p3',
    professionalId: 'mock-admin',
    title: 'Sesión del 15/06/2026',
    exercises: [
      { exerciseId: '5', title: 'Dibujar según una imagen modelo', cognitiveAreaSlugs: ['praxias', 'orientacion-espacial'], difficulty: 'ADVANCED', materialType: 'IMAGE_SEQUENCE' },
      { exerciseId: '4', title: 'Órdenes motrices — tapitas de colores', cognitiveAreaSlugs: ['praxias', 'atencion'], difficulty: 'INTERMEDIATE', materialType: 'SENSORIAL' },
      { exerciseId: '7', title: '¿Dónde está cada cosa? — orientación en el plano', cognitiveAreaSlugs: ['orientacion-espacial'], difficulty: 'BASIC', materialType: 'PRINTABLE' },
    ],
    scheduledDate: '2026-06-15T11:00:00Z',
    notes: 'Progreso notable en praxias visoconstructivas. Continuar con ejercicios de orientación espacial.',
    status: 'COMPLETED',
  },
  {
    id: 's8',
    patientId: 'p3',
    professionalId: 'mock-admin',
    title: 'Sesión del 01/06/2026',
    exercises: [
      { exerciseId: '4', title: 'Órdenes motrices — tapitas de colores', cognitiveAreaSlugs: ['praxias', 'atencion'], difficulty: 'INTERMEDIATE', materialType: 'SENSORIAL' },
      { exerciseId: '1', title: 'Secuencia de números con atención dividida', cognitiveAreaSlugs: ['atencion', 'funciones-ejecutivas'], difficulty: 'INTERMEDIATE', materialType: 'PRINTABLE' },
    ],
    scheduledDate: '2026-06-01T11:00:00Z',
    status: 'COMPLETED',
  },

  // p5 — Elsa Graciela Romero
  {
    id: 's9',
    patientId: 'p5',
    professionalId: 'mock-admin',
    title: 'Sesión del 18/06/2026',
    exercises: [
      { exerciseId: '2', title: 'Evocación de palabras por categoría', cognitiveAreaSlugs: ['fluencia-verbal', 'memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
      { exerciseId: '10', title: 'Recordar la lista del supermercado', cognitiveAreaSlugs: ['memoria'], difficulty: 'BASIC', materialType: 'VERBAL' },
      { exerciseId: '8', title: 'Dictado de palabras — atención sostenida', cognitiveAreaSlugs: ['atencion', 'fluencia-verbal'], difficulty: 'BASIC', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-06-18T10:00:00Z',
    notes: 'La hija de la paciente aportó información sobre su rutina diaria. Buen ambiente de trabajo.',
    status: 'COMPLETED',
  },
  {
    id: 's10',
    patientId: 'p5',
    professionalId: 'mock-admin',
    title: 'Sesión del 04/06/2026',
    exercises: [
      { exerciseId: '3', title: 'Canción incompleta — completar cantando', cognitiveAreaSlugs: ['estimulacion-sensorial', 'memoria'], difficulty: 'BASIC', materialType: 'SENSORIAL' },
      { exerciseId: '6', title: 'Reconocimiento de objetos por el tacto', cognitiveAreaSlugs: ['agnosias', 'estimulacion-sensorial'], difficulty: 'INTERMEDIATE', materialType: 'SENSORIAL' },
    ],
    scheduledDate: '2026-06-04T10:00:00Z',
    status: 'COMPLETED',
  },
  {
    id: 's11',
    patientId: 'p5',
    professionalId: 'mock-admin',
    title: 'Sesión del 20/05/2026',
    exercises: [
      { exerciseId: '7', title: '¿Dónde está cada cosa? — orientación en el plano', cognitiveAreaSlugs: ['orientacion-espacial'], difficulty: 'BASIC', materialType: 'PRINTABLE' },
      { exerciseId: '11', title: 'Contar hacia atrás de 3 en 3', cognitiveAreaSlugs: ['atencion', 'funciones-ejecutivas'], difficulty: 'INTERMEDIATE', materialType: 'VERBAL' },
    ],
    scheduledDate: '2026-05-20T10:00:00Z',
    notes: 'Primera sesión formal. Buena predisposición.',
    status: 'COMPLETED',
  },
]

/**
 * In-memory set of patient tokens that have an active home subscription.
 * Seeded with 'p1' (Nora) so the demo shows BOTH states out of the box:
 * Nora = active (game opens directly, professional sees "Servicio activo"),
 * the rest = inactive (subscription gate shows, professional sees "Sin suscripción").
 * In production, subscription state is managed server-side (Mercado Pago recurring).
 */
const activeHomeSubs = new Set<string>(['p1'])

/**
 * In-memory store of completed challenge-day results, keyed by challenge access
 * token. Mirrors the future `challenge_day_results` table just enough to make
 * POST complete → GET progress round-trip for real in dev — a static canned
 * stub would hide the exact integration bugs this mock exists to catch.
 */
let mockChallengeDayResults: Record<string, DayResult[]> = {}

/**
 * Mocked "current day" for the Desafío access check — bumped to the full 30 so
 * every day is unlocked for preview in dev (see the access handler below). Also
 * bounds the progress handler's streak walk, so the two can't silently disagree
 * about how many days are actually reachable.
 */
const MOCK_CHALLENGE_CURRENT_DAY = 30

/** Days 1-30 minus the 5 static reflection cards — the denominator for badges. */
const PLAYABLE_CHALLENGE_DAYS = CHALLENGE_DAYS.filter((d) => d.type === 'game').length

function paginatePatients(items: Patient[], page: number, size: number): PagedResponse<Patient> {
  const start = page * size
  return {
    content: items.slice(start, start + size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  }
}

let mockExercises: Exercise[] = [
  {
    id: '1',
    title: 'Secuencia de números con atención dividida',
    description: 'El paciente tacha los números pares mientras lee en voz alta los impares.',
    instructions:
      'Entregá la ficha A4 al paciente. Pedile que recorra la grilla de izquierda a derecha:\n1. Tachar con una cruz todos los números pares.\n2. Leer en voz alta los números impares.\nAumentá la dificultad reduciendo el tiempo disponible.',
    difficulty: 'INTERMEDIATE',
    materialType: 'PRINTABLE',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('atencion'), area('funciones-ejecutivas')],
    ownerId: null,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: '2',
    title: 'Evocación de palabras por categoría',
    description: 'Generar la mayor cantidad de palabras de una categoría dada en un minuto.',
    instructions:
      'Decile al paciente una categoría (animales, frutas, nombres). Tiene un minuto para nombrar la mayor cantidad posible. Anotá cuántas dijo. Repetí con categorías de dificultad creciente.',
    difficulty: 'BASIC',
    materialType: 'VERBAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('fluencia-verbal'), area('memoria')],
    ownerId: null,
    createdAt: '2026-05-03T10:00:00Z',
    updatedAt: '2026-05-03T10:00:00Z',
  },
  {
    id: '3',
    title: 'Canción incompleta — completar cantando',
    description: 'Se reproduce una parte de una canción conocida y el paciente la termina.',
    instructions:
      'Reproducí los primeros versos de una canción popular y conocida por el paciente. Pausá y pedile que continúe cantando. Trabaja memoria a largo plazo y estimulación auditiva.',
    difficulty: 'BASIC',
    materialType: 'SENSORIAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('estimulacion-sensorial'), area('memoria')],
    ownerId: null,
    createdAt: '2026-05-05T10:00:00Z',
    updatedAt: '2026-05-05T10:00:00Z',
  },
  {
    id: '4',
    title: 'Órdenes motrices — tapitas de colores',
    description: 'Según el número par o impar, el paciente agarra una tapita del color indicado.',
    instructions:
      'Disponé tapitas de dos colores sobre la mesa. Decí un número en voz alta: si es par, el paciente agarra una tapita roja; si es impar, una azul. Aumentá el ritmo gradualmente.',
    difficulty: 'INTERMEDIATE',
    materialType: 'SENSORIAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('praxias'), area('atencion')],
    ownerId: null,
    createdAt: '2026-05-07T10:00:00Z',
    updatedAt: '2026-05-07T10:00:00Z',
  },
  {
    id: '5',
    title: 'Dibujar según una imagen modelo',
    description: 'Reproducir en el cuaderno una figura presentada como modelo.',
    instructions:
      'Mostrale al paciente una imagen modelo (una casa, un reloj, una figura geométrica). Pedile que la reproduzca en su cuaderno prestando atención a las proporciones. Trabaja praxias visoconstructivas.',
    difficulty: 'ADVANCED',
    materialType: 'IMAGE_SEQUENCE',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('praxias'), area('orientacion-espacial')],
    ownerId: null,
    createdAt: '2026-05-09T10:00:00Z',
    updatedAt: '2026-05-09T10:00:00Z',
  },
  {
    id: '6',
    title: 'Reconocimiento de objetos por el tacto',
    description: 'Identificar objetos cotidianos sin verlos, solo con el tacto.',
    instructions:
      'Colocá varios objetos cotidianos dentro de una bolsa de tela. El paciente introduce la mano y describe e identifica cada objeto sin mirarlo. Trabaja agnosias táctiles.',
    difficulty: 'INTERMEDIATE',
    materialType: 'SENSORIAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('agnosias'), area('estimulacion-sensorial')],
    ownerId: null,
    createdAt: '2026-05-11T10:00:00Z',
    updatedAt: '2026-05-11T10:00:00Z',
  },
  {
    id: '7',
    title: '¿Dónde está cada cosa? — orientación en el plano',
    description: 'Ubicar elementos en un plano de una habitación según consignas espaciales.',
    instructions:
      'Entregá una ficha con el plano de una habitación. Dictá consignas: "poné la cama contra la pared izquierda", "la mesa al lado de la ventana". El paciente dibuja o pega los elementos según corresponda.',
    difficulty: 'BASIC',
    materialType: 'PRINTABLE',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('orientacion-espacial')],
    ownerId: null,
    createdAt: '2026-05-13T10:00:00Z',
    updatedAt: '2026-05-13T10:00:00Z',
  },
  {
    id: '8',
    title: 'Dictado de palabras — atención sostenida',
    description: 'El paciente aplaude cada vez que escucha una palabra con la letra A.',
    instructions:
      'Leé un cuento corto en voz alta. Cada vez que aparezca una palabra con la letra "a", el paciente debe aplaudir. Al final, comentá cuántas detectó. Trabaja atención sostenida y selectiva.',
    difficulty: 'BASIC',
    materialType: 'VERBAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('atencion'), area('fluencia-verbal')],
    ownerId: null,
    createdAt: '2026-05-15T10:00:00Z',
    updatedAt: '2026-05-15T10:00:00Z',
  },
  {
    id: '9',
    title: 'Memoria de imágenes — secuencia oculta',
    description: 'Memorizar una secuencia de imágenes y reproducirla luego de ocultarla.',
    instructions:
      'Mostrá una secuencia de 4 imágenes durante 30 segundos. Ocultala y pedile al paciente que las nombre en orden. Aumentá la cantidad de imágenes a medida que progresa.',
    difficulty: 'ADVANCED',
    materialType: 'IMAGE_SEQUENCE',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'DRAFT',
    cognitiveAreas: [area('memoria'), area('atencion')],
    ownerId: null,
    createdAt: '2026-05-17T10:00:00Z',
    updatedAt: '2026-05-17T10:00:00Z',
  },
  {
    id: '10',
    title: 'Recordar la lista del supermercado',
    description: 'El paciente memoriza una lista de 5 productos y la repite después de una distracción.',
    instructions:
      'Leé en voz alta una lista de 5 productos cotidianos. Hacé una actividad distractora de 2 minutos (conversar, contar). Pedile que recuerde la lista.',
    difficulty: 'BASIC',
    materialType: 'VERBAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('memoria')],
    ownerId: 'mock-admin',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
  },
  {
    id: '11',
    title: 'Contar hacia atrás de 3 en 3',
    description: 'El paciente cuenta regresivamente desde 30 de tres en tres.',
    instructions:
      'Pedile al paciente que cuente hacia atrás desde 30 de tres en tres (30, 27, 24...). Anotá los errores y el tiempo. Aumentá el número de inicio a medida que progresa.',
    difficulty: 'INTERMEDIATE',
    materialType: 'VERBAL',
    fileUrl: '#',
    previewImageUrl: null,
    status: 'PUBLISHED',
    cognitiveAreas: [area('atencion'), area('funciones-ejecutivas')],
    ownerId: 'mock-admin',
    createdAt: '2026-06-02T10:00:00Z',
    updatedAt: '2026-06-02T10:00:00Z',
  },
]

function paginate(items: Exercise[], page: number, size: number): PagedResponse<Exercise> {
  const start = page * size
  return {
    content: items.slice(start, start + size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  }
}

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), 250))
}

/** Resolves a mocked response for a given method + path, or null if unmatched. */
export function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> | null {
  const [rawPath, query = ''] = path.split('?')
  const params = new URLSearchParams(query)

  // Patients
  if (method === 'GET' && rawPath === '/patients') {
    const q = params.get('q')?.toLowerCase()
    const filtered = q
      ? mockPatients.filter(p => p.fullName.toLowerCase().includes(q))
      : mockPatients
    const page = Number(params.get('page') ?? 0)
    const size = Number(params.get('size') ?? 20)
    const withSubs = filtered.map(p => ({ ...p, homeSubscriptionActive: activeHomeSubs.has(p.id) }))
    return delay(paginatePatients(withSubs, page, size)) as Promise<T>
  }

  if (method === 'POST' && rawPath === '/patients') {
    const b = body as Omit<Patient, 'id' | 'createdAt'>
    const created: Patient = {
      ...b,
      id: `p${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    mockPatients = [created, ...mockPatients]
    return delay(created as T)
  }

  const patientSessionsMatch = rawPath.match(/^\/patients\/([\w-]+)\/sessions$/)
  if (method === 'GET' && patientSessionsMatch) {
    const sessions = mockSessions
      .filter(s => s.patientId === patientSessionsMatch[1])
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    return delay(sessions as T)
  }

  const patientGetMatch = rawPath.match(/^\/patients\/([\w-]+)$/)
  if (method === 'GET' && patientGetMatch) {
    const found = mockPatients.find(p => p.id === patientGetMatch[1])
    if (found) {
      return delay({ ...found, homeSubscriptionActive: activeHomeSubs.has(found.id) } as T)
    }
    return delay(found as T)
  }

  const patientEditMatch = rawPath.match(/^\/patients\/([\w-]+)$/)
  if (method === 'PUT' && patientEditMatch) {
    const idx = mockPatients.findIndex(p => p.id === patientEditMatch[1])
    if (idx >= 0) {
      mockPatients[idx] = { ...mockPatients[idx], ...(body as Partial<Patient>) }
      return delay(mockPatients[idx] as T)
    }
  }

  if (method === 'DELETE' && patientEditMatch) {
    mockPatients = mockPatients.filter(p => p.id !== patientEditMatch[1])
    return delay({} as T)
  }

  // Sessions
  if (method === 'POST' && rawPath === '/sessions') {
    const b = body as { patientId: string; title: string; notes?: string; exercises: PatientSession['exercises'] }
    const created: PatientSession = {
      id: 's' + (mockSessions.length + 1) + Date.now(),
      patientId: b.patientId,
      professionalId: 'mock-admin',
      title: b.title,
      exercises: b.exercises,
      scheduledDate: new Date().toISOString(),
      notes: b.notes,
      status: 'COMPLETED',
    }
    mockSessions = [created, ...mockSessions]
    return delay(created as T)
  }

  // Subscription
  if (method === 'GET' && rawPath === '/subscription') {
    return delay(MOCK_SUBSCRIPTION) as Promise<T>
  }

  // Auth
  if (method === 'POST' && (rawPath === '/auth/login' || rawPath === '/auth/register')) {
    return delay({ token: 'mock-token', user: MOCK_USER, subscription: MOCK_SUBSCRIPTION }) as Promise<T>
  }

  if (method === 'POST' && rawPath === '/auth/forgot-password') {
    return delay({ success: true } as T)
  }

  if (method === 'POST' && rawPath === '/auth/reset-password') {
    return delay({ success: true } as T)
  }

  if (method === 'POST' && rawPath === '/profile/change-password') {
    return delay({ success: true } as T)
  }

  // Profile
  if (method === 'PUT' && rawPath === '/profile') {
    const b = body as { fullName?: string; specialty?: string }
    Object.assign(MOCK_USER, b)
    return delay(MOCK_USER as T)
  }

  // Public library list
  if (method === 'GET' && rawPath === '/exercises') {
    const visible = mockExercises.filter(
      e => e.status === 'PUBLISHED' && (e.ownerId === null || e.ownerId === 'mock-admin'),
    )
    return delay(filterAndPage(visible, params)) as Promise<T>
  }

  // Admin list (includes drafts)
  if (method === 'GET' && rawPath === '/admin/exercises') {
    return delay(filterAndPage(mockExercises, params)) as Promise<T>
  }

  // Single exercise (public or admin)
  const detailMatch = rawPath.match(/^\/(admin\/)?exercises\/([\w-]+)$/)
  if (method === 'GET' && detailMatch) {
    const found = mockExercises.find(e => e.id === detailMatch[2])
    return delay(found as T)
  }

  // Create (admin)
  if (method === 'POST' && rawPath === '/admin/exercises') {
    const created = buildExerciseFromBody(body, String(mockExercises.length + 1))
    mockExercises = [created, ...mockExercises]
    return delay(created as T)
  }

  // Create (professional — own exercise)
  if (method === 'POST' && rawPath === '/exercises/mine') {
    const created = buildExerciseFromBody(body, String(mockExercises.length + 1), 'mock-admin')
    mockExercises = [created, ...mockExercises]
    return delay(created as T)
  }

  // Update
  const editMatch = rawPath.match(/^\/admin\/exercises\/([\w-]+)$/)
  if (method === 'PUT' && editMatch) {
    const idx = mockExercises.findIndex(e => e.id === editMatch[1])
    if (idx >= 0) {
      mockExercises[idx] = { ...mockExercises[idx], ...buildExerciseFromBody(body, editMatch[1]) }
      return delay(mockExercises[idx] as T)
    }
  }

  // ── Patient at-home play ──────────────────────────────────────────────────

  const playSubscribeMatch = rawPath.match(/^\/play\/([\w-]+)\/subscribe$/)
  if (method === 'POST' && playSubscribeMatch) {
    // MVP mock: immediately activates the home subscription for this patient token.
    // In production this initiates a Mercado Pago recurring subscription and
    // the backend marks subscriptionActive=true only after payment confirmation.
    activeHomeSubs.add(playSubscribeMatch[1])
    return delay({ success: true } as T)
  }

  const playGetMatch = rawPath.match(/^\/play\/([\w-]+)$/)
  if (method === 'GET' && playGetMatch) {
    // MVP: the token IS the patient id (e.g. "p1").
    // In production the token will be an opaque server-generated value that
    // the backend resolves to a patient + assigned exercise — never the raw id.
    const tokenOrId = playGetMatch[1]
    const foundPatient = mockPatients.find(p => p.id === tokenOrId)
    const patientFirstName = foundPatient
      ? foundPatient.fullName.split(' ')[0]
      : 'Paciente'

    const session: PatientPlaySession = {
      patientFirstName,
      subscriptionActive: activeHomeSubs.has(tokenOrId),
      exercise: {
        type: 'MEMORY_PAIRS',
        title: 'Memoria',
        instructions: 'Encontrá las parejas. Tocá dos tarjetas para darlas vuelta.',
        cards: [
          { id: 'c1',  pairKey: 'sol',      label: 'Sol',     icon: 'Sun'      },
          { id: 'c2',  pairKey: 'sol',      label: 'Sol',     icon: 'Sun'      },
          { id: 'c3',  pairKey: 'casa',     label: 'Casa',    icon: 'Home'     },
          { id: 'c4',  pairKey: 'casa',     label: 'Casa',    icon: 'Home'     },
          { id: 'c5',  pairKey: 'mascota',  label: 'Perrito', icon: 'PawPrint' },
          { id: 'c6',  pairKey: 'mascota',  label: 'Perrito', icon: 'PawPrint' },
          { id: 'c7',  pairKey: 'flor',     label: 'Flor',    icon: 'Flower2'  },
          { id: 'c8',  pairKey: 'flor',     label: 'Flor',    icon: 'Flower2'  },
          { id: 'c9',  pairKey: 'auto',     label: 'Auto',    icon: 'Car'      },
          { id: 'c10', pairKey: 'auto',     label: 'Auto',    icon: 'Car'      },
          { id: 'c11', pairKey: 'estrella', label: 'Estrella',icon: 'Star'     },
          { id: 'c12', pairKey: 'estrella', label: 'Estrella',icon: 'Star'     },
        ],
      },
    }
    return delay(session as T)
  }

  const playCompleteMatch = rawPath.match(/^\/play\/([\w-]+)\/complete$/)
  if (method === 'POST' && playCompleteMatch) {
    return delay({ success: true } as T)
  }

  // ── Home exercise results (professional view) ────────────────────────────
  // In production these come from the patient's actual completed games, persisted server-side.
  const homeResultsMatch = rawPath.match(/^\/patients\/([\w-]+)\/home-results$/)
  if (method === 'GET' && homeResultsMatch) {
    const pid = homeResultsMatch[1]
    if (!activeHomeSubs.has(pid)) {
      return delay([] as T)
    }
    // 10 results for p1 (Nora) — showing a clear improvement trend over ~2 weeks.
    // Earliest entries: higher moves (more attempts), longer durations.
    // Recent entries: lower moves, shorter durations.
    const results: HomeExerciseResult[] = [
      { id: 'hr10', exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-21T09:15:00Z', completed: true, moves: 7,  durationSeconds: 118 },
      { id: 'hr9',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-20T10:05:00Z', completed: true, moves: 8,  durationSeconds: 125 },
      { id: 'hr8',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-19T09:50:00Z', completed: true, moves: 9,  durationSeconds: 134 },
      { id: 'hr7',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-18T10:30:00Z', completed: true, moves: 10, durationSeconds: 142 },
      { id: 'hr6',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-16T11:00:00Z', completed: true, moves: 11, durationSeconds: 158 },
      { id: 'hr5',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-14T09:40:00Z', completed: true, moves: 12, durationSeconds: 170 },
      { id: 'hr4',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-12T10:20:00Z', completed: true, moves: 13, durationSeconds: 185 },
      { id: 'hr3',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-11T09:30:00Z', completed: true, moves: 15, durationSeconds: 200 },
      { id: 'hr2',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-09T10:10:00Z', completed: true, moves: 13, durationSeconds: 195 },
      { id: 'hr1',  exerciseType: 'MEMORY_PAIRS', exerciseTitle: 'Memoria', completedAt: '2026-06-08T09:00:00Z', completed: true, moves: 14, durationSeconds: 210 },
    ]
    return delay(results as T)
  }

  // ── Challenge (Desafío 30 días) — daily content access by token ──────────
  const challengeAccessMatch = rawPath.match(/^\/challenge\/([\w-]+)$/)
  if (method === 'GET' && challengeAccessMatch) {
    // Mock access state. Bump currentDay to 30 to preview all cards unlocked in dev;
    // in production the backend computes this from the purchase date.
    return delay({
      buyerFirstName: 'Manuel',
      currentDay: MOCK_CHALLENGE_CURRENT_DAY,
      totalDays: CHALLENGE_TOTAL_DAYS,
    } as T)
  }

  // ── Challenge (Desafío 30 días) — day completion ──────────────────────────
  const challengeCompleteMatch = rawPath.match(/^\/challenge\/([\w-]+)\/days\/(\d+)\/complete$/)
  if (method === 'POST' && challengeCompleteMatch) {
    const token = challengeCompleteMatch[1]
    const day = Number(challengeCompleteMatch[2])
    const { mistakes, totalAttempts } = body as GameResult
    const area: ChallengeArea = CHALLENGE_DAYS.find((d) => d.day === day)?.area ?? 'memoria'
    const stars = computeStars(mistakes, totalAttempts)

    const existingForToken = mockChallengeDayResults[token] ?? []
    const previous = existingForToken.find((r) => r.day === day)
    // Upsert-keep-best: a replay never lowers the star already earned for this day.
    // A TIE still overwrites (fresh mistakes/totalAttempts/playedAt) — only a
    // STRICTLY better previous score is kept — matching the real backend's tested
    // behavior (completeDay_replayWithEqualStars_stillOverwritesMistakes).
    const result: DayResult =
      previous && previous.stars > stars
        ? previous
        : { day, area, mistakes, totalAttempts, stars, playedAt: new Date().toISOString() }

    mockChallengeDayResults = {
      ...mockChallengeDayResults,
      [token]: [...existingForToken.filter((r) => r.day !== day), result],
    }
    return delay(result as T)
  }

  // ── Challenge (Desafío 30 días) — stars/streak/badges/area progress ───────
  const challengeProgressMatch = rawPath.match(/^\/challenge\/([\w-]+)\/progress$/)
  if (method === 'GET' && challengeProgressMatch) {
    const token = challengeProgressMatch[1]
    return delay(buildChallengeProgress(mockChallengeDayResults[token] ?? []) as T)
  }

  // ── Challenge (Desafío 30 días) one-time purchase ────────────────────────
  if (method === 'POST' && rawPath === '/challenge/purchases') {
    // Mock: returns a placeholder checkout URL. In production this creates a
    // Mercado Pago preference and returns the real init_point to redirect to.
    return delay({ checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK' } as T)
  }

  return null
}

// ── Challenge (Desafío 30 días) progress computation ────────────────────────
// Pure functions over the in-memory `mockChallengeDayResults` store, kept
// separate from the dispatcher above so GET /progress reads as one call.

function buildChallengeProgress(results: DayResult[]): ChallengeProgress {
  const streak = computeChallengeStreak(results)
  return {
    days: [...results].sort((a, b) => a.day - b.day),
    streak,
    badges: computeChallengeBadges(results, streak),
    areaBreakdown: computeChallengeAreaBreakdown(results),
  }
}

/**
 * Walks the day chain in order (1→30, bounded by MOCK_CHALLENGE_CURRENT_DAY so
 * not-yet-unlocked days are never mistaken for missed ones). 'card' days (6, 15,
 * 23, 28, 30) have no completion event and always pass automatically — they must
 * never break a streak. 'game' days pass only if a result was recorded. `current`
 * is the run still active at the end of the walk (a gap resets it, so playing
 * later days out of order — easy to do in dev, where every day is unlocked —
 * correctly does NOT count towards it); `longest` is the best run seen anywhere.
 */
function computeChallengeStreak(results: DayResult[]): StreakInfo {
  const playedDays = new Set(results.map((r) => r.day))
  let running = 0
  let longest = 0
  for (const d of CHALLENGE_DAYS) {
    if (d.day > MOCK_CHALLENGE_CURRENT_DAY) break
    const passed = d.type === 'card' || playedDays.has(d.day)
    if (passed) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }
  return { current: running, longest }
}

/**
 * Small, non-exhaustive starter set (per the design doc): first day played,
 * a 3-day streak, a 7-day streak, halfway through the 25 playable days, the
 * full challenge, and a single 3-star day. Only earned badges are returned.
 * `earnedAt` is approximated as the most recent play in the store rather than
 * the exact historical moment each one first unlocked — nothing consumes this
 * field yet (the progress panel is a later phase), so precise tracking isn't
 * worth the extra bookkeeping until it has a reader.
 */
function computeChallengeBadges(results: DayResult[], streak: StreakInfo): Badge[] {
  if (results.length === 0) return []
  const latestPlayedAt = results.reduce((latest, r) => (r.playedAt > latest ? r.playedAt : latest), results[0].playedAt)

  const catalog: { id: BadgeId; label: string; description: string; earned: boolean }[] = [
    {
      id: 'first_day',
      label: 'Primer paso',
      description: 'Jugaste tu primer día del desafío.',
      earned: results.length >= 1,
    },
    {
      id: 'streak_3',
      label: 'Racha de 3',
      description: 'Completaste 3 días seguidos.',
      earned: streak.longest >= 3,
    },
    {
      id: 'streak_7',
      label: 'Racha de 7',
      description: 'Completaste 7 días seguidos.',
      earned: streak.longest >= 7,
    },
    {
      id: 'halfway',
      label: 'Mitad de camino',
      description: 'Llegaste a la mitad de los ejercicios del desafío.',
      earned: results.length >= Math.ceil(PLAYABLE_CHALLENGE_DAYS / 2),
    },
    {
      id: 'challenge_complete',
      label: 'Desafío completo',
      description: 'Jugaste los 25 ejercicios del desafío.',
      earned: results.length >= PLAYABLE_CHALLENGE_DAYS,
    },
    {
      id: 'three_star_day',
      label: 'Día perfecto',
      description: 'Conseguiste 3 estrellas en un día.',
      earned: results.some((r) => r.stars === 3),
    },
  ]

  return catalog
    .filter((b) => b.earned)
    .map(({ id, label, description }) => ({ id, label, description, earnedAt: latestPlayedAt }))
}

function computeChallengeAreaBreakdown(results: DayResult[]): AreaScore[] {
  const areas: ChallengeArea[] = ['memoria', 'atencion', 'lenguaje', 'praxias', 'calculo', 'orientacion', 'ejecutivas']
  return areas.map((area) => {
    const daysTotal = CHALLENGE_DAYS.filter((d) => d.area === area && d.type === 'game').length
    const playedForArea = results.filter((r) => r.area === area)
    return {
      area,
      starsEarned: playedForArea.reduce((sum, r) => sum + r.stars, 0),
      daysPlayed: playedForArea.length,
      daysTotal,
    }
  })
}

function filterAndPage(source: Exercise[], params: URLSearchParams): PagedResponse<Exercise> {
  let items = source
  const difficulty = params.get('difficulty')
  const areas = params.get('areas')
  const q = params.get('q')
  const owner = params.get('owner')

  if (q) {
    const lower = q.toLowerCase()
    items = items.filter(e => e.title.toLowerCase().includes(lower))
  }
  if (difficulty) {
    items = items.filter(e => e.difficulty === difficulty)
  }
  if (areas) {
    const slugs = areas.split(',')
    // AND semantics: the exercise must contain ALL selected areas.
    items = items.filter(e => slugs.every(slug => e.cognitiveAreas.some(a => a.slug === slug)))
  }
  if (owner === 'tiam') {
    items = items.filter(e => e.ownerId === null)
  } else if (owner === 'mine') {
    items = items.filter(e => e.ownerId === 'mock-admin')
  }

  const page = Number(params.get('page') ?? 0)
  const size = Number(params.get('size') ?? 12)
  return paginate(items, page, size)
}

function buildExerciseFromBody(body: unknown, id: string, ownerId: string | null = null): Exercise {
  const b = body as {
    title: string
    description: string
    instructions: string
    difficulty: Exercise['difficulty']
    materialType: Exercise['materialType']
    cognitiveAreaIds: string[]
    status?: Exercise['status']
  }
  return {
    id,
    title: b.title,
    description: b.description,
    instructions: b.instructions,
    difficulty: b.difficulty,
    materialType: b.materialType,
    fileUrl: '#',
    previewImageUrl: null,
    status: b.status ?? 'PUBLISHED',
    cognitiveAreas: COGNITIVE_AREAS.filter(a => b.cognitiveAreaIds.includes(a.id)),
    ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
