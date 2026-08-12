import type { MiniMaxConfig } from "@ai-media/provider-minimax";

/**
 * Read the MiniMax video example provider configuration from the environment.
 *
 * Only `MINIMAX_API_KEY` is required; `MINIMAX_BASE_URL` is optional and
 * falls back to the provider's `https://api.minimax.io` default.
 */
export function readMiniMaxVideoConfig(
  env: NodeJS.ProcessEnv = process.env
): MiniMaxConfig {
  if (!env.MINIMAX_API_KEY) {
    throw new Error("Missing required environment variables: MINIMAX_API_KEY");
  }
  const baseUrl = env.MINIMAX_BASE_URL?.trim();
  return {
    apiKey: env.MINIMAX_API_KEY,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function readMiniMaxVideoModels(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const value = env.MINIMAX_VIDEO_MODEL;
  return value
    ? value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : ["MiniMax-H3"];
}

/**
 * Read optional example inputs for i2v and r2v scenarios. When any reference
 * URL list is present the example runs reference-to-video; otherwise a
 * first-frame URL selects image-to-video, and a bare prompt runs
 * text-to-video.
 */
export interface MiniMaxVideoExampleInputs {
  readonly firstFrameUrl?: string;
  readonly lastFrameUrl?: string;
  readonly referenceImageUrls: string[];
  readonly referenceVideoUrls: string[];
  readonly referenceAudioUrls: string[];
}

function splitUrls(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : [];
}

export function readMiniMaxVideoExampleInputs(
  env: NodeJS.ProcessEnv = process.env
): MiniMaxVideoExampleInputs {
  return {
    firstFrameUrl: env.MINIMAX_FIRST_FRAME_URL?.trim() || undefined,
    lastFrameUrl: env.MINIMAX_LAST_FRAME_URL?.trim() || undefined,
    referenceImageUrls: splitUrls(env.MINIMAX_REFERENCE_IMAGE_URLS),
    referenceVideoUrls: splitUrls(env.MINIMAX_REFERENCE_VIDEO_URLS),
    referenceAudioUrls: splitUrls(env.MINIMAX_REFERENCE_AUDIO_URLS),
  };
}

/**
 * Read the native MiniMax video parameters from the environment. Resolution
 * defaults to `2K`, duration to `5`; both are required by the MiniMax V2 API.
 */
export interface MiniMaxVideoExampleOptions {
  readonly resolution: "768P" | "2K";
  readonly duration: number;
  readonly ratio?: string;
}

export function readMiniMaxVideoOptions(
  env: NodeJS.ProcessEnv = process.env
): MiniMaxVideoExampleOptions {
  const resolutionRaw = env.MINIMAX_RESOLUTION?.trim() || "2K";
  if (resolutionRaw !== "768P" && resolutionRaw !== "2K") {
    throw new Error("MINIMAX_RESOLUTION must be 768P or 2K");
  }
  const durationRaw = env.MINIMAX_DURATION?.trim() || "5";
  const duration = Number.parseInt(durationRaw, 10);
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
    throw new Error("MINIMAX_DURATION must be an integer between 4 and 15");
  }
  const ratio = env.MINIMAX_RATIO?.trim() || undefined;
  return {
    resolution: resolutionRaw,
    duration,
    ...(ratio ? { ratio } : {}),
  };
}
