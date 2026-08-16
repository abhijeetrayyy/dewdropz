import { Skeleton } from '@/components/ui/skeleton'

// Shown by Next during the navigation itself, so clicking a product responds
// instantly instead of leaving the previous page on screen while the server
// works. Shaped like the editor it precedes — a skeleton whose layout does not
// match what replaces it just moves the content once it arrives.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-10 w-full max-w-3xl" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}
