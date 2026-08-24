import type { AudioContent } from "./content.ts";

export interface AudioUsage {
  readonly characters?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly count?: number;
  readonly raw?: unknown;
}

export type VoiceStatus = "DEPLOYING" | "OK" | "UNDEPLOYED" | string;

/** Normalized persistent voice resource shared by cloning and design APIs. */
export interface VoiceProfile {
  readonly id: string;
  readonly targetModel?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly status?: VoiceStatus;
  readonly language?: string;
  readonly voicePrompt?: string;
  readonly previewText?: string;
  readonly resourceLink?: string;
  readonly raw?: unknown;
}

export interface VoiceListResult {
  readonly voices: readonly VoiceProfile[];
  readonly pageIndex?: number;
  readonly pageSize?: number;
  readonly totalCount?: number;
  readonly requestId?: string;
  readonly raw?: unknown;
}

export interface VoiceOperationResult {
  readonly voice?: VoiceProfile;
  readonly requestId?: string;
  readonly raw?: unknown;
}

export interface VoiceDesignResult extends VoiceOperationResult {
  readonly previewAudio?: AudioContent;
}
