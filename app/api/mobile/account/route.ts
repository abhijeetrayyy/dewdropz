import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'

// Deleting an account, for real.
//
// The app had a "Delete account" row that opened an email asking somebody to do
// it by hand, "within 30 days". Apple's guideline 5.1.1(v) requires an app that
// lets people create an account to let them delete it FROM THE APP, and a
// support address is the specific thing it names as insufficient. It is a
// documented rejection reason, and it was also just untrue to the customer:
// nothing was deleted when they pressed it.
//
// There was no deletion path anywhere in this codebase — not on the web either.
// Migration 086 removed the last obstacle to it (two Trek Buddy attribution
// columns whose NO ACTION foreign keys made any host permanently undeletable),
// but nothing ever called through.
//
// WHAT THIS DELETES, and what deliberately survives:
//
//   Deleting the auth user cascades to `profiles`, and the schema has already
//   decided what that means for everything hanging off it — 086's header counts
//   them: 29 cascade, 9 set null. Addresses, carts, wishlists, designs and Trek
//   Buddy membership go. `orders.user_id` and `returns.user_id` are SET NULL, so
//   the business records survive their customer, which is what a shop that has
//   to keep invoices for GST needs. That is the schema's decision, not this
//   route's, and this route does not try to override it.
//
// THE TOKEN IS THE CONFIRMATION. There is no "are you sure" here because a
// dialog belongs on the device; what this needs is proof the caller is who they
// say they are right now. A bearer token is verified against GoTrue on every
// call, and only that token's own user is ever deleted — there is no id in the
// request body to get wrong.

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()

  // An admin deleting their own account through a phone would leave the shop
  // without one, and a mobile app is not where that decision should be made.
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'admin') {
    return NextResponse.json(
      { error: 'Staff accounts are removed by another admin, not from the app.' },
      { status: 403 }
    )
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    // Surfaced rather than flattened: if a foreign key blocks this again the
    // way it did before 086, the message is the only thing that will say so.
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
