import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { getAllPosts, formatPostDate } from '@/lib/blog'

export function BlogListPage() {
  const posts = getAllPosts()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Blog — TIAM Digital'
  }, [])

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-tiam-blue/5 to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-wider text-tiam-blue mb-3">Blog</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Recursos sobre estimulación cognitiva
            </h1>
            <p className="mt-4 max-w-2xl text-slate-600 leading-relaxed">
              Artículos para profesionales y familias sobre las áreas cognitivas, el deterioro,
              y cómo trabajar mejor con personas adultas mayores.
            </p>
          </div>
        </section>

        {/* Posts */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          {posts.length === 0 ? (
            <p className="text-slate-400">Todavía no hay artículos publicados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {post.cover && (
                    <img
                      src={post.cover}
                      alt=""
                      className="aspect-[1200/630] w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                    <span className="inline-flex items-center rounded-full bg-tiam-blue/10 px-2.5 py-0.5 font-medium text-tiam-blue">
                      {post.category}
                    </span>
                    <span>{formatPostDate(post.date)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {post.readingMinutes} min
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                    <Link
                      to={`/blog/${post.slug}`}
                      className="after:absolute after:inset-0 group-hover:text-tiam-blue transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>

                  <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>

                  <p className="mt-auto pt-4 text-sm font-medium text-tiam-blue">Leer artículo →</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
