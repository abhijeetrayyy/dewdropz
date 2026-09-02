#!/usr/bin/env node
/**
 * Pre-flight for migration 103's fixture, without a database.
 *
 * WHAT THIS IS NOT
 *
 * It is not the check that counts. The migration verifies itself when applied:
 * the DO block at its foot runs against the real `trek_scan` and raises,
 * rolling the whole thing back, if a legitimate sentence is refused or a
 * contact detail gets through. Postgres is the authority; this file is not.
 *
 * WHY IT CANNOT BE THE AUTHORITY
 *
 * The live rule set is POSIX ERE — `[[:space:]]`, `[[:alnum:]]`, and bracket
 * expressions like `[])]` that put `]` first, which is legal in POSIX and a
 * syntax error in JavaScript. The common classes are translated below; anything
 * that still will not compile is SKIPPED AND COUNTED, never silently treated as
 * a rule that failed to match. That is why "this string was not blocked" cannot
 * be reported as a failure here — the rule that would have blocked it may be
 * one of the skipped ones.
 *
 * WHAT IT IS FOR
 *
 * Two things it does faithfully, and they are how a bad rule actually ships:
 *
 *   1. Every `word` rule, exactly. Those are substring matches over the raw,
 *      squeezed and folded text, and 056's fold is ported here.
 *   2. The shape guardrails. A literal under 8 characters that is not a phrase
 *      matches inside ordinary words once squeezing removes the boundaries —
 *      "insta" inside "instant noodles" — and catching that in a second beats
 *      catching it in a rollback.
 *
 *   node scripts/check-trek-word-rules.mjs
 *
 * Exits non-zero only on something it can actually prove wrong.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'supabase/migrations/103_trek_word_rules_seed.sql'), 'utf8')

// ── 056's three text functions, ported ──────────────────────────────────────
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ'
const PLAIN    = 'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
const unaccent = (t) => [...(t ?? '')].map((c) => {
  const i = ACCENTED.indexOf(c); return i === -1 ? c : PLAIN[i]
}).join('')
const squeeze = (t) => unaccent((t ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, '')
// translate(squeeze, '01345$@', 'oleasa') — '@' has no counterpart in the target
// string and Postgres's translate() DELETES a character in that position. That
// asymmetry is easy to miss, and it is why '@' vanishes rather than becoming 'a'.
const FOLD = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', $: 'a', '@': '' }
const fold = (t) => [...squeeze(t)].map((c) => (c in FOLD ? FOLD[c] : c)).join('')

// ── POSIX ERE → JS RegExp, for the subset that survives the trip ────────────
const POSIX = {
  '[:alnum:]': 'a-zA-Z0-9', '[:alpha:]': 'a-zA-Z', '[:digit:]': '0-9',
  '[:space:]': ' \\t\\r\\n\\f\\v', '[:upper:]': 'A-Z', '[:lower:]': 'a-z',
  '[:word:]': 'A-Za-z0-9_', '[:punct:]': '!-\\/:-@\\[-`{-~',
}
const cache = new Map()
function toJs(pattern) {
  if (cache.has(pattern)) return cache.get(pattern)
  let src = pattern
  for (const [p, cls] of Object.entries(POSIX)) src = src.split(p).join(cls)
  let re = null
  try { re = new RegExp(src, 'i') } catch { re = null }
  cache.set(pattern, re)
  return re
}
/** Patterns this dialect cannot represent. Reported, never ignored. */
const skipped = new Set()

// ── Pull the rules and the fixture out of the migration itself ─────────────
const rules = [...sql.matchAll(
  /^\s*\('((?:[^']|'')*)',\s*'(word|regex)',\s*'(block|flag)',\s*'([a-z]+)'/gm
)].map(([, pattern, kind, action, category]) => ({
  pattern: pattern.replace(/''/g, "'"), kind, action, category,
}))

function fixture(name) {
  const m = sql.match(new RegExp(`${name}\\s+TEXT\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`))
  return m ? [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'")) : []
}
const mustPass = fixture('must_pass'), mustBlock = fixture('must_block'), mustFlag = fixture('must_flag')

// ── trek_scan, ported ───────────────────────────────────────────────────────
function scan(text) {
  const hits = []
  for (const r of rules) {
    let hit = false
    if (r.kind === 'word') {
      hit = (text ?? '').toLowerCase().includes(r.pattern.toLowerCase())
        || squeeze(text).includes(squeeze(r.pattern))
        || fold(text).includes(fold(r.pattern))
    } else {
      const re = toJs(r.pattern)
      if (!re) { skipped.add(r.pattern); continue }
      hit = re.test(text ?? '') || re.test(squeeze(text))
    }
    if (hit) hits.push(r)
  }
  return hits
}
const blocks = (t) => scan(t).filter((r) => r.action === 'block')

// ── Shape guardrails ────────────────────────────────────────────────────────
const shape = []
for (const r of rules) {
  if (r.kind !== 'word') continue
  if (!r.pattern.includes(' ') && r.pattern.length < 8) {
    shape.push(`literal "${r.pattern}" is ${r.pattern.length} characters and not a phrase — `
      + `squeezing removes word boundaries, so short literals match inside ordinary words`)
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
let failures = 0
const say = (ok, line) => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${line}`) }

// Warm the skip set before reporting counts.
for (const t of [...mustPass, ...mustBlock, ...mustFlag]) scan(t)

console.log(`\n${rules.length} rules in migration 103 — `
  + `${rules.filter(r => r.action === 'block').length} block, ${rules.filter(r => r.action === 'flag').length} flag, `
  + `${rules.filter(r => r.kind === 'word').length} word`)
console.log(`${rules.length - skipped.size} checkable here, ${skipped.size} POSIX-only\n`)

console.log('MUST PASS — legitimate trip text (a failure here is a real, provable defect)')
for (const t of mustPass) {
  const b = blocks(t)
  say(b.length === 0, b.length ? `${t}\n      blocked by: ${b.map(r => r.pattern.slice(0, 40)).join(', ')}` : t)
}

console.log('\nMUST BLOCK — contact details')
for (const t of mustBlock) {
  if (blocks(t).length) say(true, t)
  else console.log(`  – ${t}   (not provable here — the matching rule is POSIX-only)`)
}

console.log('\nMUST FLAG — evasion spellings the word rules exist to catch')
for (const t of mustFlag) {
  if (scan(t).length) say(true, t)
  else console.log(`  – ${t}   (not provable here — the matching rule is POSIX-only)`)
}

// Heuristic, so a warning and not a failure — it cannot tell "chutiya inside
// chutiyapa", which is the same word and correct, from "chudai inside chudail",
// which is a witch and is not. It points; a person decides.
if (shape.length) {
  console.log('\nRULE SHAPE — warnings, check each by hand')
  for (const p of shape) console.log(`  ! ${p}`)
}

console.log(
  failures === 0
    ? `\nNothing provably wrong. ${mustPass.length} legitimate sentences pass all `
      + `${rules.length - skipped.size} rules checkable here.\n`
      + `The ${skipped.size} POSIX-only rules are checked for real by the DO block inside the migration, on apply.\n`
    : `\n${failures} provable failure(s). Fix the rule, never the fixture.\n`
)
process.exit(failures === 0 ? 0 : 1)
