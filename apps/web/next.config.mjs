/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@veylo/types",
    "@veylo/core",
    "@veylo/mcp-client",
    "@veylo/agent",
    "@veylo/ai",
    "@veylo/local-discovery",
    "@veylo/db",
  ],
};

export default nextConfig;

