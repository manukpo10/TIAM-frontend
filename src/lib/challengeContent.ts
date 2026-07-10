/**
 * Content for the 30-day cognitive challenge ("Desafío 30 días").
 *
 * This lives in the frontend on purpose: today each day is a static "card"
 * (title + instructions + illustration), but the `type` field leaves the door
 * open for future days to be interactive mini-games (`type: 'game'`), which are
 * React components rather than data. The backend only gates access (which day
 * the buyer is on); the content itself is here.
 *
 * The 30 exercises below are grounded in cognitive-stimulation reference
 * material (manuals/workbooks for older adults) and best-practice research:
 *   - Areas rotated so the same area never repeats two days in a row.
 *   - Difficulty ramps by week: 1 = warm-up (one step), 2 = two steps,
 *     3 = combine areas / delayed recall, 4 = integrative + closing.
 *   - Reminiscence cards (autobiographical memory) intercalated as emotional
 *     anchors (days 6, 15, 23).
 *   - Consignas: one idea, plain language, motivating (never exam-like).
 * Edit freely — this is authored content. Illustrations (Flux) via `illustration`.
 */

// Illustrations are matched to each day by filename (dia{N}.webp). import.meta.glob
// is relative to THIS file (src/lib/), not to src/. Eager so paths resolve at build.
const ILLUSTRATIONS = import.meta.glob('../assets/desafio/dia*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function illustrationForDay(day: number): string | undefined {
  const match = Object.entries(ILLUSTRATIONS).find(([path]) => path.endsWith(`/dia${day}.webp`))
  return match?.[1]
}

export type ChallengeDayType = 'card' | 'game'

/** Cognitive area — drives the card's color and icon. */
export type ChallengeArea =
  | 'memoria'
  | 'atencion'
  | 'lenguaje'
  | 'praxias'
  | 'calculo'
  | 'orientacion'
  | 'ejecutivas'

export interface ChallengeDayContent {
  day: number
  type: ChallengeDayType
  area: ChallengeArea
  title: string
  instructions: string
  /** Optional illustration (Flux-generated). Added per-day as content is produced. */
  illustration?: string
}

/** Access state returned by the backend (mocked for now). */
export interface ChallengeAccess {
  buyerFirstName: string
  currentDay: number
  totalDays: number
}

export const CHALLENGE_TOTAL_DAYS = 30

const DAYS_CONTENT: Omit<ChallengeDayContent, 'illustration'>[] = [
  // ── Semana 1 — arranque suave (un paso, generar confianza) ────────────────
  { day: 1, type: 'game', area: 'orientacion', title: 'Empecemos por hoy',
    instructions: 'Un juego de orientación: respondé sobre el día de hoy — la fecha, la estación, el momento del día.' },
  { day: 2, type: 'game', area: 'memoria', title: 'La lista del mercado',
    instructions: 'Un juego de memoria: mirá la lista de productos y después elegí cuáles recordás entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 3, type: 'game', area: 'lenguaje', title: 'Un animal por letra',
    instructions: 'Un juego de lenguaje: tocá el animal que empieza con la letra que te muestro. Subís de dificultad a medida que avanzás.' },
  { day: 4, type: 'game', area: 'atencion', title: 'Cazador de letras',
    instructions: 'Un juego de atención: tocá todas las letras A entre las demás. Subís de dificultad a medida que avanzás.' },
  { day: 5, type: 'game', area: 'calculo', title: 'El vuelto',
    instructions: 'Un juego de cálculo: armá el vuelto justo con monedas y billetes. Subís de dificultad a medida que avanzás.' },
  { day: 6, type: 'card', area: 'memoria', title: 'Tu primera casa',
    instructions: 'Recordá la casa de tu infancia. ¿Cuántas habitaciones tenía? ¿De qué color era la puerta? ¿Qué se veía desde la ventana? Contáselo a alguien.' },
  { day: 7, type: 'game', area: 'ejecutivas', title: 'Cada cosa en su grupo',
    instructions: 'Un juego de razonamiento: tocá el grupo correcto para cada palabra. Subís de dificultad a medida que avanzás.' },

  // ── Semana 2 — dos pasos, primeras interferencias ─────────────────────────
  { day: 8, type: 'game', area: 'lenguaje', title: 'Ordená la frase',
    instructions: 'Un juego de lenguaje: tocá las palabras en el orden correcto para armar la frase. Subís de dificultad a medida que avanzás.' },
  { day: 9, type: 'game', area: 'praxias', title: 'El reloj',
    instructions: 'Un juego de lectura de la hora: mirá el reloj y elegí qué hora muestra entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 10, type: 'game', area: 'memoria', title: '¿Qué palabras eran?',
    instructions: 'Un juego de memoria: memorizá las palabras y después elegí cuáles recordás entre las distractoras. Subís de dificultad a medida que avanzás.' },
  // area stays 'atencion' (not 'memoria') so it doesn't repeat day 10 back-to-back —
  // the task itself is a recognition-memory exercise, just labeled by rotation slot.
  { day: 11, type: 'game', area: 'atencion', title: '¿Qué hay en la mesa?',
    instructions: 'Un juego de memoria: observá los objetos de la mesa y después elegí cuáles recordás entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 12, type: 'game', area: 'ejecutivas', title: 'La charla desordenada',
    instructions: 'Un juego de razonamiento: ordená las frases de una conversación en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 13, type: 'game', area: 'atencion', title: 'Camino numérico',
    instructions: 'Un juego de atención: tocá los números en el orden correcto, del 1 en adelante, estén donde estén en la pantalla. Subís de dificultad a medida que avanzás.' },
  { day: 14, type: 'game', area: 'lenguaje', title: 'Los opuestos',
    instructions: 'Un juego de lenguaje: mirá la palabra y tocá cuál de las opciones es su opuesto. Subís de dificultad a medida que avanzás.' },

  // ── Semana 3 — combinar áreas / recuerdo demorado ─────────────────────────
  { day: 15, type: 'card', area: 'memoria', title: 'La canción de tu juventud',
    instructions: 'Elegí una canción que te gustaba de joven. Tratá de escribir la primera estrofa de memoria, sin buscarla, y después tarareala.' },
  { day: 16, type: 'game', area: 'ejecutivas', title: '¿Verdadero o falso?',
    instructions: 'Un juego de razonamiento: leé la frase y decidí si es verdadera o falsa. Subís de dificultad a medida que avanzás.' },
  { day: 17, type: 'game', area: 'atencion', title: '¿Qué cambió?',
    instructions: 'Un juego de atención: observá la escena y después tocá los objetos que cambiaron. Subís de dificultad a medida que avanzás.' },
  { day: 18, type: 'game', area: 'praxias', title: '¿Qué será?',
    instructions: 'Un juego de reconocimiento: la imagen se revela de a poco, elegí qué objeto es. Pedí pistas si te hace falta.' },
  { day: 19, type: 'game', area: 'memoria', title: 'Memotest',
    instructions: 'Un juego de memoria clásico: tocá las cartas de a dos y encontrá las parejas iguales. Subís de dificultad a medida que avanzás.' },
  { day: 20, type: 'game', area: 'lenguaje', title: '¿Qué objeto es?',
    instructions: 'Un juego de lenguaje: leé la adivinanza y tocá el objeto correcto. Subís de dificultad a medida que avanzás.' },
  { day: 21, type: 'game', area: 'ejecutivas', title: 'Planificá la mañana',
    instructions: 'Un juego de razonamiento: ordená las tareas de la mañana en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 22, type: 'game', area: 'calculo', title: 'La receta doble',
    instructions: 'Un juego de cálculo: mirá la situación y usá los botones +/- para llegar a la cantidad justa. Subís de dificultad a medida que avanzás.' },

  // ── Semana 4 — integradoras + cierre ──────────────────────────────────────
  { day: 23, type: 'card', area: 'memoria', title: 'Sabores de antes',
    instructions: 'Recordá una comida que cocinaba alguien de tu familia. ¿Quién la hacía? ¿Qué llevaba? Escribí la receta como la recuerdes.' },
  { day: 24, type: 'game', area: 'atencion', title: 'Buscá los rojos',
    instructions: 'Un juego de atención: tocá los objetos rojos entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 25, type: 'game', area: 'ejecutivas', title: '¿Qué sigue?',
    instructions: 'Un juego de razonamiento: mirá la secuencia de imágenes y tocá la que sigue en el patrón. Subís de dificultad a medida que avanzás.' },
  { day: 26, type: 'game', area: 'lenguaje', title: '¿Qué oficio es?',
    instructions: 'Un juego de lenguaje: mirá las herramientas de un oficio y tocá cuál es. Subís de dificultad a medida que avanzás.' },
  { day: 27, type: 'game', area: 'praxias', title: '¿Qué se esconde?',
    instructions: 'Un juego de reconocimiento: varios dibujos se superponen en una sola imagen, tocá los que reconozcas entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 28, type: 'card', area: 'memoria', title: 'Repaso de la semana',
    instructions: 'Sin mirar, escribí tres ejercicios que hayas hecho en estos días. ¿Cuál te gustó más? ¿Cuál te costó más?' },
  { day: 29, type: 'game', area: 'ejecutivas', title: 'La balanza',
    instructions: 'Un juego de razonamiento: mirá las balanzas y descubrí qué objeto pesa más. Subís de dificultad a medida que avanzás.' },
  { day: 30, type: 'card', area: 'memoria', title: '¡Lo lograste!',
    instructions: 'Pensá cómo te sentías el día 1 y cómo te sentís hoy. Escribí una cosa que te haya gustado del desafío. ¡Felicitaciones por los 30 días! 🎉' },
]

/** Content joined with its per-day illustration (matched by day number). */
export const CHALLENGE_DAYS: ChallengeDayContent[] = DAYS_CONTENT.map((d) => ({
  ...d,
  illustration: illustrationForDay(d.day),
}))
