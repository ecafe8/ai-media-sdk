export type { ImageModelInstance } from "./model-instance.js";
export type {
  ImageGenerationInput,
  ImageGenerationRequest,
  ImageEditInput,
  ImageEditRequest,
} from "./request.js";
export { isImageEditInput, isImageGenerationInput } from "./request.js";
export { generateImage, editImage } from "./generate.js";
