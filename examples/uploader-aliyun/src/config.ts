import type { AliyunBailianConfig } from "@ai-media/provider-aliyun-bailian";

/**
 * Configuration for the uploader-aliyun example.
 *
 * `ALIYUN_BAILIAN_API_KEY` and `ALIYUN_BAILIAN_BASE_URL` configure the
 * generation provider. `UPLOADER_ALIYUN_MODEL` selects the model the uploaded
 * file is bound to (it MUST match the model used in the downstream
 * `editImage` call, because DashScope binds uploaded files to a single model).
 * `UPLOADER_ALIYUN_IMAGE_PATH` is the local file to upload.
 */
export interface UploaderAliyunExampleConfig {
  readonly provider: AliyunBailianConfig;
  readonly model: string;
  readonly imagePath: string;
  readonly prompt: string;
}

export function readExampleConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv.slice(2)
): UploaderAliyunExampleConfig {
  const missing = ["ALIYUN_BAILIAN_API_KEY", "ALIYUN_BAILIAN_BASE_URL"].filter(
    (name) => !env[name]
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill in your Aliyun Bailian credentials."
    );
  }

  const imagePath =
    env.UPLOADER_ALIYUN_IMAGE_PATH ?? (argv.length > 0 ? argv[0] : "");
  if (!imagePath) {
    throw new Error(
      "Missing local image path. Set UPLOADER_ALIYUN_IMAGE_PATH or pass it as the first CLI argument."
    );
  }

  return {
    provider: {
      apiKey: env.ALIYUN_BAILIAN_API_KEY as string,
      baseUrl: env.ALIYUN_BAILIAN_BASE_URL as string,
    },
    model: env.UPLOADER_ALIYUN_MODEL ?? "qwen-image-2.0-pro",
    imagePath,
    prompt:
      env.UPLOADER_ALIYUN_PROMPT ?? "把这张图片转换为水彩画风格",
  };
}
