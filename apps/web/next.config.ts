/**
 * Next.js configuration for the Loocbooc web app.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.loocbooc.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
  experimental: {
    // Turbopack for faster dev builds (stable in Next 14.1)
    turbo: {},
  },
};

export default nextConfig;
