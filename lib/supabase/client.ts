import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// For public, unauthenticated reads (product/collection/category catalog data)
// that must also work at build time — `createServerSupabaseClient()` reads
// request cookies via `next/headers`, which throws when called from
// `generateStaticParams()` (no request context exists yet). This is the same
// anon key with the same RLS, just without the cookie dependency, since none
// of these reads are actually scoped to a signed-in user anyway.
export function createPublicSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
