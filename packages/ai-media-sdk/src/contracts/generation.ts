import type { SdkError } from "./error.ts";
import type { ModelId, ProviderId } from "./provider-identity.ts";

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
  readonly usage?: unknown;
}

/**
 * Lifecycle status of an asynchronous generation task.
 */
export type TaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

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
  wait(options?: TaskWaitOptions): Promise<GenerationResult<TContent>>;
}

/**
 * Options for `TaskHandle.wait()`.
 *
 * `pollIntervalMs`/`timeoutMs` override the handle defaults; `signal` aborts
 * polling between polls.
 */
export interface TaskWaitOptions {
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/**
 * The outcome of one poll step, supplied by a Provider adapter.
 *
 * A non-terminal status keeps polling; a terminal status resolves (`succeeded`)
 * or rejects (`failed`/`cancelled`) `wait()`.
 */
export interface TaskPollResult<TContent> {
  readonly status: TaskStatus;
  readonly result?: GenerationResult<TContent>;
  readonly error?: SdkError;
}
