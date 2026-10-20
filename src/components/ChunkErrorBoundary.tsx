import { Component, type ReactNode } from 'react'
import { isChunkLoadError, reloadOnce } from '@/lib/chunkReload'

/**
 * Around the lazy routes. After a deploy the old chunk files are gone: a tab that was open asks for one and fails. On that kind of error the page reloads ONCE
 * (lib/chunkReload.ts decides, with its tests) and loads the new version. Any other error, or a second failure, shows a calm message with a button to reload.
 */
interface State {
  error: Error | null
}

export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) reloadOnce(window.sessionStorage, () => window.location.reload())
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-bold text-slate-900">No pudimos cargar esta página</p>
        <p className="text-slate-600">Puede que haya una versión nueva del sitio. Recargá la página para verla.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Recargar la página
        </button>
      </div>
    )
  }
}
