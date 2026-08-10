import {
  type AdapterModality,
  type AdapterRequest,
  type ModelInstance,
  SdkError,
  type TaskHandle,
} from "../contracts/index.ts";

/**
 * Core modality-neutral asynchronous task submission.
 *
 * `submitTask<TContent>` mirrors `generateImage`'s dispatch for async-capable
 * models: validate `model.capabilities.async`, build a modality-neutral
 * `AdapterRequest`, and dispatch to `model.adapter.submit()`. Sync-only models
 * (no `async` capability or no `submit` on the adapter) are rejected with
 * `INVALID_REQUEST` before dispatch. Image/video-specific entry points
 * (`submitVideoTask`, and a future `submitImageTask`) are thin typed wrappers
 * over this generic dispatcher.
 */

/**
 * A modality-neutral task submission bound to a provider model instance.
 */
export interface TaskSubmissionRequest<TContent> {
  readonly model: ModelInstance<TContent>;
  readonly modality: AdapterModality;
  readonly input: unknown;
}

/**
 * Submit an asynchronous generation task via the bound model instance.
 */
export async function submitTask<TContent>(
  request: TaskSubmissionRequest<TContent>
): Promise<TaskHandle<TContent>> {
  const { model, modality, input } = request;

  if (!model.capabilities.async) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" does not support asynchronous task submission`,
    });
  }

  const submit = model.adapter.submit;
  if (typeof submit !== "function") {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: `Model "${model.modelId}" adapter does not implement submit`,
    });
  }

  const adapterRequest: AdapterRequest = {
    provider: model.providerId,
    model: model.modelId,
    modality,
    input,
  };

  return submit.call(model.adapter, adapterRequest);
}
