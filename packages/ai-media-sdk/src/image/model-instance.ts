import type { ModelInstance } from "../contracts/model-instance.ts";
import type { ImageContent } from "../contracts/content.ts";

/**
 * Image model instance contracts.
 *
 * `ImageModelInstance` is the image-modality alias of the generic
 * `ModelInstance<TContent>`: the adapter is specialized to `ImageContent[]`
 * so a single generation result can carry multiple images while
 * `GenerationResult<TContent>` stays generic.
 */
export type ImageModelInstance = ModelInstance<ImageContent[]>;
