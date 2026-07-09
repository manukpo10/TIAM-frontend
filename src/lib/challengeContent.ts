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
  { day: 1, type: 'card', area: 'orientacion', title: 'Empecemos por hoy',
    instructions: 'Sin mirar el celular: ¿qué día de la semana es? ¿Qué fecha, mes y año? ¿En qué estación estamos? Decilo en voz alta o escribilo.' },
  { day: 2, type: 'card', area: 'memoria', title: 'La lista del mercado',
    instructions: 'Leé y memorizá esta lista: pan, leche, manzanas, café, huevos. Tapala, contá hasta 20, y escribí todos los que recuerdes.' },
  { day: 3, type: 'card', area: 'lenguaje', title: 'Un animal por letra',
    instructions: 'Nombrá en voz alta un animal por cada letra del abecedario: A de araña, B de burro… Si te trabás, saltá la letra y seguí.' },
  { day: 4, type: 'game', area: 'atencion', title: 'Cazador de letras',
    instructions: 'Un juego de atención: tocá todas las letras A entre las demás. Subís de dificultad a medida que avanzás.' },
  { day: 5, type: 'card', area: 'calculo', title: 'El vuelto',
    instructions: 'Pagás con un billete de $1.000 algo que cuesta $650. ¿Cuánto te dan de vuelto? Cuando te salga, probá con dos compras más.' },
  { day: 6, type: 'card', area: 'memoria', title: 'Tu primera casa',
    instructions: 'Recordá la casa de tu infancia. ¿Cuántas habitaciones tenía? ¿De qué color era la puerta? ¿Qué se veía desde la ventana? Contáselo a alguien.' },
  { day: 7, type: 'game', area: 'ejecutivas', title: 'Cada cosa en su grupo',
    instructions: 'Un juego de razonamiento: tocá el grupo correcto para cada palabra. Subís de dificultad a medida que avanzás.' },

  // ── Semana 2 — dos pasos, primeras interferencias ─────────────────────────
  { day: 8, type: 'game', area: 'lenguaje', title: 'Ordená la frase',
    instructions: 'Un juego de lenguaje: tocá las palabras en el orden correcto para armar la frase. Subís de dificultad a medida que avanzás.' },
  { day: 9, type: 'card', area: 'praxias', title: 'Copiá el dibujo',
    instructions: 'Mirá la figura de la tarjeta y copiala en una hoja lo más parecida posible, prestando atención a las proporciones y los detalles.' },
  { day: 10, type: 'game', area: 'memoria', title: '¿Qué palabras eran?',
    instructions: 'Un juego de memoria: memorizá las palabras y después elegí cuáles recordás entre las distractoras. Subís de dificultad a medida que avanzás.' },
  // area stays 'atencion' (not 'memoria') so it doesn't repeat day 10 back-to-back —
  // the task itself is a recognition-memory exercise, just labeled by rotation slot.
  { day: 11, type: 'game', area: 'atencion', title: '¿Qué hay en la mesa?',
    instructions: 'Un juego de memoria: observá los objetos de la mesa y después elegí cuáles recordás entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 12, type: 'game', area: 'ejecutivas', title: 'La charla desordenada',
    instructions: 'Un juego de razonamiento: ordená las frases de una conversación en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 13, type: 'card', area: 'calculo', title: 'Contá para atrás',
    instructions: 'Contá en voz alta desde 50 hacia atrás, restando de 3 en 3: 50, 47, 44… ¿Hasta dónde llegás sin equivocarte?' },
  { day: 14, type: 'card', area: 'lenguaje', title: 'Palabras con PA',
    instructions: 'En dos minutos, escribí todas las palabras que empiecen con “pa”: pato, pared, pantalón… ¿Cuántas juntaste?' },

  // ── Semana 3 — combinar áreas / recuerdo demorado ─────────────────────────
  { day: 15, type: 'card', area: 'memoria', title: 'La canción de tu juventud',
    instructions: 'Elegí una canción que te gustaba de joven. Tratá de escribir la primera estrofa de memoria, sin buscarla, y después tarareala.' },
  { day: 16, type: 'card', area: 'ejecutivas', title: 'Adivinanza',
    instructions: 'Pensá con calma: “De lunes a viernes soy la última en llegar; el sábado, la primera. ¿Qué letra soy?”' },
  { day: 17, type: 'card', area: 'atencion', title: 'Dos cosas a la vez',
    instructions: 'Contá de 2 en 2 hasta 20 y, en cada número, nombrá un color distinto. Por ejemplo: 2 rojo, 4 azul, 6 verde…' },
  { day: 18, type: 'card', area: 'praxias', title: '¿Qué será?',
    instructions: 'En el dibujo hay un objeto dibujado a medias, con partes que faltan. Miralo con atención: ¿podés reconocer qué es?' },
  { day: 19, type: 'card', area: 'memoria', title: 'El cuento',
    instructions: 'Leé dos veces una noticia corta del diario. Después, sin mirar, contá: ¿de qué se trataba? ¿qué nombres y lugares aparecían?' },
  { day: 20, type: 'card', area: 'lenguaje', title: '¿Qué objeto es?',
    instructions: 'Adiviná: “Tiene dos ruedas, pedales y un manubrio; sirve para pasear.” Después inventá una definición parecida para otro objeto.' },
  { day: 21, type: 'game', area: 'ejecutivas', title: 'Planificá la mañana',
    instructions: 'Un juego de razonamiento: ordená las tareas de la mañana en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 22, type: 'card', area: 'calculo', title: 'La receta doble',
    instructions: 'Una torta para 4 personas lleva 2 huevos y 200 g de harina. ¿Cuánto necesitás para 8 personas? ¿Y para 6?' },

  // ── Semana 4 — integradoras + cierre ──────────────────────────────────────
  { day: 23, type: 'card', area: 'memoria', title: 'Sabores de antes',
    instructions: 'Recordá una comida que cocinaba alguien de tu familia. ¿Quién la hacía? ¿Qué llevaba? Escribí la receta como la recuerdes.' },
  { day: 24, type: 'game', area: 'atencion', title: 'Buscá los rojos',
    instructions: 'Un juego de atención: tocá los objetos rojos entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 25, type: 'card', area: 'ejecutivas', title: 'El colectivo',
    instructions: 'El colectivo pasa cada 15 minutos. Si perdés el de las 10:00, ¿a qué hora pasan los tres siguientes?' },
  { day: 26, type: 'card', area: 'lenguaje', title: 'Contrarreloj',
    instructions: 'Un minuto por categoría: nombrá todas las frutas que puedas, después ciudades, después profesiones. Anotá cuántas dijiste en cada una.' },
  { day: 27, type: 'card', area: 'praxias', title: 'Dibujo guiado',
    instructions: 'Dibujá una casa con un sol arriba a la derecha, un árbol a la izquierda y un camino que llegue hasta la puerta.' },
  { day: 28, type: 'card', area: 'memoria', title: 'Repaso de la semana',
    instructions: 'Sin mirar, escribí tres ejercicios que hayas hecho en estos días. ¿Cuál te gustó más? ¿Cuál te costó más?' },
  { day: 29, type: 'card', area: 'ejecutivas', title: 'Todo junto',
    instructions: 'Lo más rápido que puedas: nombrá 3 animales, resolvé 8 + 7, y decí en qué mes del año estás. ¡Sin pensarlo demasiado!' },
  { day: 30, type: 'card', area: 'memoria', title: '¡Lo lograste!',
    instructions: 'Pensá cómo te sentías el día 1 y cómo te sentís hoy. Escribí una cosa que te haya gustado del desafío. ¡Felicitaciones por los 30 días! 🎉' },
]

/** Content joined with its per-day illustration (matched by day number). */
export const CHALLENGE_DAYS: ChallengeDayContent[] = DAYS_CONTENT.map((d) => ({
  ...d,
  illustration: illustrationForDay(d.day),
}))
