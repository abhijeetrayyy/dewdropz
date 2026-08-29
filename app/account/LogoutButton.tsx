'use client'

import { useState } from 'react'
import { logout } from '@/actions/auth'
import { LogOut, Loader2 } from 'lucide-react'

export default function LogoutButton() {
  // Signing out is a server round-trip and a redirect. Without a pending state
  // the button looked inert for the whole of it, which reads as "it didn't
  // work" and invites a second click.
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { setBusy(true); logout() }}
      className="flex w-full items-center gap-2 font-body text-[13px] text-light transition-colors hover:text-clay-deep disabled:cursor-wait"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
      ) : (
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
