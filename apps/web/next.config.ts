import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const apiInternal = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const mediaHost = (() => {
  if (!mediaBase) return null;
  try {
    return new URL(mediaBase);
  } catch {
    return null;
  }
})();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      ...(mediaHost
        ? [
            {
              protocol: mediaHost.protocol.replace(":", "") as "http" | "https",
              hostname: mediaHost.hostname,
              ...(mediaHost.port ? { port: mediaHost.port } : {}),
              pathname: "/**",
            },
          ]
        : []),
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternal}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    const base = [{ source: "/:path*", headers: securityHeaders }];
    const admin = [
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
    return isProd ? [...base, ...admin] : [...base, ...admin];
  },
};

export default nextConfig;
