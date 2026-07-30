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
