// Ghosts, in the geometry of the real thing.
//
// The feature is about to become image- and meter-heavy, and its target device
// is a phone on hill data. A white screen followed by a full board is not a
// loading state, it is a jump scare — and worse, it makes a slow connection
// look like a broken product.
//
// Each ghost matches the real component's silhouette exactly, so nothing moves
// when the data lands.

function Bar({ w = '100%', h = 10, className = '' }: { w?: string | number; h?: number; className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded-full bg-rule/60 ${className}`}
      style={{ width: w, height: h }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="trek-card flex flex-col" aria-hidden="true">
      <div className="aspect-[16/10] w-full animate-pulse bg-rule/50" />
      <div className="flex flex-col gap-3 px-4.5 pb-4.5 pt-4">
        <Bar w="42%" h={8} />
        <Bar w="76%" h={16} />
        <Bar w="54%" h={8} />
        <div className="mt-1 flex gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} h={5} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function BoardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RowSkeleton() {
  return (
    <div className="trek-row flex items-center gap-4 px-5 py-4" aria-hidden="true">
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-rule/60" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bar w="45%" h={12} />
        <Bar w="65%" h={8} />
      </div>
      <Bar w={90} h={26} className="rounded-full" />
    </div>
  )
}

export function RailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="trek-rail" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[280px] overflow-hidden rounded-[var(--r-card)] bg-ink/90">
          <div className="h-[120px] animate-pulse bg-paper/10" />
          <div className="flex flex-col gap-2 p-4">
            <Bar w="40%" h={8} className="bg-paper/15" />
            <Bar w="80%" h={14} className="bg-paper/15" />
          </div>
        </div>
      ))}
    </div>
  )
}
