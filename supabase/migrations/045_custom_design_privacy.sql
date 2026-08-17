-- Guest designs were readable by anyone holding the public anon key.
--
-- The SELECT policy from 018 was `user_id = auth.uid() OR user_id IS NULL`, and
-- the studio saves a guest's design with `user_id: null`. The anon key ships in
-- the client bundle, so
--
--   GET /rest/v1/custom_designs?user_id=is.null&select=*
--
-- returned every guest design ever made: the print file URL, the preview URL,
-- the full canvas JSON, and the customer's own uploaded photograph. Verified
-- against this database before writing the fix — it returned real rows.
--
-- For a brand whose product is personal photographs printed on clothing, that
-- is the customer's private material, not catalogue data.
--
-- The intent was always owner-only: the comment above getUserDesigns in
-- actions/designs.ts already asserts "RLS already scopes custom_designs reads
-- to user_id = auth.uid()". The policy simply did not say what the code
-- believed it said. `OR user_id IS NULL` reads as "or it is unclaimed", but to
-- Postgres it means "or it belongs to nobody, so it belongs to everybody".
--
-- Nothing legitimate breaks. saveCustomDesign returns the new id to its caller,
-- so a guest never re-reads the row; the admin print queue and the order detail
-- both read through the service role, which bypasses RLS entirely.
--
-- The second clause covers the one real case the first would drop: someone who
-- designed while logged out and then signed in to buy. The design still carries
-- user_id NULL, but it is attached to an order that is demonstrably theirs.

DROP POLICY IF EXISTS "Owner or guest can read designs" ON custom_designs;

CREATE POLICY "Owner reads own designs" ON custom_designs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.custom_design_id = custom_designs.id
        AND o.user_id = auth.uid()
    )
  );

-- Supports the EXISTS above, which otherwise scans order_items for every design
-- row a policy is evaluated against.
CREATE INDEX IF NOT EXISTS idx_order_items_custom_design
  ON order_items(custom_design_id)
  WHERE custom_design_id IS NOT NULL;

-- INSERT stays open to guests deliberately: designing before signing in is the
-- whole point of the studio, and requiring an account to try it would cost more
-- than it protects. The abuse surface there is rate, not authorization, and is
-- handled in the action.
COMMENT ON POLICY "Owner reads own designs" ON custom_designs IS
  'Owner, or anyone who owns an order the design is attached to. Never world-readable.';
