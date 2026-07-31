import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@ai-media/sdk",
    "@ai-media/provider-aliyun-bailian",
    "@ai-media/provider-azure-openai",
  ],
};

export default nextConfig;
