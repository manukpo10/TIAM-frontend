import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué oficio es?" — a profession-guessing game (semantic / lexical
 * retrieval), inspired by the classic "adiviná el trabajo" exercise. All
 * content original — nothing derived from any third-party reference material.
 *
 * The clue is ILLUSTRATED (1-2 tool icons) and the options are TEXT
 * (profession names) — the inverse of QueObjetoEs (text riddle / image
 * options), which is what makes it a genuinely distinct lenguaje mechanic
 * rather than a reskin. Inferring a role from its instruments is a
 * confrontation-naming task (retrieve the word), not image-matching.
 *
 * Difficulty is deliberately steep: L1 shows one tool with unrelated decoys;
 * L2 shows two tools with one same-domain trap; L3 shows two tools where ALL
 * THREE decoys are same-rubro trades (carpintero/albañil/pintor…), so telling
 * them apart requires actually knowing the specific tools, not eliminating an
 * obvious filler. A wrong tap eliminates that option (muted grey, never red).
 */

interface OficioRound {
  id: string
  tools: string[]
  decoys: string[]
}
interface Level {
  n: number
  name: string
  hint?: string
  rounds: OficioRound[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'Mirá la herramienta y pensá quién la usa para trabajar.',
    rounds: [
      { id: 'medico', tools: ['estetoscopio'], decoys: ['maestro', 'jardinero', 'cartero'] },
      { id: 'bombero', tools: ['camion-bomberos'], decoys: ['cocinero', 'mecanico', 'cartero'] },
      { id: 'panadero', tools: ['pan'], decoys: ['peluquero', 'verdulero', 'cartero'] },
      { id: 'peluquero', tools: ['tijera'], decoys: ['carpintero', 'costurera', 'jardinero'] },
      { id: 'cartero', tools: ['sobre-carta'], decoys: ['maestro', 'bombero', 'mecanico'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Ahora hay dos herramientas. Juntá las dos pistas para dar con el oficio.',
    rounds: [
      { id: 'maestro', tools: ['pizarron', 'tiza'], decoys: ['cartero', 'mecanico', 'jardinero'] },
      { id: 'costurera', tools: ['aguja-hilo', 'dedal'], decoys: ['zapatero', 'peluquero', 'jardinero'] },
      { id: 'jardinero', tools: ['maceta', 'regadera'], decoys: ['verdulero', 'albanil', 'pintor'] },
      { id: 'mecanico', tools: ['llave-inglesa', 'neumatico'], decoys: ['carpintero', 'electricista', 'albanil'] },
      { id: 'verdulero', tools: ['zanahoria', 'tomate'], decoys: ['cocinero', 'panadero', 'jardinero'] },
      { id: 'enfermero', tools: ['jeringa', 'gorro-enfermera'], decoys: ['medico', 'veterinario', 'maestro'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Acá los oficios se parecen — fijate bien en las dos herramientas antes de responder.',
    rounds: [
      { id: 'carpintero', tools: ['martillo', 'serrucho'], decoys: ['albanil', 'pintor', 'mecanico'] },
      { id: 'albanil', tools: ['llana', 'ladrillos'], decoys: ['carpintero', 'pintor', 'plomero'] },
      { id: 'veterinario', tools: ['estetoscopio', 'huella-pata'], decoys: ['medico', 'enfermero', 'jardinero'] },
      { id: 'cocinero', tools: ['olla', 'gorro-cocinero'], decoys: ['panadero', 'verdulero', 'mozo'] },
      { id: 'pintor', tools: ['brocha', 'balde-pintura'], decoys: ['albanil', 'carpintero', 'electricista'] },
      { id: 'electricista', tools: ['destornillador', 'enchufe'], decoys: ['mecanico', 'plomero', 'albanil'] },
    ],
  },
]

const PROFESSION_LABELS: Record<string, string> = {
  medico: 'Médico/a', bombero: 'Bombero/a', panadero: 'Panadero/a', peluquero: 'Peluquero/a', cartero: 'Cartero/a',
  maestro: 'Maestro/a', costurera: 'Costurera', jardinero: 'Jardinero/a', mecanico: 'Mecánico/a', verdulero: 'Verdulero/a',
  enfermero: 'Enfermero/a', carpintero: 'Carpintero/a', albanil: 'Albañil', veterinario: 'Veterinario/a', cocinero: 'Cocinero/a',
  pintor: 'Pintor/a', electricista: 'Electricista', colectivero: 'Colectivero/a', zapatero: 'Zapatero/a', plomero: 'Plomero/a', mozo: 'Mozo/a',
}
const TOOL_LABELS: Record<string, string> = {
  estetoscopio: 'estetoscopio', 'camion-bomberos': 'camión de bomberos', pan: 'pan', tijera: 'tijera', 'sobre-carta': 'sobre',
  pizarron: 'pizarrón', tiza: 'tiza', 'aguja-hilo': 'aguja e hilo', dedal: 'dedal', maceta: 'maceta', regadera: 'regadera',
  'llave-inglesa': 'llave inglesa', neumatico: 'neumático', jeringa: 'jeringa', 'gorro-enfermera': 'cofia de enfermera',
  zanahoria: 'zanahoria', tomate: 'tomate', martillo: 'martillo', serrucho: 'serrucho', llana: 'llana', ladrillos: 'ladrillos',
  'huella-pata': 'huella de animal', olla: 'olla', 'gorro-cocinero': 'gorro de cocinero', brocha: 'brocha',
  'balde-pintura': 'balde de pintura', destornillador: 'destornillador', enchufe: 'enchufe',
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-oficio-es/*.webp', {
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
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const HINTS = [
  'Ese no es — mirá bien las herramientas.',
  'No, ese no. ¡Fijate de nuevo en los dibujos!',
  'Casi. Repasá las herramientas y probá otra vez.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena memoria de palabras!']

export function QueOficioEs({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (see
  // nextLevel's wrap branch below) — adapted to a per-round (not per-level)
  // natural attempt count, same reasoning as CadaCosaEnSuGrupo: a level here
  // is 5-6 oficio rounds, not one puzzle.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  // Fires once per roundKey when level 3's last round resolves. Guarded the
  // same way as ElVuelto/QueSeEsconde (Fase 1): a ref keyed on roundKey, not
  // a boolean, so a genuine full-day restart (new roundKey on wrap) reports
  // again while re-renders on an already-done level 3 do not double-fire.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  const options = useMemo(() => (round ? shuffle([round.id, ...round.decoys]) : []), [round])

  function guess(id: string) {
    if (!round || solved || eliminated.has(id)) return
    if (id === round.id) {
      setSolved(id)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(null)
      }, 550)
    } else {
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  // Resets happen HERE, synchronously with the level/round change — NOT in a
  // separate useEffect keyed on [levelIdx, roundKey] like this file used to
  // have. That effect only caught up on the render AFTER levelIdx changed,
  // so `done` (currentIndex vs. the NEW level's order.length, already
  // updated via useMemo) could read a stale currentIndex left over from the
  // previous level on the very render that just arrived — the same
  // stale-flag hazard the Fase 1 review found and fixed in ElVuelto/
  // QueSeEsconde. Setting currentIndex/eliminated/solved/hint in the same
  // handler that sets levelIdx/roundKey means React batches them into one
  // render, so they're never observably out of sync.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulators — "Otra ronda" must NOT, even on level 1.
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
    setHint(null)
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Tool clue */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-5">
            {round.tools.map((toolId) => {
              const img = imgFor(toolId)
              return (
                img && (
                  <img
                    key={toolId}
                    src={img}
                    alt={TOOL_LABELS[toolId] ?? toolId}
                    className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                    draggable={false}
                  />
                )
              )
            })}
          </div>

          {/* Options */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const isSolved = solved === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={solved !== null || isEliminated}
                  onClick={() => guess(id)}
                  className={[
                    'min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition sm:text-xl',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {PROFESSION_LABELS[id] ?? id}
                </button>
              )
            })}
          </div>

          {hint && !solved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Adivinaste los {order.length} oficios — completaste el {level.name.toLowerCase()}!
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
