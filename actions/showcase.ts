'use server'

import { createPublicSupabaseClient } from '@/lib/supabase'
import { getStoreSettings } from './settings'
import type { HomeShowcaseRail, ProductWithCollection } from '@/types/database'

const PRODUCT_SELECT =
  '*, collection:collections(*), variants:product_variants(*), categories:product_categories(*), attributes:product_attribute_values(*, attribute:attributes(*), value:attribute_values(*))'

export interface ResolvedRail {
  id: string
  title: string
  kind: HomeShowcaseRail['kind']
  products: ProductWithCollection[]
}

// Resolves the admin's rail definitions against the live catalogue.
//
// The point of computing these rather than pinning slugs: the store currently
// has almost no catalogue and no order history, so every rail legitimately
// comes back empty — and an empty rail is dropped, so the homepage simply
// doesn't show it. As real products get added and real orders come in, the
// same untouched config starts producing rows on its own. No placeholder data
// is ever invented to fill the shape.
//
// Shared by the web homepage and the mobile apps (via /api/mobile/home), so
// both surfaces are driven by the one admin screen.
export async function getShowcaseRails(): Promise<ResolvedRail[]> {
  const settings = await getStoreSettings()
  const rails = settings.home_config.showcase.filter((r) => r.enabled)
  if (rails.length === 0) return []

  const resolved = await Promise.all(rails.map(resolveRail))
  return resolved.filter((r): r is ResolvedRail => r !== null && r.products.length > 0)
}

async function resolveRail(rail: HomeShowcaseRail): Promise<ResolvedRail | null> {
  const products = await productsForRail(rail)
  return { id: rail.id, title: rail.title, kind: rail.kind, products }
}

async function productsForRail(rail: HomeShowcaseRail): Promise<ProductWithCollection[]> {
  const supabase = createPublicSupabaseClient()
  const limit = Math.min(Math.max(rail.limit || 8, 1), 24)

  switch (rail.kind) {
    case 'recent': {
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as unknown as ProductWithCollection[]
    }

    case 'collection': {
      if (!rail.collection_slug) return []
      const { data: col } = await supabase
        .from('collections')
        .select('id')
        .eq('slug', rail.collection_slug)
        .maybeSingle()
      if (!col) return []
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .eq('collection_id', col.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as unknown as ProductWithCollection[]
    }

    case 'category': {
      if (!rail.category_slug) return []
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', rail.category_slug)
        .maybeSingle()
      if (!cat) return []
      const { data: links } = await supabase
        .from('product_categories')
        .select('product_id')
        .eq('category_id', cat.id)
        .limit(limit)
      const ids = (links ?? []).map((l) => l.product_id)
      if (ids.length === 0) return []
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .in('id', ids)
        .limit(limit)
      return (data ?? []) as unknown as ProductWithCollection[]
    }

    case 'best_sellers': {
      // Aggregated in the database (migration 028). Doing it here meant
      // pulling every order line into memory to sum them, which gets worse
      // with every order the shop takes; the RPC also lets the mobile apps
      // rank best-sellers without read access to order_items.
      const { data: ranked } = await supabase.rpc('product_sales_ranking', { p_limit: limit })
      if (!ranked?.length) return []

      const ids = (ranked as { product_id: string }[]).map((r) => r.product_id)
      const { data } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .in('id', ids)
      const byId = new Map((data ?? []).map((p) => [(p as { id: string }).id, p]))
      // Re-apply the sales ranking — `in()` returns rows in arbitrary order.
      return ids.map((id) => byId.get(id)).filter(Boolean) as unknown as ProductWithCollection[]
    }

    default:
      return []
  }
}
