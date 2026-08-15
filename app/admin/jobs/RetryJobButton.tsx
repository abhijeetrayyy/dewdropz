'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retryJob } from '@/actions/jobs'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function RetryJobButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await retryJob(id)
            toast.success('Requeued')
            router.refresh()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not requeue')
          }
        })
      }
    >
      {pending ? '…' : 'Retry'}
    </Button>
  )
}
