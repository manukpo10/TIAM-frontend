import { useState } from 'react'
import { Download, FileArchive, FileText, Gamepad2, Loader2, MessageCircle, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { desafioActivationLink } from '@/lib/whatsapp'
import { Card } from './PackShell'
import { linkButton } from './linkButton'
import { requestFileLink, safeNavigationUrl } from './packClient'
import type { Paper, PackFile, PackOrder } from './packTypes'
import { PackApiError } from './packTypes'
import { ContactLink } from './ContactLink'
import { InAppBrowserNotice } from './InAppBrowserNotice'

/**
 * The deliverables of a paid order, shared by the thank-you page (instant access) and the downloads
 * page (the link in the email). Files are listed by paper size; the buyer picks A4 or Carta once.
 *
 * A download is a POST that returns a short-lived signed URL, then the browser navigates to it. It is
 * a POST rather than a plain link so a mail scanner that opens the page's links cannot use up the
 * download quota, and only a real tap counts.
 */

const PAPER_KEY = 'tiam.pack.paper'

const PAPER_LABEL: Record<Paper, string> = { A4: 'A4', CARTA: 'Carta' }

function readPaper(): Paper {
  try {
    return localStorage.getItem(PAPER_KEY) === 'CARTA' ? 'CARTA' : 'A4'
  } catch {
    return 'A4'
  }
}

function rememberPaper(paper: Paper): void {
  try {
    localStorage.setItem(PAPER_KEY, paper)
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

/** The API may say "A4", "CARTA" or "Letter" in any case; the page only knows two papers. */
function normalizePaper(value: string): Paper {
  return value.trim().toUpperCase().startsWith('A') ? 'A4' : 'CARTA'
}

/** A file as the panel works with it: the API's paper spelling ("Carta") already turned into a {@link Paper}. */
type PanelFile = Omit<PackFile, 'paper'> & { paper: Paper }

const isZip = (file: Pick<PackFile, 'key' | 'label'>) => /\.zip$|\bzip\b/i.test(`${file.key} ${file.label}`)

const longDate = (iso?: string | null): string | null => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

type RowState = 'idle' | 'busy' | 'started' | 'error' | 'limit'

function FileRow({ file, token }: { file: PanelFile; token: string }) {
  const [state, setState] = useState<RowState>('idle')
  const zip = isZip(file)
  const Icon = zip ? FileArchive : FileText

  async function download() {
    if (state === 'busy') return
    setState('busy')
    try {
      const link = await requestFileLink(token, file.key)
      const url = safeNavigationUrl(link?.url)
      if (!url) throw new PackApiError('client')
      setState('started')
      window.location.assign(url)
      window.setTimeout(() => setState('idle'), 8000)
    } catch (error) {
      setState(error instanceof PackApiError && error.kind === 'rate-limited' ? 'limit' : 'error')
    }
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10 text-tiam-blue">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-slate-900">{file.label}</p>
            <p className="text-sm text-slate-600">
              {zip ? 'ZIP' : 'PDF'}
              {file.sizeMb ? ` · ${Math.round(file.sizeMb)} MB` : ''}
              {zip && ' · los cuadernillos por separado, para imprimir de a uno'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={download}
          aria-busy={state === 'busy'}
          className={cn(
            'inline-flex min-h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto sm:min-w-44',
            state === 'busy' ? 'cursor-progress bg-primary-hover' : 'bg-primary hover:bg-primary-hover active:bg-primary-active',
          )}
        >
          {state === 'busy' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
          {state === 'busy' ? 'Preparando…' : state === 'started' ? 'Descargando…' : 'Descargar'}
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-600 empty:hidden" role="status">
        {state === 'started' && 'Si la descarga no empieza en unos segundos, tocá el botón de nuevo.'}
      </p>
      {(state === 'error' || state === 'limit') && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {state === 'limit'
            ? 'Llegaste al límite de descargas por hoy. Probá mañana o escribinos y lo resolvemos.'
            : 'No pudimos preparar la descarga. Probá de nuevo en un momento.'}
        </p>
      )}
    </li>
  )
}

function GamesBlock({ link }: { link?: string | null }) {
  const href = safeNavigationUrl(link)
  return (
    <Card className="border-t-4 border-t-tiam-green">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tiam-green/10 text-tiam-green">
          <Gamepad2 className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-tiam-green">Incluido en tu compra</p>
          <h2 className="mt-0.5 text-xl font-bold text-slate-900">Tu mes de juegos interactivos</h2>
        </div>
      </div>
      <p className="mt-3 leading-relaxed text-slate-600">
        El Desafío de 30 días se activa por WhatsApp: tocá el botón, mandá el mensaje desde el número que dejaste al comprar y te llega el primer
        ejercicio al instante.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a href={desafioActivationLink} target="_blank" rel="noopener noreferrer" className={linkButton('whatsapp', 'w-full sm:w-auto')}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          Activar por WhatsApp
        </a>
        {href && (
          <a href={href} className={linkButton('secondary', 'w-full sm:w-auto')}>
            Abrir mi mes de juegos
          </a>
        )}
      </div>
      {href && <p className="mt-3 text-sm text-slate-600">Si ya lo activaste, entrá directo con el segundo botón.</p>}
    </Card>
  )
}

interface DownloadsPanelProps {
  order: PackOrder
  token: string
}

export function DownloadsPanel({ order, token }: DownloadsPanelProps) {
  const items = (order.items ?? []).map((item) => ({
    ...item,
    files: item.files.map((file): PanelFile => ({ ...file, paper: normalizePaper(String(file.paper)) })),
  }))
  const available = (['A4', 'CARTA'] as const).filter((paper) => items.some((item) => item.files.some((file) => file.paper === paper)))
  const [chosen, setChosen] = useState<Paper>(readPaper)
  const paper: Paper = available.includes(chosen) ? chosen : (available[0] ?? 'A4')
  const expires = longDate(order.expiresAt)

  function choose(next: Paper) {
    setChosen(next)
    rememberPaper(next)
  }

  return (
    <div className="space-y-6">
      <InAppBrowserNotice token={token} />

      {available.length > 1 && (
        <Card>
          <fieldset>
            <legend className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Printer className="h-5 w-5 text-tiam-blue" aria-hidden />
              ¿En qué papel vas a imprimir?
            </legend>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {available.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex min-h-[56px] cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-3 text-lg font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tiam-blue',
                    paper === value ? 'border-tiam-blue bg-tiam-blue/10 text-tiam-blue-dark' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  <input type="radio" name="paper" value={value} checked={paper === value} onChange={() => choose(value)} className="sr-only" />
                  {PAPER_LABEL[value]}
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">Si no sabés cuál elegir, usá A4: es el tamaño de casi todas las impresoras de Argentina.</p>
          </fieldset>
        </Card>
      )}

      {items.map((item) => {
        const files = item.files.filter((file) => file.paper === paper)
        if (!files.length) return null
        return (
          <Card key={`${item.code}-${item.title}`}>
            <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {files.map((file) => (
                <FileRow key={file.key} file={file} token={token} />
              ))}
            </ul>
          </Card>
        )
      })}

      {order.games && <GamesBlock link={order.games.link} />}

      <p className="text-center text-sm leading-relaxed text-slate-600">
        {expires ? `Podés descargar tus archivos hasta el ${expires}. ` : ''}
        ¿Algo no funciona?{' '}
        <ContactLink />
        .
      </p>
    </div>
  )
}
