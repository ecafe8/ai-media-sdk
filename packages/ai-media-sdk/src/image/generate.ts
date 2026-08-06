import { SdkError } from "../contracts/error.ts";
import type { AdapterRequest } from "../contracts/adapter.ts";
import type { GenerationResult } from "../contracts/generation.ts";
import type { ModelCapability } from "../contracts/capabilities.ts";
import type { ImageContent } from "../contracts/content.ts";
import type {
  ImageEditInput,
  ImageEditRequest,
  ImageGenerationInput,
  ImageGenerationRequest,
} from "./request.ts";
import { isImageEditInput, isImageGenerationInput } from "./request.ts";

/**
 * Image API entry points.
 *
 * `generateImage` and `editImage` both dispatch through the provider-bound
 * model instance, validating public parameters against model capabilities
 * before any network call.
 */

/**
 * Default maximum reference images for an editable model that does not declare
 * `maxEditImages`. Qwen I2I accepts up to 3.
 */
const DEFAULT_MAX_EDIT_IMAGES = 3;

/**
 * Supported public generation parameters per the image capability contract.
 * Anything outside this set is rejected pre-flight as `INVALID_REQUEST`.
 */
const SUPPORTED_PUBLIC_PARAMS = new Set<keyof ImageGenerationInput>([
  "prompt",
  "n",
  "size",
]);

/**
 * Case-sensitive membership check used by `validateSize` against
 * `capabilities.supportedSizes`. Tier identifiers (`"1K"`, `"2K"`, `"auto"`)
 * are matched verbatim so callers stay aligned with each Provider's documented
 * wire format. The pixel-form regex below independently accepts both `x` and
 * `X` as the separator for free-form `WxH` values.
 */
function isSupportedSize(size: string, supported: readonly string[]): boolean {
  return supported.includes(size);
}

/**
 * Pixel-form size regex. Accepts `1024x1024`, `1024X1024`, and `1024*1024`.
 */
const PIXEL_SIZE_PATTERN = /^(\d+)[x*](\d+)$/i;

/**
 * Validate the public `size` parameter against model capability metadata
 * before any network call. Precedence:
 *
 * 1. `size` undefined → pass (provider default applies).
 * 2. `capabilities.supportedSizes` defined and `size` is in the list → pass.
 * 3. `capabilities.maxResolution` defined → `size` must match the pixel form
 *    and parsed width/height must not exceed the cap.
 * 4. `capabilities.supportedSizes` defined (and not matched) → reject.
 * 5. Neither field defined → pass through (backwards compatibility).
 *
 * Throws `INVALID_REQUEST` on any failure. Messages name the offending value
 * and the allowed set or cap; they never include credentials or prompts.
 */
function validateSize(
  input: ImageGenerationInput,
  capabilities: ModelCapability
): void {
  const size = input.size;
  if (size === undefined) return;

  if (
    capabilities.supportedSizes &&
    isSupportedSize(size, capabilities.supportedSizes)
  ) {
    return;
  }

  if (capabilities.maxResolution) {
    const match = size.match(PIXEL_SIZE_PATTERN);
    if (!match) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message:
          capabilities.supportedSizes && capabilities.supportedSizes.length > 0
            ? `size "${size}" must be one of ${capabilities.supportedSizes.join(", ")} or a WxH pixel value within ${capabilities.maxResolution.width}x${capabilities.maxResolution.height}`
            : `size "${size}" must be a WxH pixel value (e.g. "1024x1024") not exceeding ${capabilities.maxResolution.width}x${capabilities.maxResolution.height}`,
      });
    }
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (
      width > capabilities.maxResolution.width ||
      height > capabilities.maxResolution.height
    ) {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `size ${width}x${height} exceeds the model's maximum ${capabilities.maxResolution.width}x${capabilities.maxResolution.height}`,
      });
    }
    return;
  }

  if (capabilities.supportedSizes) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `size "${size}" is not supported; allowed values: ${capabilities.supportedSizes.join(", ")}`,
    });
  }

  // No constraints declared → pass through (backwards compatibility).
}

/**
 * Validate the public `n` (output count) parameter against
 * `capabilities.maxN`. The existing positive-integer check still applies
 * when `maxN` is undefined.
 */
function validateN(
  input: ImageGenerationInput,
  capabilities: ModelCapability
): void {
  if (input.n === undefined) return;
  if (!Number.isInteger(input.n) || input.n < 1) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "n must be a positive integer",
    });
  }
  if (capabilities.maxN !== undefined && input.n > capabilities.maxN) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `n=${input.n} exceeds the model's maximum of ${capabilities.maxN}`,
    });
  }
}

/**
 * Generate an image from a prompt via the bound model instance.
 *
 * Validates public parameters against model capabilities, builds a
 * modality-neutral `AdapterRequest`, and dispatches to the adapter `generate`.
 *
 * Generic over `TParams` (defaults to `ImageGenerationInput`) so that when the
 * caller obtains `model` via a literal-id Provider factory overload (e.g.
 * `azure.image("gpt-image-2")`), the `size`/`n`/`providerOptions.<namespace>`
 * fields are narrowed at compile time to what the model accepts. Dynamic
 * model ids (string fallback overload) keep the pre-change `string`/`number`
 * request shape.
 */
export async function generateImage<
  TParams extends ImageGenerationInput = ImageGenerationInput,
>(
  request: ImageGenerationRequest<TParams>
): Promise<GenerationResult<ImageContent[]>> {
  const { model, prompt, n, size, providerOptions } = request;

  if (!model.capabilities.generate) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support image generation`,
    });
  }

  const input: ImageGenerationInput = { prompt, n, size, providerOptions };
  validatePublicParams(input, model.capabilities);

  const adapterRequest: AdapterRequest = {
    provider: model.providerId,
    model: model.modelId,
    modality: "image",
    input,
  };

  return model.adapter.generate(adapterRequest);
}

/**
 * Edit 1-3 existing images from a prompt via the bound model instance.
 *
 * Validates `model.capabilities.edit` and the image count against
 * `maxEditImages`, builds a modality-neutral `AdapterRequest`, and dispatches
 * to the adapter `edit`.
 */
export async function editImage(
  request: ImageEditRequest
): Promise<GenerationResult<ImageContent[]>> {
  const { model, prompt, images, providerOptions } = request;

  if (!model.capabilities.edit) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support image editing`,
    });
  }

  if (prompt.length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "prompt must not be empty",
    });
  }

  const max = model.capabilities.maxEditImages ?? DEFAULT_MAX_EDIT_IMAGES;
  if (images.length < 1 || images.length > max) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `images must contain between 1 and ${max} entries`,
    });
  }

  const input: ImageEditInput = { prompt, images, providerOptions };
  const adapterRequest: AdapterRequest = {
    provider: model.providerId,
    model: model.modelId,
    modality: "image",
    input,
  };

  return model.adapter.edit(adapterRequest);
}

/**
 * Reject unsupported public parameters and out-of-capability `size`/`n`
 * values before any transport call.
 *
 * Only `prompt`, `n`, and `size` are public; everything else must travel under
 * a `providerOptions` namespace. The `providerOptions` object itself is opaque
 * to the core so providers can namespace their own fields. `size`/`n` are
 * validated against `capabilities.supportedSizes`/`maxResolution`/`maxN`
 * when the model declares them; models without these metadata fields pass
 * `size`/`n` through unchanged for backwards compatibility.
 */
function validatePublicParams(
  input: ImageGenerationInput,
  capabilities: ModelCapability
): void {
  const keys = Object.keys(input) as (keyof ImageGenerationInput)[];
  for (const key of keys) {
    if (!SUPPORTED_PUBLIC_PARAMS.has(key) && key !== "providerOptions") {
      throw new SdkError({
        code: "INVALID_REQUEST",
        message: `Unsupported public parameter "${String(key)}"; use providerOptions for provider-specific fields`,
      });
    }
  }

  if (input.prompt.length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "prompt must not be empty",
    });
  }

  validateN(input, capabilities);
  validateSize(input, capabilities);
}

export { isImageEditInput, isImageGenerationInput };
