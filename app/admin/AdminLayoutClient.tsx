'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { logout } from '@/actions/auth'
import { LogOut, ChevronRight } from 'lucide-react'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LABEL_OVERRIDES: Record<string, string> = { new: 'New' }

function titleCase(segment: string) {
  return LABEL_OVERRIDES[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean) // e.g. ['admin', 'products', '<uuid>']

  const crumbs = segments.map((segment, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = UUID_RE.test(segment) ? 'Edit' : titleCase(segment)
    return { href, label }
  })

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-black">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-gray-400 hover:text-gray-700">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function AdminLayoutClient({
  children,
  adminEmail,
  adminName,
}: {
  children: React.ReactNode
  adminEmail: string
  adminName: string | null
}) {
  async function handleLogout() {
    await logout()
  }

  const initial = (adminName || adminEmail || '?').charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-auto" data-lenis-prevent="true">
      <Sidebar />
      <div className="pl-56 min-h-full">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <Breadcrumb />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-black text-white text-xs font-medium flex items-center justify-center">
                {initial}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-medium text-gray-900">{adminName || 'Admin'}</div>
                <div className="text-[11px] text-gray-400">{adminEmail}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 text-xs">
              <LogOut className="h-3 w-3 mr-1" />
              Sign Out
            </Button>
          </div>
        </header>
        <main className="p-6">{children}</main>
        <Toaster />
      </div>
    </div>
  )
}
