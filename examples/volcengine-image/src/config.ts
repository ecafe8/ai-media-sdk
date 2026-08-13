import type { VolcengineConfig } from "@ai-media/provider-volcengine";

/**
 * Read the Volcengine Ark example configuration from the environment.
 *
 * Only `ARK_API_KEY` is required; `ARK_BASE_URL` is optional and defaults to
 * the Volcengine Ark `ark+cn-beijing` endpoint inside the provider.
 */
export function readVolcengineConfig(
  env: NodeJS.ProcessEnv = process.env
): VolcengineConfig {
  const missing = ["ARK_API_KEY"].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  const config: VolcengineConfig = {
    apiKey: env.ARK_API_KEY as string,
  };
  if (env.ARK_BASE_URL) {
    config.baseUrl = env.ARK_BASE_URL as string;
  }
  return config;
}

export function readVolcengineModels(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const value = env.VOLCENGINE_IMAGE_MODEL;
  return value
    ? value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : ["doubao-seedream-5-0-pro-260628"];
}
