import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../../'), // Monorepo root for hoisted deps resolution
  },
};

export default nextConfig;
