import type { SiteModel } from "@/lib/playground/types";

/**
 * Image form schema helpers.
 *
 * Pure functions that derive dropdown options and the Advanced Options
 * field set from the selected model's `supportedSizes`/`maxResolution`/
 * `maxN`/`family` metadata. Used by the ImageWorkbench to render model-aware
 * controls and to seed default values (`options[0].value`).
 */

/**
 * Pixel-size presets used when a model declares only `maxResolution` (e.g.
 * Aliyun Qwen, Aliyun Wan). Filtered against the model's cap so the form
 * never lists a value that exceeds the model's documented maximum.
 */
const PIXEL_PRESETS: readonly { readonly w: number; readonly h: number }[] = [
  { w: 1024, h: 1024 },
  { w: 1536, h: 1024 },
  { w: 1024, h: 1536 },
  { w: 2048, h: 2048 },
  { w: 2048, h: 1024 },
  { w: 1024, h: 2048 },
  { w: 4096, h: 4096 },
];

export interface FormOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * Derive the `size` dropdown options for the selected image model.
 *
 * - Models with a closed `supportedSizes` (e.g. Azure `gpt-image-2`,
 *   Seedream tier enums) list exactly those values.
 * - Models with only `maxResolution` (e.g. Aliyun Qwen, Aliyun Wan) list
 *   pixel presets filtered to those within the cap.
 * - Models without size metadata (none in the live registry, but defensive)
 *   fall back to a single `1024x1024` option.
 */
export function imageSizeOptions(
  model: SiteModel
): readonly FormOption<string>[] {
  if (model.supportedSizes && model.supportedSizes.length > 0) {
    return model.supportedSizes.map((value) => ({ value, label: value }));
  }
  if (model.maxResolution) {
    const { width, height } = model.maxResolution;
    return PIXEL_PRESETS.filter((p) => p.w <= width && p.h <= height).map(
      (p) => ({
        value: `${p.w}x${p.h}`,
        label: `${p.w}×${p.h}`,
      })
    );
  }
  return [{ value: "1024x1024", label: "1024×1024" }];
}

/**
 * Derive the `n` dropdown options for the selected image model. When the
 * model declares `maxN`, the list is `1..maxN`. Otherwise a defensive
 * `1..4` list is returned.
 */
export function imageNOptions(model: SiteModel): readonly FormOption<number>[] {
  const max = model.maxN ?? 4;
  const list: FormOption<number>[] = [];
  for (let i = 1; i <= max; i += 1) {
    list.push({ value: i, label: `${i} 张` });
  }
  return list;
}

/**
 * The set of provider-native `providerOptions.<namespace>` fields exposed
 * in the Advanced Options section, keyed by the selected model's `family`.
 *
 * Field ids are stable strings (not tied to a specific provider's options
 * interface); the ImageWorkbench renders an appropriate control per id and
 * maps it into the request body's `providerOptions.<namespace>` shape.
 */
export type ImageAdvancedFieldId =
  | "azure.quality"
  | "azure.output_format"
  | "azure.output_compression"
  | "aliyun.negative_prompt"
  | "aliyun.prompt_extend"
  | "aliyun.watermark"
  | "aliyun.seed"
  | "aliyun.thinking_mode"
  | "aliyun.color_palette"
  | "aliyun.enable_sequential"
  | "seedream.watermark"
  | "seedream.output_format"
  | "seedream.response_format"
  | "seedream.optimize_prompt_mode";

export interface ImageAdvancedField {
  readonly id: ImageAdvancedFieldId;
  readonly label: string;
  readonly kind: "text" | "number" | "boolean" | "select";
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

/**
 * Per-family Advanced Options field set. Fields outside this set SHALL NOT
 * appear in the section, so models that do not support a parameter (e.g.
 * Seedream 4.x `output_format`) simply omit it.
 */
export function imageAdvancedFieldSet(
  model: SiteModel
): readonly ImageAdvancedField[] {
  switch (model.family) {
    case "azure-gpt-image":
      return [
        { id: "azure.quality", label: "质量", kind: "text" },
        {
          id: "azure.output_format",
          label: "输出格式",
          kind: "select",
          options: [
            { value: "png", label: "PNG" },
            { value: "jpeg", label: "JPEG" },
          ],
        },
        { id: "azure.output_compression", label: "压缩等级", kind: "number" },
      ];
    case "qwen-multimodal":
      return [
        { id: "aliyun.negative_prompt", label: "负向提示词", kind: "text" },
        {
          id: "aliyun.prompt_extend",
          label: "提示词扩写",
          kind: "boolean",
        },
        { id: "aliyun.watermark", label: "水印", kind: "boolean" },
        { id: "aliyun.seed", label: "随机种子", kind: "number" },
      ];
    case "wan-image-2.6":
      return [
        { id: "aliyun.negative_prompt", label: "负向提示词", kind: "text" },
        {
          id: "aliyun.prompt_extend",
          label: "提示词扩写",
          kind: "boolean",
        },
        { id: "aliyun.watermark", label: "水印", kind: "boolean" },
        { id: "aliyun.seed", label: "随机种子", kind: "number" },
      ];
    case "wan-image-2.7":
      return [
        { id: "aliyun.watermark", label: "水印", kind: "boolean" },
        { id: "aliyun.seed", label: "随机种子", kind: "number" },
        { id: "aliyun.thinking_mode", label: "Thinking 模式", kind: "boolean" },
        {
          id: "aliyun.color_palette",
          label: "调色板",
          kind: "text",
        },
        {
          id: "aliyun.enable_sequential",
          label: "组图模式",
          kind: "boolean",
        },
      ];
    case "doubao-seedream-5-pro":
    case "doubao-seedream-5-lite":
      return [
        { id: "seedream.watermark", label: "水印", kind: "boolean" },
        {
          id: "seedream.output_format",
          label: "输出格式",
          kind: "select",
          options: [
            { value: "png", label: "PNG" },
            { value: "jpeg", label: "JPEG" },
          ],
        },
        {
          id: "seedream.response_format",
          label: "响应格式",
          kind: "select",
          options: [
            { value: "url", label: "URL" },
            { value: "b64_json", label: "Base64" },
          ],
        },
        {
          id: "seedream.optimize_prompt_mode",
          label: "提示词优化",
          kind: "select",
          options: [
            { value: "standard", label: "Standard" },
            { value: "fast", label: "Fast" },
          ],
        },
      ];
    case "doubao-seedream-4-5":
    case "doubao-seedream-4-0":
      return [
        { id: "seedream.watermark", label: "水印", kind: "boolean" },
        {
          id: "seedream.response_format",
          label: "响应格式",
          kind: "select",
          options: [
            { value: "url", label: "URL" },
            { value: "b64_json", label: "Base64" },
          ],
        },
        {
          id: "seedream.optimize_prompt_mode",
          label: "提示词优化",
          kind: "select",
          options: [
            { value: "standard", label: "Standard" },
            { value: "fast", label: "Fast" },
          ],
        },
      ];
    default:
      return [];
  }
}
