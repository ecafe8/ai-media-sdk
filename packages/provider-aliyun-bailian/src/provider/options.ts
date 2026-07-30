/**
 * Aliyun-native image generation/editing options.
 *
 * These fields travel under the `providerOptions.aliyun` namespace and never
 * enter the public image contract. Field names mirror the live DashScope
 * `multimodal-generation/generation` API for Qwen-Image models.
 */

/**
 * Options forwarded into the Qwen request `parameters` body under the
 * `providerOptions.aliyun` namespace.
 */
export interface AliyunImageProviderOptions {
  /** Negative prompt describing unwanted content. */
  readonly negative_prompt?: string;
  /** Enable prompt smart-rewrite (default true on the API). */
  readonly prompt_extend?: boolean;
  /** Whether to add a watermark (default false). */
  readonly watermark?: boolean;
  /** Random seed for reproducible generation, `[0, 2147483647]`. */
  readonly seed?: number;
}
