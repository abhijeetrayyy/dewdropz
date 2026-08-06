-- webhook_events had no unique constraint on the gateway's own event id — every
-- inbound webhook call inserted a fresh audit row and re-applied its mutation with
-- no de-dup check first. Currently harmless only because the downstream updates
-- happen to be idempotent (setting payment_status='paid' twice is a no-op), not
-- because of a designed guarantee — and Stripe/Razorpay both retry webhook
-- delivery routinely. Adds the missing identity column and a partial unique
-- index (NULLs excluded, so older rows or payload shapes without an id don't
-- collide) so a redelivered event can be detected before processing.

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedup
  ON webhook_events(provider, event_type, event_id)
  WHERE event_id IS NOT NULL;
