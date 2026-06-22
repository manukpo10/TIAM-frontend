import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Check, Gift, Brain, Target, Hand, type LucideIcon } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import type { ApiError } from '@/types'
import recursosHero from '@/assets/recursos-hero.jpg'

interface Ficha {
  file: string
  area: string
  title: string
  icon: LucideIcon
}

const FICHAS: Ficha[] = [
  { file: '/recursos/ficha-memoria.pdf', area: 'Memoria', title: 'Categorías: escribí 4 ejemplos', icon: Brain },
  { file: '/recursos/ficha-atencion.pdf', area: 'Atención', title: 'Encontrá las estrellas', icon: Target },
  { file: '/recursos/ficha-praxias.pdf', area: 'Praxias', title: 'Copiá la figura en la cuadrícula', icon: Hand },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RecursosPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Fichas gratis de estimulación cognitiva — TIAM Digital'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!EMAIL_RE.test(email)) {
      setError('Ingresá un email válido.')
      return
    }
    if (!consent) {
      setError('Necesitamos tu consentimiento para enviarte las fichas.')
      return
    }
    setStatus('submitting')
    try {
      await api.post('/leads', { email: email.trim(), name: name.trim() || null, source: 'recursos', consent })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError((err as ApiError)?.message ?? 'No pudimos procesar tu pedido. Probá de nuevo.')
    }
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-tiam-blue/5 to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_480px]">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tiam-blue/10 mb-5">
                  <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                  3 fichas gratis para tus sesiones
                </h1>
                <p className="mt-4 max-w-2xl text-lg text-slate-600 leading-relaxed">
                  Una muestra del material de TIAM: tres fichas imprimibles en A4, listas para trabajar
                  memoria, atención y praxias. Dejanos tu email y las descargás al instante.
                </p>
              </div>
              <img
                src={recursosHero}
                alt="Vista previa de las 3 fichas gratuitas de TIAM: memoria, atención y praxias, listas para imprimir en A4"
                className="w-full rounded-2xl"
                width={1024}
                height={572}
                fetchPriority="high"
              />
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
            {/* Ficha previews */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Qué incluye
              </h2>
              <ul className="space-y-3">
                {FICHAS.map(({ file, area, title, icon: Icon }) => (
                  <li
                    key={file}
                    className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tiam-blue/10">
                      <Icon className="h-5 w-5 text-tiam-blue" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <span className="inline-flex items-center rounded-full bg-tiam-green/10 px-2 py-0.5 text-xs font-medium text-tiam-green">
                        {area}
                      </span>
                      <p className="mt-1 font-semibold text-slate-900">{title}</p>
                    </div>
                    <FileText className="ml-auto h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Form / downloads card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              {status === 'success' ? (
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15 mb-4">
                    <Check className="h-6 w-6 text-tiam-green" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">¡Listo! Ya podés descargar</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Hacé clic en cada ficha para guardarla en tu dispositivo.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    {FICHAS.map((f) => (
                      <a
                        key={f.file}
                        href={f.file}
                        download
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-surface"
                      >
                        <Download className="h-4 w-4 text-primary" aria-hidden="true" />
                        Ficha de {f.area}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <h2 className="text-xl font-bold text-slate-900">Descargá las fichas</h2>
                  <p className="mt-1 text-sm text-slate-600">Te las damos a cambio de tu email.</p>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email <span className="text-tiam-orange">*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vos@ejemplo.com"
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nombre <span className="text-slate-400">(opcional)</span>
                      </label>
                      <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      <span>
                        Acepto que TIAM use mi email para enviarme las fichas y novedades, según la{' '}
                        <Link to="/privacy" className="font-medium text-primary hover:underline">
                          política de privacidad
                        </Link>
                        .
                      </span>
                    </label>
                  </div>

                  {error && (
                    <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    loading={status === 'submitting'}
                    className="mt-5 w-full"
                  >
                    <Download className="h-4 w-4" />
                    Descargar las 3 fichas
                  </Button>

                  <p className="mt-3 text-xs text-slate-400 text-center">
                    Sin spam. Podés darte de baja cuando quieras.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
