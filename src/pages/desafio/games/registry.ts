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
import { ElVuelto } from './ElVuelto'
import { VerdaderoOFalso } from './VerdaderoOFalso'
import { Memotest } from './Memotest'
import { ContadorMasMenos } from './ContadorMasMenos'
import { CaminoNumerico } from './CaminoNumerico'
import { EmpecemosPorHoy } from './EmpecemosPorHoy'
import { QueSeEsconde } from './QueSeEsconde'
import { QueSigue } from './QueSigue'
import { QueCambio } from './QueCambio'
import { ElReloj } from './ElReloj'
import { QueOficioEs } from './QueOficioEs'
import { LaBalanza } from './LaBalanza'

/**
 * Interactive games keyed by challenge day. A day whose `type` is 'game' and whose
 * number appears here renders its component in the modal instead of the static card.
 *
 * To add a game: write the component, add one line here, and set the day's `type`
 * to 'game' in challengeContent.ts.
 */
export const GAMES: Record<number, ComponentType> = {
  1: EmpecemosPorHoy,
  2: ListaDelMercado,
  3: AnimalPorLetra,
  4: CazadorDeLetras,
  5: ElVuelto,
  7: CadaCosaEnSuGrupo,
  9: ElReloj,
  13: CaminoNumerico,
  8: OrdenarLaFrase,
  10: CuatroPalabras,
  11: QueHayEnLaMesa,
  12: LaCharlaDesordenada,
  16: VerdaderoOFalso,
  17: QueCambio,
  18: QueSera,
  19: Memotest,
  20: QueObjetoEs,
  21: PlanificaLaManana,
  22: ContadorMasMenos,
  24: BuscarLosRojos,
  25: QueSigue,
  26: QueOficioEs,
  27: QueSeEsconde,
  29: LaBalanza,
}
