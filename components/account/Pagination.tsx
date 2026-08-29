import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Pagination was two bare text arrows with no sense of scale — "Next →" tells
// you there is more, not how much more, and there was no way to jump. Numbered,
// windowed around the current page, and the ends are always reachable.
export default function Pagination({
  page,
  pageCount,
  hrefFor,
  className,
}: {
  page: number // zero-based
  pageCount: number
  hrefFor: (page: number) => string
  className?: string
}) {
  if (pageCount <= 1) return null

  // A window of five around the current page, with the first and last always
  // pinned, so the control stays a fixed width whether there are 3 pages or 300.
  const window = new Set<number>([0, pageCount - 1])
  for (let i = page - 1; i <= page + 1; i++) if (i >= 0 && i < pageCount) window.add(i)
  const pages = [...window].sort((a, b) => a - b)

  const arrow =
    'inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-input)] border border-rule bg-surface text-mid transition-colors hover:border-forest/40 hover:text-forest'

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      {page > 0 ? (
        <Link href={hrefFor(page - 1)} className={arrow} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={cn(arrow, 'cursor-not-allowed opacity-40')} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </span>
      )}

      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {/* A gap in the sequence is drawn, so 1 … 7 8 9 … 42 reads as a range
              rather than as a broken list. */}
          {i > 0 && p - pages[i - 1] > 1 && (
            <span className="px-0.5 font-mono text-[11px] text-light" aria-hidden="true">…</span>
          )}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--r-input)] border px-2 font-mono text-[11px] tabular-nums transition-colors',
              p === page
                ? 'border-forest bg-forest text-paper'
                : 'border-rule bg-surface text-mid hover:border-forest/40 hover:text-forest'
            )}
          >
            {p + 1}
          </Link>
        </span>
      ))}

      {page + 1 < pageCount ? (
        <Link href={hrefFor(page + 1)} className={arrow} aria-label="Next page">
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      ) : (
        <span className={cn(arrow, 'cursor-not-allowed opacity-40')} aria-hidden="true">
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      )}
    </nav>
  )
}
