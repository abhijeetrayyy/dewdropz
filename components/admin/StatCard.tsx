import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const toneClasses = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  neutral: 'bg-secondary text-secondary-foreground',
} as const

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  sub,
  className,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: keyof typeof toneClasses
  /** One line under the figure saying what it is counted on. A money card whose
   *  basis is not stated invites the reader to assume the basis they wanted. */
  sub?: string
  className?: string
}) {
  return (
    <Card className={cn('transition-shadow duration-300 hover:shadow-[var(--shadow-card)]', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-black">{value}</div>
        {sub && <p className="mt-1 text-xs leading-snug text-gray-500">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// The skeleton has to be the SHAPE of the answer, not a grey bar where the
// answer will go. This one was a single 40px block inside `pt-6`, while the real
// card is a header row plus a 2xl figure plus an optional sub-line — so every
// dashboard load visibly jumped when the numbers arrived.
export function StatCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
      </CardHeader>
      <CardContent>
        <div className="h-7 w-16 animate-pulse rounded bg-gray-100" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
      </CardContent>
    </Card>
  )
}
