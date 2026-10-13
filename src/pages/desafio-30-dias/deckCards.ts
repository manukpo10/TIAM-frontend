import dia1 from '@/assets/desafio/dia1.webp'
import dia3 from '@/assets/desafio/dia3.webp'
import dia4 from '@/assets/desafio/dia4.webp'
import dia5 from '@/assets/desafio/dia5.webp'
import dia7 from '@/assets/desafio/dia7.webp'
import dia8 from '@/assets/desafio/dia8.webp'
import dia9 from '@/assets/desafio/dia9.webp'
import dia10 from '@/assets/desafio/dia10.webp'
import dia30 from '@/assets/desafio/dia30.webp'

/**
 * The cards of the Desafío page's deck: one illustration per cognitive area, then
 * the "you made it" trophy.
 *
 * A card shows ONLY the area it stands for (label and color are the ones the
 * Desafío's own day grid uses, AREA_META in DesafioPlayPage). Never a day number
 * or an exercise title: these illustrations were drawn per day before the games
 * were written, so they don't match today's titles (dia1 shows a calendar, but
 * day 1 is "Armá las palabras"), and a caption would promise a game that doesn't
 * exist.
 */
export interface DeckCard {
  src: string
  label: string
  color: string
}

export const DECK_CARDS: DeckCard[] = [
  { src: dia1, label: 'Orientación', color: '#D97706' },
  { src: dia10, label: 'Memoria', color: '#1B6FC4' },
  { src: dia4, label: 'Lenguaje', color: '#4CA52E' },
  { src: dia5, label: 'Cálculo', color: '#0891B2' },
  { src: dia3, label: 'Reconocimiento', color: '#DB2777' },
  { src: dia8, label: 'Visuoespacial', color: '#7C3AED' },
  { src: dia9, label: 'Razonamiento', color: '#4F46E5' },
  { src: dia7, label: 'Atención', color: '#E8531E' },
  { src: dia30, label: '¡Lo lograste!', color: '#C98A00' },
]

/** The eight cognitive areas: every card but the trophy, which always closes the deck. */
export const AREA_CARDS = DECK_CARDS.slice(0, -1)
