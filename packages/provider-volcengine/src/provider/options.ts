/**
 * Volcengine Ark-native image generation/editing options.
 *
 * These fields travel under the `providerOptions.volcengine` namespace and
 * never enter the public image contract. Field names mirror the live
 * Volcengine Ark `/images/generations` API for Doubao-Seedream models.
 */

/**
 * Prompt-optimization mode options forwarded into the request body under the
 * `providerOptions.volcengine.optimize_prompt_options` namespace.
 */
export interface VolcengineOptimizePromptOptions {
  /** `standard` (default) or `fast` (faster, slightly lower quality). */
  readonly mode?: "standard" | "fast";
}

/**
 * Options forwarded into the Ark request body under the
 * `providerOptions.volcengine` namespace.
 */
export interface VolcengineImageProviderOptions {
  /** Whether to add an "AI生成" watermark (default false). */
  readonly watermark?: boolean;
  /** Output file format (`png`/`jpeg`); only 5.0 series support customization. */
  readonly output_format?: "png" | "jpeg";
  /** Result return format: `url` (default) or `b64_json`. */
  readonly response_format?: "url" | "b64_json";
  /** Prompt-optimization mode controlling quality vs speed. */
  readonly optimize_prompt_options?: VolcengineOptimizePromptOptions;
}
