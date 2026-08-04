import type { ImageContent, VideoContent } from "../contracts/content.ts";
import type { ModelInstance } from "../contracts/model-instance.ts";

/**
 * Video generation request and input contracts.
 *
 * `VideoGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `VideoGenerationRequest` adds the
 * provider-bound video model instance so `submitVideoTask` can dispatch. The
 * public input carries `prompt` and mode-specific media inputs (an optional
 * `firstFrame` for first-frame i2v, ordered `referenceImages` for r2v/
 * video-edit, and an `inputVideo` public URL for video-edit); native video
 * parameters travel under `providerOptions.<provider>`.
 */

/**
 * A provider-bound video model instance, specialized to `VideoContent[]`.
 */
export type VideoModelInstance = ModelInstance<VideoContent[]>;

/**
 * Provider-agnostic video generation payload carried in `AdapterRequest.input`.
 *
 * `prompt` and media inputs are public; provider-native fields (resolution,
 * duration, ratio, watermark, seed, audio_setting, etc.) travel under
 * `providerOptions.<provider>`. Which media inputs are allowed is model-specific
 * and is validated by the bound adapter, not the core.
 */
export interface VideoGenerationInput {
  readonly prompt: string;
  /** i2v: the first-frame image (exactly one, required for i2v models). */
  readonly firstFrame?: ImageContent;
  /** r2v / video-edit: ordered reference images (r2v 1-9, video-edit 0-5). */
  readonly referenceImages?: readonly ImageContent[];
  /** video-edit: the source video, always a public http/https URL. */
  readonly inputVideo?: { readonly url: string };
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A complete video generation request bound to a provider video model instance.
 */
export interface VideoGenerationRequest {
  readonly model: VideoModelInstance;
  readonly prompt: string;
  readonly firstFrame?: ImageContent;
  readonly referenceImages?: readonly ImageContent[];
  readonly inputVideo?: { readonly url: string };
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}
