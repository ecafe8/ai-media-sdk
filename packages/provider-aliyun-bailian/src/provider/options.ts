/**
 * Aliyun-native image generation/editing options.
 *
 * These fields travel under the `providerOptions.aliyun` namespace and never
 * enter the public image contract. Qwen-only fields are forwarded only by the
 * Qwen request builder; Wan uses its own supported-parameter allowlist.
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
  /** Wan 2.7 reasoning mode. */
  readonly thinking_mode?: string;
  /** Wan 2.7 color palette configuration. */
  readonly color_palette?: unknown;
  /** Wan 2.7 sequential multi-image generation configuration. */
  readonly enable_sequential?: boolean;
}
