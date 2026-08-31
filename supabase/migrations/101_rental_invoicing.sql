-- ---------------------------------------------------------------------------
-- 101 — a rental gets a tax invoice, on the machinery that already exists
-- ---------------------------------------------------------------------------
--
-- 048 built the invoicing properly: a row-locked serial counter that gives its
-- number back on rollback, a frozen supplier snapshot, a financial year taken
-- from the supply rather than the clock, an append-only trigger that freezes
-- any column added later by default, and — the part that matters most — a
-- function that REFUSES rather than prints something false.
--
-- None of that should be built a second time for rentals. A parallel invoice
-- table would mean two serial series, and GSTR-1 Table 13 reports a series as
-- from / to / total / cancelled: two independent series that both call
-- themselves the shop's invoices is a reconciliation problem invented for no
-- reason. So this migration widens the existing table by one nullable column
-- and adds a second issue function beside the first.
--
-- FOUR THINGS A RENTAL INVOICE DOES DIFFERENTLY, AND WHY
--
-- 1. SAC, NOT HSN. Renting equipment is a supply of SERVICE. Rule 46(f) wants
--    the code either way, but a reader has to know which classification they
--    are looking at, so the line carries a `code_type` rather than quietly
--    putting an SAC in a column called `hsn_code`.
--
-- 2. THE UNIT IS A DAY. `uqc` already lives on the line, and for a rental the
--    quantity that was supplied is days × units, not pieces.
--
-- 3. FREIGHT IS TAXED. On the sale side `shipping_is_taxable` is false and the
--    invoice carries zero freight tax. A rental's delivery is charged both ways
--    and taxed at the same service rate as the rental it belongs to — the pricer
--    has always done this — so the freight columns on `invoices`, which have
--    been sitting at zero since 048, finally get used.
--
-- 4. THE DEPOSIT IS NOT ON THE INVOICE AT ALL. It is refundable security, not
--    consideration for a supply under s.7, so it is neither a taxable value nor
--    part of the grand total. It is printed as a memorandum line by the
--    renderer, clearly outside the totals, because a customer who handed over
--    ₹9,000 will look for it and its absence would read as an error.
--
-- WHAT IS DELIBERATELY NOT DONE HERE
--
-- Late fees and damage charges are not invoiced by this function. They are
-- consideration for a supply and do need a document, but they are known only
-- at return — after this invoice has been issued — and the correct instrument
-- is a supplementary invoice or a debit note under s.34(3), which needs its own
-- decision about timing and its own series treatment. Issuing them here would
-- mean either holding the invoice back until the gear returns (so the customer
-- has no document while they hold the goods) or reissuing (which means
-- cancelling a spent number). Both are worse than a follow-up document.
-- ---------------------------------------------------------------------------

-- ── One nullable column, and the constraints that keep it honest ───────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS rental_booking_id UUID REFERENCES rental_bookings(id) ON DELETE RESTRICT;

COMMENT ON COLUMN invoices.rental_booking_id IS
  'Set instead of order_id for a rental invoice. RESTRICT for the same reason order_id is: s.36 requires records for 72 months, so an invoiced booking cannot be deleted.';

-- `order_id` was NOT NULL. It cannot stay that way now that a document may
-- belong to a booking instead — but the pair must still be exclusive, because
-- an invoice that references both is a document about two supplies.
ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_one_subject;
ALTER TABLE invoices ADD CONSTRAINT invoices_one_subject
  CHECK (num_nonnulls(order_id, rental_booking_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_rental
  ON invoices(rental_booking_id) WHERE rental_booking_id IS NOT NULL;

-- `order_number` is NOT NULL and printed as the reference. A rental has a
-- booking number in exactly the same role, so the column is reused rather than
-- a second one added — but the name would then lie about half its rows, so it
-- gains a comment rather than a sibling.
COMMENT ON COLUMN invoices.order_number IS
  'The customer-facing reference for whatever this invoice is about: an order number, or a rental booking number. One column because it fills one role.';

-- ── Which classification a line is quoting ─────────────────────────────────
--
-- Defaulting to HSN means every one of the existing rows keeps its current
-- meaning without a backfill, and it is the right default: goods are the
-- ordinary case for this shop.

ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS code_type TEXT NOT NULL DEFAULT 'HSN'
    CHECK (code_type IN ('HSN', 'SAC'));

COMMENT ON COLUMN invoice_lines.code_type IS
  'Whether hsn_code holds an HSN (goods) or an SAC (service). A rental is a service; printing an SAC under a heading that says HSN is a defect a reader cannot detect.';

-- Rentals are billed in unit-days, which can legitimately be large — ten tents
-- for thirty days is 300 — so nothing about the quantity check changes, but the
-- unit does. `uqc` already defaults to PCS and is set per line.

-- ── Issuing one ────────────────────────────────────────────────────────────
--
-- Mirrors `issue_invoice` deliberately, refusal for refusal. Where the two
-- differ, the difference is commented. Everything that can refuse does so
-- BEFORE a serial is allocated — past that line a number has been spent, and
-- nothing below it may fail for a reason that could have been checked first.

CREATE OR REPLACE FUNCTION issue_rental_invoice(
  p_booking_id UUID,
  p_supply_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS invoices
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking  rental_bookings%ROWTYPE;
  v_settings store_settings%ROWTYPE;
  v_invoice  invoices;
  v_at       TIMESTAMPTZ;
  v_fy       TEXT;
  v_seq      INT;
  v_serial   TEXT;
  v_pos_state TEXT;
  v_pos_code  CHAR(2);
  v_is_igst   BOOLEAN;
  v_buyer_gstin TEXT;
  v_addr      JSONB;
  v_line_count INT;
  v_unpriced   INT;
  v_taxable  INT;
  v_cgst     INT;
  v_sgst     INT;
  v_igst     INT;
  v_ship_rate    NUMERIC(5,2);
  v_ship_tax     INT;
  v_ship_cgst    INT;
  v_ship_sgst    INT;
  v_ship_igst    INT;
  v_summary  JSONB;
  v_grand    INT;
BEGIN
  -- Per-booking gate first, before the counter is touched — allocating and then
  -- finding a document already exists would mean handing a number back.
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.invoice'), hashtext(p_booking_id::text));

  SELECT * INTO v_invoice FROM invoices WHERE rental_booking_id = p_booking_id;
  IF FOUND THEN
    RETURN v_invoice;                       -- retry: same document, no allocation
  END IF;

  PERFORM set_config('lock_timeout', '5s', true);

  SELECT * INTO v_booking FROM rental_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental booking % does not exist', p_booking_id USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_settings FROM store_settings WHERE id = 1;

  -- ---- refusals ------------------------------------------------------------
  -- Identical to the sale path, and identical for the same reasons.

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
  IF left(v_settings.gstin, 2) <> v_settings.seller_state_code THEN
    RAISE EXCEPTION 'cannot issue: GSTIN % does not start with the seller state code %',
      v_settings.gstin, v_settings.seller_state_code USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT v_settings.enable_tax THEN
    RAISE EXCEPTION 'cannot issue: enable_tax is false while a GSTIN is configured.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'cannot issue for a cancelled rental (%)', v_booking.booking_number
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF COALESCE(v_booking.total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'cannot issue a zero-value tax invoice for %', v_booking.booking_number
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A rental booked before migration 100 has no per-line tax, exactly as an
  -- order placed before 036 had none. 100 backfills what can be known
  -- truthfully; anything still unpriced is invoiced by hand rather than guessed.
  SELECT count(*), count(*) FILTER (WHERE taxable_value = 0 OR gst_rate IS NULL)
    INTO v_line_count, v_unpriced
  FROM rental_reservations WHERE booking_id = p_booking_id AND status <> 'cancelled';

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'rental % has no live reservations', v_booking.booking_number
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_unpriced > 0 THEN
    RAISE EXCEPTION 'rental % has % line(s) with no taxable value (booked before migration 100) — invoice by hand',
      v_booking.booking_number, v_unpriced USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ---- place of supply ------------------------------------------------------
  --
  -- THE ONE PLACE THIS GENUINELY DIVERGES FROM THE SALE PATH.
  --
  -- For posted gear the recipient's address decides it, as it does for goods.
  -- For gear COLLECTED FROM THE SHOP there is no recipient address at all — and
  -- the answer is not "unknown", it is the shop. Under IGST Act s.10(1)(ca) the
  -- place of supply where no address is recorded is the supplier's location, and
  -- a service performed by handing something over a counter in Dehradun is
  -- supplied in Uttarakhand. So a pickup is always intra-state, and that is a
  -- determination made here rather than a fallback that hides a missing value.
  IF v_booking.fulfilment = 'ship' THEN
    v_addr := v_booking.address;
    IF v_addr IS NULL THEN
      RAISE EXCEPTION 'cannot issue for %: a posted rental with no address cannot have a place of supply',
        v_booking.booking_number USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF lower(COALESCE(v_addr->>'country', 'india')) NOT IN ('india', 'in') THEN
      RAISE EXCEPTION 'cannot issue for %: exports are not supported', v_booking.booking_number
        USING ERRCODE = 'feature_not_supported';
    END IF;
    v_pos_state := NULLIF(btrim(v_addr->>'state'), '');
    v_pos_code  := resolve_state_code(v_pos_state);
    IF v_pos_code IS NULL THEN
      RAISE EXCEPTION 'cannot issue for %: delivery state "%" does not resolve to a GST state code',
        v_booking.booking_number, COALESCE(v_pos_state, '(blank)') USING ERRCODE = 'invalid_parameter_value';
    END IF;
  ELSE
    v_addr      := jsonb_build_object(
                     'full_name', COALESCE(v_booking.email, ''),
                     'city',  v_settings.seller_city,
                     'state', v_settings.origin_state,
                     'postal_code', v_settings.seller_postal_code,
                     'country', 'India',
                     'collected_at_store', true
                   );
    v_pos_state := v_settings.origin_state;
    v_pos_code  := v_settings.seller_state_code;
  END IF;

  v_is_igst := v_pos_code <> v_settings.seller_state_code;

  -- ---- the financial year, from the supply ---------------------------------
  --
  -- For a rental the time of supply is when the gear goes out, not when the
  -- booking was made — somebody can book in March for a trek in May. Handover
  -- first, then dispatch, then the booking date as the last resort.
  v_at := COALESCE(p_supply_at, v_booking.dispatched_at, v_booking.paid_at, v_booking.created_at);
  v_fy := indian_fy(v_at);
  IF v_fy <> indian_fy(NOW()) THEN
    RAISE EXCEPTION 'refusing to auto-issue for % into FY % from FY % — a late invoice across a year boundary is a filing decision',
      v_booking.booking_number, v_fy, indian_fy(NOW()) USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ---- totals, computed before anything is written -------------------------
  --
  -- Integer division floors, so sgst = floor(tax/2) and cgst takes the odd
  -- paisa — matching splitTax() in lib/tax.ts, deliberately and exactly.
  SELECT
    COALESCE(SUM(r.taxable_value), 0),
    COALESCE(SUM(CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount - (r.tax_amount / 2) END), 0),
    COALESCE(SUM(CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount / 2 END), 0),
    COALESCE(SUM(CASE WHEN v_is_igst THEN r.tax_amount ELSE 0 END), 0)
    INTO v_taxable, v_cgst, v_sgst, v_igst
  FROM rental_reservations r
  WHERE r.booking_id = p_booking_id AND r.status <> 'cancelled';

  -- Freight, taxed. The rate is the highest on the booking, which is what the
  -- pricer charged — under-collecting is the worse of the two errors, and the
  -- document must state what was actually collected.
  SELECT COALESCE(MAX(r.gst_rate), 0) INTO v_ship_rate
  FROM rental_reservations r
  WHERE r.booking_id = p_booking_id AND r.status <> 'cancelled';

  v_ship_tax  := ROUND(COALESCE(v_booking.delivery_amount, 0) * v_ship_rate / 100);
  v_ship_cgst := CASE WHEN v_is_igst THEN 0 ELSE v_ship_tax - (v_ship_tax / 2) END;
  v_ship_sgst := CASE WHEN v_is_igst THEN 0 ELSE v_ship_tax / 2 END;
  v_ship_igst := CASE WHEN v_is_igst THEN v_ship_tax ELSE 0 END;

  v_grand := v_taxable + v_cgst + v_sgst + v_igst
           + COALESCE(v_booking.delivery_amount, 0) + v_ship_tax;

  -- The document must add up to what the customer was actually charged. If it
  -- does not, something upstream disagrees with the booking and the right answer
  -- is to stop before a serial is spent.
  --
  -- The deposit is excluded from both sides: `total_amount` on a booking has
  -- always been rent + delivery + tax, with the deposit reported separately, and
  -- that is exactly the figure an invoice should carry.
  IF v_grand <> v_booking.total_amount THEN
    RAISE EXCEPTION 'invoice for % does not reconcile: taxable % + tax % + freight % + freight tax % = % <> booking total %',
      v_booking.booking_number, v_taxable, v_cgst + v_sgst + v_igst,
      COALESCE(v_booking.delivery_amount, 0), v_ship_tax, v_grand, v_booking.total_amount
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Rate-wise summary, freight folded into its own rate's bucket so the block
  -- prints one line per rate rather than one per rate per subject.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'rate', t.rate, 'taxable', t.taxable, 'cgst', t.cgst,
           'sgst', t.sgst, 'igst', t.igst, 'cess', 0
         ) ORDER BY t.rate), '[]'::jsonb)
    INTO v_summary
  FROM (
    SELECT r.gst_rate AS rate,
           SUM(r.taxable_value)
             + CASE WHEN r.gst_rate = v_ship_rate THEN COALESCE(v_booking.delivery_amount, 0) ELSE 0 END AS taxable,
           SUM(CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount - (r.tax_amount / 2) END)
             + CASE WHEN r.gst_rate = v_ship_rate THEN v_ship_cgst ELSE 0 END AS cgst,
           SUM(CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount / 2 END)
             + CASE WHEN r.gst_rate = v_ship_rate THEN v_ship_sgst ELSE 0 END AS sgst,
           SUM(CASE WHEN v_is_igst THEN r.tax_amount ELSE 0 END)
             + CASE WHEN r.gst_rate = v_ship_rate THEN v_ship_igst ELSE 0 END AS igst
    FROM rental_reservations r
    WHERE r.booking_id = p_booking_id AND r.status <> 'cancelled'
    GROUP BY r.gst_rate
  ) t;

  -- ---- write it ------------------------------------------------------------
  SELECT * INTO v_seq, v_serial FROM allocate_document_serial('invoice', v_fy);

  v_buyer_gstin := NULLIF(btrim(COALESCE(v_addr->>'gstin', '')), '');

  INSERT INTO invoices (
    rental_booking_id, document_type, fy, seq, serial, issued_at,
    seller_legal_name, seller_trade_name, seller_address, seller_gstin,
    seller_state, seller_state_code, signatory_name, einvoice_declaration,
    buyer_name, buyer_legal_name, buyer_email, buyer_phone, buyer_gstin, supply_type,
    billing_address, shipping_address, delivery_address_differs,
    place_of_supply_state, place_of_supply_code, is_igst, reverse_charge,
    gross_value, discount_total,
    shipping_charge, shipping_taxable_value, shipping_tax_rate, shipping_tax_amount,
    taxable_total, cgst_total, sgst_total, igst_total, tax_summary,
    grand_total, currency,
    order_number, order_placed_at, payment_method, payment_status_at_issue
  ) VALUES (
    p_booking_id, 'tax_invoice', v_fy, v_seq, v_serial, v_at,
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
    COALESCE(NULLIF(btrim(COALESCE(v_addr->>'full_name', '')), ''), v_booking.email),
    NULLIF(btrim(COALESCE(v_addr->>'legal_name', '')), ''),
    v_booking.email, v_booking.phone, v_buyer_gstin,
    CASE WHEN v_buyer_gstin IS NULL THEN 'B2C' ELSE 'B2B' END,
    v_addr, v_addr, false,
    v_pos_state, v_pos_code, v_is_igst, false,
    -- Gross is the rent before any discount; the discount is stated rather than
    -- netted, because s.15(3)(a) only excludes a discount from value if it is
    -- recorded in the invoice.
    v_taxable + COALESCE(v_booking.long_rental_discount, 0) + COALESCE(v_booking.coupon_discount, 0),
    COALESCE(v_booking.long_rental_discount, 0) + COALESCE(v_booking.coupon_discount, 0),
    COALESCE(v_booking.delivery_amount, 0), COALESCE(v_booking.delivery_amount, 0),
    v_ship_rate, v_ship_tax,
    v_taxable, v_cgst + v_ship_cgst, v_sgst + v_ship_sgst, v_igst + v_ship_igst, v_summary,
    v_grand, 'INR',
    v_booking.booking_number, v_booking.created_at,
    v_booking.payment_method, v_booking.payment_status
  )
  RETURNING * INTO v_invoice;

  -- Lines. Quantity is unit-days and the unit says so, because "1 PCS" against
  -- a tent rented for three days tells a reader nothing about what was supplied.
  INSERT INTO invoice_lines (
    invoice_id, order_item_id, line_no, description,
    hsn_code, code_type, quantity, uqc,
    unit_price, gross_value, discount, taxable_value, tax_rate,
    cgst_amount, sgst_amount, igst_amount, line_total
  )
  SELECT
    v_invoice.id, NULL,
    row_number() OVER (ORDER BY r.created_at, r.id),
    i.name || ' — ' || to_char(r.starts_on, 'DD Mon') || ' to ' || to_char(r.ends_on, 'DD Mon YYYY')
      || ' (' || r.days || ' day' || CASE WHEN r.days = 1 THEN '' ELSE 's' END || ')',
    COALESCE(r.sac_code, i.sac_code, '997314'), 'SAC',
    r.days, 'DAY',
    r.daily_rate,
    r.taxable_value + r.discount_amount,
    r.discount_amount,
    r.taxable_value, r.gst_rate,
    CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount - (r.tax_amount / 2) END,
    CASE WHEN v_is_igst THEN 0 ELSE r.tax_amount / 2 END,
    CASE WHEN v_is_igst THEN r.tax_amount ELSE 0 END,
    r.taxable_value + r.tax_amount
  FROM rental_reservations r
  JOIN rental_items i ON i.id = r.item_id
  WHERE r.booking_id = p_booking_id AND r.status <> 'cancelled';

  -- Head and lines must agree. Freight lives only on the head, so it is added
  -- back before the comparison rather than being allowed to look like a
  -- discrepancy.
  PERFORM 1 FROM (
    SELECT COALESCE(SUM(taxable_value), 0) t, COALESCE(SUM(cgst_amount), 0) c,
           COALESCE(SUM(sgst_amount), 0) s, COALESCE(SUM(igst_amount), 0) i
    FROM invoice_lines WHERE invoice_id = v_invoice.id
  ) x
  WHERE x.t <> v_taxable
     OR x.c + v_ship_cgst <> v_cgst + v_ship_cgst
     OR x.s + v_ship_sgst <> v_sgst + v_ship_sgst
     OR x.i + v_ship_igst <> v_igst + v_ship_igst;
  IF FOUND THEN
    RAISE EXCEPTION 'rental invoice % head and lines disagree — refusing to leave a self-contradictory document',
      v_serial USING ERRCODE = 'internal_error';
  END IF;

  RETURN v_invoice;
END $$;

REVOKE ALL ON FUNCTION issue_rental_invoice(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_rental_invoice(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION issue_rental_invoice(UUID, TIMESTAMPTZ) IS
  'Issue a GST tax invoice for a rental booking on the same serial series as sales. Refuses rather than printing a defective document; every refusal happens before a number is allocated.';

-- ── Customers can read their own rental invoice ────────────────────────────
--
-- 048 gave customers a SELECT policy over invoices for their own orders. The
-- same has to be true of a rental, or the policy silently means "sales only"
-- and every rental invoice becomes admin-visible with no explanation.
--
-- Guest rentals have no user_id, exactly like guest orders, and are served
-- through the same signed-link route rather than through RLS.

DROP POLICY IF EXISTS "Customers read own rental invoices" ON invoices;
CREATE POLICY "Customers read own rental invoices" ON invoices
  FOR SELECT TO authenticated USING (
    rental_booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM rental_bookings b
       WHERE b.id = invoices.rental_booking_id
         AND b.user_id = auth.uid()
    )
  );
