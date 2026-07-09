'use server'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { requireAdmin } from './auth'

export interface NewsletterSubscriber {
  id: string
  email: string
  is_confirmed: boolean
  confirmed_at: string | null
  source: string | null
  created_at: string
}

// subscribeToNewsletter()/confirmNewsletter() (the public-facing writes) live in
// actions/reviews.ts already — this file only adds the admin-facing read/export,
// since subscribers otherwise have no admin visibility at all.
export async function getNewsletterSubscribers(opts?: { search?: string; limit?: number; offset?: number }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let query = supabase.from('newsletter_subscribers').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, '')
    query = query.ilike('email', `%${s}%`)
  }
  if (opts?.limit != null && opts?.offset != null) {
    query = query.range(opts.offset, opts.offset + opts.limit - 1)
  } else if (opts?.limit) {
    query = query.limit(opts.limit)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { subscribers: (data ?? []) as NewsletterSubscriber[], total: count ?? 0 }
}

export async function exportNewsletterSubscribersCsv() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as NewsletterSubscriber[]
  const header = 'email,confirmed,source,joined_at'
  const lines = rows.map((r) =>
    [r.email, r.is_confirmed ? 'yes' : 'no', r.source ?? '', r.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )
  return [header, ...lines].join('\n')
}
