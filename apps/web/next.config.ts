import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@ai-media/sdk",
    "@ai-media/provider-aliyun-bailian",
    "@ai-media/provider-azure-openai",
    "@ai-media/provider-minimax",
    "@ai-media/provider-seedream",
  ],
};

export default nextConfig;
