import type { AdapterRequest } from "../contracts/adapter.ts";
import type { AudioContent } from "../contracts/content.ts";
import { SdkError } from "../contracts/error.ts";
import type { GenerationResult } from "../contracts/generation.ts";
import type {
  AudioGenerationInput,
  AudioGenerationRequest,
} from "./request.ts";

/** Generate speech through a bound synchronous audio model. */
export async function generateAudio<
  TParams extends AudioGenerationInput = AudioGenerationInput,
>(
  request: AudioGenerationRequest<TParams>
): Promise<GenerationResult<AudioContent[]>> {
  const { model, text, voice, providerOptions } = request;
  if (model.capabilities.modality !== "audio" || !model.capabilities.generate) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support audio generation`,
    });
  }
  if (text.trim().length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "text must not be empty",
    });
  }
  if (voice.trim().length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "voice must not be empty",
    });
  }
  const adapterRequest: AdapterRequest = {
    provider: model.providerId,
    model: model.modelId,
    modality: "audio",
    input: { text, voice, providerOptions },
  };
  return model.adapter.generate(adapterRequest);
}
