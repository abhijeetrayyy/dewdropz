import Link from 'next/link'
import { getJobs, getJobCounts } from '@/actions/jobs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import RetryJobButton from './RetryJobButton'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const TABS = ['failed', 'pending', 'running', 'done']

const BADGE: Record<string, 'success' | 'warning' | 'secondary'> = {
  done: 'success',
  pending: 'warning',
  running: 'warning',
  failed: 'secondary',
}

// Outbound work — confirmation emails, refund notices, Slack alerts — now runs
// through a queue with retries. This is the window into it: without one, a job
// that has exhausted its attempts exists only as a Slack message, and only if
// SLACK_WEBHOOK_URL happens to be configured.
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const status = TABS.includes(params.status ?? '') ? params.status! : 'failed'
  const page = Math.max(0, parseInt(params.page ?? '0') || 0)

  const [{ jobs, total }, counts] = await Promise.all([
    getJobs({ status, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    getJobCounts(),
  ])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Background Jobs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Emails and alerts, queued rather than sent inline. Failed attempts back off and retry;
          anything here marked failed has given up and needs a person.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/jobs?status=${t}`}
            className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
              status === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            {t} <span className="opacity-60">{counts[t] ?? 0}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Nothing {status}.
                  </TableCell>
                </TableRow>
              ) : jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="font-mono text-sm text-gray-900">{j.type}</div>
                    <Badge variant={BADGE[j.status] ?? 'secondary'}>{j.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[220px] truncate">
                    {JSON.stringify(j.payload)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-gray-600">
                    {j.attempts}/{j.max_attempts}
                  </TableCell>
                  <TableCell className="text-xs text-red-700 max-w-[280px] truncate">
                    {j.last_error ?? '—'}
                  </TableCell>
                  <TableCell>
                    {j.status === 'failed' && <RetryJobButton id={j.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {pageCount} · {total} jobs</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/jobs?status=${status}&page=${page - 1}`}
              aria-disabled={page === 0}
              className={`rounded-md border px-3 py-1.5 ${page === 0 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}
            >
              Prev
            </Link>
            <Link
              href={`/admin/jobs?status=${status}&page=${page + 1}`}
              aria-disabled={page + 1 >= pageCount}
              className={`rounded-md border px-3 py-1.5 ${page + 1 >= pageCount ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
