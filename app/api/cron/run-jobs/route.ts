import { NextResponse } from 'next/server'
import { runDueJobs } from '@/lib/jobs'

// Drains the job queue. Same Bearer gate as the other two cron routes — there
// is no admin session behind a scheduled job, and without CRON_SECRET set this
// refuses every request rather than running open to the internet.
//
// Meant to be hit often (every minute is reasonable). Safe to overlap: jobs are
// claimed with FOR UPDATE SKIP LOCKED, so a second run already in flight picks
// up different rows rather than sending the same email twice.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchParam = Number(new URL(request.url).searchParams.get('batch'))
  const batchSize = Number.isFinite(batchParam) && batchParam > 0 ? Math.min(batchParam, 100) : 20

  const result = await runDueJobs({ batchSize })
  return NextResponse.json(result)
}
