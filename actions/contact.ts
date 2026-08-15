'use server'

import { rateLimit } from '@/lib/rateLimit'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { contactSchema } from '@/lib/validations'
import { sendEmail } from '@/lib/email'
import { SITE } from '@/lib/constants'
import { requireAdmin } from './auth'

// Public, unauthenticated — anyone visiting /contact can submit this. Writes
// go through the admin client since contact_messages has no public INSERT
// policy (RLS is deny-by-default, matching every other table). The email
// notification is best-effort: RESEND_API_KEY isn't configured yet, and a
// missing key must never stop the real DB write from succeeding, same
// "caller swallows errors" pattern as sendOrderConfirmationIfFirstTime.
export async function submitContactMessage(input: { name: string; email: string; message: string }) {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Unauthenticated insert, so throttled per caller. Five in ten minutes is far
  // above what a person sending a genuine enquiry needs and far below what a
  // script needs to be worth running.
  const limited = await rateLimit('contact', { limit: 5, windowSeconds: 600 })
  if (!limited.ok) return { error: limited.error }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('contact_messages').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
  })
  if (error) return { error: 'Could not send your message — please try again.' }

  try {
    await sendEmail({
      to: SITE.email,
      subject: `New contact message from ${parsed.data.name}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;">
          <p style="font-size:14px;color:#666;"><strong>${parsed.data.name}</strong> (${parsed.data.email})</p>
          <p style="font-size:15px;white-space:pre-wrap;">${parsed.data.message}</p>
        </div>
      `,
    })
  } catch {
    // Resend not configured yet — the message is already saved, so this is fine.
  }

  return { success: true as const }
}

export type ContactMessage = {
  id: string
  name: string
  email: string
  message: string
  is_read: boolean
  created_at: string
}

export async function getContactMessages(params: { limit?: number; offset?: number } = {}) {
  await requireAdmin()
  const { limit = 20, offset = 0 } = params
  const supabase = createAdminSupabaseClient()
  const { data, error, count } = await supabase
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return { messages: (data ?? []) as ContactMessage[], total: count ?? 0 }
}

export async function markContactMessageRead(id: string, isRead: boolean) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('contact_messages').update({ is_read: isRead }).eq('id', id)
  if (error) throw new Error(error.message)
}
