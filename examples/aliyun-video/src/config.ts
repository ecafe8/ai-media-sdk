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

export function readAliyunVideoModels(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const value = env.ALIYUN_BAILIAN_VIDEO_MODEL;
  return value
    ? value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : ["happyhorse-1.1-t2v"];
}

/**
 * Read optional example inputs for r2v/video-edit modes.
 *
 * - `ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS`: comma-separated reference image URLs.
 * - `ALIYUN_BAILIAN_INPUT_VIDEO_URL`: a public source video URL for video-edit.
 */
export interface AliyunVideoExampleInputs {
  readonly referenceImageUrls: string[];
  readonly inputVideoUrl?: string;
}

export function readAliyunVideoExampleInputs(
  env: NodeJS.ProcessEnv = process.env
): AliyunVideoExampleInputs {
  const raw = env.ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS;
  const referenceImageUrls = raw
    ? raw
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : [];
  const inputVideoUrl = env.ALIYUN_BAILIAN_INPUT_VIDEO_URL?.trim() || undefined;
  return { referenceImageUrls, inputVideoUrl };
}
