import type { ImageContent, VideoContent } from "../contracts/content.ts";
import type {
  ModelInstance,
  DefaultVideoParams,
} from "../contracts/model-instance.ts";

/**
 * Video generation request and input contracts.
 *
 * `VideoGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `VideoGenerationRequest<TParams>` adds
 * the provider-bound video model instance so `submitVideoTask` can dispatch,
 * and constrains the request shape to the bound model's `TParams` (defaults
 * to `VideoGenerationInput`). The public input carries `prompt` and
 * mode-specific media inputs (an optional `firstFrame` for first-frame i2v,
 * ordered `referenceImages` for r2v/video-edit, and an `inputVideo` public
 * URL for video-edit); native video parameters travel under
 * `providerOptions.<provider>`.
 */

/**
 * A provider-bound video model instance, specialized to `VideoContent[]`.
 */
export type VideoModelInstance<TParams = DefaultVideoParams> =
  ModelInstance<VideoContent[], TParams>;

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
 *
 * `TParams` carries the family-specific request shape (defaults to
 * `VideoGenerationInput`). The request is `TParams` intersected with
 * `{ model }` so `providerOptions.<provider>` (e.g. `aliyun.resolution`,
 * `aliyun.ratio`, `aliyun.audio_setting`) narrows per video mode when callers
 * obtain `model` via a literal-id factory overload; the default keeps
 * `providerOptions: Record<string, unknown>` for dynamic ids.
 */
export type VideoGenerationRequest<
  TParams extends VideoGenerationInput = VideoGenerationInput,
> = TParams & {
  readonly model: VideoModelInstance<TParams>;
};
