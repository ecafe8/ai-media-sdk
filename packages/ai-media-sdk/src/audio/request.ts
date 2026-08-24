import type { AudioModelInstance } from "./model-instance.ts";

/** Provider-independent non-realtime text-to-speech input. */
export interface AudioGenerationInput {
  readonly text: string;
  readonly voice: string;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
}

/** Audio generation request bound to an audio model instance. */
export type AudioGenerationRequest<
  TParams extends AudioGenerationInput = AudioGenerationInput,
> = TParams & { readonly model: AudioModelInstance<TParams> };

export function isAudioGenerationInput(
  value: unknown
): value is AudioGenerationInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.text === "string" && typeof candidate.voice === "string"
  );
}
