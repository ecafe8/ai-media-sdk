import type { ImageGenerationInput } from "@ai-media/sdk";

import type { AzureImageProviderOptions } from "./options.ts";

/**
 * Family-typed request params for the Azure `gpt-image-2` deployment.
 *
 * Selected when callers write `azure.image("gpt-image-2")` so `generateImage`
 * and `submitImageTask` narrow `size` to the documented Azure values and
 * `providerOptions.azure` to the `AzureImageProviderOptions` shape at compile
 * time. `n` is constrained to `1` because the deployment returns a single
 * image per call. The runtime shape is identical to `ImageGenerationInput`;
 * `TParams` is phantom.
 */
export interface AzureGptImage2Params extends ImageGenerationInput {
  readonly size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  readonly n?: 1;
  readonly providerOptions?: {
    readonly azure?: AzureImageProviderOptions;
  };
}
