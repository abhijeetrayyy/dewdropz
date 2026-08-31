/**
 * What stands in for the catalogue while it is on its way.
 *
 * The shop had no loading state of any kind — no `loading.tsx`, and a Suspense
 * fallback that was a bare `<main className="… min-h-screen" />`, i.e. an empty
 * cream rectangle the height of the viewport. Trek Buddy, which is the free
 * social board, has eleven loading states and an error boundary. The page that
 * sells the goods had neither.
 *
 * Two rules it obeys:
 *
 *   1 · It is the SHAPE of the thing it replaces, at the real dimensions — the
 *       rail's width, the card's 3:4 photograph, the caption's height — so the
 *       page does not jump when the real content lands.
 *   2 · It does not move. `animate-pulse` is an infinite opacity loop, which is
 *       ambient motion (Law 06), and a skeleton is on screen at exactly the
 *       moment a slow connection makes an animation stutter. A still block reads
 *       as "loading" perfectly well.
 */
export default function ShopGridSkeleton() {
  return (
    <div className="mx-auto max-w-measure-catalogue px-6 pb-24 pt-12 md:px-10" aria-hidden="true">
      <div className="xl:grid xl:grid-cols-[280px_1fr] xl:gap-8">
        <div className="hidden xl:block">
          <div className="h-[520px] rounded-[var(--r-panel)] bg-surface shadow-[var(--shadow-panel)]" />
        </div>
        <div className="min-w-0">
          <div className="mb-6 h-11 border-b border-rule-warm" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-x-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[3/4] rounded-[var(--r-card)] bg-paper-deep" />
                <div className="mt-3 h-[19px] w-3/4 rounded-[var(--r-bar)] bg-paper-deep" />
                <div className="mt-2 h-[13px] w-full rounded-[var(--r-bar)] bg-paper-deep/60" />
                <div className="mt-3 h-[17px] w-1/3 rounded-[var(--r-bar)] bg-paper-deep" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
