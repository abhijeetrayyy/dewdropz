import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedRoutes = ['/account', '/orders', '/checkout']
const adminRoutes = ['/admin']
const authRoutes = ['/auth/login', '/auth/signup', '/auth/reset-password']

// Supabase keeps the session in `sb-<project-ref>-auth-token`, split into
// `.0`/`.1` chunks when it outgrows a single cookie.
//
// No such cookie means there is no session, which means there is nothing to
// refresh and nobody to be signed in as. Checking for it is what keeps this
// middleware free for the traffic that makes up most of a storefront: an
// anonymous visitor reading a product page never touches the auth server.
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
}

// A redirect is a brand new response, so anything the session refresh wrote on
// the one we were building is thrown away unless it is carried across. Losing a
// rotated refresh token this way signs the customer out on their next request —
// and it would happen precisely when they were being sent to a page that needs
// them signed in.
function redirectCarryingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r))
  const isAdmin = adminRoutes.some((r) => pathname.startsWith(r))
  const isAuth = authRoutes.some((r) => pathname.startsWith(r))
  const isGated = isProtected || isAdmin || isAuth

  // Middleware is the only part of a page request allowed to write cookies, so
  // it is the only place a rotated session can actually be saved. This used to
  // return early for every public route, which meant a customer browsing the
  // storefront had their token refreshed by a Server Component that could not
  // persist the result — and since Supabase rotates refresh tokens, a token
  // that is never persisted eventually stops working and signs them out.
  if (!isGated && !hasSessionCookie(request)) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // The two cases want different calls, and the difference is the whole reason
  // this is affordable on public pages.
  //
  //   getUser()    asks the auth server to validate the token, every time. That
  //                round-trip is the price of an authorisation decision, and it
  //                is the right price on the handful of gated routes.
  //   getSession() reads the session from the cookie and only goes to the
  //                network when it has actually expired. Nothing is authorised
  //                from it — it exists here purely so a refresh that is already
  //                going to happen happens somewhere it can be saved.
  if (!isGated) {
    await supabase.auth.getSession()
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated away from protected/admin routes
  if (!user && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return redirectCarryingCookies(url, response)
  }

  // Redirect logged-in users away from auth pages
  if (user && isAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return redirectCarryingCookies(url, response)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
