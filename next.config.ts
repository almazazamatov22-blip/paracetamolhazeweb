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
        source: "/download/cs2haze",
        destination: "https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/latest/download/CS2Haze-Setup.exe",
        permanent: false,
      },
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
      {
        source: "/projects/twitch-overlays",
        destination: "/overlays",
        permanent: true,
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
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/download/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/admin",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/cs2xtwitch/admin",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/cs2xtwitch/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/cs2xtwitch/history",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/cs2xtwitch/history/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/overlays/:path+",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
