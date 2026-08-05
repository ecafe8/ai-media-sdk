import type { ProviderId, ModelId } from "./provider-identity.ts";
import type { ModelCapability } from "./capabilities.ts";
import type { ProviderAdapter } from "./adapter.ts";
import type { ImageGenerationInput } from "../image/request.ts";
import type { VideoGenerationInput } from "../video/request.ts";

/**
 * Modality-neutral model-instance contract.
 *
 * A model instance binds a Provider adapter to a specific model together with
 * its capability metadata. `TContent` specializes the adapter's result/task
 * content type per modality: `ImageContent[]` for image, `VideoContent[]` for
 * video. Image/video-specific aliases (`ImageModelInstance`, `VideoModelInstance`)
 * narrow `TContent`; `submitTask`/`submitVideoTask` dispatch through the bound
 * adapter.
 *
 * `TParams` is a phantom type parameter: it carries the family-specific request
 * shape (e.g. `AzureGptImage2Params` with `size: "1024x1024" | ... | "auto"`,
 * `n: 1`, `providerOptions: { azure?: AzureImageProviderOptions }`) at
 * compile time so `generateImage`/`editImage`/`submitImageTask` can constrain
 * the request fields to what the selected model accepts. It adds no runtime
 * state: the runtime shape is `providerId`/`modelId`/`adapter`/`capabilities`
 * only, and `TParams` is never read at runtime. The default `unknown` keeps
 * existing untyped call sites compiling without narrowing.
 */
export interface ModelInstance<TContent, TParams = unknown> {
  readonly providerId: ProviderId;
  readonly modelId: ModelId;
  readonly adapter: ProviderAdapter<TContent>;
  readonly capabilities: ModelCapability;
}

/**
 * Default `TParams` aliases used by image/video model-instance type aliases
 * when callers select a model by `string` id (no family narrowing). They keep
 * the pre-change request shape — `size: string`, `n: number`,
 * `providerOptions: Record<string, unknown>` — so dynamic model ids (including
 * Playground server.ts) continue to type-check.
 */
export type DefaultImageParams = ImageGenerationInput;
export type DefaultVideoParams = VideoGenerationInput;
