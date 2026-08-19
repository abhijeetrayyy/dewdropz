import type { ReactNode } from 'react'
import { trekFontVars } from '@/app/trek-fonts'
import TrekTopBar from '@/components/trek/TrekTopBar'
import TrekFooter from '@/components/trek/TrekFooter'
import { Toaster } from '@/components/ui/toaster'
import { getTrekMembership, getUnreadCount } from '@/actions/trekBuddy'
import { getUnreadMessages } from '@/actions/trekChat'

// One shell for the whole product.
//
// Before this, every Trek Buddy page imported the storefront's `NavBar` and
// `FooterSection` and then rendered its own copy of a full-height photographic
// header that also happened to be the navigation. Seven pages, seven identical
// headers, and the same picture each time.
//
// A layout fixes three things at once: the chrome is fetched once instead of
// per page, the unread counts are live on every screen rather than only on the
// two that remembered to ask for them, and — the reason it matters — the
// product stops re-introducing itself. You arrive once and then you are inside.
export default async function TrekBuddyLayout({ children }: { children: ReactNode }) {
  const membership = await getTrekMembership()

  // Counting unread anything for a signed-out visitor is a query that can only
  // return zero, so it is not run.
  const [unreadNotifications, unreadMessages] = membership.signedIn
    ? await Promise.all([getUnreadCount(), getUnreadMessages()])
    : [0, 0]

  return (
    <div className={`${trekFontVars} trek-scope flex min-h-screen flex-col bg-paper`}>
      <TrekTopBar
        signedIn={membership.signedIn}
        displayName={membership.signedIn ? membership.displayName : null}
        userId={membership.signedIn ? membership.userId : null}
        canHost={membership.signedIn ? membership.canHost : false}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      />
      {/* pb-16 on phones clears the thumb bar the top bar renders at the foot. */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <TrekFooter signedIn={membership.signedIn} canHost={membership.signedIn && membership.canHost} />
      {/* sonner's <Toaster/> was mounted only in the admin layout, so every
          toast.success and toast.error fired from a Trek Buddy client
          component rendered nothing at all. The host console has been
          silently swallowing the result of confirming and declining people
          for its whole life — a host pressed Confirm and got no acknowledgement
          either way. */}
      <Toaster />
    </div>
  )
}
