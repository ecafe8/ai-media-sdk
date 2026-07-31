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
 * `submitVideoTask` is the video twin of a future `submitImageTask`: it
 * validates the video modality, the model's `async` capability, and the
 * prompt, builds a modality-neutral `AdapterRequest`, and dispatches to the
 * bound adapter `submit()`, returning a `TaskHandle<VideoContent[]>`. First-
 * frame (i2v) presence and provider-native parameter validation are enforced
 * by the adapter, not the core.
 */
export async function submitVideoTask(
  request: VideoGenerationRequest
): Promise<TaskHandle<VideoContent[]>> {
  const { model, prompt, firstFrame, providerOptions } = request;

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

  if (prompt.length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "prompt must not be empty",
    });
  }

  const input: VideoGenerationInput = { prompt, firstFrame, providerOptions };
  return submitTask<VideoContent[]>({ model, modality: "video", input });
}
