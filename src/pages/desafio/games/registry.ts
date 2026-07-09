import type { ComponentType } from 'react'
import { BuscarLosRojos } from './BuscarLosRojos'
import { QueHayEnLaMesa } from './QueHayEnLaMesa'
import { CazadorDeLetras } from './CazadorDeLetras'
import { OrdenarLaFrase } from './OrdenarLaFrase'
import { LaCharlaDesordenada } from './LaCharlaDesordenada'
import { PlanificaLaManana } from './PlanificaLaManana'
import { CadaCosaEnSuGrupo } from './CadaCosaEnSuGrupo'
import { CuatroPalabras } from './CuatroPalabras'
import { QueSera } from './QueSera'
import { QueObjetoEs } from './QueObjetoEs'
import { ListaDelMercado } from './ListaDelMercado'
import { AnimalPorLetra } from './AnimalPorLetra'

/**
 * Interactive games keyed by challenge day. A day whose `type` is 'game' and whose
 * number appears here renders its component in the modal instead of the static card.
 *
 * To add a game: write the component, add one line here, and set the day's `type`
 * to 'game' in challengeContent.ts.
 */
export const GAMES: Record<number, ComponentType> = {
  2: ListaDelMercado,
  3: AnimalPorLetra,
  4: CazadorDeLetras,
  7: CadaCosaEnSuGrupo,
  8: OrdenarLaFrase,
  10: CuatroPalabras,
  11: QueHayEnLaMesa,
  12: LaCharlaDesordenada,
  18: QueSera,
  20: QueObjetoEs,
  21: PlanificaLaManana,
  24: BuscarLosRojos,
}
