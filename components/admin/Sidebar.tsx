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
  BadgePercent,
  ShoppingBag,
  Receipt,
  ListChecks,
  Printer,
  LayoutTemplate,
  Truck,
  Star,
  Users,
  Mail,
  MessageSquare,
  Settings,
  ExternalLink,
  ChevronDown,
  Undo2, Mountain, Palette, Tent,
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
      { href: '/admin/designs', label: 'Design Library', icon: Palette },
      { href: '/admin/rentals', label: 'Rentals', icon: Tent },
      { href: '/admin/homepage', label: 'Homepage', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
      { href: '/admin/promotions', label: 'Promotions', icon: BadgePercent },
      { href: '/admin/production', label: 'Print Queue', icon: Printer },
      { href: '/admin/returns', label: 'Returns', icon: Undo2 },
      { href: '/admin/abandoned-carts', label: 'Abandoned Carts', icon: ShoppingBag },
      { href: '/admin/tax', label: 'Tax Rules', icon: Receipt },
      { href: '/admin/shipping', label: 'Shipping', icon: Truck },
      { href: '/admin/jobs', label: 'Background Jobs', icon: ListChecks },
    ],
  },
  {
    label: 'Audience',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
      { href: '/admin/trek-buddy', label: 'Trek Buddy', icon: Mountain },
    ],
  },
]

export function Sidebar({ trekQueueCount = 0 }: { trekQueueCount?: number }) {
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
                        // Every one of these routes is dynamic and admin-only,
                        // so a prefetch is not a cheap cache warm — it makes the
                        // server authenticate and fully render that page, with
                        // its database queries, just because the link is on
                        // screen. With ~23 links always visible, one navigation
                        // was measured firing 37 background requests alongside
                        // the single one actually asked for. Multiply by a
                        // US-East function and an admin in India and the page
                        // you clicked is queued behind the twenty you did not.
                        prefetch={false}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          active ? 'bg-black text-white' : 'text-gray-600 hover:text-black hover:bg-gray-100'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {/* The only badge in this nav, and it earns the
                            exception. 052: "a queue with nobody behind it is
                            worse than no queue, because the button implies
                            supervision." An unread report is the one thing on
                            this admin where nobody else is coming, and where a
                            day's delay is the product breaking a promise it
                            made to a member. Red rather than grey for the same
                            reason. */}
                        {item.href === '/admin/trek-buddy' && trekQueueCount > 0 && (
                          <span
                            className={cn(
                              'ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums',
                              active ? 'bg-white text-black' : 'bg-red-600 text-white'
                            )}
                            title={`${trekQueueCount} unresolved ${trekQueueCount === 1 ? 'report' : 'reports'}`}
                          >
                            {trekQueueCount}
                          </span>
                        )}
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
            prefetch={false}
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
        <Link href="/" target="_blank" prefetch={false}>
          <Button variant="ghost" size="sm" className="w-full justify-start text-gray-500 text-xs">
            <ExternalLink className="h-3 w-3 mr-2" />
            View Storefront
          </Button>
        </Link>
      </div>
    </aside>
  )
}
