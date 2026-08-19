import { BoardSkeleton, RailSkeleton } from '@/components/trek/ui/Skeletons'

// First paint on hill data.
//
// There was no loading boundary anywhere in this feature, so every navigation
// showed a white page for as long as the slowest query took — and the feature
// is about to become image- and meter-heavy, which makes that worse, not
// better. The ghosts are in the geometry of the real board, so nothing moves
// when the data lands.
export default function TrekBuddyLoading() {
  return (
    <>
      <section className="trek-band bg-ink pb-8 pt-28 md:pt-32">
        <div className="trek-measure">
          <span className="block h-3 w-40 animate-pulse rounded-full bg-paper/15" />
          <span className="mt-5 block h-14 w-80 max-w-full animate-pulse rounded-[var(--r-input)] bg-paper/10" />
          <span className="mt-8 block h-12 w-full animate-pulse rounded-full bg-paper/[0.07]" />
        </div>
      </section>
      <section className="trek-band bg-ink pb-10">
        <div className="trek-measure">
          <RailSkeleton />
        </div>
      </section>
      <section className="trek-band bg-paper py-12">
        <div className="trek-measure">
          <BoardSkeleton />
        </div>
      </section>
    </>
  )
}
