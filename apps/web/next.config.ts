import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load the single .env file from the project root (orbit/.env)
loadEnvConfig(path.resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
  // @orbit/db ships TypeScript source, so Next must compile it
  transpilePackages: ["@orbit/db"],
};

export default nextConfig;
