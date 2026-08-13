import { useEffect, useRef, useState } from 'react'
import {
  RotateCcw,
  ArrowRight,
  Sparkles,
  Blocks,
  Trees,
  Flower2,
  Flower,
  Sun,
  Lamp,
  Armchair,
  TreePine,
  Cloud,
  Table,
  CookingPot,
  UtensilsCrossed,
  Coffee,
  Sailboat,
  Anchor,
  Bird,
  Sofa,
  Table2,
  BookOpen,
  Cake,
  Gift,
  PartyPopper,
  Candy,
  Music,
  Fence,
  Tractor,
  Wheat,
  Rabbit,
  Squirrel,
  Snail,
  type LucideIcon,
} from 'lucide-react'
import { useSequencingPuzzle } from './useSequencingPuzzle'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Armá la escena" — praxias (praxia construccional). Reutiliza el motor
 * compartido `useSequencingPuzzle` (el mismo tap-to-order de
 * ElPasoAPaso/OrdenarLaFrase/PlanificaLaManana) en vez de reinventar la
 * mecánica: acá los "ítems" son partes de una escena (icono + nombre corto)
 * en vez de pasos de una rutina o palabras.
 *
 * Regla de orden ÚNICA y explícita (se explica una sola vez en la pantalla
 * "¿Listo?", no hace falta una pista distinta por pieza como en
 * ElPasoAPaso): cada escena se arma de las partes más grandes o de fondo a
 * las más chicas o de arriba — es la misma lógica con la que se dibuja o
 * arma cualquier escena a mano, y por construcción cada escena de abajo
 * respeta esa regla, así que el orden correcto es siempre único.
 *
 * Elegido el estilo ElPasoAPaso (banco + "Revisar", en vez del estilo
 * CopiaLaFigura de tocar-en-orden con pista inmediata) para dar variedad
 * DENTRO de este mismo lote de 4 juegos nuevos: TrazaElCamino ya cubre
 * "tocar en orden sobre una grilla" y La otra mitad / Continuá la serie ya
 * cubren "elegir 1 de varias opciones" — este es el único de los cuatro
 * que arma algo por partes.
 *
 * Los ítems colocados se muestran como chips (ícono + nombre corto) en vez
 * de las oraciones completas de ElPasoAPaso — acá cada parte es un nombre
 * de 1-3 palabras, así que los chips entran en fila con wrap sin
 * arriesgar el presupuesto de mobile ni en nivel 3 (6 partes). Una vez
 * colocada, la parte "de fondo" (pasto/mantel/mar/alfombra/campo) tiñe el
 * fondo de la tarjeta — la escena se ve tomar forma a medida que se arma,
 * sin necesitar posiciones XY por pieza.
 *
 * NOTA para quien cablee este juego: el día 26 de Mes 1 y Mes 2 en
 * challengeContent.ts ya están ocupados (La receta doble / Sudoku 4×4),
 * así que "día 26" acá es sólo una etiqueta de planificación, no un slot
 * real de registry.ts todavía — este batch deliberadamente no toca
 * ninguno de los dos archivos (ver instrucciones del batch).
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" del resto del catálogo. Partes por escena suben con el
 * nivel (4 → 5 → 6), como ElPasoAPaso/CopiaLaFigura.
 */

type ScenePart =
  | { kind: 'ground'; label: string; color: string }
  | { kind: 'icon'; label: string; color: string; Icon: LucideIcon; size: number }

interface Scene {
  title: string
  /** [0] = fondo/base, resto = íconos en el orden correcto (grande/fondo → chico/arriba). */
  parts: ScenePart[]
}
interface Level {
  n: number
  name: string
  rounds: number
  scenes: Scene[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    scenes: [
      {
        title: 'Armá el jardín',
        parts: [
          { kind: 'ground', label: 'El pasto', color: '#86EFAC' },
          { kind: 'icon', label: 'El árbol', color: '#16A34A', Icon: Trees, size: 42 },
          { kind: 'icon', label: 'La flor', color: '#F472B6', Icon: Flower2, size: 32 },
          { kind: 'icon', label: 'El sol', color: '#FBBF24', Icon: Sun, size: 26 },
        ],
      },
      {
        title: 'Armá la plaza',
        parts: [
          { kind: 'ground', label: 'El pasto', color: '#86EFAC' },
          { kind: 'icon', label: 'El farol', color: '#64748B', Icon: Lamp, size: 42 },
          { kind: 'icon', label: 'El banco', color: '#B45309', Icon: Armchair, size: 32 },
          { kind: 'icon', label: 'El sol', color: '#FBBF24', Icon: Sun, size: 26 },
        ],
      },
      {
        title: 'Armá el patio',
        parts: [
          { kind: 'ground', label: 'El pasto', color: '#86EFAC' },
          { kind: 'icon', label: 'El árbol', color: '#15803D', Icon: TreePine, size: 42 },
          { kind: 'icon', label: 'La flor', color: '#EC4899', Icon: Flower, size: 32 },
          { kind: 'icon', label: 'La nube', color: '#94A3B8', Icon: Cloud, size: 26 },
        ],
      },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 2,
    scenes: [
      {
        title: 'Armá la mesa',
        parts: [
          { kind: 'ground', label: 'El mantel', color: '#FDE68A' },
          { kind: 'icon', label: 'La mesa', color: '#92400E', Icon: Table, size: 42 },
          { kind: 'icon', label: 'La olla', color: '#475569', Icon: CookingPot, size: 36 },
          { kind: 'icon', label: 'Los cubiertos', color: '#64748B', Icon: UtensilsCrossed, size: 30 },
          { kind: 'icon', label: 'El café', color: '#78350F', Icon: Coffee, size: 24 },
        ],
      },
      {
        title: 'Armá el barco',
        parts: [
          { kind: 'ground', label: 'El mar', color: '#7DD3FC' },
          { kind: 'icon', label: 'El barco', color: '#1E3A8A', Icon: Sailboat, size: 42 },
          { kind: 'icon', label: 'El ancla', color: '#475569', Icon: Anchor, size: 36 },
          { kind: 'icon', label: 'El pájaro', color: '#0EA5E9', Icon: Bird, size: 30 },
          { kind: 'icon', label: 'La nube', color: '#CBD5E1', Icon: Cloud, size: 24 },
        ],
      },
      {
        title: 'Armá el living',
        parts: [
          { kind: 'ground', label: 'La alfombra', color: '#FDBA74' },
          { kind: 'icon', label: 'El sillón', color: '#7C2D12', Icon: Sofa, size: 42 },
          { kind: 'icon', label: 'La mesa ratona', color: '#78350F', Icon: Table2, size: 36 },
          { kind: 'icon', label: 'La lámpara', color: '#CA8A04', Icon: Lamp, size: 30 },
          { kind: 'icon', label: 'El libro', color: '#1D4ED8', Icon: BookOpen, size: 24 },
        ],
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 2,
    scenes: [
      {
        title: 'Armá la fiesta',
        parts: [
          { kind: 'ground', label: 'La mesa de fiesta', color: '#FBCFE8' },
          { kind: 'icon', label: 'La torta', color: '#F472B6', Icon: Cake, size: 42 },
          { kind: 'icon', label: 'El regalo', color: '#7C3AED', Icon: Gift, size: 36 },
          { kind: 'icon', label: 'Los cotillones', color: '#F59E0B', Icon: PartyPopper, size: 31 },
          { kind: 'icon', label: 'Los caramelos', color: '#EC4899', Icon: Candy, size: 26 },
          { kind: 'icon', label: 'La música', color: '#0EA5E9', Icon: Music, size: 22 },
        ],
      },
      {
        title: 'Armá la granja',
        parts: [
          { kind: 'ground', label: 'El campo', color: '#FDE68A' },
          { kind: 'icon', label: 'El cerco', color: '#78350F', Icon: Fence, size: 42 },
          { kind: 'icon', label: 'El tractor', color: '#EA580C', Icon: Tractor, size: 36 },
          { kind: 'icon', label: 'El trigo', color: '#CA8A04', Icon: Wheat, size: 31 },
          { kind: 'icon', label: 'El conejo', color: '#A8A29E', Icon: Rabbit, size: 26 },
          { kind: 'icon', label: 'El sol', color: '#FBBF24', Icon: Sun, size: 22 },
        ],
      },
      {
        title: 'Armá el bosque',
        parts: [
          { kind: 'ground', label: 'El pasto', color: '#86EFAC' },
          { kind: 'icon', label: 'El árbol', color: '#15803D', Icon: TreePine, size: 42 },
          { kind: 'icon', label: 'La ardilla', color: '#92400E', Icon: Squirrel, size: 36 },
          { kind: 'icon', label: 'El pájaro', color: '#0EA5E9', Icon: Bird, size: 31 },
          { kind: 'icon', label: 'El caracol', color: '#65A30D', Icon: Snail, size: 26 },
          { kind: 'icon', label: 'La nube', color: '#94A3B8', Icon: Cloud, size: 22 },
        ],
      },
    ],
  },
]

const PRAISE_GOOD = ['¡Perfecto!', '¡Muy bien armada!', '¡Así se hace!', '¡Excelente escena!']
const PRAISE_OK = [
  '¡Buen intento! Mirá cómo queda el orden correcto.',
  '¡Casi! Con la práctica te sale cada vez mejor.',
]

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

export function ArmaLaEscena({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` escenas distintas por nivel para ESTA "epoch" — elegidas una
  // sola vez por epoch (al montar y en "Hacer otro"), nunca vueltas a
  // tirar por "Repetir" ni por re-visitar un nivel a mitad de epoch. Mismo
  // patrón que ElPasoAPaso.tsx (ver ese archivo para por qué NO es un
  // useMemo).
  const [sceneChoices, setSceneChoices] = useState(() => LEVELS.map((lvl) => shuffle(lvl.scenes).slice(0, lvl.rounds)))
  const roundScenes = sceneChoices[levelIdx]
  const [roundIdx, setRoundIdx] = useState(0)
  const scene = roundScenes[roundIdx]
  const pool = scene.parts

  const { bank, placed, place, unplace } = useSequencingPuzzle(pool, `${levelIdx}-${roundKey}-${roundIdx}`)
  const [checked, setChecked] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Acumulado a través de niveles 1→2→3 (y de cualquier repetición en el
  // mismo nivel), sólo en cero en un reinicio real del día (ver
  // restartEpoch). Mismo modelo que ElPasoAPaso.
  const [accMistakes, setAccMistakes] = useState(0)
  const [accAttempts, setAccAttempts] = useState(0)

  const isCorrect = bank.length === 0 && placed.every((item, i) => item.id === i)
  const readyToCheck = bank.length === 0
  const groundPlaced = placed.find((item) => item.value.kind === 'ground')

  const done = checked && roundIdx >= level.rounds - 1

  function check() {
    setPraise(pickOne(isCorrect ? PRAISE_GOOD : PRAISE_OK))
    setChecked(true)
    const stepMistakes = placed.filter((item, i) => item.id !== i).length
    setAccMistakes((m) => m + stepMistakes)
    setAccAttempts((a) => a + pool.length)
  }
  function nextRound() {
    setChecked(false)
    setRoundIdx((i) => i + 1)
  }

  // Resets sincrónicos con el cambio de nivel/ronda — ver ElVuelto.tsx para
  // el motivo de no hacerlo en un efecto separado.
  function advanceLevel() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx((i) => i + 1)
  }
  function restartEpoch() {
    setChecked(false)
    setRoundIdx(0)
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setAccMistakes(0)
    setAccAttempts(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setSceneChoices(LEVELS.map((lvl) => shuffle(lvl.scenes).slice(0, lvl.rounds)))
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes: accMistakes, totalAttempts: accAttempts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, accMistakes, accAttempts])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{scene.title}</h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {level.rounds}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / level.rounds) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Pantalla previa: única vez al principio del día, nunca vuelve a
          'ready' — mismo patrón que ElPasoAPaso.tsx. Acá explica la ÚNICA
          regla de orden que usan todas las escenas. */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Blocks className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">
            Vas a armar distintas escenas tocando sus partes en orden: primero las más grandes o de fondo, y por
            último las más chicas o de arriba. Cuando ubiques todas las partes, tocá &quot;Revisar&quot;.
          </p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && (
        <>
          {/* Escena en construcción — a medida que se coloca la parte de
              fondo, tiñe el fondo de la tarjeta; el resto de las partes
              colocadas quedan como chips con ícono, en el orden en que se
              tocaron. Se oculta al revisar para que la tarjeta de
              Resultado no compita por espacio. */}
          {!checked && (
            <div
              className="mt-4 min-h-[76px] rounded-2xl border-2 border-dashed border-slate-200 p-2.5 transition-colors"
              style={
                groundPlaced
                  ? {
                      background: `linear-gradient(to bottom, #F8FAFC 0%, #F8FAFC 45%, ${groundPlaced.value.color}66 45%, ${groundPlaced.value.color}66 100%)`,
                    }
                  : undefined
              }
            >
              {placed.length === 0 && (
                <p className="text-center text-base text-slate-400">Tocá las partes de abajo para empezar</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {placed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => unplace(item)}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-tiam-blue bg-white px-3 py-1.5 text-base font-semibold text-slate-900 transition hover:bg-tiam-blue/5 focus:outline-none focus:ring-2 focus:ring-tiam-blue/40"
                  >
                    {item.value.kind === 'icon' && <item.value.Icon className="h-4 w-4" style={{ color: item.value.color }} />}
                    {item.value.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Banco de partes */}
          {!checked && bank.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {bank.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => place(item)}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-3 py-1.5 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0"
                >
                  {item.value.kind === 'icon' && <item.value.Icon className="h-4 w-4 text-slate-400" />}
                  {item.value.label}
                </button>
              ))}
            </div>
          )}

          {/* Botón Revisar */}
          {readyToCheck && !checked && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Revisar
              </button>
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {checked && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          {!isCorrect && (
            <div className="mt-3 text-left text-base text-slate-600">
              <p className="font-semibold text-slate-700">El orden correcto era:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {scene.parts.map((part) => (
                  <li key={part.label}>{part.label}</li>
                ))}
              </ol>
            </div>
          )}
          {!done ? (
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente escena
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
