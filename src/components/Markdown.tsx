import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders markdown with Tailwind-styled elements. Avoids the typography plugin
 * by mapping each element explicitly, keeping styling under our control.
 */

const components: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-900 scroll-mt-24">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-3 text-xl font-semibold text-slate-900">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-5 leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-5 ml-5 list-disc space-y-2 text-slate-700 marker:text-tiam-blue/60">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-5 ml-5 list-decimal space-y-2 text-slate-700 marker:text-tiam-blue/60">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-tiam-blue hover:underline">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-4 border-tiam-blue/40 bg-slate-50 px-5 py-3 text-slate-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">{children}</code>
  ),
  hr: () => <hr className="my-8 border-slate-100" />,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 px-3 py-2 text-slate-700">{children}</td>
  ),
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
