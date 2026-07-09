import { useEffect, useRef, useState } from 'react'

export interface SequencingItem<T> {
  id: number
  value: T
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildShuffledBank<T>(correctOrder: T[]): SequencingItem<T>[] {
  const items: SequencingItem<T>[] = correctOrder.map((value, id) => ({ id, value }))
  if (items.length <= 1) return items
  let shuffled = shuffle(items)
  let guard = 0
  // A short correctOrder (e.g. a 3-word sentence) has a real chance of
  // shuffling back into the already-correct order — re-roll so the round
  // never hands the user a freebie.
  while (shuffled.every((item, i) => item.id === i) && guard < 10) {
    shuffled = shuffle(items)
    guard++
  }
  return shuffled
}

/**
 * Tap-to-order puzzle state machine, shared by any "arrange N items into
 * the correct sequence" game (word order, dialogue-line order, etc). Items
 * are tracked by their ORIGINAL POSITION (`id`), not by value — duplicate
 * values (e.g. a sentence using the word "a" twice) must not collapse into
 * one, the same class of bug a value-keyed Set would hit.
 *
 * Tap-to-place only, no drag: research on older adults and touchscreens
 * found ~78% success with tapping vs. ~45% with drag-and-drop, and this
 * app never uses drag anywhere else. Tapping a bank item appends it to
 * `placed`; tapping a placed item sends it back to the bank (undo).
 * `roundKey` forces a fresh shuffle whenever the caller wants a new round.
 */
export function useSequencingPuzzle<T>(correctOrder: T[], roundKey: unknown) {
  const [bank, setBank] = useState(() => buildShuffledBank(correctOrder))
  const [placed, setPlaced] = useState<SequencingItem<T>[]>([])
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    setBank(buildShuffledBank(correctOrder))
    setPlaced([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey])

  function place(item: SequencingItem<T>) {
    setBank((prev) => prev.filter((i) => i.id !== item.id))
    setPlaced((prev) => [...prev, item])
  }
  function unplace(item: SequencingItem<T>) {
    setPlaced((prev) => prev.filter((i) => i.id !== item.id))
    setBank((prev) => [...prev, item])
  }

  const isComplete = bank.length === 0
  const isCorrect = isComplete && placed.every((item, i) => item.id === i)

  return { bank, placed, place, unplace, isComplete, isCorrect }
}
