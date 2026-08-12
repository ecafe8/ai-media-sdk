import type { VideoGenerationInput } from "@ai-media/sdk";

/**
 * Aspect ratios accepted by MiniMax-H3 video generation. `adaptive` lets the
 * API auto-recommend a ratio from the input media. Text-to-video requires a
 * concrete ratio and rejects `adaptive`; image-to-video always resolves to
 * `adaptive` (enforced by the adapter).
 */
export type MiniMaxVideoRatio =
  | "adaptive"
  | "21:9"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16";

/**
 * MiniMax-native video provider options forwarded under
 * `providerOptions.minimax`.
 *
 * `resolution` and `duration` are required by the MiniMax V2 API in every
 * request, so they are non-optional here and surfaced at compile time through
 * the `MiniMax-H3` video overload. `ratio` is optional and follows
 * per-scenario rules; `callbackUrl` is forwarded when supplied.
 */
export interface MiniMaxVideoOptions {
  readonly resolution: "768P" | "2K";
  readonly duration: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  readonly ratio?: MiniMaxVideoRatio;
  readonly callbackUrl?: string;
}

/**
 * Family-typed params for MiniMax-H3 video (`MiniMax-H3`). A single model id
 * covers text-to-video, first/last-frame image-to-video, and
 * reference-to-video; the active scenario is derived from the supplied media
 * inputs (`firstFrame`/`lastFrame` for i2v, `referenceImages`/
 * `referenceVideos`/`referenceAudios` for r2v) and validated by the adapter.
 * A non-empty `prompt` is always required.
 */
export interface MiniMaxH3VideoParams extends VideoGenerationInput {
  readonly prompt: string;
  readonly providerOptions: {
    readonly minimax: MiniMaxVideoOptions;
  };
}
