import type { ComponentType } from 'react'
import { BuscarLosRojos } from './BuscarLosRojos'

/**
 * Interactive games keyed by challenge day. A day whose `type` is 'game' and whose
 * number appears here renders its component in the modal instead of the static card.
 *
 * To add a game: write the component, add one line here, and set the day's `type`
 * to 'game' in challengeContent.ts.
 */
export const GAMES: Record<number, ComponentType> = {
  24: BuscarLosRojos,
}
