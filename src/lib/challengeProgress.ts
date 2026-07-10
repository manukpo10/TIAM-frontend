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

/** Props every retrofitted challenge game receives from DesafioPlayPage. */
export type GameProps = {
  day: number
  onComplete: (result: GameResult) => void
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

export type BadgeId =
  | 'first_day'
  | 'streak_3'
  | 'streak_7'
  | 'halfway'
  | 'challenge_complete'
  | 'three_star_day'

/** A badge the buyer has actually earned (unearned badges are simply absent). */
export interface Badge {
  id: BadgeId
  label: string
  description: string
  /** ISO timestamp of when the badge was earned. */
  earnedAt: string
}

export interface AreaScore {
  area: ChallengeArea
  starsEarned: number
  daysPlayed: number
  daysTotal: number
}

/** Response from GET /challenge/:token/progress. */
export interface ChallengeProgress {
  days: DayResult[]
  streak: StreakInfo
  badges: Badge[]
  areaBreakdown: AreaScore[]
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
