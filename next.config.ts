import type { NextConfig } from "next";

const supabasePatterns = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`)]
  : [];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://images.unsplash.com/**"),
      ...supabasePatterns,
    ],
  },
};

export default nextConfig;
