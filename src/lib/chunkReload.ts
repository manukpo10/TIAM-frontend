/**
 * After a deploy, a tab that was already open keeps asking for lazy chunks (the routes loaded with `lazy(() => import(...))`) whose files no longer exist.
 * The error boundary around the lazy routes (components/ChunkErrorBoundary.tsx) uses these two pure functions: recognize that kind of error and, if it is one,
 * reload the page ONCE (never in a loop). Tests: tests/chunk-reload.test.ts.
 */

const KEY = 'tiam.chunk-reload'

/** What browsers and bundlers say when a lazy chunk (or its CSS) cannot be fetched: Chromium, Firefox, Safari and the webpack-style name. */
const CHUNK_MESSAGE =
  /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk \S+ failed|Unable to preload CSS/i

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'ChunkLoadError' || CHUNK_MESSAGE.test(error.message)
}

type Remember = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/**
 * Calls `reload` unless it already did a moment ago (`minGapMs`), and says whether it did. If the storage cannot remember (blocked, private mode) it does NOT
 * reload: without a memory it could reload forever.
 */
export function reloadOnce(storage: Remember, reload: () => void, now: number = Date.now(), minGapMs = 60_000): boolean {
  try {
    const last = Number(storage.getItem(KEY))
    if (Number.isFinite(last) && last > 0 && now - last < minGapMs) return false
    storage.setItem(KEY, String(now))
  } catch {
    return false
  }
  reload()
  return true
}
