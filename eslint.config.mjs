import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // ── The design system, enforced ──────────────────────────────────────────
  //
  // `app/globals.css` has defined a seven-rung radius ladder, a lifted white
  // `--surface` and a four-rung elevation ladder since the palette was rebuilt.
  // Before this rule, almost none of it was used outside Trek Buddy: ~240
  // Tailwind-default radii, 75 places drawing a card as cream-on-cream, and the
  // shadow tokens referenced in three files total. That is what made the site
  // read as flat — not the palette.
  //
  // These are the cheapest possible guard against the debt coming back. They are
  // warnings, not errors, so an intentional exception is a one-line disable
  // comment rather than a blocked commit — but nothing drifts back silently.
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: [
      // shadcn primitives are generated against their own conventions, and the
      // admin panel deliberately runs on the shadcn token block rather than the
      // brand system — it is an internal tool.
      "components/ui/**",
      "components/admin/**",
      "app/admin/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // Tailwind's default radii are off the ladder. Use r-tag (4), r-input
          // (6), r-card (8), r-panel (10) or r-shell (14) — chosen by the size
          // of the thing being enclosed, since the ladder is monotonic with it.
          selector:
            "Literal[value=/(^|\\s)(sm:|md:|lg:|xl:|hover:|focus:)*rounded(-(sm|md|lg|xl|2xl|3xl))?(\\s|$)/]",
          message:
            "Off-ladder radius. Use the --r- ladder: r-tag, r-input, r-card, r-panel or r-shell — see WEB-POLISH.md section 1. (rounded-full and rounded-none are fine.)",
        },
        {
          // A card the same colour as the page behind it is not an object on a
          // page, it is a boxed-off region of the same page. Cards are white.
          // `rounded-full` is excluded deliberately: a pill is a chip, and a
          // cream chip sitting ON a white card is correct layering, not a flat
          // card. Only boxes that enclose content are cards.
          selector:
            "Literal[value=/(^|\\s)border\\s+border-rule(?!-)[^\"]*\\sbg-paper(\\s|$)/]:not([value=/rounded-full/])",
          message:
            "A bordered box filled with bg-paper sits invisibly on a paper ground. Use bg-surface with a shadow rung — see WEB-POLISH.md §1.",
        },
        {
          // `sand` and `rust` were used 17 times and defined nowhere; in
          // Tailwind v4 they compiled to nothing, so a confirm button rendered
          // cream text on a transparent background.
          selector: "Literal[value=/(^|\\s)(bg|text|border)-(sand|rust)(\\/|\\s|$)/]",
          message:
            "`sand` and `rust` are not theme tokens and compile to nothing. Use paper-deep / clay-deep.",
        },
        {
          // The palette is semantic; raw Tailwind hues bypass it and miss the
          // contrast work done on the real tokens.
          selector:
            "Literal[value=/(^|\\s)(bg|text|border|ring)-(red|amber|blue|green|emerald|gray|slate|zinc|neutral|stone)-[0-9]{2,3}(\\s|$)/]",
          message:
            "Raw Tailwind palette colour. Use the brand tokens — destructive is clay-deep, warning is dawn/ember.",
        },
      ],
    },
  },
]);

export default eslintConfig;
