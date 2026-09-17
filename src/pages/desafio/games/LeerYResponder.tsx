import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Leer y responder" — prose reading comprehension with recall. Read a short
 * story about an invented person, then answer 4 questions about it one at a
 * time. A wrong tap just greys out that option and lets the player try
 * again — the question never ends in failure, only in finding the answer.
 *
 * Deliberately NO countdown on the reading phase, unlike every study-phase
 * timer elsewhere in this catalog (CuatroPalabras, QueHayEnLaMesa, etc.):
 * reading speed varies enormously across this audience, and a clock ticking
 * over a paragraph would punish slower readers for the exact skill this game
 * is trying to build. The player alone decides when they're done, by tapping
 * "Ya lo leí". The only timer anywhere in this file is the brief pause after
 * a CORRECT tap, purely so the checkmark has a moment to register before the
 * next question replaces it.
 *
 * One text per round (level), drawn once at mount/round-change from a
 * level-specific pool of >=2 texts — same "epoch" (`roundKey`) pattern as
 * every other game here — so an immediate replay doesn't always retell the
 * same story. Difficulty climbs through text length and question type: L1 is
 * short with directly-stated facts, L2 is longer and several questions need
 * connecting two separate sentences, L3 is longest and includes a question
 * that requires a genuine inference (never stated outright, but strictly
 * derivable from what IS stated).
 */

interface QuestionOption {
  id: string
  label: string
}

interface ReadingQuestion {
  id: string
  prompt: string
  correctId: string
  options: QuestionOption[]
}

interface ReadingText {
  id: string
  title: string
  body: string
  questions: ReadingQuestion[]
}

interface Level {
  n: number
  name: string
  texts: ReadingText[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Nivel 1 — textos cortos, hechos directos y concretos ──

const TEXT_ALMACEN: ReadingText = {
  id: 'almacen-don-osvaldo',
  title: 'Don Osvaldo y el almacén',
  body: 'Don Osvaldo tiene un almacén de barrio en la esquina de su casa, en Villa Devoto. Lo abrió hace treinta y ocho años, cuando todavía no había supermercados cerca. Todos los viernes prepara empanadas de carne para vender antes del mediodía. En el mostrador siempre duerme Michi, su gato gris. A las siete de la mañana ya tiene la persiana levantada.',
  questions: [
    {
      id: 'almacen-q1',
      prompt: '¿En qué barrio está el almacén de Don Osvaldo?',
      correctId: 'almacen-q1-a',
      options: [
        { id: 'almacen-q1-a', label: 'Villa Devoto' },
        { id: 'almacen-q1-b', label: 'Villa Urquiza' },
        { id: 'almacen-q1-c', label: 'Flores' },
      ],
    },
    {
      id: 'almacen-q2',
      prompt: '¿Qué día prepara empanadas de carne?',
      correctId: 'almacen-q2-a',
      options: [
        { id: 'almacen-q2-a', label: 'Los viernes' },
        { id: 'almacen-q2-b', label: 'Los lunes' },
        { id: 'almacen-q2-c', label: 'Los domingos' },
      ],
    },
    {
      id: 'almacen-q3',
      prompt: '¿Cómo se llama el gato del almacén?',
      correctId: 'almacen-q3-a',
      options: [
        { id: 'almacen-q3-a', label: 'Michi' },
        { id: 'almacen-q3-b', label: 'Tom' },
        { id: 'almacen-q3-c', label: 'Bigotes' },
      ],
    },
    {
      id: 'almacen-q4',
      prompt: '¿A qué hora Don Osvaldo ya tiene la persiana levantada?',
      correctId: 'almacen-q4-a',
      options: [
        { id: 'almacen-q4-a', label: 'A las siete de la mañana' },
        { id: 'almacen-q4-b', label: 'A las nueve de la mañana' },
        { id: 'almacen-q4-c', label: 'Al mediodía' },
      ],
    },
  ],
}

const TEXT_BIZCOCHUELO: ReadingText = {
  id: 'bizcochuelo-filomena',
  title: 'Filomena y Sol',
  body: 'La señora Filomena vive en Lanús con su nieta Sol. Los sábados a la tarde hornean juntas un bizcochuelo de naranja. Sol tiene nueve años y siempre lava los huevos antes de usarlos. El horno de la cocina es viejo, pero todavía calienta parejo. Cuando el bizcochuelo está listo, lo comen con un mate cocido.',
  questions: [
    {
      id: 'bizcochuelo-q1',
      prompt: '¿Dónde vive la señora Filomena?',
      correctId: 'bizcochuelo-q1-a',
      options: [
        { id: 'bizcochuelo-q1-a', label: 'Lanús' },
        { id: 'bizcochuelo-q1-b', label: 'Quilmes' },
        { id: 'bizcochuelo-q1-c', label: 'Morón' },
      ],
    },
    {
      id: 'bizcochuelo-q2',
      prompt: '¿Cuándo hornean juntas el bizcochuelo?',
      correctId: 'bizcochuelo-q2-a',
      options: [
        { id: 'bizcochuelo-q2-a', label: 'Los sábados a la tarde' },
        { id: 'bizcochuelo-q2-b', label: 'Los domingos a la mañana' },
        { id: 'bizcochuelo-q2-c', label: 'Los viernes a la noche' },
      ],
    },
    {
      id: 'bizcochuelo-q3',
      prompt: '¿Cuántos años tiene Sol?',
      correctId: 'bizcochuelo-q3-a',
      options: [
        { id: 'bizcochuelo-q3-a', label: 'Nueve años' },
        { id: 'bizcochuelo-q3-b', label: 'Siete años' },
        { id: 'bizcochuelo-q3-c', label: 'Doce años' },
      ],
    },
    {
      id: 'bizcochuelo-q4',
      prompt: '¿Qué toman junto con el bizcochuelo?',
      correctId: 'bizcochuelo-q4-a',
      options: [
        { id: 'bizcochuelo-q4-a', label: 'Mate cocido' },
        { id: 'bizcochuelo-q4-b', label: 'Café con leche' },
        { id: 'bizcochuelo-q4-c', label: 'Jugo de naranja' },
      ],
    },
  ],
}

// ── Nivel 2 — textos más largos, varias preguntas piden conectar dos datos ──

const TEXT_ANIBAL: ReadingText = {
  id: 'viajes-anibal',
  title: 'Los viajes de Aníbal',
  body: 'Aníbal trabajó treinta y dos años como guardia de tren en el ferrocarril Roca. Se jubiló hace cuatro años. Desde que se jubiló, viaja todos los veranos a Mar del Plata. Se hospeda siempre en la misma pensión de la calle Alberti. Esa pensión queda a cuatro cuadras de la terminal de ómnibus. Su hija Marisa trabaja en un hospital y solo puede acompañarlo cuando consigue vacaciones. El verano pasado consiguió las dos primeras semanas de enero libres, así que viajaron juntos. Aníbal siempre lleva sus binoculares viejos para mirar los barcos desde el muelle.',
  questions: [
    {
      id: 'anibal-q1',
      prompt: '¿En qué calle queda la pensión donde se hospeda Aníbal?',
      correctId: 'anibal-q1-a',
      options: [
        { id: 'anibal-q1-a', label: 'Alberti' },
        { id: 'anibal-q1-b', label: 'Rivadavia' },
        { id: 'anibal-q1-c', label: 'San Martín' },
        { id: 'anibal-q1-d', label: 'Belgrano' },
      ],
    },
    {
      id: 'anibal-q2',
      prompt: '¿A cuántas cuadras de la pensión queda la terminal de ómnibus?',
      correctId: 'anibal-q2-a',
      options: [
        { id: 'anibal-q2-a', label: 'A cuatro cuadras' },
        { id: 'anibal-q2-b', label: 'A dos cuadras' },
        { id: 'anibal-q2-c', label: 'A ocho cuadras' },
        { id: 'anibal-q2-d', label: 'A una cuadra' },
      ],
    },
    {
      id: 'anibal-q3',
      prompt: '¿Por qué Marisa pudo viajar con su papá el verano pasado?',
      correctId: 'anibal-q3-a',
      options: [
        { id: 'anibal-q3-a', label: 'Porque consiguió vacaciones en el hospital donde trabaja' },
        { id: 'anibal-q3-b', label: 'Porque dejó de trabajar en el hospital' },
        { id: 'anibal-q3-c', label: 'Porque Aníbal le pagó el viaje' },
        { id: 'anibal-q3-d', label: 'Porque su papá se jubiló ese mismo verano' },
      ],
    },
    {
      id: 'anibal-q4',
      prompt: '¿Desde cuándo viaja Aníbal todos los veranos a Mar del Plata?',
      correctId: 'anibal-q4-a',
      options: [
        { id: 'anibal-q4-a', label: 'Desde que se jubiló, hace cuatro años' },
        { id: 'anibal-q4-b', label: 'Desde que nació su hija Marisa' },
        { id: 'anibal-q4-c', label: 'Desde que empezó a trabajar en el ferrocarril' },
        { id: 'anibal-q4-d', label: 'Desde el verano pasado, cuando viajó con Marisa' },
      ],
    },
  ],
}

const TEXT_ROSANA: ReadingText = {
  id: 'taller-rosana',
  title: 'El taller de Rosana',
  body: 'Rosana tiene un taller de costura en Ramos Mejía desde hace quince años. Antes de abrir el taller, trabajó ocho años en una fábrica de ropa en Once. Los martes y jueves da clases de costura a un grupo de seis vecinas. Su alumna más antigua, Nélida, empezó a tomar clases cuando el taller recién abría. El resto de las alumnas se sumó en los últimos tres años, después de que Rosana empezó a publicar fotos de sus trabajos en las redes. Rosana arregla dobladillos, cambia cierres y también arma cortinas a medida. El mes que viene el taller cumple dieciséis años, y Rosana está pensando en organizar una muestra con la ropa que hicieron sus alumnas.',
  questions: [
    {
      id: 'rosana-q1',
      prompt: '¿En qué barrio está el taller de Rosana?',
      correctId: 'rosana-q1-a',
      options: [
        { id: 'rosana-q1-a', label: 'Ramos Mejía' },
        { id: 'rosana-q1-b', label: 'Once' },
        { id: 'rosana-q1-c', label: 'Ituzaingó' },
        { id: 'rosana-q1-d', label: 'Morón' },
      ],
    },
    {
      id: 'rosana-q2',
      prompt: '¿Cuánto tiempo hace que Nélida toma clases con Rosana?',
      correctId: 'rosana-q2-a',
      options: [
        { id: 'rosana-q2-a', label: 'Quince años' },
        { id: 'rosana-q2-b', label: 'Tres años' },
        { id: 'rosana-q2-c', label: 'Ocho años' },
        { id: 'rosana-q2-d', label: 'Dieciséis años' },
      ],
    },
    {
      id: 'rosana-q3',
      prompt: '¿Por qué se sumaron la mayoría de las alumnas en los últimos tres años?',
      correctId: 'rosana-q3-a',
      options: [
        { id: 'rosana-q3-a', label: 'Porque Rosana empezó a publicar fotos de sus trabajos en las redes' },
        { id: 'rosana-q3-b', label: 'Porque Nélida las invitó a todas' },
        { id: 'rosana-q3-c', label: 'Porque el taller se mudó a un local más grande' },
        { id: 'rosana-q3-d', label: 'Porque Rosana bajó el precio de las clases' },
      ],
    },
    {
      id: 'rosana-q4',
      prompt: '¿Qué días de la semana da clases Rosana?',
      correctId: 'rosana-q4-a',
      options: [
        { id: 'rosana-q4-a', label: 'Los martes y jueves' },
        { id: 'rosana-q4-b', label: 'Los lunes y miércoles' },
        { id: 'rosana-q4-c', label: 'Los sábados' },
        { id: 'rosana-q4-d', label: 'Todos los días' },
      ],
    },
  ],
}

// ── Nivel 3 — textos más largos todavía; al menos una pregunta pide inferir ──

const TEXT_FERIA_CIENCIAS: ReadingText = {
  id: 'feria-ciencias-bruno',
  title: 'La maqueta de Bruno',
  body: 'Estela fue maestra de primaria durante treinta y cinco años, en la misma escuela de Boulogne. Se jubiló en dos mil dieciocho, pero todavía ayuda a su nieto Bruno con la tarea todas las tardes. Bruno tiene once años y cursa sexto grado en una escuela de Munro. Este cuatrimestre le tocó armar una maqueta del sistema solar para la feria de ciencias. Estela guarda en su casa una caja enorme con témperas, cartulinas y bolitas de telgopor de otros proyectos escolares. El miércoles pasado, Bruno y Estela pintaron los planetas hasta las nueve de la noche, mucho más tarde de lo habitual. Al otro día, Bruno le contó a su mamá que se había quedado dormido en la clase de matemática. La feria de ciencias es este sábado, y Estela ya separó su vestido más lindo para ir a verla. Bruno todavía no decidió si va a explicar la maqueta él solo o si va a pedirle ayuda a su compañero de banco, Ian.',
  questions: [
    {
      id: 'feria-q1',
      prompt: '¿En qué localidad está la escuela donde Estela trabajó como maestra?',
      correctId: 'feria-q1-a',
      options: [
        { id: 'feria-q1-a', label: 'Boulogne' },
        { id: 'feria-q1-b', label: 'Munro' },
        { id: 'feria-q1-c', label: 'Vicente López' },
        { id: 'feria-q1-d', label: 'San Isidro' },
      ],
    },
    {
      id: 'feria-q2',
      prompt: '¿Qué tiene que armar Bruno para la feria de ciencias?',
      correctId: 'feria-q2-a',
      options: [
        { id: 'feria-q2-a', label: 'Una maqueta del sistema solar' },
        { id: 'feria-q2-b', label: 'Una maqueta del cuerpo humano' },
        { id: 'feria-q2-c', label: 'Un experimento de volcanes' },
        { id: 'feria-q2-d', label: 'Una línea de tiempo de próceres' },
      ],
    },
    {
      id: 'feria-q3',
      prompt: '¿Por qué Bruno se quedó dormido en la clase de matemática?',
      correctId: 'feria-q3-a',
      options: [
        { id: 'feria-q3-a', label: 'Porque la noche anterior se acostó más tarde de lo habitual pintando la maqueta' },
        { id: 'feria-q3-b', label: 'Porque se enfermó esa semana' },
        { id: 'feria-q3-c', label: 'Porque el profesor daba una clase muy larga' },
        { id: 'feria-q3-d', label: 'Porque Ian lo despertó tarde esa mañana' },
      ],
    },
    {
      id: 'feria-q4',
      prompt: 'Según lo que cuenta el texto, ¿quién es mayor, Estela o Bruno?',
      correctId: 'feria-q4-a',
      options: [
        { id: 'feria-q4-a', label: 'Estela, porque Bruno es su nieto' },
        { id: 'feria-q4-b', label: 'Bruno, porque ya cursa sexto grado' },
        { id: 'feria-q4-c', label: 'Los dos tienen la misma edad' },
        { id: 'feria-q4-d', label: 'No se puede saber con el texto' },
      ],
    },
  ],
}

const TEXT_GRUPO_TEJIDO: ReadingText = {
  id: 'grupo-tejido-marta',
  title: 'El grupo de tejido de Marta',
  // The count is worded as "además de ella" on purpose. An earlier draft said
  // "van siete mujeres y un solo hombre", which leaves it genuinely arguable
  // whether Marta is one of the seven — and "Nueve" is one of the options, so
  // the honest reading of the text could lose. The addition is still there;
  // only the ambiguity is gone. The draft also had Marta founding the group
  // and, two sentences later, being the last to join it — that read as a
  // contradiction and earned its place on the cutting-room floor.
  body: 'Marta trabajó veintiocho años en el correo, repartiendo cartas en el barrio de Caballito. Hace seis años armó un grupo de tejido que se junta los martes en el club de jubilados. Además de ella van seis mujeres y un solo hombre, don Raúl, que aprendió a tejer para hacerle bufandas a sus bisnietos. Todos los sábados Marta arma un puesto en la feria del barrio y vende los tejidos que sobran. Su nieta Camila la ayuda a acomodar el puesto antes de que abra la feria a las nueve. El año pasado, Marta ganó un premio en un concurso de tejido artesanal organizado por la municipalidad. Con la plata del premio se compró dos ovillos de lana importada que todavía no se anima a usar. Don Raúl le dijo que la próxima bufanda tiene que ser para el hijo de Camila, que nació en marzo.',
  questions: [
    {
      id: 'tejido-q1',
      prompt: '¿En qué barrio repartía cartas Marta?',
      correctId: 'tejido-q1-a',
      options: [
        { id: 'tejido-q1-a', label: 'Caballito' },
        { id: 'tejido-q1-b', label: 'Floresta' },
        { id: 'tejido-q1-c', label: 'Once' },
        { id: 'tejido-q1-d', label: 'Boedo' },
      ],
    },
    {
      id: 'tejido-q2',
      prompt: '¿Qué día de la semana se junta el grupo de tejido?',
      correctId: 'tejido-q2-a',
      options: [
        { id: 'tejido-q2-a', label: 'Los martes' },
        { id: 'tejido-q2-b', label: 'Los sábados' },
        { id: 'tejido-q2-c', label: 'Los jueves' },
        { id: 'tejido-q2-d', label: 'Los domingos' },
      ],
    },
    {
      id: 'tejido-q3',
      prompt: '¿Cuántas personas van, en total, al grupo de tejido?',
      correctId: 'tejido-q3-a',
      options: [
        { id: 'tejido-q3-a', label: 'Ocho' },
        { id: 'tejido-q3-b', label: 'Siete' },
        { id: 'tejido-q3-c', label: 'Nueve' },
        { id: 'tejido-q3-d', label: 'Seis' },
      ],
    },
    {
      id: 'tejido-q4',
      prompt: '¿Por qué Marta compró dos ovillos de lana importada?',
      correctId: 'tejido-q4-a',
      options: [
        { id: 'tejido-q4-a', label: 'Porque ganó un premio en un concurso de tejido artesanal' },
        { id: 'tejido-q4-b', label: 'Porque se los regaló don Raúl' },
        { id: 'tejido-q4-c', label: 'Porque los encontró en la feria del barrio' },
        { id: 'tejido-q4-d', label: 'Porque se los compró Camila de regalo' },
      ],
    },
  ],
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', texts: [TEXT_ALMACEN, TEXT_BIZCOCHUELO] },
  { n: 2, name: 'Nivel 2', texts: [TEXT_ANIBAL, TEXT_ROSANA] },
  { n: 3, name: 'Nivel 3', texts: [TEXT_FERIA_CIENCIAS, TEXT_GRUPO_TEJIDO] },
]

// Fixed regardless of which text gets drawn — every text has exactly 4
// questions (verified by a throwaway script when this file was authored),
// so totalAttempts can use this constant instead of counting at runtime.
const QUESTIONS_PER_LEVEL = 4
const TOTAL_QUESTIONS = LEVELS.length * QUESTIONS_PER_LEVEL

const PRAISE_GREAT = ['¡Leíste con mucha atención!', '¡Excelente comprensión!', '¡Así se hace!']
const PRAISE_GOOD = [
  '¡Muy bien! Cada vez entendés mejor lo que leés.',
  '¡Buen trabajo! La lectura también se entrena.',
]
const NUDGES = ['Esa no era. Fijate bien en el texto.', 'Todavía no. Pensalo de nuevo.', 'Casi — probá con otra opción.']

interface PreparedRound {
  text: ReadingText
  questions: ReadingQuestion[]
}

// One text per round, options shuffled once per round — never re-shuffled on
// re-render, or the options would visibly jump around after a wrong tap.
function buildRound(level: Level): PreparedRound {
  const text = pickOne(level.texts)
  return {
    text,
    questions: text.questions.map((q) => ({ ...q, options: shuffle(q.options) })),
  }
}

type Phase = 'reading' | 'question' | 'results'

export function LeerYResponder({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const round = useMemo(
    () => buildRound(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [phase, setPhase] = useState<Phase>('reading')
  const [questionIdx, setQuestionIdx] = useState(0)
  const currentQuestion = round.questions[questionIdx]

  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GREAT[0])

  // accMistakes accumulates across levels 1→2→3, zeroed only on a genuine day
  // restart — see nextLevel()'s wrap branch. levelMistakes is purely cosmetic
  // (picks the praise line below) and always resets with the level.
  const [accMistakes, setAccMistakes] = useState(0)
  const [levelMistakes, setLevelMistakes] = useState(0)

  const advanceTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  function handleTap(optionId: string) {
    if (isAdvancing) return
    if (optionId === currentQuestion.correctId) {
      setIsAdvancing(true)
      // The only timer in this game: a brief pause so the correct tap's
      // checkmark registers before the next question replaces it.
      advanceTimerRef.current = window.setTimeout(() => {
        if (questionIdx < round.questions.length - 1) {
          setQuestionIdx((i) => i + 1)
          setWrongIds(new Set())
          setHint(null)
          setIsAdvancing(false)
        } else {
          setPraise(pickOne(levelMistakes === 0 ? PRAISE_GREAT : PRAISE_GOOD))
          setPhase('results')
        }
      }, 700)
    } else {
      setWrongIds((prev) => new Set(prev).add(optionId))
      setHint(pickOne(NUDGES))
      setAccMistakes((m) => m + 1)
      setLevelMistakes((m) => m + 1)
    }
  }

  // Resets happen HERE, synchronously with the level/round change, never in
  // a useEffect keyed on levelIdx. An effect only catches up on the render
  // AFTER levelIdx changes, so the onComplete-reporting effect below (which
  // watches `phase`) would still read THIS level's stale 'results' phase on
  // the very render that lands on the new level — firing onComplete
  // instantly with the wrong level's numbers. Same reasoning as
  // CuatroPalabras.tsx / SumaHastaDiez.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPhase('reading')
    setQuestionIdx(0)
    setWrongIds(new Set())
    setHint(null)
    setIsAdvancing(false)
    setLevelMistakes(0)
    if (isWrap) {
      setAccMistakes(0)
    }
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey, so it can report
  // again.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase === 'results' && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accMistakes + TOTAL_QUESTIONS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levelIdx, roundKey, accMistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>

        {phase === 'reading' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Leé con tranquilidad</h2>
            <p className="mt-2 text-base text-slate-500">
              Tomate el tiempo que necesites. Después te voy a preguntar sobre lo que leíste.
            </p>
          </>
        )}

        {phase === 'question' && (
          <>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Pregunta {questionIdx + 1} de {round.questions.length}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{currentQuestion.prompt}</h2>
          </>
        )}

        {phase === 'results' && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¡Completaste el {level.name.toLowerCase()}!</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Reading phase: the text, with a comfortable, constrained measure */}
      {phase === 'reading' && (
        <>
          <div className="mx-auto mt-6 max-w-prose rounded-3xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
            <h3 className="text-base font-bold text-tiam-blue-dark">{round.text.title}</h3>
            <p className="mt-3 text-lg leading-relaxed text-slate-700 sm:text-xl">{round.text.body}</p>
          </div>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setPhase('question')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ya lo leí
            </button>
          </div>
        </>
      )}

      {/* Question phase: the text is gone, only the options remain */}
      {phase === 'question' && (
        <>
          <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
            {currentQuestion.options.map((opt) => {
              const isWrong = wrongIds.has(opt.id)
              const isCorrectFound = isAdvancing && opt.id === currentQuestion.correctId
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isWrong || isAdvancing}
                  onClick={() => handleTap(opt.id)}
                  className={[
                    'flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left text-base font-semibold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectFound ? 'border-tiam-green bg-tiam-green/10 text-slate-800' : '',
                    isWrong ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60' : '',
                    !isCorrectFound && !isWrong
                      ? 'border-slate-200 text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  <span>{opt.label}</span>
                  {isCorrectFound && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {hint && !isAdvancing && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Results phase: per-level praise + progression */}
      {phase === 'results' && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-slate-600">Contestaste las {round.questions.length} preguntas sobre "{round.text.title}".</p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
