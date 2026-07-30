import { SdkError } from "../contracts/error.js";
import type { AdapterRequest } from "../contracts/adapter.js";
import type { GenerationResult } from "../contracts/generation.js";
import type { ImageContent } from "../contracts/content.js";
import type {
  ImageEditInput,
  ImageEditRequest,
  ImageGenerationInput,
  ImageGenerationRequest,
} from "./request.js";
import { isImageEditInput, isImageGenerationInput } from "./request.js";

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
 * Generate an image from a prompt via the bound model instance.
 *
 * Validates public parameters against model capabilities, builds a
 * modality-neutral `AdapterRequest`, and dispatches to the adapter `generate`.
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<GenerationResult<ImageContent[]>> {
  const { model, prompt, n, size, providerOptions } = request;

  if (!model.capabilities.generate) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support image generation`,
    });
  }

  const input: ImageGenerationInput = { prompt, n, size, providerOptions };
  validatePublicParams(input);

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
 * Reject unsupported public parameters before any transport call.
 *
 * Only `prompt`, `n`, and `size` are public; everything else must travel under
 * a `providerOptions` namespace. The `providerOptions` object itself is opaque
 * to the core so providers can namespace their own fields.
 */
function validatePublicParams(input: ImageGenerationInput): void {
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

  if (input.n !== undefined && (!Number.isInteger(input.n) || input.n < 1)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "n must be a positive integer",
    });
  }
}

export { isImageEditInput, isImageGenerationInput };
