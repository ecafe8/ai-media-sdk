/**
 * Modality-neutral content contracts.
 *
 * `Content` is the open base; concrete content shapes (image, future video/
 * audio) specialize it. Phase 0 ships `ImageContent` only.
 */

/**
 * Open base for modality-specific content payloads.
 */
export interface Content {
  readonly [key: string]: unknown;
}

/**
 * Image content produced or consumed by image generation/editing.
 *
 * Either `url` or `base64` carries the image bytes; `mimeType` describes the
 * format. Dimensions are optional because not every provider returns them.
 */
export interface ImageContent extends Content {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Video content produced by video generation.
 *
 * A result carries one or more videos; `url` is the download link (MP4 by
 * default). `duration` is in seconds; `width`/`height` may be absent when the
 * provider reports only a resolution tier. `mimeType` defaults to `video/mp4`.
 */
export interface VideoContent extends Content {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly duration?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Audio content produced by text-to-speech or voice-design preview APIs. */
export interface AudioContent extends Content {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly id?: string;
  readonly expiresAt?: number;
  readonly sampleRate?: number;
  readonly format?: string;
  readonly encoding?: string;
}
