/**
 * Global toast / notification system
 *
 * API — two ways to call, pick one and stay consistent:
 *
 *   const { toast } = useToast()
 *
 *   // Convenience helpers (recommended):
 *   toast.success('Sesión guardada')
 *   toast.error('No se pudo guardar la sesión')
 *   toast.info('Próximamente: PDF')
 *
 *   // Generic (type + message):
 *   toast({ type: 'success', message: 'Hecho', duration: 4000 })
 *
 * Defaults: success/info auto-dismiss after 3500 ms, error after 5000 ms.
 * Max 4 toasts visible at once (oldest are removed on overflow).
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, Check, Info, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  duration: number
}

interface ToastOptions {
  type: ToastType
  message: string
  duration?: number
}

// A callable object: toast({ … }) AND toast.success(…) etc.
interface ToastFn {
  (options: ToastOptions): void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

interface ToastContextValue {
  toast: ToastFn
}

// ─── Stable ID counter (module-level — never inside render) ──────────────────

let nextId = 0

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  error: 5000,
}

const MAX_TOASTS = 4

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Individual toast card ────────────────────────────────────────────────────

interface ToastCardProps {
  item: ToastItem
  onClose: (id: number) => void
}

const ICON: Record<ToastType, typeof Check> = {
  success: Check,
  error: AlertCircle,
  info: Info,
}

const ICON_CLASS: Record<ToastType, string> = {
  success: 'text-tiam-green shrink-0',
  error: 'text-red-500 shrink-0',
  info: 'text-tiam-blue shrink-0',
}

const BORDER_CLASS: Record<ToastType, string> = {
  success: 'border-tiam-green/30',
  error: 'border-red-200',
  info: 'border-tiam-blue/30',
}

function ToastCard({ item, onClose }: ToastCardProps) {
  const Icon = ICON[item.type]

  return (
    <div
      role="status"
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'flex items-start gap-3 rounded-xl border bg-white shadow-lg px-4 py-3',
        'w-full sm:min-w-[280px] sm:max-w-[400px]',
        'animate-in slide-in-from-top-2 fade-in duration-200',
        BORDER_CLASS[item.type],
      ].join(' ')}
    >
      <Icon className={`mt-0.5 h-4 w-4 ${ICON_CLASS[item.type]}`} />

      <p className="flex-1 text-sm text-slate-700 leading-snug">{item.message}</p>

      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => onClose(item.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-tiam-blue/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Keep timers in a ref so we never need them in state or effect deps
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    // functional setState — stable callback regardless of how many re-renders happen
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback(
    ({ type, message, duration }: ToastOptions) => {
      const id = ++nextId
      const ms = duration ?? DEFAULT_DURATION[type]

      setToasts(prev => {
        const next = [...prev, { id, type, message, duration: ms }]
        // cap at MAX_TOASTS — drop oldest
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })

      const timer = setTimeout(() => dismiss(id), ms)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  // Build the callable-object toast API once (stable across renders)
  const toast = useRef<ToastFn | null>(null)
  if (!toast.current) {
    const fn = (options: ToastOptions) => addToast(options)
    fn.success = (message: string, duration?: number) => addToast({ type: 'success', message, duration })
    fn.error   = (message: string, duration?: number) => addToast({ type: 'error',   message, duration })
    fn.info    = (message: string, duration?: number) => addToast({ type: 'info',    message, duration })
    toast.current = fn as ToastFn
  }

  return (
    <ToastContext.Provider value={{ toast: toast.current }}>
      {children}

      {/* Fixed container — top-right on sm+, top-center on mobile */}
      <div
        aria-label="Notificaciones"
        className="pointer-events-none fixed z-[100] flex flex-col gap-2 left-4 right-4 top-4 sm:left-auto sm:right-4 sm:top-4 sm:w-auto"
      >
        {toasts.map(item => (
          // pointer-events-auto so the close button is clickable inside the pointer-events-none container
          <div key={item.id} className="pointer-events-auto w-full sm:w-auto">
            <ToastCard item={item} onClose={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
