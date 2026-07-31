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
 */
export interface ModelCapability {
  readonly modality: Modality;
  readonly generate: boolean;
  readonly edit: boolean;
  readonly maxEditImages?: number;
  readonly async?: boolean;
}

/**
 * A model together with its capability metadata.
 */
export interface CapabilityEntry {
  readonly model: ModelId;
  readonly capability: ModelCapability;
}
