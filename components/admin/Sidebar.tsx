'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  BarChart3,
  FolderTree,
  Hash,
  Shapes,
  Package,
  Layers,
  ShoppingCart,
  CreditCard,
  TicketPercent,
  Star,
  Users,
  Mail,
  Settings,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/collections', label: 'Collections', icon: Layers },
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/tags', label: 'Tags', icon: Hash },
      { href: '/admin/attributes', label: 'Attributes', icon: Shapes },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
    ],
  },
  {
    label: 'Audience',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 shadow-[1px_0_3px_rgba(15,23,42,0.04)] flex flex-col z-50">
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Logo href="/admin" markHeight={22} wordmarkClassName="font-bold text-lg tracking-tight text-black" />
          <span className="text-xs text-success bg-success-soft px-1.5 py-0.5 rounded font-medium">Admin</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => {
          const isCollapsed = collapsed[group.label]
          return (
            <div key={group.label}>
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.label]: !prev[group.label] }))}
                className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
              >
                {group.label}
                <ChevronDown className={cn('h-3 w-3 transition-transform', isCollapsed && '-rotate-90')} />
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          active ? 'bg-black text-white' : 'text-gray-600 hover:text-black hover:bg-gray-100'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div className="pt-2 mt-2 border-t border-gray-100">
          <Link
            href="/admin/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive('/admin/settings') ? 'bg-black text-white' : 'text-gray-600 hover:text-black hover:bg-gray-100'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-gray-200">
        <Link href="/" target="_blank">
          <Button variant="ghost" size="sm" className="w-full justify-start text-gray-500 text-xs">
            <ExternalLink className="h-3 w-3 mr-2" />
            View Storefront
          </Button>
        </Link>
      </div>
    </aside>
  )
}
