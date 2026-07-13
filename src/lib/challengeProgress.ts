import type { ChallengeArea } from './challengeContent'

/**
 * Shared contract between the "Desafío 30 días" games and the challenge-progress
 * backend (stars, streak, badges, per-area breakdown). Lives in `lib/` on purpose
 * — challenge-related types are kept out of the shared `types/index.ts` barrel,
 * same convention as `challengeContent.ts`.
 */

/** What a game reports once it finishes all 3 levels of its day. */
export interface GameResult {
  mistakes: number
  totalAttempts: number
}

/** Props every retrofitted challenge game receives from DesafioPlayPage.
 * `progress` is optional and only consumed by the handful of games that use the
 * player's own real challenge history as content (días 28/30) — every other game
 * ignores it, which structural typing allows without any change on their end. */
export type GameProps = {
  day: number
  onComplete: (result: GameResult) => void
  progress?: ChallengeProgress | null
}

/** Request body for POST /challenge/:token/days/:day/complete. */
export type CompleteDayRequest = GameResult

/** A persisted result for one completed challenge day. */
export interface DayResult {
  day: number
  /** Derived server-side from the day catalog — never trusted from the client. */
  area: ChallengeArea
  mistakes: number
  totalAttempts: number
  /** 1-3, computed server-side from the mistakes/totalAttempts ratio. Floors at 1, never 0. */
  stars: 1 | 2 | 3
  /** ISO timestamp, set server-side — never trusted from the client. */
  playedAt: string
}

/** Response from POST /challenge/:token/days/:day/complete — the persisted/updated day result. */
export type CompleteDayResponse = DayResult

export interface StreakInfo {
  /** Consecutive completed days ending at the most recent play. 'card' days never break it. */
  current: number
  longest: number
}

/** Matches the backend's ChallengeBadgeResponse codes exactly (uppercase, "backend
 * derives, frontend labels" split — see BADGE_META below for the copy/icon side). */
export type BadgeId = 'FIRST_DAY' | 'STREAK_3' | 'STREAK_7' | 'HALFWAY' | 'CHALLENGE_COMPLETE' | 'PERFECT_DAY'

/** Raw shape from the API — ALL 6 badges are always present, `earned` says which
 * ones the buyer actually has. No label/description/earnedAt: that's frontend-only
 * (see BADGE_META), matching how `area` on DayResult is a bare slug too. */
export interface Badge {
  code: BadgeId
  earned: boolean
}

/** Matches the backend's ChallengeAreaBreakdownResponse exactly. */
export interface AreaScore {
  area: ChallengeArea
  played: number
  averageStars: number
}

/** Response from GET /challenge/:token/progress. */
export interface ChallengeProgress {
  days: DayResult[]
  streak: StreakInfo
  badges: Badge[]
  areaBreakdown: AreaScore[]
}

/** Frontend-only copy for each badge code — icons are picked by the consuming
 * component (same split as AREA_META in DesafioPlayPage.tsx, which keeps icon
 * imports out of this shared lib file). */
export const BADGE_META: Record<BadgeId, { label: string; description: string }> = {
  FIRST_DAY: { label: 'Primer paso', description: 'Jugaste tu primer día del desafío.' },
  STREAK_3: { label: 'Racha de 3', description: 'Completaste 3 días seguidos.' },
  STREAK_7: { label: 'Racha de 7', description: 'Completaste 7 días seguidos.' },
  HALFWAY: { label: 'Mitad de camino', description: 'Llegaste a la mitad de los ejercicios del desafío.' },
  CHALLENGE_COMPLETE: { label: 'Desafío completo', description: 'Jugaste los 30 ejercicios del desafío.' },
  PERFECT_DAY: { label: 'Día perfecto', description: 'Conseguiste 3 estrellas en un día.' },
}

// Matched by badge code (lowercase filename) — same import.meta.glob pattern as
// challengeContent.ts's day illustrations, relative to THIS file (src/lib/).
const BADGE_ILLUSTRATIONS = import.meta.glob('../assets/desafio/badges/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/** Illustration for the badge-unlock celebration — undefined only if the asset
 * pipeline hasn't generated one for this code yet (callers render without it). */
export function badgeIllustration(code: BadgeId): string | undefined {
  const match = Object.entries(BADGE_ILLUSTRATIONS).find(([path]) => path.endsWith(`/${code.toLowerCase()}.webp`))
  return match?.[1]
}

/**
 * Stars from a game result — accuracy-based, never an absolute mistake count, so
 * a 4-question game (Empecemos por hoy) and a ~36-attempt game (Verdadero o falso)
 * are graded on the same curve. The 2★/1★ cut (≥60%) reuses the threshold two
 * games already use for their own internal "bien"/"ok" feedback. The 3★ cut is a
 * generous ≥85% (not 100%) so a single slip isn't a report card. Floors at 1 star,
 * never 0 — this is a rehab context, not a competition.
 */
export function computeStars(mistakes: number, totalAttempts: number): 1 | 2 | 3 {
  const accuracy = totalAttempts === 0 ? 1 : (totalAttempts - mistakes) / totalAttempts
  if (accuracy >= 0.85) return 3
  if (accuracy >= 0.6) return 2
  return 1
}
