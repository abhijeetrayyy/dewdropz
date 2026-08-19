import { redirect } from 'next/navigation'

// "Yours" WAS half of a dashboard.
//
// It held the inbox and three lists of identical cards — hosting, going,
// waiting — while `/basecamp` held the other half: a feed of what the people
// you follow had posted. Two pages, neither of which answered the question a
// member arrives with, and both of which had to be visited to find out what
// was waiting on you.
//
// Basecamp has absorbed everything this page could show: the inbox is the feed
// in its left column, and the three card lists are one list of meter rows
// ordered by departure. So this is a redirect rather than a page — every link
// and bookmark that pointed here still lands somewhere true, and there is one
// account home instead of two halves of one.
export default async function YourTreksRedirect() {
  redirect('/trek-buddy/basecamp')
}
