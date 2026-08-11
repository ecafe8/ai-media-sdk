import type { SiteProvider } from "../key-store";

/**
 * Site-local playground types. The request model differs from the
 * server-proxied `apps/web` playground: image inputs are `ImageInput`
 * values (URL or local-file base64) resolved by the media input components,
 * and credentials come from the global key store instead of per-request
 * fields.
 */

export type SiteModality = "image" | "video";

export type ImageOperation = "generate" | "edit";

/**
 * Image input value: a pasted public URL, or a local file converted to
 * base64 by the media cache at request time.
 */
export type ImageInput =
  | { readonly url: string }
  | { readonly base64: string; readonly mimeType: string };

/**
 * Family slug driving the Advanced Options field sets. Wan 3.0 is excluded
 * from the site projection (heterogeneous `media[]` inputs are not
 * representable by the current forms), so no wan3 family exists here.
 */
export type SiteModelFamily =
  | "azure-gpt-image"
  | "qwen-multimodal"
  | "wan-image-2.7"
  | "wan-image-2.6"
  | "happyhorse-video"
  | "doubao-seedream-5-pro"
  | "doubao-seedream-5-lite"
  | "doubao-seedream-4-5"
  | "doubao-seedream-4-0";

export interface SiteModel {
  readonly id: string;
  readonly label: string;
  readonly provider: SiteProvider;
  readonly modality: SiteModality;
  readonly family: SiteModelFamily;
  readonly supportsGenerate: boolean;
  readonly supportsEdit: boolean;
  readonly supportsVideo: boolean;
  readonly supportsAsync?: boolean;
  readonly requiresFirstFrame?: boolean;
  readonly requiresInputVideo?: boolean;
  readonly maxReferenceImages?: number;
  readonly maxEditImages?: number;
  readonly supportedSizes?: readonly string[];
  readonly maxResolution?: { readonly width: number; readonly height: number };
  readonly maxN?: number;
  readonly supportedResolutions?: readonly string[];
  readonly supportedAspectRatios?: readonly string[];
  readonly recommendation: string;
}

export interface SiteGenerationRequest {
  readonly provider: SiteProvider;
  readonly model: string;
  readonly modality: SiteModality;
  readonly prompt: string;
  readonly imageOperation?: ImageOperation;
  /** Image edit reference / i2v first frame. */
  readonly referenceImage?: ImageInput;
  /** Ordered r2v reference images; order maps to `[Image N]`. */
  readonly referenceImages?: readonly ImageInput[];
  /** Video-edit source video; public URL only. */
  readonly inputVideoUrl?: string;
  readonly size?: string;
  readonly n?: number;
  readonly resolution?: string;
  readonly ratio?: string;
  readonly duration?: number;
  readonly audioSetting?: string;
  readonly providerOptions?: Readonly<Record<string, Record<string, unknown>>>;
}

export interface SiteResponseMetadata {
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly imageCount?: number;
  readonly duration?: number;
}

export type SiteErrorCode =
  | "NOT_IMPLEMENTED"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "UNKNOWN_MODEL"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "UNKNOWN"
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR";

export interface SitePlaygroundResponse {
  readonly status: "succeeded" | "processing" | "failed";
  readonly modality?: SiteModality;
  readonly images?: readonly {
    readonly url?: string;
    readonly base64?: string;
    readonly mimeType?: string;
    readonly width?: number;
    readonly height?: number;
  }[];
  readonly videos?: readonly {
    readonly url?: string;
    readonly mimeType?: string;
    readonly duration?: number;
    readonly width?: number;
    readonly height?: number;
  }[];
  readonly metadata?: SiteResponseMetadata;
  readonly error?: {
    readonly code: SiteErrorCode;
    readonly message: string;
  };
}
