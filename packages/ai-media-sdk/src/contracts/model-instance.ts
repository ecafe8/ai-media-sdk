import type { ProviderId, ModelId } from "./provider-identity.ts";
import type { ModelCapability } from "./capabilities.ts";
import type { ProviderAdapter } from "./adapter.ts";

/**
 * Modality-neutral model-instance contract.
 *
 * A model instance binds a Provider adapter to a specific model together with
 * its capability metadata. `TContent` specializes the adapter's result/task
 * content type per modality: `ImageContent[]` for image, `VideoContent[]` for
 * video. Image/video-specific aliases (`ImageModelInstance`, `VideoModelInstance`)
 * narrow `TContent`; `submitTask`/`submitVideoTask` dispatch through the bound
 * adapter.
 */
export interface ModelInstance<TContent> {
  readonly providerId: ProviderId;
  readonly modelId: ModelId;
  readonly adapter: ProviderAdapter<TContent>;
  readonly capabilities: ModelCapability;
}
