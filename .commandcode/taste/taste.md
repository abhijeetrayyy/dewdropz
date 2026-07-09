# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# git
- For GitHub operations in this project, use the `github-personal-alt` SSH host alias instead of default `git@github.com`. Confidence: 0.70

# architecture
- Storefront code (app/, components/sections/, providers/) and admin backend (app/admin/, actions/, migrations/) are strictly decoupled. Never edit storefront files — surface area is migrations, server actions, route handlers, admin UI, and supporting business logic. Confidence: 0.85
- Admin UI uses plain, functional, data-dense components (tables, forms, filters, modals) under components/admin/. Do not import or reuse storefront components, GSAP hooks, or animation libraries in admin. Confidence: 0.30
- Next.js Server Actions (actions/*.ts) for React-called backend logic; Route Handlers (app/api/*) only for webhooks and external callbacks. Confidence: 0.80
- All monetary values in paise (INR minor units) as integers. Never use float. All IDs use uuid_generate_v4(). Confidence: 0.85

# workflow
- Build phases in order: migration → RLS policies → server actions → admin UI → manual verification. Do not skip or reorder steps within a phase. Confidence: 0.75
- Database migrations are additive only, numbered sequentially from 004 onward. Never edit existing migrations (001-003) in place. Confidence: 0.85
- Every admin server action must include an auth check using requireAdmin() from actions/auth.ts. Confidence: 0.80

# ui
- Use shadcn/ui components for all admin pages — replace plain functional components with shadcn equivalents for dialogs, tables, forms, buttons, and layout. Confidence: 0.85
- Admin uses light theme with black buttons, black text, and high-contrast UI. Confidence: 0.80

# nextjs
- Next.js 16.x uses `proxy.ts` (not `middleware.ts`) for middleware, and must export either a named `proxy` function or a default function. Confidence: 0.85

# admin
- All admin pages must be fully functional with complete CRUD operations — never leave placeholder "Coming soon" pages or non-functional UI. Build production-quality admin features end-to-end. Confidence: 0.70
- Never import or call createAdminSupabaseClient() from client components (browser). SUPABASE_SERVICE_ROLE_KEY is undefined in the browser — all admin data fetching must go through server actions that call the admin client server-side. Confidence: 0.80

