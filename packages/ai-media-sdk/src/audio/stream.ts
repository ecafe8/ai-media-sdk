import type { AdapterRequest } from "../contracts/adapter.ts";
import type { AudioStreamEvent } from "../contracts/audio-stream.ts";
import { SdkError } from "../contracts/error.ts";
import type { AudioModelInstance } from "./model-instance.ts";
import type { AudioGenerationInput } from "./request.ts";

export interface AudioStreamRequest {
  readonly model: AudioModelInstance;
  readonly text: string;
  readonly voice: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
}

/** Stream HTTP SSE TTS events from a provider. */
export function streamAudio(
  request: AudioStreamRequest
): AsyncIterable<AudioStreamEvent> {
  const { model, text, voice, providerOptions, signal } = request;
  if (model.capabilities.modality !== "audio") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support audio streaming`,
    });
  }
  if (text.trim().length === 0 || voice.trim().length === 0) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "text and voice must not be empty",
    });
  }
  if (typeof model.adapter.streamAudio !== "function") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support audio streaming`,
    });
  }
  const input: AudioGenerationInput = { text, voice, providerOptions };
  const adapterRequest: AdapterRequest = {
    provider: model.providerId,
    model: model.modelId,
    modality: "audio",
    input,
    signal,
  };
  return abortable(model.adapter.streamAudio(adapterRequest), signal);
}

async function* abortable(
  events: AsyncIterable<AudioStreamEvent>,
  signal?: AbortSignal
): AsyncIterable<AudioStreamEvent> {
  for await (const event of events) {
    if (signal?.aborted) {
      throw new SdkError({
        code: "TIMEOUT",
        message: "Audio stream was aborted",
      });
    }
    yield event;
  }
}
