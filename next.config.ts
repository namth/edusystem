import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/guideline",
        destination: "/guideline/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
