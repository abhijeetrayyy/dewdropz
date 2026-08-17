'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getUser } from '@/actions/auth'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'
import { sendSlackAlert } from '@/lib/slack'

// Trek Buddy.
//
// Every mutation goes through a SECURITY DEFINER RPC in migration 052. There is
// no UPDATE policy on any Trek Buddy table for anybody, so these actions cannot
// write directly even if someone tried — which is deliberate: two of the worst
// holes found in the first draft of the schema were a host editing their own
// going-count to defeat the capacity limit, and back-dating a plan to
// manufacture a history of walks they never led. Both are impossible when the
// only door is a function that decides for itself what may change.
//
// The actor is passed explicitly rather than read from auth.uid(). These run on
// the service-role client, where auth.uid() is NULL — the same trap that made
// every admin control in the first draft a silent no-op.

// NOT re-exported: a 'use server' file may only export async functions, and a
// re-exported type becomes a runtime export the bundler then cannot find.
// Import TrekActivity from '@/lib/trek' directly.
import type { TrekActivity } from '@/lib/trek'

export type TrekEffort = 'easy' | 'moderate' | 'hard'

export type TrekPlanRow = {
  id: string
  host_id: string
  host_name: string
  activity: string
  activity_other: string | null
  /** The kind's label, or the host's own name for an 'other' outing. */
  activity_label: string
  place: string
  meet_area: string
  starts_on: string
  ends_on: string
  start_time: string
  back_by: string
  starts_at: string
  ends_at: string
  day_part: 'day' | 'evening' | 'overnight'
  min_party: number
  night_note: string | null
  capacity: number
  going_count: number
  spots_left: number
  effort: TrekEffort
  difficulty: 'easy' | 'moderate' | 'difficult'
  women_only: boolean
  senior_friendly: boolean
  languages: string[]
  cover_urls: string[]
  is_live: boolean
  note: string | null
  status: 'open' | 'cancelled'
  cancelled_at: string | null
  cancel_reason: string | null
  hidden_at: string | null
}

/** What the signed-in member still has to supply before they can use any of this. */
export async function getTrekMembership() {
  const user = await getUser()
  if (!user) return { signedIn: false as const }

  const { data } = await createAdminSupabaseClient()
    .from('profiles')
    .select('trek_display_name, trek_dob, trek_terms_at, trek_can_host, trek_gender')
    .eq('id', user.id)
    .maybeSingle()

  const onboarded = Boolean(data?.trek_display_name && data?.trek_dob && data?.trek_terms_at)
  return {
    signedIn: true as const,
    userId: user.id,
    onboarded,
    displayName: (data?.trek_display_name as string) ?? null,
    canHost: Boolean(data?.trek_can_host),
    // Needed by the composer so it can say why the women-only control is off,
    // rather than offering it and letting the database refuse the post.
    trekGender: (data?.trek_gender as string | null) ?? null,
  }
}

/**
 * Join the board: a display name, a date of birth and an acknowledgement.
 *
 * The date of birth is a claim, not a check — there is no identity provider
 * here and pretending otherwise would be worse than asking. What it buys is a
 * specific recorded misrepresentation rather than a tick-box, which is worth
 * something if it ever has to be argued about. Under-18s are refused by the
 * database, not here, so this cannot be bypassed by calling the RPC directly.
 */
export async function saveTrekProfile(input: {
  displayName: string
  dob: string
  acceptTerms: boolean
}) {
  const user = await requireAuth()

  const name = input.displayName.trim()
  if (name.length < 2 || name.length > 40) {
    return { error: 'Pick a name between 2 and 40 characters. It is what other walkers will see.' }
  }
  if (!input.acceptTerms) {
    return { error: 'You need to accept how Trek Buddy works before you can use it.' }
  }

  const dob = new Date(input.dob)
  if (Number.isNaN(dob.getTime())) return { error: 'That date does not look right.' }
  // Checked here for a readable message and again in the database, which is the
  // one that counts.
  const eighteen = new Date()
  eighteen.setFullYear(eighteen.getFullYear() - 18)
  if (dob > eighteen) {
    return { error: 'Trek Buddy is for adults only. You need to be 18 or over to use it.' }
  }

  const { error } = await createAdminSupabaseClient()
    .from('profiles')
    .update({
      trek_display_name: name,
      trek_dob: input.dob,
      trek_terms_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/trek-buddy')
  return { success: true as const }
}

/** The board. Members only — there is no anonymous read policy on any of this. */
/**
 * Put a readable name on each row.
 *
 * Kinds live in a table now, so a component cannot look a label up from a
 * frozen map without going stale the first time an admin adds one — it would
 * render the raw key, `sunrise_point`, on the board. One lookup per request,
 * shared by every row it decorates.
 */
async function withKindLabels<T extends { activity: string; activity_other?: string | null }>(
  rows: T[]
): Promise<(T & { activity_label: string })[]> {
  if (!rows.length) return []
  const { data } = await createAdminSupabaseClient()
    .from('trek_activity_kinds')
    .select('key, label')
  const label = new Map((data ?? []).map((k) => [k.key, k.label as string]))
  return rows.map((r) => ({
    ...r,
    activity_label:
      r.activity_other?.trim() ||
      label.get(r.activity) ||
      r.activity.replace(/_/g, ' '),
  }))
}

export async function getTrekBoard(filters?: {
  activity?: string
  when?: 'all' | 'week' | 'weekend'
  difficulty?: string
  language?: string
  womenOnly?: boolean
  seniorFriendly?: boolean
  hasSpots?: boolean
  q?: string
  mine?: boolean
}) {
  const user = await getUser()
  if (!user) return []

  let query = createAdminSupabaseClient()
    .from('trek_plans')
    .select('*')
    .eq('status', 'open')
    .is('hidden_at', null)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(60)

  if (filters?.activity && filters.activity !== 'all') query = query.eq('activity', filters.activity)
  if (filters?.difficulty && filters.difficulty !== 'all') query = query.eq('difficulty', filters.difficulty)
  if (filters?.womenOnly) query = query.eq('women_only', true)
  if (filters?.seniorFriendly) query = query.eq('senior_friendly', true)
  // Postgres array containment — a trip matches if it lists the language.
  if (filters?.language && filters.language !== 'all') query = query.contains('languages', [filters.language])

  // Search covers the place and the rendezvous town — the two things somebody
  // actually types. Not the note, which is where hosts put chatter.
  if (filters?.q) {
    const q = filters.q.replace(/[%_,()]/g, '').trim()
    if (q) query = query.or(`place.ilike.%${q}%,meet_area.ilike.%${q}%`)
  }

  if (filters?.when === 'week') {
    const wk = new Date(); wk.setDate(wk.getDate() + 7)
    query = query.lt('starts_at', wk.toISOString())
  }

  const { data } = await query
  let rows = (data ?? []) as TrekPlanRow[]

  // Saturday and Sunday in IST, worked out on the stored instant rather than on
  // the server's own day, which is a different one for five and a half hours.
  if (filters?.when === 'weekend') {
    rows = rows.filter((r) => {
      const ist = new Date(new Date(r.starts_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const d = ist.getDay()
      return d === 0 || d === 6
    })
  }

  if (filters?.hasSpots) rows = rows.filter((r) => r.spots_left > 0)
  if (filters?.mine) rows = rows.filter((r) => r.host_id === user.id)
  return withKindLabels(rows)
}

/** Everything this member is involved in — hosting or going. */
export async function getMyTreks() {
  const user = await getUser()
  if (!user) return { hosting: [], going: [] }

  const admin = createAdminSupabaseClient()
  const [{ data: hosting }, { data: joined }] = await Promise.all([
    admin.from('trek_plans').select('*').eq('host_id', user.id)
      .neq('status', 'cancelled').gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    admin.from('trek_plan_requests').select('status, plan:trek_plans(*)')
      .eq('user_id', user.id).in('status', ['requested', 'confirmed']),
  ])

  const going = (joined ?? [])
    .map((r) => ({ status: r.status as string, plan: r.plan as unknown as TrekPlanRow }))
    .filter((r) => r.plan && r.plan.status !== 'cancelled' && new Date(r.plan.starts_at) > new Date())
    .sort((a, b) => a.plan.starts_at.localeCompare(b.plan.starts_at))

  const [hostingLabelled, goingLabelled] = await Promise.all([
    withKindLabels((hosting ?? []) as TrekPlanRow[]),
    withKindLabels(going.map((g) => g.plan)),
  ])
  return {
    hosting: hostingLabelled as TrekPlanRow[],
    going: going.map((g, i) => ({ ...g, plan: goingLabelled[i] as TrekPlanRow })),
  }
}

/**
 * The public shape of another member.
 *
 * Deliberately thin: a display name, when they joined the board, and how many
 * outings they have hosted or been confirmed on. No photograph, no bio, no
 * contact, nothing free-text — a profile page on a product that introduces
 * strangers is an attack surface, and every field is one more thing to
 * impersonate somebody with or to be judged on.
 */
export async function getTrekMemberCard(userId: string) {
  const viewer = await getUser()
  if (!viewer) return null

  const admin = createAdminSupabaseClient()
  const [{ data: p }, { count: hosted }, { count: joined }] = await Promise.all([
    admin.from('profiles').select('trek_display_name, trek_terms_at').eq('id', userId).maybeSingle(),
    admin.from('trek_plans').select('id', { count: 'exact', head: true })
      .eq('host_id', userId).lt('starts_at', new Date().toISOString()).neq('status', 'cancelled'),
    admin.from('trek_plan_requests').select('plan_id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'confirmed'),
  ])

  if (!p?.trek_display_name) return null
  return {
    displayName: p.trek_display_name as string,
    memberSince: p.trek_terms_at as string | null,
    hosted: hosted ?? 0,
    joined: joined ?? 0,
  }
}

/**
 * How many walks are on the board, for the logged-out pitch.
 *
 * One integer and nothing else. The page a crawler or a stranger sees is
 * marketing; who is going where, and when, is not something to publish to
 * anyone who has not signed in.
 */
export async function getOpenPlanCount() {
  const { count } = await createAdminSupabaseClient()
    .from('trek_plans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .is('hidden_at', null)
    .gt('starts_at', new Date().toISOString())
  return count ?? 0
}

/**
 * One plan, plus whatever this viewer is entitled to see of it.
 *
 * The meeting point is read through the CALLER'S session, not the service-role
 * client, precisely so the RLS floor applies: `trek_plan_details` is readable
 * only by the host, or by a confirmed walker once three people are going. Doing
 * this read with the admin client would hand the exact spot to anyone who asked.
 */
export async function getTrekPlan(planId: string) {
  const user = await getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()
  const session = await createServerSupabaseClient()

  const [{ data: plan }, { data: mine }, { data: details }] = await Promise.all([
    admin.from('trek_plans').select('*').eq('id', planId).maybeSingle(),
    admin.from('trek_plan_requests').select('status, message, decided_at')
      .eq('plan_id', planId).eq('user_id', user.id).maybeSingle(),
    session.from('trek_plan_details').select('meeting_point, logistics').eq('plan_id', planId).maybeSingle(),
  ])

  if (!plan) return null
  const p = plan as TrekPlanRow
  const isHost = p.host_id === user.id

  // The host needs the roster to decide. Nobody else gets a list of who else
  // asked — that would turn the board into a directory of people to approach.
  const { data: roster } = isHost
    ? await admin.from('trek_plan_requests')
        .select('user_id, display_name, status, message, created_at')
        .eq('plan_id', planId)
        .in('status', ['requested', 'confirmed'])
        .order('created_at')
    : { data: null }

  const [labelled] = await withKindLabels([p as TrekPlanRow])

  return {
    plan: labelled as TrekPlanRow,
    isHost,
    myStatus: (mine?.status as string) ?? null,
    meetingPoint: (details?.meeting_point as string) ?? null,
    logistics: (details?.logistics as string) ?? null,
    roster: roster ?? [],
    viewerId: user.id,
  }
}

type RpcResult = { error: string } | { success: true }

async function callTrek(fn: string, args: Record<string, unknown>, paths: string[]): Promise<RpcResult> {
  const { error } = await createAdminSupabaseClient().rpc(fn, args)
  if (error) {
    // The RPCs raise messages written to be read by a person — "this plan is not
    // taking anyone", "this is your own plan" — so they are passed through
    // rather than flattened into "something went wrong".
    return { error: error.message }
  }
  for (const p of paths) revalidatePath(p)
  return { success: true }
}

/**
 * The kinds of outing the board is currently taking.
 *
 * Read from the database rather than from lib/trek.ts, because since 057 the
 * kinds ARE data — an admin can add one or switch one off without a deploy,
 * and a composer built from a hardcoded list would quietly disagree with what
 * the database will accept.
 */
export type TrekKind = {
  key: string
  label: string
  blurb: string
  dayPart: 'day' | 'evening' | 'overnight'
  startMin: string
  startMax: string
  defaultStart: string
  defaultBackBy: string
  endsNextDay: boolean
  minParty: number
  needsNightNote: boolean
  isOpenEnded: boolean
}

export async function getTrekKinds(): Promise<TrekKind[]> {
  const { data } = await createAdminSupabaseClient()
    .from('trek_activity_kinds')
    .select('*')
    .eq('active', true)
    .order('sort')

  return (data ?? []).map((k) => ({
    key: k.key,
    label: k.label,
    blurb: k.blurb,
    dayPart: k.day_part,
    startMin: (k.start_min as string).slice(0, 5),
    startMax: (k.start_max as string).slice(0, 5),
    defaultStart: (k.default_start as string).slice(0, 5),
    defaultBackBy: (k.default_back_by as string).slice(0, 5),
    endsNextDay: k.ends_next_day,
    minParty: k.min_party,
    needsNightNote: k.needs_night_note,
    isOpenEnded: k.is_open_ended,
  }))
}

/**
 * The guidance that applies right now.
 *
 * `activity` narrows to one kind plus the general notes; `audience` is filtered
 * to what the viewer actually is, so a first-timer's page is not also carrying
 * the host advice. Women-audience notes are shown to everyone on a women-only
 * walk and to women elsewhere — a man reading how a woman decides whether a
 * group is safe is not a leak, it is the point.
 */
export type Guidance = {
  id: string
  activity: string
  audience: 'all' | 'women' | 'first_time' | 'host'
  title: string
  body: string
}

export async function getGuidance(opts?: {
  activity?: string
  audiences?: ('all' | 'women' | 'first_time' | 'host')[]
  limit?: number
}): Promise<Guidance[]> {
  let q = createAdminSupabaseClient()
    .from('trek_guidance')
    .select('id, activity, audience, title, body')
    .eq('active', true)
    .order('sort')
    .limit(opts?.limit ?? 40)

  if (opts?.activity) q = q.in('activity', [opts.activity, 'general'])
  if (opts?.audiences?.length) q = q.in('audience', opts.audiences)

  const { data } = await q
  return (data ?? []) as Guidance[]
}

export async function createTrekPlan(input: {
  /** A kind key. The database owns the list (057), so this is not a union. */
  activity: string
  place: string
  meetArea: string
  startsOn: string
  endsOn?: string
  startTime?: string
  backBy?: string
  capacity: number
  meetingPoint: string
  difficulty?: 'easy' | 'moderate' | 'difficult'
  note?: string
  logistics?: string
  nightNote?: string
  womenOnly?: boolean
  seniorFriendly?: boolean
  languages?: string[]
  coverUrls?: string[]
  /** Only when activity is 'other' — the name the host gave it. */
  activityOther?: string
}) {
  const user = await requireAuth()
  const result = await callTrek('trek_create_plan', {
    p_activity: input.activity,
    p_place: input.place,
    p_meet_area: input.meetArea,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn || input.startsOn,
    p_capacity: input.capacity,
    p_meeting_point: input.meetingPoint,
    p_difficulty: input.difficulty ?? 'moderate',
    // Optional now: on a six-day trek nobody should invent a return time for
    // day six, and the database fills the ordering instants itself.
    p_start_time: input.startTime || null,
    p_back_by: input.backBy || null,
    p_note: input.note || null,
    p_logistics: input.logistics || null,
    p_night_note: input.nightNote || null,
    p_women_only: input.womenOnly ?? false,
    p_senior_friendly: input.seniorFriendly ?? false,
    p_languages: input.languages ?? [],
    p_cover_urls: input.coverUrls ?? [],
    p_activity_other: input.activityOther?.trim() || null,
    p_actor: user.id,
  }, ['/trek-buddy'])

  if ('success' in result) {
    // The owner's moderation presence, at zero build cost. Nobody is on report
    // duty, so the least this can do is tell them a walk was posted.
    await sendSlackAlert(
      `:mountain: Trek Buddy plan posted — ${input.activity} at ${input.place}, ` +
      `${input.startsOn} ${input.startTime}, capacity ${input.capacity}`
    ).catch(() => {})
  }
  return result
}

export async function requestToJoin(planId: string, message?: string) {
  const user = await requireAuth()
  const result = await callTrek('trek_request_join', {
    p_plan_id: planId, p_message: message || null, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
  if ('success' in result) {
    await sendSlackAlert(`:raising_hand: Trek Buddy: someone asked to join plan ${planId}`).catch(() => {})
  }
  return result
}

export async function decideRequest(planId: string, userId: string, decision: 'confirmed' | 'declined') {
  const user = await requireAuth()
  return callTrek('trek_decide_request', {
    p_plan_id: planId, p_user_id: userId, p_decision: decision, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
}

export async function withdrawRequest(planId: string) {
  const user = await requireAuth()
  return callTrek('trek_withdraw_request', {
    p_plan_id: planId, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
}

export async function cancelPlan(planId: string, reason?: string) {
  const user = await requireAuth()
  const result = await callTrek('trek_cancel_plan', {
    p_plan_id: planId, p_reason: reason || null, p_actor: user.id,
  }, ['/trek-buddy', `/trek-buddy/${planId}`])
  if ('success' in result) {
    await sendSlackAlert(`:x: Trek Buddy plan cancelled: ${planId}${reason ? ` — ${reason}` : ''}`).catch(() => {})
  }
  return result
}

// ── People ───────────────────────────────────────────────────────────────────

export type PersonCard = {
  userId: string
  displayName: string
  homeBase: string | null
  intro: string | null
  pace: string | null
  activities: string[]
  languages: string[]
  memberSince: string | null
  canHost: boolean
  /** Granted by an admin, never claimed. */
  mentor: boolean
  mentorBio: string | null
  /** Self-declared, and labelled as such wherever it is shown. */
  experience: string | null
  yearsOut: number | null
  highestM: number | null
  usualDays: string[]
  carries: string[]
  /** The four facts. Each says exactly what it proves — see migration 054. */
  emailOk: boolean
  isCustomer: boolean
  walksHosted: number
  walksJoined: number
  vouches: number
}

/** One person, as everybody else sees them. */
export async function getPerson(userId: string): Promise<PersonCard | null> {
  const viewer = await getUser()
  if (!viewer) return null

  const { data } = await createAdminSupabaseClient().rpc('trek_person_card', { p_user: userId })
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!r?.display_name) return null

  return {
    userId,
    displayName: r.display_name as string,
    homeBase: (r.home_base as string) ?? null,
    intro: (r.intro as string) ?? null,
    pace: (r.pace as string) ?? null,
    activities: (r.activities as string[]) ?? [],
    languages: (r.languages as string[]) ?? [],
    memberSince: (r.member_since as string) ?? null,
    canHost: Boolean(r.can_host),
    mentor: Boolean(r.mentor),
    mentorBio: (r.mentor_bio as string) ?? null,
    experience: (r.experience as string) ?? null,
    yearsOut: r.years_out == null ? null : Number(r.years_out),
    highestM: r.highest_m == null ? null : Number(r.highest_m),
    usualDays: (r.usual_days as string[]) ?? [],
    carries: (r.carries as string[]) ?? [],
    emailOk: Boolean(r.email_ok),
    isCustomer: Boolean(r.is_customer),
    walksHosted: Number(r.walks_hosted ?? 0),
    walksJoined: Number(r.walks_joined ?? 0),
    vouches: Number(r.vouches ?? 0),
  }
}

/**
 * You, for the header on every Trek Buddy page.
 *
 * A profile nobody can find is a profile nobody fills in, and a board of empty
 * profiles is a board nobody trusts — so this exists to put the viewer's own
 * presence in front of them, with the one thing that actually moves the
 * behaviour: what is still missing, named.
 *
 * Completeness counts the seven fields another walker actually reads when
 * deciding whether to spend a day with you. Not every column — a percentage
 * that rises for filling in something nobody looks at is a scoreboard, not a
 * prompt.
 */
// ── The inbox ────────────────────────────────────────────────────────────────

export type TrekNotification = {
  id: string
  kind: string
  body: string
  planId: string | null
  createdAt: string
  read: boolean
}

/**
 * What has happened to you since you last looked.
 *
 * Bodies are read straight off the row rather than assembled here — they were
 * written at the moment the thing happened (060), so a walk that has since been
 * cancelled or a host who has since been suspended still reads correctly
 * instead of the past quietly changing.
 */
export async function getNotifications(limit = 30) {
  const user = await getUser()
  if (!user) return { items: [] as TrekNotification[], unread: 0 }

  const db = createAdminSupabaseClient()
  const [{ data }, { count }] = await Promise.all([
    db.from('trek_notifications')
      .select('id, kind, body, plan_id, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('trek_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  return {
    items: (data ?? []).map((n): TrekNotification => ({
      id: n.id as string,
      kind: n.kind as string,
      body: n.body as string,
      planId: (n.plan_id as string) ?? null,
      createdAt: n.created_at as string,
      read: Boolean(n.read_at),
    })),
    unread: count ?? 0,
  }
}

/** Just the badge. Cheap enough to run in the header of every page. */
export async function getUnreadCount() {
  const user = await getUser()
  if (!user) return 0
  const { count } = await createAdminSupabaseClient()
    .from('trek_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
  return count ?? 0
}

export async function markNotificationsRead() {
  const user = await requireAuth()
  const { error } = await createAdminSupabaseClient()
    .rpc('trek_mark_notifications_read', { p_actor: user.id })
  if (error) return { error: error.message }
  revalidatePath('/trek-buddy/yours')
  revalidatePath('/trek-buddy')
  return { success: true as const }
}

export type MyTrekCard = {
  userId: string
  displayName: string
  homeBase: string | null
  mentor: boolean
  canHost: boolean
  experience: string | null
  yearsOut: number | null
  walksHosted: number
  walksJoined: number
  vouches: number
  done: number
  total: number
  nextUp: { field: string; prompt: string } | null
}

export async function getMyTrekCard(): Promise<MyTrekCard | null> {
  const user = await getUser()
  if (!user) return null
  const me = await getPerson(user.id)
  if (!me) return null

  // Ordered by how much each one tells a stranger, so the prompt always names
  // the most useful missing thing rather than the first one alphabetically.
  const checks: { field: string; filled: boolean; prompt: string }[] = [
    { field: 'Activities', filled: me.activities.length > 0,
      prompt: 'Say what you actually go out for' },
    { field: 'Home base', filled: Boolean(me.homeBase),
      prompt: 'Add the town you set off from' },
    { field: 'Pace', filled: Boolean(me.pace),
      prompt: 'Say how fast you walk — somebody will plan their day around it' },
    { field: 'Intro', filled: Boolean(me.intro),
      prompt: 'Write a line about yourself' },
    { field: 'Experience', filled: Boolean(me.experience),
      prompt: 'Say how much of this you have done' },
    { field: 'Kit', filled: me.carries.length > 0,
      prompt: 'List what you carry — the most useful thing on a profile' },
    { field: 'Languages', filled: me.languages.length > 0,
      prompt: 'Add the languages you speak' },
  ]
  const missing = checks.find((c) => !c.filled)

  return {
    userId: me.userId,
    displayName: me.displayName,
    homeBase: me.homeBase,
    mentor: me.mentor,
    canHost: me.canHost,
    experience: me.experience,
    yearsOut: me.yearsOut,
    walksHosted: me.walksHosted,
    walksJoined: me.walksJoined,
    vouches: me.vouches,
    done: checks.filter((c) => c.filled).length,
    total: checks.length,
    nextUp: missing ? { field: missing.field, prompt: missing.prompt } : null,
  }
}

export type PersonSummary = {
  userId: string
  displayName: string
  homeBase: string | null
  intro: string | null
  pace: string | null
  activities: string[]
  languages: string[]
  experience: string | null
  yearsOut: number | null
  mentor: boolean
  canHost: boolean
  memberSince: string | null
  walksHosted: number
  walksJoined: number
  vouches: number
}

/**
 * Everyone on the board. Not a user directory — only people who finished
 * joining, and never anybody suspended.
 *
 * `walks` used to be read off `r.walks`, a field trek_people has never
 * returned, so every card in the directory said 0 walks no matter who it was.
 * The RPC returns hosted and joined separately and both are carried now.
 */
export async function getPeople(opts?: { activity?: string; homeBase?: string; limit?: number }) {
  const viewer = await getUser()
  if (!viewer) return []
  const { data } = await createAdminSupabaseClient().rpc('trek_people', {
    p_activity: opts?.activity ?? null,
    p_home: opts?.homeBase ?? null,
    p_limit: opts?.limit ?? 60,
  })
  return ((data ?? []) as Record<string, unknown>[]).map((r): PersonSummary => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    homeBase: (r.home_base as string) ?? null,
    intro: (r.intro as string) ?? null,
    pace: (r.pace as string) ?? null,
    activities: (r.activities as string[]) ?? [],
    languages: (r.languages as string[]) ?? [],
    experience: (r.experience as string) ?? null,
    yearsOut: r.years_out == null ? null : Number(r.years_out),
    mentor: Boolean(r.mentor),
    canHost: Boolean(r.can_host),
    memberSince: (r.member_since as string) ?? null,
    walksHosted: Number(r.walks_hosted ?? 0),
    walksJoined: Number(r.walks_joined ?? 0),
    vouches: Number(r.vouches ?? 0),
  }))
}

/**
 * Update how you appear to other people.
 *
 * The intro is checked by a CHECK constraint that refuses phone numbers, emails
 * and handles — the safety model depends on contact details not travelling
 * through this product, and an intro box is exactly where somebody will paste
 * one. The database's message is passed through so the person is told what is
 * actually wrong rather than "invalid".
 */
export async function saveTrekPerson(input: {
  displayName: string
  homeBase?: string
  intro?: string
  pace?: string
  activities: string[]
  languages: string[]
  experience?: string
  yearsOut?: number | null
  highestM?: number | null
  usualDays?: string[]
  carries?: string[]
  gender?: string
}) {
  const user = await requireAuth()

  const name = input.displayName.trim()
  if (name.length < 2 || name.length > 40) {
    return { error: 'Your name needs to be between 2 and 40 characters.' }
  }

  const { error } = await createAdminSupabaseClient()
    .from('profiles')
    .update({
      trek_display_name: name,
      trek_home_base: input.homeBase?.trim() || null,
      trek_intro: input.intro?.trim() || null,
      trek_pace: input.pace || null,
      trek_activities: input.activities,
      trek_languages: input.languages,
      trek_experience: input.experience || null,
      trek_years_out: input.yearsOut ?? null,
      trek_highest_m: input.highestM ?? null,
      trek_usual_days: input.usualDays ?? [],
      trek_carries: input.carries ?? [],
      // Only ever set, never cleared by a save: it gates women-only walks, and
      // a profile edit that silently dropped it would lock somebody out of
      // their own trips.
      ...(input.gender ? { trek_gender: input.gender } : {}),
    })
    .eq('id', user.id)

  if (error) {
    if (error.message.includes('no_contact')) {
      return {
        error:
          'Take the phone number, email or handle out of your intro. Trek Buddy does not pass contact details between people — that is the point of it.',
      }
    }
    if (error.message.includes('intro_len')) {
      return { error: 'Your intro needs to be between 10 and 280 characters.' }
    }
    return { error: error.message }
  }

  revalidatePath('/trek-buddy/profile')
  revalidatePath(`/trek-buddy/people/${user.id}`)
  return { success: true as const }
}

/** People you were on a past walk with, and whether you have vouched yet. */
export async function getVouchable() {
  const user = await getUser()
  if (!user) return []
  const admin = createAdminSupabaseClient()

  const { data: past } = await admin
    .from('trek_plans')
    .select('id, place, starts_at, host_id, host_name')
    .lt('starts_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: false })
    .limit(20)

  if (!past?.length) return []
  const ids = past.map((p) => p.id)

  const [{ data: rosters }, { data: mine }] = await Promise.all([
    admin.from('trek_plan_requests').select('plan_id, user_id, display_name')
      .in('plan_id', ids).eq('status', 'confirmed'),
    admin.from('trek_vouches').select('vouchee_id').eq('voucher_id', user.id),
  ])

  const vouched = new Set((mine ?? []).map((v) => v.vouchee_id as string))

  return past.flatMap((plan) => {
    const party = (rosters ?? []).filter((r) => r.plan_id === plan.id)
    const iWasThere = plan.host_id === user.id || party.some((r) => r.user_id === user.id)
    if (!iWasThere) return []

    const others = [
      ...(plan.host_id !== user.id ? [{ user_id: plan.host_id as string, display_name: plan.host_name as string }] : []),
      ...party.filter((r) => r.user_id !== user.id).map((r) => ({ user_id: r.user_id as string, display_name: r.display_name as string })),
    ]
    if (!others.length) return []
    return [{
      planId: plan.id as string,
      place: plan.place as string,
      when: plan.starts_at as string,
      people: others.map((o) => ({ ...o, vouched: vouched.has(o.user_id) })),
    }]
  })
}

export async function vouchFor(planId: string, forUserId: string) {
  const user = await requireAuth()
  return callTrek('trek_vouch', {
    p_plan_id: planId, p_for: forUserId, p_actor: user.id,
  }, ['/trek-buddy/profile', `/trek-buddy/people/${forUserId}`])
}


/** Report a trek or a person. Lands in trek_reports for a human to read. */
export async function reportTrek(input: {
  reason: 'unsafe' | 'harassment' | 'spam' | 'impersonation' | 'not_real' | 'other'
  detail?: string
  planId?: string
  subjectId?: string
}) {
  const user = await requireAuth()
  const result = await callTrek('trek_report', {
    p_reason: input.reason,
    p_detail: input.detail || null,
    p_plan_id: input.planId || null,
    p_subject_id: input.subjectId || null,
    p_actor: user.id,
  }, ['/trek-buddy'])

  if ('success' in result) {
    // Until somebody is named to own the queue, Slack IS the queue.
    await sendSlackAlert(
      `:rotating_light: Trek Buddy report — ${input.reason}` +
      (input.planId ? ` on plan ${input.planId}` : '') +
      (input.subjectId ? ` about member ${input.subjectId}` : '') +
      (input.detail ? `\n${input.detail}` : '')
    ).catch(() => {})
  }
  return result
}

/** Block somebody. Applies in both directions on any join. */
export async function blockMember(userId: string) {
  const user = await requireAuth()
  return callTrek('trek_block', { p_blocked: userId, p_actor: user.id },
    ['/trek-buddy', `/trek-buddy/people/${userId}`])
}
