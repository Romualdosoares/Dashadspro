import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "scontent.fbcdn.net" },
      { protocol: "https", hostname: "lookaside.fbsbx.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.fna.fbcdn.net" },
    ],
  },
};

export default nextConfig;
