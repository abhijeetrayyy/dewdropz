// Reproducible evidence for the GSTIN check-character implementation.
//
// There is no test runner in this app, and the claim in lib/gstin.ts should not
// rest on a comment. Run it with:  node scripts/verify-gstin.mjs
//
// The check character rests on an algorithm reconstructed from public
// documentation rather than from a statutory spec, which is exactly why
// validateGstin lets the owner override a checksum failure. What can be shown
// without a corpus of real GSTINs is shown here: the canonical published
// example validates, and the algorithm has the error-detection properties a
// mod-36 check digit is supposed to have.

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function checkChar(first14) {
  let total = 0
  for (let i = 0; i < 14; i++) {
    const product = ALPHABET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2)
    total += Math.floor(product / 36) + (product % 36)
  }
  return ALPHABET[(36 - (total % 36)) % 36]
}

// The most widely published example GSTIN. One trustworthy vector beats five
// half-remembered ones — an earlier pass at this "verified" against invented
// numbers and proved nothing.
const CANONICAL = '27AAPFU0939F1ZV'

let failures = 0
const ok = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
}

ok(`${CANONICAL} validates`, checkChar(CANONICAL.slice(0, 14)) === CANONICAL[14])

let caught = 0
let tried = 0
for (let i = 0; i < 14; i++) {
  for (const c of ALPHABET) {
    if (c === CANONICAL[i]) continue
    const cand = CANONICAL.slice(0, i) + c + CANONICAL.slice(i + 1)
    tried++
    if (checkChar(cand.slice(0, 14)) !== cand[14]) caught++
  }
}
ok(`every single-character substitution rejected (${caught}/${tried})`, caught === tried)

let tCaught = 0
let tTried = 0
for (let i = 0; i < 13; i++) {
  if (CANONICAL[i] === CANONICAL[i + 1]) continue
  const cand =
    CANONICAL.slice(0, i) + CANONICAL[i + 1] + CANONICAL[i] + CANONICAL.slice(i + 2)
  tTried++
  if (checkChar(cand.slice(0, 14)) !== cand[14]) tCaught++
}
ok(`every adjacent transposition rejected (${tCaught}/${tTried})`, tCaught === tTried)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
