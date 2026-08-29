import { redeemRecoveryToken } from '@/lib/abandonedCarts'
import RecoverCartClient from './RecoverCartClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// The landing page for the link in a recovery email. It has to work for someone
// arriving on a different device, or after clearing their browser — so it does
// not just send them to /cart and hope localStorage still holds something. It
// reads the saved cart server-side and hands it to the client to restore.
export default async function RecoverCartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await redeemRecoveryToken(token)

  if (!result || result.lines.length === 0) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-text">This cart has moved on</h1>
        <p className="font-body text-sm text-mid mt-3 max-w-sm">
          The link has already been used, or the items are no longer available.
        </p>
        <Link
          href="/shop"
          className="mt-8 bg-forest text-paper px-6 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-full"
        >
          Browse the shop
        </Link>
      </main>
    )
  }

  return <RecoverCartClient lines={result.lines} />
}
