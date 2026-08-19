import { BoardSkeleton, RailSkeleton, RowSkeleton } from './Skeletons'

// What each screen looks like while its data is still coming.
//
// Only /trek-buddy had a loading boundary. Every other route — Discover,
// People, Basecamp, Messages, a walk, the console — rendered nothing at all
// until the server finished, so a navigation on a slow connection looked like
// a dead tap. The target device for this product is a phone on hill data, and
// "did that work?" is the question a missing loading state creates.
//
// Each ghost matches the silhouette of the screen it stands in for, so nothing
// jumps when the real thing lands: same band, same measure, same column split.

function Line({ w = '100%', h = 12, dark = false, className = '' }: {
  w?: string | number; h?: number; dark?: boolean; className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full ${dark ? 'bg-paper/12' : 'bg-rule/60'} ${className}`}
      style={{ width: w, height: h }}
    />
  )
}

/** The ink band every screen opens on. */
function InkHead({ tall = false }: { tall?: boolean }) {
  return (
    <section className={`trek-band bg-ink ${tall ? 'pb-10 pt-28 md:pt-32' : 'pb-8 pt-28 md:pt-32'}`}>
      <div className="trek-measure">
        <Line w={150} h={11} dark />
        <Line w="min(460px, 80%)" h={44} dark className="mt-5 rounded-[var(--r-input)]" />
        <Line w="min(560px, 90%)" h={14} dark className="mt-5" />
        {tall && (
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Line key={i} h={78} dark className="rounded-[var(--r-card)]" />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function BoardLoading() {
  return (
    <>
      <section className="trek-band bg-ink pb-8 pt-28 md:pt-32">
        <div className="trek-measure">
          <Line w={190} h={11} dark />
          <Line w="min(420px, 70%)" h={44} dark className="mt-5 rounded-[var(--r-input)]" />
          <Line h={50} dark className="mt-7 rounded-[var(--r-input)]" />
          <div className="mt-6 flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Line key={i} h={54} dark className="flex-1 rounded-[var(--r-input)]" />
            ))}
          </div>
        </div>
      </section>
      <section className="trek-band bg-ink pb-10">
        <div className="trek-measure"><RailSkeleton /></div>
      </section>
      <section className="trek-band bg-paper py-12">
        <div className="trek-measure"><BoardSkeleton count={6} /></div>
      </section>
    </>
  )
}

export function TodayLoading() {
  return (
    <>
      <InkHead />
      <section className="trek-band bg-paper py-10">
        <div className="trek-measure grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
          <Line h={260} className="rounded-[var(--r-card)]" />
        </div>
      </section>
      <section className="trek-band bg-paper pb-16">
        <div className="trek-measure"><BoardSkeleton count={3} /></div>
      </section>
    </>
  )
}

export function ListLoading({ count = 6 }: { count?: number }) {
  return (
    <>
      <InkHead />
      <section className="trek-band bg-paper py-12">
        <div className="trek-measure"><BoardSkeleton count={count} /></div>
      </section>
    </>
  )
}

export function DashboardLoading() {
  return (
    <>
      <InkHead tall />
      <section className="trek-band bg-paper py-10">
        <div className="trek-measure grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
          <div className="space-y-3">
            <Line h={220} className="rounded-[var(--r-panel)]" />
            <Line h={160} className="rounded-[var(--r-panel)]" />
          </div>
        </div>
      </section>
    </>
  )
}

/** A walk, and the host console — a photographic masthead over two columns. */
export function DetailLoading() {
  return (
    <>
      <div className="relative min-h-[380px] animate-pulse bg-ink" />
      <section className="trek-band bg-paper py-10">
        <div className="trek-measure grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Line key={i} h={150} className="rounded-[var(--r-card)]" />
            ))}
          </div>
          <Line h={320} className="rounded-[var(--r-panel)]" />
        </div>
      </section>
    </>
  )
}

/** The messages shell: one card, two panes. */
export function ShellLoading() {
  return (
    <section className="trek-band bg-paper pb-12 pt-24 md:pt-28">
      <div className="trek-measure">
        <div className="grid min-h-[640px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[var(--r-shell)] border border-rule bg-surface lg:h-[calc(100vh-172px)] lg:grid-cols-[minmax(300px,26%)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3 border-r border-rule bg-paper p-5">
            {Array.from({ length: 5 }).map((_, i) => <Line key={i} h={62} className="rounded-[var(--r-card)]" />)}
          </div>
          <div className="hidden min-w-0 p-6 lg:block">
            <Line w="40%" h={20} />
            <div className="mt-8 space-y-4">
              {[70, 55, 80, 45].map((w, i) => (
                <Line key={i} w={`${w}%`} h={44} className={`rounded-[14px] ${i % 2 ? 'ml-auto' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** A form: a header band, then fields beside a sticky preview. */
export function FormLoading() {
  return (
    <>
      <InkHead />
      <section className="trek-band bg-paper py-10">
        <div className="trek-measure grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Line w={110} h={11} />
                <Line h={46} className="mt-2.5 rounded-[var(--r-input)]" />
              </div>
            ))}
          </div>
          <Line h={380} className="rounded-[var(--r-card)]" />
        </div>
      </section>
    </>
  )
}
