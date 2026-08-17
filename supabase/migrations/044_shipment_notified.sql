-- One shipped-email per parcel, not one per status step.
--
-- `updateShipmentStatus` now emails the customer when a parcel dispatches, but
-- DISPATCHED covers picked_up, in_transit, out_for_delivery and delivered — so
-- a parcel walked forward through its normal lifecycle would have mailed the
-- same person four times. `shipped_at` cannot serve as the guard: it is
-- rewritten on every one of those transitions.
--
-- A column rather than "check whether a job exists", because the job queue is
-- at-least-once by contract and is deliberately allowed to run a handler twice.

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

COMMENT ON COLUMN shipments.notified_at IS
  'When the customer was told this parcel shipped. Set once; guards re-notification.';
