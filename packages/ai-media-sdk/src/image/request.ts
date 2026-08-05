import type { ImageContent } from "../contracts/content.ts";
import type { ImageModelInstance } from "./model-instance.ts";

/**
 * Image generation request and input contracts.
 *
 * `ImageGenerationInput` is the provider-agnostic payload handed to a Provider
 * adapter inside an `AdapterRequest`. `ImageGenerationRequest<TParams>` adds
 * the provider-bound model instance so `generateImage` can dispatch, and
 * constrains the request shape to the bound model's `TParams` so the IDE
 * surfaces only the `size`/`n`/`providerOptions.<namespace>` values the
 * selected model accepts.
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
 *
 * `TParams` carries the family-specific request shape (defaults to
 * `ImageGenerationInput`). The request is `TParams` intersected with
 * `{ model }`, so the `size`/`n`/`providerOptions` fields narrow per family
 * when callers obtain `model` via a literal-id factory overload (e.g.
 * `azure.image("gpt-image-2")`); the default keeps `size: string` and
 * `n: number` for dynamic ids.
 */
export type ImageGenerationRequest<
  TParams extends ImageGenerationInput = ImageGenerationInput,
> = TParams & {
  readonly model: ImageModelInstance<TParams>;
};

/**
 * Provider-agnostic image edit payload carried in `AdapterRequest.input`.
 *
 * `prompt` and `images` are public; provider-native fields travel under
 * `providerOptions.<provider>`. `images` carries 1-3 reference images (URL or
 * base64) that the adapter maps to its native image-entry form.
 */
export interface ImageEditInput {
  readonly prompt: string;
  readonly images: readonly ImageContent[];
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A complete image edit request bound to a provider model instance.
 *
 * Carries 1-3 input images (`images`); the model's `maxEditImages` bounds the
 * maximum. The Phase 0 singular `image: ImageContent` shape is retired.
 */
export interface ImageEditRequest {
  readonly model: ImageModelInstance;
  readonly prompt: string;
  readonly images: readonly ImageContent[];
  readonly providerOptions?: Readonly<Record<string, unknown>>;
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

/**
 * Type guard narrowing an `unknown` adapter input to `ImageEditInput`.
 */
export function isImageEditInput(value: unknown): value is ImageEditInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.prompt !== "string") return false;
  return Array.isArray(candidate.images);
}

/**
 * Build a pixel-form `size` string from explicit width/height.
 *
 * Identity helper for self-documenting call sites; the wire format is
 * `${width}x${height}` (lowercase `x`). Use this when the selected model
 * accepts free-form pixel sizes (e.g. Aliyun Qwen within `maxResolution`).
 */
export function pixelSize(width: number, height: number): string {
  return `${width}x${height}`;
}

/**
 * Build a tier-form `size` string from a tier identifier.
 *
 * Identity helper for self-documenting call sites; the wire format is the
 * tier identifier verbatim (e.g. `"1K"`, `"2K"`, `"4K"`). Use this when the
 * selected model accepts resolution tiers (e.g. Seedream, Aliyun Wan).
 */
export function tierSize(tier: string): string {
  return tier;
}
