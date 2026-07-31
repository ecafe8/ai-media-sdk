import type { ProviderId, ModelId } from "./provider-identity.ts";
import type { SdkError } from "./error.ts";

/**
 * Generation lifecycle contracts.
 *
 * `GenerationResult<TContent>` and `TaskHandle<TContent>` are the generic,
 * modality-neutral result and async-task surfaces. Image APIs specialize them
 * with `ImageContent`; video/audio specialize them in future phases.
 */

/**
 * A completed generation result specialized by content type.
 */
export interface GenerationResult<TContent> {
  readonly content: TContent;
  readonly provider: ProviderId;
  readonly model: ModelId;
  readonly requestId?: string;
  readonly createdAt?: string;
  readonly raw?: unknown;
}

/**
 * Lifecycle status of an asynchronous generation task.
 */
export type TaskStatus =
  "pending" | "running" | "succeeded" | "failed" | "cancelled";

/**
 * A handle to an in-flight or completed asynchronous task.
 *
 * `result` and `error` are present once the task reaches a terminal state;
 * `wait()` resolves with the final result or rejects with the final error.
 */
export interface TaskHandle<TContent> {
  readonly taskId: string;
  readonly status: TaskStatus;
  readonly result?: GenerationResult<TContent>;
  readonly error?: SdkError;
  wait(): Promise<GenerationResult<TContent>>;
}
