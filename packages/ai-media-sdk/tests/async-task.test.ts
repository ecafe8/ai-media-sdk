/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  createTaskHandle,
  submitImageTask,
  submitVideoTask,
  type AdapterRequest,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
  type ProviderAdapter,
  type TaskHandle,
  type VideoContent,
  type VideoModelInstance,
} from "@ai-media/sdk";

function scriptedPoll<TContent>(
  steps: Array<{
    status: "succeeded" | "failed" | "pending" | "running";
    result?: GenerationResult<TContent>;
    error?: SdkError;
  }>
): () => Promise<{
  status: (typeof steps)[number]["status"];
  result?: GenerationResult<TContent>;
  error?: SdkError;
}> {
  let i = 0;
  return async () => {
    const step = steps[i] ?? steps[steps.length - 1]!;
    i += 1;
    return step;
  };
}

describe("createTaskHandle", () => {
  test("resolves when poll reaches succeeded after in-progress states", async () => {
    const result: GenerationResult<VideoContent[]> = {
      content: [{ url: "https://x/v.mp4" }],
      provider: "fake",
      model: "m",
    };
    const handle = createTaskHandle<VideoContent[]>({
      taskId: "t-1",
      poll: scriptedPoll<VideoContent[]>([
        { status: "pending" },
        { status: "running" },
        { status: "succeeded", result },
      ]),
    });

    const out = await handle.wait({ pollIntervalMs: 0, timeoutMs: 5000 });

    expect(out).toBe(result);
    expect(handle.status).toBe("succeeded");
  });

  test("rejects when poll reaches failed", async () => {
    const error = new SdkError({ code: "PROVIDER_ERROR", message: "boom" });
    const handle = createTaskHandle<VideoContent[]>({
      taskId: "t-1",
      poll: scriptedPoll<VideoContent[]>([
        { status: "pending" },
        { status: "failed", error },
      ]),
    });

    await expect(
      handle.wait({ pollIntervalMs: 0, timeoutMs: 5000 })
    ).rejects.toBe(error);
    expect(handle.status).toBe("failed");
  });

  test("times out when the task never terminates", async () => {
    const handle = createTaskHandle<VideoContent[]>({
      taskId: "t-1",
      poll: scriptedPoll<VideoContent[]>([{ status: "running" }]),
    });

    const error = (await handle
      .wait({ pollIntervalMs: 0, timeoutMs: 30 })
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("TIMEOUT");
  });

  test("respects an already-aborted signal", async () => {
    const handle = createTaskHandle<VideoContent[]>({
      taskId: "t-1",
      poll: scriptedPoll<VideoContent[]>([{ status: "running" }]),
    });
    const controller = new AbortController();
    controller.abort();

    const error = (await handle
      .wait({ pollIntervalMs: 0, timeoutMs: 5000, signal: controller.signal })
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("UNKNOWN");
  });
});

function createFakeVideoAdapter(
  submitImpl: (request: AdapterRequest) => Promise<TaskHandle<VideoContent[]>>
): {
  adapter: ProviderAdapter<VideoContent[]>;
  requests: AdapterRequest[];
} {
  const requests: AdapterRequest[] = [];
  const adapter: ProviderAdapter<VideoContent[]> = {
    providerId: "fake",
    async generate(): Promise<GenerationResult<VideoContent[]>> {
      throw new SdkError({ code: "NOT_IMPLEMENTED", message: "no sync" });
    },
    async edit(): Promise<GenerationResult<VideoContent[]>> {
      throw new SdkError({ code: "NOT_IMPLEMENTED", message: "no sync" });
    },
    async submit(request: AdapterRequest): Promise<TaskHandle<VideoContent[]>> {
      requests.push({ ...request });
      return submitImpl(request);
    },
  };
  return { adapter, requests };
}

function videoModel(
  adapter: ProviderAdapter<VideoContent[]>,
  overrides: Partial<VideoModelInstance["capabilities"]> = {}
): VideoModelInstance {
  return {
    providerId: "fake",
    modelId: "happyhorse-1.1-t2v",
    adapter,
    capabilities: {
      modality: "video",
      generate: true,
      edit: false,
      async: true,
      ...overrides,
    },
  };
}

describe("submitVideoTask", () => {
  test("dispatches to adapter.submit for an async video model", async () => {
    const stubHandle = {
      taskId: "t",
      status: "pending",
    } as unknown as TaskHandle<VideoContent[]>;
    const { adapter, requests } = createFakeVideoAdapter(
      async () => stubHandle
    );
    const model = videoModel(adapter);

    const task = await submitVideoTask({ model, prompt: "p" });

    expect(task).toBe(stubHandle);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.modality).toBe("video");
    expect(requests[0]!.model).toBe("happyhorse-1.1-t2v");
  });

  test("rejects a non-async model before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<VideoContent[]>;
    const { adapter, requests } = createFakeVideoAdapter(
      async () => stubHandle
    );
    const model = videoModel(adapter, { async: false });

    await expect(submitVideoTask({ model, prompt: "p" })).rejects.toMatchObject(
      {
        code: "INVALID_REQUEST",
      }
    );
    expect(requests).toHaveLength(0);
  });

  test("rejects a non-video modality model before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<VideoContent[]>;
    const { adapter, requests } = createFakeVideoAdapter(
      async () => stubHandle
    );
    const model = videoModel(adapter, { modality: "image" });

    await expect(submitVideoTask({ model, prompt: "p" })).rejects.toMatchObject(
      {
        code: "INVALID_REQUEST",
      }
    );
    expect(requests).toHaveLength(0);
  });

  test("rejects an empty prompt before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<VideoContent[]>;
    const { adapter, requests } = createFakeVideoAdapter(
      async () => stubHandle
    );
    const model = videoModel(adapter);

    await expect(submitVideoTask({ model, prompt: "" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(requests).toHaveLength(0);
  });
});

function createFakeImageAdapter(
  submitImpl: (request: AdapterRequest) => Promise<TaskHandle<ImageContent[]>>
): { adapter: ProviderAdapter<ImageContent[]>; requests: AdapterRequest[] } {
  const requests: AdapterRequest[] = [];
  const adapter: ProviderAdapter<ImageContent[]> = {
    providerId: "fake",
    async generate(): Promise<GenerationResult<ImageContent[]>> {
      throw new SdkError({ code: "NOT_IMPLEMENTED", message: "no sync" });
    },
    async edit(): Promise<GenerationResult<ImageContent[]>> {
      throw new SdkError({ code: "NOT_IMPLEMENTED", message: "no sync" });
    },
    async submit(request: AdapterRequest): Promise<TaskHandle<ImageContent[]>> {
      requests.push({ ...request });
      return submitImpl(request);
    },
  };
  return { adapter, requests };
}

function imageModel(
  adapter: ProviderAdapter<ImageContent[]>,
  overrides: Partial<ImageModelInstance["capabilities"]> = {}
): ImageModelInstance {
  return {
    providerId: "fake",
    modelId: "wan2.7-image-pro",
    adapter,
    capabilities: {
      modality: "image",
      generate: true,
      edit: false,
      async: true,
      ...overrides,
    },
  };
}

describe("submitImageTask", () => {
  test("dispatches to adapter.submit for an async image model", async () => {
    const stubHandle = {
      taskId: "t",
      status: "pending",
    } as unknown as TaskHandle<ImageContent[]>;
    const { adapter, requests } = createFakeImageAdapter(
      async () => stubHandle
    );

    const task = await submitImageTask({
      model: imageModel(adapter),
      prompt: "p",
      n: 2,
      size: "2K",
    });

    expect(task).toBe(stubHandle);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.modality).toBe("image");
    expect(requests[0]!.model).toBe("wan2.7-image-pro");
  });

  test("rejects a non-async model before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<ImageContent[]>;
    const { adapter, requests } = createFakeImageAdapter(
      async () => stubHandle
    );

    await expect(
      submitImageTask({
        model: imageModel(adapter, { async: false }),
        prompt: "p",
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects a non-image modality model before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<ImageContent[]>;
    const { adapter, requests } = createFakeImageAdapter(
      async () => stubHandle
    );

    await expect(
      submitImageTask({
        model: imageModel(adapter, { modality: "video" }),
        prompt: "p",
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects an empty prompt before dispatch", async () => {
    const stubHandle = { taskId: "t" } as unknown as TaskHandle<ImageContent[]>;
    const { adapter, requests } = createFakeImageAdapter(
      async () => stubHandle
    );

    await expect(
      submitImageTask({ model: imageModel(adapter), prompt: "" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });
});
