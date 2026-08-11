import { createAdminSupabaseClient } from '@/lib/supabase'
import type { NotificationType, Json } from '@/types/database'

// Internal helper (not a server action — same pattern as lib/orders-internal.ts)
// called from order-status code paths to actually populate the notifications
// table. Respects the recipient's notification_preferences instead of writing
// unconditionally, so turning off "Order updates" in Settings really does stop
// them arriving.
export async function notifyUser(input: {
  userId: string
  type: NotificationType
  title: string
  body?: string
  data?: Json
  orderId?: string
}) {
  const supabase = createAdminSupabaseClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', input.userId)
    .single()

  const prefKey = input.type === 'order_update' ? 'order_updates' : input.type === 'promotion' ? 'promotions' : 'back_in_stock'
  const prefs = profile?.notification_preferences as Record<string, boolean> | undefined
  if (prefs && prefs[prefKey] === false) return

  await supabase.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: input.data ?? null,
    order_id: input.orderId ?? null,
    read_at: null,
  })
}
