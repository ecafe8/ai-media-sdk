import type { ImageGenerationInput } from "@ai-media/sdk";

import type { VolcengineImageProviderOptions } from "./options.ts";

/**
 * Aliased re-export so the family `TParams` can reference a stable local
 * shape. Callers selecting a Doubao-Seedream model via `provider.image("...")`
 * get `providerOptions.volcengine` typed to
 * `VolcengineImageProviderOptions`.
 */
export type VolcengineSeedreamFamilyOptions = VolcengineImageProviderOptions;

/**
 * Family-typed request params for Doubao Seedream 5.0 Pro
 * (`doubao-seedream-5-0-pro-260628`). `size` is constrained to the model's
 * tier enum `["1K", "2K"]` (callers may also pass `WxH` pixel values within
 * the 2048x2048 `maxResolution` cap; the core's `validateSize` enforces
 * that at runtime). `n` is constrained to `1` (synchronous Ark API returns
 * a single image per call).
 */
export interface VolcengineSeedream5ProParams extends ImageGenerationInput {
  readonly size?: "1K" | "2K" | (string & {});
  readonly n?: 1;
  readonly providerOptions?: {
    readonly volcengine?: VolcengineSeedreamFamilyOptions;
  };
}

/**
 * Family-typed request params for Doubao Seedream 5.0 / 5.0 Lite
 * (`doubao-seedream-5-0-260128`, `doubao-seedream-5-0-lite-260128`).
 * Tier enum `["2K", "3K", "4K"]`; pixel cap 4096x4096.
 */
export interface VolcengineSeedream5LiteParams extends ImageGenerationInput {
  readonly size?: "2K" | "3K" | "4K" | (string & {});
  readonly n?: 1;
  readonly providerOptions?: {
    readonly volcengine?: VolcengineSeedreamFamilyOptions;
  };
}

/**
 * Family-typed request params for Doubao Seedream 4.5
 * (`doubao-seedream-4-5-251128`). Tier enum `["2K", "4K"]`; pixel cap
 * 4096x4096. Only `jpeg` output is supported (the 4.x series does not
 * accept `output_format`).
 */
export interface VolcengineSeedream45Params extends ImageGenerationInput {
  readonly size?: "2K" | "4K" | (string & {});
  readonly n?: 1;
  readonly providerOptions?: {
    readonly volcengine?: Omit<
      VolcengineSeedreamFamilyOptions,
      "output_format"
    >;
  };
}

/**
 * Family-typed request params for Doubao Seedream 4.0
 * (`doubao-seedream-4-0-250828`). Tier enum `["1K", "2K", "4K"]`; pixel cap
 * 4096x4096. Only `jpeg` output is supported.
 */
export interface VolcengineSeedream40Params extends ImageGenerationInput {
  readonly size?: "1K" | "2K" | "4K" | (string & {});
  readonly n?: 1;
  readonly providerOptions?: {
    readonly volcengine?: Omit<
      VolcengineSeedreamFamilyOptions,
      "output_format"
    >;
  };
}
