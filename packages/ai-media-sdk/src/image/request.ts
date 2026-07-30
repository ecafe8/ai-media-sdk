import type { ImageContent } from "../contracts/content.js";
import type { ImageModelInstance } from "./model-instance.js";

/**
 * Image generation request and input contracts.
 *
 * `ImageGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `ImageGenerationRequest` adds the
 * provider-bound model instance so `generateImage` can dispatch.
 */

/**
 * Provider-agnostic image generation payload carried in `AdapterRequest.input`.
 *
 * `prompt`, `n`, and `size` are public; Azure-native fields travel under the
 * `providerOptions.<provider>` namespace and never enter the public contract.
 */
export interface ImageGenerationInput {
  readonly prompt: string;
  readonly n?: number;
  readonly size?: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A complete image generation request bound to a provider model instance.
 */
export interface ImageGenerationRequest {
  readonly model: ImageModelInstance;
  readonly prompt: string;
  readonly n?: number;
  readonly size?: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * Minimal image edit request. Image editing remains a `NOT_IMPLEMENTED` stub
 * in this slice; the shape is retained so later slices can evolve it.
 */
export interface ImageEditRequest {
  readonly model: ImageModelInstance;
  readonly prompt: string;
  readonly image: ImageContent;
}

/**
 * Type guard narrowing an `unknown` adapter input to `ImageGenerationInput`.
 *
 * Adapters receive `AdapterRequest.input` as `unknown` (modality-neutral
 * contract); this guard lets them validate the payload without unsafe casts.
 */
export function isImageGenerationInput(
  value: unknown
): value is ImageGenerationInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.prompt === "string";
}
