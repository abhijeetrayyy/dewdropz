import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010').replace(/\/$/, '')

  return {
    rules: {
      userAgent: '*',
      // The safety page is the one thing under /trek-buddy a crawler should
      // read: no member, no walk, and it is this product's full account of what
      // it enforces and where that stops. A more specific Allow beats the
      // blanket Disallow below, which is the whole reason that rule can be a
      // blanket in the first place.
      allow: ['/', '/trek-buddy/safety'],
      // Account, checkout, and admin are all real-user/private surfaces —
      // nothing there should be indexed, and admin doubly so.
      //
      // `/trek-buddy/` WITH THE TRAILING SLASH, and that character is the whole
      // rule: it blocks every member surface under the product — the board, the
      // walks, the people, the messages — while leaving `/trek-buddy` itself
      // crawlable, because that page is the signed-out pitch and names nobody.
      //
      // Belt and braces on purpose. Every one of those pages already sets
      // `robots: { index: false }`, but noindex is a promise made by a page
      // that has already been fetched; this one is made before the request.
      // Somebody adding a route under /trek-buddy and forgetting the metadata
      // is a mistake that should cost nothing.
      //
      // `/e/` and `/w/` are unguessable share tokens. They are noindex,
      // nocache and revocable, and they have no business being crawled at all.
      disallow: [
        '/account', '/checkout', '/admin', '/api', '/auth',
        '/trek-buddy/', '/e/', '/w/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
