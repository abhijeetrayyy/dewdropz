#!/usr/bin/env node
/**
 * Run migration 103's fixture without a database.
 *
 * The migration verifies itself when it is applied — the DO block at the bottom
 * raises and rolls the whole thing back if an assertion fails. That is the
 * check that counts, and it is the one that runs against the real `trek_scan`.
 *
 * This is the check you can run BEFORE you get there: it parses the rules and
 * the fixture out of the migration file itself, ports 056's three text
 * functions, and tells you in a second whether a rule you just added turns away
 * a legitimate trip post. It reads the .sql rather than carrying its own copy of
 * the rules, so the two cannot drift.
 *
 *   node scripts/check-trek-word-rules.mjs
 *
 * Exits non-zero on any failure, so it can gate a commit.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'supabase/migrations/103_trek_word_rules_seed.sql'), 'utf8')

// ── 056's text functions, ported ────────────────────────────────────────────
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ'
const PLAIN    = 'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
const unaccent = (t) => [...(t ?? '')].map((c) => {
  const i = ACCENTED.indexOf(c)
  return i === -1 ? c : PLAIN[i]
}).join('')

const squeeze = (t) => unaccent((t ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, '')

// translate(squeeze, '01345$@', 'oleasa') — '@' has no counterpart in the target
// string, and Postgres's translate() DELETES a character in that position. That
// asymmetry is easy to miss and it is why '@' vanishes rather than becoming 'a'.
const FOLD = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', $: 'a', '@': '' }
const fold = (t) => [...squeeze(t)].map((c) => (c in FOLD ? FOLD[c] : c)).join('')

// ── Pull the rules and the fixture out of the migration ─────────────────────
function parseRules() {
  const block = sql.slice(sql.indexOf(') AS v(pattern') === -1 ? 0 : 0, sql.indexOf(') AS v(pattern'))
  const rows = [...block.matchAll(
    /\(\s*('(?:[^']|'')*')\s*,\s*'(word|regex)'\s*,\s*'(block|flag)'\s*,\s*'([a-z]+)'/g
  )]
  return rows.map(([, pat, kind, action, category]) => ({
    pattern: pat.slice(1, -1).replace(/''/g, "'"),
    kind, action, category,
  }))
}

function parseFixture(name) {
  const m = sql.match(new RegExp(`${name}\\s+TEXT\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`))
  if (!m) throw new Error(`fixture ${name} not found in the migration`)
  return [...m[1].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'"))
}

const rules = parseRules()
const mustPass = parseFixture('must_pass')
const mustBlock = parseFixture('must_block')

// ── trek_scan, ported ───────────────────────────────────────────────────────
function scan(text) {
  const hits = []
  for (const r of rules) {
    let hit
    if (r.kind === 'word') {
      hit = (text ?? '').toLowerCase().includes(r.pattern.toLowerCase())
        || squeeze(text).includes(squeeze(r.pattern))
        || fold(text).includes(fold(r.pattern))
    } else {
      // Postgres POSIX ARE vs JS RegExp: the patterns here use only shared
      // syntax. [[:alnum:]] is the one class that differs, so it is mapped.
      const js = r.pattern.replace(/\[\[:alnum:\]/g, '[a-z0-9').replace(/\[:alnum:\]/g, 'a-z0-9')
      const re = new RegExp(js, 'i')
      hit = re.test(text ?? '') || re.test(squeeze(text))
    }
    if (hit) hits.push(r)
  }
  return hits
}

const blocks = (t) => scan(t).filter((r) => r.action === 'block')

// ── The rule-shape guardrails from the migration's own header ───────────────
const shapeProblems = []
for (const r of rules) {
  if (r.kind !== 'word') continue
  const isPhrase = r.pattern.includes(' ')
  if (!isPhrase && r.pattern.length < 8) {
    shapeProblems.push(
      `literal "${r.pattern}" is ${r.pattern.length} characters and not a phrase — ` +
      `squeezing removes word boundaries, so short literals match inside ordinary words ` +
      `("insta" matches "instant noodles")`
    )
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
let failures = 0
const say = (ok, line) => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${line}`) }

console.log(`\n${rules.length} rules parsed from migration 103 ` +
            `(${rules.filter(r => r.action === 'block').length} block, ` +
            `${rules.filter(r => r.action === 'flag').length} flag)\n`)

console.log('MUST PASS — legitimate trip text')
for (const t of mustPass) {
  const b = blocks(t)
  say(b.length === 0, b.length ? `${t}\n      blocked by: ${b.map(r => r.pattern).join(', ')}` : t)
}

console.log('\nMUST BLOCK — contact details')
for (const t of mustBlock) {
  const b = blocks(t)
  say(b.length > 0, b.length ? `${t}` : `${t}   ← GOT THROUGH`)
}

if (shapeProblems.length) {
  console.log('\nRULE SHAPE')
  for (const p of shapeProblems) say(false, p)
}

console.log(
  failures === 0
    ? `\nAll ${mustPass.length + mustBlock.length} assertions held.\n`
    : `\n${failures} failure(s). Fix the rule, not the fixture.\n`
)
process.exit(failures === 0 ? 0 : 1)
