/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  submitVideoTask,
  type VideoGenerationRequest,
} from "@ai-media/sdk";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const ALIYUN_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1",
};

const T2V = "happyhorse-1.1-t2v";
const I2V = "happyhorse-1.1-i2v";

function submitResponse(taskId = "task-1") {
  return transportResponse(200, {
    output: { task_id: taskId, task_status: "PENDING" },
    request_id: "submit-req",
  });
}

function taskResponse(status: string, extra: Record<string, unknown> = {}) {
  return transportResponse(200, {
    output: { task_id: "task-1", task_status: status, ...extra },
    usage: { duration: 5, video_count: 1, SR: 720, ratio: "16:9" },
    request_id: `poll-${status}`,
  });
}

const WAIT_OPTS = { pollIntervalMs: 0, timeoutMs: 5000 };

describe("aliyun-bailian video adapter", () => {
  test("video() binds HappyHorse models with video + async capabilities", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const t2v = provider.video(T2V);
    expect(t2v.modelId).toBe(T2V);
    expect(t2v.providerId).toBe("aliyun-bailian");
    expect(t2v.capabilities.modality).toBe("video");
    expect(t2v.capabilities.async).toBe(true);

    const i2v = provider.video(I2V);
    expect(i2v.capabilities.modality).toBe("video");
  });

  test("video() rejects an unknown model with UNKNOWN_MODEL and a non-video model with INVALID_REQUEST", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const unknownError = (() => {
      try {
        provider.video("not-a-real-model");
      } catch (e) {
        return e as SdkError;
      }
      throw new Error("expected throw");
    })();
    expect(unknownError).toBeInstanceOf(SdkError);
    expect(unknownError.code).toBe("UNKNOWN_MODEL");

    expect(() => provider.video("qwen-image-2.0-pro")).toThrow(
      /not a video model/
    );
    const nonVideoError = (() => {
      try {
        provider.video("qwen-image-2.0-pro");
      } catch (e) {
        return e as SdkError;
      }
      throw new Error("expected throw");
    })();
    expect(nonVideoError.code).toBe("INVALID_REQUEST");
  });

  test("builds the t2v submit request with the async header and prompt body", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const task = await submitVideoTask({
      model,
      prompt: "一只猫在奔跑",
      providerOptions: {
        aliyun: {
          resolution: "720P",
          ratio: "16:9",
          duration: 5,
          watermark: false,
        },
      },
    });
    await task.wait(WAIT_OPTS);

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["X-DashScope-Async"]).toBe("enable");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.model).toBe(T2V);
    const input = body.input as Record<string, unknown>;
    expect(input.prompt).toBe("一只猫在奔跑");
    expect(input.media).toBeUndefined();
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.resolution).toBe("720P");
    expect(parameters.ratio).toBe("16:9");
    expect(parameters.duration).toBe(5);
    expect(parameters.watermark).toBe(false);
  });

  test("builds the i2v body with a first_frame media entry and omits ratio", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(I2V);

    const task = await submitVideoTask({
      model,
      prompt: "让画面动起来",
      firstFrame: { url: "https://example.com/first.png" },
      providerOptions: { aliyun: { resolution: "1080P", duration: 5 } },
    });
    await task.wait(WAIT_OPTS);

    const body = requests[0]!.body as Record<string, unknown>;
    const input = body.input as Record<string, unknown>;
    const media = input.media as Array<Record<string, unknown>>;
    expect(media).toHaveLength(1);
    expect(media[0]!.type).toBe("first_frame");
    expect(media[0]!.url).toBe("https://example.com/first.png");
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.ratio).toBeUndefined();
    expect(parameters.resolution).toBe("1080P");
  });

  test("maps a base64 first-frame to a data URI", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(I2V);

    const task = await submitVideoTask({
      model,
      prompt: "动起来",
      firstFrame: { base64: "aGVsbG8=", mimeType: "image/png" },
    });
    await task.wait(WAIT_OPTS);

    const body = requests[0]!.body as Record<string, unknown>;
    const media = (body.input as Record<string, unknown>).media as Array<
      Record<string, unknown>
    >;
    expect(media[0]!.url).toBe("data:image/png;base64,aGVsbG8=");
  });

  test("rejects a missing first-frame for an i2v model before transport", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(I2V);

    // Cast to the untyped VideoGenerationRequest: the family TParams would
    // otherwise narrow `firstFrame` to required at compile time. The test
    // deliberately passes a missing value to exercise the runtime adapter
    // validator path.
    await expect(
      submitVideoTask({ model, prompt: "动起来" } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("polls PENDING -> RUNNING -> SUCCEEDED and resolves with the video url", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("PENDING"),
      taskResponse("RUNNING"),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const task = await submitVideoTask({ model, prompt: "p" });
    const result = await task.wait(WAIT_OPTS);

    expect(result.provider).toBe("aliyun-bailian");
    expect(result.model).toBe(T2V);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.url).toBe("https://x/v.mp4");
    expect(result.content[0]?.duration).toBe(5);
    // 1 submit POST + 3 polls (PENDING, RUNNING, SUCCEEDED).
    expect(requests).toHaveLength(4);
    expect(requests[1]!.method).toBe("GET");
    expect(requests[1]!.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1"
    );
  });

  test("rejects when the task ends FAILED", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("FAILED", { code: "InvalidParameter", message: "bad" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const task = await submitVideoTask({ model, prompt: "p" });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain("test-key");
  });

  test("classifies submit 401 as non-retryable AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, {
        code: "InvalidApiKey",
        message: "Invalid API-key provided.",
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
  });

  test("classifies submit 429 as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      transportResponse(429, { code: "Throttling", message: "slow down" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("classifies submit 5xx as PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      transportResponse(503, { code: "InternalError", message: "down" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(T2V);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.message).not.toContain("test-key");
  });

  test("submitVideoTask rejects a non-async (image) model before dispatch", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    // Bind an image (sync) model, then attempt the video entry.
    const imageModel = provider.image(
      "qwen-image-2.0-pro"
    ) as unknown as Parameters<typeof submitVideoTask>[0]["model"];

    await expect(
      submitVideoTask({ model: imageModel, prompt: "p" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });
});
