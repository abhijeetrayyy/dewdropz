import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { returnEligibilityFor, createReturnFor } from '@/actions/returns'

// Returning something, from the app.
//
// GET  — what is still returnable on this order, and why not if nothing is.
// POST — open the request.
//
// Both go through the shared core in actions/returns.ts rather than through
// the server actions themselves, because those authenticate with a cookie
// session this request does not have. Reimplementing the return window and the
// already-claimed arithmetic here would have created a second return policy
// that drifts from the web's; the split exists so there is one.
//
// Nothing about eligibility is decided here or trusted from the client — the
// POST re-runs the same check the GET did, because the two are minutes apart
// and a window can close in between.

async function userFor(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await userFor(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eligibility = await returnEligibilityFor(id, user.id, createAdminSupabaseClient())
  return NextResponse.json(eligibility)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await userFor(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : undefined
  const items = Array.isArray(body?.items)
    ? body.items
        .filter(
          (i: unknown): i is { orderItemId: string; quantity: number } =>
            !!i &&
            typeof (i as { orderItemId?: unknown }).orderItemId === 'string' &&
            Number.isInteger((i as { quantity?: unknown }).quantity)
        )
        .map((i: { orderItemId: string; quantity: number }) => ({
          orderItemId: i.orderItemId,
          quantity: i.quantity,
        }))
    : []

  if (!reason) {
    return NextResponse.json({ error: 'Tell us why it is coming back.' }, { status: 400 })
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Select at least one item to return.' }, { status: 400 })
  }

  const result = await createReturnFor(
    { orderId: id, reason, note, items },
    user.id,
    createAdminSupabaseClient()
  )

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
