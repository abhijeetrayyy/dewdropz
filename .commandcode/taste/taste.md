# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# git
- For GitHub operations in this project, use the `github-personal-alt` SSH host alias instead of default `git@github.com`. Confidence: 0.70
- Always push directly to `main` on the `dewdropz` remote (`git push dewdropz main`). Never use feature branches or pull requests in this project. Add descriptive commit messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Confidence: 0.80
- Scope git pushes precisely: when the user says "push the store front," only push customer-facing/public files (app/, components/, providers/, lib/constants.ts, public/) — explicitly exclude admin-only files (app/admin/, components/admin/, actions/ that are admin-gated, supabase/migrations/). Use `git add <exact files>` rather than wildcards. Confidence: 0.75

# architecture
- Storefront code (app/, components/sections/, providers/) and admin backend (app/admin/, actions/, migrations/) are strictly decoupled. Never edit storefront files — surface area is migrations, server actions, route handlers, admin UI, and supporting business logic. Confidence: 0.85
- Admin UI uses plain, functional, data-dense components (tables, forms, filters, modals) under components/admin/. Do not import or reuse storefront components, GSAP hooks, or animation libraries in admin. Confidence: 0.30
- Next.js Server Actions (actions/*.ts) for React-called backend logic; Route Handlers (app/api/*) only for webhooks and external callbacks. Confidence: 0.80
- All monetary values in paise (INR minor units) as integers. Never use float. All IDs use uuid_generate_v4(). Confidence: 0.85

# workflow
- Build phases in order: migration → RLS policies → server actions → admin UI → manual verification. Do not skip or reorder steps within a phase. Confidence: 0.75
- Database migrations are additive only, numbered sequentially from 004 onward. Never edit existing migrations (001-003) in place. Confidence: 0.85
- Every admin server action must include an auth check using requireAdmin() from actions/auth.ts. Confidence: 0.80
- HTML design documentation files (screenshot storybooks, client-facing design PDFs) are deliverables kept outside the git repository. Do not commit them unless explicitly instructed. The user converts HTML to PDF manually for client sharing. Confidence: 0.70

# ui
- Use shadcn/ui components for all admin pages — replace plain functional components with shadcn equivalents for dialogs, tables, forms, buttons, and layout. Confidence: 0.85
- Admin uses light theme with black buttons, black text, and high-contrast UI. Confidence: 0.80

# nativewind
- NativeWind (including v4) only supports Tailwind CSS v3, not v4. Use `tailwindcss@^3.4.0` with CommonJS `tailwind.config.js` and `@tailwind base/components/utilities` directives in CSS. Confidence: 0.75

# nextjs
- Next.js 16.x uses `proxy.ts` (not `middleware.ts`) for middleware, and must export either a named `proxy` function or a default function. Confidence: 0.85

# admin
- All admin pages must be fully functional with complete CRUD operations — never leave placeholder "Coming soon" pages or non-functional UI. Build production-quality admin features end-to-end. Confidence: 0.70
- Never import or call createAdminSupabaseClient() from client components (browser). SUPABASE_SERVICE_ROLE_KEY is undefined in the browser — all admin data fetching must go through server actions that call the admin client server-side. Confidence: 0.80

# mobile
- Mobile app screens must match the web app's design fidelity — no placeholder icons (unicode symbols like ▲ ♥ ♡ ⏐ ☷ ⌂ ◎), no placeholder images ("D" text fallback), no toy/prototype-quality elements. Every screen (not just the homepage) must be production-polished with proper icon components, real Logo component, and complete copy. UI/UX across ALL pages must feel advanced, mature, and highly polished — not basic or prototype-grade. Confidence: 0.80
- Before building mobile app screens, study the existing web project thoroughly and create a markdown reference document covering all pages, components, UI patterns, and UX. Then follow that document to ensure mobile UI/UX is consistent with the web experience. Confidence: 0.70

# expo
- For Expo mobile development, use Expo Go mode (`npx expo start` then press `a` for Android) instead of `npx expo run:android`. Avoid running `npx expo prebuild` as it creates `android/` and `ios/` directories that force a slow native Gradle/Xcode development build. If `android/` or `ios/` directories already exist, delete them to revert to Expo Go mode. Confidence: 0.75

# communication
- When resuming from context window breaks, do not acknowledge the summary, do not recap what was happening, and do not preface with "I'll continue." Pick up the last task as if the break never happened. The user values forward momentum over context-reestablishment. Confidence: 0.80

# debugging
- Diagnose the full problem and understand root causes before taking action. Do not fire commands reactively and fix errors one at a time as they appear — anticipate what's needed, validate assumptions first, then proceed with the complete solution. Confidence: 0.70

