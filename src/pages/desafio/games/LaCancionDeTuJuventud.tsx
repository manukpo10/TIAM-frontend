import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, ArrowRight, Music, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La canción de tu juventud" — first audio-based game in the challenge.
 * Escuchás un fragmento instrumental corto (100% generado, ninguna canción
 * real con derechos) y tocás a qué género se parece más. Reemplaza el pedido
 * original de escribir una estrofa de memoria — acá el estímulo evocador es
 * el género/época en sí, no una canción puntual que dejaría afuera a
 * cualquiera cuya música no sea esa.
 *
 * Un solo round por nivel (no niveles con muchas rondas como El reloj):
 * 3 de los 5 géneros del pool, en orden al azar, uno por nivel. La dificultad
 * escala por cantidad de opciones (3→4→4), mismo criterio que el resto de los
 * juegos de "eliminación con reintento" — nunca por lo perceptualmente
 * "parecidos" que suenan dos géneros, algo que no puedo validar sin escuchar.
 */

interface Genre {
  id: string
  label: string
}
const GENRES: Genre[] = [
  { id: 'tango', label: 'Tango' },
  { id: 'folclore', label: 'Folclore' },
  { id: 'rock_nacional', label: 'Rock nacional' },
  { id: 'cumbia', label: 'Cumbia' },
  { id: 'bolero', label: 'Bolero' },
]

const OPTION_COUNT = [3, 4, 4] // por nivel

const CLIPS = import.meta.glob('../../../assets/desafio/games/la-cancion-de-tu-juventud/*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function clipFor(id: string): string | undefined {
  const match = Object.entries(CLIPS).find(([path]) => path.endsWith(`/${id}.mp3`))
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

const PRAISE = ['¡Muy bien!', '¡Excelente oído!', '¡Así se hace!', '¡Perfecto!']

export function LaCancionDeTuJuventud({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // 3 de los 5 géneros, al azar, uno por nivel — se elige una sola vez por roundKey.
  const roundGenres = useMemo(
    () => shuffle(GENRES).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey],
  )
  const genre = roundGenres[levelIdx]

  const options = useMemo(() => {
    const decoyPool = GENRES.filter((g) => g.id !== genre.id)
    const decoys = shuffle(decoyPool).slice(0, OPTION_COUNT[levelIdx] - 1)
    return shuffle([genre, ...decoys])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, levelIdx])

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasListened, setHasListened] = useState(false)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Errores acumulados a través de los 3 niveles, reseteados solo en el
  // wrap real (nextLevel al terminar nivel 3) — nunca en "otra ronda".
  const [mistakes, setMistakes] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => audioRef.current?.pause()
  }, [])

  function toggleClip() {
    const src = clipFor(genre.id)
    if (!src) return
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.onended = () => setIsPlaying(false)
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    if (audioRef.current.src !== src) audioRef.current.src = src
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setIsPlaying(true)
    setHasListened(true)
  }

  function guess(id: string) {
    if (solved || eliminated.has(id)) return
    if (id === genre.id) {
      setSolved(true)
      audioRef.current?.pause()
      setIsPlaying(false)
      setLevelPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
    }
  }

  // Reset sincrónico dentro de nextLevel()/replay() — nunca en un efecto
  // separado sobre [levelIdx, roundKey] (mismo bug ya resuelto en El vuelto:
  // un efecto llega un render tarde y dispara onComplete con datos viejos).
  function nextLevel() {
    const isWrap = levelIdx === 2
    audioRef.current?.pause()
    setLevelIdx((i) => (i < 2 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasListened(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    audioRef.current?.pause()
    setRoundKey((k) => k + 1)
    setEliminated(new Set())
    setSolved(false)
    setIsPlaying(false)
    setHasListened(false)
    // NOT setMistakes(0) — una repetición del mismo nivel no borra lo acumulado.
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (solved && levelIdx === 2 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + 3 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, levelIdx, roundKey])

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Memoria · Nivel {levelIdx + 1}
        </span>
        {!solved && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué género es?</h2>
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Escuchá el fragmento y tocá a qué género musical se parece más.
            </p>
          </>
        )}
      </div>

      {!solved && (
        <>
          {/* Play button */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={toggleClip}
              aria-label={isPlaying ? 'Pausar' : hasListened ? 'Escuchar de nuevo' : 'Escuchar'}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-tiam-blue text-white shadow-lg transition hover:bg-tiam-blue-dark active:scale-95"
            >
              {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="ml-1 h-10 w-10" />}
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-slate-400">
            {isPlaying ? 'Escuchando…' : hasListened ? 'Tocá para escuchar de nuevo' : 'Tocá para escuchar'}
          </p>

          {/* Options */}
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
            {options.map((g) => {
              const isEliminated = eliminated.has(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => guess(g.id)}
                  className={[
                    'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Completion */}
      {solved && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            {levelIdx === 2 ? (
              <Sparkles className="h-6 w-6 text-tiam-blue" />
            ) : (
              <Music className="h-6 w-6 text-tiam-blue" />
            )}
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">Era {genre.label.toLowerCase()}.</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < 2 ? 'Siguiente nivel' : 'Empezar de nuevo'}
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
