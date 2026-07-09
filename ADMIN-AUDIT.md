# DewDropz Admin — Audit & Rebuild Plan

Honest state of the admin panel as of today, what "industrial norm" actually means
here, and what's changing. Written as a working document, not a status report —
update it as phases land.

## The core problem

The data layer and CRUD logic are genuinely solid (verified table-by-table against
the live database — see the DB sync work from earlier this week). The gap is
everywhere else: **information architecture, missing surface area, and component
quality.** Every page works, but the panel reads like a set of independently-built
CRUD forms rather than one product. That's the "junior intern" feel — not broken
logic, missing structure.

## Page-by-page, as it stands

| Page | CRUD works? | Where it falls short of industry norm |
|---|---|---|
| Dashboard | Yes | 3 stat cards + a low-stock table. No trend, no time range, no revenue. |
| Products (list) | Yes | Search/paginate/bulk all real. Fine as a list. |
| Product editor | Yes | 5 separate Save buttons across tabs, no unsaved-changes state, no sticky save bar. Category picker is a raw scrollable checkbox list — unusable past ~20 categories. |
| Categories | Yes | Flat indented list + modal. No drag reorder despite `reorderCategories` existing. |
| Tags | Yes | Fine — smallest, simplest page, least in need of work. |
| Attributes | Yes | Fine, plain table+dialog. Works. |
| Collections | Yes | Fine. Storefront still reads from `lib/constants.ts`, not this table — flagged separately, not a UI problem. |
| Orders | Yes | Real status/payment workflow, ship dialog, refund dialog. Card-per-order layout gets heavy at volume; no saved filters. |
| Coupons | Yes | Fine. |
| Customers | Yes | List + LTV only. No customer detail page (order history, addresses) — you can see the number but not click into a person. |
| Reviews | Yes | Fine. |
| Newsletter | Yes | List + CSV export. Fine. |
| Settings | Yes | General/Shipping/Tax tabs are real and wired to checkout now. No store logo, no roles, no email templates. |
| **Analytics** | **Did not exist** | No revenue trend, no top products, no channel/AOV data anywhere. |
| **Payments** | **Did not exist** | Payment status lives buried inside Orders. No reconciliation view, no webhook event log, no gateway-level visibility. |

Global chrome: the sidebar is one flat unsorted list of 12 links with no grouping.
The header is an empty div and a sign-out button — no breadcrumb, no admin identity,
no search. That chrome is what every page sits inside, so it sets the tone for the
whole panel regardless of how good any individual CRUD page is.

## What "industrial norm" means, concretely

Looked at how Shopify, Stripe Dashboard, and Linear structure this, since those are
the reference points worth building toward:

- **Grouped navigation**, not a flat list — Catalog / Sales / Marketing / Customers /
  Settings, so the sidebar reads as a map of the business, not a list of tables.
- **A header that orients you** — breadcrumb for where you are, who's logged in.
- **Analytics as a first-class page** — revenue over time, top sellers, order mix.
  Every one of these platforms leads with this; it wasn't built here at all.
- **Payments as its own surface** — a transaction ledger, not a field buried in the
  Orders card.
- **Searchable comboboxes for many-to-many pickers** — nobody scrolls a 40-item
  checkbox list to tag a product; you type to filter.

## This pass — what's being built

1. Sidebar rebuilt with grouped sections, active-state polish, collapsible groups.
2. Header rebuilt with a real breadcrumb + admin identity.
3. New `Combobox`/`MultiCombobox` components (Radix Popover + cmdk, matching the
   shadcn conventions the rest of `components/ui` already follows) — applied to the
   product editor's category picker first, since that's the worst offender.
4. New **Analytics** page — revenue trend chart, top products by revenue, order
   status mix, AOV — built from real `orders`/`order_items` data via `recharts`.
5. New **Payments** page — transaction ledger across all orders (method, status,
   amounts, refund notes) plus the raw `webhook_events` log, since that table has
   existed since migration 001 and nothing has ever surfaced it.

## Deliberately deferred (not started, flagging so it isn't forgotten)

- Multi-admin roles/permissions (right now "admin" is one undifferentiated role).
- An audit log of admin actions (who changed what, when).
- Global command palette / search (⌘K).
- Customer detail page (click into a person, not just see them in a list).
- Product editor unsaved-changes indicator + single sticky save bar across tabs.
- Drag-to-reorder categories (the action already exists, the UI doesn't call it).
- CSV import for products/categories.
- Store logo upload + email template management in Settings.

These are real gaps, not invented ones — each came up during this audit. They're
being named here instead of silently built or silently dropped.
