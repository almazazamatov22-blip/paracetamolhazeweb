import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
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
      {
        source: '/lotomal',
        destination: '/lotomal/index.html',
      },
      {
        source: '/lotomal/admin',
        destination: '/lotomal/admin.html',
      },
      {
        source: '/lotomal/overlay',
        destination: '/lotomal/overlay.html',
      },
    ]
  },
};

export default nextConfig;
