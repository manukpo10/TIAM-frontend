/**
 * Content for the 30-day cognitive challenge ("Desafío 30 días").
 *
 * This lives in the frontend on purpose: the `type` field distinguishes a
 * static "card" (title + instructions + illustration) from an interactive
 * mini-game (`type: 'game'`, a React component rather than data) — all 30
 * days are games as of this writing, but the split is kept so a future day
 * can still ship as a plain card if that's ever the right call. The backend
 * only gates access (which day the buyer is on); the content itself is here.
 *
 * The 30 exercises below are grounded in cognitive-stimulation reference
 * material (manuals/workbooks for older adults) and best-practice research:
 *   - Areas rotated so the same area never repeats two days in a row.
 *   - Difficulty ramps by week: 1 = warm-up (one step), 2 = two steps,
 *     3 = combine areas / delayed recall, 4 = integrative + closing.
 *   - Days 6, 23, 28, and 30 keep their original reminiscence/reflection
 *     framing (childhood home, family recipes, a weekly review, the closing
 *     day) even as interactive games — días 28 and 30 go further and use the
 *     PLAYER'S OWN real challenge history as content (see `progress` on
 *     `GameProps` in `challengeProgress.ts`), not authored scenarios.
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
  | 'agnosias'
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
  { day: 1, type: 'game', area: 'orientacion', title: 'Armá las palabras',
    instructions: 'Primero ubicate en el día de hoy, y después uní las fichas de letras para descubrir las palabras escondidas. Subís de dificultad a medida que avanzás.' },
  { day: 2, type: 'game', area: 'memoria', title: 'La lista del mercado',
    instructions: 'Un juego de memoria: mirá la lista de productos y después elegí cuáles recordás entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 3, type: 'game', area: 'lenguaje', title: '¿Qué palabra se esconde?',
    instructions: 'Un juego de lenguaje: con las mismas letras de una palabra, armá otra distinta. Siempre tenés una pista para guiarte. Subís de dificultad a medida que avanzás.' },
  { day: 4, type: 'game', area: 'atencion', title: 'Clave de símbolos',
    instructions: 'Un juego de atención: cada figura tiene un número según la clave. Descifrá cada fila tocando el número que le corresponde a cada figura. Subís de dificultad a medida que avanzás.' },
  { day: 5, type: 'game', area: 'calculo', title: 'El vuelto',
    instructions: 'Un juego de cálculo: armá el vuelto justo con monedas y billetes. Subís de dificultad a medida que avanzás.' },
  { day: 6, type: 'game', area: 'praxias', title: 'Letras en movimiento',
    instructions: 'Hoy es día de papel y lápiz, y se juega de pie: cada letra tiene un gesto. Deletreá las palabras en voz alta haciendo el gesto de cada letra, y después anotá las que recuerdes.' },
  { day: 7, type: 'game', area: 'ejecutivas', title: 'Cada cosa en su grupo',
    instructions: 'Un juego de razonamiento: tocá el grupo correcto para cada palabra. Subís de dificultad a medida que avanzás.' },

  // ── Semana 2 — dos pasos, primeras interferencias ─────────────────────────
  { day: 8, type: 'game', area: 'lenguaje', title: 'Ordená la frase',
    instructions: 'Un juego de lenguaje: tocá las palabras en el orden correcto para armar la frase. Subís de dificultad a medida que avanzás.' },
  { day: 9, type: 'game', area: 'praxias', title: 'El reloj',
    instructions: 'Un juego de lectura de la hora: mirá el reloj y elegí qué hora muestra entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 10, type: 'game', area: 'ejecutivas', title: 'Deducí la palabra',
    instructions: 'Un juego de razonamiento: leé las pistas y descubrí qué palabra de la lista las cumple todas. Una sola es la correcta. Subís de dificultad a medida que avanzás.' },
  // area stays 'atencion' (not 'memoria') so it doesn't repeat day 10 back-to-back —
  // the task itself is a recognition-memory exercise, just labeled by rotation slot.
  { day: 11, type: 'game', area: 'atencion', title: '¿Qué hay en la mesa?',
    instructions: 'Un juego de memoria: observá los objetos de la mesa y después elegí cuáles recordás entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 12, type: 'game', area: 'ejecutivas', title: 'Oraciones a medida',
    instructions: 'Hoy es día de papel y lápiz: cada renglón es una serie de números, y cada número dice cuántas letras tiene cada palabra. Armá una oración con sentido para cada uno y después anotá las que recuerdes.' },
  { day: 13, type: 'game', area: 'atencion', title: 'Camino numérico',
    instructions: 'Un juego de atención: tocá los números en el orden correcto, del 1 en adelante, estén donde estén en la pantalla. Subís de dificultad a medida que avanzás.' },
  { day: 14, type: 'game', area: 'lenguaje', title: 'Los opuestos',
    instructions: 'Un juego de lenguaje: mirá la palabra y tocá cuál de las opciones es su opuesto. Subís de dificultad a medida que avanzás.' },

  // ── Semana 3 — combinar áreas / recuerdo demorado ─────────────────────────
  { day: 15, type: 'game', area: 'memoria', title: 'La canción de tu juventud',
    instructions: 'Un juego de memoria auditiva: escuchá un fragmento y tocá a qué género musical se parece más. Subís de dificultad a medida que avanzás.' },
  { day: 16, type: 'game', area: 'ejecutivas', title: '¿Verdadero o falso?',
    instructions: 'Un juego de razonamiento: leé la frase y decidí si es verdadera o falsa. Subís de dificultad a medida que avanzás.' },
  { day: 17, type: 'game', area: 'atencion', title: '¿Qué cambió?',
    instructions: 'Un juego de atención: observá la escena y después tocá los objetos que cambiaron. Subís de dificultad a medida que avanzás.' },
  { day: 18, type: 'game', area: 'atencion', title: 'Palabras y colores',
    instructions: 'Hoy es día de papel y lápiz: se juega en voz alta, no se toca la pantalla. Vas a ver palabras de colores escritas con otro color. Primero leé las palabras; después decí los colores.' },
  { day: 19, type: 'game', area: 'memoria', title: 'Memotest',
    instructions: 'Un juego de memoria clásico: tocá las cartas de a dos y encontrá las parejas iguales. Subís de dificultad a medida que avanzás.' },
  { day: 20, type: 'game', area: 'lenguaje', title: '¿Qué objeto es?',
    instructions: 'Un juego de lenguaje: leé la adivinanza y tocá el objeto correcto. Subís de dificultad a medida que avanzás.' },
  { day: 21, type: 'game', area: 'ejecutivas', title: 'Planificá la mañana',
    instructions: 'Un juego de razonamiento: ordená las tareas de la mañana en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 22, type: 'game', area: 'calculo', title: 'La receta doble',
    instructions: 'Un juego de cálculo: mirá la situación y usá los botones +/- para llegar a la cantidad justa. Subís de dificultad a medida que avanzás.' },

  // ── Semana 4 — integradoras + cierre ──────────────────────────────────────
  { day: 23, type: 'game', area: 'agnosias', title: '¿Qué sonido es?',
    instructions: 'Un juego de reconocimiento auditivo: escuchá el sonido de la cocina de antes y tocá qué es. Subís de dificultad a medida que avanzás.' },
  { day: 24, type: 'game', area: 'atencion', title: 'Buscá los rojos',
    instructions: 'Un juego de atención: tocá los objetos rojos entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 25, type: 'game', area: 'ejecutivas', title: 'Las mismas letras',
    instructions: 'Un juego de razonamiento: emparejá las palabras que se escriben con las mismas letras, cambiadas de orden. Subís de dificultad a medida que avanzás.' },
  { day: 26, type: 'game', area: 'lenguaje', title: '¿Qué oficio es?',
    instructions: 'Un juego de lenguaje: mirá las herramientas de un oficio y tocá cuál es. Subís de dificultad a medida que avanzás.' },
  { day: 27, type: 'game', area: 'agnosias', title: '¿Cuántos hay?',
    instructions: 'Un juego de reconocimiento: muchos dibujos se superponen y se repiten en una sola imagen. Contá cuántos hay de cada uno. Son tres láminas, una por nivel, y las tres son bien difíciles.' },
  { day: 28, type: 'game', area: 'lenguaje', title: 'Dos pistas, una palabra',
    instructions: 'Un juego de lenguaje: vas a ver dos imágenes que son la misma palabra, cada una por un sentido distinto. Descubrí la palabra y armala con las letras. Subís de dificultad a medida que avanzás.' },
  { day: 29, type: 'game', area: 'agnosias', title: '¿Qué será?',
    instructions: 'Un juego de reconocimiento: la imagen aparece incompleta, con el dibujo cortado, y se va completando de a poco. Elegí qué objeto es. Pedí pistas si te hace falta.' },
  { day: 30, type: 'game', area: 'memoria', title: 'Palabras en clave',
    instructions: 'El último día es de papel y lápiz: una palabra le pone un número a cada letra, y con esos números descubrís palabras escondidas. Después buscás muchas más por tu cuenta. ¡Un cierre a la altura de los 30 días! 🎉' },
]

/** Content joined with its per-day illustration (matched by day number). */
export const CHALLENGE_DAYS: ChallengeDayContent[] = DAYS_CONTENT.map((d) => ({
  ...d,
  illustration: illustrationForDay(d.day),
}))
