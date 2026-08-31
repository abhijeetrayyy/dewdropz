-- ── Two columns the rental money model was missing ──────────────────────────
--
-- 1 · deposit_order_id
--
-- `verifyRentalPayment` binds a callback to a booking by comparing the gateway
-- order id the caller sent against the one WE created and stored, and says why:
--
--     "The stored order id, not the one in the callback. A caller who could
--      nominate both sides of this comparison would be checking their own work."
--
-- `verifyDepositPayment` could not do that, because `startDepositPayment`
-- created the order and threw the id away — there was no column to keep it in.
-- So it verified the Razorpay signature against the order id the CALLER
-- supplied. A Razorpay signature is HMAC(order_id|payment_id): it proves that
-- *a* payment happened on this merchant account, not *which*. Any valid triple
-- the caller already held — from their own ₹1 purchase, or from the rent they
-- had just legitimately paid — marked a ₹9,000 security deposit `held`.
--
-- Worse than an unsecured hire: replaying the RENT triple set
-- `deposit_payment_id` to the rent payment, and `refundRentalDeposit` would
-- later refund the never-lodged deposit OUT OF the rent. Money leaving.
--
-- 2 · deposit_taken
--
-- The counter deposit is cash, and the amount was never recorded anywhere.
-- `handOverBooking` took `depositTaken` as an argument, wrote `deposit_state`
-- from whether it was > 0, and dropped the number. So a ₹5,000 cash deposit
-- against a ₹9,000 booking settled at return against ₹9,000.
--
-- Both are nullable: every existing row predates them and no code path requires
-- them to be set.

ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS deposit_order_id TEXT;
ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS deposit_taken INT
  CHECK (deposit_taken IS NULL OR deposit_taken >= 0);

COMMENT ON COLUMN rental_bookings.deposit_order_id IS
  'The gateway order created for the DEPOSIT. verifyDepositPayment compares the callback against this; without it the signature proved a payment existed but not which one.';
COMMENT ON COLUMN rental_bookings.deposit_taken IS
  'What was actually lodged, in paise. Differs from deposit_amount when an operator takes a part deposit at the counter; settlement refunds against this.';

-- A cash rental has to be able to become paid. `payment_method` already admits
-- 'cod'; nothing ever moved such a booking to 'paid', so no invoice was ever
-- issued for the only trade this shop currently does.
COMMENT ON COLUMN rental_bookings.payment_status IS
  'unpaid | pending | paid | refunded. Written by verifyRentalPayment for gateway money and by recordCounterPayment for cash.';
