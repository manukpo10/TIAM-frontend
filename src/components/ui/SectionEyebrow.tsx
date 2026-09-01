interface SectionEyebrowProps {
  text: string
  accent?: 'blue' | 'orange'
}

export function SectionEyebrow({ text, accent = 'blue' }: SectionEyebrowProps) {
  // Orange text on white fails WCAG AA at small sizes; keep the orange chip
  // identity (bg + border) but use navy text for readability.
  const cls = accent === 'orange'
    ? 'border-tiam-orange/30 bg-tiam-orange/10 text-tiam-navy'
    : 'border-tiam-blue/20 bg-tiam-blue/5 text-tiam-blue'
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 mb-4 ${cls}`}>
      <span className="text-xs font-semibold uppercase tracking-wide">{text}</span>
    </div>
  )
}
