import type { AudioStreamEvent } from "@ai-media/sdk";
import type { SiteProvider } from "../key-store";

/**
 * Site-local playground types. The request model differs from the
 * server-proxied `apps/web` playground: image inputs are `ImageInput`
 * values (URL or local-file base64) resolved by the media input components,
 * and credentials come from the global key store instead of per-request
 * fields.
 */

export type SiteModality = "image" | "video" | "audio";

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
  | "minimax-h3-video"
  | "doubao-seedream-5-pro"
  | "doubao-seedream-5-lite"
  | "doubao-seedream-4-5"
  | "doubao-seedream-4-0"
  | "qwen-audio-tts"
  | "qwen-tts"
  | "minimax-tts";

/**
 * A video generation scenario served by a single model id. Models declaring
 * more than one scenario (MiniMax-H3) render a scenario selector in the video
 * workbench; flag-driven models (HappyHorse) declare none.
 */
export type VideoScenario = "t2v" | "i2v" | "r2v";

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
  readonly maxReferenceVideos?: number;
  readonly maxReferenceAudios?: number;
  /**
   * Multi-scenario video models (MiniMax-H3) declare the scenarios a single
   * model id serves; the video workbench renders a scenario selector when
   * more than one is present. Flag-driven models leave this undefined.
   */
  readonly videoScenarios?: readonly VideoScenario[];
  readonly maxEditImages?: number;
  readonly supportedSizes?: readonly string[];
  readonly maxResolution?: { readonly width: number; readonly height: number };
  readonly maxN?: number;
  readonly supportedResolutions?: readonly string[];
  readonly supportedAspectRatios?: readonly string[];
  readonly recommendation: string;
  readonly audio?: {
    readonly supportsSsml?: boolean;
    readonly supportedFormats?: readonly string[];
    readonly supportedSampleRates?: readonly number[];
    readonly instructionField?: "instruction" | "instructions";
    readonly region?: string;
    readonly endpoint?: string;
    readonly voiceResource?: {
      readonly protocols: readonly ("qwen-audio" | "qwen")[];
      readonly targetModel?: boolean;
    };
  };
}

export interface SiteGenerationRequest {
  readonly provider: SiteProvider;
  readonly model: string;
  readonly modality: SiteModality;
  readonly prompt: string;
  readonly text?: string;
  readonly voice?: string;
  readonly imageOperation?: ImageOperation;
  /** Image edit reference / i2v first frame. */
  readonly referenceImage?: ImageInput;
  /** i2v last frame (MiniMax first & last frame). */
  readonly lastFrameImage?: ImageInput;
  /** Ordered r2v reference images; order maps to `[Image N]`. */
  readonly referenceImages?: readonly ImageInput[];
  /** Ordered r2v reference video public URLs (MiniMax). */
  readonly referenceVideoUrls?: readonly string[];
  /** Ordered r2v reference audio public URLs (MiniMax). */
  readonly referenceAudioUrls?: readonly string[];
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

export interface SiteAudioStreamRequest {
  readonly provider: SiteProvider;
  readonly model: string;
  readonly text: string;
  readonly voice: string;
  readonly providerOptions?: Readonly<Record<string, Record<string, unknown>>>;
  readonly signal?: AbortSignal;
}

export interface SiteVoiceCloningInput {
  readonly protocol: "qwen-audio" | "qwen";
  readonly targetModel: string;
  readonly audioUrl?: string;
  readonly audio?: { readonly data: string };
  readonly text?: string;
  readonly prefix?: string;
  readonly preferredName?: string;
  readonly languageHints?: readonly string[];
  readonly language?: string;
}

export interface SiteVoiceDesignInput {
  readonly protocol: "qwen-audio" | "qwen";
  readonly targetModel: string;
  readonly voicePrompt: string;
  readonly previewText: string;
  readonly prefix?: string;
  readonly preferredName?: string;
  readonly languageHints?: readonly string[];
  readonly language?: string;
  readonly sampleRate?: number;
  readonly responseFormat?: "pcm" | "wav" | "mp3" | "opus";
}
export type SiteAudioStreamEvent = AudioStreamEvent;

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
  | "VALIDATION_ERROR"
  | "MODEL_UNAVAILABLE"
  | "EDIT_NOT_SUPPORTED"
  | "VIDEO_NOT_SUPPORTED"
  | "VIDEO_PROVIDER_UNSUPPORTED"
  | "FIRST_FRAME_REQUIRED"
  | "INPUT_VIDEO_REQUIRED"
  | "ENDPOINT_MISSING_FIELD"
  | "ENDPOINT_INVALID"
  | "ENDPOINT_UNCONFIRMED";

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
  readonly audio?: readonly {
    readonly url?: string;
    readonly base64?: string;
    readonly mimeType?: string;
    readonly format?: string;
    readonly expiresAt?: number;
    readonly sampleRate?: number;
    readonly channels?: number;
    readonly bitDepth?: number;
    readonly encoding?: string;
  }[];
  readonly metadata?: SiteResponseMetadata;
  readonly error?: {
    readonly code: SiteErrorCode;
    /**
     * Stable English fallback message; the UI renders localized text from
     * `code` and never displays this string directly.
     */
    readonly message: string;
    /** Raw provider/SDK detail for interpolation into localized text. */
    readonly detail?: string;
    /** Structured interpolation values (field/host/reason/...) per code. */
    readonly context?: Readonly<Record<string, string>>;
  };
}
