-- 009's CREATE OR REPLACE FUNCTION added p_reference_type/p_reference_id as new
-- parameters, but Postgres only replaces a function with an *identical* argument
-- list — a different arity creates a second overload instead of replacing the
-- first. That left two adjust_stock_atomic functions live at once (5-arg and
-- 7-arg), which risks PostgREST failing with "function is not unique" when a
-- caller (like variants.ts's adjustStock()) passes only the original 5 named
-- arguments, since both overloads are then valid candidates via defaults.
DROP FUNCTION IF EXISTS adjust_stock_atomic(UUID, INT, TEXT, UUID, TEXT);
