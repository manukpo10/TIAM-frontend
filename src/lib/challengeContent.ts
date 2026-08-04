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
 *
 * Content is indexed by challenge month (`CHALLENGE_CONTENT_BY_MONTH`) — "Desafío
 * 30 días" is sold per-month as an independent one-time purchase, and each month
 * has its own 30-entry catalog. Month 1 is the original catalog below, unchanged.
 * Month 2 (and beyond) follow the same shape but are authored separately further
 * down this file. `CHALLENGE_DAYS` is kept as a month-1 alias so existing code that
 * predates months (mock.ts, ChallengeProgressPanel, OrdenaTuSemana's own-history
 * lookup) keeps working unchanged.
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
  /** Which 30-day catalog this purchase unlocks (1 = original month, 2 = month 2,
   * …). Optional because the backend's `challengeMonth` field is being added in
   * parallel and older/in-flight responses may not carry it yet — always read
   * this as `access.challengeMonth ?? 1` so those buyers see month 1, unchanged. */
  challengeMonth?: number
}

export const CHALLENGE_TOTAL_DAYS = 30

const MONTH_1_DAYS_CONTENT: Omit<ChallengeDayContent, 'illustration'>[] = [
  // ── Semana 1 — arranque suave (un paso, generar confianza) ────────────────
  { day: 1, type: 'game', area: 'lenguaje', title: 'Armá las palabras',
    instructions: 'Un juego de lenguaje: uní las fichas de letras para descubrir las palabras escondidas. Subís de dificultad a medida que avanzás.' },
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
  { day: 10, type: 'game', area: 'memoria', title: 'La canción de tu juventud',
    instructions: 'Un juego de memoria auditiva: escuchá un fragmento y tocá a qué género musical se parece más. Subís de dificultad a medida que avanzás.' },
  // Odd-one-out: attentional scanning + categorical reasoning. Kept 'atencion'
  // (the slot's existing area) to avoid a backend change and because the scan-
  // and-compare demand is genuinely attentional.
  { day: 11, type: 'game', area: 'atencion', title: '¿Cuál no va?',
    instructions: 'Un juego de atención y razonamiento: mirá las fotos y tocá la que NO va con las demás. Subís de dificultad a medida que avanzás.' },
  { day: 12, type: 'game', area: 'ejecutivas', title: 'Oraciones a medida',
    instructions: 'Hoy es día de papel y lápiz: cada renglón es una serie de números, y cada número dice cuántas letras tiene cada palabra. Armá una oración con sentido para cada uno y después anotá las que recuerdes.' },
  { day: 13, type: 'game', area: 'orientacion', title: 'Empecemos por hoy',
    instructions: 'Un ejercicio de orientación: respondé sobre el día de hoy — qué día de la semana es, la fecha, el mes, el año, la estación y el momento del día. Ubicarse en el presente también es ejercitar la cabeza.' },
  { day: 14, type: 'game', area: 'lenguaje', title: 'Los opuestos',
    instructions: 'Un juego de lenguaje: mirá la palabra y tocá cuál de las opciones es su opuesto. Subís de dificultad a medida que avanzás.' },

  // ── Semana 3 — combinar áreas / recuerdo demorado ─────────────────────────
  { day: 15, type: 'game', area: 'ejecutivas', title: 'Deducí la palabra',
    instructions: 'Un juego de razonamiento: leé las pistas y descubrí qué palabra de la lista las cumple todas. Una sola es la correcta. Subís de dificultad a medida que avanzás.' },
  { day: 16, type: 'game', area: 'calculo', title: 'La pirámide',
    instructions: 'Un juego de cálculo: cada número de la pirámide es la suma de los dos que tiene abajo. Completá los casilleros vacíos. Subís de dificultad a medida que avanzás.' },
  { day: 17, type: 'game', area: 'agnosias', title: '¿Cuántos hay?',
    instructions: 'Un juego de reconocimiento: muchos dibujos se superponen y se repiten en una sola imagen. Contá cuántos hay de cada uno. Son tres láminas, una por nivel, y las tres son bien difíciles.' },
  { day: 18, type: 'game', area: 'atencion', title: 'Palabras y colores',
    instructions: 'Hoy es día de papel y lápiz: se juega en voz alta, no se toca la pantalla. Vas a ver palabras de colores escritas con otro color. Primero leé las palabras; después decí los colores.' },
  { day: 19, type: 'game', area: 'memoria', title: 'Memotest',
    instructions: 'Un juego de memoria clásico: tocá las cartas de a dos y encontrá las parejas iguales. Subís de dificultad a medida que avanzás.' },
  { day: 20, type: 'game', area: 'praxias', title: '¿Dónde está?',
    instructions: 'Un juego visoespacial: mirá dónde está la figura respecto de la caja y tocá cómo se llama esa posición. Subís de dificultad a medida que avanzás.' },
  { day: 21, type: 'game', area: 'ejecutivas', title: 'Planificá la mañana',
    instructions: 'Un juego de razonamiento: ordená las tareas de la mañana en el orden correcto. Subís de dificultad a medida que avanzás.' },
  { day: 22, type: 'game', area: 'ejecutivas', title: '¿Qué oficio le queda?',
    instructions: 'Un juego de razonamiento: leé la historia de cada persona y tocá qué oficio le queda mejor. Subís de dificultad a medida que avanzás.' },

  // ── Semana 4 — integradoras + cierre ──────────────────────────────────────
  { day: 23, type: 'game', area: 'agnosias', title: 'Una letra de cada uno',
    instructions: 'Un juego de reconocimiento: mirá cada dibujo, date cuenta qué objeto es y sacale una letra según la regla que tiene abajo. Todas juntas, en orden, arman una palabra escondida. Subís de dificultad a medida que avanzás.' },
  { day: 24, type: 'game', area: 'atencion', title: 'Buscá los rojos',
    instructions: 'Un juego de atención: tocá los objetos rojos entre los distractores. Subís de dificultad a medida que avanzás.' },
  { day: 25, type: 'game', area: 'ejecutivas', title: 'Las mismas letras',
    instructions: 'Un juego de razonamiento: emparejá las palabras que se escriben con las mismas letras, cambiadas de orden. Subís de dificultad a medida que avanzás.' },
  { day: 26, type: 'game', area: 'calculo', title: 'La receta doble',
    instructions: 'Un juego de cálculo: mirá la situación y usá los botones +/- para llegar a la cantidad justa. Subís de dificultad a medida que avanzás.' },
  { day: 27, type: 'game', area: 'atencion', title: '¿Qué cambió?',
    instructions: 'Un juego de atención: observá la escena y después tocá los objetos que cambiaron. Subís de dificultad a medida que avanzás.' },
  { day: 28, type: 'game', area: 'lenguaje', title: 'Dos pistas, una palabra',
    instructions: 'Un juego de lenguaje: vas a ver dos imágenes que son la misma palabra, cada una por un sentido distinto. Descubrí la palabra y armala con las letras. Subís de dificultad a medida que avanzás.' },
  { day: 29, type: 'game', area: 'agnosias', title: '¿Qué será?',
    instructions: 'Un juego de reconocimiento: la imagen aparece incompleta, con el dibujo cortado, y se va completando de a poco. Elegí qué objeto es. Pedí pistas si te hace falta.' },
  { day: 30, type: 'game', area: 'memoria', title: 'Palabras en clave',
    instructions: 'El último día es de papel y lápiz: una palabra le pone un número a cada letra, y con esos números descubrís palabras escondidas. Después buscás muchas más por tu cuenta. ¡Un cierre a la altura de los 30 días! 🎉' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Month 2 — second independent 30-day catalog, sold separately at the same
// price as month 1. All 30 days now have a real interactive component wired
// in registry.ts's `GAMES_BY_MONTH[2]`, and `instructions` below describe
// each game's actual mechanic (voice/length matched to month 1's entries).
// `illustration` is still left unset on purpose, unlike month 1's
// `dia{N}.webp` art: that art is matched by day NUMBER ONLY via
// `illustrationForDay`, so reusing it here would show the wrong picture for a
// same-numbered but different day, and every month-2 game already carries its
// own in-game imagery (or needs none) rather than a static pre-game
// illustration. All entries are `type: 'game'`, same as month 1.
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_2_DAYS_CONTENT: Omit<ChallengeDayContent, 'illustration'>[] = [
  { day: 1, type: 'game', area: 'lenguaje', title: 'Dichos a medias',
    instructions: 'Un juego de lenguaje: elegí, entre varias opciones, la palabra que completa el dicho o refrán popular. Subís de dificultad a medida que avanzás.' },
  { day: 2, type: 'game', area: 'memoria', title: 'Repetí la serie',
    instructions: 'Un juego de memoria: mirá la serie de números que aparece y repetila tocando los números en el mismo orden. Subís de dificultad a medida que avanzás.' },
  { day: 3, type: 'game', area: 'atencion', title: 'A buscar y encontrar',
    instructions: 'Un juego de atención: encontrá y tocá, en la escena, cada uno de los objetos de la lista. Subís de dificultad a medida que avanzás.' },
  { day: 4, type: 'game', area: 'calculo', title: 'El descuento',
    instructions: 'Un juego de cálculo: mirá el precio y el descuento, y tocá cuál es el precio final correcto entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 5, type: 'game', area: 'praxias', title: 'Copiá la figura',
    instructions: 'Un juego visoespacial: mirá la figura de modelo y reconstruila tocando los puntos en el mismo orden. Subís de dificultad a medida que avanzás.' },
  { day: 6, type: 'game', area: 'ejecutivas', title: 'Uniendo puntos',
    instructions: 'Un juego de razonamiento: uní los puntos, tocándolos en orden, para descubrir el dibujo escondido. Subís de dificultad a medida que avanzás.' },
  { day: 7, type: 'game', area: 'lenguaje', title: 'Jeroglífico',
    instructions: 'Un juego de lenguaje: usando la clave de figuras y letras, descifrá la frase escondida tocando la letra correcta para cada figura. Subís de dificultad a medida que avanzás.' },
  { day: 8, type: 'game', area: 'memoria', title: '¿Quién es quién?',
    instructions: 'Un juego de memoria: memorizá las caras con sus nombres y después reconocé quién es quién. Subís de dificultad a medida que avanzás.' },
  { day: 9, type: 'game', area: 'atencion', title: 'Un edificio con historias',
    instructions: 'Un juego de atención: observá el edificio y respondé preguntas sobre lo que hay en cada departamento. Subís de dificultad a medida que avanzás.' },
  { day: 10, type: 'game', area: 'ejecutivas', title: 'Orden alfabético',
    instructions: 'Un juego de razonamiento: tocá las palabras en el orden correcto del abecedario. Subís de dificultad a medida que avanzás.' },
  { day: 11, type: 'game', area: 'lenguaje', title: 'Es lo mismo decir…',
    instructions: 'Un juego de lenguaje: encontrá las palabras que significan lo mismo y formá las parejas. Subís de dificultad a medida que avanzás.' },
  { day: 12, type: 'game', area: 'praxias', title: 'El paso a paso',
    instructions: 'Un juego de secuenciación: tocá, en el orden correcto, los pasos de una rutina de todos los días. Subís de dificultad a medida que avanzás.' },
  { day: 13, type: 'game', area: 'orientacion', title: 'Encaminada',
    instructions: 'Un ejercicio de orientación: seguí la secuencia de flechas desde la celda marcada y elegí qué palabra se formó en el camino. Subís de dificultad a medida que avanzás.' },
  { day: 14, type: 'game', area: 'lenguaje', title: 'Fluencia cerrada',
    instructions: 'Un juego de lenguaje: tocá todas las palabras que tienen la combinación de letras pedida. Subís de dificultad a medida que avanzás.' },
  { day: 15, type: 'game', area: 'ejecutivas', title: 'El gran observador',
    instructions: 'Un juego de razonamiento: tocá cada foto y después la palabra que le corresponde según lo que muestra. Subís de dificultad a medida que avanzás.' },
  { day: 16, type: 'game', area: 'memoria', title: 'Dónde lo dejé',
    instructions: 'Un juego de memoria espacial: fijate bien dónde está cada objeto y después recordá en qué casillero estaba. Subís de dificultad a medida que avanzás.' },
  { day: 17, type: 'game', area: 'agnosias', title: 'Es esta sombra',
    instructions: 'Un juego de reconocimiento: mirá el objeto y tocá cuál es su sombra entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 18, type: 'game', area: 'atencion', title: 'La intrusa',
    instructions: 'Un juego de atención: entre todas las palabras repetidas, encontrá y tocá la que es diferente. Subís de dificultad a medida que avanzás.' },
  { day: 19, type: 'game', area: 'lenguaje', title: 'Almacén de sílabas',
    instructions: 'Un juego de lenguaje: uní las sílabas en orden para armar los nombres de animales escondidos. Subís de dificultad a medida que avanzás.' },
  { day: 20, type: 'game', area: 'praxias', title: 'Seguí el patrón',
    instructions: 'Un juego visoespacial: fijate cómo cambian las figuras en la grilla y elegí cuál completa el patrón que falta. Subís de dificultad a medida que avanzás.' },
  { day: 21, type: 'game', area: 'ejecutivas', title: 'Fotos conectadas',
    instructions: 'Un juego de razonamiento: mirá las tres fotos y descubrí, con la ayuda de la pista, qué concepto las conecta a todas. Subís de dificultad a medida que avanzás.' },
  { day: 22, type: 'game', area: 'calculo', title: 'Desafío de deducción',
    instructions: 'Un juego de cálculo: mirá las ecuaciones con figuras y deducí, tocando la opción correcta, cuánto vale cada una. Subís de dificultad a medida que avanzás.' },
  { day: 23, type: 'game', area: 'memoria', title: 'Unite con pista',
    instructions: 'Un juego de memoria: con la pista de la categoría, armá las palabras escondidas con las letras y después reconocelas entre las opciones. Subís de dificultad a medida que avanzás.' },
  { day: 24, type: 'game', area: 'atencion', title: 'La palabra escondida',
    instructions: 'Un juego de atención: leé con cuidado el texto y tocá la palabra que está escondida adentro. Subís de dificultad a medida que avanzás.' },
  { day: 25, type: 'game', area: 'lenguaje', title: 'Familia de palabras',
    instructions: 'Un juego de lenguaje: completá, con las letras, las palabras que pertenecen a la misma familia. Subís de dificultad a medida que avanzás.' },
  { day: 26, type: 'game', area: 'ejecutivas', title: 'Sudoku 4×4',
    instructions: 'Un juego de razonamiento lógico: completá la grilla de 4×4 sin repetir números en la misma fila, columna o cuadrante. Subís de dificultad a medida que avanzás.' },
  { day: 27, type: 'game', area: 'orientacion', title: 'Coordenadas',
    instructions: 'Un ejercicio de orientación: tocá, una por una, las celdas que corresponden a las coordenadas indicadas para armar una palabra. Subís de dificultad a medida que avanzás.' },
  { day: 28, type: 'game', area: 'atencion', title: 'No está repetida',
    instructions: 'Un juego de atención: entre todas las figuras que tienen su pareja, encontrá y tocá la única que no se repite. Subís de dificultad a medida que avanzás.' },
  { day: 29, type: 'game', area: 'calculo', title: 'Mesa de cartas',
    instructions: 'Un juego de cálculo: mirá la mesa de cartas y tocá la respuesta correcta a la pregunta de cada ronda. Subís de dificultad a medida que avanzás.' },
  { day: 30, type: 'game', area: 'agnosias', title: 'Figuras superpuestas +',
    instructions: 'Un juego de reconocimiento: contá cuántas figuras hay de cada tipo entre las que se superponen y después reconocelas entre las opciones. ¡Un cierre a la altura del Mes 2! 🎉' },
]

/** Content joined with its per-day illustration (matched by day number). */
export const CHALLENGE_DAYS: ChallengeDayContent[] = MONTH_1_DAYS_CONTENT.map((d) => ({
  ...d,
  illustration: illustrationForDay(d.day),
}))

/**
 * Full day→content catalog, indexed by challenge month. Month 1 is
 * `CHALLENGE_DAYS` itself (kept as a named export too, see above, for existing
 * code that predates months). Add month 3+ here the same way: a new
 * `MONTH_N_DAYS_CONTENT` array plus an entry in this record.
 */
export const CHALLENGE_CONTENT_BY_MONTH: Record<number, ChallengeDayContent[]> = {
  1: CHALLENGE_DAYS,
  2: MONTH_2_DAYS_CONTENT,
}

/** Content catalog for a given challenge month, falling back to month 1 for an
 * unknown/unmapped month number (defensive — should never happen in practice,
 * since the backend only ever issues purchases for months that exist here). */
export function getChallengeDays(month: number): ChallengeDayContent[] {
  return CHALLENGE_CONTENT_BY_MONTH[month] ?? CHALLENGE_CONTENT_BY_MONTH[1]
}
