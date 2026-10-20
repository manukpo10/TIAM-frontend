// After a deploy, a tab that was open keeps asking for lazy chunks that no longer exist. The lazy routes are wrapped in an error boundary that, on a chunk-load
// error, reloads the page ONCE (and never loops).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isChunkLoadError, reloadOnce } from '../src/lib/chunkReload.ts'

describe('isChunkLoadError', () => {
  it('recognizes the messages browsers give when a lazy chunk cannot be loaded', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://tiamdigital.com/assets/GraciasPage-abc123.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Loading chunk 12 failed. (error: https://example.com/assets/x.js)',
      'Loading CSS chunk 7 failed.',
      'Unable to preload CSS for /assets/index-1.css',
    ]) {
      assert.equal(isChunkLoadError(new Error(message)), true, message)
    }
  })
  it('recognizes the ChunkLoadError name', () => {
    const error = new Error('whatever')
    error.name = 'ChunkLoadError'
    assert.equal(isChunkLoadError(error), true)
  })
  it('ignores any other error', () => {
    assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false)
    assert.equal(isChunkLoadError(new TypeError('x is not a function')), false)
    assert.equal(isChunkLoadError('Failed to fetch dynamically imported module'), false)
    assert.equal(isChunkLoadError(null), false)
    assert.equal(isChunkLoadError(undefined), false)
  })
})

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data }
}

describe('reloadOnce', () => {
  it('reloads the first time and remembers it', () => {
    const storage = fakeStorage()
    let reloads = 0
    assert.equal(reloadOnce(storage, () => reloads++, 1_000_000), true)
    assert.equal(reloads, 1)
    assert.equal(storage.data.size, 1)
  })
  it('does not reload again right after: a page that keeps failing must not loop', () => {
    const storage = fakeStorage()
    let reloads = 0
    reloadOnce(storage, () => reloads++, 1_000_000)
    assert.equal(reloadOnce(storage, () => reloads++, 1_000_000 + 5_000), false)
    assert.equal(reloads, 1)
  })
  it('can reload again much later (another deploy in the same tab)', () => {
    const storage = fakeStorage()
    let reloads = 0
    reloadOnce(storage, () => reloads++, 1_000_000)
    assert.equal(reloadOnce(storage, () => reloads++, 1_000_000 + 10 * 60_000), true)
    assert.equal(reloads, 2)
  })
  it('does not reload when the storage cannot remember (it would loop forever)', () => {
    let reloads = 0
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    assert.equal(reloadOnce(broken, () => reloads++, 1_000_000), false)
    assert.equal(reloads, 0)
  })
  it('ignores a garbage value in the storage', () => {
    const storage = fakeStorage({ 'tiam.chunk-reload': 'not a number' })
    let reloads = 0
    assert.equal(reloadOnce(storage, () => reloads++, 1_000_000), true)
    assert.equal(reloads, 1)
  })
})
