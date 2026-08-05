import type { ModelId } from "./provider-identity.ts";

/**
 * Modality and capability contracts.
 *
 * The core is modality-neutral: image is the only implemented modality in
 * Phase 0, while video and audio remain reserved for future phases.
 */

/**
 * The generation modality a request targets.
 */
export type Modality = "image" | "video" | "audio";

/**
 * Capability flags for a model. Reserved modalities are `false` in Phase 0.
 *
 * `maxEditImages` bounds how many reference images an edit request may carry
 * (Qwen I2I accepts 1-3); it is undefined when the model does not edit.
 * `async` marks models that submit asynchronous tasks (e.g. Aliyun video);
 * `submitTask` rejects models without it. Sync-only models leave it undefined.
 *
 * Size/output-count metadata (`supportedSizes`, `maxResolution`, `maxN`) is
 * honoured by `generateImage` pre-flight validation. Models that do not
 * declare these fields continue to pass `size`/`n` through unchanged, so the
 * contract is backwards-compatible. Provider-specific video resolution/ratio
 * metadata stays on each Provider's full registry entry and does not enter
 * the common projection.
 */
export interface ModelCapability {
  readonly modality: Modality;
  readonly generate: boolean;
  readonly edit: boolean;
  readonly maxEditImages?: number;
  readonly async?: boolean;
  /**
   * Closed set of allowed `size` values (e.g.
   * `["1024x1024","1024x1536","1536x1024","auto"]` for Azure
   * `gpt-image-2`, or `["1K","2K"]` for Seedream 5.0 pro). When defined,
   * `generateImage` rejects `size` values not in this list with
   * `INVALID_REQUEST` before any network call. Lookup is case-sensitive.
   */
  readonly supportedSizes?: readonly string[];
  /**
   * Pixel-size upper bound (e.g. `{ width: 2048, height: 2048 }` for Aliyun
   * Qwen). When `supportedSizes` is undefined and this is defined,
   * `generateImage` requires `size` to match `^\d+[x*]\d+$/i` and rejects
   * values whose width/height exceed this cap. When both `supportedSizes`
   * and `maxResolution` are defined, a `size` matching an entry in
   * `supportedSizes` passes first; otherwise the pixel-form + cap check
   * applies (for models that accept either form, e.g. Seedream, Wan).
   */
  readonly maxResolution?: { readonly width: number; readonly height: number };
  /**
   * Maximum output count for `n`. When defined, `generateImage` rejects
   * `n > maxN` with `INVALID_REQUEST` before any network call. Distinct from
   * `maxEditImages` (which bounds the input reference-image count for
   * `editImage`).
   */
  readonly maxN?: number;
}

/**
 * A model together with its capability metadata.
 */
export interface CapabilityEntry {
  readonly model: ModelId;
  readonly capability: ModelCapability;
}
