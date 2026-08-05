import type { ModelInstance, DefaultImageParams } from "../contracts/model-instance.ts";
import type { ImageContent } from "../contracts/content.ts";

/**
 * Image model instance contracts.
 *
 * `ImageModelInstance<TParams>` is the image-modality alias of the generic
 * `ModelInstance<TContent, TParams>`: the adapter is specialized to
 * `ImageContent[]` so a single generation result can carry multiple images
 * while `GenerationResult<TContent>` stays generic. `TParams` is the phantom
 * family-type parameter (defaults to `ImageGenerationInput`) used by
 * `generateImage`/`editImage`/`submitImageTask` to narrow the request shape
 * at compile time when callers select a model by literal id.
 */
export type ImageModelInstance<TParams = DefaultImageParams> =
  ModelInstance<ImageContent[], TParams>;
