import { Flame, Star, Trophy, type LucideIcon } from 'lucide-react'
import { BADGE_META, type BadgeId, type ChallengeProgress } from '@/lib/challengeProgress'
import { CHALLENGE_DAYS, type ChallengeArea } from '@/lib/challengeContent'

/**
 * Summary card for the "Desafío 30 días" day-grid page: streak, earned
 * badges, and a per-area star average. Deliberately never compares one
 * person's numbers to anyone else's — every number here is about this one
 * buyer's own play, nothing more (see the session's standing "no ranking
 * between patients" decision).
 *
 * Renders nothing until there's at least one played day — an empty streak/
 * badges/area section on day one would just be noise before there's
 * anything to show.
 */

const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  FIRST_DAY: Star,
  STREAK_3: Flame,
  STREAK_7: Flame,
  HALFWAY: Trophy,
  CHALLENGE_COMPLETE: Trophy,
  PERFECT_DAY: Star,
}

// Same colors as AREA_META in DesafioPlayPage.tsx — kept in sync manually
// since this panel and the day-grid are the only two places area colors are
// used, and pulling them into a shared constant would be one more import for
// two call sites.
const AREA_LABEL: Record<ChallengeArea, string> = {
  memoria: 'Memoria',
  atencion: 'Atención',
  lenguaje: 'Lenguaje',
  praxias: 'Dibujo',
  calculo: 'Cálculo',
  orientacion: 'Orientación',
  ejecutivas: 'Razonamiento',
}
const AREA_COLOR: Record<ChallengeArea, string> = {
  memoria: '#1B6FC4',
  atencion: '#E8531E',
  lenguaje: '#4CA52E',
  praxias: '#7C3AED',
  calculo: '#0891B2',
  orientacion: '#D97706',
  ejecutivas: '#4F46E5',
}

function StarRow({ filled }: { filled: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${filled} de 3 estrellas`}>
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={n <= filled ? 'h-4 w-4 fill-tiam-orange text-tiam-orange' : 'h-4 w-4 text-slate-200'}
        />
      ))}
    </div>
  )
}

export function ChallengeProgressPanel({ progress }: { progress: ChallengeProgress | null }) {
  if (!progress || progress.days.length === 0) return null

  const { streak, badges, areaBreakdown } = progress
  const earnedBadges = badges.filter((b) => b.earned)
  // Only areas with at least one playable day in the catalog AND at least one
  // game actually played show up — a blank "0 de 0" row for an area that
  // doesn't apply yet is just noise.
  const playedAreas = areaBreakdown.filter((a) => a.played > 0)

  return (
    <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      {/* Streak */}
      {streak.current > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tiam-orange/10">
            <Flame className="h-5 w-5 text-tiam-orange" />
          </div>
          <div>
            <p className="font-bold text-slate-900">
              {streak.current} {streak.current === 1 ? 'día seguido' : 'días seguidos'}
            </p>
            {streak.longest > streak.current && (
              <p className="text-sm text-slate-500">Tu mejor racha: {streak.longest} días</p>
            )}
          </div>
        </div>
      )}

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <div className={streak.current > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Logros</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {earnedBadges.map(({ code }) => {
              const Icon = BADGE_ICONS[code]
              const meta = BADGE_META[code]
              return (
                <div
                  key={code}
                  title={meta.description}
                  className="flex items-center gap-1.5 rounded-full bg-tiam-blue/5 py-1.5 pl-2 pr-3 text-sm font-semibold text-tiam-blue-dark"
                >
                  <Icon className="h-4 w-4 text-tiam-blue" />
                  {meta.label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Area breakdown */}
      {playedAreas.length > 0 && (
        <div
          className={
            streak.current > 0 || earnedBadges.length > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''
          }
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Por área</p>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {playedAreas.map(({ area, played, averageStars }) => (
              <div key={area} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: AREA_COLOR[area] }} />
                  {AREA_LABEL[area]}
                  <span className="text-slate-400">
                    · {played} de {gameDaysForArea(area)} días
                  </span>
                </span>
                <StarRow filled={Math.round(averageStars)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** How many 'game'-type days exist for a given area — the API only sends
 * `played`, not a total, so the "de N días" denominator is derived here from
 * the day catalog that's already available client-side. */
function gameDaysForArea(area: ChallengeArea): number {
  return CHALLENGE_DAYS.filter((d) => d.area === area && d.type === 'game').length
}
