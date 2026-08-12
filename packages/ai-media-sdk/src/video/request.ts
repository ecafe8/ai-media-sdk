import type { ImageContent, VideoContent } from "../contracts/content.ts";
import type {
  DefaultVideoParams,
  ModelInstance,
} from "../contracts/model-instance.ts";

/**
 * Video generation request and input contracts.
 *
 * `VideoGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `VideoGenerationRequest<TParams>` adds
 * the provider-bound video model instance so `submitVideoTask` can dispatch,
 * and constrains the request shape to the bound model's `TParams` (defaults
 * to `VideoGenerationInput`). The public input carries an optional `prompt`
 * and mode-specific media inputs (an optional `firstFrame` for first-frame
 * i2v, an optional `lastFrame` for first & last frame i2v, ordered
 * `referenceImages` for r2v/video-edit, ordered `referenceVideos`/
 * `referenceAudios` for reference-to-video, an `inputVideo` public URL for
 * video-edit, and an ordered `media` array for Wan 3.0 heterogeneous
 * generation); native video parameters travel under `providerOptions.<provider>`.
 */

/**
 * A provider-bound video model instance, specialized to `VideoContent[]`.
 */
export type VideoModelInstance<TParams = DefaultVideoParams> = ModelInstance<
  VideoContent[],
  TParams
>;

/**
 * Image media entry for Wan 3.0 first-frame, last-frame, or reference image
 * input. Accepts a public http/https URL, an `oss://` URL, or a base64 data
 * URI (base64 is accepted only for image media, not video/audio/file/link).
 */
export interface Wan3VideoImageMedia {
  readonly type: "first_frame" | "last_frame" | "reference_image";
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
}

/**
 * Reference video media entry for Wan 3.0. Accepts a public http/https URL or
 * an `oss://` URL. Optional `duration` metadata (seconds) enables client-side
 * total-duration validation without probing the remote file.
 */
export interface Wan3VideoReferenceVideoMedia {
  readonly type: "reference_video";
  readonly url: string;
  readonly duration?: number;
}

/**
 * Reference audio media entry for Wan 3.0. Accepts a public http/https URL or
 * an `oss://` URL. Optional `duration` metadata (seconds) enables client-side
 * total-duration validation without probing the remote file.
 */
export interface Wan3VideoReferenceAudioMedia {
  readonly type: "reference_audio";
  readonly url: string;
  readonly duration?: number;
}

/**
 * File media entry for Wan 3.0. Accepts a public http/https URL or an
 * `oss://` URL pointing to a supported document format.
 */
export interface Wan3VideoFileMedia {
  readonly type: "file";
  readonly url: string;
}

/**
 * Link media entry for Wan 3.0. Accepts a public http/https URL of a web page.
 */
export interface Wan3VideoLinkMedia {
  readonly type: "link";
  readonly url: string;
}

/**
 * Discriminated union of all Wan 3.0 media entry types. The `type` field
 * matches the DashScope API `input.media[].type` values directly so the
 * adapter can serialize entries without a mapping table. In reference mode,
 * images and videos are numbered independently (`图1`, `视频1`, …) by array
 * order; the provider preserves that order on the wire.
 */
export type Wan3VideoMediaEntry =
  | Wan3VideoImageMedia
  | Wan3VideoReferenceVideoMedia
  | Wan3VideoReferenceAudioMedia
  | Wan3VideoFileMedia
  | Wan3VideoLinkMedia;

/**
 * Reference video media entry for reference-to-video. Accepts a public
 * http/https URL. Optional `duration` metadata (seconds) enables client-side
 * per-clip/total-duration validation without probing the remote file.
 */
export interface ReferenceVideoMedia {
  readonly url: string;
  readonly duration?: number;
}

/**
 * Reference audio media entry for reference-to-video. Accepts a public
 * http/https URL. Optional `duration` metadata (seconds) enables client-side
 * per-clip/total-duration validation without probing the remote file.
 */
export interface ReferenceAudioMedia {
  readonly url: string;
  readonly duration?: number;
}

/**
 * Provider-agnostic video generation payload carried in `AdapterRequest.input`.
 *
 * `prompt` is optional because Wan 3.0 accepts media-only requests; the bound
 * adapter is the sole authority for model-specific prompt requirements (t2v/
 * r2v/video-edit require a non-empty prompt, i2v and Wan 3.0 media-only do
 * not). Media inputs are public; provider-native fields (resolution, duration,
 * ratio, watermark, seed, audio, etc.) travel under `providerOptions.<provider>`.
 * Which media inputs are allowed is model-specific and is validated by the
 * bound adapter, not the core.
 */
export interface VideoGenerationInput {
  readonly prompt?: string;
  /** i2v: the first-frame image (exactly one, required for i2v models). */
  readonly firstFrame?: ImageContent;
  /** i2v first & last frame: the last-frame image (pairs with `firstFrame`). */
  readonly lastFrame?: ImageContent;
  /** r2v / video-edit: ordered reference images (r2v 1-9, video-edit 0-5). */
  readonly referenceImages?: readonly ImageContent[];
  /** r2v: ordered reference videos (public URL + optional duration metadata). */
  readonly referenceVideos?: readonly ReferenceVideoMedia[];
  /** r2v: ordered reference audios (public URL + optional duration metadata). */
  readonly referenceAudios?: readonly ReferenceAudioMedia[];
  /** video-edit: the source video, always a public http/https URL. */
  readonly inputVideo?: { readonly url: string };
  /** Wan 3.0: ordered heterogeneous media entries. */
  readonly media?: readonly Wan3VideoMediaEntry[];
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A complete video generation request bound to a provider video model instance.
 *
 * `TParams` carries the family-specific request shape (defaults to
 * `VideoGenerationInput`). The request is `TParams` intersected with
 * `{ model }` so `providerOptions.<provider>` (e.g. `aliyun.resolution`,
 * `aliyun.ratio`, `aliyun.audio`) narrows per video mode when callers
 * obtain `model` via a literal-id factory overload; the default keeps
 * `providerOptions: Record<string, unknown>` for dynamic ids.
 */
export type VideoGenerationRequest<
  TParams extends VideoGenerationInput = VideoGenerationInput,
> = TParams & {
  readonly model: VideoModelInstance<TParams>;
};
