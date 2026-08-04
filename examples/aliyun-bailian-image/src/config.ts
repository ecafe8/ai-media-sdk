import type { AliyunBailianConfig } from "@ai-media/provider-aliyun-bailian";

export function readAliyunConfig(
  env: NodeJS.ProcessEnv = process.env
): AliyunBailianConfig {
  const missing = ["ALIYUN_BAILIAN_API_KEY", "ALIYUN_BAILIAN_BASE_URL"].filter(
    (name) => !env[name]
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  return {
    apiKey: env.ALIYUN_BAILIAN_API_KEY as string,
    baseUrl: env.ALIYUN_BAILIAN_BASE_URL as string,
  };
}

export function readAliyunModel(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.ALIYUN_BAILIAN_IMAGE_MODEL ||
    env.ALIYUN_BAILIAN_MODEL ||
    "qwen-image-2.0-pro-2026-06-22"
  );
}
