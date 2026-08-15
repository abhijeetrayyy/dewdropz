-- What the print file actually is.
--
-- Print files were being produced at wildly different resolutions by two
-- renderers that disagreed (the mobile path hardcoded a 4× scale and shipped
-- 71 DPI files for a 12-inch print), and nothing recorded the result — so the
-- only way to find out whether a file was printable was to download it and
-- measure it by hand. Which is how it reached production unnoticed.
--
-- Stored per side because a design can be printed front and back at different
-- effective resolutions: the ceiling is whatever artwork the customer supplied.

ALTER TABLE custom_designs ADD COLUMN IF NOT EXISTS front_print_dpi INT;
ALTER TABLE custom_designs ADD COLUMN IF NOT EXISTS back_print_dpi  INT;

COMMENT ON COLUMN custom_designs.front_print_dpi IS
  'Effective DPI of front_print_url at the zone''s physical width. NULL means the file predates this being recorded — measure before printing.';
