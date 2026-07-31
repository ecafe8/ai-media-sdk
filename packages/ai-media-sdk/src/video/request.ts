import type { ImageContent, VideoContent } from "../contracts/content.ts";
import type { ModelInstance } from "../contracts/model-instance.ts";

/**
 * Video generation request and input contracts.
 *
 * `VideoGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `VideoGenerationRequest` adds the
 * provider-bound video model instance so `submitVideoTask` can dispatch. The
 * public input carries `prompt` and an optional `firstFrame` (for first-frame
 * i2v); native video parameters travel under `providerOptions.<provider>`.
 */

/**
 * A provider-bound video model instance, specialized to `VideoContent[]`.
 */
export type VideoModelInstance = ModelInstance<VideoContent[]>;

/**
 * Provider-agnostic video generation payload carried in `AdapterRequest.input`.
 *
 * `prompt` and `firstFrame` are public; provider-native fields (resolution,
 * duration, ratio, watermark, seed, etc.) travel under `providerOptions.<provider>`.
 */
export interface VideoGenerationInput {
  readonly prompt: string;
  readonly firstFrame?: ImageContent;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A complete video generation request bound to a provider video model instance.
 */
export interface VideoGenerationRequest {
  readonly model: VideoModelInstance;
  readonly prompt: string;
  readonly firstFrame?: ImageContent;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}
