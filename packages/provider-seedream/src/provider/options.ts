/**
 * Doubao-Seedream-native image generation/editing options.
 *
 * These fields travel under the `providerOptions.seedream` namespace and never
 * enter the public image contract. Field names mirror the live Volcengine Ark
 * `/images/generations` API for Doubao-Seedream models.
 */

/**
 * Prompt-optimization mode options forwarded into the request body under the
 * `providerOptions.seedream.optimize_prompt_options` namespace.
 */
export interface SeedreamOptimizePromptOptions {
  /** `standard` (default) or `fast` (faster, slightly lower quality). */
  readonly mode?: "standard" | "fast";
}

/**
 * Options forwarded into the Ark request body under the
 * `providerOptions.seedream` namespace.
 */
export interface SeedreamImageProviderOptions {
  /** Whether to add an "AI生成" watermark (default false). */
  readonly watermark?: boolean;
  /** Output file format (`png`/`jpeg`); only 5.0 series support customization. */
  readonly output_format?: "png" | "jpeg";
  /** Result return format: `url` (default) or `b64_json`. */
  readonly response_format?: "url" | "b64_json";
  /** Prompt-optimization mode controlling quality vs speed. */
  readonly optimize_prompt_options?: SeedreamOptimizePromptOptions;
}
