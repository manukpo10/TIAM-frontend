import {
  Sparkles, User, Flag, MapPin, ThumbsDown, Calendar, UtensilsCrossed, Heart, Users, Palette,
  type LucideIcon,
} from 'lucide-react'
import type { WorksheetPrompt } from '@/lib/challengeContent'

/**
 * Icon per worksheet item, by index — items[0] is the featured "Mis
 * fortalezas" prompt (icon used at hero size), items[1..9] are the grid
 * cards below (icon used at badge size). Purely decorative, no data
 * dependency, so unlike FlowerWorksheet's old SLOTS this array has no
 * positioning to keep in sync — just line up 1:1 with the 10 items.
 */
const ICONS: LucideIcon[] = [
  Sparkles, User, Flag, MapPin, ThumbsDown, Calendar, UtensilsCrossed, Heart, Users, Palette,
]

interface PersonalInfoWorksheetProps {
  items: WorksheetPrompt[]
  color: string
}

/** Renders día28's worksheet as a grid of cards — replaced an earlier
 * flower-shaped layout (hand-positioned overlapping ellipses) that kept
 * breaking in new ways each time content or sizing changed. A grid has no
 * equivalent failure mode: cells never overlap by construction. */
export function PersonalInfoWorksheet({ items, color }: PersonalInfoWorksheetProps) {
  const [hero, ...rest] = items
  const HeroIcon = ICONS[0]
  return (
    <div className="space-y-4">
      {hero && (
        <div
          className="rounded-3xl border-2 p-5 text-center shadow-sm"
          style={{ borderColor: color, backgroundColor: `${color}0d` }}
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            <HeroIcon className="h-6 w-6" />
          </div>
          <p className="mt-3 text-lg font-extrabold" style={{ color }}>
            {hero.label}
          </p>
          <div className="mx-auto mt-4 max-w-xs space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-px border-b border-dashed border-slate-300" />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rest.map((item, i) => {
          const Icon = ICONS[i + 1]
          return (
            <div key={item.label} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}1a` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <p className="mt-2.5 text-sm font-bold text-slate-700">{item.label}</p>
              <div className="mt-3 space-y-2">
                <div className="h-px border-b border-dashed border-slate-300" />
                <div className="h-px border-b border-dashed border-slate-300" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
