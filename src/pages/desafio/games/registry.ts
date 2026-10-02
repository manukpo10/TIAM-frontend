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
import { CaminoNumerico } from './CaminoNumerico'
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
import { LaIntrusaDeLaLista } from './LaIntrusaDeLaLista'
import { OrdenaLasCifras } from './OrdenaLasCifras'
import { CopiaElPatron } from './CopiaElPatron'
import { NumerosAlReves } from './NumerosAlReves'
import { ElGrupoCorrecto } from './ElGrupoCorrecto'
import { CierreDeCuentas } from './CierreDeCuentas'
import { FlorDePalabra } from './FlorDePalabra'
import { OficiosDeFamosos } from './OficiosDeFamosos'
import { SumaHastaDiez } from './SumaHastaDiez'
import { UnirConOperaciones } from './UnirConOperaciones'
import { SopaDeMesesYDias } from './SopaDeMesesYDias'
import { CualEsCual } from './CualEsCual'
import { DetectivesDelParque } from './DetectivesDelParque'
import { CalculoMental } from './CalculoMental'
import { TiraElDado } from './TiraElDado'
import { LetrasPerdidas } from './LetrasPerdidas'
import { QuienEsCadaUno } from './QuienEsCadaUno'
import { CifrasQueFaltan } from './CifrasQueFaltan'
import { PalabraYDefinicion } from './PalabraYDefinicion'
import { ArbolGenealogico } from './ArbolGenealogico'
import { CasasDelBarrio } from './CasasDelBarrio'
import { CrucigramaNumerico } from './CrucigramaNumerico'
import { ElColorDeLaPalabra } from './ElColorDeLaPalabra'
import { CuantoSuma } from './CuantoSuma'
import { TelaranaMatematica } from './TelaranaMatematica'
import { QuienLoDijo } from './QuienLoDijo'
import { LeerYResponder } from './LeerYResponder'
import { LaberintoDeMultiplicaciones } from './LaberintoDeMultiplicaciones'
import { BanderasYSaludos } from './BanderasYSaludos'
import { LasDiferencias } from './LasDiferencias'
import { AnagramasPorCategoria } from './AnagramasPorCategoria'
import { CandadosYLlaves } from './CandadosYLlaves'
import { PuestoDeComida } from './PuestoDeComida'
import { AViajar } from './AViajar'
import { LosVecinos } from './LosVecinos'
import { OrdenaLaOracion } from './OrdenaLaOracion'
import { LeeYRecorda } from './LeeYRecorda'
import { ElNumeroSecreto } from './ElNumeroSecreto'
import { LeeEnOrden } from './LeeEnOrden'
import { DosDeCadaGrupo } from './DosDeCadaGrupo'
import { FormaYColor } from './FormaYColor'
import { RefranesSinVocales } from './RefranesSinVocales'
import { SumaHastaTreinta } from './SumaHastaTreinta'
import { LaRuletaDeLetras } from './LaRuletaDeLetras'
import { MensajeCifrado } from './MensajeCifrado'
import { QueNumeroEs } from './QueNumeroEs'
import { FrasesAlReves } from './FrasesAlReves'
import { DiagramasQueSuman } from './DiagramasQueSuman'
import { LasFloresDelJardin } from './LasFloresDelJardin'
import { CuadradosMagicos } from './CuadradosMagicos'
import { ColoresEnLaGrilla } from './ColoresEnLaGrilla'
import { PartesDelCuerpo } from './PartesDelCuerpo'
import { PalabrasDesordenadas } from './PalabrasDesordenadas'
import { LaPanaderia } from './LaPanaderia'
import { LaFlorQueMasSeRepite } from './LaFlorQueMasSeRepite'
import { PalabrasConCondiciones } from './PalabrasConCondiciones'
import { LaPiramideDeLetras } from './LaPiramideDeLetras'
import { DaleColorALosNumeros } from './DaleColorALosNumeros'
import { ArmaLaMariposa } from './ArmaLaMariposa'
import { LosDepartamentos } from './LosDepartamentos'
import { ElPanalDeLetras } from './ElPanalDeLetras'
import { CuentasEnLaTabla } from './CuentasEnLaTabla'
import { PintaSegunElCodigo } from './PintaSegunElCodigo'
import { LaEstrellaDeSumas } from './LaEstrellaDeSumas'

/**
 * Interactive games keyed by (challenge month, day). A day whose `type` is 'game'
 * and whose (month, day) pair has an entry here renders that component in the
 * modal instead of the static-card fallback (illustration/icon + instructions) —
 * see DesafioPlayPage.tsx, which falls back gracefully whenever a 'game' day has
 * no matching registry entry. Months 1-5 are fully wired (their lápiz-y-papel
 * 'card' days have no entry on purpose).
 *
 * To add a game: write the component, add one line under the right month below,
 * and make sure the day's `type` is 'game' in challengeContent.ts (true for every
 * day except the 'card' ones).
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
    11: CaminoNumerico,
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
    24: LaIntrusaDeLaLista,
    25: OrdenaLasCifras,
    26: CopiaElPatron,
    27: NumerosAlReves,
    // 28 sin entrada: día 'card' (lápiz y papel), no tiene componente — ver
    // el comentario junto a su entrada en challengeContent.ts.
    29: ElGrupoCorrecto,
    30: CierreDeCuentas,
  },
  // Month 4 shipped in weekly batches of 7 and is fully wired now (18 is the
  // only lápiz-y-papel card day).
  4: {
    1: FlorDePalabra,
    2: OficiosDeFamosos,
    3: SumaHastaDiez,
    4: UnirConOperaciones,
    5: SopaDeMesesYDias,
    6: CualEsCual,
    7: DetectivesDelParque,
    8: CalculoMental,
    9: TiraElDado,
    10: LetrasPerdidas,
    11: TelaranaMatematica,
    12: CandadosYLlaves,
    13: AnagramasPorCategoria,
    14: ElColorDeLaPalabra,
    15: QuienLoDijo,
    16: QuienEsCadaUno,
    17: CifrasQueFaltan,
    // 18 is a lápiz-y-papel CARD day now (see challengeContent.ts) — no
    // registry entry, same as month 3's card days.
    19: PalabraYDefinicion,
    20: LaberintoDeMultiplicaciones,
    21: PuestoDeComida,
    22: ArbolGenealogico,
    23: LasDiferencias,
    24: AViajar,
    25: CuantoSuma,
    26: LosVecinos,
    27: BanderasYSaludos,
    28: LeerYResponder,
    29: CasasDelBarrio,
    30: CrucigramaNumerico,
  },
  // Month 5 shipped in weekly batches of 7 and every game is built now: días 1-13
  // and 15-30 have an entry, and 14 is a lápiz-y-papel card day that never will.
  // All 30 days are declared in challengeContent.ts's MONTH_5_DAYS_CONTENT, and the
  // backend unlocks them by elapsed week.
  5: {
    1: OrdenaLaOracion,
    2: LeeYRecorda,
    3: ElNumeroSecreto,
    4: LeeEnOrden,
    5: DosDeCadaGrupo,
    6: FormaYColor,
    7: RefranesSinVocales,
    8: SumaHastaTreinta,
    9: LaRuletaDeLetras,
    10: MensajeCifrado,
    11: QueNumeroEs,
    12: FrasesAlReves,
    13: DiagramasQueSuman,
    // 14 sin entrada: día 'card' (lápiz y papel), no tiene componente.
    15: LasFloresDelJardin,
    16: CuadradosMagicos,
    17: ColoresEnLaGrilla,
    18: PartesDelCuerpo,
    19: PalabrasDesordenadas,
    20: LaPanaderia,
    21: LaFlorQueMasSeRepite,
    22: PalabrasConCondiciones,
    23: LaPiramideDeLetras,
    24: DaleColorALosNumeros,
    25: ArmaLaMariposa,
    26: LosDepartamentos,
    27: ElPanalDeLetras,
    28: CuentasEnLaTabla,
    29: PintaSegunElCodigo,
    30: LaEstrellaDeSumas,
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
