import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

// Load the single .env file from the project root (orbit/.env)
loadEnvConfig(path.resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
  // Add any other existing config you had here (like allowedDevOrigins if you used it)
};

export default nextConfig;