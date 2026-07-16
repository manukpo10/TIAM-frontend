import type { ComponentType } from 'react'
import type { GameProps } from '@/lib/challengeProgress'
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
import { ElVuelto } from './ElVuelto'
import { VerdaderoOFalso } from './VerdaderoOFalso'
import { Memotest } from './Memotest'
import { ContadorMasMenos } from './ContadorMasMenos'
import { CaminoNumerico } from './CaminoNumerico'
import { EmpecemosPorHoy } from './EmpecemosPorHoy'
import { CuantosHay } from './CuantosHay'
import { QueCambio } from './QueCambio'
import { ElReloj } from './ElReloj'
import { QueOficioEs } from './QueOficioEs'
import { LaBalanza } from './LaBalanza'
import { LosOpuestos } from './LosOpuestos'
import { OrdenaTuSemana } from './OrdenaTuSemana'
import { TuResumen } from './TuResumen'
import { LaCancionDeTuJuventud } from './LaCancionDeTuJuventud'
import { EncontraLaFiguraIgual } from './EncontraLaFiguraIgual'
import { QueSonidoEs } from './QueSonidoEs'
import { QuePalabraSeEsconde } from './QuePalabraSeEsconde'
import { LasMismasLetras } from './LasMismasLetras'

/**
 * Interactive games keyed by challenge day. A day whose `type` is 'game' and whose
 * number appears here renders its component in the modal instead of the static card.
 *
 * To add a game: write the component, add one line here, and set the day's `type`
 * to 'game' in challengeContent.ts.
 *
 * Typed `ComponentType<GameProps>`, but games not yet retrofitted to accept
 * `{ day, onComplete }` still satisfy it — TS structural typing allows a
 * zero-arg component to stand in for a component that accepts (unused) props,
 * so games can be migrated one at a time without breaking the rest.
 */
export const GAMES: Record<number, ComponentType<GameProps>> = {
  1: EmpecemosPorHoy,
  2: ListaDelMercado,
  3: QuePalabraSeEsconde,
  4: CazadorDeLetras,
  5: ElVuelto,
  7: CadaCosaEnSuGrupo,
  9: ElReloj,
  13: CaminoNumerico,
  14: LosOpuestos,
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
  25: LasMismasLetras,
  26: QueOficioEs,
  27: CuantosHay,
  29: LaBalanza,
  28: OrdenaTuSemana,
  30: TuResumen,
  15: LaCancionDeTuJuventud,
  6: EncontraLaFiguraIgual,
  23: QueSonidoEs,
}
