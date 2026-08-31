'use client'

import { useEffect } from 'react'
import NavBar from '@/components/layout/NavBar'
import EmptyState from '@/components/ui/empty-state'

// The shop had no error boundary, so a failed catalogue fetch fell through to
// the root and a shopper got the framework's own screen. This is the same
// surface the shop uses for "nothing matched", because a shop that cannot
// reach its shelves and a shop with an empty shelf are the same experience and
// should not look like two different products.
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is what ties this to the server log; without it a report of
    // "the shop broke" cannot be matched to anything.
    console.error('[shop]', error.digest ?? error.message)
  }, [error])

  return (
    <>
      <NavBar />
      <main id="main" className="min-h-screen bg-paper-warm px-6 pb-24 pt-40 md:px-10">
        <div className="mx-auto max-w-measure">
          <EmptyState
            title="The shelves would not load."
            body="Something went wrong reaching the catalogue. It is almost certainly us, not you."
            secondary={{ label: 'Try again', onClick: () => reset() }}
            action={{ label: 'Back to the homepage', href: '/' }}
          />
        </div>
      </main>
    </>
  )
}
