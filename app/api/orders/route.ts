import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('order_number')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (orderNumber) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('order_number', orderNumber)
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data, error, count } = await supabase
    .from('orders')
    .select('*, items:order_items(*)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, limit, offset })
}
