import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  // The world moved from /cabin; links already shared still arrive.
  redirects() {
    return [{ source: "/cabin", destination: "/my-world", permanent: true }];
  },
};

export default nextConfig;
