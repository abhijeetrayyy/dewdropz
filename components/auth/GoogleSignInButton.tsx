import { signInWithGoogle } from '@/actions/auth'

// Calls the existing signInWithProvider('google') server action (actions/auth.ts),
// which already builds the Supabase OAuth URL and redirects — that part was
// written but never wired to any button anywhere in the app. This is the
// button. It still won't actually authenticate until the Google provider is
// turned on in the Supabase dashboard with a real Client ID/Secret — that's
// a dashboard step, not something a code change can do.
//
// Rendered as a <form action> (not onClick) so the redirect() the server
// action performs on success is handled the way Next.js expects, and the
// button still works with JS disabled.
export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-3 border border-rule bg-paper text-text font-body text-xs tracking-[0.1em] uppercase py-3.5 rounded-sm hover:border-forest hover:text-forest transition-colors duration-300"
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="flex-shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  )
}
