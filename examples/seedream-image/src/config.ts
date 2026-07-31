import type { SeedreamConfig } from "@ai-media/provider-seedream";

/**
 * Read the Doubao-Seedream example configuration from the environment.
 *
 * Only `ARK_API_KEY` is required; `ARK_BASE_URL` is optional and defaults to
 * the Volcengine Ark `ark+cn-beijing` endpoint inside the provider.
 */
export function readSeedreamConfig(
  env: NodeJS.ProcessEnv = process.env
): SeedreamConfig {
  const missing = ["ARK_API_KEY"].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  const config: SeedreamConfig = {
    apiKey: env.ARK_API_KEY as string,
  };
  if (env.ARK_BASE_URL) {
    config.baseUrl = env.ARK_BASE_URL as string;
  }
  return config;
}

export function readSeedreamModel(
  env: NodeJS.ProcessEnv = process.env
): string {
  return env.SEEDREAM_MODEL || "doubao-seedream-5-0-pro-260628";
}
