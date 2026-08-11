import type { NextConfig } from "next";

// `new URL(...)` shorthand implicitly locks `search: ''` (no query string
// allowed at all) — real product photos come through with `?w=800` etc.
// (both from seeded Unsplash URLs and Supabase Storage's public URLs), so
// these need the object form with `search` omitted entirely to allow any
// query string, not the shorthand.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabasePatterns = supabaseUrl
  ? [{ protocol: "https" as const, hostname: supabaseUrl.hostname, pathname: "/storage/v1/object/public/**" }]
  : [];

const nextConfig: NextConfig = {
  // @napi-rs/canvas loads a platform-specific .node binary at runtime, which
  // the bundler can't trace or inline — bundling it fails with "Cannot find
  // native binding". Keeping it external makes the route require it normally.
  serverExternalPackages: ["@napi-rs/canvas"],
  experimental: {
    // Every customer upload goes through a Server Action (uploadCustomerImage),
    // and Server Actions default to a 1MB request body. That silently capped
    // the studio far below the 10MB the upload validation itself advertises:
    // any photo over 1MB — and every print-resolution export — died with a raw
    // "Body exceeded 1 MB limit" instead of ever reaching our own checks.
    // 12MB leaves room for the 8.5MB print budget plus multipart overhead.
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "images.unsplash.com", pathname: "/**" },
      ...supabasePatterns,
    ],
  },
};

export default nextConfig;
