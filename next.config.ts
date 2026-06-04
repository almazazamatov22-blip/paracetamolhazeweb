import type { NextConfig } from "next";

const lotomalUrl = process.env.NEXT_PUBLIC_LOTOMAL_URL || "https://lotomal.paracetamol.workers.dev";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async redirects() {
    return [
      {
        source: "/lotomal",
        destination: lotomalUrl,
        permanent: false,
      },
      {
        source: "/lotomal/:path*",
        destination: `${lotomalUrl}/:path*`,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/overlays',
        destination: '/overlays/index.html',
      },
      {
        source: '/overlays/dashboard',
        destination: '/overlays/dashboard.html',
      },
      {
        source: '/overlays/roll',
        destination: '/overlays/roll.html',
      },
    ]
  },
};

export default nextConfig;
