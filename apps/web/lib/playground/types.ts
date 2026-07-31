import type { ImageContent, SdkErrorCode, VideoContent } from "@ai-media/sdk";

export type PlaygroundProvider =
  "azure-openai" | "aliyun-bailian" | "doubao-seedream";
export type PlaygroundMode = "generate" | "edit" | "video";

export interface PlaygroundModel {
  readonly id: string;
  readonly label: string;
  readonly provider: PlaygroundProvider;
  readonly modality: "image" | "video";
  readonly supportsGenerate: boolean;
  readonly supportsEdit: boolean;
  readonly supportsVideo: boolean;
  readonly requiresFirstFrame?: boolean;
  readonly maxEditImages?: number;
  readonly recommendation: string;
  readonly configured: boolean;
}

export interface PlaygroundRequest {
  readonly provider: PlaygroundProvider;
  readonly model: string;
  readonly mode: PlaygroundMode;
  readonly prompt: string;
  readonly referenceImageUrl?: string;
  readonly size?: string;
  readonly n?: number;
  readonly resolution?: string;
  readonly duration?: number;
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
