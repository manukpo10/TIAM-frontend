import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Markdown } from '@/components/Markdown'
import { getPost, formatPostDate } from '@/lib/blog'

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = post ? `${post.title} — TIAM Digital` : 'Artículo no encontrado — TIAM Digital'
  }, [post])

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {!post ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Artículo no encontrado</h1>
            <p className="mt-3 text-slate-600">
              El artículo que buscás no existe o fue movido.
            </p>
            <Link to="/blog" className="mt-6 inline-block font-medium text-tiam-blue hover:underline">
              ← Volver al blog
            </Link>
          </div>
        ) : (
          <article className="max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            {/* Back link */}
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-tiam-blue transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver al blog
            </Link>

            {/* Header */}
            <header className="mt-6 mb-8">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4">
                <span className="inline-flex items-center rounded-full bg-tiam-blue/10 px-2.5 py-0.5 font-medium text-tiam-blue">
                  {post.category}
                </span>
                <span>{formatPostDate(post.date)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {post.readingMinutes} min de lectura
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                {post.title}
              </h1>
              <p className="mt-3 text-sm text-slate-500">Por {post.author}</p>
            </header>

            <hr className="mb-8 border-slate-100" />

            {/* Body */}
            <div className="text-[15px] sm:text-base">
              <Markdown>{post.body}</Markdown>
            </div>

            {/* CTA */}
            <div className="mt-12 rounded-2xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
              <p className="font-semibold text-slate-900">¿Querés aplicar esto con tus pacientes?</p>
              <p className="mt-1 text-sm text-slate-600">
                Accedé a la biblioteca completa de ejercicios, organizada por área y nivel.
              </p>
              <Link
                to="/register"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-tiam-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-tiam-blue-dark"
              >
                Probá TIAM gratis 7 días
              </Link>
            </div>
          </article>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}
