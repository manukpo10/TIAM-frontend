import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El gran observador" — día 15 (mes 2), ejecutivas. Four ATMOSPHERIC scene
 * photos (a mood/place/time, not a single object on white) are shown at
 * once; the player taps a photo, then taps the concept tag it evokes.
 * Semantic association + sustained visual attention across four images at
 * once — genuinely different from the object-photo games elsewhere in this
 * codebase (CualNoVa, QueOficioEs, DosPistas), which is exactly why these
 * eight photos were generated fresh via the local Flux instance rather than
 * reused: nothing in the existing asset library is a SCENE photo, every
 * existing folder is a single subject on a plain background.
 *
 * Interaction order is fixed (tap a photo to select it, THEN tap a tag to
 * assign) rather than allowing either order, to keep the state machine to
 * one "selection" concept — the same one-thing-selected-at-a-time shape
 * QueOficioEs/CualNoVa already use for their option grids. A correct tag
 * locks the photo (checkmark + label, both disabled); a wrong tag flashes
 * that tag button (muted, never red) and leaves the photo selected so the
 * player can just try another tag — no penalty beyond the mistake count, and
 * the round is never blocked.
 *
 * Content is a single pool of 8 photo↔concept pairs (invierno, verano,
 * noche, mañana, lluvia, ciudad, campo, otoño), split into two 4-photo
 * rounds per playthrough (so every round uses genuinely different photos,
 * not a repeat) — which four land in which round is reshuffled each replay.
 * Difficulty ramps by adding DISTRACTOR tags drawn from the OTHER round's
 * concepts (never from the photos actually on screen, which would make a
 * tag ambiguous): L1 has no distractors (four photos, four tags, pure
 * matching), L2 adds one, L3 adds two — same "more options to sift" ramp
 * CualNoVa/QueOficioEs use, adapted to a many-to-one-at-a-time match instead
 * of a single odd-one-out.
 */

interface PhotoConcept {
  id: string
  tag: string
}

const ALL_PHOTOS: PhotoConcept[] = [
  { id: 'invierno', tag: 'Invierno' },
  { id: 'verano', tag: 'Verano' },
  { id: 'noche', tag: 'Noche' },
  { id: 'manana', tag: 'Mañana' },
  { id: 'lluvia', tag: 'Lluvia' },
  { id: 'ciudad', tag: 'Ciudad' },
  { id: 'campo', tag: 'Campo' },
  { id: 'otono', tag: 'Otoño' },
]

interface Level {
  n: number
  name: string
  rounds: number
  distractors: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', rounds: 2, distractors: 0 },
  { n: 2, name: 'Nivel 2', rounds: 2, distractors: 1 },
  { n: 3, name: 'Nivel 3', rounds: 2, distractors: 2 },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/el-gran-observador/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
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

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se observa!', '¡Perfecto!', '¡Qué buena asociación!']
const HINTS = [
  'Esa palabra no es — mirá bien la foto y pensá qué momento o lugar muestra.',
  'No es esa. ¿Qué sensación te da esa imagen?',
  'Casi. Fijate de nuevo en la foto seleccionada.',
]

export function ElGranObservador({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // Two 4-photo groups covering all 8 photos exactly once; which four land in
  // round 1 vs round 2 is reshuffled every level/replay.
  const groups = useMemo(() => {
    const shuffled = shuffle(ALL_PHOTOS)
    return [shuffled.slice(0, 4), shuffled.slice(4, 8)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIdx, roundKey])

  const [roundIdx, setRoundIdx] = useState(0)
  const photos = groups[roundIdx]
  const otherGroup = groups[1 - roundIdx]

  const options = useMemo(() => {
    const distractorTags = shuffle(otherGroup.map((p) => p.tag)).slice(0, level.distractors)
    return shuffle([...photos.map((p) => p.tag), ...distractorTags])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, otherGroup, level.distractors])

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, string>>({}) // photoId -> tag
  const [wrongTag, setWrongTag] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const [hint, setHint] = useState<string | null>(null)
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (wrap
  // from level 3 back to level 1) — same policy as every other game here.
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const roundDone = Object.keys(matched).length >= photos.length
  const done = roundDone && roundIdx >= level.rounds - 1

  useEffect(() => {
    if (roundDone) setPraise(pickOne(PRAISE))
  }, [roundDone])

  function tapPhoto(photoId: string) {
    if (matched[photoId]) return // already solved, silent no-op
    setSelectedPhoto((cur) => (cur === photoId ? null : photoId))
    setHint(null)
  }

  function tapTag(tag: string) {
    if (!selectedPhoto || roundDone) return
    const photo = photos.find((p) => p.id === selectedPhoto)
    if (!photo) return
    if (tag === photo.tag) {
      setMatched((m) => ({ ...m, [selectedPhoto]: tag }))
      setSelectedPhoto(null)
      setHint(null)
      setCorrectCount((c) => c + 1)
    } else {
      setWrongTag(tag)
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
      window.setTimeout(() => setWrongTag((t) => (t === tag ? null : t)), 500)
    }
  }

  function nextRound() {
    setSelectedPhoto(null)
    setMatched({})
    setWrongTag(null)
    setHint(null)
    setRoundIdx((i) => i + 1)
  }
  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — never in a separate effect keyed on them (that would
  // let the onComplete effect below read a stale `done` on the render that
  // just arrived at the new level — the hazard fixed across this codebase's
  // other games, e.g. CaminoNumerico/CadaCosaEnSuGrupo).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setSelectedPhoto(null)
    setMatched({})
    setWrongTag(null)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setSelectedPhoto(null)
    setMatched({})
    setWrongTag(null)
    setHint(null)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {!roundDone && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá una foto y su palabra</h2>
            <p className="mt-2 text-base text-slate-500">¿Qué momento o lugar te sugiere cada imagen?</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Ronda {roundIdx + 1} de {level.rounds}
            </p>
          </>
        )}
      </div>

      {!roundDone && (
        <>
          {/* Photo grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {photos.map((photo) => {
              const isMatched = !!matched[photo.id]
              const isSelected = selectedPhoto === photo.id
              const img = imgFor(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => tapPhoto(photo.id)}
                  className={[
                    'relative flex aspect-square flex-col overflow-hidden rounded-2xl border-2 bg-white transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isMatched
                      ? 'border-tiam-green'
                      : isSelected
                        ? 'border-tiam-blue ring-2 ring-tiam-blue/30'
                        : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {img && (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full flex-1 object-cover"
                      draggable={false}
                    />
                  )}
                  {isMatched && (
                    <span className="flex items-center justify-center gap-1 bg-tiam-green/15 py-1.5 text-sm font-bold text-tiam-green">
                      <Check className="h-4 w-4" strokeWidth={3} />
                      {matched[photo.id]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tag options */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {options.map((tag) => {
              const isUsed = Object.values(matched).includes(tag)
              const isWrongFlash = wrongTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={isUsed || !selectedPhoto}
                  onClick={() => tapTag(tag)}
                  className={[
                    'min-h-[48px] rounded-xl border-2 px-4 py-2 text-base font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isUsed
                      ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                      : isWrongFlash
                        ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white text-slate-700'
                        : selectedPhoto
                          ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                          : 'border-slate-100 bg-slate-50 text-slate-400',
                  ].join(' ')}
                >
                  {tag}
                </button>
              )
            })}
          </div>

          <p className="mt-4 text-center text-sm font-medium text-slate-500">
            {hint ?? (selectedPhoto ? 'Ahora tocá la palabra que le corresponda.' : 'Tocá primero una foto.')}
          </p>
        </>
      )}

      {/* Ronda / nivel completo */}
      {roundDone && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {done
              ? `¡Asociaste todas las fotos — completaste el ${level.name.toLowerCase()}!`
              : '¡Asociaste las 4 fotos de esta ronda!'}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {done ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente ronda
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
