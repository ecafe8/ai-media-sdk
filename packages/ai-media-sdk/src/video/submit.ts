import { SdkError, type TaskHandle } from "../contracts/index.ts";
import type { VideoContent } from "../contracts/content.ts";
import { submitTask } from "../async/index.ts";
import type {
  VideoGenerationInput,
  VideoGenerationRequest,
} from "./request.ts";

/**
 * Video API entry point.
 *
 * `submitVideoTask` is the video twin of `submitImageTask`: it validates the
 * video modality and the model's `async` capability, builds a modality-neutral
 * `AdapterRequest`, and dispatches to the bound adapter `submit()`, returning a
 * `TaskHandle<VideoContent[]>`. Model-specific media presence, prompt
 * requirement, and provider-native parameter validation are enforced by the
 * adapter, not the core (prompt is optional for i2v, required for t2v/r2v/
 * video-edit). Generic over `TParams` (defaults to `VideoGenerationInput`) so
 * callers selecting a video model by literal id get compile-time narrowing of
 * `providerOptions.<namespace>` (e.g. `aliyun.resolution`,
 * `aliyun.audio_setting`).
 */
export async function submitVideoTask<
  TParams extends VideoGenerationInput = VideoGenerationInput,
>(
  request: VideoGenerationRequest<TParams>
): Promise<TaskHandle<VideoContent[]>> {
  const {
    model,
    prompt,
    firstFrame,
    referenceImages,
    inputVideo,
    providerOptions,
  } = request;

  if (!model.capabilities.async) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support asynchronous task submission`,
    });
  }

  if (model.capabilities.modality !== "video") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" is not a video model`,
    });
  }

  const input: VideoGenerationInput = {
    prompt,
    firstFrame,
    referenceImages,
    inputVideo,
    providerOptions,
  };
  return submitTask<VideoContent[]>({ model, modality: "video", input });
}
