import { submitTask } from "../async/index.ts";
import type { ImageContent } from "../contracts/content.ts";
import { SdkError, type TaskHandle } from "../contracts/index.ts";
import { validatePublicParams } from "./generate.ts";
import type {
  ImageGenerationInput,
  ImageGenerationRequest,
} from "./request.ts";

/**
 * Submit an asynchronous image generation task via the bound model instance.
 *
 * The public request shape intentionally matches `generateImage`; only the
 * dispatch method and asynchronous return contract differ. Generic over
 * `TParams` so callers selecting a model by literal id get compile-time
 * narrowing of `size`/`n`/`providerOptions.<namespace>` exactly as in
 * `generateImage`. Public `size`/`n` are validated against the model's
 * capability metadata pre-flight, same as `generateImage`.
 */
export async function submitImageTask<
  TParams extends ImageGenerationInput = ImageGenerationInput,
>(
  request: ImageGenerationRequest<TParams>
): Promise<TaskHandle<ImageContent[]>> {
  const { model, prompt, n, size, providerOptions } = request;

  if (!model.capabilities.async) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support asynchronous task submission`,
    });
  }

  if (model.capabilities.modality !== "image") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" is not an image model`,
    });
  }

  const input: ImageGenerationInput = { prompt, n, size, providerOptions };
  validatePublicParams(input, model.capabilities);
  return submitTask<ImageContent[]>({ model, modality: "image", input });
}
