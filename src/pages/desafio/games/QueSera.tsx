import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Qué será?" — a progressive-reveal object-guessing game (visual
 * closure), grounded in the Gollin Incomplete Figures Test: a familiar
 * object shown fragmented, revealing more only if not recognized.
 *
 * The reveal FRAGMENTS THE CONTOUR into pieces of line, adding more pieces per
 * stage — exactly like the plates in the original Gollin sets (SET I → V: a few
 * broken strokes, then more, then the whole drawing). It's drawn on a <canvas>:
 * a COHERENT noise field (smooth blobs, generated fresh per round) assigns every
 * zone a "reveal order" in [0,1], and at reveal p the line shows only where the
 * noise ≤ p. Because the noise is spatially smooth, whole CONTIGUOUS SEGMENTS
 * appear and whole regions stay absent — not a uniform stipple — and because p
 * only grows, each stage nests the previous one. See drawFragment() below.
 *
 * Two earlier versions were both wrong and are worth remembering as anti-patterns:
 *   - a clip-path circle grown from the centre: a peephole shows you a COMPLETE
 *     PART, so you identify a fragment, not complete a whole — a different task;
 *   - a fine dot-grid CSS mask: it stipples the ENTIRE line uniformly, so every
 *     part is equally dotted. A real Gollin has whole segments present and whole
 *     segments gone, and the difficulty is HOW MANY segments show.
 * Both only ever half-worked; the coherent-noise fragmentation is the real thing.
 * It needs unfilled contour art (shared with día 27 via assets/…/contornos) —
 * you cannot meaningfully fragment a solid shape.
 *
 * The pool is curated to DISTINCTIVE silhouettes (animals, tools, clear shapes).
 * Generic utensils — a lone spoon, fork, bottle, plain cup — are unrecognisable
 * once fragmented, which makes the task frustrating rather than hard, so they're
 * deliberately absent even though they exist in the shared contour set.
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
 * decoys). 12 adivinanzas en total (3 + 4 + 5) — el pool curado de siluetas
 * distintivas alcanza de sobra.
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
  stages: number[] // % de la LÍNEA visible, ascendente — 100 = figura entera
  decoyStrategy: (target: RevealObject) => RevealObject[]
}

// Cada etapa es el % de la LÍNEA que se muestra (por ranking, ver drawFragment),
// así que estos números son literales y comparables entre objetos. Nivel 1
// empieza a medio dibujar y con una pista queda casi entero; nivel 3 empieza
// muy fragmentado (1/5 de la línea). El último valor es siempre 100 (revelado
// completo al rendirse). Por debajo de ~18% deja de haber suficiente para cerrar
// y pasa a ser azar.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 3,
    stages: [50, 72, 100],
    decoyStrategy: (target) => pick(OBJECTS.filter((o) => o.category !== target.category), 3),
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 4,
    stages: [35, 50, 72, 100],
    decoyStrategy: (target) => [
      ...pick(OBJECTS.filter((o) => o.category !== target.category), 1),
      ...pick(byCategory(target.category).filter((o) => o.id !== target.id), 2),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 5,
    stages: [20, 32, 50, 100],
    decoyStrategy: (target) => pick(byCategory(target.category).filter((o) => o.id !== target.id), 4),
  },
]

// --- Fragmentado tipo Gollin sobre canvas ---
const CANVAS_SIZE = 320
// Grilla del ruido: 6×6 da blobs de ~1/6 de la figura, o sea fragmentos del
// tamaño de un trazo (como los SET de la referencia). Más fino = punteado
// uniforme (el error anterior); más grueso = pedazos demasiado grandes.
const NOISE_GRID = 6

// Campo de ruido COHERENTE: 6×6 valores al azar, interpolados bilinealmente a
// CANVAS_SIZE². Suave, así que umbralarlo deja segmentos contiguos, no puntos.
function makeNoiseField(): Float32Array {
  const g = NOISE_GRID
  const grid = new Float32Array(g * g)
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random()
  const S = CANVAS_SIZE
  const field = new Float32Array(S * S)
  for (let y = 0; y < S; y++) {
    const fy = (y / S) * (g - 1)
    const y0 = Math.floor(fy)
    const y1 = Math.min(y0 + 1, g - 1)
    const ty = fy - y0
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * (g - 1)
      const x0 = Math.floor(fx)
      const x1 = Math.min(x0 + 1, g - 1)
      const tx = fx - x0
      const a = grid[y0 * g + x0]
      const b = grid[y0 * g + x1]
      const c = grid[y1 * g + x0]
      const d = grid[y1 * g + x1]
      const top = a + (b - a) * tx
      const bot = c + (d - c) * tx
      field[y * S + x] = top + (bot - top) * ty
    }
  }
  return field
}

// Dibuja el contorno y deja visible sólo el p% de la LÍNEA con menor ruido
// (revealPercent = % de línea a mostrar). El umbral se toma por RANKING sobre
// los píxeles de tinta, no global: así aparece exactamente ese % de la figura
// sin importar dónde caiga sobre el ruido — un umbral global tenía mucha
// varianza (un objeto compacto y centrado a veces se revelaba casi entero). El
// ruido sigue siendo suave, así que el p% más bajo forma segmentos contiguos.
function drawFragment(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  noise: Float32Array,
  revealPercent: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const S = CANVAS_SIZE
  ctx.clearRect(0, 0, S, S)
  // encajar la imagen en el cuadrado, centrada, preservando proporción
  const scale = Math.min(S / image.width, S / image.height)
  const w = image.width * scale
  const h = image.height * scale
  ctx.drawImage(image, (S - w) / 2, (S - h) / 2, w, h)
  if (revealPercent >= 100) return
  const p = revealPercent / 100
  const imgData = ctx.getImageData(0, 0, S, S)
  const dd = imgData.data
  // ruido de cada píxel de tinta, para cortar por percentil p
  const lineNoise: number[] = []
  for (let i = 0; i < noise.length; i++) {
    if (dd[i * 4 + 3] > 40) lineNoise.push(noise[i])
  }
  if (lineNoise.length === 0) return
  lineNoise.sort((a, b) => a - b)
  const cutoff = lineNoise[Math.min(lineNoise.length - 1, Math.floor(p * lineNoise.length))]
  for (let i = 0; i < noise.length; i++) {
    if (dd[i * 4 + 3] > 40 && noise[i] > cutoff) dd[i * 4 + 3] = 0
  }
  ctx.putImageData(imgData, 0, 0)
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

  // --- Canvas del Gollin ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgElRef = useRef<HTMLImageElement | null>(null)
  const imgUrlRef = useRef<string | null>(null)
  const noiseRef = useRef<Float32Array | null>(null)
  // El campo de ruido se regenera UNA vez por ronda (nueva imagen a adivinar):
  // así las pistas de una misma ronda agregan fragmentos sobre los anteriores
  // (nested), y cada ronda nueva tiene un fragmentado distinto.
  const noiseKey = `${roundKey}:${roundIdx}`
  useEffect(() => {
    noiseRef.current = makeNoiseField()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseKey])

  // Redibuja al cambiar la imagen, el nivel de revelado, o el ruido de la ronda.
  // Carga la imagen una sola vez por URL (se cachea en imgElRef).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img || !noiseRef.current) return
    let cancelled = false
    const paint = () => {
      if (cancelled || !canvasRef.current || !imgElRef.current || !noiseRef.current) return
      drawFragment(canvasRef.current, imgElRef.current, noiseRef.current, revealPercent)
    }
    if (imgUrlRef.current === img && imgElRef.current?.complete) {
      paint()
    } else {
      const image = new Image()
      image.onload = () => {
        if (cancelled) return
        imgElRef.current = image
        imgUrlRef.current = img
        paint()
      }
      image.src = img
    }
    return () => {
      cancelled = true
    }
  }, [img, revealPercent, noiseKey])

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
          {/* Figura fragmentada, dibujada en canvas (ver drawFragment). Fondo
              blanco: los fragmentos de línea negra necesitan el máximo contraste
              para que se los pueda llegar a ver. */}
          <div className="relative mx-auto mt-3 aspect-square w-44 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-3 sm:mt-6 sm:w-56 sm:p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="h-full w-full"
              aria-hidden="true"
            />
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
