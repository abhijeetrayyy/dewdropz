import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Account, checkout, and admin are all real-user/private surfaces —
      // nothing there should be indexed, and admin doubly so.
      disallow: ['/account', '/checkout', '/admin', '/api', '/auth'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
