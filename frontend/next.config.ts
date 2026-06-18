import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/admin/crops',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
