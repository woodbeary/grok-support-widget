import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../../'), // Monorepo root for hoisted deps resolution
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // Or specify localhost:3000
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-customer-id" },
        ]
      },
      {
        source: "/chat",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" }, // Allow iframe embedding
          { key: "Content-Security-Policy", value: "frame-ancestors *" } // Modern CSP for embedding
        ]
      }
    ]
  }
};

export default nextConfig;
