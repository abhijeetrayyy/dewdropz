'use client'

/* eslint-disable react-hooks/set-state-in-effect -- the established pattern in
   this admin: load on mount and on tab change, same as Messages and Jobs. */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, ShieldBan, Filter, BookOpen, Users, Mountain, FlaskConical,
  Check, Trash2, Plus, EyeOff, Ban, X, Tent, Activity,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getTrekReports, resolveTrekReport, getWordRules, saveWordRule, deleteWordRule,
  testModeration, getActivityKindsAdmin, saveActivityKind, getGuidanceAdmin,
  saveGuidance, deleteGuidance, getTrekMembers, setTrekMember, setTrekMentor,
  getHostRequests, decideHostRequest, getTrekHealth,
  type TrekReportRow, type WordRule, type ActivityKind, type GuidanceNote, type TrekMemberRow,
  type HostRequestRow, type TrekHealth,
} from '@/actions/trekAdmin'

const TABS = [
  // First, and first on purpose. Everything else on this desk is a thing you
  // came here to do; this is the one that tells you whether something needed
  // doing that nobody has noticed.
  { key: 'health', label: 'Health', icon: Activity },
  { key: 'queue', label: 'Queue', icon: AlertTriangle },
  { key: 'rules', label: 'Word rules', icon: Filter },
  { key: 'test', label: 'Test text', icon: FlaskConical },
  { key: 'kinds', label: 'Kinds of outing', icon: Mountain },
  { key: 'guidance', label: 'Guidance', icon: BookOpen },
  { key: 'members', label: 'Members', icon: Users },
  // Hosting is invite-only and the owner grants it one person at a time. Until
  // now there was no list of who had asked, because there was no way to ask.
  { key: 'hosting', label: 'Hosting requests', icon: Tent },
] as const
type Tab = (typeof TABS)[number]['key']

const CATEGORIES = ['contact', 'abuse', 'sexual', 'spam', 'commercial', 'unsafe', 'other'] as const

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })

export default function TrekAdminClient() {
  const [tab, setTab] = useState<Tab>('queue')
  const [pending, start] = useTransition()

  const [hostRequests, setHostRequests] = useState<HostRequestRow[]>([])
  const [reports, setReports] = useState<TrekReportRow[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [rules, setRules] = useState<WordRule[]>([])
  const [kinds, setKinds] = useState<ActivityKind[]>([])
  const [guidance, setGuidance] = useState<GuidanceNote[]>([])
  const [members, setMembers] = useState<TrekMemberRow[]>([])
  const [memberQ, setMemberQ] = useState('')
  const [health, setHealth] = useState<TrekHealth | null>(null)

  async function load() {
    try {
      if (tab === 'health') setHealth(await getTrekHealth())
      if (tab === 'queue') setReports(await getTrekReports({ resolved: showResolved }))
      if (tab === 'rules') setRules(await getWordRules())
      if (tab === 'kinds') setKinds(await getActivityKindsAdmin())
      if (tab === 'guidance') setGuidance(await getGuidanceAdmin())
      if (tab === 'members') setMembers(await getTrekMembers(memberQ))
      if (tab === 'hosting') setHostRequests(await getHostRequests())
    } catch {
      toast.error('Could not load that')
    }
  }
  useEffect(() => { load() }, [tab, showResolved])

  const run = (fn: () => Promise<{ error?: string } | { success: true }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (r && 'error' in r && r.error) { toast.error(r.error); return }
      toast.success(ok)
      await load()
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">TrekBuddy</h1>
        <p className="mt-1 text-sm text-gray-500">
          What people may post, what the scan caught, and who is on the board.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const Icon = t.icon
          const on = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                on
                  ? 'border-black font-medium text-black'
                  : 'border-transparent text-gray-500 hover:text-black'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.key === 'queue' && reports.length > 0 && !showResolved && (
                <Badge variant="destructive" className="ml-1">{reports.length}</Badge>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'health' && <Health health={health} onOpenQueue={() => setTab('queue')} />}

      {tab === 'queue' && (
        <Queue
          reports={reports}
          showResolved={showResolved}
          onToggleResolved={() => setShowResolved((v) => !v)}
          pending={pending}
          onResolve={(id, res, note) =>
            run(() => resolveTrekReport(id, res, note), 'Report resolved')
          }
        />
      )}
      {tab === 'rules' && (
        <Rules
          rules={rules}
          pending={pending}
          onSave={(r) => run(() => saveWordRule(r), 'Rule saved')}
          onDelete={(id) => run(() => deleteWordRule(id), 'Rule deleted')}
        />
      )}
      {tab === 'test' && <TestText />}
      {tab === 'kinds' && (
        <Kinds kinds={kinds} pending={pending} onSave={(k) => run(() => saveActivityKind(k), 'Saved')} />
      )}
      {tab === 'guidance' && (
        <Guidance
          notes={guidance}
          kinds={kinds}
          pending={pending}
          onSave={(g) => run(() => saveGuidance(g), 'Guidance saved')}
          onDelete={(id) => run(() => deleteGuidance(id), 'Deleted')}
        />
      )}
      {tab === 'hosting' && (
        <HostingRequests
          rows={hostRequests}
          pending={pending}
          onDecide={(id, grant) =>
            run(() => decideHostRequest(id, grant), grant ? 'Hosting granted' : 'Request declined')
          }
        />
      )}

      {tab === 'members' && (
        <Members
          members={members}
          q={memberQ}
          setQ={setMemberQ}
          onSearch={load}
          pending={pending}
          onSet={(i) => run(() => setTrekMember(i), 'Member updated')}
          onMentor={(id, m, bio) => run(() => setTrekMentor(id, m, bio), 'Mentor updated')}
        />
      )}
    </div>
  )
}

// ── Health ───────────────────────────────────────────────────────────────────
//
// Four reads, no job. Each one names somebody having a bad time on this board
// who has no way to say so.

function Stat({
  label, value, sub, tone = 'plain',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'plain' | 'warn' | 'bad'
}) {
  const ring =
    tone === 'bad' ? 'border-red-300 bg-red-50' :
    tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
  return (
    <div className={`rounded-lg border p-4 ${ring}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function Health({ health, onOpenQueue }: { health: TrekHealth | null; onOpenQueue: () => void }) {
  if (!health) return <p className="text-sm text-gray-500">Reading the board…</p>
  const { reports, unanswered, neverQuorate, atCap, cap } = health

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">The queue</h2>
          {reports.open > 0 && (
            <Button size="sm" variant="outline" onClick={onOpenQueue}>Open the queue</Button>
          )}
        </div>
        {/* 052, verbatim, because it is the reason this panel exists at all. */}
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          A queue with nobody behind it is worse than no queue, because the button implies
          supervision. These are the numbers that tell you whether that has happened.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Open reports" value={reports.open} tone={reports.open > 0 ? 'warn' : 'plain'} />
          <Stat label="Waiting over 3 days" value={reports.over3d} tone={reports.over3d > 0 ? 'warn' : 'plain'} />
          <Stat label="Waiting over 7 days" value={reports.over7d} tone={reports.over7d > 0 ? 'bad' : 'plain'} />
          <Stat
            label="Oldest"
            value={reports.oldestDays === null ? '—' : `${reports.oldestDays}d`}
            sub={reports.oldestDays === null ? 'nothing open' : 'since it was reported'}
            tone={(reports.oldestDays ?? 0) >= 7 ? 'bad' : (reports.oldestDays ?? 0) >= 3 ? 'warn' : 'plain'}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Hosts who never answered</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Somebody asked to come and the trip left without an answer. The board can no longer
          confirm them, no notification is ever sent about it, and the person got silence and
          then absence. A host who does this repeatedly is a board problem, not a host problem.
        </p>
        {unanswered.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nobody. Every ask was answered.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {unanswered.map((h) => (
              <li key={h.hostId} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">{h.hostName}</span>
                <span className="text-sm tabular-nums text-gray-500">
                  {h.count} {h.count === 1 ? 'ask' : 'asks'} · {h.people}{' '}
                  {h.people === 1 ? 'person' : 'people'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Trips that never made quorum</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Finished without reaching their minimum party, so the meeting point was never
          released and they quietly did not happen. Nobody is told this either.
        </p>
        {neverQuorate.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">None. Everything that finished had enough people.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {neverQuorate.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">{p.place}</span>
                <span className="text-sm tabular-nums text-gray-500">
                  {p.going} of {p.minParty} · ended {fmt(p.endedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Hosts at their cap</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Holding all {cap} open trips they are allowed, so their next attempt to post is
          refused. Counted on <code className="text-xs">ends_at</code> since 107, so a host out
          on day one of six still holds the slot.
        </p>
        {atCap.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nobody is blocked.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {atCap.map((h) => (
              <li key={h.hostId} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">{h.hostName}</span>
                <span className="text-sm tabular-nums text-gray-500">{h.open} open</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Queue ────────────────────────────────────────────────────────────────────

function Queue({
  reports, showResolved, onToggleResolved, pending, onResolve,
}: {
  reports: TrekReportRow[]
  showResolved: boolean
  onToggleResolved: () => void
  pending: boolean
  onResolve: (id: string, r: 'dismissed' | 'warned' | 'plan_hidden' | 'member_suspended' | 'member_banned', note?: string) => void
}) {
  const [note, setNote] = useState<Record<string, string>>({})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {showResolved
            ? 'Resolved reports, newest work last.'
            : 'Open reports, oldest first — the worst thing on the board should not be the last thing you see.'}
        </p>
        <Button variant="outline" size="sm" onClick={onToggleResolved}>
          {showResolved ? 'Show open' : 'Show resolved'}
        </Button>
      </div>

      {reports.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-3 font-medium">{showResolved ? 'Nothing resolved yet.' : 'Queue is empty.'}</p>
            <p className="mt-1 text-sm text-gray-500">
              {showResolved ? '' : 'Nothing on the board is waiting for a decision.'}
            </p>
          </CardContent>
        </Card>
      )}

      {reports.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-4 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.source === 'auto' ? 'secondary' : 'destructive'}>
                    {r.source === 'auto' ? 'Caught by the scan' : 'Reported by a member'}
                  </Badge>
                  <Badge variant="outline">{r.reason}</Badge>
                  {r.field && <span className="text-xs text-gray-500">on the {r.field}</span>}
                  <span className="text-xs text-gray-400">{fmt(r.created_at)}</span>
                </div>

                <p className="mt-2 text-sm">
                  {r.plan_place && (
                    <>
                      Walk: <span className="font-medium">{r.plan_place}</span>
                      {r.plan_activity ? ` (${r.plan_activity.replace(/_/g, ' ')})` : ''}
                      {r.plan_hidden && <Badge variant="outline" className="ml-2">already hidden</Badge>}
                    </>
                  )}
                  {r.subject_name && (
                    <span className={r.plan_place ? 'ml-3' : ''}>
                      Member: <span className="font-medium">{r.subject_name}</span>
                      {r.subject_suspended && <Badge variant="outline" className="ml-2">suspended</Badge>}
                    </span>
                  )}
                </p>

                {r.reporter_name && (
                  <p className="mt-1 text-xs text-gray-500">Raised by {r.reporter_name}</p>
                )}
              </div>

              {r.resolved_at && (
                <Badge variant="outline">
                  {r.resolution} · {fmt(r.resolved_at)}
                </Badge>
              )}
            </div>

            {/* What actually tripped it. Without the text on the row, working a
                queue means opening a second tab for every single item. */}
            {r.excerpt && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  The text
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">
                  {r.excerpt}
                </p>
              </div>
            )}

            {r.rules.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500">Matched:</span>
                {r.rules.map((rule) => (
                  <Badge key={rule.id} variant="outline" className="font-mono text-[10px]">
                    {rule.category} · {rule.pattern}
                  </Badge>
                ))}
              </div>
            )}

            {r.detail && <p className="text-sm text-gray-700">{r.detail}</p>}
            {r.admin_note && (
              <p className="text-sm text-gray-500">Note: {r.admin_note}</p>
            )}

            {!r.resolved_at && (
              <div className="space-y-2 border-t pt-4">
                <Input
                  placeholder="A note — what you decided and why. Kept on the report."
                  value={note[r.id] ?? ''}
                  onChange={(e) => setNote((p) => ({ ...p, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => onResolve(r.id, 'dismissed', note[r.id])}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Nothing wrong
                  </Button>
                  {r.subject_id && (
                    <Button size="sm" variant="outline" disabled={pending}
                      onClick={() => onResolve(r.id, 'warned', note[r.id])}>
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Warn them
                    </Button>
                  )}
                  {r.plan_id && (
                    <Button size="sm" variant="outline" disabled={pending}
                      onClick={() => onResolve(r.id, 'plan_hidden', note[r.id])}>
                      <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide the walk
                    </Button>
                  )}
                  {r.subject_id && (
                    <Button size="sm" variant="destructive" disabled={pending}
                      onClick={() => {
                        if (!confirm('Suspend this member? Their open walks are cancelled and the people on them will see it.')) return
                        onResolve(r.id, 'member_suspended', note[r.id])
                      }}>
                      <ShieldBan className="mr-1.5 h-3.5 w-3.5" /> Suspend
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Word rules ───────────────────────────────────────────────────────────────

type RuleDraft = {
  id?: string
  pattern: string
  kind: 'word' | 'regex'
  action: 'block' | 'flag'
  category: string
  note: string
  hint: string
}
const BLANK_RULE: RuleDraft = {
  pattern: '', kind: 'word', action: 'flag', category: 'other', note: '', hint: '',
}

function Rules({
  rules, pending, onSave, onDelete,
}: {
  rules: WordRule[]
  pending: boolean
  onSave: (r: Parameters<typeof saveWordRule>[0]) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<RuleDraft>(BLANK_RULE)
  const byCategory = CATEGORIES.map((c) => [c, rules.filter((r) => r.category === c)] as const)
    .filter(([, rs]) => rs.length > 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="font-medium">{draft.id ? 'Edit rule' : 'Add a rule'}</h2>
          <p className="text-sm text-gray-500">
            <span className="font-medium">Block</span> refuses the post and shows the writer a
            reason. <span className="font-medium">Flag</span> lets it through and puts it in the
            queue. Prefer flag — a wrong block turns a real person away and they will not try again.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="A word, phrase, or regular expression"
              value={draft.pattern}
              onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))}
            />
            <div className="flex gap-2">
              <select className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm"
                value={draft.kind}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as 'word' | 'regex' }))}>
                <option value="word">Word or phrase</option>
                <option value="regex">Regular expression</option>
              </select>
              <select className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm"
                value={draft.action}
                onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value as 'block' | 'flag' }))}>
                <option value="flag">Flag for review</option>
                <option value="block">Block the post</option>
              </select>
              <select className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <Input placeholder="Why this rule exists — for whoever tunes it later"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          <Input placeholder="What the writer is told when this blocks them (optional)"
            value={draft.hint}
            onChange={(e) => setDraft((d) => ({ ...d, hint: e.target.value }))} />

          <div className="flex gap-2">
            <Button disabled={pending || draft.pattern.trim().length < 2}
              onClick={() => { onSave(draft); setDraft(BLANK_RULE) }}>
              <Plus className="mr-1.5 h-4 w-4" /> {draft.id ? 'Save' : 'Add rule'}
            </Button>
            {draft.id && (
              <Button variant="outline" onClick={() => setDraft(BLANK_RULE)}>Cancel</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {byCategory.map(([cat, rs]) => (
        <div key={cat}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {cat} · {rs.length}
          </h3>
          <Card>
            <CardContent className="divide-y p-0">
              {rs.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all rounded bg-gray-100 px-1.5 py-0.5 text-xs">{r.pattern}</code>
                      <Badge variant={r.action === 'block' ? 'destructive' : 'secondary'}>{r.action}</Badge>
                      {r.kind === 'regex' && <Badge variant="outline">regex</Badge>}
                      {!r.active && <Badge variant="outline">off</Badge>}
                    </div>
                    {r.note && <p className="mt-1 text-xs text-gray-500">{r.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" disabled={pending}
                      onClick={() => setDraft({
                        id: r.id, pattern: r.pattern, kind: r.kind, action: r.action,
                        category: r.category, note: r.note ?? '', hint: r.hint ?? '',
                      })}>Edit</Button>
                    <Button size="sm" variant="ghost" disabled={pending}
                      onClick={() => onSave({
                        id: r.id, pattern: r.pattern, kind: r.kind, action: r.action,
                        category: r.category, note: r.note ?? undefined, hint: r.hint ?? undefined,
                        active: !r.active,
                      })}>
                      {r.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending}
                      onClick={() => { if (confirm('Delete this rule?')) onDelete(r.id) }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}

// ── Try it ───────────────────────────────────────────────────────────────────

function TestText() {
  const [text, setText] = useState('')
  type Match = { rule_id: string; pattern: string; action: string; category: string; hint: string | null }
  const [result, setResult] = useState<{ error?: string; matches?: Match[] } | null>(null)
  const [pending, start] = useTransition()

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <h2 className="font-medium">Would the rules catch this?</h2>
        <p className="text-sm text-gray-500">
          Paste anything a member might write. Nothing is saved and nobody is affected — this runs
          the same scan every post goes through, so you can see what a new rule does before it is
          doing it to real people.
        </p>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Meet at 6, ping me on 98765 43210 if you are late" />
        <Button disabled={pending || !text.trim()}
          onClick={() => start(async () => setResult(await testModeration(text)))}>
          <FlaskConical className="mr-1.5 h-4 w-4" /> Run the scan
        </Button>

        {result?.error && (
          <p className="text-sm text-red-600">{result.error}</p>
        )}
        {result?.matches && (
          result.matches.length === 0 ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Nothing matched. This would post as written.
            </div>
          ) : (
            <div className="space-y-1.5">
              {result.matches!.some((m) => m.action === 'block') && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  This would be refused.
                </div>
              )}
              {result.matches!.map((m) => (
                <div key={m.rule_id} className="flex items-center gap-2 text-sm">
                  <Badge variant={m.action === 'block' ? 'destructive' : 'secondary'}>{m.action}</Badge>
                  <span className="text-gray-500">{m.category}</span>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{m.pattern}</code>
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

// ── Kinds of outing ──────────────────────────────────────────────────────────

function Kinds({
  kinds, pending, onSave,
}: {
  kinds: ActivityKind[]
  pending: boolean
  onSave: (k: Partial<ActivityKind> & { key: string }) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        What people may choose in the composer. Turning one off stops new walks of that kind
        without touching the ones already posted.
      </p>
      <Card>
        <CardContent className="divide-y p-0">
          {kinds.map((k) => (
            <div key={k.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.label}</span>
                  <Badge variant="outline">{k.day_part}</Badge>
                  {k.needs_night_note && <Badge variant="secondary">night note</Badge>}
                  {k.is_open_ended && <Badge variant="secondary">host names it</Badge>}
                  {!k.active && <Badge variant="outline">off</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {k.blurb} · starts {k.start_min.slice(0, 5)}–{k.start_max.slice(0, 5)} ·
                  needs {k.min_party} going
                </p>
              </div>
              <Button size="sm" variant="ghost" disabled={pending}
                onClick={() => onSave({ key: k.key, active: !k.active })}>
                {k.active ? 'Turn off' : 'Turn on'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Guidance ─────────────────────────────────────────────────────────────────

type NoteDraft = {
  id?: string
  activity: string
  audience: 'all' | 'women' | 'first_time' | 'host'
  title: string
  body: string
  sort: number
}
const BLANK_NOTE: NoteDraft = {
  activity: 'general', audience: 'all', title: '', body: '', sort: 100,
}

function Guidance({
  notes, kinds, pending, onSave, onDelete,
}: {
  notes: GuidanceNote[]
  kinds: ActivityKind[]
  pending: boolean
  onSave: (g: Partial<GuidanceNote> & { title: string; body: string }) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<NoteDraft>(BLANK_NOTE)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="font-medium">{draft.id ? 'Edit note' : 'Add guidance'}</h2>
          <p className="text-sm text-gray-500">
            The knowledge that normally only reaches somebody by going out with a person who
            already had it. Shown at the moment it applies — on the walk, in the composer, or on
            the board — rather than filed on a safety page nobody opens.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="h-9 rounded-md border border-gray-200 px-2 text-sm"
              value={draft.activity}
              onChange={(e) => setDraft((d) => ({ ...d, activity: e.target.value }))}>
              <option value="general">Everything</option>
              {kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <select className="h-9 rounded-md border border-gray-200 px-2 text-sm"
              value={draft.audience}
              onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value as NoteDraft['audience'] }))}>
              <option value="all">Everyone</option>
              <option value="women">Women</option>
              <option value="first_time">First timers</option>
              <option value="host">Hosts</option>
            </select>
          </div>
          <Input placeholder="Title — short and concrete" value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <Textarea rows={3} placeholder="Two to four sentences of the real thing."
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          <div className="flex gap-2">
            <Button disabled={pending || draft.title.trim().length < 3 || draft.body.trim().length < 20}
              onClick={() => { onSave(draft); setDraft(BLANK_NOTE) }}>
              <Plus className="mr-1.5 h-4 w-4" /> {draft.id ? 'Save' : 'Add note'}
            </Button>
            {draft.id && <Button variant="outline" onClick={() => setDraft(BLANK_NOTE)}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          {notes.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              No guidance yet. Everything above is empty on the member side until there is.
            </p>
          )}
          {notes.map((g) => (
            <div key={g.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{g.title}</span>
                  <Badge variant="outline">{g.activity === 'general' ? 'everything' : g.activity.replace(/_/g, ' ')}</Badge>
                  <Badge variant="secondary">{g.audience.replace(/_/g, ' ')}</Badge>
                  {!g.active && <Badge variant="outline">off</Badge>}
                </div>
                <p className="mt-1 text-sm text-gray-600">{g.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => setDraft({
                    id: g.id, activity: g.activity, audience: g.audience,
                    title: g.title, body: g.body, sort: g.sort,
                  })}>Edit</Button>
                <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => { if (confirm('Delete this note?')) onDelete(g.id) }}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Members ──────────────────────────────────────────────────────────────────

function Members({
  members, q, setQ, onSearch, pending, onSet, onMentor,
}: {
  members: TrekMemberRow[]
  q: string
  setQ: (v: string) => void
  onSearch: () => void
  pending: boolean
  onSet: (i: { userId: string; canHost?: boolean; suspended?: boolean; reason?: string }) => void
  onMentor: (id: string, mentor: boolean, bio?: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search by the name people see" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }} />
        <Button variant="outline" onClick={onSearch}>Search</Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {members.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Nobody has joined the board yet.</p>
          )}
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.trek_display_name}</span>
                  {m.trek_can_host && <Badge variant="secondary">host</Badge>}
                  {m.trek_mentor && <Badge>mentor</Badge>}
                  {m.trek_gender === 'woman' && <Badge variant="outline">women-only host</Badge>}
                  {m.trek_suspended_at && <Badge variant="destructive">suspended</Badge>}
                  {m.trek_warned_at && !m.trek_suspended_at && <Badge variant="outline">warned</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {m.trek_home_base ?? 'no home base'}
                  {m.trek_suspended_reason ? ` · ${m.trek_suspended_reason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => onSet({ userId: m.id, canHost: !m.trek_can_host })}>
                  {m.trek_can_host ? 'Remove hosting' : 'Let them host'}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => {
                    if (m.trek_mentor) { onMentor(m.id, false); return }
                    const bio = prompt('A line about what they know. Shown on their profile and beside their walks.')
                    if (bio && bio.trim().length >= 20) onMentor(m.id, true, bio)
                    else if (bio !== null) toast.error('That needs to be at least 20 characters.')
                  }}>
                  {m.trek_mentor ? 'Remove mentor' : 'Make mentor'}
                </Button>
                {m.trek_suspended_at ? (
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => onSet({ userId: m.id, suspended: false })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Lift suspension
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={pending}
                    onClick={() => {
                      const why = prompt('Why are they being suspended? They will be shown this.')
                      if (why) onSet({ userId: m.id, suspended: true, reason: why })
                    }}>
                    <Ban className="mr-1 h-3.5 w-3.5 text-red-600" /> Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Who has asked to host, and the record that comes with them.
 *
 * The decision this screen supports is "should this person be allowed to invite
 * strangers to a real place at a real hour", so the row leads with the things
 * that bear on it and that the board counted itself: how many walks they have
 * actually been confirmed on, what rung they stand on, how long they have been
 * here. The note they wrote is shown in full and last — it is the only part of
 * the row they controlled.
 */
function HostingRequests({
  rows,
  pending,
  onDecide,
}: {
  rows: HostRequestRow[]
  pending: boolean
  onDecide: (id: string, grant: boolean) => void
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nobody is waiting to host. Hosting stays invite-only either way — this queue is
          who put their hand up, not a backlog you have to clear.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.display_name ?? 'Unnamed member'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.home_base ?? 'No home base'} · {r.walks} walk{r.walks === 1 ? '' : 's'} confirmed
                {' · rung '}{r.trust_rung}
                {' · member since '}{new Date(r.member_since).getFullYear()}
                {' · asked '}{fmt(r.created_at)}
              </p>
              {r.note && (
                <p className="mt-2.5 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
                  {r.note}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={pending} onClick={() => onDecide(r.id, true)}>
                <Check className="mr-1.5 h-4 w-4" />
                Grant hosting
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onDecide(r.id, false)}
              >
                <X className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
