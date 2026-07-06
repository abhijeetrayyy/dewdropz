'use client'

import { logout } from '@/actions/auth'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  return (
    <button 
      onClick={() => logout()}
      className="flex items-center gap-2 text-text hover:text-clay transition-colors"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  )
}
