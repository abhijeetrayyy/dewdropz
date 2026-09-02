import Link from 'next/link'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { RentalItemListed } from '@/lib/rental-filter'

/**
 * One piece of gear in the locker grid.
 *
 * THE THING THIS CARD DOES THAT THE OLD ONE DID NOT: it answers "can I have
 * it?". The locker used to be a grid of rates you had to open an item — and
 * then fill in two date fields — to find out was already booked. Once a visitor
 * has said when they are going, the shelf belongs on the card, because that is
 * the question they are actually scanning for.
 *
 * A card with nothing free is still rendered, greyed and sunk to the end rather
 * than removed. Disappearing gear reads as a broken page; "none free for those
 * dates" reads as an answer, and it is also the sentence that makes somebody
 * try a different weekend instead of leaving.
 *
 * A server component: it holds no state, and the whole grid re-renders from the
 * URL anyway.
 */
export default function RentalCard({
  item,
  shelf,
  free,
  total,
  datesChosen,
}: {
  item: RentalItemListed
  /** The dates the visitor is planning, forwarded so the item page opens with
   *  them already filled in. Choosing dates once per visit rather than once per
   *  item is most of the value of putting them at the top of the locker. */
  shelf: string
  free?: number
  total?: number
  datesChosen: boolean
}) {
  const none = datesChosen && free === 0
  const short = datesChosen && free !== undefined && free > 0 && free <= 2

  return (
    <Link href={`/rent/${item.slug}${shelf}`} className="group block">
      <div
        className={`relative aspect-[4/5] overflow-hidden rounded-[var(--r-card)] bg-paper-deep ${
          none ? 'opacity-70 grayscale-[0.35] transition-[opacity,filter] group-hover:opacity-100 group-hover:grayscale-0' : ''
        }`}
      >
        {item.images?.[0] ? (
          <Image
            src={item.images[0]}
            alt={item.name}
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // A gap in the photography, said plainly. Left as bare text it read as
          // a broken image and punched a white hole through the grid.
          <div className="flex h-full flex-col items-center justify-center gap-2 border border-dashed border-rule bg-paper-deep/50">
            <Camera className="h-5 w-5 text-mid/60" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
              Photograph to come
            </span>
          </div>
        )}

        {/* The shelf answer, top-left, where a scan starts — and only once
            somebody has said when they are going. Before that it would be a
            number with no question attached to it. */}
        {datesChosen && free !== undefined && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] backdrop-blur-sm ${
              none
                ? 'bg-ink/75 text-paper'
                : short
                  ? 'bg-clay-deep text-paper'
                  : 'bg-forest text-paper'
            }`}
          >
            {total === 0 ? 'None in the locker' : none ? 'None free' : short ? `Only ${free} free` : `${free} free`}
          </span>
        )}

        {/* The rate belongs ON the photograph: in a rental list the per-day
            figure is the thing being compared, and set below the fold of the
            card it lost every scan. */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink/75 to-transparent p-3 pt-10">
          <span className="font-mono text-[15px] tabular-nums text-paper">
            {formatPrice(item.daily_rate)}
            <span className="text-[11px] text-paper/70"> / day</span>
          </span>
          <span className="rounded-full bg-paper/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper backdrop-blur-sm">
            {item.allows_pickup && item.allows_shipping
              ? 'Collect / post'
              : item.allows_pickup
                ? 'Collect'
                : 'Posted'}
          </span>
        </div>
      </div>

      <h3 className="mt-3 font-display text-lg text-ink transition-colors group-hover:text-forest">
        {item.name}
      </h3>
      {item.summary && (
        <p className="mt-1 font-body text-[13px] leading-snug text-mid">{item.summary}</p>
      )}

      {/* The three facts that separate one piece of gear from another, in the
          order somebody outfitting a trip asks them. Each is omitted rather
          than shown as an em-dash: an unweighed item should not advertise that
          the shop has not weighed it. */}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-mid">
        <span>{formatPrice(item.deposit)} deposit, refunded</span>
        {item.capacity != null && (
          <>
            <span aria-hidden="true" className="text-light">·</span>
            <span>{item.capacity === 1 ? 'Solo' : `Sleeps ${item.capacity}`}</span>
          </>
        )}
        {item.weight_grams != null && (
          <>
            <span aria-hidden="true" className="text-light">·</span>
            <span>{(item.weight_grams / 1000).toFixed(1)} kg</span>
          </>
        )}
      </p>
    </Link>
  )
}
