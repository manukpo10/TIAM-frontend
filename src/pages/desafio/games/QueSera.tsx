import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué será?" — a progressive-reveal object-guessing game (visual
 * closure), grounded in the Gollin Incomplete Figures Test: a familiar
 * object shown fragmented, revealing more only if not recognized.
 *
 * The reveal FRAGMENTS THE CONTOUR — it does not uncover a region. A dot-grid
 * CSS mask lets the line show through only inside a lattice of small circles,
 * and each stage grows that radius until the drawing is whole. So the object is
 * present in full from stage one, with most of its outline missing; you
 * recognise it by closing the gaps mentally. That IS visual closure, and it's
 * the function this test measures.
 *
 * This used to be a clip-path circle grown from the image's centre, which is a
 * different task entirely: a growing peephole shows you a COMPLETE PART of the
 * object, so you're identifying a fragment, not completing a whole. It also
 * only ever worked because the old art was filled — you cannot meaningfully
 * fragment a solid shape, you just get blobs. The art is now unfilled pen-and-
 * ink contour (shared with día 27 via assets/desafio/games/contornos), so
 * fragmenting the LINE is finally possible.
 *
 * A wrong guess and the voluntary "Dame una pista" button both advance the same
 * single reveal stage pointer, so there's one mental model for "more picture."
 *
 * No red anywhere in this one specifically: recognition failure is close
 * to the actual clinical deficit this game exercises (agnosia), so a
 * wrong guess reads as muted/neutral, never alarm-colored — and running
 * out of stages always resolves warmly, the object is simply revealed.
 *
 * VARIAS rondas por nivel (mismo patrón que LosOpuestos/LaCancionDeTuJuventud):
 * cada nivel revela `rounds` objetos distintos elegidos al azar del pool
 * completo (sin repetir dentro del nivel; pueden repetirse entre niveles,
 * igual que los géneros de LaCancionDeTuJuventud), conservando la curva de
 * dificultad existente por nivel (stages de revelado, estrategia de
 * decoys). 12 adivinanzas en total (3 + 4 + 5) — el pool de 20 objetos ya
 * alcanza de sobra, no hizo falta contenido nuevo.
 */

interface RevealObject {
  id: string
  label: string
  category: 'animales' | 'objetos' | 'formas'
}

const OBJECTS: RevealObject[] = [
  { id: 'flamenco', label: 'flamenco', category: 'animales' },
  { id: 'oso', label: 'oso', category: 'animales' },
  { id: 'rana', label: 'rana', category: 'animales' },
  { id: 'gato', label: 'gato', category: 'animales' },
  { id: 'pato', label: 'pato', category: 'animales' },
  { id: 'tortuga', label: 'tortuga', category: 'animales' },
  { id: 'mariposa', label: 'mariposa', category: 'animales' },
  { id: 'pez', label: 'pez', category: 'animales' },
  { id: 'anteojos', label: 'anteojos', category: 'objetos' },
  { id: 'paraguas', label: 'paraguas', category: 'objetos' },
  { id: 'llaves', label: 'llaves', category: 'objetos' },
  { id: 'tijera', label: 'tijera', category: 'objetos' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera', category: 'objetos' },
  { id: 'mate', label: 'mate', category: 'objetos' },
  { id: 'guitarra', label: 'guitarra', category: 'objetos' },
  { id: 'pava', label: 'pava', category: 'objetos' },
  { id: 'termo', label: 'termo', category: 'objetos' },
  { id: 'taza', label: 'taza', category: 'objetos' },
  { id: 'cacerola', label: 'cacerola', category: 'objetos' },
  { id: 'cuchara', label: 'cuchara', category: 'objetos' },
  { id: 'tenedor', label: 'tenedor', category: 'objetos' },
  { id: 'peine', label: 'peine', category: 'objetos' },
  { id: 'botella', label: 'botella', category: 'objetos' },
  { id: 'martillo', label: 'martillo', category: 'objetos' },
  { id: 'silla', label: 'silla', category: 'objetos' },
  { id: 'sombrero', label: 'sombrero', category: 'objetos' },
  { id: 'zapato', label: 'zapato', category: 'objetos' },
  { id: 'camion-bomberos', label: 'camión de bomberos', category: 'objetos' },
  { id: 'sol', label: 'sol', category: 'formas' },
  { id: 'corazon', label: 'corazón', category: 'formas' },
  { id: 'banana', label: 'banana', category: 'formas' },
  { id: 'zanahoria', label: 'zanahoria', category: 'formas' },
  { id: 'casa', label: 'casa', category: 'formas' },
  { id: 'manzana-roja', label: 'manzana', category: 'formas' },
]

const byCategory = (cat: RevealObject['category']) => OBJECTS.filter((o) => o.category === cat)

// Carpeta compartida con día 27: los mismos contornos sin relleno sirven a los
// dos juegos, y un objeto dibujado una vez no se dibuja de nuevo por juego.
const IMAGES = import.meta.glob('../../../assets/desafio/games/contornos/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Level {
  n: number
  name: string
  rounds: number
  stages: number[] // radio del punto de la máscara en %, ascendente — 100 = figura entera
  decoyStrategy: (target: RevealObject) => RevealObject[]
}

// Cada etapa es el RADIO del punto en la grilla de la máscara, como % del paso
// de la grilla: con 16% se ven motas sueltas de la línea, con 55% guiones que ya
// dibujan el contorno, y 100 es la figura completa. Calibrado mirando el arte
// real en pantalla, no calculado: por debajo de ~12% no queda tinta suficiente
// para que haya algo que cerrar, y ahí deja de ser difícil y pasa a ser azar.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    stages: [34, 52, 100],
    decoyStrategy: (target) => pick(OBJECTS.filter((o) => o.category !== target.category), 3),
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    stages: [24, 34, 52, 100],
    decoyStrategy: (target) => [
      ...pick(OBJECTS.filter((o) => o.category !== target.category), 1),
      ...pick(byCategory(target.category).filter((o) => o.id !== target.id), 2),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    stages: [14, 22, 34, 100],
    decoyStrategy: (target) => pick(byCategory(target.category).filter((o) => o.id !== target.id), 4),
  },
]

// Paso de la grilla de puntos. Fijo en px y no relativo a la imagen a propósito:
// lo que hace difícil un Gollin es el tamaño del HUECO comparado con el grosor
// del trazo, y el trazo tampoco escala con la caja.
const MASK_STEP_PX = 9

function maskFor(percent: number): React.CSSProperties {
  if (percent >= 100) return {}
  const mask = `radial-gradient(circle at center, #000 ${percent}%, transparent ${percent + 1}%)`
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskSize: `${MASK_STEP_PX}px ${MASK_STEP_PX}px`,
    maskSize: `${MASK_STEP_PX}px ${MASK_STEP_PX}px`,
    WebkitMaskRepeat: 'repeat',
    maskRepeat: 'repeat',
  }
}

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!']
const PRAISE_OK = [
  'Era {obj}. A veces cuesta con tan pocas pistas — la próxima seguro la reconocés más rápido.',
  '¡Buen intento! Era {obj}. Con la práctica, cada vez vas a necesitar menos pistas.',
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function QueSera({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` objetos distintos del pool completo, al azar, recalculados una
  // sola vez por nivel/roundKey (sin repetir dentro del nivel).
  const roundTargets = useMemo(
    () => shuffle(OBJECTS).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const target = roundTargets[roundIdx]
  const done = roundIdx >= level.rounds

  const options = useMemo(() => {
    if (!target) return []
    return shuffle([target, ...level.decoyStrategy(target)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, levelIdx])

  const [stageIdx, setStageIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [praise, setPraise] = useState('')
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Wrong-guess count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below) — same policy as
  // ElVuelto. The voluntary "Dame una pista" button does NOT count as a
  // mistake: it's not a guess at all, just an early opt-in to the same
  // reveal a wrong guess would have granted anyway.
  const [mistakes, setMistakes] = useState(0)
  // Rondas resueltas con un acierto genuino (NO un "me rindo" tras agotar
  // los stages). totalAttempts usa esto en vez de un total fijo de rondas:
  // a diferencia de LaCancionDeTuJuventud/LosOpuestos (donde toda ronda se
  // resuelve con un acierto), acá una ronda puede terminar en "me rindo" —
  // ya sumó sus errores a `mistakes`, y sumarle además un acierto gratis
  // sobreestimaría totalAttempts para esa ronda.
  const [successCount, setSuccessCount] = useState(0)

  const img = target ? imgFor(target.id) : undefined
  const revealPercent = resolved ? 100 : level.stages[stageIdx]
  const canHint = !resolved && stageIdx < level.stages.length - 1

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE_GOOD))
  }, [done])

  // Ambos finales de ronda (acierto o "me rindo") dan un respiro breve para
  // leer el feedback y después avanzan a la próxima ronda del nivel. Cuando
  // roundIdx llega a level.rounds, `done` pasa a true y se muestra la
  // pantalla de fin de nivel en vez de una ronda nueva.
  function advanceRound(delay: number) {
    window.setTimeout(() => {
      setRoundIdx((i) => i + 1)
      setStageIdx(0)
      setEliminated(new Set())
      setResolved(false)
      setCorrect(false)
    }, delay)
  }

  function guess(optionId: string) {
    if (!target || resolved) return
    if (optionId === target.id) {
      setPraise(pickOne(PRAISE_GOOD))
      setCorrect(true)
      setResolved(true)
      setSuccessCount((s) => s + 1)
      advanceRound(900)
      return
    }
    setEliminated((prev) => new Set(prev).add(optionId))
    setMistakes((m) => m + 1)
    if (stageIdx < level.stages.length - 1) {
      setStageIdx((i) => i + 1)
    } else {
      setPraise(pickOne(PRAISE_OK).replace('{obj}', target.label))
      setCorrect(false)
      setResolved(true)
      advanceRound(2400)
    }
  }
  function hint() {
    if (canHint) setStageIdx((i) => i + 1)
  }
  // Reset sincrónico dentro de nextLevel()/replay() — nunca en un efecto
  // separado sobre [levelIdx, roundKey]: un efecto llega un render tarde,
  // así que `done`/`resolved` podrían leer stale-true justo cuando levelIdx
  // cambia y disparar onComplete con datos viejos/basura — el mismo bug ya
  // resuelto en ElVuelto/CuantosHay.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setStageIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setCorrect(false)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulators — "Otra ronda" must NOT, even on level 1.
    if (isWrap) {
      setMistakes(0)
      setSuccessCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setStageIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setCorrect(false)
  }

  // Fires once per roundKey when level 3's last round resolves — including
  // rounds resolved via "me rindo" (correct === false), which is still a
  // resolution, never a hard fail (see file header). totalAttempts =
  // mistakes + successCount, NOT mistakes + total de rondas: una ronda "me
  // rindo" aporta sólo sus errores, ningún acierto gratis.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + successCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, successCount])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base text-slate-500">Mirá la imagen y elegí qué objeto es.</p>
            {/* Cuenta y barra en una fila: el nivel 3 tiene 5 opciones (una fila
                más de botones) y cada píxel de más se lo come a la figura, que acá
                es todo el juego. */}
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {roundIdx} de {level.rounds}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-orange transition-[width] duration-300"
                  style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && target && (
        <>
          {/* Figura fragmentada. Fondo blanco, no slate-50: la máscara recorta la
              tinta contra el fondo, y un gris de fondo le baja el contraste justo
              a las motas de línea que hay que llegar a ver. */}
          <div className="relative mx-auto mt-3 aspect-square w-44 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:mt-6 sm:w-56">
            {img && (
              <img
                src={img}
                alt=""
                draggable={false}
                className="h-full w-full object-contain p-4"
                style={maskFor(revealPercent)}
              />
            )}
          </div>

          {/* Slot de altura reservada: el botón de pista y el texto de resultado
              se turnan acá. Sin el min-h, el elogio (más largo que el botón)
              empuja las opciones hacia abajo justo cuando la persona está
              leyendo — y en nivel 3, fuera de pantalla. */}
          <div className="mt-2 flex min-h-[44px] items-center justify-center text-center">
            {!resolved ? (
              <button
                type="button"
                disabled={!canHint}
                onClick={hint}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-tiam-blue transition hover:bg-tiam-blue/5 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Eye className="h-4 w-4" />
                Dame una pista
              </button>
            ) : (
              <p className={`text-sm font-medium ${correct ? 'text-tiam-green' : 'text-tiam-blue'}`}>{praise}</p>
            )}
          </div>

          {/* Options */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
            {options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isTheAnswer = resolved && opt.id === target.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.id)}
                  className={[
                    // 48px, no 56: el nivel 3 suma una tercera fila de opciones y
                    // sigue por encima del mínimo de 44px para tocar cómodo.
                    'min-h-[48px] rounded-2xl border-2 px-3 py-2 text-base font-bold capitalize transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isTheAnswer ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                    isEliminated ? 'border-slate-200 bg-slate-50 text-slate-300 line-through' : '',
                    !isTheAnswer && !isEliminated
                      ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            {levelIdx === LEVELS.length - 1 ? (
              <Sparkles className="h-6 w-6 text-tiam-blue" />
            ) : (
              <Eye className="h-6 w-6 text-tiam-blue" />
            )}
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Pasaste por los {level.rounds} objetos del nivel {levelIdx + 1}.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
