import 'server-only'
import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'

/**
 * Invalidate everything an admin edit to a product's taxonomy affects.
 *
 * setProductCategories and setProductTags revalidated only `/admin/products`,
 * and setProductAttributes revalidated nothing at all — so an edit updated the
 * admin list and left the storefront showing the old page. That was survivable
 * while product pages were rendered per request; now that they are cached, it
 * means an assigned attribute does not appear until the ISR window rolls over.
 *
 * updateProduct already did this correctly, which is why editing a price landed
 * immediately and assigning an attribute did not.
 *
 * The slug lookup is the reason this is a helper rather than a line in each
 * action: all three receive a product id, and the storefront path is keyed by
 * slug.
 */
export async function revalidateProductPaths(productId: string) {
  revalidatePath('/admin/products')

  const { data } = await createAdminSupabaseClient()
    .from('products')
    .select('slug')
    .eq('id', productId)
    .maybeSingle()

  if (data?.slug) {
    revalidatePath(`/products/${data.slug}`)
    // Categories and tags drive the shop's filter chips, so the listing has to
    // be refreshed alongside the product itself.
    revalidatePath('/shop')
  }
}
