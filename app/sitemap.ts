import type { MetadataRoute } from 'next'
import { getProducts, getCollections } from '@/actions/products'
import { JOURNAL } from '@/lib/constants'

const STATIC_ROUTES = [
  '', '/shop', '/collections', '/customize', '/about', '/sustainability',
  '/journal', '/treks', '/contact', '/privacy',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  const [products, collections] = await Promise.all([getProducts(), getCollections()])

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.6,
  }))

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: p.updated_at,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${baseUrl}/collections/${c.slug}`,
    lastModified: c.updated_at,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const journalEntries: MetadataRoute.Sitemap = JOURNAL.map((entry) => ({
    url: `${baseUrl}/journal/${entry.id}`,
    changeFrequency: 'monthly',
    priority: 0.4,
  }))

  return [...staticEntries, ...productEntries, ...collectionEntries, ...journalEntries]
}
