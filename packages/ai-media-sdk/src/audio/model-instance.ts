import type { AudioContent } from "../contracts/content.ts";
import type {
  DefaultAudioParams,
  ModelInstance,
} from "../contracts/model-instance.ts";

/** Audio-modality model instance specialized to generated audio content. */
export type AudioModelInstance<TParams = DefaultAudioParams> = ModelInstance<
  AudioContent[],
  TParams
>;
