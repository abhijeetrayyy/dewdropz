import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // A Server Component cannot write cookies, and this throws if it tries.
        // That matters more than it looks: supabase-js refreshes an expiring
        // access token on its own, from an async subscriber callback that
        // nothing here awaits — so the throw does not surface as a render
        // error that Next can handle, it escapes as an *unhandled rejection*
        // and takes the whole serverless invocation down. On Vercel that is a
        // blank "A server error occurred" page, and only for visitors whose
        // token happened to be due for refresh, which is why it read as random.
        //
        // Swallowing is the documented pattern: the write is not lost, it is
        // just deferred to somewhere allowed to do it. See proxy.ts.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component. Middleware refreshes the session.
          }
        },
      },
    }
  )
}
