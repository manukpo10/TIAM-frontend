import type { ComponentType } from 'react'
import type { GameProps } from '@/lib/challengeProgress'
import { BuscarLosRojos } from './BuscarLosRojos'
import { CualNoVa } from './CualNoVa'
import { ClaveDeSimbolos } from './ClaveDeSimbolos'
import { OrdenarLaFrase } from './OrdenarLaFrase'
import { OracionesAMedida } from './OracionesAMedida'
import { PlanificaLaManana } from './PlanificaLaManana'
import { CadaCosaEnSuGrupo } from './CadaCosaEnSuGrupo'
import { DeduciLaPalabra } from './DeduciLaPalabra'
import { QueSera } from './QueSera'
import { PalabrasYColores } from './PalabrasYColores'
import { DondeEsta } from './DondeEsta'
import { ListaDelMercado } from './ListaDelMercado'
import { ElVuelto } from './ElVuelto'
import { LaPiramide } from './LaPiramide'
import { Memotest } from './Memotest'
import { ContadorMasMenos } from './ContadorMasMenos'
import { EmpecemosPorHoy } from './EmpecemosPorHoy'
import { ArmaLasPalabras } from './ArmaLasPalabras'
import { CuantosHay } from './CuantosHay'
import { QueCambio } from './QueCambio'
import { ElReloj } from './ElReloj'
import { OficioIdeal } from './OficioIdeal'
import { LosOpuestos } from './LosOpuestos'
import { DosPistas } from './DosPistas'
import { PalabrasEnClave } from './PalabrasEnClave'
import { LaCancionDeTuJuventud } from './LaCancionDeTuJuventud'
import { LetrasEnMovimiento } from './LetrasEnMovimiento'
import { UnaLetraDeCadaUno } from './UnaLetraDeCadaUno'
import { QuePalabraSeEsconde } from './QuePalabraSeEsconde'
import { LasMismasLetras } from './LasMismasLetras'
import { DichosAMedias } from './DichosAMedias'
import { RepetiLaSerie } from './RepetiLaSerie'
import { ABuscarYEncontrar } from './ABuscarYEncontrar'
import { ElDescuento } from './ElDescuento'
import { CopiaLaFigura } from './CopiaLaFigura'
import { UniendoPuntos } from './UniendoPuntos'
import { Jeroglifico } from './Jeroglifico'
import { QuienEsQuien } from './QuienEsQuien'
import { UnEdificioConHistorias } from './UnEdificioConHistorias'
import { OrdenAlfabetico } from './OrdenAlfabetico'
import { EsLoMismoDecir } from './EsLoMismoDecir'
import { ElPasoAPaso } from './ElPasoAPaso'
import { Encaminada } from './Encaminada'
import { FluenciaCerrada } from './FluenciaCerrada'
import { ElGranObservador } from './ElGranObservador'
import { DondeLoDeje } from './DondeLoDeje'
import { LetrasRevueltas } from './LetrasRevueltas'
import { LaIntrusa } from './LaIntrusa'
import { AlmacenDeSilabas } from './AlmacenDeSilabas'
import { SeguiElPatron } from './SeguiElPatron'
import { FotosConectadas } from './FotosConectadas'
import { DesafioDeDeduccion } from './DesafioDeDeduccion'
import { UniteConPista } from './UniteConPista'
import { LaPalabraEscondida } from './LaPalabraEscondida'
import { FamiliaDePalabras } from './FamiliaDePalabras'
import { Sudoku4x4 } from './Sudoku4x4'
import { Coordenadas } from './Coordenadas'
import { NoEstaRepetida } from './NoEstaRepetida'
import { MesaDeCartas } from './MesaDeCartas'
import { AntesYDespues } from './AntesYDespues'
import { CruceDeLetras } from './CruceDeLetras'
import { ListaConParecidas } from './ListaConParecidas'
import { TripleYCorrida } from './TripleYCorrida'
import { TrazaElCamino } from './TrazaElCamino'
import { RompecabezasDeLetras } from './RompecabezasDeLetras'
import { MarcaLosNumeros } from './MarcaLosNumeros'
import { PistasConvergentes } from './PistasConvergentes'
import { ElEslabonPerdido } from './ElEslabonPerdido'
import { RecordaLosDetalles } from './RecordaLosDetalles'
import { SopaDeLetras } from './SopaDeLetras'
import { CrucigramaDeCifras } from './CrucigramaDeCifras'
import { LaOtraMitad } from './LaOtraMitad'
import { RadarDeSilabas } from './RadarDeSilabas'
import { PuenteDeOpuestos } from './PuenteDeOpuestos'
import { LaQueNoEncaja } from './LaQueNoEncaja'
import { FluenciaConRecuerdo } from './FluenciaConRecuerdo'
import { CompletaLaFrase } from './CompletaLaFrase'
import { CalculoEnCuadro } from './CalculoEnCuadro'
import { ContinuaLaSerie } from './ContinuaLaSerie'
import { ElHiloInvisible } from './ElHiloInvisible'
import { QueFaltaEnLaEsquina } from './QueFaltaEnLaEsquina'
import { SinonimoAntonimoOIgual } from './SinonimoAntonimoOIgual'
import { QueFaltaEnLaLista } from './QueFaltaEnLaLista'
import { OrdenaLasCifras } from './OrdenaLasCifras'
import { CopiaElPatron } from './CopiaElPatron'
import { NumerosAlReves } from './NumerosAlReves'
import { ObjetosYLetras } from './ObjetosYLetras'
import { ElGrupoCorrecto } from './ElGrupoCorrecto'
import { CierreDeCuentas } from './CierreDeCuentas'

/**
 * Interactive games keyed by (challenge month, day). A day whose `type` is 'game'
 * and whose (month, day) pair has an entry here renders that component in the
 * modal instead of the static-card fallback (illustration/icon + instructions) —
 * see DesafioPlayPage.tsx, which falls back gracefully whenever a 'game' day has
 * no matching registry entry (kept as a defensive fallback, not because either
 * month currently relies on it — both months are fully wired below).
 *
 * To add a game: write the component, add one line under the right month below,
 * and make sure the day's `type` is 'game' in challengeContent.ts (already true
 * for every day in both months as of this writing).
 *
 * Typed `ComponentType<GameProps>`, but games not yet retrofitted to accept
 * `{ day, onComplete }` still satisfy it — TS structural typing allows a
 * zero-arg component to stand in for a component that accepts (unused) props,
 * so games can be migrated one at a time without breaking the rest.
 */
export const GAMES_BY_MONTH: Record<number, Partial<Record<number, ComponentType<GameProps>>>> = {
  1: {
    1: ArmaLasPalabras,
    2: ListaDelMercado,
    3: QuePalabraSeEsconde,
    4: ClaveDeSimbolos,
    5: ElVuelto,
    6: LetrasEnMovimiento,
    7: CadaCosaEnSuGrupo,
    8: OrdenarLaFrase,
    9: ElReloj,
    10: LaCancionDeTuJuventud,
    11: CualNoVa,
    12: OracionesAMedida,
    13: EmpecemosPorHoy,
    14: LosOpuestos,
    15: DeduciLaPalabra,
    16: LaPiramide,
    17: CuantosHay,
    18: PalabrasYColores,
    19: Memotest,
    20: DondeEsta,
    21: PlanificaLaManana,
    22: OficioIdeal,
    23: UnaLetraDeCadaUno,
    24: BuscarLosRojos,
    25: LasMismasLetras,
    26: ContadorMasMenos,
    27: QueCambio,
    28: DosPistas,
    29: QueSera,
    30: PalabrasEnClave,
  },
  2: {
    1: DichosAMedias,
    2: RepetiLaSerie,
    3: ABuscarYEncontrar,
    4: ElDescuento,
    5: CopiaLaFigura,
    6: UniendoPuntos,
    7: Jeroglifico,
    8: QuienEsQuien,
    9: UnEdificioConHistorias,
    10: OrdenAlfabetico,
    11: EsLoMismoDecir,
    12: ElPasoAPaso,
    13: Encaminada,
    14: FluenciaCerrada,
    15: ElGranObservador,
    16: DondeLoDeje,
    17: LetrasRevueltas,
    18: LaIntrusa,
    19: AlmacenDeSilabas,
    20: SeguiElPatron,
    21: FotosConectadas,
    22: DesafioDeDeduccion,
    23: UniteConPista,
    24: LaPalabraEscondida,
    25: FamiliaDePalabras,
    26: Sudoku4x4,
    27: Coordenadas,
    28: NoEstaRepetida,
    29: MesaDeCartas,
    30: AntesYDespues,
  },
  3: {
    1: CruceDeLetras,
    2: ListaConParecidas,
    3: TripleYCorrida,
    4: TrazaElCamino,
    5: RompecabezasDeLetras,
    6: MarcaLosNumeros,
    7: PistasConvergentes,
    8: ElEslabonPerdido,
    9: RecordaLosDetalles,
    10: SopaDeLetras,
    11: CrucigramaDeCifras,
    12: LaOtraMitad,
    13: RadarDeSilabas,
    // 14 sin entrada: día 'card' (lápiz y papel), no tiene componente — ver
    // el comentario junto a su entrada en challengeContent.ts.
    15: PuenteDeOpuestos,
    16: LaQueNoEncaja,
    17: FluenciaConRecuerdo,
    18: CompletaLaFrase,
    19: CalculoEnCuadro,
    20: ContinuaLaSerie,
    21: ElHiloInvisible,
    22: QueFaltaEnLaEsquina,
    23: SinonimoAntonimoOIgual,
    24: QueFaltaEnLaLista,
    25: OrdenaLasCifras,
    26: CopiaElPatron,
    27: NumerosAlReves,
    28: ObjetosYLetras,
    29: ElGrupoCorrecto,
    30: CierreDeCuentas,
  },
}

// Deliberately NOT wrapped in a `getGameComponent(month, day)` helper: the
// react-hooks/static-components lint rule flags a component sourced from a
// function call at its JSX call site ("Cannot create components during
// render"), even though this lookup is a plain, stable index into a
// module-level object — the same shape as the original single-month `GAMES`
// map. Callers that render the result as `<Component />` should index
// `GAMES_BY_MONTH[month]?.[day]` directly (see DesafioPlayPage.tsx) instead of
// reintroducing a wrapper function.
