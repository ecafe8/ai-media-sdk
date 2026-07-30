import { notImplemented } from "../contracts/error.js";
import type { GenerationResult } from "../contracts/generation.js";
import type { ImageContent } from "../contracts/content.js";
import type { ModelId } from "../contracts/provider-identity.js";

/**
 * Image API entry points.
 *
 * Phase 0 exposes typed `generateImage` and `editImage` stubs that fail
 * explicitly with `NOT_IMPLEMENTED`. The request shapes are intentionally
 * minimal placeholders; the full contract is finalized in Phase 1.
 */

/**
 * Minimal image generation request. Extended in Phase 1.
 */
export interface ImageGenerationRequest {
  readonly model: ModelId;
  readonly prompt: string;
}

/**
 * Minimal image edit request. Extended in Phase 1.
 */
export interface ImageEditRequest {
  readonly model: ModelId;
  readonly prompt: string;
  readonly image: ImageContent;
}

/**
 * Generate an image from a prompt.
 *
 * Phase 0 stub: throws `NOT_IMPLEMENTED` and performs no network request.
 */
export async function generateImage(
  _request: ImageGenerationRequest
): Promise<GenerationResult<ImageContent>> {
  throw notImplemented("generateImage");
}

/**
 * Edit an existing image from a prompt.
 *
 * Phase 0 stub: throws `NOT_IMPLEMENTED` and performs no network request.
 */
export async function editImage(
  _request: ImageEditRequest
): Promise<GenerationResult<ImageContent>> {
  throw notImplemented("editImage");
}
