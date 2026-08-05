/**
 * Aliyun-native image generation/editing options.
 *
 * These fields travel under the `providerOptions.aliyun` namespace and never
 * enter the public image contract. Qwen-only fields are forwarded only by the
 * Qwen request builder; Wan uses its own supported-parameter allowlist.
 */

/**
 * A single color entry in a `color_palette` configuration.
 */
export interface AliyunColorPaletteEntry {
  /** HEX color value, e.g. `"#C2D1E6"`. */
  readonly hex: string;
  /** Percentage of the total, e.g. `"23.51%"`. All ratios must sum to 100.00%. */
  readonly ratio: string;
}

/**
 * A bounding box for interactive editing, `[x1, y1, x2, y2]` in absolute
 * pixel coordinates of the original image (top-left origin).
 */
export type AliyunBbox = readonly [number, number, number, number];

/**
 * Options forwarded into the request `parameters` body under the
 * `providerOptions.aliyun` namespace.
 *
 * Qwen-style fields (`negative_prompt`, `prompt_extend`, `prompt_extend_mode`)
 * are forwarded only by models whose `paramSupport` declares them (Qwen
 * family + wan2.6-t2i). Wan 2.7-specific fields (`thinking_mode`,
 * `color_palette`, `enable_sequential`, `bbox_list`) are forwarded only by
 * the Wan 2.7 family builder. `watermark`/`seed` are universal.
 */
export interface AliyunImageProviderOptions {
  /** Negative prompt describing unwanted content. */
  readonly negative_prompt?: string;
  /** Enable prompt smart-rewrite (default true on the API). */
  readonly prompt_extend?: boolean;
  /** Prompt-rewrite strategy: `direct` (default) or `agent` (T2I only). */
  readonly prompt_extend_mode?: "direct" | "agent";
  /** Whether to add a watermark (default false). */
  readonly watermark?: boolean;
  /** Random seed for reproducible generation, `[0, 2147483647]`. */
  readonly seed?: number;
  /** Wan 2.7 reasoning mode (default true). Only when `enable_sequential` is false and no image input. */
  readonly thinking_mode?: boolean;
  /** Wan 2.7 custom color theme (3-10 entries, recommended 8). Only when `enable_sequential` is false. */
  readonly color_palette?: ReadonlyArray<AliyunColorPaletteEntry>;
  /** Wan 2.7 sequential (group-image) multi-image generation mode. */
  readonly enable_sequential?: boolean;
  /** Wan 2.7 interactive-edit bounding boxes per input image. */
  readonly bbox_list?: ReadonlyArray<ReadonlyArray<AliyunBbox>>;
}
