import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const collection = searchParams.get('collection')
  const featured = searchParams.get('featured')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createServerSupabaseClient()

  if (slug) {
    const { data, error } = await supabase
      .from('products')
      .select('*, collection:collections(*), variants:product_variants(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  let query = supabase
    .from('products')
    .select('*, collection:collections(*), variants:product_variants(*)', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (collection) query = query.eq('collection_id', collection)
  if (featured === 'true') query = query.eq('is_featured', true)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, limit, offset })
}
