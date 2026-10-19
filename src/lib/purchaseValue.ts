/**
 * The `value` of a Meta Pixel Purchase event, taken from the order total (ARS). A positive finite number rounded to
 * cents, or null when the total is missing or unusable: then the event goes out without a value, which is better than
 * a made-up one (Meta optimizes campaigns for purchase value, so a wrong number would mislead it).
 */
export function purchaseValue(total: unknown): number | null {
  const value = typeof total === 'string' ? Number(total.trim().replace(',', '.')) : total
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}
