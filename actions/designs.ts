'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getUser } from './auth'
import type { CustomDesign, Json } from '@/types/database'

export type UserDesign = CustomDesign & {
  product: { name: string; slug: string; images: string[] } | null
  variant: { name: string } | null
}

// A custom design row is immutable once created — every "Add to Cart" from
// the customizer studio inserts a fresh row rather than updating an
// existing one, so a design already sitting in a placed order can never be
// retroactively changed by a later edit to the same product.
export async function saveCustomDesign(input: {
  product_id: string
  variant_id?: string | null
  front_design?: Json | null
  back_design?: Json | null
  front_preview_url?: string | null
  back_preview_url?: string | null
  front_print_url?: string | null
  back_print_url?: string | null
  color_name?: string | null
  color_hex?: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const user = await getUser()

  const { data, error } = await supabase
    .from('custom_designs')
    .insert({
      user_id: user?.id ?? null,
      product_id: input.product_id,
      variant_id: input.variant_id ?? null,
      front_design: input.front_design ?? null,
      back_design: input.back_design ?? null,
      front_preview_url: input.front_preview_url ?? null,
      back_preview_url: input.back_preview_url ?? null,
      front_print_url: input.front_print_url ?? null,
      back_print_url: input.back_print_url ?? null,
      color_name: input.color_name ?? null,
      color_hex: input.color_hex ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, designId: data.id as string }
}

// A signed-in customer's saved designs — RLS already scopes custom_designs
// reads to `user_id = auth.uid()`, so this is a plain select through the
// session client, joined with just enough product info to link back to the
// studio for a re-order.
export async function getUserDesigns() {
  const user = await getUser()
  if (!user) return []

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('custom_designs')
    .select('*, product:products(name, slug, images), variant:product_variants(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as UserDesign[]
}
