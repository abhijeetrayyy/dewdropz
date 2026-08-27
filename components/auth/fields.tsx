/**
 * The auth form's parts, in one place.
 *
 * Login, signup and reset each drew their own inputs, their own error box and
 * their own submit button, and the three had already drifted: two different
 * error colours, two different button paddings, and a password hint on signup
 * that said "at least 6 characters" against a schema (lib/validations.ts) that
 * rejects anything under 8. Somebody typing a 7-character password was told it
 * was fine and then told it was not.
 *
 * These are shared so that cannot happen again, and PASSWORD_MIN is read from
 * the same number the hint prints.
 */

/** The rule lib/validations.ts actually enforces. The hint and the input's own
 *  minLength both read this, so the form cannot promise a length the server
 *  will refuse. */
export const PASSWORD_MIN = 8

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="block font-body text-[11px] font-medium uppercase tracking-[0.14em] text-forest"
      >
        {label}
      </label>
      <input
        {...props}
        className="mt-2 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-3 font-body text-sm text-ink transition-colors duration-200 placeholder:text-light focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />
      {hint && <p className="mt-2 font-body text-[11px] text-mid">{hint}</p>}
    </div>
  )
}

/**
 * The failure state. Reads as part of this brand rather than as a browser
 * default: clay, which is already the system's warm-warning hue, instead of
 * the raw `bg-red-100 text-red-700` the three forms each hardcoded.
 *
 * `role="alert"` so a screen reader is told the submit failed — none of the
 * three previous forms announced anything, so a blind user pressed Sign in,
 * heard nothing, and had no way to know why they were still on the page.
 */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--r-input)] border border-clay/40 bg-clay-wash px-3.5 py-3 font-body text-[13px] leading-relaxed text-clay-deep"
    >
      {children}
    </p>
  )
}

export function SubmitButton({
  loading,
  children,
  loadingLabel,
}: {
  loading: boolean
  children: React.ReactNode
  loadingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="min-h-[46px] w-full rounded-full bg-forest px-6 font-body text-[11px] font-medium uppercase tracking-[0.16em] text-paper transition-colors duration-300 hover:bg-forest-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-55"
    >
      {loading ? loadingLabel : children}
    </button>
  )
}

/** The "or" rule between the password form and the OAuth button. */
export function OrRule() {
  return (
    <div className="my-7 flex items-center gap-4">
      <span className="h-px flex-1 bg-rule" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-light">Or</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  )
}
