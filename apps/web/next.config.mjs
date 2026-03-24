/**
 * Next.js configuration for the Loocbooc web app.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Enable standalone output for Docker deployment
  // Creates a self-contained build in .next/standalone
  output: "standalone",

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
      {
        // MinIO / S3 for local development
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
    ],
  },

  // Enable experimental features
  experimental: {
    // Turbopack for faster dev builds
    turbo: {},
  },

  // Suppress console spam from dependency warnings
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // TypeScript strict mode - errors fail build
  typescript: {
    // Don't ignore build errors
    ignoreBuildErrors: false,
  },

  // ESLint must pass for build
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
