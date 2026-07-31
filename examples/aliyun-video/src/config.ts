import type { AliyunBailianConfig } from "@ai-media/provider-aliyun-bailian";

/**
 * Read the Aliyun HappyHorse video example configuration from the environment.
 *
 * Requires the same `ALIYUN_BAILIAN_API_KEY` + region-scoped `ALIYUN_BAILIAN_BASE_URL`
 * as the image example; video generation reuses the DashScope async task
 * endpoint. Only the API key is required at the provider level; the example
 * also requires the base URL to keep the config explicit.
 */
export function readAliyunVideoConfig(
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

export function readAliyunVideoModel(
  env: NodeJS.ProcessEnv = process.env
): string {
  return env.ALIYUN_BAILIAN_VIDEO_MODEL || "happyhorse-1.1-t2v";
}
