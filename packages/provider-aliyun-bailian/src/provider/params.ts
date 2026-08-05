import type {
  ImageContent,
  ImageGenerationInput,
  VideoGenerationInput,
} from "@ai-media/sdk";

import type { AliyunImageProviderOptions } from "./options.ts";

/**
 * Aliyun-native image provider options shared by Qwen and Wan families.
 *
 * Type alias of `AliyunImageProviderOptions` so the family `TParams` can
 * reference a stable local alias without forcing consumers to import from
 * `options.ts` separately. Qwen-only fields (`negative_prompt`,
 * `prompt_extend`) and Wan-only fields (`thinking_mode`, `color_palette`,
 * `enable_sequential`) appear on the same shape; the adapter only forwards
 * fields whose model family supports them, so callers get IDE hints for all
 * Aliyun image options regardless of the selected family.
 */
export type AliyunImageFamilyOptions = AliyunImageProviderOptions;

/**
 * Family-typed request params for Aliyun Qwen-image models
 * (`qwen-image-3.0-pro`, `qwen-image-2.0-pro`,
 * `qwen-image-2.0-pro-2026-06-22`, `qwen-image-2.0`).
 *
 * Selected when callers write `aliyun.image("qwen-image-2.0-pro")` etc. so
 * `generateImage` narrows `size` to `WxH`/`W*H` pixel values within the
 * 2048x2048 cap, `n` to `1..6`, and `providerOptions.aliyun` to the
 * Aliyun-image-options shape. `size` cannot be enumerated as a literal union
 * because the model accepts any `WxH` within the cap; the core's
 * `validateSize` enforces the cap at runtime.
 */
export interface AliyunQwenImageParams extends ImageGenerationInput {
  readonly n?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly providerOptions?: {
    readonly aliyun?: AliyunImageFamilyOptions;
  };
}

/**
 * Family-typed request params for Aliyun Wan 2.7 Image Pro
 * (`wan2.7-image-pro`, max resolution 4096x4096, max n 4).
 */
export interface AliyunWan27ProImageParams extends ImageGenerationInput {
  readonly n?: 1 | 2 | 3 | 4;
  readonly providerOptions?: {
    readonly aliyun?: AliyunImageFamilyOptions;
  };
}

/**
 * Family-typed request params for Aliyun Wan 2.7 Image
 * (`wan2.7-image`, max resolution 2048x2048, max n 4).
 */
export interface AliyunWan27ImageParams extends ImageGenerationInput {
  readonly n?: 1 | 2 | 3 | 4;
  readonly providerOptions?: {
    readonly aliyun?: AliyunImageFamilyOptions;
  };
}

/**
 * Aspect ratios accepted by HappyHorse t2v and r2v models. i2v omits `ratio`
 * (auto-follows the first frame) and video-edit has no `ratio` parameter.
 */
type HappyHorseRatio =
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "4:5"
  | "5:4"
  | "9:21"
  | "21:9";

/**
 * Aliyun-native video provider options forwarded under
 * `providerOptions.aliyun`. Field availability narrows per HappyHorse mode
 * (i2v omits `ratio`; video-edit replaces `duration` with `audio_setting`
 * and supports only `720P`/`1080P` for `resolution`).
 */
export interface AliyunVideoFamilyOptions {
  readonly resolution?: "480P" | "720P" | "1080P";
  readonly ratio?: HappyHorseRatio;
  readonly duration?: number;
  readonly watermark?: boolean;
  readonly seed?: number;
  readonly audio_setting?: "auto" | "origin";
}

/**
 * Family-typed params for HappyHorse t2v
 * (`happyhorse-1.1-t2v`). Accepts `resolution`, `ratio`, `duration`,
 * `watermark`, `seed`; no media inputs.
 */
export interface AliyunHappyHorseT2VParams extends VideoGenerationInput {
  readonly providerOptions?: {
    readonly aliyun?: Omit<AliyunVideoFamilyOptions, "audio_setting">;
  };
}

/**
 * Family-typed params for HappyHorse i2v (`happyhorse-1.1-i2v`). Requires
 * `firstFrame`; `ratio` is omitted because i2v auto-follows the first frame's
 * aspect ratio.
 */
export interface AliyunHappyHorseI2VParams extends VideoGenerationInput {
  readonly firstFrame: ImageContent;
  readonly providerOptions?: {
    readonly aliyun?: Omit<AliyunVideoFamilyOptions, "ratio" | "audio_setting">;
  };
}

/**
 * Family-typed params for HappyHorse r2v (`happyhorse-1.1-r2v`). Requires
 * 1-9 `referenceImages`; supports `ratio` (which the user can set rather than
 * letting r2v auto-derive from the references).
 */
export interface AliyunHappyHorseR2VParams extends VideoGenerationInput {
  readonly referenceImages: readonly ImageContent[];
  readonly providerOptions?: {
    readonly aliyun?: Omit<AliyunVideoFamilyOptions, "audio_setting">;
  };
}

/**
 * Family-typed params for HappyHorse video-edit
 * (`happyhorse-1.0-video-edit`). Requires `inputVideo` (public http/https
 * URL); accepts 0-5 `referenceImages`; `resolution` is constrained to
 * `720P`/`1080P`, `ratio`/`duration` are replaced by `audio_setting`.
 */
export interface AliyunHappyHorseVideoEditParams extends VideoGenerationInput {
  readonly inputVideo: { readonly url: string };
  readonly referenceImages?: readonly ImageContent[];
  readonly providerOptions?: {
    readonly aliyun?: {
      readonly resolution?: "720P" | "1080P";
      readonly watermark?: boolean;
      readonly seed?: number;
      readonly audio_setting?: "auto" | "origin";
    };
  };
}
