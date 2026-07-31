import {
  SdkError,
  type GenerationResult,
  type TaskHandle,
  type TaskPollResult,
  type TaskWaitOptions,
} from "../contracts/index.ts";

/**
 * Core asynchronous task-handle construction.
 *
 * `createTaskHandle` builds a `TaskHandle<TContent>` whose `wait()` polls a
 * provider-supplied `poll()` closure until a terminal status, sleeping
 * `pollIntervalMs` between polls and timing out at `timeoutMs`. The polling
 * loop (sleep/backoff/timeout/abort) is modality- and provider-neutral;
 * adapters only supply the provider-specific "fetch task status" closure.
 */

const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 600_000;

/**
 * Options for constructing a `TaskHandle`.
 */
export interface CreateTaskHandleOptions<TContent> {
  readonly taskId: string;
  readonly poll: () => Promise<TaskPollResult<TContent>>;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

/**
 * Build a `TaskHandle<TContent>` that polls `poll()` to a terminal state.
 */
export function createTaskHandle<TContent>(
  options: CreateTaskHandleOptions<TContent>
): TaskHandle<TContent> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let latest: TaskPollResult<TContent> | undefined;

  const handle: TaskHandle<TContent> = {
    taskId: options.taskId,
    get status(): TaskPollResult<TContent>["status"] {
      return latest?.status ?? "pending";
    },
    get result(): GenerationResult<TContent> | undefined {
      return latest?.result;
    },
    get error(): SdkError | undefined {
      return latest?.error;
    },
    async wait(
      waitOptions?: TaskWaitOptions
    ): Promise<GenerationResult<TContent>> {
      const interval = waitOptions?.pollIntervalMs ?? pollIntervalMs;
      const timeout = waitOptions?.timeoutMs ?? timeoutMs;
      const signal = waitOptions?.signal;
      const deadline = Date.now() + timeout;

      let first = true;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) {
          throw new SdkError({
            code: "UNKNOWN",
            message: "Task wait was aborted",
          });
        }
        const polled = await options.poll();
        latest = polled;
        if (polled.status === "succeeded") {
          if (!polled.result) {
            throw new SdkError({
              code: "PROVIDER_ERROR",
              message: "Task succeeded but returned no result",
            });
          }
          return polled.result;
        }
        if (polled.status === "failed" || polled.status === "cancelled") {
          throw (
            polled.error ??
            new SdkError({
              code: "PROVIDER_ERROR",
              message: `Task ended in status ${polled.status}`,
            })
          );
        }
        if (Date.now() >= deadline) {
          throw new SdkError({
            code: "TIMEOUT",
            message: `Task did not terminate within ${timeout}ms`,
          });
        }
        if (!first) {
          await sleep(interval, signal);
        }
        first = false;
      }
    },
  };

  return handle;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
