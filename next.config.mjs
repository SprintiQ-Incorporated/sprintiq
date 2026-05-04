/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable Next.js image optimization for better LCP
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Optimize image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  // 301 Redirects for old use case URLs to new structure
  async redirects() {
    return [
      // Manifest redirect - browsers may request /manifest.json by default
      {
        source: "/manifest.json",
        destination: "/site.webmanifest",
        permanent: true,
      },
      // Old use-case paths that might exist as direct routes
      {
        source: "/use-cases/overwhelmed-product-managers",
        destination: "/use-cases/product-managers",
        permanent: true,
      },
      {
        source: "/use-cases/frustrated-development-teams",
        destination: "/use-cases/scrum-masters",
        permanent: true,
      },
      {
        source: "/use-cases/dual-scrum-master-dev",
        destination: "/use-cases/scrum-masters",
        permanent: true,
      },
      {
        source: "/use-cases/lost-startups",
        destination: "/use-cases/scaling-startups",
        permanent: true,
      },
      {
        source: "/use-cases/teams-skill-mismatches",
        destination: "/use-cases/engineering-leaders",
        permanent: true,
      },
      {
        source: "/use-cases/skill-mismatches",
        destination: "/use-cases/engineering-leaders",
        permanent: true,
      },
      {
        source: "/use-cases/beginners",
        destination: "/use-cases/product-managers",
        permanent: true,
      },
      {
        source: "/use-cases/scope-creep-struggles",
        destination: "/use-cases/product-managers",
        permanent: true,
      },
      {
        source: "/use-cases/scope-creep",
        destination: "/use-cases/product-managers",
        permanent: true,
      },
      {
        source: "/use-cases/individual-contributor-scrum-masters",
        destination: "/use-cases/scrum-masters",
        permanent: true,
      },
      {
        source: "/use-cases/individual-contributor-scrum-master",
        destination: "/use-cases/scrum-masters",
        permanent: true,
      },
      {
        source: "/use-cases/technical-debt-balance-management",
        destination: "/use-cases/engineering-leaders",
        permanent: true,
      },
      {
        source: "/use-cases/technical-debt-balance",
        destination: "/use-cases/engineering-leaders",
        permanent: true,
      },
      {
        source: "/use-cases/post-series-a-startups",
        destination: "/use-cases/scaling-startups",
        permanent: true,
      },
      {
        source: "/use-cases/investor-reporting-automation",
        destination: "/use-cases/enterprise-teams",
        permanent: true,
      },
      // Waitlist routes closed — redirect to signup
      {
        source: "/waitlist",
        destination: "/signup",
        permanent: true,
      },
      {
        source: "/api/waitlist",
        destination: "/signup",
        permanent: true,
      },
    ];
  },
  // Performance Optimizations
  experimental: {
    // Optimize bundle size
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "framer-motion",
      "date-fns",
    ],
  },
  // Compression and caching optimizations
  compress: true,
  poweredByHeader: false,
  // Security headers for better performance
  async headers() {
    return [
      {
        // Manifest file headers
        source: "/site.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Static assets - long cache for TTFB optimization
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Optimized images - long cache
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Font files - long cache for LCP optimization
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public images - moderate cache with revalidation
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // API routes - allow SAMEORIGIN framing for iframe form submissions
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      {
        // Non-API routes - strict security headers
        source: "/((?!api/).*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // HTTP/2 specific optimizations
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
