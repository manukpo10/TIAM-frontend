import type { ComponentType } from 'react'
import { BuscarLosRojos } from './BuscarLosRojos'
import { QueHayEnLaMesa } from './QueHayEnLaMesa'
import { CazadorDeLetras } from './CazadorDeLetras'
import { OrdenarLaFrase } from './OrdenarLaFrase'
import { LaCharlaDesordenada } from './LaCharlaDesordenada'
import { PlanificaLaManana } from './PlanificaLaManana'
import { CadaCosaEnSuGrupo } from './CadaCosaEnSuGrupo'

/**
 * Interactive games keyed by challenge day. A day whose `type` is 'game' and whose
 * number appears here renders its component in the modal instead of the static card.
 *
 * To add a game: write the component, add one line here, and set the day's `type`
 * to 'game' in challengeContent.ts.
 */
export const GAMES: Record<number, ComponentType> = {
  4: CazadorDeLetras,
  7: CadaCosaEnSuGrupo,
  8: OrdenarLaFrase,
  11: QueHayEnLaMesa,
  12: LaCharlaDesordenada,
  21: PlanificaLaManana,
  24: BuscarLosRojos,
}
