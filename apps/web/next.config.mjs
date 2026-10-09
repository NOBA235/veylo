/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@veylo/types", "@veylo/core", "@veylo/mcp-client", "@veylo/agent"],
};

export default nextConfig;

