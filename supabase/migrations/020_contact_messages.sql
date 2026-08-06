-- Real persistence for the site's Contact form, which previously submitted
-- nowhere (client-side state flip only). Writes go through the admin client
-- from a server action (actions/contact.ts), same as
-- setMyNewsletterSubscription — so no public INSERT policy is needed here;
-- RLS stays enabled with zero permissive policies (deny-by-default), matching
-- every other table in this schema.
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
