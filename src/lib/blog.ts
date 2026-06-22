/**
 * Markdown-backed blog. Posts live as `.md` files in `src/content/blog/` with a
 * small YAML-ish frontmatter block. They are bundled at build time via Vite's
 * glob import — no backend, no runtime fetch. Publishing a post = adding a file.
 *
 * Frontmatter format (between two `---` fences at the top of the file):
 *   title: string        (required)
 *   date: YYYY-MM-DD      (required — used for sorting and display)
 *   excerpt: string      (shown on the list page)
 *   author: string
 *   category: string
 *   readingMinutes: number
 */

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  author: string
  category: string
  readingMinutes: number
  body: string
}

// Eagerly bundle every markdown file as a raw string.
const rawPosts = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Minimal frontmatter parser — splits the leading `---` fenced block. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n')
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized)
  if (!match) {
    return { meta: {}, body: normalized }
  }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    // Strip optional surrounding quotes.
    value = value.replace(/^["'](.*)["']$/, '$1')
    if (key) meta[key] = value
  }
  return { meta, body: match[2].trim() }
}

function slugFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/, '')
}

function buildPost(path: string, raw: string): BlogPost {
  const { meta, body } = parseFrontmatter(raw)
  return {
    slug: slugFromPath(path),
    title: meta.title ?? 'Sin título',
    date: meta.date ?? '',
    excerpt: meta.excerpt ?? '',
    author: meta.author ?? 'Equipo TIAM',
    category: meta.category ?? 'General',
    readingMinutes: Number(meta.readingMinutes) || estimateReadingMinutes(body),
    body,
  }
}

function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

const POSTS: BlogPost[] = Object.entries(rawPosts)
  .map(([path, raw]) => buildPost(path, raw))
  .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first

/** All posts, newest first. */
export function getAllPosts(): BlogPost[] {
  return POSTS
}

/** A single post by slug, or undefined if not found. */
export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug)
}

/** Human-readable date in es-AR (e.g. "15 de junio de 2026"). */
export function formatPostDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}
