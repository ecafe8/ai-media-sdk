import type { ModelId } from "../contracts/provider-identity.ts";
import type { ProviderId } from "../contracts/provider-identity.ts";
import type { ModelCapability } from "../contracts/capabilities.ts";
import type { ProviderAdapter } from "../contracts/adapter.ts";
import type { ImageContent } from "../contracts/content.ts";

/**
 * Image model instance contracts.
 *
 * A model instance binds a Provider adapter to a specific model (or Azure
 * deployment name) together with its capability metadata. `generateImage`
 * dispatches through the bound adapter instead of selecting a global client.
 */

/**
 * A provider-bound image model instance.
 *
 * `adapter` is specialized to `ImageContent[]` so a single generation result
 * can carry multiple images while `GenerationResult<TContent>` stays generic.
 */
export interface ImageModelInstance {
  readonly providerId: ProviderId;
  readonly modelId: ModelId;
  readonly adapter: ProviderAdapter<ImageContent[]>;
  readonly capabilities: ModelCapability;
}
