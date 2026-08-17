-- GST invoicing: the documents, and the numbers on them.
--
-- The shop can already work out the right tax — migration 036 gave every line
-- its own HSN, rate, taxable value and tax amount, and froze CGST-vs-IGST onto
-- the order. What it cannot do is produce the piece of paper. Rule 46 CGST
-- wants the supplier's name, ADDRESS and GSTIN, a consecutive serial number,
-- the buyer's state and its numeric CODE, a per-head tax split and a unit of
-- measure. Of those, the schema today has none: store_settings holds a state
-- name and a GSTIN and no address at all, there is no state-code table, and
-- `order_number` is 17 characters with a RANDOM suffix, so it fails both the
-- 16-character cap and the word "consecutive".
--
-- WHAT THIS MIGRATION IS CAREFUL ABOUT, AND WHY.
--
-- 1. AN INVOICE IS A DOCUMENT, NOT A VIEW OF AN ORDER. Everything printed on it
--    is COPIED here at issue. Five live values would otherwise silently rewrite
--    history: store_name, gstin, origin_state, the seller address added below,
--    and the tax rate table (which 036 deliberately made editable). An admin
--    filling in the GSTIN next month must not make last month's invoices claim
--    a registration they were not issued under. Same reasoning 036 used when it
--    froze `tax_is_igst` instead of recomputing it.
--
-- 2. THE SERIAL NUMBER IS ALLOCATED BY A ROW-LOCKED COUNTER, NOT A SEQUENCE.
--    `nextval()` is documented as exempt from rollback — that exemption is the
--    whole point of it — so a failed transaction burns its number for good.
--    A counter row bumped inside the same transaction that writes the invoice
--    gives the number back on rollback. To be plain about the reason: Rule 46(b)
--    requires the number to be "consecutive", and GSTR-1 Table 13 reports each
--    series as from / to / total / CANCELLED / net, so a hole you can explain
--    (a cancelled document you can produce) reconciles and a hole you cannot
--    (a burnt number with no document) does not. Gaplessness is therefore
--    engineering prudence in service of a reporting form, not a literal command
--    in the rule — but it is cheap, so we do it properly.
--
-- 3. IT REFUSES RATHER THAN PRINTS SOMETHING FALSE. `store_settings.gstin` is
--    NULL right now while `enable_tax` is true and GST is being charged. A
--    person who is not registered may not collect tax (s.32(1)) and may not
--    issue a tax invoice (s.31 applies to "a registered person"; Rule 46(a)
--    requires the GSTIN on its face). So `issue_invoice` RAISES when the GSTIN
--    or the seller address is missing, when the order predates migration 036
--    and has no per-line tax, when tax is switched off, when the order is worth
--    nothing, or when the buyer's state cannot be resolved to a code. No serial
--    is spent on a document that would have to be reissued — and reissuing
--    means cancelling a number you can never reuse. The customer-facing fallback
--    is an UNNUMBERED "Order Summary" rendered on the fly, which claims nothing.
--
-- 4. THE FINANCIAL YEAR IS COMPUTED IN IST, FROM THE SUPPLY, NOT FROM THE CLOCK.
--    Two separate traps. The server runs UTC, and 03:00 IST on 1 April is 21:30
--    UTC on 31 March — computed in UTC, serial 1 of the new series gets stapled
--    onto the tail of the old one. And issuance runs off the `jobs` queue, which
--    retries with backoff and reclaims stuck jobs after 15 minutes, so an
--    invoice for a 31 March dispatch can easily be WRITTEN on 1 April; taking
--    the FY from the worker's clock would file a March supply in April's GSTR-1
--    and no integrity check could ever see it. The instant comes from the
--    dispatch, and crossing a year boundary is refused for a human to settle.
--
-- 5. IT DOES NOT PRETEND THE SHIPPING QUESTION IS ANSWERED. Today freight sits
--    outside every taxable value (subtotal 89900 + shipping 12000, tax 4495 =
--    5% of the goods alone). s.15(2)(c) includes incidental expenses charged by
--    the supplier in the value of supply, so that is very probably wrong — but
--    it changes what customers are charged, so it is the seller's call with
--    their CA, not this migration's. `shipping_is_taxable` records today's
--    answer explicitly and the invoice stores the freight columns separately,
--    so the day the answer changes, old invoices keep printing what was actually
--    charged instead of being retroactively rewritten.
--
-- Deliberately NOT here: e-invoicing/IRN (turnover-gated at ₹5 crore, and B2C
-- supplies are outside the mandate anyway), digital signatures, and any GSTR-1
-- filing integration. See the app-side notes.
--
-- ALSO DELIBERATELY NOT HERE: the apparel rate bands. Migration 036 seeded
-- Chapter 61 at 5% up to ₹1,000 and 12% above. The September 2025 rate
-- rationalisation moved that threshold to ₹2,500 with 18% above it, which would
-- make the seeded bands stale — but changing a rate changes what customers are
-- charged, and it retro-classifies every sale since. That is the seller's
-- decision with their CA, taken deliberately as its own migration, not a side
-- effect of adding a document renderer. Nothing here touches `tax_rates`; the
-- invoice prints the rate the order was actually charged at, whatever it was.

-- ---------------------------------------------------------------------------
-- 1. The seller, as the law needs them described
-- ---------------------------------------------------------------------------
-- Rule 46(a) wants name, address and GSTIN. We had a third of that. Note these
-- are the LIVE, editable values — the invoice copies them and never joins back.
--
-- The address here must be the REGISTERED place of business from the GST
-- certificate. There is a marketing address in lib/constants.ts; it is not this
-- and must not be used for it.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_legal_name    TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_address_line1 TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_address_line2 TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_city          TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_postal_code   TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_country       TEXT NOT NULL DEFAULT 'India';
-- The numeric GST state code for origin_state. Uttarakhand is 05, and it is
-- also the first two characters of a valid Uttarakhand GSTIN — which is why the
-- issue function cross-checks them rather than trusting either alone.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seller_state_code    CHAR(2);
-- Rule 46(q). A scanned signature or a DSC is the safe reading; the name alone
-- is the minimum, and it is FROZEN onto each invoice. We deliberately do NOT
-- store a signature image URL: a URL is a pointer to a mutable object, and
-- swapping the file would silently re-sign every historical invoice.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS invoice_signatory_name TEXT;

-- Rule 46(s). Only a taxpayer whose turnover HAS crossed the e-invoice
-- threshold, but who is issuing outside Rule 48(4), prints the declaration.
-- Below the threshold it would be a false statement, so it is off by default
-- and is a flag rather than a hardcoded absence.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS einvoice_declaration_required BOOLEAN NOT NULL DEFAULT false;

-- Whether the delivery charge is inside the value of supply. FALSE records what
-- the code does today (actions/orders.ts:203 adds shipping after tax). See the
-- header: changing this is a pricing decision, not a bug fix.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_is_taxable BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN store_settings.seller_address_line1 IS
  'Registered place of business from the GST certificate — NOT the marketing address in lib/constants.ts.';
COMMENT ON COLUMN store_settings.shipping_is_taxable IS
  'False = freight excluded from taxable value (current behaviour). s.15(2)(c) suggests it should be true; that is a CA decision.';

-- ---------------------------------------------------------------------------
-- 2. States, with their numeric codes
-- ---------------------------------------------------------------------------
-- Rule 46(e)/(f) require the unregistered recipient's state NAME AND ITS CODE,
-- and Rule 53(1A)(f) requires it on credit notes with no value threshold at all.
-- There is no state list anywhere in this codebase: both address forms are bare
-- text inputs and lib/tax.ts decides IGST by lowercasing and comparing strings.
-- So "Uttrakhand" or "UK" is today a different state from "Uttarakhand" and gets
-- charged IGST on a local delivery. Aliases exist to make that recoverable.
CREATE TABLE IF NOT EXISTS gst_state_codes (
  code      CHAR(2) PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  -- Lowercased spellings that map here. Matched only as a fallback; the address
  -- forms should select the canonical name.
  aliases   TEXT[] NOT NULL DEFAULT '{}',
  -- 25 and 28 were reassigned after territorial reorganisation. Kept so old
  -- data still resolves, excluded from any picker.
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO gst_state_codes (code, name, aliases, is_active) VALUES
  ('01','Jammu and Kashmir', ARRAY['j&k','jammu & kashmir','jk'], true),
  ('02','Himachal Pradesh',  ARRAY['hp'], true),
  ('03','Punjab',            ARRAY['pb'], true),
  ('04','Chandigarh',        ARRAY['ch'], true),
  ('05','Uttarakhand',       ARRAY['uttaranchal','uttrakhand','uk','ua'], true),
  ('06','Haryana',           ARRAY['hr'], true),
  ('07','Delhi',             ARRAY['new delhi','nct of delhi','dl'], true),
  ('08','Rajasthan',         ARRAY['rj'], true),
  ('09','Uttar Pradesh',     ARRAY['up'], true),
  ('10','Bihar',             ARRAY['br'], true),
  ('11','Sikkim',            ARRAY['sk'], true),
  ('12','Arunachal Pradesh', ARRAY['ar'], true),
  ('13','Nagaland',          ARRAY['nl'], true),
  ('14','Manipur',           ARRAY['mn'], true),
  ('15','Mizoram',           ARRAY['mz'], true),
  ('16','Tripura',           ARRAY['tr'], true),
  ('17','Meghalaya',         ARRAY['ml'], true),
  ('18','Assam',             ARRAY['as'], true),
  ('19','West Bengal',       ARRAY['wb'], true),
  ('20','Jharkhand',         ARRAY['jh'], true),
  ('21','Odisha',            ARRAY['orissa','od'], true),
  ('22','Chhattisgarh',      ARRAY['chattisgarh','cg'], true),
  ('23','Madhya Pradesh',    ARRAY['mp'], true),
  ('24','Gujarat',           ARRAY['gj'], true),
  ('25','Daman and Diu',     ARRAY['daman & diu'], false),
  ('26','Dadra and Nagar Haveli and Daman and Diu',
        ARRAY['dadra and nagar haveli','dnh','daman and diu (merged)'], true),
  ('27','Maharashtra',       ARRAY['mh'], true),
  ('28','Andhra Pradesh (Old)', ARRAY[]::TEXT[], false),
  ('29','Karnataka',         ARRAY['ka'], true),
  ('30','Goa',               ARRAY['ga'], true),
  ('31','Lakshadweep',       ARRAY['ld'], true),
  ('32','Kerala',            ARRAY['kl'], true),
  ('33','Tamil Nadu',        ARRAY['tamilnadu','tn'], true),
  ('34','Puducherry',        ARRAY['pondicherry','py'], true),
  ('35','Andaman and Nicobar Islands', ARRAY['andaman & nicobar','an'], true),
  ('36','Telangana',         ARRAY['ts','tg'], true),
  ('37','Andhra Pradesh',    ARRAY['ap'], true),
  ('38','Ladakh',            ARRAY['la'], true),
  ('97','Other Territory',   ARRAY[]::TEXT[], true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE gst_state_codes ENABLE ROW LEVEL SECURITY;
-- Public reference data, like tax_rates. The checkout form needs it to populate
-- a state picker before anyone has signed in.
DROP POLICY IF EXISTS "Anyone reads state codes" ON gst_state_codes;
CREATE POLICY "Anyone reads state codes" ON gst_state_codes FOR SELECT USING (true);

-- Free-text state name -> code. NULL when it cannot be resolved, which the
-- issue function treats as a hard stop rather than guessing: the place of
-- supply decides which government gets the money.
CREATE OR REPLACE FUNCTION resolve_state_code(p_state TEXT)
RETURNS CHAR(2)
LANGUAGE sql
STABLE
AS $$
  SELECT code FROM gst_state_codes
  WHERE lower(btrim(regexp_replace(p_state, '\s+', ' ', 'g'))) = lower(name)
     OR lower(btrim(regexp_replace(p_state, '\s+', ' ', 'g'))) = ANY(aliases)
  ORDER BY is_active DESC
  LIMIT 1;
$$;

-- Cache the code on saved addresses so the checkout can stop guessing and
-- isInterState() can compare codes instead of strings.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS state_code CHAR(2) REFERENCES gst_state_codes(code);
-- A registered buyer's details, so a B2B customer can actually claim credit.
-- On the address, not the profile: the GSTIN belongs to the billing entity and
-- its registered address, not to whoever is logged in.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS gstin      TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS legal_name TEXT;

-- Best-effort backfill. Deliberately not a guess: anything that does not match
-- a canonical name or a known alias stays NULL and shows up in the review
-- query below, because inventing a state code silently misfiles tax.
UPDATE addresses SET state_code = resolve_state_code(state)
WHERE state_code IS NULL AND resolve_state_code(state) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. The Indian financial year, in IST, on purpose
-- ---------------------------------------------------------------------------
-- 1 April to 31 March. The CGST Act never defines "financial year", so s.3(21)
-- of the General Clauses Act 1897 governs.
--
-- `AT TIME ZONE 'Asia/Kolkata'` converts to IST wall-clock REGARDLESS of the
-- session TimeZone setting. That is exactly why it is used and why CURRENT_DATE,
-- date_trunc('day', now()) and to_char(now(),'YYYY') are not — every one of
-- those reads a GUC that is UTC on this host.
--
-- The zone is hardcoded rather than read from store_settings.timezone: the
-- Indian FY is statute, not a store preference, and one careless settings edit
-- would silently re-bucket every invoice issued near a boundary.
--
-- STABLE, not IMMUTABLE: the tz database is mutable in principle, so this must
-- never be indexed or used in a CHECK.
CREATE OR REPLACE FUNCTION indian_fy(at_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lpad((y % 100)::text, 2, '0') || lpad(((y + 1) % 100)::text, 2, '0')
  FROM (
    SELECT CASE WHEN EXTRACT(MONTH FROM d) >= 4
                THEN EXTRACT(YEAR FROM d)::int
                ELSE EXTRACT(YEAR FROM d)::int - 1
           END AS y
    FROM (SELECT (at_ts AT TIME ZONE 'Asia/Kolkata')::date AS d) s
  ) t;
$$;

COMMENT ON FUNCTION indian_fy(TIMESTAMPTZ) IS
  'Indian FY label for an instant: 2026-06-01 -> "2627". Evaluated in IST explicitly, never via the session TimeZone.';

-- ---------------------------------------------------------------------------
-- 4. The counter
-- ---------------------------------------------------------------------------
-- One row per (document type, financial year). A new FY makes its own row and
-- starts at 1; the old row is never touched again, so the two do not contend.
--
-- NOT a column on store_settings, which has `USING (true)` for SELECT — a
-- next-invoice-number there would let anyone holding the anon key read the
-- shop's cumulative sales volume and diff it over time for a sales rate.
CREATE TABLE IF NOT EXISTS document_serial_counters (
  doc_type   TEXT NOT NULL CHECK (doc_type IN ('invoice', 'credit_note')),
  fy         TEXT NOT NULL CHECK (fy ~ '^[0-9]{4}$'),
  last_seq   INT  NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doc_type, fy)
);

ALTER TABLE document_serial_counters ENABLE ROW LEVEL SECURITY;
-- No policies at all. Nothing outside the allocator has business here, and
-- service_role bypasses RLS anyway — which is why the real protection is the
-- trigger below and not this.

-- The guard has to block BOTH directions. Backwards re-issues numbers already
-- used; FORWARDS is what actually makes a gap — `SET last_seq = last_seq + 1000`
-- is monotone and would sail past a "must not decrease" check while punching a
-- thousand-wide hole in the series. The allocator only ever adds one, so that is
-- what is allowed.
CREATE OR REPLACE FUNCTION document_serial_counters_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'serial counter rows are permanent (doc_type=%, fy=%)',
      OLD.doc_type, OLD.fy USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.doc_type <> OLD.doc_type OR NEW.fy <> OLD.fy THEN
    RAISE EXCEPTION 'serial counter key is immutable';
  END IF;
  IF NEW.last_seq <> OLD.last_seq + 1 THEN
    RAISE EXCEPTION 'serial counter moves by exactly one (% -> % for %/%)',
      OLD.last_seq, NEW.last_seq, OLD.doc_type, OLD.fy
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS document_serial_counters_guard ON document_serial_counters;
CREATE TRIGGER document_serial_counters_guard
  BEFORE UPDATE OR DELETE ON document_serial_counters
  FOR EACH ROW EXECUTE FUNCTION document_serial_counters_guard();

-- Row triggers do not fire for TRUNCATE — it is a statement-level operation, so
-- without this the whole "structurally impossible" claim above is just a
-- convention that one command defeats.
CREATE OR REPLACE FUNCTION deny_truncate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be truncated', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

DROP TRIGGER IF EXISTS document_serial_counters_no_truncate ON document_serial_counters;
CREATE TRIGGER document_serial_counters_no_truncate
  BEFORE TRUNCATE ON document_serial_counters
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

-- ---------------------------------------------------------------------------
-- 5. The invoice
-- ---------------------------------------------------------------------------
-- Self-contained by design. The renderer must be able to print this row with no
-- join to orders, store_settings, products, addresses or tax_rates — all five
-- move, and an invoice that changes when they move is not a record of anything.
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- RESTRICT, and it is worth being clear about what that does: it does not let
  -- the invoice survive the order being deleted, it makes deleting an invoiced
  -- order IMPOSSIBLE. That is the intent — s.36 CGST requires records to be kept
  -- for 72 months, and a cascade here is a gap generator. The consequence is
  -- real and belongs in the erasure policy: an invoiced order cannot be deleted
  -- to satisfy a "delete my account" request.
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,

  document_type   TEXT NOT NULL DEFAULT 'tax_invoice'
                  CHECK (document_type IN ('tax_invoice', 'bill_of_supply')),

  -- Identity. `serial` is what is printed; fy + seq are what makes "is this
  -- series consecutive?" an indexed query rather than a regex over strings.
  fy              TEXT NOT NULL CHECK (fy ~ '^[0-9]{4}$'),
  seq             INT  NOT NULL CHECK (seq > 0),
  serial          TEXT NOT NULL,
  -- Rule 46(c). NOT orders.created_at: for goods the time of supply is removal,
  -- so this is the dispatch instant.
  issued_at       TIMESTAMPTZ NOT NULL,

  -- Supplier snapshot (Rule 46(a)). gstin is nullable ONLY so a future
  -- bill_of_supply is representable; the CHECK below makes it mandatory on
  -- anything calling itself a tax invoice.
  seller_legal_name  TEXT NOT NULL,
  seller_trade_name  TEXT,
  seller_address     JSONB NOT NULL,
  seller_gstin       TEXT,
  seller_state       TEXT    NOT NULL,
  seller_state_code  CHAR(2) NOT NULL,
  signatory_name     TEXT NOT NULL,
  -- Frozen because Rule 46(s) turns on turnover in a PRIOR year: whether the
  -- declaration was required is a fact about the moment of issue.
  einvoice_declaration BOOLEAN NOT NULL DEFAULT false,

  -- Recipient snapshot (Rule 46(d)-(f)).
  buyer_name        TEXT NOT NULL,
  buyer_legal_name  TEXT,
  buyer_email       TEXT,
  buyer_phone       TEXT,
  -- NULL = unregistered / B2C. Snapshotted so a customer registering in 2027
  -- cannot make their 2026 invoices retroactively claim input credit.
  buyer_gstin       TEXT,
  supply_type       TEXT NOT NULL CHECK (supply_type IN ('B2B', 'B2C')),
  billing_address   JSONB NOT NULL,
  shipping_address  JSONB NOT NULL,
  -- Rule 46(o). An explicit fact so the renderer never has to diff two JSONBs
  -- to decide whether to print the delivery block.
  delivery_address_differs BOOLEAN NOT NULL DEFAULT false,

  -- Place of supply (Rule 46(m)/(n)). For a sale to an UNREGISTERED person this
  -- is governed by IGST Act s.10(1)(ca), inserted w.e.f. 01.10.2023, which
  -- overrides s.10(1)(a): the place of supply is the address of the recipient
  -- AS RECORDED IN THE INVOICE, and the supplier's location where no address is
  -- recorded. So what we record here is itself the taxing act, which is exactly
  -- why the issue function refuses to guess it.
  place_of_supply_state TEXT    NOT NULL,
  place_of_supply_code  CHAR(2) NOT NULL,
  is_igst               BOOLEAN NOT NULL,
  -- Rule 46(p): must be stated even when the answer is no.
  reverse_charge        BOOLEAN NOT NULL DEFAULT false,

  -- Money, all integer paise like every other money column in this schema.
  -- The rate-wise heads are SUMMED FROM invoice_lines and never split
  -- independently: splitTax() puts the odd paise on CGST per call, so splitting
  -- once per line and once per order would disagree by a paisa on the document.
  gross_value            INT NOT NULL DEFAULT 0,
  discount_total         INT NOT NULL DEFAULT 0,
  taxable_total          INT NOT NULL DEFAULT 0,
  -- Freight kept apart from the goods so both treatments are representable and
  -- history stays readable when the treatment changes. Today the tax columns
  -- are zero; see store_settings.shipping_is_taxable.
  shipping_charge        INT NOT NULL DEFAULT 0,
  shipping_taxable_value INT NOT NULL DEFAULT 0,
  shipping_tax_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
  shipping_tax_amount    INT NOT NULL DEFAULT 0,
  cgst_total             INT NOT NULL DEFAULT 0,
  sgst_total             INT NOT NULL DEFAULT 0,
  igst_total             INT NOT NULL DEFAULT 0,
  cess_total             INT NOT NULL DEFAULT 0,
  grand_total            INT NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'INR',
  -- [{rate, taxable, cgst, sgst, igst, cess}] — the rate-wise block that is
  -- printed and that GSTR-1 is filed from. Richer than orders.tax_breakdown,
  -- which carries no head split.
  tax_summary            JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Order facts denormalised because orders.status and payment_status MUTATE
  -- after issue (a refund flips payment_status), and an invoice must not.
  order_number       TEXT NOT NULL,
  order_placed_at    TIMESTAMPTZ NOT NULL,
  payment_method     TEXT,
  payment_status_at_issue TEXT,

  -- An invoice is never edited or deleted; it is cancelled, and the number
  -- stays spent and gets reported as cancelled in GSTR-1 Table 13.
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rule 46(b) in the schema. 'DDZ/2627/000001' is 15 of the 16 allowed.
  CONSTRAINT invoices_serial_shape CHECK (serial ~ '^[A-Za-z0-9/-]{1,16}$'),
  -- A document titled "Tax Invoice" without a GSTIN is not one.
  CONSTRAINT invoices_tax_invoice_needs_gstin
    CHECK (document_type <> 'tax_invoice' OR seller_gstin IS NOT NULL),
  CONSTRAINT invoices_b2b_needs_gstin
    CHECK (supply_type <> 'B2B' OR buyer_gstin IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_serial_unique ON invoices(serial);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_series_unique ON invoices(fy, seq);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_order ON invoices(order_id);
-- The GSTR-1 period export, and the B2B table within it.
CREATE INDEX IF NOT EXISTS idx_invoices_issued    ON invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_gst ON invoices(buyer_gstin) WHERE buyer_gstin IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  -- Traceability only. SET NULL, and the renderer must never follow it — the
  -- line has to print correctly with this null.
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,

  -- Invoices get cited by line number in disputes and credit notes, so the
  -- ordering is a stored fact, not whatever the planner returns.
  line_no       INT NOT NULL,

  description   TEXT NOT NULL,                    -- Rule 46(g)
  hsn_code      TEXT NOT NULL,                    -- Rule 46(f)
  quantity      INT  NOT NULL CHECK (quantity > 0),
  -- Rule 46(h). No unit-of-measure exists anywhere in the schema; PCS is right
  -- for every current SKU and lives on the line so a future non-piece product
  -- needs no migration.
  uqc           TEXT NOT NULL DEFAULT 'PCS',

  -- The per-PIECE price, printed, because the apparel slab is decided per piece
  -- (lib/tax.ts resolveRate). Without it an auditor cannot see why two garments
  -- on one invoice carry different rates.
  unit_price    INT NOT NULL,
  gross_value   INT NOT NULL,
  -- s.15(3)(a): a discount is only excludable from value if it is recorded IN
  -- the invoice, so the apportioned share is printed, not silently netted.
  discount      INT NOT NULL DEFAULT 0,
  taxable_value INT NOT NULL,

  tax_rate      DECIMAL(5,2) NOT NULL,
  -- Which rate band matched, snapshotted. tax_rates rows are editable by design
  -- (036), so this is the only way to explain the rate later.
  rate_band_min INT,
  rate_band_max INT,

  cgst_amount   INT NOT NULL DEFAULT 0,
  sgst_amount   INT NOT NULL DEFAULT 0,
  igst_amount   INT NOT NULL DEFAULT 0,
  cess_amount   INT NOT NULL DEFAULT 0,
  line_total    INT NOT NULL,

  UNIQUE (invoice_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, line_no);
-- GSTR-1 Table 12 (HSN summary).
CREATE INDEX IF NOT EXISTS idx_invoice_lines_hsn ON invoice_lines(hsn_code);

-- Append-only, enforced rather than agreed. RLS cannot do this job — every
-- server action in this codebase uses the service role, which bypasses RLS.
-- An issued invoice is frozen whole — not just its identity.
--
-- The earlier draft of this left every money column editable, because
-- `issue_invoice` inserted the head and then UPDATEd it with its own totals. A
-- legal document staying permanently editable to accommodate one write that
-- happens microseconds after the first is a bad trade, and it was caught by a
-- test that edited `grand_total` on an issued invoice and succeeded. The
-- function now computes the totals before the insert and writes the row once,
-- so nothing legitimate needs to update an invoice ever again.
--
-- The ONLY permitted change is cancellation, which is additive: it records that
-- a document was withdrawn without altering what the document said. GSTR-1
-- Table 13 reports a series as from / to / total / cancelled, so a cancelled
-- number must remain readable, not disappear.
CREATE OR REPLACE FUNCTION invoices_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'invoice % cannot be deleted — cancel it and issue a credit note', OLD.serial
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Compare the whole row with cancellation blanked on both sides: anything that
  -- is not purely a cancellation is a rewrite of an issued document. Written
  -- this way so a column added later is frozen by default rather than silently
  -- becoming editable because nobody remembered to list it here.
  IF (to_jsonb(NEW) - 'cancelled_at' - 'cancellation_reason')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'cancelled_at' - 'cancellation_reason') THEN
    RAISE EXCEPTION 'invoice % is immutable once issued — only cancellation may be recorded', OLD.serial
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Once cancelled, nothing further — not even the reason. Checked as "is it
  -- already cancelled", not "did the timestamp change": `now()` is fixed for a
  -- whole transaction, so a re-cancel writes an identical value and a
  -- did-it-change test waves it through. A test caught exactly that.
  IF OLD.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'invoice % is already cancelled and is now closed to any change', OLD.serial
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invoices_append_only ON invoices;
CREATE TRIGGER invoices_append_only
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_append_only();

DROP TRIGGER IF EXISTS invoices_no_truncate ON invoices;
CREATE TRIGGER invoices_no_truncate
  BEFORE TRUNCATE ON invoices
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

DROP TRIGGER IF EXISTS invoice_lines_no_truncate ON invoice_lines;
CREATE TRIGGER invoice_lines_no_truncate
  BEFORE TRUNCATE ON invoice_lines
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- SELECT is the only policy, the shape refunds and admin_audit_log already use.
-- Note the known limitation: orders.user_id is ON DELETE SET NULL and guest
-- orders have no user_id at all, so those invoices are admin-visible only. A
-- guest cannot reach their own invoice through RLS; the app serves it via a
-- signed, expiring link instead.
DROP POLICY IF EXISTS "Customers read own invoices" ON invoices;
CREATE POLICY "Customers read own invoices" ON invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = invoices.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins read invoices" ON invoices;
CREATE POLICY "Admins read invoices" ON invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Customers read own invoice lines" ON invoice_lines;
CREATE POLICY "Customers read own invoice lines" ON invoice_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i JOIN orders o ON o.id = i.order_id
    WHERE i.id = invoice_lines.invoice_id AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins read invoice lines" ON invoice_lines;
CREATE POLICY "Admins read invoice lines" ON invoice_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

COMMENT ON TABLE invoices IS
  'One issued tax invoice. Fully snapshotted — the renderer must not join orders or store_settings. Append-only via service role.';

-- ---------------------------------------------------------------------------
-- 6. Credit notes
-- ---------------------------------------------------------------------------
-- s.34(1) says the supplier "may issue" a credit note, so it is not a standalone
-- duty. But it is the ONLY mechanism that reduces output tax on a supply already
-- invoiced: refund a customer without one and you have handed back the GST out
-- of your own pocket and still owe the government that GST. So in practice it is
-- required on every refund against an issued invoice.
--
-- Its own series. Rule 53(1A)(c) does not literally command one — it asks only
-- for a consecutive number unique for the financial year — but GSTR-1 reports
-- credit notes in a separate table (9B) keyed on document number, and Table 13
-- keys on nature of document, so sharing the invoice series is unfilable.
--
-- No credit_note_lines table: Rule 53(1A)(h) asks for the taxable value, the
-- rate and the tax credited, which is a rate-wise summary, not line detail.
CREATE TABLE IF NOT EXISTS credit_notes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  -- Nullable: a credit note can correct a price with no money moving, and 043
  -- deliberately stores FAILED refund attempts, which must never produce one.
  refund_id     UUID REFERENCES refunds(id) ON DELETE RESTRICT,

  fy            TEXT NOT NULL CHECK (fy ~ '^[0-9]{4}$'),
  seq           INT  NOT NULL CHECK (seq > 0),
  serial        TEXT NOT NULL,
  issued_at     TIMESTAMPTZ NOT NULL,
  reason        TEXT NOT NULL,

  -- Rule 53(1A)(g): the credit note must carry the original invoice's number and
  -- date on its face, so they are denormalised rather than joined.
  original_invoice_number TEXT NOT NULL,
  original_invoice_date   TIMESTAMPTZ NOT NULL,

  -- Rule 53(1A)(a)/(e)/(f). Copied from the parent invoice so this prints as a
  -- standalone document. Note (f) has NO ₹50,000 carve-out — the recipient's
  -- state name and CODE are required on every B2C credit note.
  seller_legal_name TEXT NOT NULL,
  seller_address    JSONB NOT NULL,
  seller_gstin      TEXT NOT NULL,
  buyer_name        TEXT NOT NULL,
  buyer_gstin       TEXT,
  buyer_address     JSONB NOT NULL,
  place_of_supply_state TEXT    NOT NULL,
  place_of_supply_code  CHAR(2) NOT NULL,
  signatory_name    TEXT NOT NULL,

  -- Rule 53(1A)(h). The whole point of the table: refunds.amount is one gross
  -- number, and without these heads the output-tax reduction cannot be claimed.
  is_igst               BOOLEAN NOT NULL,
  taxable_value_reduced INT NOT NULL DEFAULT 0,
  shipping_reduced      INT NOT NULL DEFAULT 0,
  cgst_reduced          INT NOT NULL DEFAULT 0,
  sgst_reduced          INT NOT NULL DEFAULT 0,
  igst_reduced          INT NOT NULL DEFAULT 0,
  cess_reduced          INT NOT NULL DEFAULT 0,
  total_reduced         INT NOT NULL CHECK (total_reduced > 0),
  -- Rate-wise, and PRORATED — not copied from the parent. GSTR-1 files the
  -- rate-wise figures, so a ₹500 credit note carrying a ₹5,000 invoice's
  -- breakdown files the wrong numbers.
  tax_summary           JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT credit_notes_serial_shape CHECK (serial ~ '^[A-Za-z0-9/-]{1,16}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_serial_unique ON credit_notes(serial);
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_series_unique ON credit_notes(fy, seq);
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_one_per_refund
  ON credit_notes(refund_id) WHERE refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_issued  ON credit_notes(issued_at DESC);

-- Frozen outright. `issue_credit_note` writes the row once, in full, and there
-- is no cancellation concept for a credit note here — so unlike `invoices`,
-- which must stay open to recording a cancellation, nothing legitimate ever
-- updates one of these. Write-once is the strongest guarantee available and it
-- costs nothing to take it.
CREATE OR REPLACE FUNCTION credit_notes_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'credit note % cannot be deleted', OLD.serial
      USING ERRCODE = 'restrict_violation';
  END IF;
  RAISE EXCEPTION 'credit note % is immutable once issued', OLD.serial
    USING ERRCODE = 'restrict_violation';
END $$;

DROP TRIGGER IF EXISTS credit_notes_append_only ON credit_notes;
CREATE TRIGGER credit_notes_append_only
  BEFORE UPDATE OR DELETE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION credit_notes_append_only();

DROP TRIGGER IF EXISTS credit_notes_no_truncate ON credit_notes;
CREATE TRIGGER credit_notes_no_truncate
  BEFORE TRUNCATE ON credit_notes
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own credit notes" ON credit_notes;
CREATE POLICY "Customers read own credit notes" ON credit_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i JOIN orders o ON o.id = i.order_id
    WHERE i.id = credit_notes.invoice_id AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins read credit notes" ON credit_notes;
CREATE POLICY "Admins read credit notes" ON credit_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- 7. Allocating a number
-- ---------------------------------------------------------------------------
-- One statement. INSERT ... ON CONFLICT DO UPDATE both creates the first row of
-- a new FY and bumps an existing one, atomically, with no read-then-write window
-- to lose an update in. It takes an exclusive lock on the counter tuple which is
-- held until COMMIT — that hold IS the serialisation, and it is why issuance
-- must be a short standalone transaction and must never wrap a gateway call.
--
-- Not granted to anyone: reachable only from the SECURITY DEFINER wrappers
-- below, so a number cannot be spent without a document being written for it.
CREATE OR REPLACE FUNCTION allocate_document_serial(p_doc_type TEXT, p_fy TEXT)
RETURNS TABLE (doc_seq INT, doc_serial TEXT)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_prefix TEXT := CASE p_doc_type WHEN 'invoice' THEN 'DDZ' WHEN 'credit_note' THEN 'DDC' END;
  v_seq    INT;
BEGIN
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'unknown document type %', p_doc_type;
  END IF;

  INSERT INTO document_serial_counters (doc_type, fy, last_seq)
  VALUES (p_doc_type, p_fy, 1)
  ON CONFLICT (doc_type, fy) DO UPDATE
    SET last_seq = document_serial_counters.last_seq + 1, updated_at = NOW()
  RETURNING document_serial_counters.last_seq INTO v_seq;

  -- Six digits is the entire remaining budget: 'DDZ/' + 4 + '/' + 6 = 15 of 16.
  IF v_seq > 999999 THEN
    RAISE EXCEPTION 'series %/% is exhausted — the 16-character limit leaves no room to widen it',
      v_prefix, p_fy;
  END IF;

  doc_seq    := v_seq;
  doc_serial := v_prefix || '/' || p_fy || '/' || lpad(v_seq::text, 6, '0');
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION allocate_document_serial(TEXT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 8. Issuing a tax invoice
-- ---------------------------------------------------------------------------
-- Called once, at DISPATCH. s.31(1)(a) requires the invoice before or at removal
-- of the goods, which is the only trigger that also works for COD — payment
-- lands days later there, and nothing in this codebase ever marks a COD order
-- paid at all.
--
-- IDEMPOTENT BY CONSTRUCTION. Three payment paths race for one order and the
-- jobs queue is explicitly at-least-once, so this WILL be called twice; it
-- returns the same invoice rather than allocating a second number. The advisory
-- lock, not the unique index, is what makes that true: with only the index the
-- loser bumps the counter and then hits 23505, which rolls back cleanly and
-- leaves no gap but surfaces an error for a legitimate retry.
--
-- Advisory lock rather than SELECT ... FOR UPDATE on the order: a row lock there
-- would collide with the payment webhooks concurrently writing payment_status.
--
-- ON LOCKING, HONESTLY: the INSERT into invoices takes a KEY SHARE row lock on
-- the referenced orders row for the foreign-key check, while the counter lock is
-- held. So `orders` IS in the counter's lock graph, and a concurrent DELETE of an
-- order could in principle close a cycle. Nothing does that today (the only
-- orders delete is the compensating one at actions/orders.ts:265, which runs at
-- checkout before any invoice exists), but do not add an admin "delete order"
-- feature without revisiting this.
CREATE OR REPLACE FUNCTION issue_invoice(p_order_id UUID, p_supply_at TIMESTAMPTZ DEFAULT NULL)
RETURNS invoices
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order    orders%ROWTYPE;
  v_settings store_settings%ROWTYPE;
  v_invoice  invoices;
  v_at       TIMESTAMPTZ;
  v_fy       TEXT;
  v_seq      INT;
  v_serial   TEXT;
  v_pos_state TEXT;
  v_pos_code  CHAR(2);
  v_buyer_gstin TEXT;
  v_line_count  INT;
  v_untaxed     INT;
  v_taxable  INT;
  v_cgst     INT;
  v_sgst     INT;
  v_igst     INT;
  v_summary  JSONB;
BEGIN
  -- Per-order gate first, BEFORE the counter is touched. Allocating and then
  -- discovering an invoice already exists would mean handing a number back,
  -- which is the sequence problem reintroduced by hand.
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.invoice'), hashtext(p_order_id::text));

  SELECT * INTO v_invoice FROM invoices WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN v_invoice;                       -- retry: same document, no allocation
  END IF;

  -- Only now start bounding waits. Deliberately NOT set on the function itself:
  -- a lock_timeout on the advisory wait above would turn the very mechanism that
  -- makes retries idempotent into a failure, burning the job's attempt budget.
  PERFORM set_config('lock_timeout', '5s', true);

  -- Plain SELECT, no FOR UPDATE: this function must never take a write lock on
  -- orders (see the note above).
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % does not exist', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_settings FROM store_settings WHERE id = 1;

  -- ---- refusals, every one of which prevents a defective document ----------

  -- A tax invoice without the supplier's GSTIN is not a tax invoice (Rule 46(a)),
  -- and collecting tax unregistered is s.32(1) with an s.76 penalty attached.
  IF v_settings.gstin IS NULL OR btrim(v_settings.gstin) = '' THEN
    RAISE EXCEPTION 'cannot issue: store_settings.gstin is not set. A document without the supplier GSTIN is not a tax invoice.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_settings.seller_legal_name IS NULL OR btrim(v_settings.seller_legal_name) = ''
     OR v_settings.seller_address_line1 IS NULL OR btrim(v_settings.seller_address_line1) = ''
     OR v_settings.seller_city IS NULL OR v_settings.seller_postal_code IS NULL
     OR v_settings.seller_state_code IS NULL
     OR v_settings.invoice_signatory_name IS NULL THEN
    RAISE EXCEPTION 'cannot issue: the seller legal name, registered address, state code or signatory is missing from store_settings (Rule 46(a),(q)).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- The GSTIN's first two characters are the state code. Disagreeing with
  -- origin_state means one of the two is wrong, and both are printed.
  IF left(v_settings.gstin, 2) <> v_settings.seller_state_code THEN
    RAISE EXCEPTION 'cannot issue: GSTIN % does not start with the seller state code %',
      v_settings.gstin, v_settings.seller_state_code USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Turning tax off does not make apparel non-taxable. A registered supplier
  -- issuing a "Tax Invoice" showing zero GST on goods is a misstatement.
  IF NOT v_settings.enable_tax THEN
    RAISE EXCEPTION 'cannot issue: enable_tax is false while a GSTIN is configured. Zero-GST on taxable goods is not a discount.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'cannot issue for a % order (%)', v_order.status, v_order.order_number
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A supply without consideration is not a supply under s.7; the right document
  -- for goods moving on a zero-value order is a delivery challan (Rule 55),
  -- which this migration does not build. Refuse rather than print ₹0 "Tax Invoice".
  IF COALESCE(v_order.total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'cannot issue a zero-value tax invoice for % — a delivery challan is the correct document'
      , v_order.order_number USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Migration 036 added the per-line tax columns and backfilled nothing. An
  -- order placed before it has no HSN, no rate and no taxable value, and would
  -- print a defective invoice.
  SELECT count(*), count(*) FILTER (WHERE hsn_code IS NULL OR taxable_value = 0)
    INTO v_line_count, v_untaxed
  FROM order_items WHERE order_id = p_order_id;
  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'order % has no line items', v_order.order_number USING ERRCODE = 'no_data_found';
  END IF;
  IF v_untaxed > 0 THEN
    RAISE EXCEPTION 'order % has % line(s) with no HSN or no taxable value (placed before migration 036) — invoice by hand',
      v_order.order_number, v_untaxed USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Place of supply. For an unregistered buyer this is the recipient's address
  -- AS RECORDED ON THE INVOICE (IGST Act s.10(1)(ca)), so recording a guess is
  -- itself the error — it decides which government is paid. No silent fallback
  -- to origin_state: that would let the document say "place of supply:
  -- Uttarakhand" while is_igst is true.
  v_pos_state := NULLIF(btrim(v_order.shipping_address->>'state'), '');
  v_pos_code  := resolve_state_code(v_pos_state);
  IF v_pos_code IS NULL THEN
    RAISE EXCEPTION 'cannot issue for %: shipping state "%" does not resolve to a GST state code',
      v_order.order_number, COALESCE(v_pos_state, '(blank)') USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- The frozen head must agree with the state actually being printed. If they
  -- disagree the order was taxed against a different destination than the one
  -- on the document, and that is a filing error, not a formatting one.
  IF v_order.tax_is_igst <> (v_pos_code <> v_settings.seller_state_code) THEN
    RAISE EXCEPTION 'cannot issue for %: order was taxed as % but the place of supply resolves to % (origin %)',
      v_order.order_number,
      CASE WHEN v_order.tax_is_igst THEN 'IGST' ELSE 'CGST+SGST' END,
      v_pos_code, v_settings.seller_state_code
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Only India is modelled. An overseas address is a zero-rated export needing
  -- the Rule 46 endorsement, an LUT election and a shipping bill — none of which
  -- exist here, and lib/tax.ts would have charged it IGST as if it were domestic.
  IF lower(COALESCE(v_order.shipping_address->>'country', 'india')) NOT IN ('india', 'in') THEN
    RAISE EXCEPTION 'cannot issue for %: exports are not supported', v_order.order_number
      USING ERRCODE = 'feature_not_supported';
  END IF;

  -- ---- the financial year, from the SUPPLY ---------------------------------
  -- Dispatch, falling back to confirmation. Never NOW(): issuance runs off the
  -- jobs queue, which retries with backoff, so the row can easily be written a
  -- day after the parcel left.
  v_at := COALESCE(p_supply_at, v_order.shipped_at, v_order.confirmed_at, v_order.created_at);
  v_fy := indian_fy(v_at);
  IF v_fy <> indian_fy(NOW()) THEN
    RAISE EXCEPTION 'refusing to auto-issue for % into FY % from FY % — a late invoice across a year boundary is a filing decision',
      v_order.order_number, v_fy, indian_fy(NOW()) USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ---- freight -------------------------------------------------------------
  -- Checked BEFORE a number is spent. Today freight carries no tax; if someone
  -- turns the setting on without also teaching lib/tax.ts to charge tax on it,
  -- the invoice would understate the value of supply, so stop instead.
  IF v_settings.shipping_is_taxable AND COALESCE(v_order.shipping_cost, 0) > 0 THEN
    RAISE EXCEPTION 'shipping_is_taxable is on but no freight tax was computed at checkout for % — fix lib/tax.ts before issuing',
      v_order.order_number USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ---- totals, computed BEFORE the row is written ---------------------------
  -- The head used to be inserted and then UPDATEd with its own totals, which is
  -- why the immutability trigger had to keep every money column editable — a
  -- legal document that stays editable forever, to accommodate one write that
  -- happens microseconds after the first. The split is arithmetic on
  -- order_items, so it can be done up front and the invoice written once,
  -- complete, and then frozen outright. The identical CASE expressions build the
  -- lines below, and the assertion after that proves the two agree.
  --
  -- Integer division floors, so sgst = floor(tax/2) and cgst takes the odd
  -- paisa — matching splitTax() in lib/tax.ts exactly, deliberately.
  SELECT
    COALESCE(SUM(oi.taxable_value), 0),
    COALESCE(SUM(CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount - (oi.tax_amount / 2) END), 0),
    COALESCE(SUM(CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount / 2 END), 0),
    COALESCE(SUM(CASE WHEN v_order.tax_is_igst THEN oi.tax_amount ELSE 0 END), 0)
    INTO v_taxable, v_cgst, v_sgst, v_igst
  FROM order_items oi WHERE oi.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'rate', t.tax_rate, 'taxable', t.taxable, 'cgst', t.cgst,
           'sgst', t.sgst, 'igst', t.igst, 'cess', 0
         ) ORDER BY t.tax_rate), '[]'::jsonb)
    INTO v_summary
  FROM (
    SELECT oi.tax_rate,
           SUM(oi.taxable_value) taxable,
           SUM(CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount - (oi.tax_amount / 2) END) cgst,
           SUM(CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount / 2 END) sgst,
           SUM(CASE WHEN v_order.tax_is_igst THEN oi.tax_amount ELSE 0 END) igst
    FROM order_items oi WHERE oi.order_id = p_order_id GROUP BY oi.tax_rate
  ) t;

  -- The document must add up to what the customer was actually charged. If it
  -- does not, something upstream disagrees with orders.total_amount and the
  -- right answer is to stop — before a serial is spent — not to print a
  -- plausible number.
  IF v_taxable + v_cgst + v_sgst + v_igst + COALESCE(v_order.shipping_cost, 0)
       <> v_order.total_amount THEN
    RAISE EXCEPTION 'invoice for % does not reconcile: taxable % + tax % + shipping % <> total %',
      v_order.order_number, v_taxable, v_cgst + v_sgst + v_igst,
      COALESCE(v_order.shipping_cost, 0), v_order.total_amount
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ---- write it ------------------------------------------------------------
  -- Everything above this line can refuse without cost. Past it, a number is
  -- spent, so nothing below may fail for a reason we could have checked first.
  SELECT * INTO v_seq, v_serial FROM allocate_document_serial('invoice', v_fy);

  v_buyer_gstin := NULLIF(btrim(COALESCE(v_order.billing_address->>'gstin', '')), '');

  INSERT INTO invoices (
    order_id, document_type, fy, seq, serial, issued_at,
    seller_legal_name, seller_trade_name, seller_address, seller_gstin,
    seller_state, seller_state_code, signatory_name, einvoice_declaration,
    buyer_name, buyer_legal_name, buyer_email, buyer_phone, buyer_gstin, supply_type,
    billing_address, shipping_address, delivery_address_differs,
    place_of_supply_state, place_of_supply_code, is_igst, reverse_charge,
    gross_value, discount_total, shipping_charge,
    taxable_total, cgst_total, sgst_total, igst_total, tax_summary,
    grand_total, currency,
    order_number, order_placed_at, payment_method, payment_status_at_issue
  ) VALUES (
    p_order_id, 'tax_invoice', v_fy, v_seq, v_serial, v_at,
    v_settings.seller_legal_name, v_settings.store_name,
    jsonb_build_object(
      'line1', v_settings.seller_address_line1,
      'line2', v_settings.seller_address_line2,
      'city',  v_settings.seller_city,
      'state', v_settings.origin_state,
      'state_code', v_settings.seller_state_code,
      'postal_code', v_settings.seller_postal_code,
      'country', v_settings.seller_country
    ),
    v_settings.gstin, v_settings.origin_state, v_settings.seller_state_code,
    v_settings.invoice_signatory_name, v_settings.einvoice_declaration_required,
    COALESCE(v_order.shipping_address->>'full_name', v_order.email),
    NULLIF(btrim(COALESCE(v_order.billing_address->>'legal_name', '')), ''),
    v_order.email, v_order.phone, v_buyer_gstin,
    CASE WHEN v_buyer_gstin IS NULL THEN 'B2C' ELSE 'B2B' END,
    COALESCE(v_order.billing_address, v_order.shipping_address), v_order.shipping_address,
    COALESCE(v_order.billing_address, v_order.shipping_address) IS DISTINCT FROM v_order.shipping_address,
    v_pos_state, v_pos_code, v_order.tax_is_igst, false,
    COALESCE(v_order.subtotal, 0), COALESCE(v_order.discount_amount, 0),
    COALESCE(v_order.shipping_cost, 0),
    v_taxable, v_cgst, v_sgst, v_igst, v_summary,
    v_order.total_amount, COALESCE(v_order.currency, 'INR'),
    v_order.order_number, v_order.created_at, v_order.payment_method, v_order.payment_status
  )
  RETURNING * INTO v_invoice;

  -- Lines, built with the SAME split expressions the head totals were computed
  -- from, so the two cannot disagree by the odd paisa splitTax() assigns to CGST.
  -- The assertion below proves it rather than assuming it.
  INSERT INTO invoice_lines (
    invoice_id, order_item_id, line_no, description, hsn_code, quantity, uqc,
    unit_price, gross_value, discount, taxable_value, tax_rate,
    rate_band_min, rate_band_max,
    cgst_amount, sgst_amount, igst_amount, line_total
  )
  SELECT
    v_invoice.id, oi.id,
    row_number() OVER (ORDER BY oi.created_at, oi.id),
    CASE WHEN oi.variant_name IS NULL THEN oi.product_name
         ELSE oi.product_name || ' — ' || oi.variant_name END,
    oi.hsn_code, oi.quantity, 'PCS',
    oi.unit_price, oi.total_price,
    GREATEST(0, oi.total_price - oi.taxable_value), oi.taxable_value, oi.tax_rate,
    tr.min_price, tr.max_price,
    CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount - (oi.tax_amount / 2) END,
    CASE WHEN v_order.tax_is_igst THEN 0 ELSE oi.tax_amount / 2 END,
    CASE WHEN v_order.tax_is_igst THEN oi.tax_amount ELSE 0 END,
    oi.taxable_value + oi.tax_amount
  FROM order_items oi
  LEFT JOIN LATERAL (
    SELECT r.min_price, r.max_price FROM tax_rates r
    WHERE r.is_active AND r.hsn_code = oi.hsn_code
      AND oi.unit_price >= r.min_price
      AND (r.max_price IS NULL OR oi.unit_price < r.max_price)
    LIMIT 1
  ) tr ON true
  WHERE oi.order_id = p_order_id;

  -- The head was frozen with totals computed from order_items; the lines were
  -- built from the same rows. If those two ever diverge the document contradicts
  -- itself, which is the one defect a reader cannot detect. Cheap to check, and
  -- it fails the whole transaction — including the allocation — rather than
  -- leaving a self-inconsistent invoice behind.
  PERFORM 1 FROM (
    SELECT COALESCE(SUM(taxable_value), 0) t, COALESCE(SUM(cgst_amount), 0) c,
           COALESCE(SUM(sgst_amount), 0) s, COALESCE(SUM(igst_amount), 0) i
    FROM invoice_lines WHERE invoice_id = v_invoice.id
  ) x
  WHERE x.t <> v_taxable OR x.c <> v_cgst OR x.s <> v_sgst OR x.i <> v_igst;
  IF FOUND THEN
    RAISE EXCEPTION 'invoice % head and lines disagree — refusing to leave a self-contradictory document',
      v_serial USING ERRCODE = 'internal_error';
  END IF;

  RETURN v_invoice;
END $$;

REVOKE ALL ON FUNCTION issue_invoice(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_invoice(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION issue_invoice(UUID, TIMESTAMPTZ) IS
  'Allocates the next invoice serial and writes the document, in one transaction. Idempotent. '
  'MUST be called as a standalone RPC — the counter row lock is held to COMMIT, so never wrap network I/O in it.';

-- ---------------------------------------------------------------------------
-- 9. Issuing a credit note
-- ---------------------------------------------------------------------------
-- Tax is reversed in proportion to the GOODS being credited, not to the order
-- total: total_amount includes freight, which carries no tax today, so
-- prorating against it would credit tax that was never charged. And the running
-- total is capped against the parent, because refunds.amount is only CHECKed
-- greater than zero and nothing else stops two partial refunds over-crediting.
CREATE OR REPLACE FUNCTION issue_credit_note(
  p_refund_id UUID,
  p_reason    TEXT DEFAULT 'Refund'
)
RETURNS credit_notes
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund   refunds%ROWTYPE;
  v_parent   invoices;
  v_note     credit_notes;
  v_at       TIMESTAMPTZ := NOW();
  v_fy       TEXT;
  v_seq      INT;
  v_serial   TEXT;
  v_base     INT;      -- taxable + tax on the parent: the credit-bearing part
  v_prior    INT;
  v_taxable  INT;
  v_cgst     INT;
  v_sgst     INT;
  v_igst     INT;
  v_ship     INT;
  v_summary  JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.credit_note'), hashtext(p_refund_id::text));

  SELECT * INTO v_note FROM credit_notes WHERE refund_id = p_refund_id;
  IF FOUND THEN
    RETURN v_note;
  END IF;

  PERFORM set_config('lock_timeout', '5s', true);

  SELECT * INTO v_refund FROM refunds WHERE id = p_refund_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund % does not exist', p_refund_id USING ERRCODE = 'no_data_found';
  END IF;
  -- 043 stores failed attempts as rows on purpose. A refund the gateway rejected
  -- moved no money and must never reduce output tax.
  IF v_refund.status <> 'succeeded' THEN
    RAISE EXCEPTION 'refund % did not succeed (status %) — no credit note', p_refund_id, v_refund.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A credit note amends an invoice. If the order was cancelled before dispatch
  -- no invoice was ever issued, and there is nothing to reverse.
  SELECT * INTO v_parent FROM invoices WHERE order_id = v_refund.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % was never invoiced — a refund on an uninvoiced order needs no credit note',
      v_refund.order_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_fy := indian_fy(v_at);

  -- Apportionment rule, written down because it must not drift: goods (taxable
  -- value + tax) are exhausted before freight, and the tax reversed is
  -- proportional to the goods portion only.
  v_base  := v_parent.taxable_total + v_parent.cgst_total + v_parent.sgst_total + v_parent.igst_total;
  SELECT COALESCE(SUM(total_reduced), 0) INTO v_prior FROM credit_notes WHERE invoice_id = v_parent.id;

  IF v_prior + v_refund.amount > v_parent.grand_total THEN
    RAISE EXCEPTION 'credit notes against % would total % which exceeds the invoice (%)',
      v_parent.serial, v_prior + v_refund.amount, v_parent.grand_total
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Goods first, remainder against freight.
  v_taxable := LEAST(v_refund.amount, GREATEST(0, v_base - v_prior));
  v_ship    := v_refund.amount - v_taxable;

  v_cgst := CASE WHEN v_base = 0 THEN 0 ELSE (v_parent.cgst_total::bigint * v_taxable / v_base)::int END;
  v_sgst := CASE WHEN v_base = 0 THEN 0 ELSE (v_parent.sgst_total::bigint * v_taxable / v_base)::int END;
  v_igst := CASE WHEN v_base = 0 THEN 0 ELSE (v_parent.igst_total::bigint * v_taxable / v_base)::int END;

  -- Rate-wise, prorated on the same ratio. Copying the parent's block verbatim
  -- would file the full invoice's tax against a partial credit note.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'rate', e->>'rate',
           'taxable', ((e->>'taxable')::bigint * v_taxable / GREATEST(v_base, 1))::int,
           'cgst',    ((e->>'cgst')::bigint    * v_taxable / GREATEST(v_base, 1))::int,
           'sgst',    ((e->>'sgst')::bigint    * v_taxable / GREATEST(v_base, 1))::int,
           'igst',    ((e->>'igst')::bigint    * v_taxable / GREATEST(v_base, 1))::int,
           'cess', 0
         )), '[]'::jsonb)
    INTO v_summary
  FROM jsonb_array_elements(v_parent.tax_summary) e;

  SELECT * INTO v_seq, v_serial FROM allocate_document_serial('credit_note', v_fy);

  INSERT INTO credit_notes (
    invoice_id, refund_id, fy, seq, serial, issued_at, reason,
    original_invoice_number, original_invoice_date,
    seller_legal_name, seller_address, seller_gstin,
    buyer_name, buyer_gstin, buyer_address,
    place_of_supply_state, place_of_supply_code, signatory_name,
    is_igst, taxable_value_reduced, shipping_reduced,
    cgst_reduced, sgst_reduced, igst_reduced, total_reduced, tax_summary
  ) VALUES (
    v_parent.id, p_refund_id, v_fy, v_seq, v_serial, v_at, p_reason,
    v_parent.serial, v_parent.issued_at,
    v_parent.seller_legal_name, v_parent.seller_address, v_parent.seller_gstin,
    v_parent.buyer_name, v_parent.buyer_gstin, v_parent.shipping_address,
    v_parent.place_of_supply_state, v_parent.place_of_supply_code, v_parent.signatory_name,
    v_parent.is_igst,
    GREATEST(0, v_taxable - (v_cgst + v_sgst + v_igst)), v_ship,
    v_cgst, v_sgst, v_igst, v_refund.amount, v_summary
  )
  RETURNING * INTO v_note;

  RETURN v_note;
END $$;

REVOKE ALL ON FUNCTION issue_credit_note(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_credit_note(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Proving it
-- ---------------------------------------------------------------------------
-- These are views WITHOUT security_invoker, so they run as the owner and see
-- past RLS. That is deliberate and it matters: a security_invoker view over an
-- RLS'd table returns zero rows to anon — and "no rows" would make the series
-- check pass VACUOUSLY, which is worse than not having it. Granted to
-- service_role only.

-- from_seq must be 1 and missing must be 0, for every series, forever.
CREATE OR REPLACE VIEW invoice_series_integrity AS
SELECT 'invoice'::text AS doc_type, fy, MIN(seq) AS from_seq, MAX(seq) AS to_seq,
       COUNT(*) AS issued,
       COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled,
       (MAX(seq) - MIN(seq) + 1) - COUNT(*) AS missing
FROM invoices GROUP BY fy
UNION ALL
SELECT 'credit_note', fy, MIN(seq), MAX(seq), COUNT(*), 0,
       (MAX(seq) - MIN(seq) + 1) - COUNT(*)
FROM credit_notes GROUP BY fy;

COMMENT ON VIEW invoice_series_integrity IS
  'from_seq must be 1 and missing must be 0 for every row, always. Shaped like GSTR-1 Table 13.';

-- The check the series view cannot make. A gapless series says nothing about
-- supplies that were shipped and never invoiced at all — which is exactly what
-- happens while the GSTIN is NULL and every issue attempt is refused.
CREATE OR REPLACE VIEW uninvoiced_supplies AS
SELECT o.id AS order_id, o.order_number, o.status, o.payment_method, o.payment_status,
       o.shipped_at, o.delivered_at, o.total_amount
FROM orders o
LEFT JOIN invoices i ON i.order_id = o.id
WHERE i.id IS NULL
  AND o.status IN ('shipped', 'delivered')
ORDER BY o.shipped_at NULLS LAST;

COMMENT ON VIEW uninvoiced_supplies IS
  'Goods that left the building with no tax invoice. Must be empty. Watch this, not just the series.';

-- The Rule 53 side of the same blind spot.
CREATE OR REPLACE VIEW uncredited_refunds AS
SELECT r.id AS refund_id, r.order_id, o.order_number, r.amount, r.created_at, i.serial AS invoice_serial
FROM refunds r
JOIN orders o   ON o.id = r.order_id
JOIN invoices i ON i.order_id = r.order_id
LEFT JOIN credit_notes cn ON cn.refund_id = r.id
WHERE r.status = 'succeeded' AND cn.id IS NULL
ORDER BY r.created_at;

COMMENT ON VIEW uncredited_refunds IS
  'Money refunded against an issued invoice with no credit note — GST reversed for the customer but not reclaimed.';

-- Addresses whose state text matched nothing. These cannot be invoiced until a
-- human picks the state, and guessing would misfile the tax.
CREATE OR REPLACE VIEW addresses_without_state_code AS
SELECT id, user_id, state, city, postal_code FROM addresses WHERE state_code IS NULL;

REVOKE ALL ON invoice_series_integrity     FROM PUBLIC;
REVOKE ALL ON uninvoiced_supplies          FROM PUBLIC;
REVOKE ALL ON uncredited_refunds           FROM PUBLIC;
REVOKE ALL ON addresses_without_state_code FROM PUBLIC;
GRANT SELECT ON invoice_series_integrity, uninvoiced_supplies,
                uncredited_refunds, addresses_without_state_code TO service_role;

-- ---------------------------------------------------------------------------
-- 12. No backfill, deliberately
-- ---------------------------------------------------------------------------
-- Orders already shipped get no invoice. Back-numbering them would mean
-- inventing an issue date and an ordering for documents that were never issued,
-- and the numbers would not follow dispatch order — which is precisely the
-- "consecutive" property the series exists to have. Those orders show up in
-- `uninvoiced_supplies` so they are visible rather than forgotten, and what to
-- do about them is a decision for the seller's CA, executed as its own one-shot
-- migration if it is taken.