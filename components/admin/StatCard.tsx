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
  className,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: keyof typeof toneClasses
  className?: string
}) {
  return (
    <Card className={cn('transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_28px_-12px_rgba(15,23,42,0.16)]', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-black">{value}</div>
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="h-10 animate-pulse bg-gray-100 rounded" />
      </CardContent>
    </Card>
  )
}
