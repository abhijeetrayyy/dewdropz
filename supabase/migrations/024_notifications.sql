-- Real backing for the mobile app's Notifications screen and Settings
-- toggles, both of which were rendering off mock/local-only data — there
-- was no table for either to actually read or write.

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Mirrors the three toggles on the settings screen, so a notification's
  -- type can be checked against notification_preferences before it's sent.
  type TEXT NOT NULL CHECK (type IN ('order_update', 'promotion', 'back_in_stock')),
  title TEXT NOT NULL,
  body TEXT,
  -- Where tapping the notification should go (e.g. { orderId } or { productSlug }) --
  -- kept generic rather than a dedicated order_id column since promotion/
  -- back_in_stock notifications don't point at an order at all.
  data JSONB,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
-- Only ever used to set read_at from the app; WITH CHECK stops a user from
-- reassigning a row to someone else's user_id via the same UPDATE.
CREATE POLICY "Users can mark own notifications read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Per-user opt-in/out for each notification `type` above. Settings screen
-- toggles were local useState only — this gives them somewhere real to
-- read from and write to.
ALTER TABLE profiles
  ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT
    '{"order_updates": true, "promotions": true, "back_in_stock": true}'::jsonb;
