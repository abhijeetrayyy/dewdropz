-- Find an order by the thing the customer actually gives you.
--
-- Admin search covered `order_number` and `email`. In India the "where is my
-- order" contact arrives as a WhatsApp message from a phone number, or a name —
-- and neither was searchable, on a query ENGINE.md §3 had already optimised to
-- 0.2ms. Fast, and unable to answer the question.
--
-- Two things make the phone case harder than adding a column to the OR:
--
-- 1. `orders.phone` IS NULL ON REAL ORDERS. Checked against production: both
--    orders have phone null, and the number lives in
--    `shipping_address->>'phone'` because that is where the checkout address
--    form puts it. Searching the column would have found nothing and looked
--    like the feature worked.
--
-- 2. The stored value is "08077688145" — a leading zero and eleven digits.
--    A customer messaging from "+91 8077688145", "918077688145" or
--    "8077688145" matches none of those as a substring.
--
-- So: normalise both sides to the last ten digits, which is the national number
-- however it was written, and match on that. A generated column rather than a
-- function in the WHERE clause, so it can be indexed and PostgREST can filter
-- on it directly.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (
    right(
      regexp_replace(coalesce(phone, shipping_address->>'phone', ''), '\D', '', 'g'),
      10
    )
  ) STORED;

COMMENT ON COLUMN orders.phone_digits IS
  'Last 10 digits of the order phone, from either column, for search. Generated — never write it.';

-- Exact-match lookups, so btree rather than trigram.
CREATE INDEX IF NOT EXISTS idx_orders_phone_digits
  ON orders(phone_digits)
  WHERE phone_digits <> '';

-- Names are partial-matched ("abhi"), so this one wants trigram, same as the
-- order_number and email indexes from 037.
CREATE INDEX IF NOT EXISTS idx_orders_customer_name_trgm
  ON orders USING gin ((shipping_address->>'full_name') gin_trgm_ops);
