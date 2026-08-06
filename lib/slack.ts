// Ops alerting had no channel at all before this — an admin only found out
// about a failed refund, a failed payment, or stock crossing zero by having
// the dashboard open and noticing. A single incoming-webhook URL is the
// lowest-friction way to close that gap without standing up new infra.
// No-ops silently when SLACK_WEBHOOK_URL isn't set, same lazy-init pattern as
// getStripe()/getResend() — importing this file must never crash a route
// that happens not to need it configured.
export async function sendSlackAlert(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    // Best-effort — a Slack outage should never break the order/payment flow it's reporting on.
  }
}
