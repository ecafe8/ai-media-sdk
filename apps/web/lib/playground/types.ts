import type { ImageContent, SdkErrorCode, VideoContent } from "@ai-media/sdk";

export type PlaygroundProvider =
  "azure-openai" | "aliyun-bailian" | "doubao-seedream";

/**
 * Top-level generation modality. Audio is reserved and rendered as a
 * disabled tab; the SDK has no audio entry points yet.
 */
export type PlaygroundModality = "image" | "video" | "audio";

/**
 * Image-modality operation. Edit is only available when the selected model
 * declares `supportsEdit`; the form disables the button otherwise.
 */
export type ImageOperation = "generate" | "edit";

/**
 * A model's family, projected from each Provider's in-package registry.
 * Drives the Advanced Options section: each family exposes a different
 * `providerOptions.<namespace>` field set.
 */
export type PlaygroundModelFamily =
  | "azure-gpt-image"
  | "qwen-multimodal"
  | "wan-image-2.7"
  | "wan-image-2.6"
  | "happyhorse-video"
  | "wan3-video"
  | "doubao-seedream-5-pro"
  | "doubao-seedream-5-lite"
  | "doubao-seedream-4-5"
  | "doubao-seedream-4-0";

/**
 * Common projection of a model offered by a Provider, augmented with the
 * size/maxN/resolution metadata needed to drive model-aware form controls.
 *
 * The size/maxN fields come from the core `ModelCapability` (so the core's
 * `generateImage` validator and the Playground UI stay in sync).
 * `supportedResolutions`/`supportedAspectRatios` are Aliyun-video-specific
 * and projected here only because the Playground form consumes them; they
 * are not part of the common `SupportedModel` projection.
 */
export interface PlaygroundModel {
  readonly id: string;
  readonly label: string;
  readonly provider: PlaygroundProvider;
  readonly modality: "image" | "video";
  readonly family: PlaygroundModelFamily;
  readonly supportsGenerate: boolean;
  readonly supportsEdit: boolean;
  readonly supportsVideo: boolean;
  readonly supportsAsync?: boolean;
  readonly requiresFirstFrame?: boolean;
  readonly requiresInputVideo?: boolean;
  readonly maxReferenceImages?: number;
  readonly maxEditImages?: number;
  /** Closed set of allowed `size` values (from `ModelCapability.supportedSizes`). */
  readonly supportedSizes?: readonly string[];
  /** Pixel-size upper bound (from `ModelCapability.maxResolution`). */
  readonly maxResolution?: { readonly width: number; readonly height: number };
  /** Max output count for `n` (from `ModelCapability.maxN`). */
  readonly maxN?: number;
  /** HappyHorse video: allowed `resolution` values (Aliyun-specific). */
  readonly supportedResolutions?: readonly string[];
  /** HappyHorse video: allowed `ratio` values (Aliyun-specific; `[]` = no ratio). */
  readonly supportedAspectRatios?: readonly string[];
  readonly recommendation: string;
  readonly configured: boolean;
}

/**
 * Visitor-supplied Provider credentials (BYO Key). Only sent when the
 * visitor wants to use their own API key; the server proxies the Provider
 * call with these values and never persists or logs them. User-supplied
 * credentials take precedence over server-side environment configuration.
 *
 * Required fields per Provider:
 * - `azure-openai`: `apiKey` + `endpoint` + `apiVersion`
 * - `aliyun-bailian`: `apiKey` + `baseUrl`
 * - `doubao-seedream`: `apiKey` (`baseUrl` optional)
 */
export interface PlaygroundCredentials {
  readonly apiKey: string;
  /** Azure OpenAI resource endpoint. */
  readonly endpoint?: string;
  /** Azure OpenAI API version. */
  readonly apiVersion?: string;
  /** Bailian DashScope / Seedream Ark base URL. */
  readonly baseUrl?: string;
}

export interface PlaygroundRequest {
  readonly provider: PlaygroundProvider;
  readonly model: string;
  readonly modality: "image" | "video";
  readonly prompt: string;
  /** Optional visitor-supplied credentials; takes precedence over env. */
  readonly credentials?: PlaygroundCredentials;
  /** Image modality: `generate` (default) or `edit`. */
  readonly imageOperation?: ImageOperation;
  /** Image edit: reference image URL. */
  readonly referenceImageUrl?: string;
  readonly size?: string;
  readonly n?: number;
  /** Video modality: ordered reference image URLs (r2v / video-edit). */
  readonly referenceImageUrls?: readonly string[];
  /** Video modality (video-edit only): source video public URL. */
  readonly inputVideoUrl?: string;
  readonly resolution?: string;
  readonly duration?: number;
  readonly audioSetting?: string;
}

export interface PlaygroundMetadata {
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly imageCount?: number;
  readonly duration?: number;
}

export interface PlaygroundResponse {
  readonly status: "succeeded" | "processing" | "failed";
  readonly modality?: "image" | "video";
  readonly images?: readonly ImageContent[];
  readonly videos?: readonly VideoContent[];
  readonly metadata?: PlaygroundMetadata;
  readonly error?: {
    readonly code: SdkErrorCode | "CONFIGURATION_ERROR" | "VALIDATION_ERROR";
    readonly message: string;
  };
}
